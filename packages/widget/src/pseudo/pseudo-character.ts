import * as PIXI from 'pixi.js';
import type { Emotion, MotionName } from '@huinuo/shared';
import { MOTION_LIBRARY } from '../motion/library';
import { fromMotion3Json } from '../motion/motion3-import';
import type { Motion3Json } from '../motion/export';
import { blend, MotionPlayer, type Frame } from '../motion/player';
import { STANDARD_PROFILE } from '../motion/profiles';
import type { LogicalParam, MotionDef } from '../motion/types';
import { loadRig, type PseudoRig, type RigPart } from './rig';

/** 伪 Live2D 的参数默认值（Live2D 标准参数的逻辑名） */
const DEFAULTS: Partial<Record<LogicalParam, number>> = { eyeLOpen: 1, eyeROpen: 1 };

/** 弹簧：给耳朵、尾巴做物理摆动 */
class Spring {
  value = 0;
  private vel = 0;
  constructor(
    private readonly stiffness: number,
    private readonly damping: number,
  ) {}
  step(target: number, dt: number): number {
    const acc = -this.stiffness * (this.value - target) - this.damping * this.vel;
    this.vel += acc * dt;
    this.value += this.vel * dt;
    return this.value;
  }
  kick(v: number): void {
    this.vel += v;
  }
}

/** 网格：保存原始顶点，按函数逐帧变形 */
class Warp {
  readonly mesh: PIXI.SimplePlane;
  private readonly rest: Float32Array;
  constructor(
    texture: PIXI.Texture,
    readonly cols: number,
    readonly rows: number,
  ) {
    this.mesh = new PIXI.SimplePlane(texture, cols, rows);
    this.rest = Float32Array.from(this.buffer.data as unknown as Float32Array);
  }
  private get buffer(): PIXI.Buffer {
    return this.mesh.geometry.getBuffer('aVertexPosition');
  }
  /** fn(u, v) 返回该顶点的位移 [dx, dy]（u, v 为 0~1 的网格坐标） */
  apply(fn: (u: number, v: number, x: number, y: number) => [number, number]): void {
    const buf = this.buffer;
    const data = buf.data as unknown as Float32Array;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = (r * this.cols + c) * 2;
        const [dx, dy] = fn(c / (this.cols - 1), r / (this.rows - 1), this.rest[i], this.rest[i + 1]);
        data[i] = this.rest[i] + dx;
        data[i + 1] = this.rest[i + 1] + dy;
      }
    }
    buf.update();
  }
}

export interface PseudoOptions {
  rigUrl: string;
  /** 额外动作：.motion3.json 文件清单（index.json：{ "名字": "文件.motion3.json" }） */
  motionsIndexUrl?: string;
}

/**
 * 伪 Live2D 角色：用一张立绘拆出来的部件 + 网格变形 + 弹簧物理模拟 Live2D。
 * 参数使用 Live2D 标准命名（经 STANDARD_PROFILE），所以动作库和 .motion3.json 都能直接驱动。
 */
