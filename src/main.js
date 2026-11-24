import * as THREE from 'three';
import solarData from './data/solar.json';
import { buildOrder } from './data/order.js';
import { LY, LY_AU, starGalLy } from './math/astro.js';
import { createWorld } from './scene/world.js';
import { createSolarSystem } from './scene/solar.js';
import { createGalaxy } from './scene/galaxy.js';
import { createBeams, BEAM_OPACITY, BEAM_WIDTH } from './beam.js';
import { createRig } from './camera.js';
import { buildSchedule, stateAt, remapTime, PACES, DEFAULT_PACE, isPace } from './timeline.js';
import { createHud } from './ui/hud.js';
import { createList } from './ui/list.js';
import { createLabels } from './ui/labels.js';

const params = new URLSearchParams(location.search);

// 没有 GPU（软件渲染）时自动切到低画质；?q=high 强制高画质，?q=low 强制低画质
function detectSoftwareGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return { name, software: /SwiftShader|Basic Render|llvmpipe|softpipe|Software/i.test(name) };
  } catch {
    return { name: '', software: false };
  }
}
const gpu = detectSoftwareGL();
const q = params.get('q');
const low = q === 'low' || (q !== 'high' && gpu.software);
if (low) document.querySelector('.epoch').textContent += gpu.software && q !== 'low' ? ' · 低画质（未检测到 GPU）' : ' · 低画质';

const order = buildOrder();
const N = order.length;
const wrap = document.getElementById('canvas-wrap');
const world = createWorld(wrap, { low });
const solar = createSolarSystem(world.scene, order, solarData, { low });
const galaxy = createGalaxy(world.scene, order, { low });
const nodes = order.map((b) => solar.nodes[b.id] || galaxy.nodes[b.id]);
const beams = createBeams(world.scene, world, nodes);
const rig = createRig(world.camera, world.renderer.domElement);
const hud = createHud(order);
const list = createList(order, (i) => jumpTo(i));
const labels = createLabels(order, nodes, world.scene);

// ---------- 真实光程（AU） ----------
const realAu = order.map((b) => {
  if (b.id === 'sun') return [0, 0, 0];
  if (b.kind === 'star') return starGalLy(b.ra_deg, b.dec_deg, b.distLy).map((c) => c * LY_AU);
  return solarData.bodies[b.id].r;
});
const segAu = [];
const cumAu = [0];
for (let k = 0; k < N - 1; k++) {
  const [a, b] = [realAu[k], realAu[k + 1]];
  segAu.push(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  cumAu.push(cumAu[k] + segAu[k]);
}

// ---------- 记住的播放设置（节奏、速度）----------
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, v) {
    try {
      localStorage.setItem(key, String(v));
    } catch {
      /* 存不了就只在本次生效 */
    }
  },
};

// ---------- 节奏 ----------
// 优先级：?pace= → 上次的选择（localStorage）→ 默认“舒缓”；?bpm= 只影响“卡点”
const bpm = Math.min(240, Math.max(40, Number(params.get('bpm')) || 120));
const PACE_KEY = 'star-relay.pace';
const schedCache = {};
const scheduleOf = (id) => (schedCache[id] ||= buildSchedule(N, id, { segAu, bpm }));
let pace = [params.get('pace'), store.get(PACE_KEY)].find(isPace) || DEFAULT_PACE;
let sched = scheduleOf(pace);

// ---------- 速度（整段动画等比例快慢，0.25×–4×）----------
// 优先级：?speed= → 上次的选择 → 1
const SPEED_KEY = 'star-relay.speed';
const SPEED_MIN = 0.25;
const SPEED_MAX = 4;
const clampSpeed = (v) => Math.min(SPEED_MAX, Math.max(SPEED_MIN, v));
let speed = clampSpeed([Number(params.get('speed')), Number(store.get(SPEED_KEY))].find((v) => v > 0) || 1);

// ---------- 天体点亮状态 ----------
const GOLD = new THREE.Color(0xffc85a);
const WHITE_GOLD = new THREE.Color(0xfff1c8);
for (const nd of nodes) nd.marker.userData.baseColor = nd.marker.material.color.clone();
function paintNode(i, state) {
  const nd = nodes[i];
  const m = nd.marker.material;
  if (state === 'pending') {
    m.color.copy(nd.marker.userData.baseColor);
    m.userData.op = 0.6;
    nd.marker.scale.setScalar(nd.solar ? 0.014 : nd.baseSize * 0.6);
    nd.halo.material.userData.op = 0;
  } else {
    m.color.copy(state === 'current' ? WHITE_GOLD : GOLD);
    m.userData.op = 1;
    const s = nd.solar ? (state === 'current' ? 0.026 : 0.018) : nd.baseSize * (state === 'current' ? 1.25 : 0.9);
    nd.marker.scale.setScalar(s);
    nd.halo.material.userData.op = state === 'current' ? 0.7 : 0.4;
  }
}

