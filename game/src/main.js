import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// обычный скрипт без top-level await: работает в любом встроенном браузере
const BUILD = window.BLADE_BUILD || "dev";

async function main() {

const $ = (id) => document.getElementById(id);
const coarse = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
if (coarse) document.documentElement.classList.add("coarse");
else $("howto").innerHTML =
  "<dt>W A S D</dt><dd>движение (или стрелки)</dd>" +
  "<dt>Пробел</dt><dd>удар мечом, жми чаще — серия ударов</dd>" +
  "<dt>Shift</dt><dd>рывок, на время рывка ты неуязвим</dd>";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------ сцена
const ARENA_R = 11.4;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$("game").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#1b2631");
scene.fog = new THREE.Fog("#1b2631", 26, 52);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const hemi = new THREE.HemisphereLight("#9fb8d6", "#3a2c1c", 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#ffd9a8", 2.0);
sun.position.set(8, 16, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 50 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// ------------------------------------------------------------ загрузка моделей
const loader = new GLTFLoader();
const FILES = ["knight", "goblin", "arena", "potion"];
// модели лежат рядом со страницей: assets/*.json (glTF из Blender)
const progress = Object.fromEntries(FILES.map((f) => [f, 0]));
function showProgress() {
  const p = FILES.reduce((sum, f) => sum + progress[f], 0) / FILES.length;
  $("loadText").textContent = `Загружаю модели: ${Math.round(p * 100)}%`;
}
function load(name) {
  return new Promise((res, rej) => loader.load(`assets/${name}.json`, (g) => {
    progress[name] = 1;
    showProgress();
    res(g);
  }, (e) => {
    if (e.total) { progress[name] = Math.min(0.99, e.loaded / e.total); showProgress(); }
  }, rej));
}

let assets;
let fireMats = [];
try {
  const [knight, goblin, arena, potion] = await Promise.all(FILES.map(load));
  assets = { knight, goblin, arena, potion };
} catch (err) {
  $("loadText").textContent = "Модели не загрузились: " + (err && err.message || err);
  throw err;
}
assets.arena.scene.traverse((o) => {
  if (o.isMesh) {
    o.receiveShadow = true;
    o.castShadow = true;
    if (o.material.name === "A_Fire") fireMats.push(o.material);
  }
});
scene.add(assets.arena.scene);

// ------------------------------------------------------------ звук
let audio = null, muted = false;
function initAudio() {
  if (audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
}
function noiseBuf() {
  const b = audio.createBuffer(1, audio.sampleRate * 0.4, audio.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
let nbuf = null;
function sfx(kind) {
  if (!audio || muted) return;
  if (audio.state === "suspended") audio.resume();
  nbuf ??= noiseBuf();
  const t = audio.currentTime, out = audio.createGain();
  out.connect(audio.destination);
  const tone = (type, f0, f1, dur, vol, delay = 0) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t + delay);
    o.frequency.exponentialRampToValueAtTime(f1, t + delay + dur);
    g.gain.setValueAtTime(vol, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
    o.connect(g).connect(out);
    o.start(t + delay); o.stop(t + delay + dur + 0.02);
  };
  const noise = (f0, f1, dur, vol, q = 1.2) => {
    const s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
    s.buffer = nbuf; f.type = "bandpass"; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t); s.stop(t + dur);
  };
  switch (kind) {
    case "swing": noise(700, 2600, 0.18, 0.35, 0.9); break;
    case "hit": tone("triangle", 180, 60, 0.12, 0.5); noise(1800, 500, 0.1, 0.4); break;
    case "hurt": tone("square", 300, 90, 0.22, 0.18); noise(600, 200, 0.18, 0.3); break;
    case "die": tone("sawtooth", 520, 120, 0.35, 0.12); break;
    case "dash": noise(300, 1400, 0.2, 0.3, 0.6); break;
    case "potion": [523, 659, 784].forEach((f, i) => tone("sine", f, f * 1.01, 0.18, 0.18, i * 0.07)); break;
    case "wave": [196, 247, 294].forEach((f) => tone("sawtooth", f, f, 0.7, 0.05)); break;
    case "over": tone("triangle", 330, 82, 1.0, 0.25); break;
  }
}
$("muteBtn").addEventListener("click", () => {
  muted = !muted;
  $("muteWave").style.display = muted ? "none" : "";
  $("muteBtn").setAttribute("aria-label", muted ? "Включить звук" : "Выключить звук");
});

// ------------------------------------------------------------ персонажи
class Actor {
  constructor(gltf, scale = 1) {
    this.obj = SkeletonUtils.clone(gltf.scene);
    this.obj.scale.setScalar(scale);
    this.mats = [];
    this.obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        o.material = o.material.clone();
        this.mats.push({ m: o.material, e: o.material.emissive.clone(), i: o.material.emissiveIntensity });
      }
    });
    this.mixer = new THREE.AnimationMixer(this.obj);
    this.actions = {};
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      if (!["Idle", "Run"].includes(clip.name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = clip.name === "Die";
      }
      this.actions[clip.name] = a;
    }
    this.current = null;
    this.flashT = 0;
    scene.add(this.obj);
  }
  play(name, { fade = 0.12, speed = 1, restart = false } = {}) {
    const next = this.actions[name];
    if (this.current === next && !restart) { next.timeScale = speed; return; }
    next.reset();
    next.timeScale = speed;
    next.enabled = true;
    if (this.current) next.crossFadeFrom(this.current, fade, false);
    next.play();
    this.current = next;
  }
  flash() { this.flashT = 0.12; }
  update(dt) {
    this.mixer.update(dt);
    if (this.flashT > 0) {
      this.flashT -= dt;
      const on = this.flashT > 0;
      for (const { m, e, i } of this.mats) {
        if (on) { m.emissive.setRGB(1, 0.95, 0.85); m.emissiveIntensity = 0.9; }
        else { m.emissive.copy(e); m.emissiveIntensity = i; }
      }
    }
  }
  remove() { scene.remove(this.obj); }
}

// ------------------------------------------------------------ эффекты
const PCOUNT = 160;
const particles = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.1, 0.1, 0.1),
  new THREE.MeshBasicMaterial({ toneMapped: false }),
  PCOUNT,
);
particles.frustumCulled = false;
scene.add(particles);
const pdata = Array.from({ length: PCOUNT }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1 }));
let pnext = 0;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color();
for (let i = 0; i < PCOUNT; i++) { tmpM.makeScale(0, 0, 0); particles.setMatrixAt(i, tmpM); particles.setColorAt(i, tmpC.set("#fff")); }
function burst(pos, color, n = 12, power = 4) {
  tmpC.set(color);
  for (let k = 0; k < n; k++) {
    const d = pdata[pnext];
    d.p.copy(pos);
    d.v.set((Math.random() - 0.5) * power, Math.random() * power * 0.9 + 1, (Math.random() - 0.5) * power);
    d.max = d.life = 0.5 + Math.random() * 0.4;
    particles.setColorAt(pnext, tmpC);
    pnext = (pnext + 1) % PCOUNT;
  }
  particles.instanceColor.needsUpdate = true;
}
function updateParticles(dt) {
  for (let i = 0; i < PCOUNT; i++) {
    const d = pdata[i];
    if (d.life <= 0) continue;
    d.life -= dt;
    d.v.y -= 12 * dt;
    d.p.addScaledVector(d.v, dt);
    if (d.p.y < 0.05) { d.p.y = 0.05; d.v.multiplyScalar(0.5); d.v.y *= -0.3; }
    const s = Math.max(d.life / d.max, 0);
    tmpQ.setFromEuler(new THREE.Euler(d.life * 9, d.life * 7, 0));
    tmpM.compose(d.p, tmpQ, tmpS.setScalar(s));
    particles.setMatrixAt(i, tmpM);
  }
  particles.instanceMatrix.needsUpdate = true;
}

