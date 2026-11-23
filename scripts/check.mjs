// 数据校验：npm run check
import { readFileSync } from 'node:fs';
import { buildOrder, sizeText } from '../src/data/order.js';
import { BANDS, SOLAR_BODIES } from '../src/data/bodies.js';

const solar = JSON.parse(readFileSync(new URL('../src/data/solar.json', import.meta.url), 'utf8'));
const order = buildOrder();
const errors = [];

if (order.length !== 64) errors.push(`天体数应为 64，实际 ${order.length}`);
for (let i = 1; i < order.length; i++) {
  if (!(order[i].d > order[i - 1].d)) errors.push(`尺寸未严格递增：${order[i - 1].id}(${order[i - 1].d}) ≥ ${order[i].id}(${order[i].d})`);
}
const ids = new Set();
for (const b of order) {
  if (ids.has(b.id)) errors.push(`重复 id：${b.id}`);
  ids.add(b.id);
  if (b.band < 0) errors.push(`${b.id} 不属于任何分段`);
  if (!b.src) errors.push(`${b.id} 缺少数据来源`);
}
// 分段必须连续
for (let i = 1; i < order.length; i++) {
  if (order[i].band < order[i - 1].band) errors.push(`分段不连续：${order[i - 1].id} → ${order[i].id}`);
}
// 太阳系天体都要有 Horizons 位置
for (const b of SOLAR_BODIES) {
  if (b.id === 'sun') continue;
  const rec = solar.bodies[b.id];
  if (!rec) errors.push(`solar.json 缺少 ${b.id}`);
  else if (b.parent && !rec.rel) errors.push(`solar.json 缺少 ${b.id} 相对母星的位置`);
}

console.log(`位置历元：${solar.epoch}（${solar.source}）\n`);
let band = -1;
for (const b of order) {
  if (b.band !== band) {
    band = b.band;
    const n = order.filter((x) => x.band === band).length;
    console.log(`── ${BANDS[band].key} ${BANDS[band].label}（${n}）`);
  }
  console.log(`  ${String(b.index + 1).padStart(2, '0')}  ${b.zh.padEnd(7, '　')} ${b.en.padEnd(17)} ${sizeText(b).padStart(14)}  [${b.kind}]`);
}

if (errors.length) {
  console.error(`\n✗ 校验失败（${errors.length}）：\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`\n✓ 校验通过：${order.length} 个天体，直径严格递增，${BANDS.length} 段连续，太阳系位置齐全`);
console.log('ORDER=' + order.map((b) => b.id).join(','));