// ---------- 状态与事件日志（供验收读取） ----------
let t = 0;
let playing = true;
let frame = 0;
let lastDt = 0;
let shownN = -1;
const events = [];

// quiet=true：跳转 / 定位时静默应用（不补放冲击波、不记到达事件）
function applyN(n, quiet) {
  if (n === shownN) return;
  const prev = shownN;
  for (let i = 0; i < N; i++) paintNode(i, i < n - 1 ? 'lit' : i === n - 1 ? 'current' : 'pending');
  for (let k = 0; k < N - 1; k++) if (k < n - 1) beams.set(k, 'done');
  // 同一帧内同步更新：标签、列表、计数
  labels.setN(n);
  list.setN(n);
  hud.setN(n);
  beams.setTarget(n > 0 ? nodes[n - 1].worldPos : null);
  if (!quiet && n > prev) {
    for (let i = Math.max(prev, 0); i < n; i++) {
      beams.pulse(nodes[i].worldPos, performance.now() / 1000);
      events.push({
        i,
        id: order[i].id,
        zh: order[i].zh,
        tSched: +sched.arrive[i].toFixed(3),
        t: +t.toFixed(3),
        frame,
        frameDt: +(lastDt * speed).toFixed(3), // 本帧时间步长：到达检测最多滞后一帧
        label: labels.el(i).classList.contains('shown'),
        labelCurrent: labels.el(i).classList.contains('current'),
        list: list.row(i).classList.contains('current') || list.row(i).classList.contains('lit'),
        counter: hud.counterText() === `${n}/${N}`,
      });
    }
  }
  shownN = n;
}

// ---------- 镜头取景 ----------
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
function segFrame(k) {
  const A = nodes[k].worldPos;
  const B = nodes[k + 1].worldPos;
  const len = A.distanceTo(B);
  const dist = Math.max(len * 1.3, nodes[k].minFrame, nodes[k + 1].minFrame);
  return { target: tmpA.copy(A).lerp(B, 0.5).clone(), dist, pitch: nodes[k + 1].solar ? 0.5 : 0.42 };
}
// 结尾：对准“太阳 → 史蒂文森2-18”整条光链，并带上一大片银盘
const outro = { target: nodes[N - 1].worldPos.clone().multiplyScalar(0.5), dist: 42000 * LY, pitch: 0.8 };
function desiredFrame(s) {
  if (s.done) return outro;
  if (s.active) return segFrame(s.active.k);
  if (s.hold) {
    const a = segFrame(s.hold.k);
    if (s.hold.k + 1 >= N - 1) {
      const h = THREE.MathUtils.smoothstep(s.hold.h, 0, 1);
      return { target: a.target.lerp(outro.target, h * 0.15), dist: Math.exp(THREE.MathUtils.lerp(Math.log(a.dist), Math.log(outro.dist), h * 0.15)), pitch: a.pitch };
    }
    const b = segFrame(s.hold.k + 1);
    const h = THREE.MathUtils.smoothstep(s.hold.h, 0.1, 1);
    return {
      target: a.target.lerp(b.target, h),
      dist: Math.exp(THREE.MathUtils.lerp(Math.log(a.dist), Math.log(b.dist), h)),
      pitch: THREE.MathUtils.lerp(a.pitch, b.pitch, h),
    };
  }
  return segFrame(0);
}

const worldUp = new THREE.Vector3(0, 1, 0);
const up = new THREE.Vector3();
let lastCamDist = 30;

