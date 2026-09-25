// =====================================================================
//  SPA QUIZ TEMPLATES – shared engine for: cryptisch | code | klinkers | tweewoorden
//  Choose with ?q=<key>. Only edit the entries in QUIZZES.
// =====================================================================
const THEMES = {
  butter: { bg: ['#FBE39A', '#FCEBB8', '#FDF3D9', '#FFFAEE'], glow: 'rgba(255,255,255,.65)', floor: [250, 236, 196],
            shadow: 0x7a5a10, ground: 0xe8d39a, text: '#5B3A06', textShadow: '0 3px 14px rgba(255,255,255,.55)', ink: '#5B3A06', ink2: '#8A6420' },
  mint:   { bg: ['#8FE6C4', '#A3E9D3', '#AEDCF2', '#9CCFF6'], glow: 'rgba(235,255,250,.6)', floor: [178, 228, 236],
            shadow: 0x1d5566, ground: 0x9fd3d8, text: '#FFFFFF', textShadow: '0 4px 18px rgba(10,70,90,.40)', ink: '#0E4A5E', ink2: '#2F7185' },
  candy:  { bg: ['#FFB3CF', '#FFBCC8', '#FFB9AE', '#FF9E8C'], glow: 'rgba(255,240,245,.6)', floor: [255, 196, 196],
            shadow: 0x8a2c3c, ground: 0xf2a9a9, text: '#FFFFFF', textShadow: '0 4px 18px rgba(150,40,60,.40)', ink: '#7A1E3A', ink2: '#A8475E' }
};
const CONFIG = Object.assign({ cta1: 'Heb jij het goed geraden?', cta2: 'Volg voor de volgende puzzel!' }, await (await fetch('quiz.json', { cache: 'no-store' })).json());
const TH = THEMES[CONFIG.theme];
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1080, H = 1920;
const $ = id => document.getElementById(id);

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, s, d) => clamp((t - s) / d);
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const fade = (t, inS, inD, outS = 1e9, outD = 0.3) => Math.min(easeOut(prog(t, inS, inD)), 1 - easeOut(prog(t, outS, outD)));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- timeline (seconds, scene 2 starts at 0) ----------
const T = {
  rowStart: r => 0.3 + r * 0.35,
  timerStart: 2.6, timerEnd: 12.6,
  hintOut: 7.6, hintTextIn: 8.0, hintTextOut: 10.3, pyrBack: 10.5,
  timeUpIn: 12.7, timeUpOut: 13.7,
  reveal: 13.9, celeb: 16.3, answerIn: 17.0, titleOut: 17.6,
  spin: 18.6, ctaIn: 21.4, end: 25.0
};
window.DURATION = T.end;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
const LOOK = new THREE.Vector3(0, 0.1, -0.8);

scene.add(new THREE.HemisphereLight(0xffffff, TH.ground, 1.35));
const key = new THREE.DirectionalLight(0xffffff, 2.3);
key.position.set(-5.5, 9, 8);
key.castShadow = true;
key.shadow.mapSize.set(1536, 1536);
key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 8; key.shadow.camera.bottom = -3;
key.shadow.camera.near = 1; key.shadow.camera.far = 30;
key.shadow.radius = 6; key.shadow.bias = -0.0008;
scene.add(key);
const fill = new THREE.DirectionalLight(0xd6f3ff, 0.55); fill.position.set(6, 3, 6); scene.add(fill);

// ---------- textures ----------
function woodTexture(seed, top = false) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); const r = rng(seed);
  g.fillStyle = top ? '#FACB2E' : '#F7C21B'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const y = r() * 512, a = 0.03 + r() * 0.07, w = 1 + r() * 3;
    g.strokeStyle = r() < .5 ? `rgba(190,120,0,${a})` : `rgba(255,240,170,${a})`;
    g.lineWidth = w; g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 70 + i) * 5 * r());
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function letterTexture(ch, color) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = "800 360px Pop";
  let m = g.measureText(ch);
  if (m.width > 400) { g.font = `800 ${Math.floor(360 * 400 / m.width)}px Pop`; m = g.measureText(ch); }
  const hgt = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  // optically centre each glyph (x-height letters, ascender letters, '?')
  g.fillText(ch, 256, 256 + hgt / 2 - m.actualBoundingBoxDescent);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
