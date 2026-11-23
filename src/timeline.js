// 确定性时间轴。节奏可选：每种节奏只决定每跳时长（卡点还决定片头片尾），状态推算共用 stateAt。
export const INTRO = 2.0;
export const OUTRO = 2.5;
export const TRAVEL = 0.72; // 每跳中光束飞行所占比例，其余为停顿
export const DEFAULT_PACE = 'gentle';

export const PACES = [
  { id: 'gentle', zh: '舒缓', desc: '与“起承转合”同样的起伏，但每跳至少 1 秒' },
  { id: 'classic', zh: '起承转合', desc: '慢起步 → 中段快速穿梭 → 飞出太阳系放慢 → 超巨星收尾' },
  { id: 'uniform', zh: '匀速', desc: '每跳都是 0.9 秒' },
  { id: 'lightpath', zh: '光程', desc: '按真实距离：卫星之间一闪而过，恒星之间最久' },
  { id: 'beat', zh: '卡点', desc: '每次起跳和到达都落在节拍上（默认 120 BPM，可用 ?bpm= 调整），便于对齐配乐' },
  { id: 'slowing', zh: '渐慢', desc: '天体越大光走得越慢：从 0.5 秒逐跳放慢到 1.8 秒' },
];
export const isPace = (id) => PACES.some((p) => p.id === id);

// 起承转合（原有节奏）：先慢、中段加速、恒星段放慢做高潮
export function jumpDuration(k) {
  if (k <= 2) return 1.4; // 起步：火卫二 → 火卫一 → 天卫十五 → 木卫五
  if (k <= 8) return 1.15 - (k - 3) * 0.11; // 加速
  if (k <= 37) return 0.48; // 小天体快速穿梭
  if (k <= 39) return 0.6; // → 土卫六、木卫三
  if (k <= 46) return 0.9; // → 火星 … 木星
  if (k === 47) return 1.6; // 木星 → 太阳
  if (k === 48) return 3.0; // 太阳 → 南门二A：飞出太阳系
  if (k <= 52) return 1.2; // → 天狼星、河鼓二、织女星、北河三
  if (k <= 57) return 1.3; // → 大角星 … 天津四
  return [1.6, 1.8, 2.0, 2.2, 2.6][k - 58]; // 最后 5 颗超巨星
}

// 卡点：每跳拍数（与起承转合同样的分段）
function beatsOf(k, last) {
  if (k <= 2) return 3; // 起步
  if (k <= 46) return 2; // 小天体与行星
  if (k === 47) return 4; // 木星 → 太阳
  if (k === 48) return 8; // 飞出太阳系
  if (k <= 57) return 3; // 恒星
  return k === last ? 6 : 4; // 超巨星，最后一跳 6 拍
}

// segAu：每跳的真实光程（AU，光程节奏用）；bpm：卡点节拍
export function buildSchedule(n, paceId = DEFAULT_PACE, { segAu = [], bpm = 120 } = {}) {
  const K = n - 1;
  let pace = isPace(paceId) ? paceId : DEFAULT_PACE;
  if (pace === 'lightpath' && segAu.length !== K) pace = 'uniform';
  const ks = Array.from({ length: K }, (_, k) => k);
  let intro = INTRO;
  let outro = OUTRO;
  let first = 1.0; // 火卫二点亮的时刻
  let durs;
  let travels;
  if (pace === 'beat') {
    const b = 60 / bpm;
    const beats = ks.map((k) => beatsOf(k, K - 1));
    durs = beats.map((x) => x * b);
    // 飞行与停顿都取整拍：起跳和到达都落在拍点上
    travels = beats.map((x) => Math.max(1, Math.round(TRAVEL * x)) * b);
    intro = 4 * b;
    first = 2 * b;
    outro = 5 * b;
  } else {
    if (pace === 'classic') durs = ks.map(jumpDuration);
    else if (pace === 'gentle') durs = ks.map((k) => Math.max(jumpDuration(k), 1.0));
    else if (pace === 'uniform') durs = ks.map(() => 0.9);
    else if (pace === 'slowing') durs = ks.map((k) => 0.5 + (1.3 * k) / (K - 1));
    else {
      // 光程：按 log10(真实距离) 单调映射到 0.45–2.2 秒；1.2 次方略压短端，使全程约 80 秒、中段约 1 秒
      const lg = segAu.map((au) => Math.log10(au));
      const lo = Math.min(...lg);
      const hi = Math.max(...lg);
      durs = lg.map((x) => 0.45 + 1.75 * Math.pow((x - lo) / (hi - lo), 1.2));
    }
    travels = durs.map((d) => d * TRAVEL);
  }

  const jumps = [];
  const arrive = [first];
  let t = intro;
  for (let k = 0; k < K; k++) {
    jumps.push({ k, start: t, dur: durs[k], travel: travels[k] });
    arrive.push(t + travels[k]);
    t += durs[k];
  }
  return { pace, bpm: pace === 'beat' ? bpm : null, jumps, arrive, durations: durs, end: t + outro, lastJumpEnd: t };
}

// 两张时间表的关键时刻一一对应：首亮、每跳起跳 / 到达、最后一跳结束、结尾
function keyTimes(s) {
  const keys = [0, s.arrive[0]];
  for (const j of s.jumps) keys.push(j.start, j.start + j.travel);
  keys.push(s.lastJumpEnd, s.end);
  return keys;
}

// 换节奏时换算时刻：保持在同一天体、同一段飞行 / 停顿的同一进度
export function remapTime(from, to, t) {
  const a = keyTimes(from);
  const b = keyTimes(to);
  if (t <= 0) return 0;
  if (t >= from.end) return to.end;
  let i = 0;
  while (i < a.length - 2 && t >= a[i + 1]) i++;
  const span = a[i + 1] - a[i];
  const f = span > 0 ? (t - a[i]) / span : 0;
  return b[i] + f * (b[i + 1] - b[i]);
}

const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

// 给定时刻的状态
export function stateAt(sched, t) {
  let n = 0;
  while (n < sched.arrive.length && sched.arrive[n] <= t) n++;
  let active = null;
  let hold = null;
  for (const j of sched.jumps) {
    if (t >= j.start && t < j.start + j.travel) {
      const p = (t - j.start) / j.travel;
      active = { k: j.k, p, pe: ease(p) };
      break;
    }
    if (t >= j.start + j.travel && t < j.start + j.dur) {
      hold = { k: j.k, h: (t - j.start - j.travel) / (j.dur - j.travel) };
      break;
    }
  }
  return { n, active, hold, done: t >= sched.lastJumpEnd };
}
