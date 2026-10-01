/** tools/pseudo-live2d/build_parts.py + build_face.py 生成的部件描述 */
export interface RigPart {
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pivot?: [number, number];
}

export interface PseudoRig {
  canvas: { w: number; h: number };
  order: string[];
  parts: Record<'body' | 'head' | 'ear_l' | 'ear_r' | 'tail', RigPart>;
  face: { sprites: Record<string, RigPart> };
}

export async function loadRig(url: string): Promise<{ rig: PseudoRig; base: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`无法加载 ${url}: HTTP ${res.status}`);
  return { rig: (await res.json()) as PseudoRig, base: new URL('.', new URL(url, location.href)).href };
}