async function emojiTexture(code) {
  const img = new Image(); img.src = `node_modules/@twemoji/svg/${code}.svg`; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = 256;
  c.getContext('2d').drawImage(img, 8, 8, 240, 240);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- build blocks ----------
const NA = CONFIG.answer.length;
const S = Math.min(0.88, (NA >= 8 ? 5.0 : 5.4) / NA);
const geo = new RoundedBoxGeometry(S * 0.985, S * 0.985, S * 0.985, 5, 0.075 * S);
const letterGeo = new THREE.PlaneGeometry(0.86 * S, 0.86 * S);
const mirror = new THREE.Group(); mirror.scale.y = -1; scene.add(mirror);
function makeBlock(ch, seed, color, alt) {
  const side = new THREE.MeshStandardMaterial({ map: woodTexture(seed), roughness: 0.62, metalness: 0, transparent: true });
  const topm = new THREE.MeshStandardMaterial({ map: woodTexture(seed + 99, true), roughness: 0.55, metalness: 0, transparent: true });
  const mesh = new THREE.Mesh(geo, [side, side, topm, side, side, side]);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const mkFace = () => { const m = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
    const f = new THREE.Mesh(letterGeo, m); f.position.z = S * 0.4935 + 0.002; mesh.add(f); return f; };
  const face = mkFace(), face2 = alt ? mkFace() : null;
  if (face2) face2.material.opacity = 0;
  scene.add(mesh);
  const m2 = mesh.clone(true); mirror.add(m2);
  return { mesh, m2, mats: [side, topm], face, face2, ch, color, alt };
}
const Q = '#9C84B8', INK = '#111111';
const SLOTS = [], BACK = [];
const slotZ = 0.9;
if (CONFIG.mode === 'vowels') {
  CONFIG.pattern.forEach((ch, j) => { const q = ch === '?';
    const b = makeBlock(ch, 400 + j * 23, q ? Q : INK, q ? CONFIG.answer[j] : null); b.q = q;
    b.home = new THREE.Vector3((j - (NA - 1) / 2) * S, S / 2, slotZ); SLOTS.push(b); });
} else {
  CONFIG.answer.forEach((ch, j) => {
    const b = makeBlock('?', 400 + j * 23, Q, CONFIG.mode === 'clue' ? ch : null); b.q = true;
    b.home = new THREE.Vector3((j - (NA - 1) / 2) * S, S / 2, slotZ); SLOTS.push(b); });
}
if (CONFIG.mode === 'code') {
  CONFIG.codes.forEach((c, i) => {
    const b = makeBlock(c, 31 + i * 17, INK, CONFIG.answer[i]);
    b.home = new THREE.Vector3((i - (NA - 1) / 2) * S * 1.3, S / 2, -5.0); BACK.push(b); });
}
const SHOWN = SLOTS.map(b => b.q);       // which slot blocks get filled at the reveal
const FILL = []; SLOTS.forEach((b, j) => { if (b.q) FILL.push(j); });
const fillStart = j => T.reveal + 0.5 + FILL.indexOf(j) * 0.3;

const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.26, color: TH.shadow }));
shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = 0.004; shadowFloor.receiveShadow = true; shadowFloor.renderOrder = 3; shadowFloor.material.depthWrite = false; scene.add(shadowFloor);
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, `rgba(${TH.floor.join(',')},0)`);     // far (horizon) -> transparent, blends into wall
  gr.addColorStop(0.30, `rgba(${TH.floor.join(',')},0.86)`);
  gr.addColorStop(0.55, `rgba(${TH.floor.join(',')},0.93)`);
  gr.addColorStop(1, `rgba(${TH.floor.join(',')},0.97)`);  // near
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  cover.rotation.x = -Math.PI / 2; cover.position.set(0, 0.002, 8); cover.renderOrder = 2; scene.add(cover);
}

