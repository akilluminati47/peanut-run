// PEANUT RUN — Bungulate to the Burger
// Billboard peanut sprite speedrunning through procedural fast-food corridors,
// blasting vegetable enemies with rapid-fire peanuts, racing to the BungusMac.

import * as THREE from 'three';

/* ================================================================== util */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function fmtTime(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
}

/* =============================================================== audio */

const AudioFX = {
  ctx: null,
  master: null,
  _vol: null,
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = this._vol != null ? this._vol : 0.7;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});  // unlock after any gesture
  },
  setVolume(v) {
    this._vol = v;
    if (this.master) this.master.gain.value = v;
  },
  blip(freq, dur, type = 'square', vol = 0.08, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur);
  },
  noise(dur, vol = 0.12, lowpass = 1200) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  },
  shoot() { this.blip(620 + Math.random() * 120, 0.07, 'square', 0.05, -380); },
  menuTick() { this.fireBounce(200); },
  hit() { this.blip(220, 0.12, 'sawtooth', 0.09, -120); },
  kill() { this.blip(330, 0.18, 'square', 0.09, 220); this.noise(0.12, 0.06, 2400); },
  hurt() { this.blip(140, 0.3, 'sawtooth', 0.14, -90); },
  jump() { this.blip(300, 0.14, 'sine', 0.1, 260); },
  slide() { this.noise(0.3, 0.08, 700); },
  boom() { this.noise(0.6, 0.22, 500); this.blip(70, 0.5, 'sine', 0.18, -40); },
  launch() { this.blip(900, 0.45, 'sine', 0.04, 700); },
  fireBounce(freq) { this.blip((freq || 520) + Math.random() * 160, 0.10, 'sine', 0.06, 300); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.blip(f, 0.25, 'square', 0.08), i * 130));
  },
  // healing chimes — diamond is the fancier, longer arpeggio + shimmer
  heal() {
    [659, 988].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'sine', 0.09), i * 80));
  },
  healBig() {
    [659, 880, 1175, 1568].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.09), i * 75));
    setTimeout(() => this.noise(0.25, 0.05, 6000), 120);   // sparkle shimmer
  },
  // a random little firework — fired on every menu button press
  firework() {
    if (!this.ctx) return;
    const r = Math.random();
    if (r < 0.34) {                                  // whistle → pop
      this.launch();
      setTimeout(() => { this.noise(0.18, 0.16, 2600); this.blip(90, 0.35, 'sine', 0.12, -50); }, 200 + Math.random() * 120);
    } else if (r < 0.67) {                           // crackle burst
      this.noise(0.16, 0.13, 3200);
      for (let i = 0; i < 5; i++) setTimeout(() => this.blip(700 + Math.random() * 1400, 0.05, 'square', 0.045), i * 38 + Math.random() * 24);
    } else {                                         // sparkle boom
      this.blip(120, 0.4, 'sine', 0.13, -55); this.noise(0.3, 0.08, 5200);
      [1318, 1568, 2093].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'triangle', 0.05), i * 55));
    }
  },
  // triumphant ping when a boss drops its diamond peanut (fancier than healBig)
  bossPing() {
    [784, 1047, 1319, 1568, 2093].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'triangle', 0.1), i * 70));
    setTimeout(() => this.noise(0.45, 0.06, 7200), 150);          // long shimmer
    setTimeout(() => this.blip(2637, 0.55, 'sine', 0.06), 380);   // high sparkle tail
  },
};

/* ====================================================== canvas textures */

function canvasTexture(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16; // three clamps this to the GPU max
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  return tex;
}

function emojiTexture(emoji, size = 256) {
  return canvasTexture(size, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.font = `${s * 0.78}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, s / 2, s / 2 + s * 0.04);
  });
}

const floorTex = canvasTexture(512, (ctx, s) => {
  const t = s / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#f3e3c0' : '#d62300';
    ctx.fillRect(x * t, y * t, t, t);
  }
  ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * t, 0); ctx.lineTo(i * t, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * t); ctx.lineTo(s, i * t); ctx.stroke();
  }
}, true);

// returns { map, emissive } — the emissive map glows only the lit windows so the
// city looks self-lit and dynamic
function buildingTexture(base, trim) {
  const lit = [];
  for (let i = 0; i < 12; i++) lit.push(Math.random() < 0.72);
  function paint(ctx, emissive) {
    ctx.scale(2, 2); const s = 256;        // 512 canvas, draw in 256-space
    const aw = s * 0.16;
    if (emissive) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s); }
    else {
      ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 32) { ctx.fillStyle = (x / 32) % 2 ? '#fff3d6' : trim; ctx.fillRect(x, 0, 32, aw); }
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, aw, s, 6);
    }
    for (let y = 0, k = 0; y < 3; y++) for (let x = 0; x < 4; x++, k++) {
      const on = lit[k];
      // identical rects in both maps so the glow lands square on every lit window
      ctx.fillStyle = emissive ? (on ? '#fff3c0' : '#000') : (on ? '#ffd96b' : '#3a2218');
      ctx.fillRect(18 + x * 58, aw + 22 + y * 64, 38, 42);
      if (!emissive) { ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 4; ctx.strokeRect(18 + x * 58, aw + 22 + y * 64, 38, 42); }
    }
  }
  const emissive = canvasTexture(512, ctx => paint(ctx, true), true);
  // keep the emissive crisp at all distances/angles — mipmaps would average the
  // bright windows down to black so they'd only flicker on "every now and then"
  emissive.generateMipmaps = false;
  emissive.minFilter = THREE.LinearFilter;
  return { map: canvasTexture(512, ctx => paint(ctx, false), true), emissive };
}

// ONE-window-wide facade for the narrowest wall faces (end-caps, tiny transition pieces)
// so they show a single clean window instead of a whole tile crushed into a sliver.
function buildingTextureNarrow(base, trim) {
  const lit = [Math.random() < 0.8, Math.random() < 0.8, Math.random() < 0.8];
  function paint(ctx, emissive) {
    ctx.scale(2, 2); const s = 256;
    const aw = s * 0.16;
    if (emissive) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s); }
    else {
      ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 32) { ctx.fillStyle = (x / 32) % 2 ? '#fff3d6' : trim; ctx.fillRect(x, 0, 32, aw); }
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, aw, s, 6);
    }
    const ww = 120, wx = (s - ww) / 2;                // one centered window column, 3 rows
    for (let y = 0; y < 3; y++) {
      const on = lit[y];
      ctx.fillStyle = emissive ? (on ? '#fff3c0' : '#000') : (on ? '#ffd96b' : '#3a2218');
      ctx.fillRect(wx, aw + 22 + y * 64, ww, 42);
      if (!emissive) { ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 4; ctx.strokeRect(wx, aw + 22 + y * 64, ww, 42); }
    }
  }
  const emissive = canvasTexture(512, ctx => paint(ctx, true), true);
  emissive.generateMipmaps = false; emissive.minFilter = THREE.LinearFilter;
  return { map: canvasTexture(512, ctx => paint(ctx, false), true), emissive };
}

function signTexture(text, bg, fg) {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = fg; ctx.lineWidth = 10; ctx.setLineDash([22, 14]);
    ctx.strokeRect(12, 12, s - 24, s - 24);
    ctx.setLineDash([]);
    ctx.fillStyle = fg;
    ctx.font = `900 ${s * 0.3}px Rubik, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, s / 2, s / 2);
  });
}

const crateTex = canvasTexture(512, (ctx, s) => {
  // a fry box
  ctx.scale(s / 256, s / 256); s = 256;
  ctx.fillStyle = '#d62300'; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#ffc62e';
  for (let i = 0; i < 5; i++) ctx.fillRect(20 + i * 46, 0, 18, s);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, s - 28, s, 28);
  ctx.fillStyle = '#fff3d6';
  ctx.font = `900 ${s * 0.22}px Rubik, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.save(); ctx.translate(s / 2, s * 0.58); ctx.rotate(-0.06);
  ctx.fillText('FRIES', 0, 0); ctx.restore();
}, true);

// cardboard box texture with a bold label (BEEF, NUTS, etc.)
function cardboardBoxTex(label) {
  return canvasTexture(512, (ctx, s) => {
    ctx.scale(s / 256, s / 256); s = 256;
    // kraft-brown base
    ctx.fillStyle = '#b5834a'; ctx.fillRect(0, 0, s, s);
    // darker flaps
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    ctx.fillRect(0, 0, s * 0.14, s);       // left flap edge
    ctx.fillRect(s * 0.86, 0, s * 0.14, s); // right flap edge
    ctx.fillRect(0, 0, s, s * 0.14);       // top flap edge
    ctx.fillRect(0, s * 0.86, s, s * 0.14); // bottom flap edge
    // centre vertical seam
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(s / 2, s * 0.14); ctx.lineTo(s / 2, s * 0.86); ctx.stroke();
    // horizontal top-flap line
    ctx.beginPath(); ctx.moveTo(s * 0.14, s * 0.28); ctx.lineTo(s * 0.86, s * 0.28); ctx.stroke();
    // packing tape strip across the middle
    ctx.fillStyle = 'rgba(255,250,230,.55)'; ctx.fillRect(s * 0.05, s * 0.40, s * 0.90, s * 0.20);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2;
    ctx.strokeRect(s * 0.05, s * 0.40, s * 0.90, s * 0.20);
    // bold label
    ctx.fillStyle = '#241a10';
    ctx.font = `900 ${s * 0.22}px Rubik, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.save(); ctx.translate(s / 2, s * 0.54); ctx.rotate(-0.06);
    ctx.fillText(label, 0, 0); ctx.restore();
  }, true);
}
const beefCrateTex = cardboardBoxTex('BEEF');
const nutsCrateTex = cardboardBoxTex('NUTS');

// fast-food service counter for the JUMP! obstacles (was a flat grey box)
const counterTex = canvasTexture(512, (ctx, s) => {
  ctx.scale(s / 256, s / 256); s = 256;
  ctx.fillStyle = '#e9e2d2'; ctx.fillRect(0, 0, s, s);          // cream body
  ctx.fillStyle = '#b9bfc6'; ctx.fillRect(0, 0, s, s * 0.2);    // steel top
  ctx.fillStyle = '#9aa0a8'; ctx.fillRect(0, s * 0.18, s, 5);
  ctx.fillStyle = '#d62300'; ctx.fillRect(0, s * 0.24, s, 10);  // red trim
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 3;        // panel seams
  for (let x = 0; x <= s; x += 64) { ctx.beginPath(); ctx.moveTo(x, s * 0.26); ctx.lineTo(x, s); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, s - 16, s, 16); // kick strip
}, true);

// slide-bar overhead panel (counter-style but with trim near the bottom so it reads as a soffit)
const slideBarTex = canvasTexture(512, (ctx, s) => {
  ctx.scale(s / 256, s / 256); s = 256;
  ctx.fillStyle = '#e9e2d2'; ctx.fillRect(0, 0, s, s);          // cream body
  ctx.fillStyle = '#b9bfc6'; ctx.fillRect(0, s * 0.80, s, s * 0.2); // steel band near bottom
  ctx.fillStyle = '#9aa0a8'; ctx.fillRect(0, s * 0.80, s, 5);
  ctx.fillStyle = '#d62300'; ctx.fillRect(0, s * 0.74, s, 10);  // red trim above band
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 3;
  for (let x = 0; x <= s; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, s - 16, s, 16); // kick strip
}, true);

// white cauliflower head for the CAULIBLORB boss (drawn — no white veg emoji)
const cauliflowerTex = canvasTexture(256, (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  const cx = s * 0.5, cy = s * 0.46;
  ctx.fillStyle = '#7da050';                                   // pale-green leaves behind
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + i * (Math.PI / 6);
    ctx.save(); ctx.translate(cx, cy + s * 0.16); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(0, -s * 0.2, s * 0.09, s * 0.2, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  // bumpy white floret cluster
  for (let i = 0; i < 90; i++) {
    const ang = Math.random() * Math.PI * 2, rad = Math.random() ** 0.5 * s * 0.32;
    const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad * 0.92;
    const r = s * (0.05 + Math.random() * 0.045);
    const sh = 236 + Math.floor(Math.random() * 18);
    ctx.fillStyle = `rgb(${sh},${sh},${sh - 12})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';                     // top sheen
  for (let i = 0; i < 25; i++) {
    const ang = Math.random() * Math.PI * 2, rad = Math.random() * s * 0.28;
    ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * rad, cy - s * 0.06 + Math.sin(ang) * rad * 0.6, s * 0.018, 0, 7); ctx.fill();
  }
});

// turnip — pink crown, white root, clean oval body, 3 leaf shoots, single shine
const turnipTex = canvasTexture(256, (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  const cx = s * 0.5;
  const topY = s * 0.25;         // body-top — leaves attach here
  const cy = s * 0.53;           // body centre
  const bodyW = s * 0.32;        // half-width (wide oval)
  const bodyH = s * 0.28;        // half-height

  // three leaf shoots puffing straight out to the right
  ctx.fillStyle = '#7da050';
  for (const ang of [-0.55, 0, 0.55]) {
    ctx.save(); ctx.translate(cx, topY); ctx.rotate(ang + Math.PI * 0.05);
    ctx.beginPath(); ctx.ellipse(0, -s * 0.10, s * 0.04, s * 0.13, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  // clean oval body — single smooth gradient, no rim stroke
  const grad = ctx.createLinearGradient(cx, cy - bodyH, cx, cy + bodyH);
  grad.addColorStop(0, '#e870a0');     // pink crown
  grad.addColorStop(0.28, '#d4508a');  // deeper pink
  grad.addColorStop(0.48, '#c490b8');  // subtle purple transition
  grad.addColorStop(0.65, '#e8d8d0');  // cream
  grad.addColorStop(1, '#faf5f0');     // white base
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();

  // one skinny root from the bottom
  const rootY = cy + bodyH * 0.90;
  ctx.strokeStyle = '#e8d8d0'; ctx.lineWidth = s * 0.022; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, rootY);
  ctx.quadraticCurveTo(cx - s * 0.01, rootY + s * 0.09, cx - s * 0.005, rootY + s * 0.15);
  ctx.stroke();

  // single large highlight — upper-left crown
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.10, cy - bodyH * 0.50, s * 0.14, s * 0.09, -0.35, 0, 7);
  ctx.fill();
});

const ketchupTex = canvasTexture(256, (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(170,20,0,.92)';
  ctx.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.25) {
    const r = s * (0.34 + 0.1 * Math.sin(a * 3.7) + 0.04 * Math.sin(a * 9));
    const x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r;
    a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(255,120,90,.45)';
  ctx.beginPath(); ctx.ellipse(s * 0.4, s * 0.4, s * 0.12, s * 0.07, -0.6, 0, Math.PI * 2); ctx.fill();
});

// purple oil-leak puddle — same blobby shape as the ketchup spill, shaded purple,
// for purple donks
const purplePuddleTex = canvasTexture(256, (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(92,28,138,.92)';
  ctx.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.25) {
    const r = s * (0.34 + 0.1 * Math.sin(a * 3.7) + 0.04 * Math.sin(a * 9));
    const x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r;
    a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(196,128,235,.45)';
  ctx.beginPath(); ctx.ellipse(s * 0.4, s * 0.4, s * 0.12, s * 0.07, -0.6, 0, Math.PI * 2); ctx.fill();
});

const parkingTex = canvasTexture(512, (ctx, s) => {
  ctx.fillStyle = '#26282f'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 500; i++) {            // asphalt speckle
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '120,120,130'},${Math.random() * 0.14})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
}, true);

/* ============================================================ renderer */

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;   // blob shadows clip to obstacle tops

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b1330');
scene.fog = new THREE.Fog('#101c44', 38, 120);   // navy — distant geo melts into the horizon

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 400);
camera.rotation.order = 'YXZ';

// night lighting: cool moonlight key + warm fill so the fast-food signage still pops
const hemi = new THREE.HemisphereLight('#9fb4ff', '#241a30', 0.62);
scene.add(hemi);
// single source of truth for where the moon is, so its light and the moon sprite
// always agree — shadows fall straight away from the moon as the point of light
const MOON_DIR = new THREE.Vector3(0.55, 0.66, 0.52).normalize();
// the ACTIVE moon direction for the current level — boss levels mirror it to the
// OTHER side (setMoonSide). The moonlight and the sky's moon sprite both read this
// so the shadows always fall straight away from wherever the moon actually is.
const moonDir = MOON_DIR.clone();
const SUN_DIST = 50;
const sun = new THREE.DirectionalLight('#cdd9ff', 1.05);   // the moon
sun.position.copy(moonDir).multiplyScalar(SUN_DIST);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
// symmetric frustum centred on the player (the shadow target), large enough that
// shadows thrown away from the moon in any direction stay inside it
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = SUN_DIST + 60;
sun.shadow.bias = -0.0003;
scene.add(sun);
scene.add(sun.target);

// warm ambient streetlight so the night isn't flatly blue
const streetFill = new THREE.HemisphereLight('#ffcaa0', '#000000', 0.18);
scene.add(streetFill);

// ===================== night sky (graceful — no UV pole pinch) ====================
// A shader gradient dome (colour purely from view direction, so it can't stretch),
// real 3D star points, and a billboard moon that's always a perfect circle.
function buildNightSky() {
  const group = new THREE.Group();
  const R = 340;

  // gradient dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color('#04060f') },
        horizon: { value: new THREE.Color('#1b2c5a') },
        bottom: { value: new THREE.Color('#070b1c') },
      },
      vertexShader: `
        varying vec3 vDir;
        void main(){ vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
        void main(){
          float h = vDir.y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55))
                           : mix(horizon, bottom, pow(-h, 0.7));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
  dome.renderOrder = -2;
  group.add(dome);

  // plain blue star dot (the "normal blue stars")
  const blueDot = canvasTexture(32, (ctx, s) => {
    const c = s / 2, g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(210,228,255,1)');
    g.addColorStop(0.45, 'rgba(150,186,255,0.92)');
    g.addColorStop(1, 'rgba(120,160,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  // glowing star: TIGHT little halo with a blue star core baked into the centre
  const glowStar = canvasTexture(64, (ctx, s) => {
    const c = s / 2, g = ctx.createRadialGradient(c, c, 0, c, c, s * 0.42);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');     // weak centre so the blue shows
    g.addColorStop(0.22, 'rgba(228,240,255,0.8)');   // tight halo ring
    g.addColorStop(1, 'rgba(170,205,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(105,160,255,1)';           // blue star core
    ctx.beginPath(); ctx.arc(c, c, s * 0.085, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(190,215,255,0.95)';
    ctx.beginPath(); ctx.arc(c, c, s * 0.04, 0, 7); ctx.fill();
  });
  function starLayer(n, size, opacity, blending, tex, color) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x, y, z, d;
      do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; d = x * x + y * y + z * z; }
      while (d > 1 || d < 1e-3);
      const k = (R - 12) / Math.sqrt(d);
      pos[i * 3] = x * k; pos[i * 3 + 1] = Math.abs(y) * k * 0.96; pos[i * 3 + 2] = z * k; // bias above horizon
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({
      map: tex, size, sizeAttenuation: false, transparent: true,
      opacity, depthWrite: false, blending, color: color || '#eaf0ff',
    }));
    pts.renderOrder = -1;
    return pts;
  }
  // dim "normal blue stars" — ~33% brighter (opacity 0.85→1.0, larger, bluer)
  group.add(starLayer(900, 2.9, 1.0, THREE.NormalBlending, blueDot, '#cfe0ff'));
  // glowing stars — tighter/smaller glow + blue core
  group.add(starLayer(150, 3.6, 0.95, THREE.AdditiveBlending, glowStar));
  group.add(starLayer(34, 5.0, 0.9, THREE.AdditiveBlending, glowStar));

  // 9 animated twinkling stars — various sizes, never behind the moon. The first 3
  // glow plain white; the 6 extras take subtle near-white tints (white-purple /
  // lavender and ice blue) so they read as the same glow with a touch of colour.
  const TWINKLE_TINTS = ['#f2e9ff', '#e8daff', '#ddccff', '#e6f1ff', '#d3e8ff', '#ece7ff'];
  for (let i = 0; i < 9; i++) {
    const tw = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowStar, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
      color: i < 3 ? '#ffffff' : TWINKLE_TINTS[i - 3],
    }));
    tw.scale.setScalar([3,4,5][(Math.random() * 3) | 0]);  // 33% each size
    tw.renderOrder = 0;
    tw.userData.phase = Math.random() * Math.PI * 2;
    twinkles.push(tw);
    group.add(tw);
  }

  // billboard moon (always a circle) + soft halo
  const moonTex = canvasTexture(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2;
    const halo = ctx.createRadialGradient(cx, cy, s * 0.18, cx, cy, s * 0.5);
    halo.addColorStop(0, 'rgba(255,250,228,0.5)'); halo.addColorStop(1, 'rgba(255,250,228,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#fdf6e3'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, 7); ctx.fill();
    // soft grey craters/maria, clipped to the disc and feathered so there's no hard dot
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, 7); ctx.clip();
    const craters = [
      [-0.055, -0.05, 0.075], [0.07, -0.02, 0.05], [-0.02, 0.075, 0.06],
      [0.06, 0.06, 0.04], [-0.09, 0.02, 0.035], [0.02, -0.085, 0.03], [0.10, 0.0, 0.028],
    ];
    for (const [ox, oy, rr] of craters) {
      const mx = cx + ox * s, my = cy + oy * s, cr = rr * s;
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, cr);
      g.addColorStop(0, 'rgba(150,146,158,0.30)');
      g.addColorStop(0.65, 'rgba(150,146,158,0.13)');
      g.addColorStop(1, 'rgba(150,146,158,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, cr, 0, 7); ctx.fill();
    }
    ctx.restore();
  });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true }));
  moon.scale.setScalar(58);
  moon.position.copy(moonDir).multiplyScalar(R - 20);
  moon.renderOrder = 1;   // on top of everything
  group.add(moon);
  moonSprite = moon;

  return group;
}
const twinkles = [];
let moonSprite = null;          // the billboard moon, repositioned by setMoonSide
const sky = buildNightSky();
scene.add(sky);
const SKY_R = 320;
// mirror the moon (and therefore its light + the shadows) to the OTHER side. Boss
// levels flip it so they read distinctly; everything that casts/draws by the moon
// follows `moonDir`, so light, sprite and shadows stay in agreement.
function setMoonSide(flip) {
  // mirror across the run axis (negate x only): the moon stays ahead in the sky where
  // you can see it as you run, just swapped to the opposite (left) side.
  if (flip) moonDir.set(-MOON_DIR.x, MOON_DIR.y, MOON_DIR.z).normalize();
  else moonDir.copy(MOON_DIR);
  if (moonSprite) {
    const r = moonSprite.position.length() || SKY_R;
    moonSprite.position.copy(moonDir).multiplyScalar(r);
  }
}
// MOON_DIR is declared up by the moonlight so the light and the sky agree
function randomizeTwinkles() {
  const RAD = SKY_R - 14;     // FIXED distance — comfortably inside the camera far plane (400)
  for (const tw of twinkles) {
    let x, y, z, d;
    do {
      x = Math.random() * 2 - 1; y = Math.random(); z = Math.random() * 2 - 1;
      d = x * x + y * y + z * z;
    } while (d > 1 || d < 0.05);
    const dir = new THREE.Vector3(x, y, z).normalize();
    // retry if within ~25° of the moon
    while (dir.dot(moonDir) > 0.90) {
      do { x = Math.random() * 2 - 1; y = Math.random(); z = Math.random() * 2 - 1; d = x * x + y * y + z * z; }
      while (d > 1 || d < 0.05);
      dir.set(x, y, z).normalize();
    }
    // place from the NORMALISED direction at a fixed radius. The old code scaled by
    // k=(SKY_R-14)/√d using the un-normalised length, so a near-zenith pick (tiny √d)
    // ballooned out past the far plane and the star vanished when you looked straight up.
    tw.position.set(dir.x * RAD, Math.abs(dir.y) * RAD * 0.96, dir.z * RAD);
    tw.userData.phase = Math.random() * Math.PI * 2;
  }
}
randomizeTwinkles();

function resizeRenderer() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resizeRenderer);
// iOS/iPadOS reports stale innerWidth/innerHeight mid-rotation, so the canvas keeps
// the old size → letterboxed black bar / the page looks shoved to one side. Re-apply
// the true size a few frames after the orientation settles, and track the visual
// viewport (address bar show/hide, split view) when it's available.
window.addEventListener('orientationchange', () => {
  resizeRenderer();
  setTimeout(resizeRenderer, 150);
  setTimeout(resizeRenderer, 400);
});
if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeRenderer);

/* ============================================================== assets */

const texLoader = new THREE.TextureLoader();
function loadTex(url) {
  return new Promise((res, rej) => texLoader.load(url, t => {
    t.colorSpace = THREE.SRGBColorSpace; res(t);
  }, undefined, rej));
}
// pull just the bright glint out of a peanut frame as white-on-transparent — the moving
// "sparkle" we overlay on the default peanut (the gold/diamond shine, which never clips)
function extractSparkle(tex) {
  const img = tex.image, w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h), px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const mn = Math.min(px[i], px[i + 1], px[i + 2]);
    const a = (px[i + 3] < 8 || mn < 175) ? 0 : Math.min(255, (mn - 175) * 4);  // only the bright shine
    px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = a;
  }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// composite one ammo frame: the DEFAULT peanut, tinted to `tint`, with the white sparkle added
