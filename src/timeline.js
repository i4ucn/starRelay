// 确定性时间轴：节奏先慢、中段加速、恒星段放慢做高潮。
export const INTRO = 2.0;
export const OUTRO = 2.5;
export const TRAVEL = 0.72; // 每跳中光束飞行所占比例，其余为停顿

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

export function buildSchedule(n) {
  const jumps = [];
  const arrive = [1.0];
  let t = INTRO;
  for (let k = 0; k < n - 1; k++) {
    const d = jumpDuration(k);
    jumps.push({ k, start: t, dur: d, travel: d * TRAVEL });
    arrive.push(t + d * TRAVEL);
    t += d;
  }
  return { jumps, arrive, end: t + OUTRO, lastJumpEnd: t };
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
