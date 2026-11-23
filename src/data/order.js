import { SOLAR_BODIES, KM_PER_RSUN, BANDS } from './bodies.js';
import { STARS } from './stars.js';

// 接力顺序：全部天体按直径（km）严格升序。恒星直径 = 2 × R × R☉。
export function buildOrder() {
  const all = [
    ...SOLAR_BODIES.map((b) => ({ ...b })),
    ...STARS.map((s) => ({ ...s, kind: 'star', d: s.rsun * 2 * KM_PER_RSUN })),
  ];
  all.sort((a, b) => a.d - b.d);
  all.forEach((b, i) => {
    b.index = i;
    b.band = BANDS.findIndex((x) => x.test(b.d));
  });
  return all;
}

const nf = (x, digits = 0) => x.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function sizeText(b, short = false) {
  if (b.kind === 'star') {
    const r = b.rsun;
    const v = r < 10 ? nf(r, r === 1 ? 0 : 2) : nf(r, 0);
    return `${b.approx ? '约' : ''}${v} R☉`;
  }
  const d = b.d;
  const v = d < 100 ? nf(d, 1) : nf(d, 0);
  return short ? `${v} km` : `Ø${v} km`;
}