function compositeAmmoFrame(peanutImg, tint, sparkleImg) {
  const w = peanutImg.width, h = peanutImg.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(peanutImg, 0, 0, w, h);                         // default peanut shape
  ctx.globalCompositeOperation = 'source-atop';                 // tint only the peanut, keep its alpha + shading
  ctx.globalAlpha = 0.6; ctx.fillStyle = '#' + tint.getHexString(); ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';                     // add the glint on top (stays bright)
  ctx.drawImage(sparkleImg, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// dominant (saturated, opaque) colour of a texture, normalised to full brightness — used to
// match an ammo tint to its static "K" emote's hue
function dominantColor(tex) {
  const img = tex.image, w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const R = px[i], G = px[i + 1], B = px[i + 2];
    if (Math.max(R, G, B) - Math.min(R, G, B) < 38) continue;   // skip the white glare / greys
    r += R; g += G; b += B; n++;
  }
  if (!n) return new THREE.Color(1, 1, 1);
  const col = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
  const mx = Math.max(col.r, col.g, col.b) || 1;
  return col.multiplyScalar(1 / mx);   // full-brightness hue for a clean multiply
}

let peanutTex = null;
let faceParts = null;       // real photo cut-outs pasted on the head: {eyeL,eyeR,smile,hat}
let burgerFrames = [];
let goldTex = null, diamondTex = null;     // first-frame fallbacks
let goldFrames = [], diamondFrames = [];   // animated healing pickups
let ammoSets = null;                        // { '10k':[frames], '50k':…, '100k':… } tinted ammo
let ammoFrames = null;                      // active ammo frame set (null ⇒ default peanutTex)

async function loadAssets() {
  peanutTex = await loadTex('assets/sprites/emotes/Peanut.png');
  faceParts = {
    eyeL:  await loadTex('assets/left.png'),
    eyeR:  await loadTex('assets/right.png'),
    smile: await loadTex('assets/smile.png'),
  };
  const fids = ['000', '004', '008', '012', '016', '020', '024', '028'];
  goldFrames = await Promise.all(fids.map(id => loadTex(`assets/sprites/frames/GoldenPeanut/frame_${id}.png`)));
  diamondFrames = await Promise.all(fids.map(id => loadTex(`assets/sprites/frames/DiamondPeanut/frame_${id}.png`)));
  goldTex = goldFrames[0]; diamondTex = diamondFrames[0];

  // animated AMMO sets (debug cheats): the three K-emote stills are used ONLY as a colour
  // reference — `dominantColor` pulls each one's hue, then every gold-peanut frame is recoloured
  // to it (default peanut + that frame's moving shine via compositeAmmoFrame). No GIF/frame
  // extraction: the animation comes for free from the gold shine.
  const ammoStill = dir => loadTex(`assets/sprites/frames/${dir}/frame_000.png`);
  const buildAmmo = tint => goldFrames.map(fr => compositeAmmoFrame(peanutTex.image, tint, extractSparkle(fr).image));
  const [k10, k50, k100] = await Promise.all([ammoStill('10KPeanut'), ammoStill('50KPeanut'), ammoStill('100KPeanut')]);
  ammoSets = {
    '10k':  buildAmmo(dominantColor(k10)),
    '50k':  buildAmmo(dominantColor(k50)),
    '100k': buildAmmo(dominantColor(k100)),
  };
  const ids = [];
  for (let i = 0; i <= 110; i += 10) ids.push(String(i).padStart(3, '0'));
  burgerFrames = await Promise.all(ids.map(id =>
    loadTex(`assets/sprites/frames/BungusMac/frame_${id}.png`)));
}

/* ============================================================== player */

const PLAYER = {
  pos: new THREE.Vector3(0, 0, 0),   // feet position
  vel: new THREE.Vector3(),          // y only used for gravity; xz is impulse/knockback
  move: new THREE.Vector3(),         // smoothed horizontal locomotion
  yaw: 0, pitch: 0,
  radius: 0.38,
  height: 1.7,
  curHeight: 1.7,
  onGround: true,
  sprint: 115,
  sliding: false, slideT: 0, slideDir: new THREE.Vector3(), slideCD: 0,
  hp: 3, inv: 0,
  sprinting: false,
  aiming: false,
  camTilt: 0,
  camBlend: 0,        // 0 = third person, 1 = first person (smoothed)
  viewHeight: 1.7,    // smoothed eye height so crouching/sliding eases
  greaseMax: 115,     // sprint capacity; grows +15 per boss felled, cap 250 (max-grease mode)
  crouching: false,
  _wasCrouching: false,
  danceCount: 0,      // teabag crouches landed on the current spot (4 → bonus health)
  danceSpot: null,    // the dance spot being teabagged
  calmT: 0,
  rechargeMult: 1,
  fireCD: 0,
  bobT: 0,
};

const WALK = 7.0, SPRINT = 13.5, JUMP_V = 8.6, GRAV = -23;
const SLIDE_TIME = 0.85, SLIDE_SPEED = 16.5, SLIDE_HEIGHT = 0.7;
const JUMP_COST = 4.5;
const CROUCH_SPEED = WALK * 0.67, CROUCH_HEIGHT = 1.05, CROUCH_TAP = 0.16;
const RECHARGE_WALK = 1.5, RECHARGE_CALM = 3, RECHARGE_RAMP = 1.5;
const PAN_DUR = 2.6;     // length of the 360 intro pan before control is handed over
const MAX_HP = 10;       // peanuts stack to 10 via pickups; 10 = gold-max

// TheBurntPeanut: the plain peanut shell with our real photo cut-outs pasted on the
// split into two billboard sprites: bare peanut shell (always visible) +
// face-only overlay (eyes + smile, fades when camera is behind the character)
function buildPeanutBodyTex() {
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  if (peanutTex && peanutTex.image) ctx.drawImage(peanutTex.image, 0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildPeanutFaceOverlay() {
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  function part(tex, cx, cy, w, srcFrac = 1) {
    const img = tex && tex.image; if (!img) return;
    const sw = img.width, sh = img.height * srcFrac;
    const h = w * (sh / sw);
    ctx.drawImage(img, 0, 0, sw, sh, cx - w / 2, cy - h / 2, w, h);
  }
  part(faceParts && faceParts.eyeL,  s * 0.405, s * 0.31,  s * 0.115);
  part(faceParts && faceParts.eyeR,  s * 0.555, s * 0.31,  s * 0.115);
  part(faceParts && faceParts.smile, s * 0.48,  s * 0.41,  s * 0.16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// player visuals: single billboard sprite (body always visible, face composited at faceVis opacity)
const playerGroup = new THREE.Group();
let playerSprite = null;
let playerBlob = null;        // ground shadow disc (animated in 3rd person)
let playerBlobTop = null;     // the slice of that shadow sitting on an obstacle top
let playerBlobMid = null;     // the slice spilling onto the step below (roof → hood/bed)
let _bodyCanvas = null;       // cached peanut-shell canvas
let _faceCanvas = null;       // cached face-overlay canvas
let _compositeCanvas = null;  // live composite canvas
let _compositeTex = null;     // Three.js texture wrapping it
let _lastFaceVis = -1;        // only redraw when faceVis changes
let _lastWipeDir = 0;         // which edge the face wraps off toward

// ---- sliced blob shadows -------------------------------------------------
// A shadow disc that climbs onto obstacle tops: the part of the disc over the
// box renders ON the box (clipped to its footprint), the part hanging off drops
// to the floor — so as you walk on/off a crate the circle is sliced at the edge
// and the slice slides with you.
// SHARP shadow disc: a solid, opaque core out to ~88% radius with only a thin
// anti-aliased rim. The old wide soft falloff spread a big half-transparent disc
// that sort-fought the coplanar floor decals and read as a faint translucent BOX
// over the floor; a crisp disc has almost no faint outer region, so it sits cleanly
// under the sprite and the box artifact is gone.
const shadowTex = canvasTexture(128, (ctx, s) => {
  const c = s / 2, g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.86, 'rgba(255,255,255,1)');   // solid to ~86% → sharp edge
  g.addColorStop(1, 'rgba(255,255,255,0)');       // 1–2px feathered rim only
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});
function makeClipPlanes() {
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),    // x >= box.min.x
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),   // x <= box.max.x
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),    // z >= box.min.z
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),   // z <= box.max.z
  ];
}
// keep the region INSIDE a box footprint. Axis-aligned by default, but if the box
// carries an `obb` ({cx,cz,ry,hx,hz}) the planes rotate to the box's exact tilted
// rectangle — so the shadow on a parked-askew car hugs the rendered body, not a
// fat bounding box.
function setClipToBox(planes, b) {
  if (b.obb) {
    const { cx, cz, ry, hx, hz } = b.obb;
    const c = Math.cos(ry), s = Math.sin(ry);
    const n1x = c, n1z = -s, n2x = s, n2z = c;        // car local +x / +z in world
    const d1 = n1x * cx + n1z * cz, d2 = n2x * cx + n2z * cz;
    planes[0].normal.set(n1x, 0, n1z);  planes[0].constant = -d1 + hx;
    planes[1].normal.set(-n1x, 0, -n1z); planes[1].constant = d1 + hx;
    planes[2].normal.set(n2x, 0, n2z);  planes[2].constant = -d2 + hz;
    planes[3].normal.set(-n2x, 0, -n2z); planes[3].constant = d2 + hz;
  } else {
    planes[0].normal.set(1, 0, 0);  planes[0].constant = -b.min.x;
    planes[1].normal.set(-1, 0, 0); planes[1].constant = b.max.x;
    planes[2].normal.set(0, 0, 1);  planes[2].constant = -b.min.z;
    planes[3].normal.set(0, 0, -1); planes[3].constant = b.max.z;
  }
}
// inverse of makeClipPlanes: with clipIntersection (union) these KEEP the region
// OUTSIDE the box footprint — so the floor disc only shows the part hanging off
// the obstacle, while the part over the box is cut out (the top blob draws it).
function makeOuterClipPlanes() {
  return [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),   // keep x <= box.min.x
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),    // keep x >= box.max.x
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),   // keep z <= box.min.z
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),    // keep z >= box.max.z
  ];
}
function setOuterClipToBox(planes, b) {
  if (b.obb) {
    const { cx, cz, ry, hx, hz } = b.obb;
    const c = Math.cos(ry), s = Math.sin(ry);
    const n1x = c, n1z = -s, n2x = s, n2z = c;
    const d1 = n1x * cx + n1z * cz, d2 = n2x * cx + n2z * cz;
    planes[0].normal.set(-n1x, 0, -n1z); planes[0].constant = d1 - hx;
    planes[1].normal.set(n1x, 0, n1z);   planes[1].constant = -d1 - hx;
    planes[2].normal.set(-n2x, 0, -n2z); planes[2].constant = d2 - hz;
    planes[3].normal.set(n2x, 0, n2z);   planes[3].constant = -d2 - hz;
  } else {
    planes[0].normal.set(-1, 0, 0); planes[0].constant = b.min.x;
    planes[1].normal.set(1, 0, 0);  planes[1].constant = -b.max.x;
    planes[2].normal.set(0, 0, -1); planes[2].constant = b.min.z;
    planes[3].normal.set(0, 0, 1);  planes[3].constant = -b.max.z;
  }
}
// off any obstacle: keep the whole disc (union of half-spaces that covers all space)
function clearOuterClip(planes) {
  planes[0].constant = 1e9;
  planes[1].constant = 1e9;
  planes[2].constant = 1e9;
  planes[3].constant = 1e9;
}
function makeTopBlob(geo) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: '#000', map: shadowTex, transparent: true, opacity: 0.34, depthWrite: false, alphaTest: 0.05,
    clippingPlanes: makeClipPlanes(),
  }));
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  return m;
}
// highest obstacle top under (x,z) that an entity is STANDING ON / landing on — its
// feet must be near that top (within 0.45 above, to 0.15 below). The lower bound is
// what stops a high jump from slicing the shadow onto a box far below the feet and
// flashing a hard black square; way up in the air there's just the floor disc.
function shadowTopBox(x, z, feetY, r, boxes) {
  let best = null, bestY = 0.06;
  for (const b of boxes) {
    if (b.max.y > bestY && b.max.y <= feetY + 0.15 && b.max.y >= feetY - 0.45 &&
        x + r > b.min.x && x - r < b.max.x &&
        z + r > b.min.z && z - r < b.max.z) { best = b; bestY = b.max.y; }
  }
  return best;
}
// the step directly BELOW `topBox` under (x,z) — e.g. a car's hood/bed beneath its
// roof, or a shorter crate beneath the one you hopped onto — so the shadow can
// cascade top → middle → floor instead of dropping straight past it to the ground.
function shadowSecondBox(x, z, r, boxes, topBox) {
  let best = null, bestY = 0.06;
  for (const b of boxes) {
    if (b === topBox) continue;
    if (b.max.y > bestY && b.max.y < topBox.max.y - 0.02 &&
        x + r > b.min.x && x - r < b.max.x &&
        z + r > b.min.z && z - r < b.max.z) { best = b; bestY = b.max.y; }
  }
  return best;
}

function buildPlayer() {
  const bodyTex = buildPeanutBodyTex();
  const faceTex = buildPeanutFaceOverlay();
  _bodyCanvas = bodyTex.image;
  _faceCanvas = faceTex.image;

  _compositeCanvas = document.createElement('canvas');
  _compositeCanvas.width = _compositeCanvas.height = 512;
  _compositeTex = new THREE.CanvasTexture(_compositeCanvas);
  _compositeTex.colorSpace = THREE.SRGBColorSpace;

  playerSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: _compositeTex, transparent: true }));
  playerSprite.scale.set(1.3, 1.62, 1);
  playerSprite.position.y = 0.88;
  playerSprite.renderOrder = 2;          // body draws over its shadow disc
  playerGroup.add(playerSprite);
  updatePlayerFaceComposite(1);  // initial: face fully on
  const blobGeo = new THREE.CircleGeometry(0.42, 20);
  const blob = new THREE.Mesh(
    blobGeo,
    new THREE.MeshBasicMaterial({
      color: '#000', map: shadowTex, transparent: true, opacity: 0.35, depthWrite: false, alphaTest: 0.05,
      clippingPlanes: makeOuterClipPlanes(), clipIntersection: true,
    })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.035;
  // LAYER 1: shadows sit above the ground paint (layer 0) but below the world sprites
  // (layer 2), so a shadow never draws over another body and never sort-flips into a box.
  blob.renderOrder = 1;
  playerGroup.add(blob);
  playerBlob = blob;
  playerBlobTop = makeTopBlob(blobGeo);
  playerBlobTop.renderOrder = 1;
  playerGroup.add(playerBlobTop);
  playerBlobMid = makeTopBlob(blobGeo);
  playerBlobMid.renderOrder = 1;
  playerGroup.add(playerBlobMid);
  scene.add(playerGroup);
}

// redraw the composite sprite texture — body always full, face horizontally
// foreshortened by faceVis. Instead of fading out, the face squishes toward the
// edge it's rotating past (wipeDir) so it "runs out of space" and wipes off the
// side like a 2D sprite turning to face away — no opacity cross-fade.
function updatePlayerFaceComposite(faceVis, wipeDir = 1) {
  if (!_compositeCanvas || !_bodyCanvas || !_faceCanvas) return;
  // skip imperceptible changes (direction only matters once the face is narrowing)
  if (Math.abs(faceVis - _lastFaceVis) < 0.005 && wipeDir === _lastWipeDir) return;
  _lastFaceVis = faceVis;
  _lastWipeDir = wipeDir;
  const ctx = _compositeCanvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  ctx.drawImage(_bodyCanvas, 0, 0);
  if (faceVis >= 0.999) {
    ctx.drawImage(_faceCanvas, 0, 0);          // dead-ahead: crisp, undistorted
  } else if (faceVis > 0.005) {
    // collapse the painted face horizontally toward the rim it's turning past;
    // pivot sits just outside the eyes/smile so the features vanish at the edge.
    const pivot = wipeDir >= 0 ? 322 : 170;    // right edge / left edge of the face
    ctx.save();
    ctx.translate(pivot, 0);
    ctx.scale(faceVis, 1);
    ctx.translate(-pivot, 0);
    ctx.drawImage(_faceCanvas, 0, 0);
    ctx.restore();
  }
  _compositeTex.needsUpdate = true;
}

/* =============================================================== input */

const keys = {};
let mouseDX = 0, mouseDY = 0, lmb = false, rmb = false;
let cDownTime = 0, cSlideEdge = false;   // C tap-vs-hold tracking

// unlock/resume audio on the first real gesture of any kind (covers pad-via-Start
// flows where the audio context starts suspended)
for (const ev of ['pointerdown', 'mousedown', 'keydown', 'touchstart']) {
  window.addEventListener(ev, () => AudioFX.init(), { capture: true });
}
// every menu button (mouse, touch synth-click, or gamepad) sets off a random firework
/* ----- hidden '/' developer terminal ------------------------------------- */
let debugOpen = false, debugInput = '', debugEcho = '';
function _escDbg(s) { return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function renderDebug() {
  const el = document.getElementById('debugterm'); if (!el) return;
  el.innerHTML =
    '>:/Peanut Run Debug Menu\n' +
    '<span class="dim">load   ·   ammo10k  ammo50k  ammo100k   ·   level&lt;1-99&gt;</span>\n' +
    '>:/' + _escDbg(debugInput) + '<span class="cur">▋</span>' +
    (debugEcho ? '\n<span class="dim">' + _escDbg(debugEcho) + '</span>' : '');
}
function setDebugOpen(open) {
  debugOpen = open;
  document.body.classList.toggle('debug-on', open);
  if (open) { debugInput = ''; debugEcho = ''; renderDebug(); }
}
function execDebug(raw) {
  const cmd = raw.trim().replace(/^\//, '').toLowerCase();
  debugInput = '';
  if (!cmd) { renderDebug(); return; }
  if (cmd === 'load') {
    if (level) generateLevel(levelIndex, levelIndex);   // re-anchor the current level (no toast)
    debugEcho = 'Level Regenerated!';
  } else if (cmd === 'ammo10k' || cmd === 'ammo50k' || cmd === 'ammo100k') {
    const key = cmd.slice(4);                            // '10k' | '50k' | '100k' — re-typing toggles off
    if (ammoSets && ammoFrames !== ammoSets[key]) {
      ammoFrames = ammoSets[key];
      debugEcho = key === '10k' ? 'Cyan Peanut Shot!' : key === '50k' ? 'Purple Peanut Shot!' : 'Red Peanut Shot!';
    } else { ammoFrames = null; debugEcho = 'Default Peanut Shot!'; }
  } else {
    const m = cmd.match(/^level(\d+)$/);
    if (m && +m[1] >= 100) debugEcho = 'error: Run Your Peanut!';
    else if (m && +m[1] >= 1) { setDebugOpen(false); skipToLevel(+m[1]); return; }
    else debugEcho = 'unknown command';
  }
  renderDebug();
}

document.addEventListener('keydown', e => {
  // hidden debug terminal: '/' toggles it (in play or on the menu); while open it eats every key
  if (e.key === '/' && !debugOpen && (state === 'playing' || state === 'menu')) {
    e.preventDefault(); setDebugOpen(true); return;
  }
  if (debugOpen) {
    e.preventDefault();
    if (e.key === '/' || e.key === 'Escape') setDebugOpen(false);
    else if (e.key === 'Enter') execDebug(debugInput);
    else if (e.key === 'Backspace') { debugInput = debugInput.slice(0, -1); renderDebug(); }
    else if (e.key.length === 1) { debugInput += e.key; renderDebug(); }
    return;
  }
  keys[e.code] = true;
  if (e.code === 'KeyC') {
    cDownTime = performance.now() / 1000;   // track press time
    if (PLAYER.onGround && !PLAYER.sliding && PLAYER.move.length() > 0) {
      cSlideEdge = true;  // slide on press (not on release)
    }
  }
  if (e.code === 'Tab') {                              // Tab ONLY toggles pause (no focus cycling)
    e.preventDefault();
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (_) {}
    if (state === 'playing') { AudioFX.init(); AudioFX.fireBounce(400); try { document.exitPointerLock?.(); } catch (_) {} setState('paused'); }
    else if (state === 'paused') resumeFromPause();
  }
  if (e.code === 'KeyQ') {                              // Q = toggle camera first/third
    e.preventDefault();
    setCamView(saveData.cam === 'first' ? 'third' : 'first');
  }
  // menu: ◄/► or A/D step the PLAY-FROM-LEVEL selector
  if (state === 'menu') {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') setSelLevel(selLevel - 1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') setSelLevel(selLevel + 1);
  }
  // paused: WASD / arrow keys drive the highlight just like the controller d-pad —
  // ▲▼ move between rows, ◄► adjust the focused setting, Enter/Space confirm a button
  if (state === 'paused') {
    if      (e.code === 'ArrowUp'    || e.code === 'KeyW') { e.preventDefault(); pauseMoveFocus(-1); }
    else if (e.code === 'ArrowDown'  || e.code === 'KeyS') { e.preventDefault(); pauseMoveFocus(1); }
    else if (e.code === 'ArrowLeft'  || e.code === 'KeyA') { e.preventDefault(); if (pauseFocus <= 3) pauseAdjust(-1); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); if (pauseFocus <= 3) pauseAdjust(1); }
    else if (e.code === 'Enter'      || e.code === 'Space') { e.preventDefault(); pauseActivate(); }
  }
  if (e.code === 'Enter') {
    if (state === 'complete') nextLevel();
    else if (state === 'dead') retryLevel();
  }
});
document.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'KeyC') {
    PLAYER.crouching = false;
    cDownTime = 0;
  }
});
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('mousedown', e => {
  if (e.button === 0) lmb = true;
  if (e.button === 2) rmb = true;
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) lmb = false;
  if (e.button === 2) rmb = false;
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === canvas) {
    mouseDX += e.movementX; mouseDY += e.movementY;
  }
});

/* ============================ gamepad + glove cursor ============================ */

// clean, rounded white cartoon glove cursor → PNG data URL.
// Two frames: relaxed (open nubbed hand) and pressed (squished fist) so clicks animate.
function makeGloveCursor(mode) {  // 'open' | 'hover' | 'press'
  const w = 44, h = 50;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ink = '#241a10';
  const cap = (x, y, wd, ht, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, wd, ht, r); else ctx.rect(x, y, wd, ht);
    ctx.fill(); ctx.stroke();
  };
  ctx.strokeStyle = ink; ctx.lineWidth = 2.6;

  if (mode === 'press') {
    // curled into a soft rounded fist, lower, with little tap ticks
    ctx.fillStyle = '#ffffff';
    cap(14, 16, 7.5, 9, 3.6);
    cap(21, 15, 7.5, 9, 3.6);
    cap(28, 16, 7.5, 9, 3.6);
    cap(6, 21, 9, 9, 4.5);                  // thumb
    cap(11, 21, 26, 19, 10);                // palm
    ctx.fillStyle = '#e63b2e'; cap(13, 38, 22, 9, 4);   // cuff
    ctx.strokeStyle = ink; ctx.lineWidth = 2;           // impact ticks
    ctx.beginPath();
    ctx.moveTo(9, 11); ctx.lineTo(6, 7);
    ctx.moveTo(23, 8); ctx.lineTo(23, 3);
    ctx.moveTo(37, 11); ctx.lineTo(40, 7);
    ctx.stroke();
  } else {
    // relaxed: four rounded finger nubs + thumb, soft round palm, cuff
    const lift = mode === 'hover' ? -2 : 0;   // hover frame sits a touch higher
    ctx.fillStyle = '#ffffff';
    cap(13, 6 + lift, 7.5, 17, 3.6);
    cap(20, 4 + lift, 7.5, 19, 3.6);
    cap(27, 6 + lift, 7.5, 17, 3.6);
    cap(33, 9 + lift, 6.5, 14, 3.2);
    cap(5, 17 + lift, 9, 10, 4.5);          // thumb
    cap(10, 17 + lift, 28, 22, 11);         // palm
    ctx.fillStyle = '#e63b2e'; cap(12, 37 + lift, 24, 9, 4);   // cuff
    if (mode === 'hover') {                  // little sparkle to read as "clickable"
      ctx.strokeStyle = '#ffd75e'; ctx.lineWidth = 2;
      const sx = 39, sy = 6;
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy); ctx.lineTo(sx + 3, sy);
      ctx.moveTo(sx, sy - 3); ctx.lineTo(sx, sy + 3);
      ctx.stroke();
    }
  }
  return c.toDataURL('image/png');
}
const GLOVE_URL = makeGloveCursor('open');
const GLOVE_HOVER_URL = makeGloveCursor('hover');
const GLOVE_PRESS_URL = makeGloveCursor('press');
document.documentElement.style.setProperty('--glove', `url(${GLOVE_URL}) 22 3, pointer`);
document.documentElement.style.setProperty('--glove-hover', `url(${GLOVE_HOVER_URL}) 22 3, pointer`);
document.documentElement.style.setProperty('--glove-press', `url(${GLOVE_PRESS_URL}) 22 3, pointer`);
document.documentElement.style.setProperty('--glove-img', `url(${GLOVE_URL})`);
const gloveEl = document.getElementById('glove');
if (gloveEl) gloveEl.style.transition = 'opacity .3s ease';   // smooth idle fade-out/in

let inputMode = 'kbm';   // 'kbm' | 'gamepad' | 'touch'
let cursorX = window.innerWidth / 2, cursorY = window.innerHeight / 2;