// snap：镜头瞬移；quiet：静默应用状态
function step(dt, snap, quiet = snap) {
  lastDt = dt;
  const s = stateAt(sched, t);
  const paused = !playing && t < sched.end;
  applyN(s.n, quiet);

  // 光束
  for (let k = 0; k < N - 1; k++) {
    if (k < s.n - 1) continue;
    if (s.active && s.active.k === k) beams.set(k, 'active', s.active.pe);
    else beams.set(k, 'hidden');
  }
  if (s.active) {
    const k = s.active.k;
    beams.setHead(tmpB.copy(nodes[k].worldPos).lerp(nodes[k + 1].worldPos, s.active.pe));
  } else beams.setHead(null);

  // 实时光程
  const live = s.active ? cumAu[s.active.k] + segAu[s.active.k] * s.active.pe : cumAu[Math.max(0, s.n - 1)];
  hud.setLive(live, s.active ? segAu[s.active.k] : 0);
  hud.setPhase({ milky: s.n >= 50 || (s.active && s.active.k >= 48), done: s.done, paused, ended: t >= sched.end });

  // 镜头
  const f = desiredFrame(s);
  rig.frame(f.target, f.dist, f.pitch);
  const g = THREE.MathUtils.smoothstep(Math.log10(lastCamDist), Math.log10(80), Math.log10(2e4));
  up.copy(solar.eclipticUp).lerp(worldUp, g).normalize();
  // 暂停时画面静止：停掉自动环绕与自转（拖动、缩放仍可用）
  // 播放时镜头与自转随速度等比例加快 / 放慢（否则 4 倍速下镜头跟不上）；暂停时用真实时间
  const simDt = paused ? dt : dt * speed;
  const camDist = rig.update(simDt, t, { snap, up, yawSpeed: paused ? 0 : s.done ? 0.03 : 0.07 });
  lastCamDist = camDist;

  // 淡入淡出
  const solarFade = solar.update(paused ? 0 : simDt, camDist);
  world.setBloom(galaxy.update(camDist));
  for (const nd of nodes) {
    const base = nd.marker.material.userData.op ?? 0.6;
    const fade = nd.solar && nd.body.id !== 'sun' ? solarFade : 1;
    nd.marker.material.opacity = base * fade;
    nd.halo.material.opacity = (nd.halo.material.userData.op || 0) * fade;
  }
  labels.update(world.camera.position, solarFade);
  list.update(dt, snap);
  beams.update(performance.now() / 1000);
  world.render(camDist);
  frame++;
}

// ---------- 主循环 ----------
let last = performance.now();
function loop(now) {
  // rAF 时间戳是帧开始时刻，可能早于初始化结束时记下的 last（首帧编译着色器很慢），
  // 不能让时间倒退：下限 0；上限 0.25 秒，慢机器上也尽量保持实时节奏
  const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  if (playing) {
    t = Math.min(sched.end, t + dt * speed);
    if (t >= sched.end) playing = false;
  }
  step(dt, false);
  fpsCount++;
  requestAnimationFrame(loop);
}
let fpsCount = 0;

function seek(time) {
  t = Math.max(0, Math.min(sched.end, time));
  shownN = -1;
  step(0, true);
}
function replay() {
  events.length = 0;
  shownN = -1;
  t = 0;
  playing = true;
  for (let k = 0; k < N - 1; k++) beams.set(k, 'hidden');
  rig.state.target.set(0, 0, 0);
  rig.state.logDist = Math.log(26);
  step(0, false);
}

// 暂停 / 继续；播完后“播放”即重播
function setPlaying(p) {
  if (p && t >= sched.end) return replay();
  playing = p;
}

// 点击列表中的天体：跳到它被点亮的时刻继续播放，镜头平滑飞过去
const jumps = [];
function jumpTo(i) {
  t = sched.arrive[i];
  shownN = -1;
  playing = true;
  step(0, false, true);
  beams.pulse(nodes[i].worldPos, performance.now() / 1000);
  jumps.push({ to: i, id: order[i].id, t: +t.toFixed(3), frame });
}

// 切换节奏：换算到新时间表里的同一天体、同一飞行进度；播放 / 暂停状态不变
const paceSel = document.getElementById('pace');
const paceInfo = (id) => PACES.find((p) => p.id === id);
paceSel.innerHTML = PACES.map((p) => `<option value="${p.id}">${p.zh} · ${Math.round(scheduleOf(p.id).end)}s</option>`).join('');
function syncPaceUi() {
  paceSel.value = pace;
  paceSel.title = `${paceInfo(pace).zh}：${paceInfo(pace).desc}`;
}
syncPaceUi();
const paceSwitches = [];
function setPace(id) {
  if (!isPace(id) || id === pace) return;
  const next = scheduleOf(id);
  const from = t;
  t = remapTime(sched, next, t);
  sched = next;
  pace = id;
  store.set(PACE_KEY, id);
  syncPaceUi();
  paceSwitches.push({ pace: id, from: +from.toFixed(3), to: +t.toFixed(3), n: shownN, frame });
}
paceSel.addEventListener('change', () => (paceSel.blur(), setPace(paceSel.value)));