// ---------- confetti ----------
const confetti = new THREE.Group(); scene.add(confetti);
const COLORS = [0xF7C21B, 0xFF5FA2, 0x9B5DE5, 0xffffff, 0x3BD18A, 0xFF9F1C, 0x5BC0EB];
const pieces = [];
{
  const r = rng(777);
  const pg = new THREE.PlaneGeometry(0.11, 0.2);
  for (let k = 0; k < 220; k++) {
    const side = k % 2 ? 1 : -1;
    const m = new THREE.MeshStandardMaterial({ color: COLORS[k % COLORS.length], side: THREE.DoubleSide, roughness: .5, transparent: true });
    const p = new THREE.Mesh(pg, m); p.visible = false; confetti.add(p);
    pieces.push({ p, side, delay: r() * 0.55, x0: side * (2.3 + r() * .5), y0: -1.6 + r() * .4, z0: -1.2 + r() * 3.6,
      vx: -side * (0.6 + r() * 2.4), vy: 9 + r() * 5, vz: -1.2 + r() * 2.6,
      rx: (r() - .5) * 18, ry: (r() - .5) * 18, rz: (r() - .5) * 14, s: 0.8 + r() * 0.7 });
  }
}
const emojis = []; const sparkles = [];
async function buildEmoji() {
  const codes = ['1f389', '1f38a', '2728', '2b50'];
  const texs = await Promise.all(codes.map(emojiTexture));
  const r = rng(4242);
  for (let k = 0; k < 26; k++) {
    const side = k % 2 ? 1 : -1;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texs[k % 4], transparent: true }));
    sp.visible = false; confetti.add(sp);
    emojis.push({ sp, side, delay: r() * 0.5, x0: side * (2.4 + r() * .4), y0: -1.5, z0: -0.8 + r() * 3.2,
      vx: -side * (0.5 + r() * 2.2), vy: 9.5 + r() * 4.5, vz: -1 + r() * 2.2, s: 0.34 + r() * 0.32 });
  }
  for (let k = 0; k < 12; k++) {  // sparkles popping around the pyramid
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texs[2], transparent: true }));
    sp.visible = false; confetti.add(sp);
    const a = r() * Math.PI * 2, rad = 1.9 + r() * 1.1;
    sparkles.push({ sp, x: Math.cos(a) * rad, y: 2 + Math.sin(a) * rad * 1.1, z: 0.8, delay: r() * 1.2, s: 0.28 + r() * 0.25 });
  }
}
const K = 2.4, G = 9.0; // linear drag, gravity
function ballistic(o, tau) {
  const e = (1 - Math.exp(-K * tau)) / K;
  return [o.x0 + o.vx * e, o.y0 + (o.vy + G / K) * e - (G / K) * tau, o.z0 + o.vz * e];
}