// control scheme shown in the menus, adapting to the active input + controller type
const CONTROLS = [
  { act: 'Move / strafe', kbm: ['W', 'A', 'S', 'D', '↑↓←→'], pad: 'lstick', touch: 'L STICK' },
  { act: 'Aim / look', kbm: ['MOUSE'], pad: 'rstick', touch: 'HOLD R' },
  { act: 'Sprint', kbm: ['SHIFT'], pad: 'lb', touch: 'STICK RIM' },
  { act: 'Jump (sips grease)', kbm: ['SPACE'], pad: 'down', touch: 'JUMP' },
  { act: 'Slide → crouch (hold)', kbm: ['C'], pad: 'l3', touch: 'SLIDE' },
  { act: 'Blast peanuts', kbm: ['LMB'], pad: 'rt', touch: 'HOLD R' },
  { act: 'Pause', kbm: ['TAB / timer'], pad: 'start', touch: 'TAP TIMER' },
  { act: 'Camera view', kbm: ['Q'], pad: 'select', touch: '' },
];
function padGlyph(tok, type) {
  const m = {
    lstick: 'L STICK', rstick: 'R STICK', l3: 'L3',
    lb: type === 'ps' ? 'L1' : type === 'switch' ? 'L' : 'LB',
    rt: type === 'ps' ? 'R2' : type === 'switch' ? 'ZR' : 'RT',
    down: type === 'ps' ? '✕' : type === 'switch' ? 'B' : 'A',
    start: type === 'ps' ? 'OPTIONS' : type === 'switch' ? '+' : 'MENU',
    select: type === 'ps' ? 'SHARE' : type === 'switch' ? '-' : 'VIEW',
  };
  return m[tok] || tok;
}
function renderControls(el, mode, type) {
  if (!el) return;
  el.innerHTML = '';
  for (const c of CONTROLS) {
    const row = document.createElement('div'); row.className = 'mrow';
    const label = document.createElement('span'); label.textContent = c.act;
    const dots = document.createElement('span'); dots.className = 'dots';
    const keys = document.createElement('span'); keys.className = 'keys';
    if (mode === 'gamepad') {
      const cap = document.createElement('span');
      cap.className = 'keycap pad' + (c.pad === 'down' ? ' a' : '');
      cap.textContent = padGlyph(c.pad, type); keys.appendChild(cap);
    } else if (mode === 'touch') {
      const cap = document.createElement('span'); cap.className = 'keycap'; cap.textContent = c.touch; keys.appendChild(cap);
    } else {
      for (const k of c.kbm) { const cap = document.createElement('span'); cap.className = 'keycap'; cap.textContent = k; keys.appendChild(cap); }
    }
    row.append(label, dots, keys);
    el.appendChild(row);
  }
}
function refreshControlsUI() {
  const label = inputMode === 'gamepad'
    ? (gp.type === 'ps' ? 'PLAYSTATION' : gp.type === 'switch' ? 'SWITCH' : 'XBOX / GAMEPAD')
    : inputMode === 'touch' ? 'TOUCH' : 'KEYBOARD & MOUSE';
  const pd = document.getElementById('menu-pad'); if (pd) pd.style.display = 'none';
  renderControls(document.getElementById('menu-kbm'), inputMode, gp.type);
  renderControls(document.getElementById('pause-controls'), inputMode, gp.type);
  for (const id of ['inputtag', 'pause-inputtag']) { const t = document.getElementById(id); if (t) t.textContent = label; }
}
function setInputMode(m) {
  if (inputMode === m) return;
  inputMode = m;
  document.body.classList.toggle('pad', m === 'gamepad');
  document.body.classList.toggle('touch', m === 'touch');
  refreshControlsUI();
  if (m !== 'kbm') { cursorX = window.innerWidth / 2; cursorY = window.innerHeight / 2; }
}
window.addEventListener('mousemove', e => { setInputMode('kbm'); cursorX = e.clientX; cursorY = e.clientY; _gloveWake = true; });
window.addEventListener('keydown', () => setInputMode('kbm'));
let gpHoverEl = null;       // element the (gamepad) glove is currently hovering
let gloveIdleT = 0;         // seconds since the cursor last moved (fades the glove out)
let _gloveWake = false;     // a mouse move / swipe this frame — wake & reposition the glove

const MENU_STATES = ['menu', 'complete', 'dead', 'paused'];

// identify the controller family for the right button glyphs
function padType(id) {
  const s = (id || '').toLowerCase();
  if (/dualsense|dualshock|playstation|sony|054c|0ce6|05c4|09cc/.test(s)) return 'ps';
  if (/switch|joy-?con|nintendo|057e|2009|pro controller/.test(s)) return 'switch';
  return 'xbox';
}

// gamepad state, refreshed once per frame
const gp = {
  connected: false, type: 'xbox', lx: 0, ly: 0, rx: 0, ry: 0,
  lb: false, rt: false, l3: false, aHeld: false,
  jumpEdge: false, aEdge: false, bEdge: false, startEdge: false, decEdge: false, incEdge: false,
  upEdge: false, downEdge: false, selectEdge: false,
  _aPrev: false, _bPrev: false, _startPrev: false, _lPrev: false, _rPrev: false,
  _uPrev: false, _dPrev: false, _selPrev: false,
  _l3Prev: false, l3DownT: 0, l3TapEdge: false,
  _jumpBlock: false,   // swallow the jump that the A-press used to CLOSE the pause menu
};
function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let g = null;
  for (const p of pads) if (p && p.connected) { g = p; break; }
  gp.connected = !!g;
  gp.jumpEdge = gp.aEdge = gp.bEdge = gp.startEdge = gp.decEdge = gp.incEdge = false;
  if (!g) {
    gp.lx = gp.ly = gp.rx = gp.ry = 0; gp.lb = gp.rt = gp.l3 = gp.aHeld = false;
    gp._aPrev = gp._bPrev = gp._startPrev = gp._lPrev = gp._rPrev = gp._l3Prev = false;
    gp._uPrev = gp._dPrev = gp._selPrev = false;
    gp.upEdge = gp.downEdge = gp.selectEdge = false;
    gp.l3TapEdge = false; gp._jumpBlock = false; return;
  }
  const t = padType(g.id);
  if (t !== gp.type) { gp.type = t; if (inputMode === 'gamepad') refreshControlsUI(); }
  const dz = v => (Math.abs(v) < 0.18 ? 0 : v);
  gp.lx = dz(g.axes[0] || 0); gp.ly = dz(g.axes[1] || 0);
  gp.rx = dz(g.axes[2] || 0); gp.ry = dz(g.axes[3] || 0);
  const pressed = i => !!(g.buttons[i] && g.buttons[i].pressed);
  const val = i => (g.buttons[i] ? g.buttons[i].value : 0);
  gp.lb = pressed(4);                         // LB / L1  → sprint
  gp.rt = val(7) > 0.35 || pressed(7);        // RT / R2  → blast
  const l3Now = pressed(10);                  // L3 (stick click) → slide/crouch
  if (l3Now && !gp._l3Prev) {
    gp.l3DownT = performance.now() / 1000;
    gp.l3TapEdge = true;                         // slide on press
  }
  gp.l3 = l3Now; gp._l3Prev = l3Now;
  gp.aHeld = pressed(0);                       // A held (for cursor press art)
  gp.aEdge = gp.jumpEdge = gp.aHeld && !gp._aPrev; gp._aPrev = gp.aHeld;
  const bNow = pressed(1);                      // B → back / close pause
  gp.bEdge = bNow && !gp._bPrev; gp._bPrev = bNow;
  // swallow the very jump that the A-press used to dismiss the pause menu (the glove
  // click resumes play this frame; without this the same A also fires a jump)
  if (gp._jumpBlock) { gp.jumpEdge = false; if (!gp.aHeld) gp._jumpBlock = false; }
  const sNow = pressed(9);                     // Start → pause / confirm
  gp.startEdge = sNow && !gp._startPrev; gp._startPrev = sNow;
  // d-pad ◄/► (14/15) or bumpers (4/5) adjust sliders in menus
  const lNow = pressed(14) || pressed(4), rNow = pressed(15) || pressed(5);
  gp.decEdge = lNow && !gp._lPrev; gp._lPrev = lNow;
  gp.incEdge = rNow && !gp._rPrev; gp._rPrev = rNow;
  // d-pad ▲/▼ (12/13) navigate vertically in menus
  const uNow = pressed(12), dNow = pressed(13);
  gp.upEdge = uNow && !gp._uPrev; gp._uPrev = uNow;
  gp.downEdge = dNow && !gp._dPrev; gp._dPrev = dNow;
  const selNow = pressed(8);                     // Select/View → toggle camera
  gp.selectEdge = selNow && !gp._selPrev; gp._selPrev = selNow;
  // only switch to gamepad mode on a clear button press or real stick push (0.4),
  // so a resting/drifting controller doesn't steal the active input from kbm
  if (gp.aHeld || gp.lb || gp.rt || gp.l3 || pressed(1) || sNow || rNow || lNow || selNow ||
      Math.abs(gp.lx) + Math.abs(gp.ly) + Math.abs(gp.rx) + Math.abs(gp.ry) > 0.4) {
    setInputMode('gamepad');
  }
}

// controller rumble — ONLY when the controller is the active input (so a pad left
// on the desk during keyboard/mouse play doesn't buzz and wander off)
function rumble(strong = 0.6, weak = 0.4, duration = 200) {
  if (!gp.connected || inputMode !== 'gamepad') return;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    const act = p && (p.vibrationActuator || (p.hapticActuators && p.hapticActuators[0]));
    if (act && act.playEffect) {
      try { act.playEffect('dual-rumble', { duration, strongMagnitude: strong, weakMagnitude: weak, startDelay: 0 }); }
      catch (e) { /* unsupported effect type */ }
      return;
    }
  }
}

/* ============================ touch controls ============================ */
const TOUCH_CAPABLE = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
// Touch-first devices (phones/tablets) start in touch mode so menus are sized for
// touch from the very first frame — otherwise the desktop-size title/menu shows huge
// until the first tap flips on `body.touch`. A mousemove/keydown switches back to kbm.
if (TOUCH_CAPABLE && window.matchMedia && matchMedia('(pointer: coarse)').matches) {
  inputMode = 'touch';
  document.body.classList.add('touch');
}
const touch = { mx: 0, my: 0, lookDX: 0, lookDY: 0, shoot: false, jumpEdge: false, slideEdge: false, crouchHold: false, sprint: false };
let touchMenuActive = false;
let touchAimHeld = false;          // right-side hold = aim + fire (crosshair shows while held)
const touchRoot = document.getElementById('touch');
const tMoveEl = document.getElementById('tmove');
const tJumpEl = document.getElementById('tjump'), tSlideEl = document.getElementById('tslide');
let moveId = null, moveCX = 0, moveCY = 0, moveSprint = false, lastMoveEnd = -999;
let aimId = null, aimLX = 0, aimLY = 0;
let menuTapId = null, menuTapX = 0, menuTapY = 0, menuTapMoved = false;   // menu tap → click on release
const joyRadius = () => (window.matchMedia('(orientation:portrait)').matches ? 48 : 62);
const isMenuTouch = () => MENU_STATES.includes(state);
function setNub(joy, dx, dy) {
  const nub = joy.firstElementChild;
  nub.style.left = `calc(50% + ${dx}px)`; nub.style.top = `calc(50% + ${dy}px)`;
}
// fixed-base joystick: map the finger to a direction from where the touch began
function updateMove(cx, cy) {
  let dx = cx - moveCX, dy = cy - moveCY;
  const R = joyRadius(), len = Math.hypot(dx, dy);
  if (len > R) { dx = dx / len * R; dy = dy / len * R; }
  touch.mx = dx / R; touch.my = dy / R; setNub(tMoveEl, dx, dy);
  // sprint = double-tap-and-hold pushed off-centre, or just jam the stick to the rim
  touch.sprint = (moveSprint && len > R * 0.4) || len > R * 0.95;
}
// resting (home) centre of the joystick in client px — must match the #tmove CSS anchor
function joyHome() {
  const portrait = window.matchMedia('(orientation:portrait)').matches;
  const sz = portrait ? 112 : 140, ml = portrait ? 80 : 40, mb = portrait ? 150 : 96;
  return { x: ml + sz / 2, y: window.innerHeight - mb - sz / 2 };
}
function onTouchStart(e) {
  setInputMode('touch');
  for (const t of e.changedTouches) {
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (el && el.closest && el.closest('.tbtn, #timer')) continue;   // buttons/timer handle themselves
    if (isMenuTouch()) {                                             // menu: drive glove, click on release
      cursorX = t.clientX; cursorY = t.clientY; touchMenuActive = true;
      menuTapId = t.identifier; menuTapX = t.clientX; menuTapY = t.clientY; menuTapMoved = false;
      continue;
    }
    const left = t.clientX < window.innerWidth * 0.5;
    if (left && moveId === null) {
      moveId = t.identifier;
      moveCX = t.clientX; moveCY = t.clientY;                        // floating base = where you touched
      const home = joyHome();                                        // slide the visual base under the finger
      tMoveEl.style.transform = `translate(${t.clientX - home.x}px, ${t.clientY - home.y}px)`;
      tMoveEl.classList.add('grabbing');
      moveSprint = (performance.now() - lastMoveEnd) < 320;          // double-tap-and-hold = sprint
      updateMove(t.clientX, t.clientY);
    } else if (!left && aimId === null) {                            // tap/swipe right = aim + fire (crosshair only)
      aimId = t.identifier; aimLX = t.clientX; aimLY = t.clientY;
      touchAimHeld = true; touch.shoot = true;
    }
  }
  if (e.cancelable) e.preventDefault();
}
function onTouchMove(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === moveId) {
      updateMove(t.clientX, t.clientY);
    } else if (t.identifier === aimId) {
      touch.lookDX += (t.clientX - aimLX); touch.lookDY += (t.clientY - aimLY);
      aimLX = t.clientX; aimLY = t.clientY;
    } else if (t.identifier === menuTapId) {
      cursorX = t.clientX; cursorY = t.clientY;
      if (Math.hypot(t.clientX - menuTapX, t.clientY - menuTapY) > 16) menuTapMoved = true;
    } else if (isMenuTouch()) { cursorX = t.clientX; cursorY = t.clientY; }
  }
  if (e.cancelable) e.preventDefault();
}
function onTouchEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === moveId) {
      lastMoveEnd = performance.now();
      moveId = null; touch.mx = 0; touch.my = 0; touch.sprint = false; moveSprint = false;
      setNub(tMoveEl, 0, 0);
      tMoveEl.classList.remove('grabbing');
      tMoveEl.style.transform = '';                                  // slide home + fade via CSS transition
    } else if (t.identifier === aimId) {
      aimId = null; touchAimHeld = false; touch.shoot = false;
    } else if (t.identifier === menuTapId) {
      // a clean tap on a menu control = click it (touch suppresses the native click)
      if (!menuTapMoved) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const btn = el && el.closest && el.closest('button, [role=button], .senspip, .segbtn');
        if (btn && !btn.closest('.selarrow')) { AudioFX.init(); btn.click(); }   // selarrows fire on pointerdown
      }
      menuTapId = null; touchMenuActive = false;
    }
  }
}
function bindHold(el, on, off) {
  el.addEventListener('touchstart', e => { e.preventDefault(); setInputMode('touch'); el.classList.add('held'); on(); }, { passive: false });
  el.addEventListener('touchend', e => { e.preventDefault(); el.classList.remove('held'); off && off(); }, { passive: false });
  el.addEventListener('touchcancel', () => { el.classList.remove('held'); off && off(); });
}
if (TOUCH_CAPABLE) {
  bindHold(tJumpEl, () => { touch.jumpEdge = true; }, () => {});
  bindHold(tSlideEl, () => { touch.slideEdge = true; touch.crouchHold = true; }, () => { touch.crouchHold = false; });
  window.addEventListener('touchstart', onTouchStart, { passive: false });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: false });
  window.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

// the glove is the cursor on ALL menus, for BOTH mouse and gamepad, so the
// breathing/press animation applies to both inputs
function updateMenuCursor(dt) {
  const onMenu = MENU_STATES.includes(state);
  gloveEl.style.display = onMenu ? 'block' : 'none';
  document.body.classList.toggle('glove-on', onMenu);
  if (!onMenu) {
    if (gpHoverEl) { gpHoverEl.classList.remove('gp-hover'); gpHoverEl = null; }
    return;
  }

  // d-pad / bumpers: 6 items (pause) — 0=LOOK SENS,1=SOUND FX,2=VIEW MODE,3=CAMERA,4=resume,5=quit
  if (state === 'paused') {
    if (gp.upEdge)   pauseMoveFocus(-1);
    if (gp.downEdge) pauseMoveFocus(1);
    if (pauseFocus <= 3) {
      if (gp.decEdge) pauseAdjust(-1);
      if (gp.incEdge) pauseAdjust(1);
    } else if (gp.aEdge) {
      pauseActivate();
    }
    if (gp.aEdge && pauseFocus >= 4) return;
    // highlight — remove all, then add exactly one
    const optLabels = document.querySelectorAll('#resume .optlabel');
    const viewBtns  = document.querySelectorAll('#viewseg .segbtn');
    const camBtns   = document.querySelectorAll('#camseg .segbtn');
    const resumeBtn = document.getElementById('resumebtn');
    const quitBtn   = document.getElementById('quitbtn');
    optLabels.forEach(l => l.classList.remove('focus'));
    viewBtns.forEach(b => b.classList.remove('gp-hover'));
    camBtns.forEach(b => b.classList.remove('gp-hover'));
    if (resumeBtn) resumeBtn.classList.remove('gp-hover');
    if (quitBtn)   quitBtn.classList.remove('gp-hover');
    if (pauseFocus <= 3) {
      if (optLabels[pauseFocus]) optLabels[pauseFocus].classList.add('focus');
      if (pauseFocus === 2) viewBtns.forEach(b => b.classList.add('gp-hover'));
      if (pauseFocus === 3) camBtns.forEach(b => b.classList.add('gp-hover'));
    } else if (pauseFocus === 4) {
      if (resumeBtn) resumeBtn.classList.add('gp-hover');
    } else {
      if (quitBtn) quitBtn.classList.add('gp-hover');
    }
  } else if (state === 'menu') {
    // d-pad / bumpers: hold to ramp the level selector (accelerating repeat like bindRepeat)
    const lNow = gp._lPrev, rNow = gp._rPrev;
    if (lNow || rNow) {
      const dir = lNow ? -1 : 1;
      if (menuHoldDir !== dir) {
        menuHoldDir = dir; menuHoldTime = 0; menuHoldNext = 0.3;
        setSelLevel(selLevel + dir);
      } else {
        menuHoldTime += dt;
        if (menuHoldTime >= menuHoldNext) {
          setSelLevel(selLevel + dir);
          menuHoldNext = Math.max(0.07, menuHoldNext * 0.78);
          menuHoldTime = 0;
        }
      }
    } else {
      menuHoldDir = 0;
    }
  }

  // position: stick drives it in gamepad mode; the mousemove handler sets it in kbm
  if (inputMode === 'gamepad') {
    const sp = 940;
    const mx = gp.lx || gp.rx, my = gp.ly || gp.ry;
    cursorX = clamp(cursorX + mx * sp * dt, 4, window.innerWidth - 4);
    cursorY = clamp(cursorY + my * sp * dt, 4, window.innerHeight - 4);
  }
  gloveEl.style.left = (cursorX - 22) + 'px';
  gloveEl.style.top = (cursorY - 3) + 'px';

  // glove fade: after 3s of no cursor input, hide the glove so a stale mouse/controller
  // cursor stops fighting the active one. ANY mouse move / stick push / swipe / press
  // wakes it (and it reappears wherever the active input now points), so the menu
  // highlights track whichever input you just touched.
  const stickMag = Math.abs(gp.lx) + Math.abs(gp.ly) + Math.abs(gp.rx) + Math.abs(gp.ry);
  const active = _gloveWake || stickMag > 0.05 || touchMenuActive || gp.aHeld || lmb ||
    gp.aEdge || gp.upEdge || gp.downEdge || gp.decEdge || gp.incEdge || gp.startEdge;
  _gloveWake = false;
  gloveIdleT = active ? 0 : gloveIdleT + dt;
  if (gloveIdleT > 3) {
    gloveEl.style.opacity = '0';
    if (gpHoverEl) { gpHoverEl.classList.remove('gp-hover'); gpHoverEl = null; }  // no stale lit button
    return;
  }
  gloveEl.style.opacity = '1';

  // hover frame + bob over clickable things; press frame while clicking
  const el = document.elementFromPoint(cursorX, cursorY);
  const overBtn = el && el.closest && el.closest('button, [role=button], .senspip, .selarrow');
  const pressing = inputMode === 'gamepad' ? gp.aHeld : inputMode === 'touch' ? touchMenuActive : lmb;
  if (pressing) { gloveEl.className = 'press'; gloveEl.style.backgroundImage = `url(${GLOVE_PRESS_URL})`; }
  else if (overBtn) { gloveEl.className = 'hover'; gloveEl.style.backgroundImage = `url(${GLOVE_HOVER_URL})`; }
  else { gloveEl.className = ''; gloveEl.style.backgroundImage = `url(${GLOVE_URL})`; }

  // mirror :hover onto the focused element so the BUTTON animates for gamepad/touch
  // (mouse already gets native :hover)
  const newHover = (inputMode !== 'kbm' && overBtn) ? overBtn : null;
  if (gpHoverEl !== newHover) {
    if (gpHoverEl) gpHoverEl.classList.remove('gp-hover');
    gpHoverEl = newHover;
    if (gpHoverEl) {
      gpHoverEl.classList.add('gp-hover');
      if (gpHoverEl.id === 'bestslot') { AudioFX.init(); AudioFX.heal(); }
    }
  }

  if (gp.aEdge || gp.startEdge) {
    if (gp.aEdge && overBtn) {
      // the PLAY-FROM-LEVEL arrows fire on pointerdown (bindRepeat), so .click() is a
      // no-op — step the selector directly when the glove is parked on one
      const arrow = overBtn.closest('.selarrow');
      if (arrow) { AudioFX.init(); setSelLevel(selLevel + (arrow.id === 'selup' ? 1 : -1)); return; }
      overBtn.click(); return;
    }
    if (state === 'menu') startRun(selLevel);
    else if (state === 'complete') nextLevel();
    else if (state === 'dead') retryLevel();
  }
}

const TEST = new URLSearchParams(location.search).has('test');
function lockPointer() {
  // never on touch (no pointer device) — and never let a missing/failed Pointer Lock
  // API throw: that would abort startRun/nextLevel/resumeFromPause and freeze the UI
  // (e.g. the "BACK TO THE GRIND" button doing nothing on iPad).
  if (TEST || inputMode === 'touch') return;
  try { const p = canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); }
  catch (_) { /* ignore */ }
}
canvas.addEventListener('click', () => {
  if (state === 'playing' && document.pointerLockElement !== canvas) lockPointer();
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && state === 'playing') {
    setState('paused');
  }
});

/* ======================================================= game state/ui */

let state = 'loading'; // loading | menu | playing | fireworks | complete | dead | paused
let levelIndex = 1;
let runLevels = 0;
let kills = 0;
let levelTime = 0;
let timerRunning = false;
let baseSeed = (Math.random() * 1e9) | 0;

let saveData = { total: 0, best: 1, sens: 5, view: 'fullscreen', vol: 5, cam: 'first' };
try { saveData = Object.assign({ total: 0, best: 1, sens: 5, view: 'fullscreen', vol: 5, cam: 'first' }, JSON.parse(localStorage.getItem('peanutRun'))); } catch (e) { /* fresh */ }
// touch devices default to third person (better for thumbs); honoured until the
// player explicitly picks a camera, after which saveData.camSet locks their choice
if (!saveData.camSet) saveData.cam = TOUCH_CAPABLE ? 'third' : 'first';
saveData.sens = Math.round(saveData.sens) || 5;
AudioFX._vol = saveData.vol / 10;
function persist() { try { localStorage.setItem('peanutRun', JSON.stringify(saveData)); } catch (e) { /* no storage */ } }

/* ---- view mode (windowed / fullscreen) + quit to menu ---- */
function applyFullscreen(on) {
  try {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  } catch (e) { /* fullscreen blocked */ }
}
function setViewMode(mode) { saveData.view = mode; persist(); applyFullscreen(mode === 'fullscreen'); updateViewSeg(); AudioFX.init(); AudioFX.fireBounce(mode === 'fullscreen' ? 560 : 360); }
function updateViewSeg() {
  const cur = document.fullscreenElement ? 'fullscreen' : 'windowed';
  document.querySelectorAll('#viewseg .segbtn').forEach(b => b.classList.toggle('on', b.dataset.view === cur));
}
document.querySelectorAll('#viewseg .segbtn').forEach(b => b.addEventListener('click', () => setViewMode(b.dataset.view)));
document.addEventListener('fullscreenchange', updateViewSeg);

/* ---- camera view (first / third person) — persists across sessions ---- */
function setCamView(mode) {
  saveData.cam = mode === 'third' ? 'third' : 'first';
  saveData.camSet = true;   // player made an explicit choice — stop auto-defaulting
  persist();
  updateCamSeg();
  AudioFX.init(); AudioFX.fireBounce(saveData.cam === 'third' ? 300 : 480);
}
function buildCamSeg() {
  updateCamSeg();
}
function updateCamSeg() {
  document.querySelectorAll('#camseg .segbtn').forEach(b => b.classList.toggle('on', b.dataset.cam === saveData.cam));
}
document.querySelectorAll('#camseg .segbtn').forEach(b => b.addEventListener('click', () => setCamView(b.dataset.cam)));
function quitToMenu() {
  AudioFX.init(); AudioFX.fireBounce();
  try { document.exitPointerLock?.(); } catch (e) { /* ignore */ }
  refreshMenuScores();
  setState('menu');
}

function resumeFromPause() {
  AudioFX.init(); AudioFX.kill();
  // clear held keys so Space/Shift/C — and any WASD/arrow used to drive the pause
  // menu — don't carry over into gameplay as ghost movement
  keys.Space = false; keys.ShiftLeft = false; keys.ShiftRight = false; keys.KeyC = false;
  keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false;
  keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
  // the A that confirmed "resume" must not also become a jump this frame / while held
  gp.jumpEdge = false; gp._jumpBlock = true;
  lockPointer();
  setState('playing');
}

// look-sensitivity multiplier: setting 5 = 1.0× (range 0.2×–2.0×)
function sensFactor() { return saveData.sens / 5; }

const ui = {};
['hud', 'menu', 'complete', 'dead', 'resume', 'levelnum', 'timer', 'timertext', 'alltimenum', 'hearts',
 'sprintfill', 'sprintwrap', 'sprintlabel', 'killnum', 'crosshair', 'damage', 'toast',
 'loadsplash', 'readybtn', 'mhealth',
 'bossbar', 'bossname', 'bosshp', 'c-level', 'hs-best', 'hs-total', 'hs-sel',
 'r-level', 'r-time', 'r-kills', 'r-run', 'r-alltime', 'volrow']
  .forEach(id => ui[id.replace(/-/g, '_')] = document.getElementById(id));

let selLevel = 1;       // "PLAY FROM LEVEL" pick (1..best)
let pauseFocus = 0;     // 0=LOOK SENS,1=SOUND FX,2=VIEW MODE,3=CAMERA,4=resume,5=quit
let menuHoldDir = 0, menuHoldTime = 0, menuHoldNext = 0.3;  // controller hold-to-ramp