// 焦距滑块：在自动取景的基础上整体拉近 / 拉远（右 = 拉近，×20 … ÷20），松手保持；滚轮联动；双击复位
const zoomEl = document.getElementById('zoom');
const zoomVal = document.getElementById('zoom-val');
function showZoom(z) {
  const m = Math.exp(-z); // 放大倍数
  zoomEl.value = String(-z);
  zoomVal.textContent = m >= 1 ? `×${m.toFixed(1)}` : `÷${(1 / m).toFixed(1)}`;
}
function setZoom(z) {
  rig.setZoom(z);
  showZoom(rig.zoom);
}
zoomEl.addEventListener('input', () => setZoom(-Number(zoomEl.value)));
zoomEl.addEventListener('change', () => zoomEl.blur()); // 松手即释放焦点，空格仍是暂停
zoomEl.addEventListener('dblclick', () => (setZoom(0), zoomEl.blur()));
rig.onZoom(showZoom);
showZoom(rig.zoom);

// 速度滑块：对数刻度，取值 log2(速度)，-2…2 即 ×0.25…×4；松手保持并记住；双击复位
const speedEl = document.getElementById('speed');
const speedVal = document.getElementById('speed-val');
function setSpeed(v, save = true) {
  speed = clampSpeed(v);
  speedEl.value = String(Math.log2(speed));
  speedVal.textContent = speed < 1 ? `×${speed.toFixed(2)}` : `×${speed.toFixed(1)}`;
  if (save) store.set(SPEED_KEY, speed);
}
speedEl.addEventListener('input', () => setSpeed(2 ** Number(speedEl.value)));
speedEl.addEventListener('change', () => speedEl.blur());
speedEl.addEventListener('dblclick', () => (setSpeed(1), speedEl.blur()));
setSpeed(speed, false);

// 点完按钮即释放焦点，避免随后按空格同时触发按钮与快捷键
document.getElementById('replay').addEventListener('click', (e) => (e.currentTarget.blur(), replay()));
document.getElementById('pause').addEventListener('click', (e) => (e.currentTarget.blur(), setPlaying(!playing)));
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement) return; // 节奏菜单有焦点时，按键交给菜单
  if (e.code === 'Space') {
    e.preventDefault();
    setPlaying(!playing);
  } else if (e.key === 'r' || e.key === 'R') replay();
});

// 初始：从太阳系全景俯冲到火星
rig.state.target.set(0, 0, 0);
rig.state.logDist = Math.log(26);
const tParam = params.get('t');
if (tParam !== null) {
  seek(tParam === 'end' ? sched.end : Number(tParam));
  playing = params.get('play') === '1';
}
requestAnimationFrame(loop);

// ---------- 验收接口 ----------
const scheduleView = (s) => ({
  pace: s.pace,
  bpm: s.bpm,
  arrive: s.arrive,
  starts: s.jumps.map((j) => j.start),
  travels: s.jumps.map((j) => j.travel),
  durations: s.durations,
  end: s.end,
  lastJumpEnd: s.lastJumpEnd,
});
window.__relay = {
  order: order.map((b) => b.id),
  names: order.map((b) => `${b.zh} ${b.en}`),
  sizesKm: order.map((b) => b.d),
  get schedule() {
    return scheduleView(sched);
  },
  scheduleOf: (id) => scheduleView(scheduleOf(id)),
  get pace() {
    return pace;
  },
  paces: PACES.map((p) => ({ ...p, end: scheduleOf(p.id).end })),
  setPace,
  paceSwitches,
  segAu,
  events,
  beamOpacity: BEAM_OPACITY,
  beamWidth: BEAM_WIDTH,
  quality: low ? 'low' : 'high',
  gpu,
  get state() {
    return { t, playing, frame, n: shownN, camDist: lastCamDist, zoom: rig.zoom, autoDist: Math.exp(rig.state.logDist), speed };
  },
  get speed() {
    return speed;
  },
  setSpeed,
  setZoom,
  seek,
  play: () => setPlaying(true),
  pause: () => setPlaying(false),
  replay,
  jumpTo,
  jumps,
  doneBeams: () => beams.beams.filter((b) => b.state === 'done').length,
  _dbg: { world, solar, galaxy, beams, labels },
  measureFps(ms = 5000) {
    const c0 = fpsCount;
    const t0 = performance.now();
    return new Promise((res) => setTimeout(() => res(((fpsCount - c0) * 1000) / (performance.now() - t0)), ms));
  },
};