// ---------- per-frame update ----------
const proj = new THREE.Vector3();
function screenY(v) { proj.copy(v).project(camera); return (1 - proj.y) / 2 * H; }
function setCamera(t) {
  const push = easeInOut(prog(t, 0, T.reveal));
  camera.position.set(Math.sin(t * 0.35) * 0.12, 7.4 - 0.3 * push, 19.8 - 1.0 * push);
  camera.lookAt(LOOK); camera.updateMatrixWorld();
}
function place(b, pos, rx, ry, rz, op) {
  b.mesh.position.copy(pos); b.mesh.rotation.set(rx, ry, rz);
  b.m2.position.copy(pos); b.m2.rotation.set(rx, ry, rz);
  b.mesh.visible = op > 0.01; b.m2.visible = op > 0.01 && pos.y < 1.2 && pos.z > -1.5;
  b.mats.forEach(m => { m.opacity = op; m.transparent = op < 1; m.depthWrite = op > 0.5; });
}
const tmp = new THREE.Vector3();
function spin(t, j, pos) {
  const ps = prog(t, T.spin + j * Math.min(0.32, 2.6 / NA), 0.9);
  if (ps > 0 && ps < 1) { const l = Math.sin(Math.PI * ps); pos.z += 1.1 * l; pos.y += 0.5 * l; return easeInOut(clamp((ps - .18) / .64)) * Math.PI * 2; }
  return 0;
}
function renderAt(t) {
  setCamera(t);
  // code blocks at the back: drop in, then at the reveal flip to their letter while flying into the slot
  BACK.forEach((b, i) => {
    const pIn = easeOut(prog(t, 0.3 + i * 0.16, 0.5));
    const pos = tmp.copy(b.home); pos.y += (1 - pIn) * 0.5;
    let ry = 0;
    const s0 = T.reveal + 0.5 + i * 0.3, pm = easeInOut(prog(t, s0, 0.6));
    if (pm > 0) { pos.lerpVectors(b.home, SLOTS[i].home, pm); pos.y += Math.sin(Math.PI * pm) * 1.4; }
    const sw = prog(t, s0 + 0.15, 0.3);        // number -> letter
    b.face.material.opacity = easeOut(prog(t, 0.55 + i * 0.16, 0.3)) * pIn * (1 - sw);
    b.face2.material.opacity = sw;
    if (pm > 0) ry = pm < 1 ? Math.sin(Math.PI * pm) * 0.25 : 0;
    ry += spin(t, i, pos);
    place(b, pos, 0, ry, 0, pIn);
  });
  SLOTS.forEach((b, j) => {
    const pIn = easeOut(prog(t, 1.4 + j * 0.1, 0.5));
    const pos = tmp.copy(b.home); pos.y += (1 - pIn) * 0.5;
    let rz = 0, op = pIn, ry = 0;
    const fop = easeOut(prog(t, 1.7 + j * 0.1, 0.3)) * pIn;
    if (b.q) {
      const amp = Math.min(prog(t, 2.2, 0.6), 1 - prog(t, T.reveal - 0.2, 0.3));
      rz = amp * THREE.MathUtils.degToRad(3) * Math.sin(t * 2 * Math.PI * 1.1 + j * 0.9);
      if (CONFIG.mode === 'code') {               // slot disappears when the flying block lands
        const gone = 1 - prog(t, T.reveal + 0.5 + j * 0.3 + 0.45, 0.15);
        b.mesh.scale.setScalar(Math.max(0.001, gone)); b.m2.scale.setScalar(Math.max(0.001, gone));
        op *= gone; b.face.material.opacity = fop * gone;
      } else {                                    // '?' turns into the letter with a little hop
        const f0 = fillStart(j), pf = prog(t, f0, 0.35);
        pos.y += Math.sin(Math.PI * prog(t, f0 - 0.05, 0.45)) * 0.45;
        b.face.material.opacity = fop * (1 - pf); b.face2.material.opacity = easeOut(pf);
        b.face2.scale.setScalar(0.9 + 0.1 * easeOut(pf));
      }
    } else b.face.material.opacity = fop;
    if (CONFIG.mode !== 'code') ry = spin(t, j, pos);
    place(b, pos, 0, ry, rz, op);
  });
  const tau0 = t - T.celeb;
  pieces.forEach(o => {
    const tau = tau0 - o.delay;
    if (tau < 0 || tau > 4.2) { o.p.visible = false; return; }
    o.p.visible = true;
    const [x, y, z] = ballistic(o, tau);
    o.p.position.set(x + Math.sin(tau * 5 + o.rx) * 0.08, y, z);
    o.p.rotation.set(o.rx * tau, o.ry * tau, o.rz * tau);
    o.p.scale.setScalar(o.s);
    o.p.material.opacity = 1 - prog(tau, 3.3, 0.9);
  });
  emojis.forEach(o => {
    const tau = tau0 - o.delay;
    if (tau < 0 || tau > 4.0) { o.sp.visible = false; return; }
    o.sp.visible = true;
    const [x, y, z] = ballistic(o, tau);
    o.sp.position.set(x, y, z); o.sp.scale.setScalar(o.s);
    o.sp.material.opacity = 1 - prog(tau, 3.1, 0.9);
    o.sp.material.rotation = Math.sin(tau * 3 + o.x0) * 0.5;
  });
  sparkles.forEach(o => {
    const p = prog(tau0 - 0.1 - o.delay, 0, 0.7);
    if (p <= 0 || p >= 1) { o.sp.visible = false; return; }
    o.sp.visible = true; o.sp.position.set(o.x, o.y, o.z);
    o.sp.scale.setScalar(o.s * Math.sin(Math.PI * p)); o.sp.material.opacity = Math.sin(Math.PI * p);
  });

  renderer.render(scene, camera);

  // ---------- 2D overlay ----------
  const pyrOp = Math.min(1, 1 - easeOut(prog(t, T.hintOut, 0.5)) + easeOut(prog(t, T.pyrBack, 0.5)));
  $('gl').style.opacity = pyrOp;
  const tIn = fade(t, 0.0, 0.5, T.titleOut, 0.4);
  $('title').style.opacity = Math.min(tIn, pyrOp);
  $('sub').style.opacity = Math.min(fade(t, 0.15, 0.5, T.titleOut, 0.4), pyrOp);
  $('hint').style.opacity = fade(t, T.hintTextIn, 0.35, T.hintTextOut, 0.3);
  $('clue').style.opacity = Math.min(fade(t, 0.4, 0.5, T.titleOut, 0.4), pyrOp);

  // timer (number + yellow bar, red in the last 3 s)
  const tt = clamp(t - T.timerStart, 0, 10);
  const remaining = 10 - tt;
  $('timer').style.opacity = fade(t, T.timerStart - 0.4, 0.4, T.timerEnd, 0.3);
  $('tnum').textContent = Math.max(1, Math.ceil(remaining - 1e-6));
  $('tnum').style.opacity = pyrOp; // during the hint only the bar keeps running
  $('bar').style.width = (remaining / 10 * 100) + '%';
  $('bar').style.background = remaining <= 3 ? '#E8364F' : '#F7C21B';
  $('tnum').style.color = remaining <= 3 ? '#E8364F' : TH.text;

  $('timeup').style.opacity = fade(t, T.timeUpIn, 0.25, T.timeUpOut, 0.25);
  const ga = Math.sin(Math.PI * prog(t, T.celeb - 0.05, 0.6));
  $('glow').style.setProperty('--gy', (screenY(new THREE.Vector3(0, S / 2, slotZ)) / H * 100).toFixed(1) + '%');
  $('glow').style.opacity = ga;
  $('answer').style.opacity = fade(t, T.answerIn, 0.5);
  $('cta').style.opacity = fade(t, T.ctaIn, 0.5);
}