// pause-menu navigation, shared by the controller d-pad AND the keyboard
// (WASD / arrow keys) so both drive the exact same 6-item highlight.
function pauseMoveFocus(delta) {
  pauseFocus = (pauseFocus + delta + 6) % 6;
  AudioFX.init(); AudioFX.fireBounce(320 + pauseFocus * 80);
}
function pauseAdjust(dir) {   // dir: -1 = left/dec, +1 = right/inc
  if      (pauseFocus === 0) setSens(stepVal(saveData.sens, dir));
  else if (pauseFocus === 1) setVol(stepVal(saveData.vol, dir));
  else if (pauseFocus === 2) setViewMode(dir < 0 ? 'windowed' : 'fullscreen');
  else if (pauseFocus === 3) setCamView(saveData.cam === 'first' ? 'third' : 'first');
}
function pauseActivate() {
  if      (pauseFocus === 4) document.getElementById('resumebtn').click();
  else if (pauseFocus === 5) document.getElementById('quitbtn').click();
}
function setSelLevel(v, silent) {
  const prev = selLevel;
  selLevel = clamp(v, 1, Math.max(1, saveData.best));
  if (ui.hs_sel) ui.hs_sel.textContent = selLevel;
  if (!silent && selLevel !== prev) { AudioFX.init(); AudioFX.menuTick(); }
}
function refreshMenuScores() {
  ui.hs_best.textContent = saveData.best;
  ui.hs_total.textContent = saveData.total;
  selLevel = clamp(selLevel || saveData.best, 1, Math.max(1, saveData.best));
  setSelLevel(selLevel, true); // silent — no tick on menu refresh
}

// desktop gets the full 1–10; touch devices get a shorter 2–10 set so the pips fit narrow screens
const SLIDER_VALS = TOUCH_CAPABLE ? [2, 4, 5, 6, 8, 10] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
function stepVal(cur, dir) { const i = SLIDER_VALS.indexOf(cur); return SLIDER_VALS[clamp(i + dir, 0, SLIDER_VALS.length - 1)]; }

// pause-menu look-sensitivity selector (1–10, default 5)
function buildSensRow() {
  const row = document.getElementById('sensrow');
  row.innerHTML = '';
  for (const v of SLIDER_VALS) {
    const pip = document.createElement('button');
    pip.className = 'senspip';
    pip.dataset.val = v;
    pip.textContent = v;
    pip.addEventListener('click', () => setSens(v));
    row.appendChild(pip);
  }
  highlightSens();
}
function highlightSens() {
  const row = document.getElementById('sensrow');
  if (!row) return;
  [...row.children].forEach(p => p.classList.toggle('on', +p.dataset.val === saveData.sens));
}
function setSens(v) {
  saveData.sens = v;
  persist();
  highlightSens();
  AudioFX.init(); AudioFX.fireBounce(420 + saveData.sens * 30);
}

// sound-fx volume slider (1–10, default 7)
function buildVolRow() {
  const row = document.getElementById('volrow');
  row.innerHTML = '';
  for (const v of SLIDER_VALS) {
    const pip = document.createElement('button');
    pip.className = 'senspip';
    pip.dataset.val = v;
    pip.textContent = v;
    pip.addEventListener('click', () => setVol(v));
    row.appendChild(pip);
  }
  highlightVol();
}
function highlightVol() {
  const row = document.getElementById('volrow');
  if (!row) return;
  [...row.children].forEach(p => p.classList.toggle('on', +p.dataset.val === saveData.vol));
}
function setVol(v) {
  saveData.vol = v;
  persist();
  highlightVol();
  AudioFX.init();
  AudioFX.setVolume(saveData.vol / 10);
  AudioFX.init(); AudioFX.fireBounce(200 + saveData.vol * 30);
}

// hearts are peanuts: base 3, can stack to MAX_HP via pickups, gold at max
function updateHearts() {
  const hp = clamp(PLAYER.hp, 0, MAX_HP);
  const goldmax = hp >= MAX_HP;
  // (re)build to the right count only when it changes
  if (ui.hearts.childElementCount !== hp) {
    ui.hearts.innerHTML = '';
    for (let i = 0; i < hp; i++) {
      const img = document.createElement('img');
      img.src = 'assets/sprites/emotes/Peanut.png';
      ui.hearts.appendChild(img);
    }
  }
  [...ui.hearts.children].forEach(img => img.classList.toggle('goldmax', goldmax));
  // mobile health: single peanut × N
  if (ui.mhealth) {
    ui.mhealth.querySelector('b').textContent = '×' + hp;
    ui.mhealth.classList.toggle('low', hp === 1);
    ui.mhealth.classList.toggle('goldmax', goldmax);
  }
}
function buildHearts() { updateHearts(); }

function toast(text, ms = 1300) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => ui.toast.classList.remove('show'), ms);
}

function setState(s) {
  state = s;
  ui.hud.classList.toggle('on', s === 'playing' || s === 'fireworks');
  ui.menu.classList.toggle('on', s === 'menu');
  ui.complete.classList.toggle('on', s === 'complete');
  ui.dead.classList.toggle('on', s === 'dead');
  ui.resume.classList.toggle('on', s === 'paused');
  if (s !== 'playing') ui.crosshair.classList.remove('on');   // updateCamera turns it on while playing
  if (s === 'dead' || s === 'complete' || s === 'menu') ui.bossbar.classList.remove('on');
  if (s === 'paused') {
    pauseFocus = 0;
    document.querySelectorAll('#resume .optlabel').forEach(l => l.classList.remove('focus'));
    document.querySelectorAll('#viewseg .segbtn, #camseg .segbtn').forEach(b => b.classList.remove('gp-hover'));
    const rb = document.getElementById('resumebtn');
    const qb = document.getElementById('quitbtn');
    if (rb) rb.classList.remove('gp-hover');
    if (qb) qb.classList.remove('gp-hover');
  }
  idleT = 0; idleBlend = 0; stareAmt = 0;                      // never carry the idle cam across states
}

document.getElementById('startbtn').addEventListener('click', () => {
  AudioFX.init(); AudioFX.fireBounce();
  if (saveData.view !== 'windowed') applyFullscreen(true);   // start in fullscreen (this click is the gesture)
  startRun(selLevel);
});
// BEST LEVEL chip = save slot: click (or Enter/Space) to jump straight to it
function jumpToBest() {
  AudioFX.init(); AudioFX.healBig();
  startRun(saveData.best);
}
document.getElementById('bestslot').addEventListener('click', jumpToBest);
document.getElementById('bestslot').addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); jumpToBest(); }
});
document.getElementById('bestslot').addEventListener('mouseenter', () => {
  AudioFX.init(); AudioFX.heal();
});
// PLAY FROM LEVEL selector — arrows pick a level (1..best), click the number to play it
function bindRepeat(el, fn) {
  let timer = null, delay = 300;
  const stop = () => { clearTimeout(timer); timer = null; delay = 300; };
  const step = () => { fn(); delay = Math.max(70, delay * 0.78); timer = setTimeout(step, delay); };
  el.addEventListener('pointerdown', e => { e.preventDefault(); fn(); delay = 300; timer = setTimeout(step, delay); });
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
}
bindRepeat(document.getElementById('seldown'), () => setSelLevel(selLevel - 1));
bindRepeat(document.getElementById('selup'), () => setSelLevel(selLevel + 1));
document.getElementById('hs-sel').addEventListener('click', () => { AudioFX.init(); AudioFX.fireBounce(); startRun(selLevel); });
document.getElementById('hs-sel').addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); AudioFX.init(); AudioFX.fireBounce(); startRun(selLevel); }
});
document.getElementById('nextbtn').addEventListener('click', () => nextLevel());
document.getElementById('retrybtn').addEventListener('click', () => retryLevel());
document.getElementById('resumebtn').addEventListener('click', resumeFromPause);
document.getElementById('quitbtn').addEventListener('click', quitToMenu);
document.getElementById('deadquitbtn').addEventListener('click', quitToMenu);
// the timer doubles as a pause button on every input (click / tap)
function pauseFromTimer() {
  if (state !== 'playing') return;
  try { document.exitPointerLock?.(); } catch (_) {}
  setState('paused');
}
ui.timer.addEventListener('click', pauseFromTimer);
ui.timer.addEventListener('touchstart', e => {
  e.preventDefault(); e.stopPropagation(); setInputMode('touch'); pauseFromTimer();
}, { passive: false });

/* ========================================================= level build */

const VEGGIES = [
  { emoji: '🥕', name: 'carrot', hp: 1, speed: 5.4, scale: 1.0, r: 0.45 },
  { emoji: '🍅', name: 'tomato', hp: 2, speed: 3.6, scale: 1.15, r: 0.5 },
  { emoji: '🌽', name: 'corn', hp: 2, speed: 4.3, scale: 1.1, r: 0.48 },
  { emoji: '🫑', name: 'pepper', hp: 2, speed: 4.9, scale: 1.05, r: 0.48 },
  { emoji: '🥦', name: 'broccoli', hp: 3, speed: 2.7, scale: 1.35, r: 0.58 },
  { emoji: 'turnip', name: 'turnip', hp: 2, speed: 4.2, scale: 1.15, r: 0.52, tex: turnipTex },
  { emoji: '🧅', name: 'onion', hp: 2, speed: 3.8, scale: 1.20, r: 0.55 },
  { emoji: '🍆', name: 'eggplant', hp: 1, speed: 3.5, scale: 1.2, r: 0.50 },
  { emoji: '🥬', name: 'kale',     hp: 1, speed: 3.0, scale: 1.1, r: 0.45 },
  { emoji: '🥒', name: 'cucumber', hp: 1, speed: 4.5, scale: 1.0, r: 0.42 },
];
// boss pools: each type has 1-2 names (50% chance each), may link to a small veggie variant
const BOSS_POOLS = [
  { type: 'cauliflower', emoji: '🥦', tex: cauliflowerTex, names: ['CAULIBLORB THE DENSE'], veggieIdx: 4 },
  { type: 'turnip',      emoji: 'turnip', tex: turnipTex,  names: ['TURNIPUS PRIME', 'ROOT OF ALL EVIL'], veggieIdx: 5 },
  { type: 'onion',       emoji: '🧅',     tex: null,       names: ['OBTUSE ONION', 'CRY BABY ONION'], veggieIdx: 6 },
  { type: 'pepper',      emoji: '🫑',     tex: null,       names: ['PEPPER PULVERIZER', 'CAPSICUM CRUSHER'], veggieIdx: 3 },
  { type: 'eggplant',    emoji: '🍆',     tex: null,       names: ['EGGPLANT OVERLORD'], veggieIdx: 7 },
  { type: 'kale',        emoji: '🥬',     tex: null,       names: ['KALE COMMANDER', 'LEAF ME ALONE'], veggieIdx: 8 },
  { type: 'cucumber',    emoji: '🥒',     tex: null,       names: ['THE GIGACUKE'], veggieIdx: 9 },
];
const veggieTextures = {};
const DECOR_EMOJI = ['🍔', '🍟', '🥤', '🌭', '🍕', '🧂'];
const decorTextures = {};

let level = null;       // { group, boxes, slowZones, enemies, burger, endZ, spawn }
let projectiles = [];
let camInit = false;    // snap the camera into place on the first frame of a level

const _WALL_DEFS = [['#b5371d', '#d62300'], ['#c97f2e', '#ffc62e'], ['#7d4423', '#ff9214']];
const wallTexes = _WALL_DEFS.map(([base, trim]) => {
  const wt = buildingTexture(base, trim);
  wt.narrow = buildingTextureNarrow(base, trim);   // paired one-window facade for tiny faces
  return wt;
});
const roofMat = new THREE.MeshLambertMaterial({ color: '#3a1c10' });

// box material array: facade texture tiled to the face's world length (one tile
// per ~4 units, so texels never stretch), flat roof on top
// box material array — each pair of side faces is sized to ITS OWN width so windows never
// squish: the ±x faces span d, the ±z faces span w. Faces narrower than ~one panel use the
// one-window facade. `opts.onTop` biases the depth so where two walls overlap only this
// one's texture shows (kills the z-fighting flicker between nested/overlapping walls).
function buildingMat(baseTex, w, d, opts = {}) {
  const xFace = wallSideMat(baseTex, d, opts);   // faces with ±x normal span the d (z) dimension
  const zFace = wallSideMat(baseTex, w, opts);   // faces with ±z normal span the w (x) dimension
  return [xFace, xFace, roofMat, roofMat, zFace, zFace];
}
function wallSideMat(baseTex, span, opts = {}) {
  const narrow = span < 2.2;                     // tiny face → exactly one window, no squish
  const src = narrow ? baseTex.narrow : baseTex;
  const rep = narrow ? 1 : Math.max(1, span / 4);
  const t = src.map.clone(); t.needsUpdate = true; t.repeat.set(rep, 1);
  const e = src.emissive.clone(); e.needsUpdate = true; e.repeat.set(rep, 1);
  e.generateMipmaps = false; e.minFilter = THREE.LinearFilter;   // crisp glow per window
  const m = new THREE.MeshLambertMaterial({
    map: t, emissive: new THREE.Color('#fff0c4'), emissiveMap: e, emissiveIntensity: 1.5,
  });
  if (opts.onTop) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  return m;
}

// checker floor tiled at one tile per 2 world units regardless of patch size
function floorMat(w, d) {
  const t = floorTex.clone();
  t.needsUpdate = true;
  t.repeat.set(w / 2, d / 2);
  return new THREE.MeshLambertMaterial({ map: t });
}

// asphalt parking-lot floor, one bay set per ~7 units
function lotMat(w, d) {
  const t = parkingTex.clone();
  t.needsUpdate = true;
  t.repeat.set(Math.max(1, Math.round(w / 7)), Math.max(1, Math.round(d / 7)));
  return new THREE.MeshLambertMaterial({ map: t });
}

const CAR_COLORS = ['#c0392b', '#2c6fb0', '#27ae60', '#e0902a', '#8e44ad', '#bdc3c7', '#16a085', '#34495e'];
const CAR_TYPES = ['coupe', 'sedan', 'suv', 'truck'];
const glassMat = new THREE.MeshLambertMaterial({ color: '#10161f' });
const windshieldMat = new THREE.MeshLambertMaterial({ color: '#06080d', emissive: '#0b0f17' });  // near-black glass
const tyreMat = new THREE.MeshLambertMaterial({ color: '#15151a' });
const lampMat = new THREE.MeshBasicMaterial({ color: '#fff2c0' });
const tailMat = new THREE.MeshBasicMaterial({ color: '#d62300' });
// bright silver for 'donk' spinner rims — slight self-glow so it glints at night
const chromeMat = new THREE.MeshLambertMaterial({ color: '#c9ccd6', emissive: '#3b3e48' });

// outward-pointing silver spoke "teepee" for a donk/spinner rim (built along +x,
// the wheel axis); the caller flips it for the left-hand wheels.
function buildDonkRim(wheelR) {
  const grp = new THREE.Group();
  const apex = wheelR * 0.9;        // how far the teepee juts out past the tyre
  const baseR = wheelR * 0.62;      // spread of the spokes at the tyre face
  const nSpokes = 7;
  for (let s = 0; s < nSpokes; s++) {
    const ang = (s / nSpokes) * Math.PI * 2;
    const by = Math.cos(ang) * baseR, bz = Math.sin(ang) * baseR;
    const len = Math.hypot(apex, by, bz);
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, len, 5), chromeMat);
    spoke.position.set(apex / 2, by / 2, bz / 2);
    spoke.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(apex, -by, -bz).normalize());
    grp.add(spoke);
  }
  // chrome hub at the tyre face + a pointed cap on the tip to finish the teepee
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.6, baseR * 0.72, 0.06, 12), chromeMat);
  hub.rotation.z = Math.PI / 2; grp.add(hub);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), chromeMat);
  cap.rotation.z = -Math.PI / 2; cap.position.x = apex; grp.add(cap);
  return grp;
}

// detailed parked car with four body types; rng picks the type
function buildCar(group, boxes, x, z, col, rng, yaw, opts = {}) {
  const type = CAR_TYPES[(rng() * CAR_TYPES.length) | 0];
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = (yaw != null) ? yaw : (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.08;
  const paint = new THREE.MeshLambertMaterial({ color: col });

  // dimensions per type (length along local z)
  let L = 3.6, W = 1.9, bodyH = 0.62, bodyY = 0.5, cabinL = 1.7, cabinH = 0.6, cabinZ = -0.1, cabinW = 1.62;
  let wheelR = 0.36, donk = false, bigTruck = false;
  if (type === 'coupe') {
    L = 3.4; W = 1.86; cabinL = 1.4; cabinZ = -0.25;
    if (rng() < 0.5) L *= 1.25;                 // half of coupes are 25% longer
  } else if (type === 'sedan') {
    L = 3.9; W = 1.92; cabinL = 1.9;
    // donks are gated by the spawn loop to one chosen level per 10-block and never two
    // on a level — opts.allowDonk is only set for the first eligible sedan that level
    if (opts.allowDonk) { donk = true; wheelR = 0.54; bodyY += 0.34; }   // raised for the big tyres
  }
  else if (type === 'suv') { L = 3.9; W = 2.0; bodyH = 0.8; bodyY = 0.58; cabinL = 2.1; cabinH = 0.78; cabinW = 1.78; }
  else if (type === 'truck') {
    L = 4.4; W = 2.0; bodyH = 0.7; bodyY = 0.62; cabinL = 1.35; cabinZ = -L / 2 + 1.1; cabinH = 0.8; cabinW = 1.84;
    // big rigs only spawn in the front bays and never two on a level (loop-gated)
    if (opts.allowBigTruck) {
      bigTruck = true;
      const k = 1.33;
      L *= k; W *= k; bodyH *= k; bodyY *= k; cabinL *= k; cabinZ *= k; cabinH *= k; cabinW *= k; wheelR *= k;
    }
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, L), paint);
  body.position.y = bodyY; body.castShadow = true; body.receiveShadow = true; g.add(body);

  // greenhouse: a solid roof/rear box whose FRONT is taken over by a sloped glass
  // windshield, so the front of the cabin angles down to the hood instead of a blunt box
  const bodyTop = bodyY + bodyH / 2;
  const cabFrontZ = cabinZ - cabinL / 2, cabBackZ = cabinZ + cabinL / 2;
  const wsRake = (type === 'sedan' || type === 'coupe') ? cabinL * 0.34 : cabinL * 0.2;  // front-slope depth
  const roofLen = Math.max(0.4, cabinL - wsRake);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH, roofLen), paint);
  cabin.position.set(0, bodyTop + cabinH / 2, cabBackZ - roofLen / 2); cabin.castShadow = true; g.add(cabin);

  if (type === 'truck') {                                  // open flatbed walls
    const bedH = 0.42;
    // run the bed walls from the cabin's back face to the tailgate's front face so
    // they MEET the cabin and never hang over the back of the truck
    const cabBackZ = cabinZ + cabinL / 2;
    const tailZ = L / 2 - 0.07, tailFrontZ = tailZ - 0.07;
    const bedLen = Math.max(0.2, tailFrontZ - cabBackZ);
    const bedCenterZ = (cabBackZ + tailFrontZ) / 2;
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.14, bedH, bedLen), paint);
      side.position.set(sx * (W / 2 - 0.07), bodyY + bodyH / 2 + bedH / 2, bedCenterZ); g.add(side);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(W, bedH, 0.14), paint);
    tail.position.set(0, bodyY + bodyH / 2 + bedH / 2, tailZ); g.add(tail);
  }

  // one continuous dark glasshouse, all the SAME glass: side windows along the roof, a
  // sloped front windshield from the hood cowl up to the roof front edge, and a flat rear
  const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(cabinW + 0.02, cabinH * 0.6, roofLen * 0.96), glassMat);
  sideGlass.position.set(0, bodyTop + cabinH * 0.56, cabBackZ - roofLen / 2); g.add(sideGlass);
  const wsLen = Math.hypot(cabinH, wsRake);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.97, wsLen, 0.05), glassMat);
  windshield.position.set(0, bodyTop + cabinH / 2, cabFrontZ + wsRake / 2);
  windshield.rotation.x = Math.atan2(wsRake, cabinH);   // top leans back to meet the roof front
  g.add(windshield);
  // A-pillar fillers: the sloped windshield leaves an open triangular wedge on each
  // side (hood cowl → roof front edge). Close it with a body-colour panel so the
  // glass is set into a full frame with side padding, not floating with gaps beside it.
  const pillarMat = new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const px = sx * cabinW / 2;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      px, bodyTop,          cabFrontZ,             // glass base, at the hood
      px, bodyTop,          cabFrontZ + wsRake,    // under the roof front edge
      px, bodyTop + cabinH, cabFrontZ + wsRake,    // roof front corner
    ]), 3));
    tri.setIndex([0, 1, 2]); tri.computeVertexNormals();
    const pillar = new THREE.Mesh(tri, pillarMat);
    pillar.castShadow = true; g.add(pillar);
  }
  const rearWin = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.97, cabinH * 0.8, 0.05), glassMat);
  rearWin.position.set(0, bodyTop + cabinH * 0.55, cabBackZ - 0.03); g.add(rearWin);

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.26, 12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wn = new THREE.Mesh(wheelGeo, tyreMat);
    wn.rotation.z = Math.PI / 2;
    wn.position.set(sx * (W / 2 - 0.02), wheelR, sz * (L / 2 - 0.85));
    wn.castShadow = true; g.add(wn);
    if (donk) {   // silver spinner teepee sticking out of each tyre's outer face
      const rim = buildDonkRim(wheelR);
      rim.position.set(sx * (W / 2 - 0.02 + 0.14), wheelR, sz * (L / 2 - 0.85));
      if (sx < 0) rim.rotation.y = Math.PI;
      g.add(rim);
    }
  }
  // head/tail lights
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.06), lampMat);
    hl.position.set(sx * (W / 2 - 0.35), bodyY, -L / 2 - 0.01); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.06), tailMat);
    tl.position.set(sx * (W / 2 - 0.35), bodyY, L / 2 + 0.01); g.add(tl);
  }

  group.add(g);

  // a purple donk leaks a purple oil puddle on the side nearest the spawn (toward +z,
  // since the lot sits at negative z and the player starts up near z=0)
  if (donk && col === '#8e44ad') {
    const pud = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 3.0),
      new THREE.MeshBasicMaterial({ map: purplePuddleTex, transparent: true, depthWrite: false, alphaTest: 0.04 }));
    pud.rotation.x = -Math.PI / 2;
    pud.position.set(x, 0.016, z + 1.3);
    group.add(pud);
  }

  // Collision AABBs hug the rendered car (tight tilted-extent bound, tiny margin).
  // Each box also carries an `obb` so the blob shadow clips to the EXACT rotated
  // footprint of the body/cabin — matching the render even on askew or scaled-up
  // (33% truck / 25% longer coupe) models.
  const ry = g.rotation.y, mx = 0.03;
  const ac = Math.abs(Math.cos(ry)), as = Math.abs(Math.sin(ry));
  const bodyHX = W / 2 * ac + L / 2 * as + mx;
  const bodyHZ = W / 2 * as + L / 2 * ac + mx;
  const bodyBox = new THREE.Box3(
    new THREE.Vector3(x - bodyHX, 0, z - bodyHZ),
    new THREE.Vector3(x + bodyHX, bodyTop, z + bodyHZ));
  bodyBox.obb = { cx: x, cz: z, ry, hx: W / 2, hz: L / 2 };
  boxes.push(bodyBox);
  const cabHX = cabinW / 2 * ac + cabinL / 2 * as + mx;
  const cabHZ = cabinW / 2 * as + cabinL / 2 * ac + mx;
  const ccx = x + cabinZ * Math.sin(ry), ccz = z + cabinZ * Math.cos(ry);
  const cabBox = new THREE.Box3(
    new THREE.Vector3(ccx - cabHX, 0, ccz - cabHZ),
    new THREE.Vector3(ccx + cabHX, bodyTop + cabinH, ccz + cabHZ));
  cabBox.obb = { cx: ccx, cz: ccz, ry, hx: cabinW / 2, hz: cabinL / 2 };
  boxes.push(cabBox);

  return { donk, bigTruck };
}

const crateMat = new THREE.MeshLambertMaterial({ map: crateTex });
const beefCrateMat = new THREE.MeshLambertMaterial({ map: beefCrateTex });
const nutsCrateMat = new THREE.MeshLambertMaterial({ map: nutsCrateTex });
// counter material tiled to width so the JUMP! obstacle reads as a real counter
function counterMatFor(w) {
  const t = counterTex.clone(); t.needsUpdate = true;
  t.repeat.set(Math.max(1, Math.round(w / 2.2)), 1);
  return new THREE.MeshLambertMaterial({ map: t });
}
function slideBarMatFor(w) {
  const t = slideBarTex.clone(); t.needsUpdate = true;
  t.repeat.set(Math.max(1, Math.round(w / 2.2)), 1);
  return new THREE.MeshLambertMaterial({ map: t });
}
const jumpSignTex = signTexture('JUMP!', '#ffc62e', '#8f1500');
const slideSignTex = signTexture('SLIDE!', '#d62300', '#fff3d6');

function addBox(group, boxes, x, y, z, w, h, d, mat, { collide = true, shadow = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  group.add(mesh);
  if (collide) boxes.push(new THREE.Box3(
    new THREE.Vector3(x - w / 2, y, z - d / 2),
    new THREE.Vector3(x + w / 2, y + h, z + d / 2)));
  return mesh;
}

// street lamppost: dark pole + glowing head + warm light (optional shadow)
function addLamppost(group, x, z, shadow) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 8),
    new THREE.MeshLambertMaterial({ color: '#15171d' }));
  pole.position.set(x, 2.5, z); pole.castShadow = true; group.add(pole);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10),
    new THREE.MeshBasicMaterial({ color: '#ffe6a8' }));
  head.position.set(x, 5.0, z); group.add(head);
  const lamp = new THREE.PointLight('#ffd9a0', 32, 22, 2);
  lamp.position.set(x, 4.9, z);
  if (shadow) {
    lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.camera.near = 0.5; lamp.shadow.camera.far = 24; lamp.shadow.bias = -0.004;
  }
  group.add(lamp);
}
// lamppost placement that avoids boxes/cars/obstacles
function placeLamppost(group, boxes, x, z, shadow) {
  const r = 0.35;
  for (let attempt = 0; attempt < 5; attempt++) {
    let ok = true;
    for (const b of boxes) {
      if (x + r > b.min.x && x - r < b.max.x &&
          z + r > b.min.z && z - r < b.max.z) { ok = false; break; }
    }
    if (ok) { addLamppost(group, x, z, shadow); return; }
    z += (attempt % 2 ? -1.5 : 1.5);
  }
}

