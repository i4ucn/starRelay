// 开发阶段运行一次：从 JPL Horizons 抓取太阳系天体在 2026-11-23 00:00 TDB 的状态向量，
// 写入 src/data/solar.json。网页运行时不访问网络。
// 用法：npm run fetch-data
import { writeFileSync } from 'node:fs';
import { SOLAR_BODIES } from '../src/data/bodies.js';

const EPOCH = '2026-11-23';
const STOP = '2026-11-24';
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

const byId = Object.fromEntries(SOLAR_BODIES.map((b) => [b.id, b]));

async function vectors(command, center) {
  const p = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: `'${center}'`,
    START_TIME: `'${EPOCH}'`,
    STOP_TIME: `'${STOP}'`,
    STEP_SIZE: "'1 d'",
    REF_PLANE: "'ECLIPTIC'",
    REF_SYSTEM: "'ICRF'",
    OUT_UNITS: "'AU-D'",
    VEC_TABLE: "'2'",
    CSV_FORMAT: "'YES'",
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}?${p}`);
      const j = await res.json();
      const txt = j.result || '';
      const s = txt.indexOf('$$SOE');
      const e = txt.indexOf('$$EOE');
      if (s < 0 || e < 0) throw new Error('no ephemeris block:\n' + txt.slice(0, 600));
      const line = txt.slice(s + 5, e).trim().split('\n')[0];
      const f = line.split(',').map((x) => x.trim());
      const nums = f.slice(2, 8).map(Number);
      if (nums.some((n) => !Number.isFinite(n))) throw new Error('parse error: ' + line);
      const name = (txt.match(/Target body name:\s*(.+?)\s{2,}/) || [])[1] || '';
      return { r: nums.slice(0, 3), v: nums.slice(3, 6), name };
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

const out = {
  epoch: `${EPOCH} 00:00 TDB`,
  frame: 'Ecliptic of J2000.0, ICRF; r in au, v in au/day',
  source: 'JPL Horizons API (ssd.jpl.nasa.gov/api/horizons.api)',
  fetched: new Date().toISOString(),
  bodies: {},
};

for (const b of SOLAR_BODIES) {
  if (b.id === 'sun') continue;
  const helio = await vectors(b.hz, '500@10');
  const rec = { r: helio.r, v: helio.v, horizonsName: helio.name };
  if (b.parent) {
    const parentHz = byId[b.parent].hz;
    const rel = await vectors(b.hz, `500@${parentHz}`);
    rec.rel = { r: rel.r, v: rel.v };
  }
  out.bodies[b.id] = rec;
  const dist = Math.hypot(...helio.r).toFixed(3);
  console.log(`${b.id.padEnd(10)} ${helio.name.padEnd(34)} r=${dist} au${rec.rel ? `  rel=${(Math.hypot(...rec.rel.r) * 1.495978707e8).toFixed(0)} km` : ''}`);
  await new Promise((r) => setTimeout(r, 250));
}

writeFileSync(new URL('../src/data/solar.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`\nwrote ${Object.keys(out.bodies).length} bodies → src/data/solar.json`);