export class PseudoCharacter {
  readonly player: MotionPlayer;
  private readonly custom = new Map<string, MotionDef>();
  private app!: PIXI.Application;
  private rig!: PseudoRig;
  private root = new PIXI.Container();
  private headGroup = new PIXI.Container();
  private headWarp!: Warp;
  private bodyWarp!: Warp;
  private headRT!: PIXI.RenderTexture;
  private headScene = new PIXI.Container();
  private ears!: { l: PIXI.Sprite; r: PIXI.Sprite };
  private tail!: PIXI.Sprite;
  private face: Record<string, PIXI.Sprite> = {};
  private blush = new PIXI.Graphics();
  private params: Partial<Record<LogicalParam, number>> = {};
  private time = 0;
  private nextBlink = 2;
  private blinkT = -1;
  private earSprings = { l: new Spring(160, 9), r: new Spring(150, 8) };
  private tailSpring = new Spring(40, 4);
  private nextFlick = 4;
  private prev = { headRot: 0, headX: 0, bodyX: 0 };
  private focus = { x: 0, y: 0, tx: 0, ty: 0 };
  private scale = 1;
  private overrides: Partial<Record<LogicalParam, number>> = {};

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opts: PseudoOptions,
  ) {
    this.player = new MotionPlayer();
  }

  static async create(canvas: HTMLCanvasElement, opts: PseudoOptions): Promise<PseudoCharacter> {
    const c = new PseudoCharacter(canvas, opts);
    await c.init();
    return c;
  }

  private async init(): Promise<void> {
    const { rig, base } = await loadRig(this.opts.rigUrl);
    this.rig = rig;
    const rect = this.canvas.getBoundingClientRect();
    this.app = new PIXI.Application({
      view: this.canvas,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    const tex = (p: RigPart) => PIXI.Texture.from(new URL(p.file, base).href);
    const all = [...Object.values(rig.parts), ...Object.values(rig.face.sprites)];
    await Promise.all(all.map((p) => loadTexture(new URL(p.file, base).href)));

    const P = rig.parts;
    // 尾巴（最后面）
    this.tail = new PIXI.Sprite(tex(P.tail));
    this.placePivot(this.tail, P.tail);
    // 身体：网格（呼吸、身体倾斜）
    this.bodyWarp = new Warp(tex(P.body), 10, 16);
    this.bodyWarp.mesh.position.set(P.body.x, P.body.y);
    // 头部组：耳朵 + 头（头部先渲染到 RenderTexture，再贴到网格上做转头变形）
    const [hx, hy] = P.head.pivot ?? [P.head.x + P.head.w / 2, P.head.y + P.head.h];
    this.headGroup.pivot.set(hx, hy);
    this.headGroup.position.set(hx, hy);
    this.ears = { l: new PIXI.Sprite(tex(P.ear_l)), r: new PIXI.Sprite(tex(P.ear_r)) };
    this.placePivot(this.ears.l, P.ear_l);
    this.placePivot(this.ears.r, P.ear_r);

    this.headRT = PIXI.RenderTexture.create({ width: P.head.w, height: P.head.h, resolution: 2 });
    const headSprite = new PIXI.Sprite(tex(P.head));
    this.headScene.addChild(headSprite);
    // 叠放顺序：半闭在下、全闭在上；小张嘴在下、大张嘴在上
    const rank = (k: string) => (/half|mouth_open/.test(k) ? 0 : 1);
    const faceEntries = Object.entries(rig.face.sprites).sort((a, b) => rank(a[0]) - rank(b[0]));
    for (const [key, s] of faceEntries) {
      const sp = new PIXI.Sprite(tex(s));
      sp.position.set(s.x - P.head.x, s.y - P.head.y);
      sp.alpha = 0;
      this.face[key] = sp;
      this.headScene.addChild(sp);
    }
    this.headScene.addChild(this.blush);
    this.headWarp = new Warp(this.headRT, 12, 12);
    this.headWarp.mesh.position.set(P.head.x, P.head.y);

    // 垫底：一份不变形的头部（只随头部组旋转），网格变形把边缘往里拉时露出的是头发而不是空隙
    this.headBack = new Warp(tex(P.head), 12, 12);
    this.headBack.mesh.position.set(P.head.x, P.head.y);
    this.headGroup.addChild(this.ears.l, this.ears.r, this.headBack.mesh, this.headWarp.mesh);
    this.root.addChild(this.tail, this.bodyWarp.mesh, this.headGroup);
    this.app.stage.addChild(this.root);

    if (this.opts.motionsIndexUrl) await this.loadMotionIndex(this.opts.motionsIndexUrl);

    this.player.setAmbient('idle_breathe');
    this.app.ticker.add(() => this.update(this.app.ticker.deltaMS / 1000));
    this.layout();
  }

  private placePivot(sp: PIXI.Sprite, p: RigPart): void {
    const [px, py] = p.pivot ?? [p.x + p.w / 2, p.y + p.h / 2];
    sp.pivot.set(px - p.x, py - p.y);
    sp.position.set(px, py);
  }

  // ───────────── 动作 ─────────────

  /** 注册一个新动作（代码里定义） */
  addMotion(name: string, def: MotionDef): void {
    this.custom.set(name, def);
  }

  /** 从 .motion3.json 注册一个新动作 */
  async addMotionFile(name: string, url: string): Promise<string[]> {
    const json = (await (await fetch(url)).json()) as Motion3Json;
    const { def, skipped } = fromMotion3Json(json, STANDARD_PROFILE);
    this.custom.set(name, def);
    return skipped;
  }

  /** 读取 index.json，批量注册目录里的 .motion3.json */
  async loadMotionIndex(url: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) return;
    const index = (await res.json()) as Record<string, string | { file: string }>;
    const dir = new URL('.', new URL(url, location.href)).href;
    await Promise.all(
      Object.entries(index).map(([name, v]) => this.addMotionFile(name, new URL(typeof v === 'string' ? v : v.file, dir).href)),
    );
  }

  get motionNames(): string[] {
    return [...Object.keys(MOTION_LIBRARY), ...this.custom.keys()];
  }

  play(name: string): Promise<void> {
    const def = this.custom.get(name);
    if (def) return this.player.playDef('custom', def);
    if (name in MOTION_LIBRARY) return this.player.play(name as MotionName);
    return Promise.resolve();
  }

  stopAction(): void {
    this.player.stopAction();
  }

  setEmotion(e: Emotion): void {
    this.player.setEmotion(e);
  }

  setSpeaking(on: boolean): void {
    this.player.setSpeaking(on);
  }

  setAmbient(m: MotionName | null): void {
    this.player.setAmbient(m);
  }

  /** 调试：把某个参数固定为某个值（null 取消） */
  setParam(p: LogicalParam, value: number | null): void {
    if (value === null) delete this.overrides[p];
    else this.overrides[p] = value;
  }

  /** 视线 / 转头跟随页面上的点 */
  lookAt(clientX: number, clientY: number): void {
    const r = this.canvas.getBoundingClientRect();
    const head = this.root.toGlobal(new PIXI.Point(this.rig.parts.head.x + this.rig.parts.head.w / 2, this.rig.parts.head.y + this.rig.parts.head.h * 0.6));
    const dx = (clientX - r.left - head.x) / Math.max(200, r.width);
    const dy = (clientY - r.top - head.y) / Math.max(200, r.height);
    this.focus.tx = Math.max(-1, Math.min(1, dx * 2));
    this.focus.ty = Math.max(-1, Math.min(1, -dy * 2));
  }

  lookForward(): void {
    this.focus.tx = 0;
    this.focus.ty = 0;
  }

  // ───────────── 每帧 ─────────────

  private param(p: LogicalParam): number {
    return this.params[p] ?? DEFAULTS[p] ?? 0;
  }

  private update(dt: number): void {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const frame: Frame = this.player.update(dt);

    // 基础值：视线跟随 + 自动眨眼
    this.focus.x += (this.focus.tx - this.focus.x) * Math.min(1, dt * 5);
    this.focus.y += (this.focus.ty - this.focus.y) * Math.min(1, dt * 5);
    let blink = 1;
    if (this.time > this.nextBlink && this.blinkT < 0) this.blinkT = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const t = this.blinkT / 0.16;
      blink = t < 1 ? 1 - t : t < 2 ? t - 1 : 1;
      if (t >= 2) {
        this.blinkT = -1;
        this.nextBlink = this.time + 2 + Math.random() * 4;
      }
    }
    const base: Partial<Record<LogicalParam, number>> = {
      angleX: this.focus.x * 22,
      angleY: this.focus.y * 16,
      bodyX: this.focus.x * 4,
      eyeLOpen: blink,
      eyeROpen: blink,
    };
    for (const p of Object.keys(STANDARD_PROFILE.params) as LogicalParam[]) {
      this.params[p] = this.overrides[p] ?? blend(base[p] ?? DEFAULTS[p] ?? 0, frame.layers, p);
    }

    this.applyBody(frame);
    this.applyHead(dt);
    this.applyFace();
    this.applyPhysics(dt);
    this.applyTransform(frame);
  }

  private applyBody(_frame: Frame): void {
    const breath = (Math.sin(this.time * 2.2) + 1) / 2;
    const bx = this.param('bodyX'); // -10~10：上身左右
    const by = this.param('bodyY'); // 前后倾
    const bz = this.param('bodyZ'); // 侧倾
    const B = this.rig.parts.body;
    const neckV = (this.rig.parts.head.pivot![1] - B.y) / B.h;
    this.bodyWarp.apply((u, v) => {
      const up = Math.pow(Math.max(0, 1 - v / 0.62), 1.4); // 越靠上身变形越大，腿和脚不动
      const chest = Math.max(0, 1 - Math.abs(v - 0.12) / 0.12) * Math.sin(Math.PI * u);
      const dx = (bx * 0.9 + bz * 1.6 * (1 - v)) * up;
      const dy = -breath * 2.2 * chest + by * 0.5 * up;
      return [dx, dy];
    });
    // 头跟着脖子走
    const up = Math.pow(Math.max(0, 1 - neckV / 0.62), 1.4);
    this.neckOffset = [(bx * 0.9 + bz * 1.6 * (1 - neckV)) * up, by * 0.5 * up - breath * 1.2];
  }

  private neckOffset: [number, number] = [0, 0];
  private earBase = { l: 0, r: 0 };
  private headBack!: Warp;

  private applyHead(_dt: number): void {
    const H = this.rig.parts.head;
    const [hx, hy] = H.pivot!;
    const ax = this.param('angleX') / 30; // -1~1
    const ay = this.param('angleY') / 30;
    const az = this.param('angleZ') / 30;
    this.headGroup.position.set(hx + this.neckOffset[0], hy + this.neckOffset[1]);
    // 身体侧倾带一点点整体旋转；歪头本身放进网格里（越往上转得越多，下巴和发梢不动）
    this.headGroup.rotation = (this.param('bodyZ') / 10) * (2 * Math.PI) / 180;
    const tilt = (-az * 9 * Math.PI) / 180;
    // 网格变形：下巴（v=1）固定，越往上、越靠中间位移越大 → 有立体感的转头 / 点头
    const fx = 14;
    const fy = 9;
    // 下巴所在的高度（网格 v 坐标）以下完全不动，避免下巴和脖子之间露缝
    const jawV = (this.rig.parts.head.pivot![1] - 14 - H.y) / H.h;
    const weight = (v: number) => Math.pow(Math.max(0, (jawV - v) / jawV), 1.3);
    const deform = (u: number, v: number, x: number, y: number, k = 1): [number, number] => {
      const across = Math.pow(Math.sin(Math.PI * u), 0.7);
      const down = weight(v);
      const bulge = across * down;
      let dx = ax * fx * bulge + ax * 4 * down;
      let dy = -ay * fy * bulge * (0.6 + 0.4 * Math.sin(Math.PI * v));
      // 歪头：绕下巴转，权重随高度递增
      const a = tilt * down;
      const rx = x + H.x - hx;
      const ry = y + H.y - hy;
      dx += rx * Math.cos(a) - ry * Math.sin(a) - rx;
      dy += rx * Math.sin(a) + ry * Math.cos(a) - ry;
      return [dx * k, dy * k];
    };
    this.headWarp.apply((u, v, x, y) => deform(u, v, x, y));
    // 垫底层少跟一点，网格边缘往里收时露出的是头发
    this.headBack.apply((u, v, x, y) => deform(u, v, x, y, 0.8));
    // 耳朵：放在耳根处网格的位置上，随歪头一起转
    for (const side of ['l', 'r'] as const) {
      const part = this.rig.parts[side === 'l' ? 'ear_l' : 'ear_r'];
      const [px, py] = part.pivot!;
      const u = (px - H.x) / H.w;
      const v = (py - H.y) / H.h;
      const [dx, dy] = deform(u, v, px - H.x, py - H.y);
      const sp = this.ears[side];
      sp.position.set(px + dx + ax * 3, py + dy - ay * 4);
      sp.rotation = this.earBase[side] + tilt * weight(v);
    }
  }

  private applyFace(): void {
    const f = this.face;
    const set = (key: string, a: number) => {
      if (f[key]) f[key].alpha = Math.max(0, Math.min(1, a));
    };
    for (const side of ['l', 'r'] as const) {
      const open = side === 'l' ? this.param('eyeLOpen') : this.param('eyeROpen');
      const smile = side === 'l' ? this.param('eyeLSmile') : this.param('eyeRSmile');
      const closed = Math.max(0, Math.min(1, Math.max(1 - open, smile * 0.9)));
      // 0~0.5：渐入半闭；0.5~1：半闭 → 全闭
      set(`eye_${side}_eyes_half`, closed * 2);
      set(`eye_${side}_eyes_closed`, (closed - 0.5) * 2);
    }
    const mouth = this.param('mouthOpen');
    set('mouth_mouth_open', mouth * 2.5);
    set('mouth_mouth_wide', (mouth - 0.45) * 2.2);

    const cheek = Math.max(0, Math.min(1, this.param('cheek')));
    const H = this.rig.parts.head;
    this.blush.clear();
    if (cheek > 0.01) {
      for (const [cx, cy] of [[468, 252], [550, 252]]) {
        for (let i = 6; i >= 1; i--) {
          this.blush.beginFill(0xff8fa0, (cheek * 0.07 * (7 - i)) / 6);
          this.blush.drawEllipse(cx - H.x, cy - H.y, 4 + i * 3.2, 2 + i * 1.6);
          this.blush.endFill();
        }
      }
    }
    this.app.renderer.render(this.headScene, { renderTexture: this.headRT, clear: true });
  }

  private applyPhysics(dt: number): void {
    const rot = this.headGroup.rotation + (-this.param('angleZ') / 30) * 0.15;
    const hx = this.headGroup.x;
    const vRot = (rot - this.prev.headRot) / Math.max(dt, 1e-3);
    const vX = (hx - this.prev.headX) / Math.max(dt, 1e-3);
    this.prev.headRot = rot;
    this.prev.headX = hx;
    // 偶尔抖一下耳朵（小动物的习惯）
    if (this.time > this.nextFlick) {
      (Math.random() < 0.5 ? this.earSprings.l : this.earSprings.r).kick((Math.random() < 0.5 ? -1 : 1) * 2.2);
      this.nextFlick = this.time + 3 + Math.random() * 6;
    }
    const earTarget = -vRot * 0.05 - vX * 0.004;
    this.earBase.l = Math.max(-0.35, Math.min(0.35, this.earSprings.l.step(earTarget, dt)));
    this.earBase.r = Math.max(-0.35, Math.min(0.35, this.earSprings.r.step(earTarget, dt)));

    const bx = this.param('bodyX');
    const vB = (bx - this.prev.bodyX) / Math.max(dt, 1e-3);
    this.prev.bodyX = bx;
    const wag = Math.sin(this.time * 1.7) * 0.1 + Math.sin(this.time * 0.6) * 0.05;
    this.tail.rotation = Math.max(-0.5, Math.min(0.5, this.tailSpring.step(wag - vB * 0.01, dt)));
  }

  private applyTransform(frame: Frame): void {
    const t = frame.transform;
    const { w, h } = this.rig.canvas;
    const r = this.canvas.getBoundingClientRect();
    const scale = this.scale;
    this.root.pivot.set(w / 2, h);
    this.root.position.set(r.width / 2 + t.x * h * scale, r.height + t.y * h * scale);
    this.root.rotation = t.rotation;
    this.root.scale.set(scale * (1 + t.scaleX), scale * (1 + t.scaleY));
  }

  layout(): void {
    const r = this.canvas.getBoundingClientRect();
    this.app.renderer.resize(Math.max(1, r.width), Math.max(1, r.height));
    // 立绘实际内容范围约 y 25~1470
    this.scale = Math.min((r.height * 0.97) / 1470, (r.width * 0.95) / 620);
  }

  /** 点到了头还是身体 */
  hitTest(clientX: number, clientY: number): 'head' | 'body' | null {
    const r = this.canvas.getBoundingClientRect();
    const p = this.root.toLocal(new PIXI.Point(clientX - r.left, clientY - r.top));
    const inside = (q: RigPart) => p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h;
    const P = this.rig.parts;
    if (inside(P.head) || inside(P.ear_l) || inside(P.ear_r)) return 'head';
    if (inside(P.body) || inside(P.tail)) return 'body';
    return null;
  }

  getClientBounds(): DOMRect {
    const r = this.canvas.getBoundingClientRect();
    const b = this.root.getBounds();
    return new DOMRect(r.left + b.x, r.top + b.y, b.width, b.height);
  }

  destroy(): void {
    this.app.destroy(false, { children: true });
  }
}

function loadTexture(url: string): Promise<PIXI.Texture> {
  const t = PIXI.Texture.from(url);
  if (t.baseTexture.valid) return Promise.resolve(t);
  return new Promise((resolve, reject) => {
    t.baseTexture.once('loaded', () => resolve(t));
    t.baseTexture.once('error', reject);
  });
}