// Across each block of 10 levels, 4 random levels get ONE pickup (1 diamond + 3 gold).
// Deterministic per block so a level always has the same drop.
function pickupForLevel(n) {
  const block = Math.floor((n - 1) / 10);
  const r = mulberry32(baseSeed + block * 104729 + 1234);
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  for (let i = pool.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const chosen = pool.slice(0, 4);
  const diamondOffset = chosen[(r() * 4) | 0];
  const myOffset = ((n - 1) % 10) + 1;
  if (!chosen.includes(myOffset)) return null;
  return myOffset === diamondOffset ? 'diamond' : 'gold';
}

// at most ONE donk per 10-level block: picks a single level in each block that may
// host a (single) donk, so two donks never share a level again
function donkForLevel(n) {
  const block = Math.floor((n - 1) / 10);
  const r = mulberry32(baseSeed + block * 70001 + 909);
  const chosen = 1 + ((r() * 10) | 0);
  return ((n - 1) % 10) + 1 === chosen;
}

// floating, always-camera-facing, animated healing pickup (Doom-style billboard)
function makePickup(group, x, y, z, type, opts = {}) {
  const gold = type === 'gold';
  const frames = gold ? goldFrames : diamondFrames;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: frames[0], transparent: true }));
  spr.scale.set(gold ? 1.25 : 1.45, gold ? 1.55 : 1.8, 1);
  spr.position.set(x, y, z);
  spr.renderOrder = 2;
  group.add(spr);
  // the glow is a real PointLight; ADDING one mid-run forces THREE to recompile every
  // material in the scene (a big hitch). Instant dance-bonus drops pass noGlow so they
  // don't add a light at all — that recompile was the teabag-dance lag.
  let glow = null;
  if (!opts.noGlow) {
    glow = new THREE.PointLight(gold ? '#ffd23b' : '#8fe6ff', gold ? 16 : 24, 10, 2);
    glow.position.set(x, y, z);
    group.add(glow);
  }
  return {
    spr, glow, frames, type, heal: gold ? 1 : 2,
    pos: new THREE.Vector3(x, y, z), baseY: y, bob: Math.random() * Math.PI * 2,
    frameT: Math.random(), frame: 0, alive: true,
  };
}

// "X marks the spot" paint mark for a boss-drop teabag/dance zone. Both diagonals are
// painted onto ONE canvas (a single union'd shape) so the crossing is a smooth blended
// mark — not two overlapping coplanar quads that z-fight and read like crossed tape.
const xMarkTex = canvasTexture(128, (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.17;
  const a = s * 0.22, b = s * 0.78;
  ctx.beginPath();
  ctx.moveTo(a, a); ctx.lineTo(b, b);                 // ╲
  ctx.moveTo(b, a); ctx.lineTo(a, b);                 // ╱  (same path → unioned, seamless cross)
  ctx.stroke();
});
function makeTeabagMark(group, x, z) {
  // ONE quad with the whole X. alphaTest drops the transparent padding so the decal
  // obstructs by its content, never as a blank box.
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.8),
    new THREE.MeshBasicMaterial({ map: xMarkTex, transparent: true, opacity: 0, depthWrite: false, alphaTest: 0.01 }));
  mesh.rotation.x = -Math.PI / 2;                     // lay the X flat on the street
  mesh.position.set(x, 0.05, z);
  mesh.scale.setScalar(0.4);                          // grows in via the paint-on anim
  mesh.renderOrder = 1;                               // layer 1: ground mark, with the shadow discs
  group.add(mesh);
  return { mesh, t: 0 };
}

function makeEnemy(group, def, x, z, rng) {
  let map = def.tex || def.texture;            // bosses may supply a custom texture
  if (!map) {
    if (!veggieTextures[def.emoji]) veggieTextures[def.emoji] = emojiTexture(def.emoji);
    map = veggieTextures[def.emoji];
  }
  // depthWrite:false so overlapping veggies don't punch transparent-quad holes in each
  // other — two depth-writing billboards mutually occlude through their see-through
  // corners, which made veggies vanish the instant they bumped/crowded together.
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
  spr.scale.set(def.scale * 1.3, def.scale * 1.3, 1);
  spr.position.set(x, def.scale * 0.7, z);
  group.add(spr);
  // blob shadow under the veggie (sprites can't cast real shadows) — plus a clipped
  // top layer so the shadow slices onto obstacles the enemy/boss climbs or hops onto
  const blobGeo = new THREE.CircleGeometry(def.r * 0.95, 18);
  const blob = new THREE.Mesh(
    blobGeo,
    new THREE.MeshBasicMaterial({
      color: '#000', map: shadowTex, transparent: true, opacity: 0.34, depthWrite: false, alphaTest: 0.05,
      clippingPlanes: makeOuterClipPlanes(), clipIntersection: true,
    }));
  blob.rotation.x = -Math.PI / 2; blob.position.set(x, 0.035, z);
  blob.renderOrder = 1;                 // layer 1: above ground paint, below world sprites
  group.add(blob);
  const blobTop = makeTopBlob(blobGeo);
  blobTop.renderOrder = 1;
  group.add(blobTop);
  spr.renderOrder = 2;                  // body draws over every shadow disc
  return {
    def, spr, blob, blobTop, hp: def.hp, maxHp: def.hp,
    pos: new THREE.Vector3(x, 0, z),
    home: new THREE.Vector3(x, 0, z),
    bob: rng() * Math.PI * 2,
    flash: 0, alive: true, isBoss: false, lungeCD: 0, lungeT: 0,
    wander: rng() < 0.2, wanderDir: 0, wanderTimer: 0,
  };
}

function makeBoss(group, n, x, z, rng, pool, name) {
  const hp = 55;                            // flat boss health — no scaling with level
  const def = {
    emoji: pool.emoji, name: name, hp, tex: pool.tex,
    speed: 3.0 + Math.min(2.2, n * 0.08), scale: 3.6, r: 1.7,
  };
  const e = makeEnemy(group, def, x, z, rng);
  e.isBoss = true;
  e.maxHp = hp;
  e.pool = pool;   // store reference for small-veggie spawning
  e.spr.scale.set(def.scale * 1.4, def.scale * 1.4, 1);
  e.lungeCD = 3.2;
  return e;
}

function generateLevel(n, seedOffset) {
  // tear down previous
  if (level) {
    scene.remove(level.group);
    level.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  projectiles.forEach(p => scene.remove(p.spr));
  projectiles = [];

  const rng = mulberry32(baseSeed + seedOffset * 7919);
  const group = new THREE.Group();
  const boxes = [];
  const slowZones = [];
  const enemies = [];
  const pickups = [];
  const danceSpots = [];  // teabag spots: 4 crouches in 4s here pops a bonus health peanut
  const obstacles = [];   // jump counters / slide bars the enraged boss can bust through

  const bossLevel = n % 5 === 0;
  const bossRush = n === 100;                               // L100 = boss-rush finale
  const doubleBoss = bossRush ? true : (bossLevel && n >= 25 && rng() < 0.5);   // L25+ → 50%; L100 → always
  const veggieMult = bossRush ? 3 : 1;                      // L100 throws 3× the veggies
  // grease capacity grows +15 per boss felled to reach this level, capped at +150 (max-grease mode)
  const bossesFelled = Math.min(10, Math.floor((n - 1) / 5));
  const greaseMax = 115 + bossesFelled * 15;
  const maxGrease = greaseMax >= 250;

  // longer levels at higher levels so the max-grease run speed has room to breathe
  const segCount = 5 + Math.min(15, Math.floor(n * 0.9));
  const lenBonus = Math.min(14, n * 0.28);
  const WALL_T = 1.4;
  let z = 0;
  let prevHalf = null;

  const segs = [];
  for (let i = 0; i < segCount; i++) {
    segs.push({ len: 16 + lenBonus + rng() * 10, half: 4.5 + rng() * 2.8 });
  }
  const endPlaza = { len: 28, half: 13 };
  segs.push(endPlaza);

  // ===== START: an enclosed fast-food PARKING LOT (no more void behind spawn) =====
  const h0 = segs[0].half;
  const LOT_LEN = 48;            // asphalt apron from z=-LOT_LEN up to z=0 (doubled for orbit clearance)
  const LOT_HALF = Math.max(h0 + 4, 10);
  const lotZ0 = -LOT_LEN;
  // asphalt floor (ends exactly at z=0 so it never overlaps the first segment floor)
  addBox(group, boxes, 0, -0.5, -LOT_LEN / 2, LOT_HALF * 2, 0.5, LOT_LEN, lotMat(LOT_HALF * 2, LOT_LEN), { shadow: false });
  // storefront buildings flanking the lot — same x as the first segment so the
  // wall is continuous from the lot straight into the corridor (windows included)
  for (const side of [-1, 1]) {
    let bz = lotZ0;
    while (bz < -0.5) {
      const blen = Math.min(5 + rng() * 7, -bz);
      const bh = 4.5 + rng() * 4.5;
      addBox(group, boxes, side * (LOT_HALF + WALL_T / 2), 0, bz + blen / 2, WALL_T, bh, blen,
        buildingMat(wallTexes[(rng() * 3) | 0], WALL_T, blen));
      if (rng() < 0.4) {
        const em = DECOR_EMOJI[(rng() * DECOR_EMOJI.length) | 0];
        if (!decorTextures[em]) decorTextures[em] = emojiTexture(em);
        const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: decorTextures[em], transparent: true }));
        sign.scale.set(2.6, 2.6, 1);
        sign.position.set(side * (LOT_HALF + WALL_T / 2), bh + 1.6, bz + blen / 2);
        group.add(sign);
      }
      bz += blen;
    }
  }
  // windowed back building closing off the lot
  addBox(group, boxes, 0, 0, lotZ0 - WALL_T / 2, LOT_HALF * 2 + WALL_T * 2, 8, WALL_T,
    buildingMat(wallTexes[1], LOT_HALF * 2 + WALL_T * 2, WALL_T));
  // painted bay slots along both sides of the back region, with cars in ~60% of them
  const bayGap = 6.5;
  const bayZ0 = lotZ0 + 3;
  const bayZ1 = -15;
  const baySlots = [];
  for (const side of [-1, 1]) {
    for (let bz = bayZ0; bz < bayZ1; bz += bayGap) {
      const bx = side * (LOT_HALF - 2.3);
      const outline = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 4.8),
        new THREE.MeshBasicMaterial({ color: '#d9b53a', side: THREE.DoubleSide, transparent: true, opacity: 0.65, depthWrite: false }));
      outline.rotation.x = -Math.PI / 2;
      outline.position.set(bx, 0.02, bz);
      group.add(outline);
      // front slots = the two bays nearest the player's spawn (largest z); big rigs only park here
      baySlots.push({ x: bx, z: bz, front: bz >= bayZ1 - bayGap * 2 });
    }
  }
  const usedSlots = new Set();
  const carN = Math.floor(baySlots.length * 0.6);
  const donkAllowedLevel = donkForLevel(n);   // ≤1 donk per 10-level block, never two on a level
  let donkUsed = false, bigTruckUsed = false;
  for (let c = 0; c < carN; c++) {
    const avail = baySlots.filter((_, i) => !usedSlots.has(i));
    if (!avail.length) break;
    const si = baySlots.indexOf(avail[(rng() * avail.length) | 0]);
    usedSlots.add(si);
    const s = baySlots[si];
    // headlights (car front, local -z) point toward the peanut on the RIGHT bays (+x → face +z,
    // toward the spawn) and the other way on the LEFT bays (-x → face -z)
    let carYaw = s.x > 0 ? Math.PI : 0;
    if (rng() < 0.2) carYaw += (rng() < 0.5 ? -1 : 1) * (0.10 + rng() * 0.08);   // small park jitter
    const info = buildCar(group, boxes, s.x, s.z, CAR_COLORS[(rng() * CAR_COLORS.length) | 0], rng, carYaw, {
      allowDonk: donkAllowedLevel && !donkUsed,
      allowBigTruck: s.front && !bigTruckUsed,
    });
    if (info.donk) donkUsed = true;
    if (info.bigTruck) bigTruckUsed = true;
  }
  // parking-lot lampposts — the mid pair casts shadows for the cars, the rest are
  // visual/fill only (point-light shadows are expensive)
  placeLamppost(group, boxes, -(LOT_HALF - 0.6), lotZ0 + LOT_LEN * 0.5, true);
  placeLamppost(group, boxes, (LOT_HALF - 0.6), lotZ0 + LOT_LEN * 0.5, true);
  placeLamppost(group, boxes, -(LOT_HALF - 0.6), lotZ0 + LOT_LEN * 0.85, false);
  placeLamppost(group, boxes, (LOT_HALF - 0.6), lotZ0 + LOT_LEN * 0.15, false);
  // a soft fill so the whole lot reads well-lit
  const lotFill = new THREE.PointLight('#ffe1b0', 18, LOT_LEN + 10, 1.6);
  lotFill.position.set(0, 6, lotZ0 + LOT_LEN * 0.5);
  group.add(lotFill);

  // ======================= TURNING PATH =======================
  // segments march from the lot exit (0,0) heading +z. From level 6 the path TURNS
  // (22.5/45/90°), more often the longer the level, but always steered back toward forward
  // so the run resolves FAR from the start instead of folding back on itself.
  prevHalf = LOT_HALF;
  let cx = 0, cz = 0, theta = 0;                          // path cursor (segment origin) + heading
  const toWorld = (lx, lz) => ({                          // segment-local (lateral, forward) → world
    x: cx + lz * Math.sin(theta) + lx * Math.cos(theta),
    z: cz + lz * Math.cos(theta) - lx * Math.sin(theta),
  });
  // a box rotated to the heading: yawed mesh + collision (AABB bound for the Y/broad phase,
  // plus a `cobb` so the angled XZ footprint resolves exactly). floors skip the cobb (their
  // top stays at y=0 under any yaw); walls are flagged so you never stand on / bonk them.
  function yawBox(lx, y, lz, w_, hh, d, mat, opt = {}) {
    const p = toWorld(lx, lz);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w_, hh, d), mat);
    mesh.position.set(p.x, y + hh / 2, p.z); mesh.rotation.y = theta;
    mesh.castShadow = opt.shadow !== false; mesh.receiveShadow = true; group.add(mesh);
    if (opt.collide !== false) {
      const ca = Math.abs(Math.cos(theta)), sa = Math.abs(Math.sin(theta));
      const hx = (w_ / 2) * ca + (d / 2) * sa, hz = (w_ / 2) * sa + (d / 2) * ca;
      const box = new THREE.Box3(new THREE.Vector3(p.x - hx, y, p.z - hz), new THREE.Vector3(p.x + hx, y + hh, p.z + hz));
      if (!opt.floor) { box.cobb = { cx: p.x, cz: p.z, ry: theta, hx: w_ / 2, hz: d / 2 }; if (opt.wall) box.wall = true; }
      boxes.push(box);
    }
    return mesh;
  }
  const lampAt = (lx, lz, cast) => { const p = toWorld(lx, lz); placeLamppost(group, boxes, p.x, p.z, cast); };

  // STRAIGHT path: the run goes straight from the lot exit to the burger (no turns,
  // no dead-end stubs). theta stays 0, so toWorld/yawBox are an identity and just keep
  // the existing OBB-collision codepath working for the axis-aligned boxes.

  // the one healing NUTS box lives in a chosen mid segment
  const pkType = pickupForLevel(n);
  const nutsSeg = pkType ? clamp(2 + ((rng() * Math.max(1, segs.length - 4)) | 0), 1, segs.length - 2) : -1;

  let endCx = 0, endCz = 0, endTheta = 0;                 // path frame at the start of the end plaza

  // ONE continuous tiled floor for the whole straight run (lot exit → past the burger),
  // sized to the widest stretch so the checker pattern is a single seamless piece —
  // no per-segment patches whose tiling reset at every seam. The corridor walls below
  // sit on it; floor that pokes behind the storefronts is hidden by them.
  const totalLen = segs.reduce((a, s) => a + s.len, 0);
  const maxHalf = Math.max(...segs.map(s => s.half));
  addBox(group, boxes, 0, -0.5, totalLen / 2, maxHalf * 2, 0.5, totalLen,
    floorMat(maxHalf * 2, totalLen), { shadow: false });

  const MIN_WALL = 4;   // narrowest storefront slab (≈ one window-panel) — no skinny slivers

  for (let i = 0; i < segs.length; i++) {
    const { len, half } = segs[i];
    const isEnd = i === segs.length - 1;
    if (isEnd) { endCx = cx; endCz = cz; endTheta = theta; }

    // streetlight every other segment
    if (i > 0 && i % 2 === 0) { const side = (i / 2) % 2 ? 1 : -1; lampAt(side * (half - 1.1), len * 0.2, false); }

    // storefront buildings down both sides. Slabs are MIN_WALL..2·MIN_WALL wide (never
    // skinny) and tile the whole side with no leftover gap, so the wall is unbroken and
    // sealed and the window texture never gets crushed.
    for (const side of [-1, 1]) {
      let bz = 0;
      while (bz < len - 0.01) {
        const remaining = len - bz;
        const blen = remaining < 2 * MIN_WALL ? remaining
                                              : Math.min(MIN_WALL + rng() * MIN_WALL, remaining - MIN_WALL);
        const bh = 4 + rng() * 5.5;
        yawBox(side * (half + WALL_T / 2), 0, bz + blen / 2, WALL_T, bh, blen, buildingMat(wallTexes[(rng() * 3) | 0], WALL_T, blen), { wall: true });
        if (rng() < 0.4) {
          const em = DECOR_EMOJI[(rng() * DECOR_EMOJI.length) | 0];
          if (!decorTextures[em]) decorTextures[em] = emojiTexture(em);
          const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: decorTextures[em], transparent: true }));
          sign.scale.set(2.6, 2.6, 1);
          const sp = toWorld(side * (half + WALL_T / 2), bz + blen / 2);
          sign.position.set(sp.x, bh + 1.6, sp.z); group.add(sign);
        }
        bz += blen;
      }
    }

    // width transition: seal the lateral step with a perpendicular wall on each side that
    // spans from the narrow corridor's inner edge out past the wide wall, flush, so the
    // play floor is always closed off (the continuous floor already spans the full width).
    if (prevHalf !== null) {
      const wide = Math.max(prevHalf, half), narrow = Math.min(prevHalf, half);
      if (wide - narrow > 0.05) {
        const segW = wide - narrow + WALL_T;            // cover the step + overlap both walls
        const bh = 5 + rng() * 3;
        for (const side of [-1, 1]) yawBox(side * (narrow + wide + WALL_T) / 2, 0, 0, segW, bh, WALL_T, buildingMat(wallTexes[2], segW, WALL_T, { onTop: true }), { wall: true });
      }
    }
    prevHalf = half;

    // pick this segment's obstacle (jump bar / slide bar / fry crates) — bars are full-width
    let obstacleZ = null, cratePick = false;
    if (!isEnd && i > 0) {
      const pick = rng();
      if (pick < 0.3) {
        const m = yawBox(0, 0, len / 2, half * 2, 1.05, 0.9, counterMatFor(half * 2));
        obstacles.push({ type: 'jump', mesh: m, box: boxes[boxes.length - 1] });
        obstacleZ = len / 2;
        if (n <= 5) { const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: jumpSignTex, transparent: true, side: THREE.DoubleSide })); const sp = toWorld(0, len / 2 - 0.6); sign.position.set(sp.x, 3.1, sp.z); sign.rotation.y = theta + Math.PI; group.add(sign); }
      } else if (pick < 0.6) {
        const m = yawBox(0, 1.0, len / 2, half * 2, 1.6, 0.9, slideBarMatFor(half * 2));
        obstacles.push({ type: 'slide', mesh: m, box: boxes[boxes.length - 1] });
        obstacleZ = len / 2;
        if (n <= 5) { const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: slideSignTex, transparent: true, side: THREE.DoubleSide })); const sp = toWorld(0, len / 2 - 0.6); sign.position.set(sp.x, 4.75, sp.z); sign.rotation.y = theta + Math.PI; group.add(sign); }
      } else { cratePick = true; }
    }

    // NUTS box for this level (placed before crates so crates can dodge it; clear of any bar)
    let nutsFoot = null;
    if (i === nutsSeg && pkType) {
      let nlz = 2 + rng() * Math.max(0.1, len - 4);
      if (obstacleZ != null) nlz = nlz < obstacleZ ? Math.min(nlz, obstacleZ - 1.9) : Math.max(nlz, obstacleZ + 1.9);
      nlz = clamp(nlz, 1.6, len - 1.6);
      const nlx = (rng() * 2 - 1) * Math.max(0.4, half - 2.2);
      const np = toWorld(nlx, nlz);
      const nm = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.6), nutsCrateMat);
      nm.position.set(np.x, 0.6, np.z); nm.rotation.y = theta; nm.castShadow = true; nm.receiveShadow = true; group.add(nm);
      const ca = Math.abs(Math.cos(theta)), sa = Math.abs(Math.sin(theta));
      const nb = new THREE.Box3(new THREE.Vector3(np.x - (ca + 0.8 * sa), 0, np.z - (sa + 0.8 * ca)), new THREE.Vector3(np.x + (ca + 0.8 * sa), 1.2, np.z + (sa + 0.8 * ca)));
      nb.cobb = { cx: np.x, cz: np.z, ry: theta, hx: 1.0, hz: 0.8 }; boxes.push(nb);
      pickups.push(makePickup(group, np.x, 2.1, np.z, pkType));
      danceSpots.push({ x: np.x, z: np.z, r: 2.5, ground: false, type: 'gold', used: false });
      nutsFoot = { lx: nlx, lz: nlz, hw: 1.2 };
    }

    // fry crates — never overlapping each other / the NUTS box, never under a bar (touching edges ok)
    if (cratePick) {
      const placed = [];
      const count = 2 + ((rng() * 3) | 0);
      for (let c = 0; c < count; c++) {
        const cw = 1.1 + rng() * 0.9, hw = cw / 2;
        let lx = 0, lz = 0, ok = false;
        for (let tr = 0; tr < 8 && !ok; tr++) {
          lx = (rng() * 2 - 1) * (half - 1.5); lz = 2 + rng() * (len - 4); ok = true;
          if (obstacleZ != null && Math.abs(lz - obstacleZ) < 0.45 + hw - 0.05) ok = false;
          if (ok && nutsFoot && Math.abs(lx - nutsFoot.lx) < hw + nutsFoot.hw - 0.05 && Math.abs(lz - nutsFoot.lz) < hw + nutsFoot.hw - 0.05) ok = false;
          if (ok) for (const o of placed) if (Math.abs(lx - o.lx) < hw + o.hw - 0.06 && Math.abs(lz - o.lz) < hw + o.hw - 0.06) { ok = false; break; }
        }
        if (!ok) continue;
        yawBox(lx, 0, lz, cw, 0.9 + rng() * 0.8, cw, rng() < 0.5 ? beefCrateMat : crateMat);
        placed.push({ lx, lz, hw });
      }
    }

    // ketchup spill hazard
    if (!isEnd && i > 0 && rng() < 0.45) {
      const r = 1.6 + rng() * 1.4;
      const p = toWorld((rng() * 2 - 1) * (half - r - 0.5), 2 + rng() * (len - 4));
      const pud = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: ketchupTex, transparent: true, depthWrite: false, alphaTest: 0.04 }));
      pud.rotation.x = -Math.PI / 2; pud.position.set(p.x, 0.015, p.z); group.add(pud);
      slowZones.push({ x: p.x, z: p.z, r });
    }

    // veggie enemies (none in seg 0; plaza stays clear on boss levels)
    if (i > 0 && !(isEnd && bossLevel)) {
      const maxTier = clamp(1 + Math.floor(n / 2), 1, VEGGIES.length);
      let count = isEnd ? 2 + Math.min(4, Math.floor(n / 2)) : 1 + ((rng() * (1 + n * 0.5)) | 0);
      count = Math.min(count * veggieMult, 6 * veggieMult);
      for (let e = 0; e < count; e++) {
        const p = toWorld((rng() * 2 - 1) * (half - 1.2), 2 + rng() * (len - 4));
        enemies.push(makeEnemy(group, VEGGIES[(rng() * maxTier) | 0], p.x, p.z, rng));
      }
    }

    // advance the cursor to the end of this segment
    cx += len * Math.sin(theta); cz += len * Math.cos(theta);
  }

  // ===== END PLAZA CONTENT (placed in the end-plaza frame: cursor now at its far end) =====
  cx = endCx; cz = endCz; theta = endTheta;          // re-anchor toWorld to the plaza start
  const plazaMid = endPlaza.len / 2;
  // end wall just past the burger
  yawBox(0, 0, endPlaza.len + WALL_T / 2, endPlaza.half * 2 + 8, 7, WALL_T, buildingMat(wallTexes[0], endPlaza.half * 2 + 8, WALL_T), { wall: true });

  const bw = toWorld(0, plazaMid);                   // burger world position
  const burgerPos = new THREE.Vector3(bw.x, 0, bw.z);
  const burger = new THREE.Sprite(new THREE.SpriteMaterial({ map: burgerFrames[0], transparent: true }));
  burger.scale.set(5.2, 5.2, 1); burger.position.set(bw.x, 2.7, bw.z); burger.renderOrder = 2; group.add(burger);
  const glow = new THREE.PointLight('#ffc62e', 60, 22); glow.position.set(bw.x, 4, bw.z); group.add(glow);
  const podium = yawBox(0, 0, plazaMid, 3.4, 0.5, 3.4, new THREE.MeshLambertMaterial({ color: '#ffc62e', emissive: '#7a4a00' }), { wall: false });
  podium.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.1, 10, 48), new THREE.MeshBasicMaterial({ color: '#ffc62e' }));
  ring.rotation.x = Math.PI / 2; ring.position.set(bw.x, 0.6, bw.z); group.add(ring);

  // boss-area positions: lateral lx, dz forward of the burger (negative = toward the player)
  const bossW = (lx, dz) => toWorld(lx, plazaMid + dz);

  // ===== BOSS — guards the burger on every 5th level (two at 25+) =====
  const bosses = [];
  const bossWave = [];   // L100 boss-rush: queued pairs that spawn from the burger as you clear them
  if (bossLevel) {
    const pickPool = () => BOSS_POOLS[(rng() * BOSS_POOLS.length) | 0];
    const pickName = (pool, exclude) => { const avail = pool.names.filter(nm => nm !== exclude); return avail[(rng() * avail.length) | 0]; };
    const spawnSmallVeggies = (pool, count) => {
      if (pool.veggieIdx < 0) return;
      const vd = VEGGIES[pool.veggieIdx];
      for (let i = 0; i < count; i++) {
        const p = bossW((rng() * 2 - 1) * 5, -5 + (rng() * 2 - 1) * 3);
        enemies.push(makeEnemy(group, { ...vd, hp: 3 }, p.x, p.z, rng));
      }
    };
    const pool1 = pickPool(); const name1 = pickName(pool1, null);
    const bp1 = bossW(0, -5);
    bosses.push(makeBoss(group, n, bp1.x, bp1.z, rng, pool1, name1));
    if (doubleBoss) {
      let pool2, name2;
      if (pool1.names.length > 1) { pool2 = pool1; name2 = pickName(pool1, name1); spawnSmallVeggies(pool1, 3); }
      else { const others = BOSS_POOLS.filter(p => p !== pool1); pool2 = others[(rng() * others.length) | 0]; name2 = pickName(pool2, null); spawnSmallVeggies(pool1, 2); spawnSmallVeggies(pool2, 2); }
      const bp2 = bossW(pool1 === pool2 ? 3.2 : -3.2, -5);
      bosses.push(makeBoss(group, n, bp2.x, bp2.z, rng, pool2, name2));
      const b0 = bossW(pool1 === pool2 ? -3.2 : 3.2, -5);
      bosses[0].pos.set(b0.x, 0, b0.z); bosses[0].home.set(b0.x, 0, b0.z);
      bosses[0].spr.position.set(b0.x, bosses[0].spr.position.y, b0.z);
      if (bosses[0].blob) bosses[0].blob.position.set(b0.x, bosses[0].blob.position.y, b0.z);
    } else spawnSmallVeggies(pool1, 2);
    bosses.forEach(b => enemies.push(b));
    const basicN = (2 + ((rng() * 3) | 0)) * veggieMult;
    for (let i = 0; i < basicN; i++) {
      const p = bossW((rng() * 2 - 1) * (endPlaza.half - 2), -8 + (rng() * 2 - 1) * 6);
      enemies.push(makeEnemy(group, VEGGIES[(rng() * 3) | 0], p.x, p.z, rng));
    }
    // L100 boss rush: queue 2 more boss PAIRS (3 pairs total). Each pair spawns from the
    // burger point and chases once the prior pair is cleared (spawnBossWave, on boss-down).
    if (bossRush) {
      for (let w = 0; w < 2; w++) {
        const pa = pickPool(), na = pickName(pa, null);
        const pb = pickPool(), nb = pickName(pb, pa === pb ? na : null);
        bossWave.push([{ pool: pa, name: na }, { pool: pb, name: nb }]);
      }
    }
  }

  scene.add(group);
  level = {
    group, boxes, slowZones, enemies, bosses, pickups, danceSpots, obstacles, bossLevel, doubleBoss,
    burger, burgerPos, ring, glow, bossRush, bossWave, waveNum: 1,
    endZ: cz, frameT: 0, frame: 0, won: false, panT: PAN_DUR, introT: 1.0, lockWarnCD: 0,
  };

  // boss levels put the moon on the OTHER side of the sky (light + shadows follow)
  setMoonSide(bossLevel);
  // reposition the 3 twinkling stars randomly for this level
  randomizeTwinkles();

  // reset player
  PLAYER.pos.set(0, 0, -8);
  PLAYER.vel.set(0, 0, 0);
  PLAYER.move.set(0, 0, 0);
  PLAYER.yaw = 0; PLAYER.pitch = 0; PLAYER.camTilt = 0;
  PLAYER.camBlend = 0; PLAYER.viewHeight = PLAYER.height;
  camInit = false;
  // health carries over between levels when banked above 3; otherwise refills to 3
  PLAYER.hp = clamp(Math.max(3, PLAYER.hp), 3, MAX_HP); PLAYER.inv = 0;
  PLAYER.greaseMax = greaseMax;
  PLAYER.sprint = greaseMax;                 // start each level topped up to capacity
  PLAYER.sliding = false; PLAYER.curHeight = PLAYER.height;
  PLAYER.crouching = false; PLAYER.calmT = 0; PLAYER.rechargeMult = 1;
  PLAYER.danceCount = 0; PLAYER.danceSpot = null; PLAYER._wasCrouching = false;
  PLAYER.aiming = false;
  kills = 0; levelTime = 0; timerRunning = false;
  mouseDX = 0; mouseDY = 0;
  updateHearts();
  ui.levelnum.textContent = levelIndex;
  ui.killnum.textContent = '0';
  ui.alltimenum.textContent = saveData.total;
  ui.timertext.textContent = '0:00.000';
  // grease meter: show capacity growth + max-grease styling
  ui.sprintfill.parentElement.parentElement.classList.toggle('maxgrease', maxGrease);
  // boss health bar
  ui.bossbar.classList.toggle('on', bosses.length > 0);
  if (bosses.length) {
    ui.bossname.textContent = doubleBoss
      ? (bosses[0].pool === bosses[1].pool
        ? `${bosses[0].def.name} & ${bosses[1].def.name}`
        : 'DOUBLE TROUBLE')
      : bosses[0].def.name;
    ui.bosshp.style.width = '100%';
  }
}

