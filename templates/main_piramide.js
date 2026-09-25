// =====================================================================
//  SPA QUIZ TEMPLATE – WOORDPIRAMIDE (fixed format, only edit CONFIG)
// =====================================================================
const CONFIG = Object.assign({ cta1: 'Heb jij het goed geraden?', cta2: 'Volg voor de volgende puzzel!' }, await (await fetch('quiz.json', { cache: 'no-store' })).json());
const RSTEP = Math.min(0.35, 1.2 / (CONFIG.rows.length - 1));
const SPIN_STEP = Math.min(0.3, 3.0 / (CONFIG.rows.length * (CONFIG.rows.length + 1) / 2));
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
  rowStart: r => 0.3 + r * RSTEP,
  timerStart: 2.6, timerEnd: 12.6,
  hintOut: 7.6, hintTextIn: 8.0, hintTextOut: 10.3, pyrBack: 10.5,
  timeUpIn: 12.7, timeUpOut: 13.7,
  reveal: 13.9, celeb: 15.4, answerIn: 16.2, titleOut: 17.6,
  spin: 18.4, ctaIn: 21.4, end: 25.0
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
const LOOK = new THREE.Vector3(0, 2.1, 0);

scene.add(new THREE.HemisphereLight(0xfff4fb, 0xd98cc8, 1.35));
const key = new THREE.DirectionalLight(0xffffff, 2.3);
key.position.set(-5.5, 9, 8);
key.castShadow = true;
key.shadow.mapSize.set(1536, 1536);
key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 8; key.shadow.camera.bottom = -3;
key.shadow.camera.near = 1; key.shadow.camera.far = 30;
key.shadow.radius = 6; key.shadow.bias = -0.0008;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffd6f0, 0.55); fill.position.set(6, 3, 6); scene.add(fill);

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
  const m = g.measureText(ch);
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

// ---------- build pyramid ----------
const ROWS = CONFIG.rows;
const ANSWER = CONFIG.answer;
const N = ROWS.length;            // number of layers (4-7); bottom layer = answer
const S = 4.0 / N;
const geo = new RoundedBoxGeometry(S * 0.985, S * 0.985, S * 0.985, 5, 0.075 * S);
const letterGeo = new THREE.PlaneGeometry(0.86 * S, 0.86 * S);
const blocks = [];
const pyramid = new THREE.Group(); scene.add(pyramid);
const mirror = new THREE.Group(); mirror.scale.y = -1; scene.add(mirror);

function makeBlock(ch, r, i, seed) {
  const side = new THREE.MeshStandardMaterial({ map: woodTexture(seed), roughness: 0.62, metalness: 0, transparent: true });
  const topm = new THREE.MeshStandardMaterial({ map: woodTexture(seed + 99, true), roughness: 0.55, metalness: 0, transparent: true });
  // BoxGeometry groups: +x, -x, +y, -y, +z, -z
  const mesh = new THREE.Mesh(geo, [side, side, topm, side, side, side]);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const mk = (tex) => {
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
    const p = new THREE.Mesh(letterGeo, m); p.position.z = S * 0.4935 + 0.002; mesh.add(p); return p;
  };
  const isQ = ch === '?';
  const main = mk(letterTexture(ch, isQ ? '#9C84B8' : '#111111'));
  const ans = isQ ? mk(letterTexture(ANSWER[i], '#111111')) : null;
  if (ans) ans.material.opacity = 0;
  const home = new THREE.Vector3((i - r / 2) * S, (N - 1 - r) * S + S / 2, 0);
  mesh.position.copy(home);
  pyramid.add(mesh);
  const m2 = mesh.clone(true); m2.visible = (r === N - 1); mirror.add(m2);
  blocks.push({ mesh, m2, mats: [side, topm], main, ans, r, i, home, isQ });
}
let seed = 1;
ROWS.forEach((row, r) => row.forEach((ch, i) => makeBlock(ch, r, i, seed++ * 17)));

// glossy floor: soft shadows + a faint mirror reflection fading into the wall
const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.26, color: 0x6a1f5c }));
shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = 0.004; shadowFloor.receiveShadow = true; shadowFloor.renderOrder = 3; shadowFloor.material.depthWrite = false; scene.add(shadowFloor);
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(244,168,204,0)');     // far (horizon) -> transparent, blends into wall
  gr.addColorStop(0.30, 'rgba(244,170,205,0.86)');
  gr.addColorStop(0.55, 'rgba(243,167,204,0.93)');
  gr.addColorStop(1, 'rgba(242,164,202,0.97)');  // near
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  cover.rotation.x = -Math.PI / 2; cover.position.set(0, 0.002, 1); cover.renderOrder = 2; scene.add(cover);
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
  const z = 19.6 - 1.1 * push;
  const x = Math.sin(t * 0.35) * 0.14;
  camera.position.set(x, 5.4 - 0.25 * push, z);
  camera.lookAt(LOOK);
  camera.updateMatrixWorld();
}

