// Words written into the air: a hand-lettered line that appears beside whoever said it, drifts up
// and fades. Used for Dale's shouting and for the odd crash from behind a door. Sprites, so they
// sit in the world (and get hidden by walls), not in a UI layer.
import * as THREE from 'three';

function paint(text, { color = '#fff6e0', stroke = 'rgba(20,14,8,0.9)', font = 'Caveat', weight = '700', size = 72 } = {}) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = `${weight} ${size}px "${font}"`;
  // wrap to ~22 chars a line
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > 24 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  const W = Math.min(1400, Math.max(...lines.map((l) => g.measureText(l).width)) + 40), H = lines.length * size * 1.05 + 30;
  c.width = W; c.height = H; g.font = `${weight} ${size}px "${font}"`; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => { const y = 15 + size * 0.55 + i * size * 1.05; g.lineWidth = size * 0.14; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(l, W / 2, y); g.fillStyle = color; g.fillText(l, W / 2, y); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: W / H, lines: lines.length };
}

export class SpeechLayer {
  constructor(parent) { this.parent = parent; this.items = []; }
  /** say(text, positionLocal, {follow: Object3D, height, style, life}) */
  say(text, pos, { follow = null, height = 0.35, style = {}, life = null, scale = 1 } = {}) {
    if (follow) for (const it of this.items) if (it.follow === follow) it.t = Math.max(it.t, it.L - 0.25); // the new line replaces the old
    const { t, aspect, lines } = paint(text, style);
    const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0, fog: false });
    const s = new THREE.Sprite(m); const h = 0.18 * lines * scale; s.scale.set(h * aspect / lines * lines, h, 1);
    s.renderOrder = 8; this.parent.add(s);
    const L = life ?? Math.min(6, 2.2 + text.length * 0.05);
    // whoever is speaking moves their mouth (stylized figures: src/story/figures.js)
    const fig = follow?.userData?.figure; if (fig) { fig.talk(Math.min(L - 0.6, 0.6 + text.length * 0.065), text === text.toUpperCase() && /[A-Z]/.test(text)); height += 0.16; }
    this.items.push({ s, pos: pos.clone(), follow, height, t: 0, L });
    return s;
  }
  update(dt) {
    for (const it of this.items) {
      it.t += dt;
      const base = it.follow ? it.follow.getWorldPosition(new THREE.Vector3()).sub(this.parent.getWorldPosition(new THREE.Vector3())) : it.pos;
      it.s.position.copy(base); it.s.position.y += it.height + it.t * 0.12;
      const a = Math.min(1, it.t / 0.2) * Math.min(1, (it.L - it.t) / 0.8);
      it.s.material.opacity = Math.max(0, a);
    }
    this.items = this.items.filter((it) => { if (it.t < it.L) return true; this.parent.remove(it.s); it.s.material.map.dispose(); it.s.material.dispose(); return false; });
  }
  clear() { for (const it of this.items) this.parent.remove(it.s); this.items = []; }
}