/* ========================================================== collisions */

// push a circle (centre pos, radius r) out of an oriented box footprint o={cx,cz,ry,hx,hz}
function pushOutOBB(pos, r, o) {
  const c = Math.cos(o.ry), s = Math.sin(o.ry);
  const dx = pos.x - o.cx, dz = pos.z - o.cz;
  let lx = dx * c - dz * s, lz = dx * s + dz * c;       // world → box-local
  if (lx > -o.hx && lx < o.hx && lz > -o.hz && lz < o.hz) {
    const pXp = o.hx - lx, pXn = lx + o.hx, pZp = o.hz - lz, pZn = lz + o.hz;  // inside → least-pen face
    const m = Math.min(pXp, pXn, pZp, pZn);
    if (m === pXp) lx = o.hx + r; else if (m === pXn) lx = -o.hx - r;
    else if (m === pZp) lz = o.hz + r; else lz = -o.hz - r;
  } else {
    const ex = lx - clamp(lx, -o.hx, o.hx), ez = lz - clamp(lz, -o.hz, o.hz);
    const dist = Math.hypot(ex, ez);
    if (dist >= r || dist < 1e-6) return;
    const push = r - dist;
    lx += (ex / dist) * push; lz += (ez / dist) * push;
  }
  pos.x = o.cx + lx * c + lz * s;                       // box-local → world
  pos.z = o.cz - lx * s + lz * c;
}

// axis-by-axis AABB resolve for a vertical capsule approximated as a box. Boxes carrying
// a `cobb` (collision OBB) are angled walls/obstacles — they're skipped by the AABB sweeps
// and depenetrated in the OBB pass; `wall` boxes are full-height barriers you never stand on.
function resolveEntity(pos, vel, r, h, dt, boxesArr) {
  let grounded = false;

  // X
  pos.x += vel.x * dt;
  for (const b of boxesArr) {
    if (b.cobb) continue;
    if (pos.x + r > b.min.x && pos.x - r < b.max.x &&
        pos.y + h > b.min.y + 0.02 && pos.y < b.max.y - 0.02 &&
        pos.z + r > b.min.z && pos.z - r < b.max.z) {
      const pen1 = b.max.x - (pos.x - r), pen2 = (pos.x + r) - b.min.x;
      pos.x += pen1 < pen2 ? pen1 : -pen2;
    }
  }
  // Z
  pos.z += vel.z * dt;
  for (const b of boxesArr) {
    if (b.cobb) continue;
    if (pos.x + r > b.min.x && pos.x - r < b.max.x &&
        pos.y + h > b.min.y + 0.02 && pos.y < b.max.y - 0.02 &&
        pos.z + r > b.min.z && pos.z - r < b.max.z) {
      const pen1 = b.max.z - (pos.z - r), pen2 = (pos.z + r) - b.min.z;
      pos.z += pen1 < pen2 ? pen1 : -pen2;
    }
  }
  // angled boxes: depenetrate the footprint when the entity is at the box's height
  for (const b of boxesArr) {
    if (b.cobb && pos.y + h > b.min.y + 0.02 && pos.y < b.max.y - 0.02) pushOutOBB(pos, r, b.cobb);
  }
  // Y
  pos.y += vel.y * dt;
  for (const b of boxesArr) {
    if (b.wall) continue;   // full-height barriers: never stand on / bonk them
    if (pos.x + r > b.min.x && pos.x - r < b.max.x &&
        pos.y + h > b.min.y && pos.y < b.max.y &&
        pos.z + r > b.min.z && pos.z - r < b.max.z) {
      const penUp = b.max.y - pos.y;          // push up onto the box
      const penDown = (pos.y + h) - b.min.y;  // push down below the box
      // only bonk a ceiling when genuinely moving up into the box;
      // a grounded/falling entity can never be pushed through the floor.
      if (penUp <= penDown || vel.y <= 0) {
        pos.y = b.max.y;
        if (vel.y <= 0) { vel.y = 0; grounded = true; }
      } else {
        pos.y = b.min.y - h;
        if (vel.y > 0) vel.y = 0;
      }
    }
  }
  if (pos.y < -8) { pos.y = 0; grounded = true; vel.y = 0; } // failsafe
  return grounded;
}

/* =========================================================== particles */

const MAX_PARTICLES = 5000;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAX_PARTICLES * 3);
const pCol = new Float32Array(MAX_PARTICLES * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.PointsMaterial({
  size: 0.22, vertexColors: true, transparent: true,
  depthWrite: false, blending: THREE.AdditiveBlending,
});
const pPoints = new THREE.Points(pGeo, pMat);
pPoints.frustumCulled = false;
scene.add(pPoints);

const particles = []; // {x,y,z,vx,vy,vz,life,maxLife,r,g,b,drag,grav}

function spawnBurst(pos, color, count, speed, { grav = -9, life = 0.9, spread = 1 } = {}) {
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) break;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const sp = speed * (0.35 + Math.random() * 0.65);
    particles.push({
      x: pos.x, y: pos.y, z: pos.z,
      vx: Math.sin(ph) * Math.cos(th) * sp * spread,
      vy: Math.cos(ph) * sp,
      vz: Math.sin(ph) * Math.sin(th) * sp * spread,
      life: life * (0.6 + Math.random() * 0.4), maxLife: life,
      r: c.r, g: c.g, b: c.b, grav,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  const n = Math.min(particles.length, MAX_PARTICLES);
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const fade = clamp(p.life / p.maxLife, 0, 1);
    pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
    pCol[i * 3] = p.r * fade; pCol[i * 3 + 1] = p.g * fade; pCol[i * 3 + 2] = p.b * fade;
  }
  pGeo.setDrawRange(0, n);
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

/* =========================================================== fireworks */

const FW_COLORS = ['#d62300', '#ffc62e', '#ff9214', '#6aa84f', '#fff3d6', '#ff5e9c'];
let rockets = [];
let fwTimer = 0, fwSpawn = 0;
const greaseSpecks = [];  // {el, life} — hot-grease dots rising through the sprint bar
let speckSpawnCD = 0;

function updateFireworks(dt) {
  fwTimer += dt;
  fwSpawn -= dt;
  if (fwTimer < 4.8 && fwSpawn <= 0) {
    fwSpawn = 0.28 + Math.random() * 0.2;
    const b = level.burgerPos;
    // quadruple barrage — four rockets per volley across a wider spread
    for (let k = 0; k < 4; k++) {
      rockets.push({
        x: b.x + (Math.random() * 2 - 1) * 11, y: 0.5, z: b.z + (Math.random() * 2 - 1) * 8,
        vy: 13 + Math.random() * 8,
        color: FW_COLORS[(Math.random() * FW_COLORS.length) | 0],
        fuse: 0.8 + Math.random() * 0.7,
      });
    }
    AudioFX.launch();
  }
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.fuse -= dt;
    r.y += r.vy * dt;
    spawnBurst(new THREE.Vector3(r.x, r.y, r.z), r.color, 2, 0.6, { grav: -2, life: 0.4 });
    if (r.fuse <= 0) {
      spawnBurst(new THREE.Vector3(r.x, r.y, r.z), r.color, 90, 9, { grav: -5, life: 1.5 });
      spawnBurst(new THREE.Vector3(r.x, r.y, r.z), '#fff3d6', 30, 5, { grav: -5, life: 1.1 });
      AudioFX.boom();
      rumble(0.4, 0.5, 130);                    // a thump per firework burst
      rockets.splice(i, 1);
    }
  }
  // burger floats up and spins through its dance
  level.burger.position.y = 2.7 + fwTimer * 0.9;
  level.burger.material.rotation += dt * 2.2;

  if (fwTimer > 5.2) {
    try { document.exitPointerLock?.(); } catch (_) {}   // unguarded throw here froze the order screen on iPad
    showComplete();
  }
}

/* ======================================================== flow control */

function startLevelToast() {
  if (level.bossLevel) toast(`LEVEL ${levelIndex} — BOSS FIGHT!`, 2200);
  else toast(`LEVEL ${levelIndex} — GO!`);
}

function startRun(atLevel) {
  AudioFX.init();                // ensure audio is live no matter how the run was started
  levelIndex = atLevel || 1;
  runLevels = 0;
  PLAYER.hp = 3;                 // fresh run starts at base health
  buildHearts();
  generateLevel(levelIndex, levelIndex);
  setState('playing');
  lockPointer();
  startLevelToast();
}

// 100-level cap with unlock semantics: reaching 99 unlocks all 100; best never exceeds 100
function unlockTo(idx) {
  saveData.best = Math.min(100, Math.max(saveData.best, idx >= 99 ? 100 : idx));
  persist();
}

function winLevel() {
  if (level.won) return;
  level.won = true;
  timerRunning = false;
  runLevels++;
  saveData.total++;
  unlockTo(levelIndex);
  ui.bossbar.classList.remove('on');
  kills && AudioFX.kill();
  AudioFX.win();
  setState('fireworks');
  ui.hud.classList.add('on');
  fwTimer = 0; fwSpawn = 0; rockets = [];
  fwCamFrom.copy(camera.position);     // ease the 360 crane out of the current pose
  fwQuatFrom.copy(camera.quaternion);
  toast('ORDER UP!', 3000);
}

function showComplete() {
  ui.c_level.textContent = levelIndex;
  ui.r_level.textContent = levelIndex;
  ui.r_time.textContent = fmtTime(levelTime * 1000);
  ui.r_kills.textContent = kills;
  ui.r_run.textContent = runLevels;
  ui.r_alltime.textContent = saveData.total;
  setState('complete');
}

function nextLevel() {
  levelIndex = levelIndex >= 100 ? 1 : levelIndex + 1;   // silent wrap to 1 after the L100 cap
  AudioFX.init();
  generateLevel(levelIndex, levelIndex);
  setState('playing');
  lockPointer();
  AudioFX.init(); AudioFX.fireBounce();  // firework bounce on next-level
  startLevelToast();
}

// jump straight to level n (debug terminal): unlock through n, keep current health
function skipToLevel(n) {
  n = clamp(n | 0, 1, 100);
  levelIndex = n;
  unlockTo(n);
  AudioFX.init();
  generateLevel(n, n);
  setState('playing');
  lockPointer();
  startLevelToast();
}

function retryLevel() {
  AudioFX.init();
  PLAYER.hp = 3;                 // retry after a roasting starts at base health
  generateLevel(levelIndex, levelIndex);
  setState('playing');
  lockPointer();
  toast(level.bossLevel ? 'BACK FOR THE BOSS' : 'BACK FROM THE FRYER');
}

function hurtPlayer(fromPos) {
  if (PLAYER.inv > 0 || state !== 'playing') return;
  PLAYER.hp--;
  PLAYER.inv = 1.1;
  updateHearts();
  AudioFX.hurt();
  rumble(0.95, 0.7, 280);                       // strong jolt on taking damage
  ui.damage.classList.add('hit');
  setTimeout(() => ui.damage.classList.remove('hit'), 120);
  const away = new THREE.Vector3().subVectors(PLAYER.pos, fromPos).setY(0).normalize();
  PLAYER.vel.x += away.x * 9;
  PLAYER.vel.z += away.z * 9;
  PLAYER.vel.y = 4.5;
  if (PLAYER.hp <= 0) {
    try { document.exitPointerLock?.(); } catch (_) {}
    setState('dead');
  }
}

/* ========================================================== projectiles */

function shoot() {
  // shots travel from the peanut toward whatever the center-screen crosshair covers
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);

  if (PLAYER.aiming) {
    // first person: straight out of the eye, no assist needed
    const dir = camDir.clone();
    dir.x += (Math.random() - 0.5) * 0.025;
    dir.y += (Math.random() - 0.5) * 0.025;
    dir.z += (Math.random() - 0.5) * 0.025;
    dir.normalize();
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: ammoFrames ? ammoFrames[0] : peanutTex, transparent: true }));
    spr.scale.set(0.32, 0.42, 1);
    spr.material.rotation = Math.random() * Math.PI * 2;
    spr.position.copy(camera.position).addScaledVector(dir, 0.6);
    spr.position.y -= 0.12;
    scene.add(spr);
    projectiles.push({ spr, vel: dir.multiplyScalar(42), life: 1.6, spin: (Math.random() - 0.5) * 14, frames: ammoFrames, frameT: 0 });
    AudioFX.shoot();
    return;
  }

  // aim assist: if the crosshair ray passes near a veggie, target it exactly
  let target = null, bestS = Infinity;
  const toE = new THREE.Vector3();
  for (const e of level.enemies) {
    if (!e.alive) continue;
    toE.set(e.pos.x, e.def.scale * 0.7, e.pos.z).sub(camera.position);
    const s = toE.dot(camDir);
    if (s < 2 || s > bestS) continue;
    const distSq = toE.lengthSq() - s * s;
    const r = e.def.r + 0.5;
    if (distSq < r * r) {
      bestS = s;
      target = camera.position.clone().addScaledVector(camDir, s);
    }
  }
  if (!target) {
    // fall back to where the crosshair ray meets veggie height
    let t = 60;
    if (camDir.y < -0.02) t = Math.min(60, (camera.position.y - 0.8) / -camDir.y);
    target = camera.position.clone().addScaledVector(camDir, t);
  }

  const from = new THREE.Vector3(
    PLAYER.pos.x, PLAYER.pos.y + PLAYER.curHeight * 0.78, PLAYER.pos.z);
  const dir = target.sub(from).normalize();
  dir.x += (Math.random() - 0.5) * 0.025;
  dir.y += (Math.random() - 0.5) * 0.025;
  dir.z += (Math.random() - 0.5) * 0.025;
  dir.normalize();

  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: ammoFrames ? ammoFrames[0] : peanutTex, transparent: true }));
  spr.scale.set(0.32, 0.42, 1);
  spr.material.rotation = Math.random() * Math.PI * 2;
  spr.position.copy(from).addScaledVector(dir, 0.7);
  scene.add(spr);
  projectiles.push({ spr, vel: dir.multiplyScalar(42), life: 1.6, spin: (Math.random() - 0.5) * 14, frames: ammoFrames, frameT: 0 });
  AudioFX.shoot();
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.vel.y -= 2.5 * dt;
    p.spr.position.addScaledVector(p.vel, dt);
    p.spr.material.rotation += p.spin * dt;
    if (p.frames && p.frames.length > 1) {          // animated ammo: cycle the glint as it flies
      p.frameT += dt;
      p.spr.material.map = p.frames[((p.frameT / 0.05) | 0) % p.frames.length];
      p.spr.material.needsUpdate = true;
    }
    let dead = p.life <= 0 || p.spr.position.y < 0;

    if (!dead) {
      // walls
      const pp = p.spr.position;
      for (const b of level.boxes) {
        if (pp.x > b.min.x && pp.x < b.max.x && pp.y > b.min.y && pp.y < b.max.y &&
            pp.z > b.min.z && pp.z < b.max.z) { dead = true; break; }
      }
    }
    if (!dead) {
      // veggies
      for (const e of level.enemies) {
        if (!e.alive) continue;
        const dx = p.spr.position.x - e.pos.x;
        const dy = p.spr.position.y - e.def.scale * 0.7;
        const dz = p.spr.position.z - e.pos.z;
        const hitR = e.def.r + (e.isBoss ? 0.9 : 0.55);
        if (dx * dx + dy * dy + dz * dz < hitR * hitR) {
          dead = true;
          e.hp--;
          e.flash = e.isBoss ? 0.08 : 0.12;
          if (e.isBoss) ui.bosshp.style.width = `${bossHpFrac() * 100}%`;
          if (e.hp <= 0) {
            e.alive = false;
            e.spr.visible = false;
            if (e.blob) e.blob.visible = false;
            if (e.blobTop) e.blobTop.visible = false;
            kills++;
            ui.killnum.textContent = kills;
            if (e.isBoss) {
              spawnBurst(new THREE.Vector3(e.pos.x, e.def.scale * 0.7, e.pos.z), '#6aa84f', 120, 9, { life: 1.5 });
              spawnBurst(new THREE.Vector3(e.pos.x, e.def.scale * 0.7, e.pos.z), '#ffc62e', 70, 7, { life: 1.2 });
              spawnBurst(new THREE.Vector3(e.pos.x, e.def.scale * 0.7, e.pos.z), '#fff3d6', 40, 5, { life: 1.0 });
              AudioFX.boom(); AudioFX.win();
              rumble(1.0, 0.85, 520);            // big boss-down jolt
              // drop a diamond peanut (+2 health) right where the boss fell — it drops a
              // bit onto a painted ground X that marks a teabag dance spot. Dancing the X
              // (4 crouches in 4s) pops ANOTHER diamond, no matter your health and even
              // after you've grabbed this one (the spot persists independently).
              const drop = makePickup(level.group, e.pos.x, 1.7, e.pos.z, 'diamond');
              drop._isBossDrop = true;
              drop.landFrom = 1.7; drop.landTo = 0.95; drop.landT = 0;   // "drops a bit" on landing
              (level.pickups || (level.pickups = [])).push(drop);
              const xMark = makeTeabagMark(level.group, e.pos.x, e.pos.z);
              (level.danceSpots || (level.danceSpots = [])).push({
                x: e.pos.x, z: e.pos.z, r: 3.8, ground: true, type: 'diamond', used: false, mark: xMark, markT: 0,
              });
              setTimeout(() => AudioFX.bossPing(), 240);   // nice ping after the boom
              // felling a boss permanently grows the grease meter (+15%, cap +150)
              PLAYER.greaseMax = Math.min(250, PLAYER.greaseMax + 15);
              PLAYER.sprint = Math.min(PLAYER.greaseMax, PLAYER.sprint + 25);
              if (PLAYER.greaseMax >= 250) ui.sprintfill.parentElement.parentElement.classList.add('maxgrease');
              ui.bosshp.style.width = `${bossHpFrac() * 100}%`;
              const allDown = level.bosses.every(bz => !bz.alive);
              if (allDown) {
                if (level.bossWave && level.bossWave.length) spawnBossWave();   // rush: next pair bursts from the burger
                else { ui.bossbar.classList.remove('on'); toast('BOSS DOWN — GRAB THE BURGER!', 2600); }
              } else toast('ONE DOWN — FINISH THE OTHER!', 1800);
            } else {
              spawnBurst(new THREE.Vector3(e.pos.x, 0.9, e.pos.z), '#6aa84f', 26, 5, { life: 0.8 });
              spawnBurst(new THREE.Vector3(e.pos.x, 0.9, e.pos.z), '#ffc62e', 14, 4, { life: 0.6 });
              AudioFX.kill();
              rumble(0.28, 0.18, 70);             // light pop on a veggie kill
            }
          } else {
            AudioFX.hit();
          }
          break;
        }
      }
    }
    if (dead) {
      spawnBurst(p.spr.position, '#f2d8a7', 5, 2.2, { life: 0.35, grav: -6 });
      scene.remove(p.spr);
      projectiles.splice(i, 1);
    }
  }
}

/* ============================================================= enemies */

// fraction of total boss health remaining (handles single + double-boss levels)
function bossHpFrac() {
  if (!level || !level.bosses || !level.bosses.length) return 0;
  let hp = 0, mx = 0;
  for (const bz of level.bosses) { mx += bz.maxHp; if (bz.alive) hp += Math.max(0, bz.hp); }
  return mx ? hp / mx : 0;
}

// L100 boss rush: pop the next queued pair and spawn it FROM the burger point so it charges
// the player. Becomes the live `level.bosses` (bar + lock track it); pushed into the enemy list.
function spawnBossWave() {
  const wave = level.bossWave.shift();
  const bp = level.burgerPos;
  const pair = wave.map((w, k) => {
    const ox = (k ? 1 : -1) * 2.6;
    const b = makeBoss(level.group, levelIndex, bp.x + ox, bp.z, Math.random, w.pool, w.name);
    level.enemies.push(b);
    return b;
  });
  level.bosses = pair;
  level.waveNum++;
  ui.bossname.textContent = pair[0].pool === pair[1].pool
    ? `${pair[0].def.name} & ${pair[1].def.name}` : 'DOUBLE TROUBLE';
  ui.bosshp.style.width = '100%';
  ui.bossbar.classList.add('on');
  toast(`WAVE ${level.waveNum} — INCOMING!`, 1700);
  AudioFX.boom(); rumble(0.7, 0.5, 240);
}