// след удара — полукольцо перед рыцарем
const slash = new THREE.Mesh(
  new THREE.RingGeometry(0.7, 2.1, 28, 1, -Math.PI * 0.5 - 1.25, 2.5),
  new THREE.MeshBasicMaterial({ color: "#fff2d6", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
);
slash.rotation.x = -Math.PI / 2;
const slashPivot = new THREE.Group();
slashPivot.add(slash);
slash.position.y = 0;
scene.add(slashPivot);
let slashT = 0;

// тень-кольцо под рыцарем, чтобы его было видно в толпе
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.55, 0.68, 32),
  new THREE.MeshBasicMaterial({ color: "#ff9a3c", transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.04;
scene.add(ring);

const dmgLayer = document.body;
const floaters = [];
const proj = new THREE.Vector3();
function floatText(text, pos, cls = "") {
  const el = document.createElement("div");
  el.className = "dmg " + cls;
  el.textContent = text;
  dmgLayer.appendChild(el);
  floaters.push({ el, pos: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 30 });
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    proj.copy(f.pos); proj.y += 2.0 + f.t * 1.4;
    proj.project(camera);
    const x = (proj.x * 0.5 + 0.5) * innerWidth + f.dx * f.t;
    const y = (-proj.y * 0.5 + 0.5) * innerHeight;
    f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.25 - f.t) * 2})`;
    f.el.style.opacity = String(Math.max(0, 1 - f.t / 0.8));
    if (f.t > 0.8) { f.el.remove(); floaters.splice(i, 1); }
  }
}

let shake = 0;
function addShake(v) { if (!reduceMotion) shake = Math.max(shake, v); }
let hurtT = 0;

// ------------------------------------------------------------ ввод
const input = { x: 0, z: 0, attack: false, dash: false };
const keys = new Set();
addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "Space" || e.code === "KeyJ") { input.attack = true; e.preventDefault(); }
  if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyK") input.dash = true;
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());

const stick = $("stick"), knob = $("knob");
const STICK_R = 50;
let stickId = null, stickO = { x: 0, y: 0 }, stickV = { x: 0, y: 0 };
function stickHome() {
  stick.style.left = ""; stick.style.top = "";
  knob.style.transform = "";
  stick.classList.remove("live");
}
addEventListener("pointerdown", (e) => {
  if (state !== "playing" && state !== "between") return;
  if (e.target.closest("button")) return;
  if (stickId === null && e.clientX < innerWidth * 0.62) {
    stickId = e.pointerId;
    stickO = { x: e.clientX, y: e.clientY };
    stickV = { x: 0, y: 0 };
    stick.style.left = e.clientX + "px";
    stick.style.top = e.clientY + "px";
    stick.classList.add("live");
  } else if (!coarse && e.button === 0) {
    input.attack = true;
  }
});
addEventListener("pointermove", (e) => {
  if (e.pointerId !== stickId) return;
  let dx = e.clientX - stickO.x, dy = e.clientY - stickO.y;
  const len = Math.hypot(dx, dy);
  if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
  stickV = { x: dx / STICK_R, y: dy / STICK_R };
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
});
function stickUp(e) {
  if (e.pointerId !== stickId) return;
  stickId = null; stickV = { x: 0, y: 0 }; stickHome();
}
addEventListener("pointerup", stickUp);
addEventListener("pointercancel", stickUp);
function bindPad(el, key) {
  el.addEventListener("pointerdown", (e) => { e.preventDefault(); input[key] = true; el.classList.add("down"); initAudio(); });
  const up = () => el.classList.remove("down");
  el.addEventListener("pointerup", up);
  el.addEventListener("pointerleave", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("click", (e) => e.preventDefault());
}
bindPad($("attackBtn"), "attack");
bindPad($("dashBtn"), "dash");
addEventListener("contextmenu", (e) => e.preventDefault());

function readMove() {
  let x = stickV.x, z = stickV.y;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) z -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) z += 1;
  const l = Math.hypot(x, z);
  if (l > 1) { x /= l; z /= l; }
  input.x = x; input.z = z;
}

// ------------------------------------------------------------ игра
let state = "menu";
let player, enemies = [], potions = [];
let wave = 0, score = 0, kills = 0, combo = 0, comboT = 0, toSpawn = 0, spawnT = 0, betweenT = 0;
let best = 0;
try { best = Number(localStorage.getItem("blade-arena-best")) || 0; } catch { best = 0; }

const P = {
  speed: 6.2, hpMax: 100, dmg: 34, reach: 2.25, arc: Math.cos(THREE.MathUtils.degToRad(80)),
  dashSpeed: 17, dashTime: 0.2, dashCd: 0.85, atkSpeed: 1.5,
};

function makePlayer() {
  const a = new Actor(assets.knight, 1);
  return Object.assign(a, {
    pos: new THREE.Vector3(), face: Math.PI, vel: new THREE.Vector3(),
    hp: P.hpMax, atkT: 0, atkHit: false, queued: false,
    dashT: 0, dashCdT: 0, dashDir: new THREE.Vector3(), inv: 0, hitT: 0, dead: false,
  });
}

const ENEMY = {
  goblin: { scale: 1, hp: 60, speed: 3.1, dmg: 9, range: 1.45, cd: 1.4, score: 10, color: "#7fc24a" },
  brute: { scale: 1.65, hp: 240, speed: 2.3, dmg: 20, range: 2.2, cd: 1.9, score: 60, color: "#d0613f" },
};
function spawnEnemy(type) {
  const cfg = ENEMY[type];
  const e = new Actor(assets.goblin, cfg.scale);
  if (type === "brute") {
    for (const { m } of e.mats) {
      if (m.name === "G_Skin") m.color.set("#b5583c");
      if (m.name === "G_SkinDark") m.color.set("#7c3424");
      if (m.name === "G_Rag") m.color.set("#3f3a46");
    }
  }
  const a = Math.random() * Math.PI * 2;
  e.pos = new THREE.Vector3(Math.cos(a) * ARENA_R, 0, Math.sin(a) * ARENA_R);
  e.obj.position.copy(e.pos);
  Object.assign(e, {
    type, cfg, hp: cfg.hp + (wave - 1) * (type === "brute" ? 20 : 4),
    speed: cfg.speed + Math.min(wave, 12) * 0.09,
    atkT: 0, atkHit: false, cdT: 0.6 + Math.random(), stun: 0, dead: false, deadT: 0, spawnT: 0,
    knock: new THREE.Vector3(), face: 0,
  });
  e.play("Run", { speed: 1.1 });
  e.obj.scale.setScalar(0.01);
  burst(e.pos.clone().setY(0.3), "#9b8a6a", 10, 3);
  enemies.push(e);
}

function startWave() {
  wave++;
  $("waveNum").textContent = wave;
  toSpawn = 2 + wave * 2;
  spawnT = 0.3;
  showBanner(`Волна ${wave}`, wave % 3 === 0 ? "идёт громила" : "");
  sfx("wave");
}

let bannerT = 0;
function showBanner(text, sub = "") {
  $("banner").innerHTML = text + (sub ? `<small>${sub}</small>` : "");
  $("banner").classList.add("on");
  bannerT = 1.8;
}

function resetGame() {
  for (const e of enemies) e.remove();
  for (const p of potions) scene.remove(p.obj);
  enemies = []; potions = [];
  if (player) player.remove();
  player = makePlayer();
  player.play("Idle");
  wave = 0; score = 0; kills = 0; combo = 0; comboT = 0;
  $("scoreNum").textContent = "0";
  setHp();
}

function setHp() {
  const v = Math.max(0, player.hp) / P.hpMax;
  $("hpFill").style.transform = `scaleX(${v})`;
  $("hpNum").textContent = Math.ceil(Math.max(0, player.hp));
}

function startGame() {
  initAudio();
  resetGame();
  $("startScreen").hidden = true;
  $("overScreen").hidden = true;
  $("hud").hidden = false;
  $("touchUi").hidden = !coarse;
  $("keysHint").hidden = coarse;
  state = "between";
  betweenT = 0.6;
}

function gameOver() {
  state = "over";
  sfx("over");
  if (score > best) {
    best = score;
    try { localStorage.setItem("blade-arena-best", String(best)); } catch { /* хранилище недоступно */ }
  }
  setTimeout(() => {
    $("resWave").textContent = wave;
    $("resScore").textContent = score;
    $("resBest").textContent = best;
    $("resNote").textContent = `Гоблинов повержено: ${kills}`;
    $("overScreen").hidden = false;
    $("touchUi").hidden = true;
    $("keysHint").hidden = true;
    stickId = null; stickHome();
  }, 1400);
}

$("playBtn").addEventListener("click", startGame);
$("againBtn").addEventListener("click", startGame);

const fwd = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

function hurtPlayer(dmg, from) {
  if (player.dead || player.inv > 0) return;
  player.hp -= dmg;
  player.inv = 0.5;
  player.flash();
  setHp();
  floatText(`−${dmg}`, player.pos, "ouch");
  tmp.subVectors(player.pos, from).setY(0).normalize();
  player.vel.addScaledVector(tmp, 7);
  addShake(0.35);
  hurtT = 0.35;
  sfx("hurt");
  burst(player.pos.clone().setY(1.1), "#d8402f", 8, 3);
  if (player.hp <= 0) {
    player.dead = true;
    player.play("Die", { fade: 0.08 });
    gameOver();
  } else if (player.atkT <= 0 && player.dashT <= 0) {
    player.hitT = 0.25;
    player.play("Hit", { restart: true, fade: 0.05 });
  }
}

function killEnemy(e) {
  e.dead = true;
  e.deadT = 0;
  e.play("Die", { fade: 0.06 });
  kills++;
  combo = comboT > 0 ? combo + 1 : 1;
  comboT = 2.4;
  const gain = e.cfg.score * Math.min(combo, 5);
  score += gain;
  $("scoreNum").textContent = score;
  if (combo > 1) { $("combo").textContent = `×${Math.min(combo, 5)}`; $("combo").classList.add("on"); }
  sfx("die");
  burst(e.pos.clone().setY(0.8), e.cfg.color, 18, 5);
  if (e.type === "brute") addShake(0.3);
  if (e.type === "brute" || Math.random() < 0.16) dropPotion(e.pos);
}

function dropPotion(pos) {
  const obj = assets.potion.scene.clone();
  obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  obj.scale.setScalar(1.6);
  obj.position.copy(pos).setY(0.2);
  scene.add(obj);
  potions.push({ obj, t: 0 });
}

function playerUpdate(dt) {
  const p = player;
  p.inv = Math.max(0, p.inv - dt);
  p.dashCdT = Math.max(0, p.dashCdT - dt);
  if (p.dead) { input.attack = input.dash = false; return; }

  readMove();
  const moving = Math.hypot(input.x, input.z) > 0.15;

  // рывок
  if (input.dash && p.dashCdT <= 0 && p.dashT <= 0) {
    p.dashT = P.dashTime;
    p.dashCdT = P.dashCd;
    p.inv = Math.max(p.inv, P.dashTime + 0.08);
    if (moving) p.dashDir.set(input.x, 0, input.z).normalize();
    else p.dashDir.set(Math.sin(p.face), 0, Math.cos(p.face));
    p.face = Math.atan2(p.dashDir.x, p.dashDir.z);
    p.atkT = 0; p.queued = false;
    p.play("Run", { speed: 2.4, fade: 0.05 });
    sfx("dash");
  }
  input.dash = false;

  // удар
  if (input.attack) {
    if (p.atkT <= 0 && p.dashT <= 0) beginAttack();
    else if (p.atkT > 0) p.queued = true;
  }
  input.attack = false;

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.pos.addScaledVector(p.dashDir, P.dashSpeed * dt);
    if (Math.random() < 0.6) burst(p.pos.clone().setY(0.1), "#c9ab78", 1, 1.5);
  } else if (p.atkT > 0) {
    const dur = 20 / 30 / P.atkSpeed;
    const tIn = dur - p.atkT;
    p.atkT -= dt;
    // шаг вперёд на ударе
    if (tIn > 0.15 && tIn < 0.3) p.pos.addScaledVector(fwd.set(Math.sin(p.face), 0, Math.cos(p.face)), 2.2 * dt);
    if (!p.atkHit && tIn >= 10 / 30 / P.atkSpeed * 0.92) { p.atkHit = true; strike(); }
    if (moving) p.pos.addScaledVector(tmp.set(input.x, 0, input.z), P.speed * 0.25 * dt);
    if (p.atkT <= 0) {
      if (p.queued) beginAttack();
      else p.play(moving ? "Run" : "Idle", { fade: 0.15 });
    }
  } else if (p.hitT > 0) {
    p.hitT -= dt;
    if (p.hitT <= 0) p.play("Idle");
  } else if (moving) {
    p.pos.addScaledVector(tmp.set(input.x, 0, input.z), P.speed * dt);
    p.face = turnTo(p.face, Math.atan2(input.x, input.z), 16 * dt);
    p.play("Run", { speed: 1.25 });
  } else {
    p.play("Idle");
  }

  p.pos.addScaledVector(p.vel, dt);
  p.vel.multiplyScalar(Math.exp(-8 * dt));
  clampArena(p.pos, 0.4);
  p.obj.position.copy(p.pos);
  p.obj.rotation.y = p.face;
  p.obj.visible = p.inv > 0 && p.dashT <= 0 ? Math.floor(p.inv * 20) % 2 === 0 : true;
  ring.position.x = p.pos.x; ring.position.z = p.pos.z;
  const cd = $("dashCd");
  if (cd) cd.style.setProperty("--cd", `${(p.dashCdT / P.dashCd) * 100}%`);
}

function beginAttack() {
  const p = player;
  p.queued = false;
  // автонаведение на ближайшего врага
  let best = null, bd = 3.6;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = e.pos.distanceTo(p.pos);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) p.face = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
  else if (Math.hypot(input.x, input.z) > 0.15) p.face = Math.atan2(input.x, input.z);
  p.atkT = 20 / 30 / P.atkSpeed;
  p.atkHit = false;
  p.play("Attack", { restart: true, speed: P.atkSpeed, fade: 0.06 });
  setTimeout(() => sfx("swing"), 110);
}

function strike() {
  const p = player;
  fwd.set(Math.sin(p.face), 0, Math.cos(p.face));
  slashPivot.position.set(p.pos.x, 1.0, p.pos.z);
  slashPivot.rotation.y = p.face;
  slashT = 0.2;
  let hits = 0;
  for (const e of enemies) {
    if (e.dead || e.spawnT < 0.35) continue;
    tmp.subVectors(e.pos, p.pos).setY(0);
    const d = tmp.length();
    const reach = P.reach + (e.cfg.scale - 1) * 0.6;
    if (d > reach) continue;
    if (d > 0.3 && tmp.normalize().dot(fwd) < P.arc) continue;
    hits++;
    const dmg = Math.round(P.dmg * (0.9 + Math.random() * 0.2));
    e.hp -= dmg;
    e.flash();
    floatText(String(dmg), e.pos);
    burst(e.pos.clone().setY(1.0 * e.cfg.scale), e.cfg.color, 7, 4);
    e.knock.copy(tmp).multiplyScalar(e.type === "brute" ? 3 : 8);
    if (e.hp <= 0) killEnemy(e);
    else if (e.type !== "brute" || Math.random() < 0.35) {
      e.stun = 0.35; e.atkT = 0;
      e.play("Hit", { restart: true, fade: 0.05 });
    }
  }
  if (hits) { sfx("hit"); addShake(0.12 + hits * 0.04); }
}

function enemyUpdate(e, dt) {
  e.spawnT += dt;
  if (e.spawnT < 0.4) e.obj.scale.setScalar(e.cfg.scale * Math.min(1, e.spawnT / 0.4));
  else e.obj.scale.setScalar(e.cfg.scale);

  if (e.dead) {
    e.deadT += dt;
    if (e.deadT > 1.6) e.obj.position.y = -(e.deadT - 1.6) * 0.8;
    return e.deadT < 2.6;
  }
  e.pos.addScaledVector(e.knock, dt);
  e.knock.multiplyScalar(Math.exp(-9 * dt));
  e.cdT -= dt;

  tmp.subVectors(player.pos, e.pos).setY(0);
  const dist = tmp.length();
  const dir = tmp.normalize();
  const target = player.dead ? e.face : Math.atan2(dir.x, dir.z);

  if (e.stun > 0) {
    e.stun -= dt;
    if (e.stun <= 0) e.play("Run");
  } else if (e.atkT > 0) {
    const dur = 20 / 30;
    const tIn = dur - e.atkT;
    e.atkT -= dt;
    e.face = turnTo(e.face, target, 3 * dt);
    if (!e.atkHit && tIn >= 10 / 30) {
      e.atkHit = true;
      fwd.set(Math.sin(e.face), 0, Math.cos(e.face));
      if (dist < e.cfg.range + 0.5 && dir.dot(fwd) > 0.3) hurtPlayer(e.cfg.dmg + Math.floor(wave / 3), e.pos);
      if (e.type === "brute") { addShake(0.15); burst(e.pos.clone().addScaledVector(fwd, 1.8).setY(0.1), "#c9ab78", 10, 3); }
    }
    if (e.atkT <= 0) e.play("Run");
  } else if (!player.dead && dist < e.cfg.range && e.cdT <= 0) {
    e.atkT = 20 / 30;
    e.atkHit = false;
    e.cdT = e.cfg.cd * (0.8 + Math.random() * 0.4);
    e.play("Attack", { restart: true, fade: 0.08 });
  } else if (!player.dead && dist > e.cfg.range * 0.8) {
    e.face = turnTo(e.face, target, 8 * dt);
    e.pos.addScaledVector(dir, e.speed * dt);
    e.play("Run", { speed: e.speed / 3 });
  } else {
    e.face = turnTo(e.face, target, 8 * dt);
    e.play("Idle");
  }
  clampArena(e.pos, 0.5);
  e.obj.position.copy(e.pos);
  e.obj.rotation.y = e.face;
  return true;
}

function separate() {
  const all = enemies.filter((e) => !e.dead);
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      const min = 0.55 * (a.cfg.scale + b.cfg.scale);
      tmp.subVectors(a.pos, b.pos).setY(0);
      const d = tmp.length();
      if (d < min && d > 0.0001) {
        tmp.multiplyScalar((min - d) / d * 0.5);
        a.pos.add(tmp); b.pos.sub(tmp);
      }
    }
    if (!player.dead) {
      const min = 0.5 + 0.45 * a.cfg.scale;
      tmp.subVectors(a.pos, player.pos).setY(0);
      const d = tmp.length();
      if (d < min && d > 0.0001) {
        tmp.multiplyScalar((min - d) / d);
        a.pos.addScaledVector(tmp, 0.7);
        player.pos.addScaledVector(tmp, -0.3);
      }
    }
  }
}

function clampArena(v, pad) {
  const r = Math.hypot(v.x, v.z), max = ARENA_R - pad;
  if (r > max) { v.x *= max / r; v.z *= max / r; }
}
function turnTo(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * Math.min(1, k);
}

// ------------------------------------------------------------ камера
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 12, 14);
function updateCamera(dt, t) {
  const focus = player ? player.pos : new THREE.Vector3();
  const portrait = camera.aspect < 1;
  const k = portrait ? 1.35 : 1;
  let want;
  if (state === "menu") {
    const a = t * 0.12;
    want = tmp2.set(Math.sin(a) * 7, 4.2, Math.cos(a) * 7);
    camTarget.lerp(tmp.set(0, 1.1, 0), 1 - Math.exp(-3 * dt));
  } else {
    want = tmp2.set(focus.x * 0.9, 8.4 * k, focus.z * 0.9 + 7.0 * k);
    camTarget.lerp(tmp.set(focus.x * 0.92, 0.9, focus.z * 0.92), 1 - Math.exp(-6 * dt));
  }
  camPos.lerp(want, 1 - Math.exp(-(state === "menu" ? 2 : 5) * dt));
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.6);
  }
  camera.lookAt(camTarget);
  sun.position.set(focus.x + 8, 16, focus.z + 6);
  sun.target.position.set(focus.x, 0, focus.z);
}

// ------------------------------------------------------------ цикл
const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (state === "playing" || state === "between" || state === "over") {
    playerUpdate(dt);
    if (state === "between") {
      betweenT -= dt;
      if (betweenT <= 0) { startWave(); state = "playing"; }
    }
    if (state === "playing") {
      spawnT -= dt;
      const alive = enemies.filter((e) => !e.dead).length;
      if (toSpawn > 0 && spawnT <= 0 && alive < 12) {
        const brutes = Math.floor(wave / 3);
        const type = toSpawn <= brutes ? "brute" : "goblin";
        spawnEnemy(type);
        toSpawn--;
        spawnT = Math.max(0.35, 1.1 - wave * 0.05);
      }
      if (toSpawn === 0 && alive === 0) {
        state = "between";
        betweenT = 2.2;
        score += wave * 25;
        $("scoreNum").textContent = score;
        showBanner("Волна отбита", `+${wave * 25} очков`);
      }
    }
    enemies = enemies.filter((e) => {
      const keep = enemyUpdate(e, dt);
      e.update(dt);
      if (!keep) e.remove();
      return keep;
    });
    separate();
    player.update(dt);

    for (let i = potions.length - 1; i >= 0; i--) {
      const p = potions[i];
      p.t += dt;
      p.obj.rotation.y += dt * 2;
      p.obj.position.y = 0.25 + Math.sin(p.t * 3) * 0.12;
      const near = !player.dead && Math.hypot(p.obj.position.x - player.pos.x, p.obj.position.z - player.pos.z) < 1.1;
      if (near) {
        const heal = Math.min(30, P.hpMax - player.hp);
        player.hp += heal;
        setHp();
        floatText(`+${Math.round(heal)}`, player.pos, "heal");
        burst(p.obj.position.clone(), "#ff4d6a", 12, 3);
        sfx("potion");
      }
      if (near || p.t > 14) { scene.remove(p.obj); potions.splice(i, 1); }
      else if (p.t > 11) p.obj.visible = Math.floor(p.t * 8) % 2 === 0;
    }
    comboT -= dt;
    if (comboT <= 0 && combo) { combo = 0; $("combo").classList.remove("on"); }
  } else if (player) {
    player.update(dt);
  }

  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $("banner").classList.remove("on"); }
  hurtT = Math.max(0, hurtT - dt);
  $("hurt").style.opacity = String(hurtT / 0.35);
  if (slashT > 0) {
    slashT -= dt;
    slash.material.opacity = Math.max(0, slashT / 0.2) * 0.75;
    slash.scale.setScalar(1 + (0.2 - slashT) * 1.2);
  } else slash.material.opacity = 0;
  for (const m of fireMats) m.emissiveIntensity = 2.6 + Math.sin(elapsed * 17 + m.id) * 0.5 + Math.random() * 0.4;

  updateParticles(dt);
  updateFloaters(dt);
  updateCamera(dt, elapsed);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// меню: рыцарь стоит в центре арены
player = makePlayer();
player.play("Idle");
$("playBtn").disabled = false;
$("playBtn").textContent = "Играть";
$("loadText").textContent = "";
document.addEventListener("visibilitychange", () => clock.getDelta());
window.__game = { get state() { return state; }, get enemies() { return enemies; }, get player() { return player; }, spawnEnemy };
requestAnimationFrame(frame);
}

main().catch((err) => {
  const el = document.getElementById("loadText");
  if (el) el.textContent = "Ошибка: " + (err && err.message || err);
});