window.renderAt = renderAt;
function applyTheme() {
  const st = $('stage');
  st.style.background = `radial-gradient(ellipse 60% 38% at 50% 47%, ${TH.glow}, rgba(255,255,255,0) 70%), linear-gradient(100deg, ${TH.bg[0]} 0%, ${TH.bg[1]} 35%, ${TH.bg[2]} 65%, ${TH.bg[3]} 100%)`;
  st.style.setProperty('--ink', TH.ink);
  document.querySelectorAll('.t, #tnum').forEach(e => { e.style.color = TH.text; e.style.textShadow = TH.textShadow; });
  const a = $('answer'); a.style.color = TH.ink; a.style.textShadow = 'none';
  const tr = $('track'); tr.style.background = CONFIG.theme === 'butter' ? 'rgba(120,80,0,.18)' : 'rgba(255,255,255,.38)';
}
function applyText() {
  applyTheme();
  $('game').firstChild.textContent = CONFIG.game;
  const gs = $('game').firstChild; let fs = 40;   // keep the quiz-type label clear of the logo
  while (gs.getBoundingClientRect().left < 225 && fs > 24) { fs -= 2; gs.style.fontSize = fs + 'px'; gs.style.letterSpacing = (fs / 10) + 'px'; }
  $('title').textContent = CONFIG.title; $('sub').textContent = CONFIG.sub;
  $('sub').style.top = ($('title').offsetTop + $('title').offsetHeight + 22) + 'px';
  $('hint').innerHTML = '<div><small>HINT</small>' + CONFIG.hint + '</div>';
  $('answer').innerHTML = '<div class="big">' + CONFIG.answerCard + '</div><div class="small" style="color:' + TH.ink2 + '">' + CONFIG.meanings + '</div>';
  $('cta').innerHTML = CONFIG.cta1 + '<div>' + CONFIG.cta2 + '</div>';
  if (!CONFIG.clue) $('clue').style.display = 'none';
  if (CONFIG.clue) { $('clue').innerHTML = CONFIG.clue; if (CONFIG.two) $('clue').classList.add('two');
    $('clue').style.top = ($('sub').offsetTop + $('sub').offsetHeight + 90) + 'px'; }
}
window.ready = (async () => { applyText(); await document.fonts.load("800 100px Pop"); await document.fonts.load("700 40px Pop"); await buildEmoji();
  [...BACK, ...SLOTS].forEach(b => { b.face.material.map = letterTexture(b.ch, b.color); b.face.material.needsUpdate = true;
    if (b.face2) { b.face2.material.map = letterTexture(b.alt, INK); b.face2.material.needsUpdate = true; } });
  return true; })();
window.layout = () => ({});
