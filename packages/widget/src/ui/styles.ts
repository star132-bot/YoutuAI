export const STYLES = /* css */ `
:host {
  --hn-slate: #4E6170;
  --hn-teal: #3E9EA3;
  --hn-ink: #2B3A4A;
  --hn-paper: #F7F8F8;
  --hn-line: #DCE3E6;
  --hn-text: #22303C;
  --hn-muted: #6B7C88;
  --hn-panel: #FFFFFF;
  all: initial;
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--hn-text);
}
@media (prefers-color-scheme: dark) {
  :host {
    --hn-paper: #1E262D;
    --hn-line: #34424D;
    --hn-text: #E6ECEF;
    --hn-muted: #9AAAB5;
    --hn-panel: #252F37;
  }
}
:host([mode="widget"]) {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483000;
}
:host([mode="live"]) {
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
}
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
.root { position: relative; }
:host([mode="live"]) .root, :host([mode="live"]) .stage { width: 100%; height: 100%; }

.stage { position: relative; width: var(--hn-w, 240px); height: var(--hn-h, 320px); }
.stage[hidden] { display: none; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: grab; }
canvas.dragging { cursor: grabbing; }
.loading {
  position: absolute; inset: auto 0 40% 0; text-align: center;
  font-size: 13px; color: var(--hn-muted);
}

.bubble {
  --hn-shift: 0px;
  position: absolute; left: 50%; bottom: calc(100% - 28px); transform: translateX(calc(-50% + var(--hn-shift)));
  width: max-content; max-width: min(280px, 80vw);
  background: var(--hn-panel); color: var(--hn-text);
  border: 2px solid var(--hn-teal); border-radius: 16px;
  padding: 10px 14px; font-size: 14px; line-height: 1.55;
  box-shadow: 0 6px 20px rgba(43, 58, 74, 0.18);
  opacity: 0; pointer-events: none; transition: opacity .2s ease, transform .2s ease;
  z-index: 2;
}
.bubble.show { opacity: 1; pointer-events: auto; transform: translateX(calc(-50% + var(--hn-shift))) translateY(-4px); }
.bubble::after {
  content: ""; position: absolute; left: calc(50% - var(--hn-shift)); top: 100%; transform: translateX(-50%);
  border: 8px solid transparent; border-top-color: var(--hn-teal);
}
.bubble p { margin: 0; white-space: pre-wrap; }
.bubble-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; }
.bubble-actions[hidden] { display: none; }
.bubble-actions button {
  border: 0; border-radius: 999px; padding: 4px 12px; font-size: 12px;
  background: var(--hn-teal); color: #fff;
}
.bubble-actions button.ghost { background: transparent; color: var(--hn-muted); }
.bubble-actions button[hidden] { display: none; }
:host([mode="live"]) .bubble { font-size: clamp(18px, 3.2vh, 34px); max-width: 80%; bottom: auto; top: 4%; border-width: 3px; }
:host([mode="live"]) .bubble::after { display: none; }

.toolbar {
  position: absolute; right: 4px; top: 30%; display: flex; flex-direction: column; gap: 6px;
  opacity: 0; transition: opacity .2s; z-index: 2;
}
.stage:hover .toolbar, .stage:focus-within .toolbar, .toolbar.pinned { opacity: 1; }
.toolbar button {
  width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--hn-line);
  background: var(--hn-panel); color: var(--hn-slate); font-size: 16px;
  box-shadow: 0 2px 8px rgba(43,58,74,.15);
}
.toolbar button:focus-visible, .mini:focus-visible, .panel button:focus-visible, .panel input:focus-visible {
  outline: 2px solid var(--hn-teal); outline-offset: 2px;
}

.panel {
  position: absolute; right: calc(100% + 8px); bottom: 0;
  width: min(320px, calc(100vw - 32px)); height: min(420px, calc(100vh - 32px));
  display: flex; flex-direction: column;
  background: var(--hn-panel); border: 1px solid var(--hn-line); border-radius: 16px;
  box-shadow: 0 10px 30px rgba(43,58,74,.22); overflow: hidden;
}
.panel[hidden] { display: none; }
.panel header {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  background: var(--hn-slate); color: #fff; font-weight: 600;
}
.panel header .provider { font-weight: 400; font-size: 11px; opacity: .8; margin-right: auto; }
.panel header button { background: transparent; border: 0; color: #fff; font-size: 18px; line-height: 1; }
.log { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: var(--hn-paper); }
.msg { max-width: 85%; padding: 8px 12px; border-radius: 14px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.msg.user { align-self: flex-end; background: var(--hn-teal); color: #fff; border-bottom-right-radius: 4px; }
.msg.bot { align-self: flex-start; background: var(--hn-panel); border: 1px solid var(--hn-line); border-bottom-left-radius: 4px; }
.quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px 0; }
.quick button {
  border: 1px solid var(--hn-teal); color: var(--hn-teal); background: transparent;
  border-radius: 999px; padding: 4px 10px; font-size: 12px;
}
.panel form { display: flex; gap: 6px; padding: 10px 12px 12px; }
.panel input {
  flex: 1; min-width: 0; border: 1px solid var(--hn-line); border-radius: 999px;
  padding: 8px 12px; font: inherit; font-size: 14px; background: var(--hn-paper); color: var(--hn-text);
}
.panel form button { border: 0; border-radius: 999px; padding: 0 14px; background: var(--hn-teal); color: #fff; }
.panel form button:disabled { opacity: .5; cursor: default; }

.mini {
  width: 56px; height: 56px; border-radius: 50%; border: 2px solid var(--hn-teal);
  background: var(--hn-panel); font-size: 28px; box-shadow: 0 4px 14px rgba(43,58,74,.25);
}
.mini[hidden] { display: none; }

@media (max-width: 520px) {
  :host([mode="widget"]) { right: 8px; bottom: 8px; }
  .stage { width: 160px; height: 220px; }
  .panel { position: fixed; left: 8px; right: 8px; bottom: 8px; width: auto; height: 60vh; }
}
@media (prefers-reduced-motion: reduce) {
  .bubble, .toolbar { transition: none; }
}
`;