const tmpV = new THREE.Vector3();
function updateEnemies(dt, time) {
  for (const e of level.enemies) {
    if (!e.alive) continue;
    const dx = PLAYER.pos.x - e.pos.x;
    const dz = PLAYER.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    const aggro = e.isBoss ? 90 : (levelIndex >= 25 ? 23 : 14);  // aggressive after level 25

    let sp = e.def.speed, vy = 0;
    if (e.isBoss) {
      e.enraged = e.hp < e.maxHp;       // becomes dynamic once it's been hit
      // periodic lunge: telegraphed pause, then a fast charge at the peanut
      e.lungeCD -= dt;
      if (e.lungeT > 0) { e.lungeT -= dt; sp = e.def.speed * 2.6; }
      else if (e.lungeCD <= 0 && dist < 26) { e.lungeT = 0.55; e.lungeCD = 3.4; AudioFX.hurt(); }
      // gravity for hops; enraged boss smashes slide bars & hops jump counters
      e.vy = (e.vy || 0) + GRAV * dt;
      if (e.enraged && level.obstacles) {
        for (const ob of level.obstacles) {
          if (ob.broken) continue;
          const od = Math.hypot(e.pos.x - ob.mesh.position.x, e.pos.z - ob.mesh.position.z);
          if (od < e.def.r + 2.6) {
            if (ob.type === 'slide') {                  // bust the drive-thru bar down
              ob.broken = true; ob.mesh.visible = false;
              const idx = level.boxes.indexOf(ob.box); if (idx >= 0) level.boxes.splice(idx, 1);
              spawnBurst(ob.mesh.position, '#ffc62e', 32, 6, { life: 0.8 });
              spawnBurst(ob.mesh.position, '#fff3d6', 14, 4, { life: 0.5 });
              AudioFX.boom(); rumble(0.6, 0.5, 200);
            } else if (ob.type === 'jump' && e.onGround) {
              e.vy = 9.5;                                // hop over the counter
            }
          }
        }
      }
      vy = e.vy;
    }
    const rad = e.isBoss ? e.def.r : e.def.r + 0.4;     // veggies keep clear of walls/obstacles
    if (e.isBoss) {
      const bx = e.pos.x, bz = e.pos.z;
      const grounded = resolveEntity(e.pos, tmpV.set(dist > 0.001 ? dx / dist * sp : 0, vy, dist > 0.001 ? dz / dist * sp : 0), rad, 1.0, dt, level.boxes);
      e.onGround = grounded; if (grounded && e.vy < 0) e.vy = 0;
      if (e.pos.y < 0) { e.pos.y = 0; e.vy = 0; }
      const moved = Math.hypot(e.pos.x - bx, e.pos.z - bz);
      e.hopCD = (e.hopCD || 0) - dt;
      if (moved < sp * dt * 0.5 && dist > 2.5 && e.onGround && e.hopCD <= 0) {
        e.vy = 11;
        e.hopCD = 0.9;
      }
      // boss can't enter the parking lot — invisible wall at z=-2 with strafe behavior
      if (e.pos.z < -2) {
        e.pos.z = -2;
        if (!e.blocked) { e.blocked = true; e.strafeDir = 1; e.blockT = 0; }
        e.blockT = (e.blockT || 0) + dt;
        if (e.blockT > 0.8) { e.strafeDir *= -1; e.blockT = 0; }
      }
    } else if (!e.isBoss && e.wander) {
      // simple wander path — pick direction, move slowly, change on wall hit or timer
      const wsp = e.def.speed * 0.35;
      e.wanderTimer -= dt;
      if (e.wanderTimer <= 0) {
        e.wanderDir = Math.random() * Math.PI * 2;
        e.wanderTimer = 1.2 + Math.random() * 2.4;
      }
      const mvx = Math.sin(e.wanderDir), mvz = Math.cos(e.wanderDir);
      const bx = e.pos.x, bz = e.pos.z;
      resolveEntity(e.pos, tmpV.set(mvx * wsp, 0, mvz * wsp), rad, 1.0, dt, level.boxes);
      e.pos.y = 0;
      if (Math.hypot(e.pos.x - bx, e.pos.z - bz) < wsp * dt * 0.4) {
        e.wanderTimer = 0;  // hit a wall → pick new direction next frame
      }
    } else if (dist < aggro && dist > 0.001) {
      // steer toward the player; if the path is blocked (wedged on an obstacle)
      // strafe sideways and stay back so it can free itself instead of clipping in
      let mvx = dx / dist, mvz = dz / dist;
      if (e.blocked) {
        const s = e.strafeDir;                          // sideways, slight forward
        mvx = mvx * 0.3 - (dz / dist) * s;
        mvz = mvz * 0.3 + (dx / dist) * s;
        const L = Math.hypot(mvx, mvz) || 1; mvx /= L; mvz /= L;
      }
      const bx = e.pos.x, bz = e.pos.z;
      resolveEntity(e.pos, tmpV.set(mvx * sp, 0, mvz * sp), rad, 1.0, dt, level.boxes);
      e.pos.y = 0;
      const moved = Math.hypot(e.pos.x - bx, e.pos.z - bz);
      if (moved < sp * dt * 0.55 && dist > 2.2) {       // not making progress → wedged
        if (!e.blocked) { e.blocked = true; e.strafeDir = (e.bob > Math.PI ? 1 : -1); e.blockT = 0; }
        e.blockT = (e.blockT || 0) + dt;
        if (e.blockT > 0.8) { e.strafeDir *= -1; e.blockT = 0; }   // try the other way to self-free
      } else if (e.blocked && moved > sp * dt * 0.75) {
        e.blocked = false; e.blockT = 0;                 // clear of the obstacle, resume chase
      }
    }
    // keep veggies from stacking (the boss is immovable — minions part around it)
    if (!e.isBoss) {
      for (const o of level.enemies) {
        if (o === e || !o.alive) continue;
        const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z;
        const d = Math.hypot(ox, oz);
        const min = e.def.r + o.def.r;
        if (d < min && d > 0.001) {
          e.pos.x += (ox / d) * (min - d) * (o.isBoss ? 1.0 : 0.5);
          e.pos.z += (oz / d) * (min - d) * (o.isBoss ? 1.0 : 0.5);
        }
      }
      // the stacking push above ignores geometry, so re-resolve against the world
      // (zero velocity just un-penetrates) — stops crowded veggies being shoved
      // through the JUMP! counter / walls and clipping under the map
      resolveEntity(e.pos, tmpV.set(0, 0, 0), rad, 1.0, dt, level.boxes);
      e.pos.y = 0;
    }

    const bobAmp = e.isBoss ? 0.4 : 0.18;
    e.spr.position.set(e.pos.x, e.pos.y + e.def.scale * 0.7 + Math.abs(Math.sin(time * (e.isBoss ? 2.6 : 5) + e.bob)) * bobAmp, e.pos.z);
    if (e.blob) {
      e.blob.position.set(e.pos.x, 0.03, e.pos.z);
      // slice the shadow onto any obstacle the enemy/boss is on or hopping over
      const topBox = level.boxes ? shadowTopBox(e.pos.x, e.pos.z, e.pos.y, e.def.r * 0.95, level.boxes) : null;
      // floor layer: cut out the obstacle footprint so it can't poke out underneath
      if (topBox) setOuterClipToBox(e.blob.material.clippingPlanes, topBox);
      else clearOuterClip(e.blob.material.clippingPlanes);
      if (e.blobTop) {
        if (topBox) {
          setClipToBox(e.blobTop.material.clippingPlanes, topBox);
          e.blobTop.position.set(e.pos.x, topBox.max.y + 0.03, e.pos.z);
          e.blobTop.visible = true;
        } else {
          e.blobTop.visible = false;
        }
      }
    }
    if (e.flash > 0) {
      e.flash -= dt;
      e.spr.material.color.setRGB(4, 0.6, 0.6);
    } else {
      e.spr.material.color.setRGB(1, 1, 1);
    }

    // contact damage (forgiving while sliding — you slip past)
    const touchR = e.def.r + PLAYER.radius + 0.15;
    if (dist < touchR && Math.abs(e.pos.y - PLAYER.pos.y) < 2.2 && !PLAYER.sliding) hurtPlayer(e.pos);
  }
}

// floating healing pickups (Doom-style billboards) — bob, glow, heal on run-over
function updatePickups(dt, time) {
  if (!level.pickups) return;
  for (const pk of level.pickups) {
    if (!pk.alive) continue;
    // spin through the gif frames + gentle bob
    pk.frameT += dt;
    if (pk.frameT > 0.07) {
      pk.frameT = 0; pk.frame = (pk.frame + 1) % pk.frames.length;
      pk.spr.material.map = pk.frames[pk.frame]; pk.spr.material.needsUpdate = true;
    }
    // boss drops "drop a bit" after the kill (the X dance spot is registered separately)
    if (pk.landFrom !== undefined && pk.landT < 0.55) {
      pk.landT += dt;
      const u = clamp(pk.landT / 0.55, 0, 1);
      pk.baseY = pk.landFrom + (pk.landTo - pk.landFrom) * (u * u);     // accelerating fall
      if (pk.landT >= 0.55)                                             // touchdown puff
        spawnBurst(new THREE.Vector3(pk.pos.x, 0.1, pk.pos.z), '#fff3d6', 18, 4, { life: 0.5, grav: -4, spread: 1.6 });
    }
    pk.spr.position.y = pk.baseY + Math.sin(time * 2.6 + pk.bob) * 0.18;
    if (pk.glow) pk.glow.position.y = pk.spr.position.y;
    // 3D distance — pickups float above the fry-box steps, so you jump to reach them
    const eyeY = PLAYER.pos.y + PLAYER.curHeight * 0.6;
    const d = Math.hypot(PLAYER.pos.x - pk.pos.x, PLAYER.pos.z - pk.pos.z, eyeY - pk.spr.position.y);
    if (d < 1.9 && PLAYER.hp < MAX_HP) {
      PLAYER.hp = Math.min(MAX_HP, PLAYER.hp + pk.heal);
      updateHearts();
      pk.alive = false; pk.spr.visible = false; if (pk.glow) pk.glow.intensity = 0;
      const col = pk.type === 'gold' ? '#ffd23b' : '#8fe6ff';
      spawnBurst(new THREE.Vector3(pk.pos.x, pk.baseY, pk.pos.z), col, 34, 6, { life: 0.9 });
      spawnBurst(new THREE.Vector3(pk.pos.x, pk.baseY, pk.pos.z), '#fff3d6', 16, 4, { life: 0.6 });
      if (pk.type === 'diamond') { AudioFX.healBig(); rumble(0.5, 0.6, 220); toast('+2 HEALTH!', 1100); }
      else { AudioFX.heal(); rumble(0.3, 0.3, 120); toast('+1 HEALTH', 850); }
    }
  }

  // teabag dance-spot X marks: paint on (stroke 1 then stroke 2), breathe, then wipe
  // away once the spot's been danced. These persist independently of the pickup, so the
  // X stays put on the death spot even after you grab the diamond.
  for (const ds of level.danceSpots || []) {
    const m = ds.mark; if (!m) continue;
    ds.markT = (ds.markT || 0) + dt;
    const mat = m.mesh.material;
    if (ds.used) {
      mat.opacity = Math.max(0, mat.opacity - dt * 2.2);             // wipe away once danced
      if (mat.opacity <= 0.001) m.mesh.visible = false;
    } else {
      const t = Math.max(0, ds.markT - 0.5);                         // small delay: the diamond lands first
      const paint = clamp(t / 0.6, 0, 1);                            // paint-on grow
      const pulse = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(time * 4.5));
      mat.opacity = paint * 0.95 * pulse;
      m.mesh.scale.setScalar(0.4 + 0.6 * paint + 0.04 * paint * Math.sin(time * 4.5));  // pop in, then breathe
    }
  }
}

// the nearest un-danced teabag spot the player is currently standing in (ground spots
// work at street level; crate spots need you up on the crate)
function activeDanceSpot() {
  if (!level || !level.danceSpots) return null;
  for (const ds of level.danceSpots) {
    if (ds.used) continue;
    const groundOk = ds.ground || PLAYER.pos.y > 0.5;
    if (groundOk && Math.hypot(PLAYER.pos.x - ds.x, PLAYER.pos.z - ds.z) < ds.r) return ds;
  }
  return null;
}

/* ========================================================= player tick */

function updatePlayer(dt) {
  // first person is the default; the 360 intro pan + brief third-person reveal play
  // first, then it blends to first person
  const frozen = level.panT > 0;     // movement/aim locked during the intro 360 pan
  const canPlay = state === 'playing' && level.panT <= 0 && level.introT <= 0;
  PLAYER.aiming = canPlay && saveData.cam !== 'third';  // first or auto->first, third stays TP

  // mouse X steers; mouse Y is look pitch in first person, camera tilt in third.
  // touch drag (right zone) feeds the same look deltas.
  mouseDX += touch.lookDX * 2; mouseDY += touch.lookDY * 2; touch.lookDX = touch.lookDY = 0;
  const sens = 0.0022 * sensFactor();
  if (!frozen) {
    PLAYER.yaw -= mouseDX * sens;
    // third-person vertical look: drag up (mouseDY<0) tilts the view UP toward the sky
    // (camera drops behind toward the floor); range widened so TP aim can reach high.
    if (PLAYER.aiming) PLAYER.pitch = clamp(PLAYER.pitch - mouseDY * sens, -1.45, 1.45);
    else PLAYER.camTilt = clamp(PLAYER.camTilt + mouseDY * sens, -0.95, 0.55);
  }

  // idle tracking: ANY input resets the 30s attract-camera timer (read before zeroing)
  const anyKey = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.Space ||
    keys.KeyC || keys.ShiftLeft || keys.ShiftRight ||
    keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
  const anyPad = gp.connected && (Math.abs(gp.lx) > 0.15 || Math.abs(gp.ly) > 0.15 ||
    Math.abs(gp.rx) > 0.15 || Math.abs(gp.ry) > 0.15 || gp.lb || gp.rt || gp.l3 ||
    gp.aHeld || gp.jumpEdge || gp.startEdge);
  const anyTouch = !!(touch.mx || touch.my || touch.shoot || touch.jumpEdge ||
    touch.slideEdge || touch.crouchHold || touchAimHeld);
  if (Math.abs(mouseDX) + Math.abs(mouseDY) > 0.5 || lmb || anyKey || anyPad || anyTouch) idleT = 0;
  else idleT += dt;

  mouseDX = 0; mouseDY = 0;

  // gamepad right stick = look (rate-based)
  if (gp.connected && !frozen) {
    const ls = 2.7 * sensFactor();
    PLAYER.yaw -= gp.rx * ls * dt;
    if (PLAYER.aiming) PLAYER.pitch = clamp(PLAYER.pitch - gp.ry * ls * dt, -1.45, 1.45);
    else PLAYER.camTilt = clamp(PLAYER.camTilt + gp.ry * ls * dt, -0.95, 0.55);
  }

  const fwd = tmpV.set(Math.sin(PLAYER.yaw), 0, Math.cos(PLAYER.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x); // screen-right for this convention
  const wish = new THREE.Vector3();
  if (!frozen) {
    if (keys.KeyW || keys.ArrowUp)    wish.add(fwd);
    if (keys.KeyS || keys.ArrowDown)  wish.sub(fwd);
    if (keys.KeyD || keys.ArrowRight) wish.add(right);
    if (keys.KeyA || keys.ArrowLeft)  wish.sub(right);
    if (gp.connected) {                 // gamepad left stick = move
      wish.addScaledVector(fwd, -gp.ly);
      wish.addScaledVector(right, gp.lx);
    }
    if (touch.mx || touch.my) {          // touch left-zone joystick = move
      wish.addScaledVector(fwd, -touch.my);
      wish.addScaledVector(right, touch.mx);
    }
  }
  if (wish.lengthSq() > 0) {
    wish.normalize();
    if (!timerRunning && state === 'playing' && level.introT <= 0) timerRunning = true;
  }

  // sprint / recharge system
  const wantSprint = keys.ShiftLeft || keys.ShiftRight || gp.lb || touch.sprint;
  const moving = wish.lengthSq() > 0;
  let speed = WALK;

  // crouch-walk — enter via slide-end (hold C) or hold C while stationary
  if (PLAYER.crouching && (PLAYER.sliding || !PLAYER.onGround)) PLAYER.crouching = false;

  // crouch from standing still: press C/L3 while stationary → immediate crouch (spammable)
  if (!PLAYER.sliding && !PLAYER.crouching && PLAYER.onGround && !moving && (keys.KeyC || gp.l3 || touch.crouchHold)) {
    PLAYER.crouching = true;
  }

  if (!PLAYER.sliding && PLAYER.crouching) {
    speed = CROUCH_SPEED;
    PLAYER.curHeight = CROUCH_HEIGHT;
    // stand up when the key/stick/button that initiated crouch is released
    if (!keys.KeyC && !gp.l3 && !touch.crouchHold) PLAYER.crouching = false;
    // TEABAG DANCE → bonus HEALTH peanut: 4 crouches within 4s while standing in a dance
    // spot's radius pops out an extra health peanut (gold off a NUTS box, diamond off a
    // boss X). Works at ANY health and even after the original pickup's been grabbed —
    // the spot persists. Fired from exactly one place; `used` latches it (never twice).
    if (!PLAYER._wasCrouching && PLAYER.onGround) {
      const spot = activeDanceSpot();
      if (spot) {
        // count is purely "4 crouches on this spot" — no 4-second window to race against;
        // it only resets if you leave the spot (handled below).
        if (PLAYER.danceSpot !== spot) { PLAYER.danceSpot = spot; PLAYER.danceCount = 0; }
        PLAYER.danceCount++;
        if (PLAYER.danceCount >= 4) {                   // four crouches → bonus health
          spot.used = true;
          PLAYER.danceCount = 0; PLAYER.danceSpot = null;
          // drop the bonus peanut directly ON the player so updatePickups grabs it the
          // very next frame (instant) — and with noGlow so it adds no PointLight (the old
          // float-out drop both lagged on the new light and could land out of reach).
          if (PLAYER.hp < MAX_HP) {
            const py = PLAYER.pos.y + PLAYER.curHeight * 0.6;
            level.pickups.push(makePickup(level.group, PLAYER.pos.x, py, PLAYER.pos.z, spot.type, { noGlow: true }));
          }
          toast(spot.type === 'diamond' ? 'DIAMOND DANCE!' : 'NUTTY BONUS!', 1400);
        }
      }
    }
  } else {
    if (!PLAYER.sliding) {
      // only stand up if there's headroom
      let blocked = false;
      for (const b of level.boxes) {
        if (PLAYER.pos.x + PLAYER.radius > b.min.x && PLAYER.pos.x - PLAYER.radius < b.max.x &&
            PLAYER.pos.z + PLAYER.radius > b.min.z && PLAYER.pos.z - PLAYER.radius < b.max.z &&
            PLAYER.pos.y + PLAYER.height > b.min.y && PLAYER.pos.y < b.max.y) { blocked = true; break; }
      }
      if (!blocked) PLAYER.curHeight = PLAYER.height;
    }
  }
  PLAYER._wasCrouching = PLAYER.crouching;

  // the crouch tally resets only if you step off the spot — no time limit (just 4 crouches)
  if (PLAYER.danceSpot && activeDanceSpot() !== PLAYER.danceSpot) {
    PLAYER.danceSpot = null; PLAYER.danceCount = 0;
  }

  // boost drains; sliding freezes; max health (10 peanuts) = unlimited hot grease
  const maxHealth = PLAYER.hp >= MAX_HP;
  if (maxHealth) {
    PLAYER.sprint = PLAYER.greaseMax;  // always topped up
    PLAYER.sprinting = false;
    if (wantSprint && moving) speed = SPRINT;  // still sprint-speed, no cost
  } else if (PLAYER.sliding) {
    // frozen: no drain, no recharge — preserves meter during sprint→slide
    PLAYER.sprinting = wantSprint && PLAYER.sprint > 0 && moving;
  } else {
    PLAYER.sprinting = wantSprint && PLAYER.sprint > 0 && moving;
    if (PLAYER.sprinting) {
      speed = SPRINT;
      PLAYER.sprint = Math.max(0, PLAYER.sprint - (PLAYER.greaseMax >= 250 && levelIndex >= 50 ? 16 : 24) * dt);
      PLAYER.calmT = 0;
    } else {
      PLAYER.calmT += dt;
      let target = (moving && !PLAYER.crouching) ? RECHARGE_WALK : RECHARGE_CALM;
      if (target > RECHARGE_WALK) target = lerp(RECHARGE_WALK, RECHARGE_CALM, clamp(PLAYER.calmT / RECHARGE_RAMP, 0, 1));
      PLAYER.rechargeMult = lerp(PLAYER.rechargeMult, target, clamp(5 * dt, 0, 1));
      PLAYER.sprint = Math.min(PLAYER.greaseMax, PLAYER.sprint + (PLAYER.onGround ? 17 : 9) * PLAYER.rechargeMult * dt);
    }
  }

  // ketchup slow zones
  for (const sz of level.slowZones) {
    const d = Math.hypot(PLAYER.pos.x - sz.x, PLAYER.pos.z - sz.z);
    if (d < sz.r && PLAYER.pos.y < 0.3) { speed *= 0.55; break; }
  }

  // slide — always full speed now; the meter freezes during the slide
  PLAYER.slideCD = Math.max(0, PLAYER.slideCD - dt);
  if ((cSlideEdge || gp.l3TapEdge || touch.slideEdge) && !PLAYER.sliding && PLAYER.onGround && PLAYER.slideCD <= 0 &&
      wish.lengthSq() > 0 && !frozen) {
    PLAYER.sliding = true;
    PLAYER.slideT = SLIDE_TIME;
    PLAYER.slideDir.copy(wish);
    PLAYER.slideCD = SLIDE_TIME + 0.35;
    PLAYER.crouching = false;
    PLAYER.calmT = 0;
    AudioFX.slide();
  }
  cSlideEdge = false; gp.l3TapEdge = false;

  if (PLAYER.sliding) {
    PLAYER.slideT -= dt;
    const k = clamp(PLAYER.slideT / SLIDE_TIME, 0, 1);
    const sp = lerp(WALK * 0.8, SLIDE_SPEED, k * k);
    PLAYER.move.copy(PLAYER.slideDir).multiplyScalar(sp);
    PLAYER.curHeight = SLIDE_HEIGHT;
    if (PLAYER.slideT <= 0) {
      // only stand up if there's headroom; if C/L3 still held, crouch instead
      let blocked = false;
      for (const b of level.boxes) {
        if (PLAYER.pos.x + PLAYER.radius > b.min.x && PLAYER.pos.x - PLAYER.radius < b.max.x &&
            PLAYER.pos.z + PLAYER.radius > b.min.z && PLAYER.pos.z - PLAYER.radius < b.max.z &&
            PLAYER.pos.y + PLAYER.height > b.min.y && PLAYER.pos.y < b.max.y) { blocked = true; break; }
      }
      if (!blocked) {
        PLAYER.sliding = false;
        if (keys.KeyC || gp.l3 || touch.crouchHold) {
          PLAYER.crouching = true;
          PLAYER.curHeight = CROUCH_HEIGHT;
        } else {
          PLAYER.curHeight = PLAYER.height;
        }
      } else {
        PLAYER.slideT = 0.1; // keep sliding until clear
      }
    }
  } else {
    const target = wish.multiplyScalar(speed);
    PLAYER.move.lerp(target, clamp((PLAYER.onGround ? 14 : 5) * dt, 0, 1));
  }

  // jump (slide-hop keeps the speed) — Space or gamepad A
  if ((keys.Space || gp.jumpEdge || touch.jumpEdge) && PLAYER.onGround && !frozen) {
    PLAYER.vel.y = JUMP_V;
    PLAYER.onGround = false;
    PLAYER.crouching = false;
    PLAYER.calmT = 0;
    if (PLAYER.sliding) { PLAYER.sliding = false; PLAYER.curHeight = PLAYER.height; }
    PLAYER.sprint = Math.max(0, PLAYER.sprint - JUMP_COST);
    AudioFX.jump();
    keys.Space = false; // require re-press
  }

  // knockback impulse decay
  PLAYER.vel.x = lerp(PLAYER.vel.x, 0, clamp(6 * dt, 0, 1));
  PLAYER.vel.z = lerp(PLAYER.vel.z, 0, clamp(6 * dt, 0, 1));
  PLAYER.vel.y += GRAV * dt;

  const total = new THREE.Vector3(
    PLAYER.move.x + PLAYER.vel.x, PLAYER.vel.y, PLAYER.move.z + PLAYER.vel.z);
  PLAYER.onGround = resolveEntity(PLAYER.pos, total, PLAYER.radius, PLAYER.curHeight, dt, level.boxes);
  PLAYER.vel.y = total.y;

  PLAYER.inv = Math.max(0, PLAYER.inv - dt);

  // shooting — works in both views; shoot() aims straight in first person and
  // uses crosshair aim-assist from the peanut in third (LMB / RT / touch hold)
  PLAYER.fireCD -= dt;
  if ((lmb || gp.rt || touch.shoot) && canPlay && PLAYER.fireCD <= 0) {
    PLAYER.fireCD = 0.085;
    shoot();
  }

  // reach the burger? — on boss levels it stays locked until the boss is down
  const bd = Math.hypot(PLAYER.pos.x - level.burgerPos.x, PLAYER.pos.z - level.burgerPos.z);
  const bossBlocking = (level.bosses && level.bosses.some(bz => bz.alive)) ||
                       (level.bossWave && level.bossWave.length > 0);   // rush: locked until all waves clear
  if (bd < 3.0 && !level.won) {
    if (bossBlocking) {
      level.lockWarnCD -= dt;
      if (level.lockWarnCD <= 0) { toast('BEAT THE BOSS FIRST!', 1200); level.lockWarnCD = 1.6; }
    } else if (bd < 2.6) {
      winLevel();
    }
  }

  touch.jumpEdge = false; touch.slideEdge = false;   // consume one-frame touch edges
}

/* ============================================================== camera */

// reusable scratch — the camera blends every frame, so avoid per-frame allocs
const UP = new THREE.Vector3(0, 1, 0);
const _fpPos = new THREE.Vector3();
const _tpTarget = new THREE.Vector3();
const _look = new THREE.Vector3();
const _tpCamPos = new THREE.Vector3();   // smoothed third-person follow position
const _mtx = new THREE.Matrix4();
const _eu = new THREE.Euler(0, 0, 0, 'YXZ');
const _fpQuat = new THREE.Quaternion();
const _tpQuat = new THREE.Quaternion();
const _orbitPos = new THREE.Vector3();
const _orbitQuat = new THREE.Quaternion();
const fwCamFrom = new THREE.Vector3();    // camera pose captured the instant fireworks begin
const fwQuatFrom = new THREE.Quaternion();

// third-person spring-arm boom + idle attract-camera state
let _tpBoomLen = 9;            // smoothed boom length (shortens off walls/floor)
let idleT = 0, idleBlend = 0;  // seconds idle / 0..1 swoop into the attract cam
let idleAng = 0, idleDir = 1, idleSpeed = 0, idleCycleT = 0, stareAmt = 0, idleFov = 70;
const IDLE_DELAY = 30, IDLE_R = 3.7, IDLE_H = 1.75, GROUND_CLEAR = 0.3;
const ORBIT_DUR = 11, STARE_DUR = 5;
const _moonDir = moonDir;   // same direction the shadow light comes from (tracks boss flips)
const _pivot = new THREE.Vector3(), _boomDir = new THREE.Vector3();
const _idlePos = new THREE.Vector3(), _idleQuat = new THREE.Quaternion();
const _ctrlPos = new THREE.Vector3(), _ctrlQuat = new THREE.Quaternion();

// nearest ray→AABB hit distance along a unit dir within maxT (Infinity if none)
function rayBoxes(ox, oy, oz, dx, dy, dz, maxT, boxes) {
  let best = Infinity;
  const ix = 1 / (dx || 1e-9), iy = 1 / (dy || 1e-9), iz = 1 / (dz || 1e-9);
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    let t1 = (b.min.x - ox) * ix, t2 = (b.max.x - ox) * ix;
    let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
    t1 = (b.min.y - oy) * iy; t2 = (b.max.y - oy) * iy;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (b.min.z - oz) * iz; t2 = (b.max.z - oz) * iz;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    if (tmax >= Math.max(0, tmin) && tmax > 0 && tmin <= maxT && tmin < best) best = Math.max(0, tmin);
  }
  return best;
}
function pointInBoxes(x, y, z, m, boxes) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (x > b.min.x - m && x < b.max.x + m && y > b.min.y - m && y < b.max.y + m &&
        z > b.min.z - m && z < b.max.z + m) return true;
  }
  return false;
}
// idle orbit clip test: candidate camera inside a wall, or a wall between it and the peanut
function cameraBlocked(from, to) {
  if (!level || !level.boxes) return false;
  if (pointInBoxes(to.x, to.y, to.z, 0.3, level.boxes)) return true;
  const hx = from.x, hy = from.y + 0.9, hz = from.z;
  const dx = to.x - hx, dy = to.y - hy, dz = to.z - hz;
  const len = Math.hypot(dx, dy, dz) || 1;
  return rayBoxes(hx, hy, hz, dx / len, dy / len, dz / len, len - 0.2, level.boxes) < len - 0.2;
}