function renderAt(t) {
  setCamera(t);

  // blocks: build, wiggle, reveal, spin
  const order = blocks.slice(); // already top->bottom, left->right
  order.forEach((b, k) => {
    const rs = T.rowStart(b.r);
    const pIn = easeOut(prog(t, rs, 0.5));
    let y = b.home.y + (1 - pIn) * 0.35 * S, rotY = 0, rotZ = 0;
    const op = pIn;
    b.mats.forEach(m => { m.opacity = op; m.transparent = op < 1; m.depthWrite = op > 0.5; });
    // letters
    const ls = rs + 0.45 + b.i * Math.min(0.12, 0.5 / N);
    const pl = easeOut(prog(t, ls, 0.3));
    let mainOp = pl * op, mainSc = 0.9 + 0.1 * pl;
    if (b.isQ) {
      // wiggle while waiting
      const amp = Math.min(prog(t, T.rowStart(N - 1) + 0.9, 0.6), 1 - prog(t, T.reveal - 0.2, 0.3));
      rotZ = amp * THREE.MathUtils.degToRad(3) * Math.sin(t * 2 * Math.PI * 1.1 + b.i * 0.9);
      // reveal
      mainOp *= 1 - prog(t, T.reveal, 0.25);
      const pa = easeOut(prog(t, T.reveal + 0.1 + b.i * Math.min(0.3, 1.2 / N), 0.3));
      b.ans.material.opacity = pa; b.ans.scale.setScalar(0.9 + 0.1 * pa);
    }
    b.main.material.opacity = mainOp; b.main.scale.setScalar(mainSc);
    // spin + jump wave
    const ps = prog(t, T.spin + k * SPIN_STEP, 0.9);
    let zOff = 0;
    if (ps > 0 && ps < 1) {
      const lift = Math.sin(Math.PI * ps);
      zOff = 1.25 * S * lift; y += 0.55 * S * lift;
      rotY = easeInOut(clamp((ps - 0.18) / 0.64)) * Math.PI * 2;
    }
    b.mesh.position.set(b.home.x, y, b.home.z + zOff);
    b.mesh.rotation.set(0, rotY, rotZ);
    b.m2.position.copy(b.mesh.position); b.m2.rotation.copy(b.mesh.rotation);
  });

  // confetti
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

  // timer (number + yellow bar, red in the last 3 s)
  const tt = clamp(t - T.timerStart, 0, 10);
  const remaining = 10 - tt;
  $('timer').style.opacity = fade(t, T.timerStart - 0.4, 0.4, T.timerEnd, 0.3);
  $('tnum').textContent = Math.max(1, Math.ceil(remaining - 1e-6));
  $('tnum').style.opacity = pyrOp; // during the hint only the bar keeps running
  $('bar').style.width = (remaining / 10 * 100) + '%';
  $('bar').style.background = remaining <= 3 ? '#E8364F' : '#F7C21B';
  $('tnum').style.color = remaining <= 3 ? '#FFE3E8' : '#FFFFFF';

  $('timeup').style.opacity = fade(t, T.timeUpIn, 0.25, T.timeUpOut, 0.25);
  const ga = Math.sin(Math.PI * prog(t, T.celeb - 0.05, 0.6));
  $('glow').style.setProperty('--gy', (screenY(new THREE.Vector3(0, S / 2, 0.5)) / H * 100).toFixed(1) + '%');
  $('glow').style.opacity = ga;
  $('answer').style.opacity = fade(t, T.answerIn, 0.5);
  $('cta').style.opacity = fade(t, T.ctaIn, 0.5);
}

window.renderAt = renderAt;
window.layout = () => { setCamera(0); return { top: screenY(new THREE.Vector3(0, 4, 0)), bottom: screenY(new THREE.Vector3(0, 0, 0.5)) }; };
function applyText() {
  $('title').textContent = CONFIG.title; $('sub').textContent = CONFIG.sub;
  $('hint').innerHTML = '<div><small>HINT</small>' + CONFIG.hint + '</div>';
  $('answer').innerHTML = '<div class="big">' + CONFIG.answerCard + '</div><div class="small">' + CONFIG.meanings + '</div>';
  $('cta').innerHTML = CONFIG.cta1 + '<div>' + CONFIG.cta2 + '</div>';
}
window.ready = (async () => { applyText(); await document.fonts.load("800 100px Pop"); await document.fonts.load("700 40px Pop"); await buildEmoji();
  // rebuild letter textures now that the font is loaded
  blocks.forEach(b => {
    const ROWCH = ROWS[b.r][b.i];
    b.main.material.map = letterTexture(ROWCH, ROWCH === '?' ? '#9C84B8' : '#111111'); b.main.material.needsUpdate = true;
    if (b.ans) { b.ans.material.map = letterTexture(ANSWER[b.i], '#111111'); b.ans.material.needsUpdate = true; }
  });
  mirror.children.forEach((m2, k) => { m2.children.forEach((c, j) => { c.material = blocks[k].mesh.children[j].material; }); });
  return true; })();