// idle attract camera: close orbit (full loops when clear, pendulum-reverse at walls),
// periodically tilting up to frame the moon. Fills _idlePos / _idleQuat / idleFov.
function updateIdlePose(dt, time, p) {
  idleCycleT += dt;
  const stareTarget = (idleCycleT % (ORBIT_DUR + STARE_DUR)) > ORBIT_DUR ? 1 : 0;
  stareAmt = lerp(stareAmt, stareTarget, clamp(1.8 * dt, 0, 1));

  // orbit advance (frozen during the stare); reverse with a slowed halt/resume at walls
  const step = idleDir * 0.42 * idleSpeed * (1 - stareAmt) * dt;
  _idlePos.set(p.x + Math.sin(idleAng + step) * IDLE_R, p.y + IDLE_H, p.z + Math.cos(idleAng + step) * IDLE_R);
  if (cameraBlocked(p, _idlePos)) {
    idleSpeed = Math.max(0, idleSpeed - dt / 0.35);     // brief slowed halt
    if (idleSpeed <= 0.001) idleDir = -idleDir;         // then double back the other way
  } else {
    idleAng += step;
    idleSpeed = Math.min(1, idleSpeed + dt / 0.5);      // slowed resume
  }
  _idlePos.set(p.x + Math.sin(idleAng) * IDLE_R, p.y + IDLE_H, p.z + Math.cos(idleAng) * IDLE_R);

  // look at the peanut, tilting up toward the moon during the stare (peanut sinks low)
  const s2 = stareAmt * 0.72;
  _look.set(
    lerp(p.x, _idlePos.x + _moonDir.x * 60, s2),
    lerp(p.y + 0.95, _idlePos.y + _moonDir.y * 60, s2),
    lerp(p.z, _idlePos.z + _moonDir.z * 60, s2));
  _mtx.lookAt(_idlePos, _look, UP);
  _idleQuat.setFromRotationMatrix(_mtx);
  idleFov = lerp(60, 82, stareAmt);
}

function updateCamera(dt, time) {
  const p = PLAYER.pos;
  const fwd = tmpV.set(Math.sin(PLAYER.yaw), 0, Math.cos(PLAYER.yaw));

  // smoothed view height (eases the slide/crouch dip instead of snapping)
  PLAYER.viewHeight = lerp(PLAYER.viewHeight, PLAYER.curHeight, clamp(13 * dt, 0, 1));

  // locomotion bob phase — advanced every frame so it drives both the FP
  // head-bob and the TP sprite bob regardless of which view is showing
  const moving = PLAYER.move.length() > 1 && PLAYER.onGround && !PLAYER.sliding;
  if (moving) PLAYER.bobT += dt * PLAYER.move.length() * 1.4;

  let b;                         // first-person blend amount (0 in TP / fireworks / pan)

  // --- always compute the FP + TP desired poses (cheap; both 360s hand off to TP) ---
  const headbob = moving ? Math.sin(PLAYER.bobT * 2) * 0.05 : 0;
  _fpPos.set(p.x, p.y + PLAYER.viewHeight - 0.18 + headbob, p.z);
  _eu.set(PLAYER.pitch, PLAYER.yaw + Math.PI, 0);
  _fpQuat.setFromEuler(_eu);
  const fpFov = PLAYER.sprinting ? 80 : 68;
  // ---- third-person boom: orbit pitch from camTilt, spring-armed off walls & floor ----
  const tpPitch = PLAYER.camTilt;                         // + (look down) high crane, - (look up) low/sky
  _pivot.set(p.x, p.y + 1.05, p.z);
  const elevAng = clamp(0.8 + tpPitch, -0.22, 1.4);       // camera elevation above the pivot
  // boom direction (already unit: fwd is unit horizontal, cos²+sin²=1)
  _boomDir.set(-fwd.x * Math.cos(elevAng), Math.sin(elevAng), -fwd.z * Math.cos(elevAng));
  const BOOM = 9.0;
  let maxLen = BOOM;
  // wall: shorten so the lens never pushes through geometry
  const wallHit = rayBoxes(_pivot.x, _pivot.y, _pivot.z, _boomDir.x, _boomDir.y, _boomDir.z, BOOM + 0.5, level.boxes);
  if (wallHit < maxLen + 0.5) maxLen = Math.max(1.4, wallHit - 0.5);
  // floor: when aiming up the boom dips below the street — zoom in off floor contact
  if (_boomDir.y < -1e-4) {
    const floorLen = (_pivot.y - GROUND_CLEAR) / -_boomDir.y;
    if (floorLen < maxLen) maxLen = Math.max(1.4, floorLen);
  }
  // smooth the boom: snap in fast (never clip), ease out slow (no pop) — also keeps it
  // steady as it slides across walls whose height changes underneath it
  if (!camInit) _tpBoomLen = maxLen;
  else _tpBoomLen = lerp(_tpBoomLen, maxLen, clamp((maxLen < _tpBoomLen ? 26 : 5) * dt, 0, 1));
  _tpTarget.copy(_pivot).addScaledVector(_boomDir, _tpBoomLen);
  // look target climbs into the sky as you aim up, so TP aim can reach high
  const lookAhead = lerp(7, 2.6, clamp(elevAng / 1.4, 0, 1));
  const lookRise = clamp(-tpPitch, 0, 1.1) * 13;
  _look.set(p.x + fwd.x * lookAhead, p.y + 0.95 + lookRise, p.z + fwd.z * lookAhead);
  if (!camInit) { _tpCamPos.copy(_tpTarget); PLAYER.viewHeight = PLAYER.curHeight; camInit = true; }
  else _tpCamPos.lerp(_tpTarget, clamp(12 * dt, 0, 1));
  _mtx.lookAt(_tpCamPos, _look, UP);
  _tpQuat.setFromRotationMatrix(_mtx);
  const tpFov = PLAYER.sprinting ? 82 : 72;

  if (state === 'fireworks') {
    // ---- 360 outro crane: sweep around the hero, craning up to reveal fireworks ----
    const ang = (PLAYER.yaw + Math.PI) + fwTimer * 1.3;
    const R = lerp(6, 11.5, clamp(fwTimer / 3.2, 0, 1));
    const Hh = lerp(2.4, 7.4, clamp(fwTimer / 5, 0, 1));
    _orbitPos.set(p.x + Math.sin(ang) * R, p.y + Hh, p.z + Math.cos(ang) * R);
    _look.set(p.x, p.y + lerp(1.1, 3.2, clamp(fwTimer / 5, 0, 1)), p.z);
    _mtx.lookAt(_orbitPos, _look, UP); _orbitQuat.setFromRotationMatrix(_mtx);
    const k = clamp(fwTimer / 0.7, 0, 1), ks = k * k * (3 - 2 * k);
    camera.position.copy(fwCamFrom).lerp(_orbitPos, ks);
    camera.quaternion.copy(fwQuatFrom).slerp(_orbitQuat, ks);
    camera.fov = lerp(camera.fov, 76, clamp(4 * dt, 0, 1));
    b = 0;
  } else if (level && level.panT > 0) {
    // ---- 360 intro pan: orbit the hero once, then hand off into the TP follow so
    //      control begins seamlessly (which then blends to first person) ----
    const u = 1 - level.panT / PAN_DUR;
    const ang = (PLAYER.yaw + Math.PI) + u * Math.PI * 2;   // full turn, ends behind
    const R = lerp(7.6, 6.4, u), Hh = lerp(2.8, 5.4, u);
    _orbitPos.set(p.x + Math.sin(ang) * R, p.y + Hh, p.z + Math.cos(ang) * R);
    _look.set(p.x, p.y + 1.2, p.z);
    _mtx.lookAt(_orbitPos, _look, UP); _orbitQuat.setFromRotationMatrix(_mtx);
    const h = clamp((0.7 - level.panT) / 0.7, 0, 1), hs = h * h * (3 - 2 * h);
    camera.position.copy(_orbitPos).lerp(_tpCamPos, hs);
    camera.quaternion.copy(_orbitQuat).slerp(_tpQuat, hs);
    camera.fov = lerp(camera.fov, 70, clamp(5 * dt, 0, 1));
    b = 0;
  } else {
    // ---- first-person (default) blended with the third-person follow ----
    const blendTarget = saveData.cam === 'third' ? 0 : 1;  // first by default
    PLAYER.camBlend += (blendTarget - PLAYER.camBlend) * clamp(6 * dt, 0, 1);
    if (Math.abs(PLAYER.camBlend - blendTarget) < 0.0015) PLAYER.camBlend = blendTarget;
    b = PLAYER.camBlend * PLAYER.camBlend * (3 - 2 * PLAYER.camBlend); // smoothstep
    _ctrlPos.copy(_tpCamPos).lerp(_fpPos, b);
    _ctrlQuat.copy(_tpQuat).slerp(_fpQuat, b);
    let tgtFov = lerp(tpFov, fpFov, b);

    // ---- idle attract camera: after 30s of no input, swoop into a close moon-gazing 360 ----
    const idleOn = state === 'playing' && level.panT <= 0 && level.introT <= 0 &&
      idleT >= (TEST ? 3 : IDLE_DELAY);
    if (idleOn && idleBlend < 0.01) {             // rising edge: seed orbit where the camera is
      idleAng = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
      idleDir = 1; idleSpeed = 0; idleCycleT = 0; stareAmt = 0;
    }
    idleBlend += ((idleOn ? 1 : 0) - idleBlend) * clamp(2.6 * dt, 0, 1);
    if (idleBlend > 0.001) {
      updateIdlePose(dt, time, p);
      const s = idleBlend * idleBlend * (3 - 2 * idleBlend);   // smooth swoop in/out
      camera.position.copy(_ctrlPos).lerp(_idlePos, s);
      camera.quaternion.copy(_ctrlQuat).slerp(_idleQuat, s);
      tgtFov = lerp(tgtFov, idleFov, s);
    } else {
      camera.position.copy(_ctrlPos);
      camera.quaternion.copy(_ctrlQuat);
    }
    camera.fov = lerp(camera.fov, tgtFov, clamp(10 * dt, 0, 1));
  }
  camera.updateProjectionMatrix();

  // skybox stays centred on the camera so it's always infinitely far away
  sky.position.copy(camera.position);

  // player sprite: body always visible, face composited on top at faceVis opacity
  const idleS = idleBlend * idleBlend * (3 - 2 * idleBlend);
  const sproutFade = clamp(1 - (b - 0.55) / 0.35, 0, 1);
  const showFade = Math.max(sproutFade, idleS);   // keep the peanut visible while idle-gazing
  playerGroup.visible = showFade > 0.01;
  playerGroup.position.copy(p);
  if (playerSprite && playerGroup.visible) {
    const cinematic = state === 'fireworks' || (level && level.panT > 0);
    if (cinematic) {
      playerSprite.position.y = 0.88 + Math.abs(Math.sin(time * 4)) * 0.42;
      playerSprite.material.rotation = Math.sin(time * 3) * 0.13;
    } else if (idleS > 0.02 && !PLAYER.sliding && !PLAYER.crouching) {
      // idle head-bob — bigger during the moon-stare than the orbit
      const amp = lerp(0.12, 0.34, stareAmt);
      const k = clamp(10 * dt, 0, 1);
      playerSprite.position.y = lerp(playerSprite.position.y, 0.88 + Math.abs(Math.sin(time * 3.1)) * amp, k);
      playerSprite.material.rotation = lerp(playerSprite.material.rotation, Math.sin(time * 2.3) * 0.06 * (amp / 0.34), k);
    } else {
      const bob = moving ? Math.abs(Math.sin(PLAYER.bobT)) * 0.16 : 0;
      if (PLAYER.sliding) {
        playerSprite.material.rotation = lerp(playerSprite.material.rotation, -1.15, clamp(14 * dt, 0, 1));
        playerSprite.position.y = lerp(playerSprite.position.y, 0.52, clamp(14 * dt, 0, 1));
      } else if (PLAYER.crouching) {
        playerSprite.material.rotation = lerp(playerSprite.material.rotation, 0, clamp(14 * dt, 0, 1));
        playerSprite.position.y = lerp(playerSprite.position.y, 0.58, clamp(14 * dt, 0, 1));
      } else {
        playerSprite.material.rotation = lerp(playerSprite.material.rotation, 0, clamp(14 * dt, 0, 1));
        playerSprite.position.y = lerp(playerSprite.position.y, 0.88 + bob, clamp(18 * dt, 0, 1));
      }
    }
    const blink = PLAYER.inv > 0 ? (Math.sin(time * 30) > 0 ? 0.25 : 1) : 1;
    playerSprite.material.opacity = blink * showFade;

    // dynamic ground shadow (3rd person): shrinks/fades with jump height, spreads
    // during slides/crouches, and slices onto obstacle tops you climb on/off
    if (playerBlob) {
      const topBox = (level && level.boxes) ? shadowTopBox(p.x, p.z, PLAYER.pos.y, 0.42, level.boxes) : null;
      // the step directly beneath the one you're on (a car's hood under its roof, the
      // car body under the cabin, a shorter crate, …) so the slice cascades down it
      // instead of dropping straight to the floor.
      const midBox = topBox ? shadowSecondBox(p.x, p.z, 0.42, level.boxes, topBox) : null;
      const surfaceY = topBox ? topBox.max.y : 0;   // surface the shadow falls on
      const hAir = Math.max(0, PLAYER.pos.y - surfaceY);
      let tSc = clamp(1 - hAir * 0.16, 0.5, 1.05);
      let tOp = clamp(0.42 - hAir * 0.06, 0.18, 0.46);   // keep a faint disc even at jump apex
      if (PLAYER.sliding) { tSc *= 1.35; tOp = 0.52; }
      else if (PLAYER.crouching) { tSc *= 1.15; tOp = 0.48; }
      const ks = clamp(12 * dt, 0, 1);
      // ground layer: always on the floor — shows only the part of the slice that
      // hangs OFF every step. The cut-out is the LOWEST step present (a car's body,
      // with its open wheel gap), so no floor shadow peeks through under it; the top
      // and middle layers draw the parts sitting on the steps.
      const floorCut = midBox || topBox;
      playerBlob.position.y = 0.035 - PLAYER.pos.y;
      playerBlob.scale.x = lerp(playerBlob.scale.x, tSc, ks);
      playerBlob.scale.y = lerp(playerBlob.scale.y, tSc, ks);
      playerBlob.material.opacity = lerp(playerBlob.material.opacity, tOp, ks);
      if (floorCut) setOuterClipToBox(playerBlob.material.clippingPlanes, floorCut);
      else clearOuterClip(playerBlob.material.clippingPlanes);
      // top layer: the slice sitting on the step you're standing on, clipped to its footprint
      if (playerBlobTop) {
        if (topBox) {
          setClipToBox(playerBlobTop.material.clippingPlanes, topBox);
          playerBlobTop.position.y = topBox.max.y + 0.025 - PLAYER.pos.y;
          playerBlobTop.scale.copy(playerBlob.scale);
          playerBlobTop.material.opacity = playerBlob.material.opacity;
          playerBlobTop.visible = true;
        } else {
          playerBlobTop.visible = false;
        }
      }
      // middle layer: the slice that spills off the top step onto the step below it
      // (roof → hood/bed), clipped to the lower step's footprint. The upper step's
      // solid body naturally hides the part tucked under it, so no extra outer-clip
      // is needed against the top footprint.
      if (playerBlobMid) {
        if (midBox) {
          setClipToBox(playerBlobMid.material.clippingPlanes, midBox);
          playerBlobMid.position.y = midBox.max.y + 0.025 - PLAYER.pos.y;
          playerBlobMid.scale.copy(playerBlob.scale);
          playerBlobMid.material.opacity = playerBlob.material.opacity;
          playerBlobMid.visible = true;
        } else {
          playerBlobMid.visible = false;
        }
      }
    }
    // faceVis: horizontal foreshorten of the composited face — full when the
    // camera is dead-ahead, narrowing to nothing by the time we're side-on.
    const camDir = new THREE.Vector3().subVectors(camera.position, p).setY(0).normalize();
    const pFwd = new THREE.Vector3(Math.sin(PLAYER.yaw), 0, Math.cos(PLAYER.yaw));
    const facing = camDir.dot(pFwd);
    const faceVis = clamp(facing + 0.12, 0, 1);
    // which rim it wraps off toward: the screen-x the face normal leans to.
    // camRight = (camDir.z, 0, -camDir.x); sign of pFwd·camRight picks the side.
    const wipeDir = (pFwd.x * camDir.z - pFwd.z * camDir.x) >= 0 ? 1 : -1;
    updatePlayerFaceComposite(faceVis, wipeDir);
  }

  // crosshair: shown whenever you can shoot — but on touch only while the
  // screen is held to aim & fire, so it appears/disappears with the hold
  const aimReady = state === 'playing' && level && level.panT <= 0 && level.introT <= 0;
  ui.crosshair.classList.toggle('on', aimReady && (inputMode !== 'touch' || touchAimHeld));

  // moonlight follows the player: keep the light SUN_DIST away in the moon's
  // direction and aimed at the player so shadows always cast straight from the moon
  sun.position.set(p.x + moonDir.x * SUN_DIST, moonDir.y * SUN_DIST, p.z + moonDir.z * SUN_DIST);
  sun.target.position.set(p.x, 0, p.z);
}

/* ================================================================ loop */

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  pollGamepad();
  // gamepad Start pauses during play
  if (state === 'playing' && gp.startEdge) { try { document.exitPointerLock?.(); } catch (_) {} AudioFX.init(); AudioFX.fireBounce(400); setState('paused'); }
  else if (state === 'paused' && (gp.startEdge || gp.bEdge)) resumeFromPause();   // Start OR B closes the pause menu
  if (gp.selectEdge) setCamView(saveData.cam === 'first' ? 'third' : 'first');
  updateMenuCursor(dt);

  // show the on-screen touch controls only while playing on a touch device
  if (touchRoot) touchRoot.classList.toggle('on', inputMode === 'touch' && (state === 'playing' || state === 'fireworks'));

  // twinkling stars
  for (const tw of twinkles) {
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 3.2 + tw.userData.phase));
    tw.material.opacity = a;
    tw.scale.setScalar(4 + a * 3.5);
  }

  if (state === 'playing' || state === 'fireworks') {
    // burger idle animation
    if (level) {
      level.frameT += dt;
      if (level.frameT > 0.09) {
        level.frameT = 0;
        level.frame = (level.frame + 1) % burgerFrames.length;
        level.burger.material.map = burgerFrames[level.frame];
      }
      if (!level.won) level.burger.position.y = 2.7 + Math.sin(time * 1.8) * 0.25;
      level.ring.rotation.z = time * 0.8;
      level.ring.scale.setScalar(1 + Math.sin(time * 3) * 0.06);
    }

    if (state === 'playing') {
      // the debug terminal freezes the sim (still renders) so the idle player isn't killed
      if (!debugOpen) {
        if (level.panT > 0) level.panT -= dt;
        else if (level.introT > 0) level.introT -= dt;
        if (timerRunning) {
          levelTime += dt;
          ui.timertext.textContent = fmtTime(levelTime * 1000);
        }
        updatePlayer(dt);
        updateEnemies(dt, time);
        updatePickups(dt, time);
        updateProjectiles(dt);
      }

      // sprint UI — bar scales wider with capacity; fill shows % of current max
      const barScale = PLAYER.greaseMax / 115;  // base=1x, caps at ~2.17x (250/115)
      ui.sprintwrap.style.width = Math.min(380 * barScale, window.innerWidth * 0.4) + 'px';
      ui.sprintfill.style.width = `${(PLAYER.sprint / PLAYER.greaseMax) * 100}%`;
      ui.sprintfill.classList.toggle('low', PLAYER.sprint < 30);
      const maxHP = PLAYER.hp >= MAX_HP;
      ui.sprintwrap.classList.toggle('maxgrease', maxHP || PLAYER.greaseMax >= 250);
      ui.sprintlabel.textContent = maxHP ? 'HOT GREASE!' : 'GREASE METER';

      // hot-grease specks rising through the bar at full health
      if (maxHP) {
        speckSpawnCD -= dt;
        if (speckSpawnCD <= 0) {
          speckSpawnCD = 0.04 + Math.random() * 0.06;
          const speck = document.createElement('div');
          speck.className = 'grease-speck';
          speck.style.left = (10 + Math.random() * 75) + '%';
          speck.style.bottom = '0';
          speck.style.width = speck.style.height = (2 + Math.random() * 3) + 'px';
          speck.style.animationDuration = (0.5 + Math.random() * 0.7) + 's';
          ui.sprintfill.appendChild(speck);
          greaseSpecks.push({ el: speck, life: 0.6 + Math.random() * 0.5 });
        }
      } else {
        // remove all specks when health drops
        for (const s of greaseSpecks) s.el.remove();
        greaseSpecks.length = 0;
        speckSpawnCD = 0;
      }
      // age and remove finished specks
      for (let i = greaseSpecks.length - 1; i >= 0; i--) {
        greaseSpecks[i].life -= dt;
        if (greaseSpecks[i].life <= 0) {
          greaseSpecks[i].el.remove();
          greaseSpecks.splice(i, 1);
        }
      }
    } else {
      updateFireworks(dt);
    }
    updateCamera(dt, time);
  }

  updateParticles(dt);
  renderer.render(scene, camera);
}

/* ================================================================ boot */

loadAssets().then(() => {
  buildPlayer();
  if (ui.loadnote) ui.loadnote.style.display = 'none';
  refreshMenuScores();
  buildSensRow();
  buildVolRow();
  refreshControlsUI();
  updateViewSeg();
  updateCamSeg();
  // show READY button on splash; any key/gamepad input = click
  ui.readybtn.style.display = 'inline-block';
  const dots = ui.loadsplash.querySelector('.dots');
  if (dots) dots.style.display = 'none';
  let _splashDone = false;
  function startFromSplash() {
    if (_splashDone) return;
    _splashDone = true;
    clearInterval(splashPad);
    document.removeEventListener('keydown', splashKey);
    AudioFX.init();
    AudioFX.fireBounce();
    ui.loadsplash.classList.remove('on');
    setState('menu');
    tick();
    if (TEST) {
      const qs = new URLSearchParams(location.search);
      if (qs.has('gloves')) {
        [GLOVE_URL, GLOVE_HOVER_URL, GLOVE_PRESS_URL].forEach((u, i) => {
          const d = document.createElement('img'); d.src = u;
          d.style.cssText = `position:fixed;top:40%;left:${20 + i * 28}%;width:120px;background:#333;z-index:99;image-rendering:pixelated;`;
          document.body.appendChild(d);
        });
        return;
      }
      if (qs.has('touch')) setInputMode('touch');   // force mobile layout for testing
      if (qs.get('screen') === 'menu') return;       // stay on main menu for screenshots
      if (qs.get('screen') === 'pause') { startRun(1); setState('paused'); return; }
      if (qs.get('screen') === 'dead') { startRun(1); setState('dead'); return; }
      const lv = parseInt(qs.get('level'), 10);
      startRun(lv > 0 ? lv : 1);
      const hp = parseInt(qs.get('hp'), 10);
      if (hp > 0) { PLAYER.hp = clamp(hp, 1, MAX_HP); updateHearts(); }
      if (qs.get('screen') === 'complete') { runLevels = 3; kills = 17; levelTime = 42.318; showComplete(); }
      if (qs.has('win')) winLevel();
    }
  }
  ui.readybtn.addEventListener('pointerdown', startFromSplash, { once: true });
  ui.readybtn.addEventListener('touchstart', e => { e.preventDefault(); startFromSplash(); }, { once: true });
  // Enter / Space / any gamepad button = READY
  function splashKey(e) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      startFromSplash();
    }
  }
  document.addEventListener('keydown', splashKey);
  // headless screenshots can't press READY — ?test&auto skips the splash
  if (TEST && new URLSearchParams(location.search).has('auto')) setTimeout(startFromSplash, 50);
  const splashPad = setInterval(() => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.buttons) {
        for (let i = 0; i < p.buttons.length; i++) {
          if (p.buttons[i] && p.buttons[i].pressed) { startFromSplash(); return; }
        }
      }
    }
  }, 200);
}).catch(err => {
  ui.loadsplash.querySelector('.title').textContent = 'ASSET LOAD FAILED — serve over http';
  console.error(err);
});
