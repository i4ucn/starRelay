// 验收脚本：用本机 Chrome（无头）以 file:// 打开页面，检查验收条件并截图。
// 用法：
//   node scripts/verify.mjs shots [t1,t2,...]   固定时刻截图 + 布局 / 控制台 / 网络检查（1920×1080 与 1280×720）
//   node scripts/verify.mjs full [low]          完整播放一轮：事件同帧、总时长、终态、帧率
import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const pageUrl = pathToFileURL(resolve('index.html')).href;
const outDir = resolve('shots');
mkdirSync(outDir, { recursive: true });
const mode = process.argv[2] || 'shots';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 600000,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files', '--hide-scrollbars'],
});

async function open(query, w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const errors = [];
  const external = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('request', (r) => {
    const u = r.url();
    if (!/^(file|data|blob):/.test(u)) external.push(u);
  });
  page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()}`));
  await page.goto(`${pageUrl}${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__relay && window.__relay.state.frame > 3, { timeout: 60000 });
  return { page, errors, external };
}

const layoutCheck = () => {
  const ids = ['top', 'bands', 'side', 'view'];
  const rects = Object.fromEntries(ids.map((id) => [id, document.getElementById(id).getBoundingClientRect()]));
  rects.footer = document.querySelector('footer').getBoundingClientRect();
  const names = Object.keys(rects);
  const overlaps = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = rects[names[i]];
      const b = rects[names[j]];
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 1 && iy > 1) overlaps.push(`${names[i]}×${names[j]}`);
    }
  const clipped = [...document.querySelectorAll('.tile, .band, #stats')].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'none').length;
  return {
    hScroll: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
    overlaps,
    clipped,
    bottom: Math.round(rects.footer.bottom),
    innerH: window.innerHeight,
  };
};

if (mode === 'shots') {
  const times = (process.argv[3] || '5,25,40,end').split(',');
  const extra = process.argv[4] ? `&${process.argv[4]}` : ''; // 例如 q=high
  const tag = process.argv[4] ? `_${process.argv[4].replace(/[^a-z0-9]/gi, '')}` : '';
  const sizes = [
    [1920, 1080],
    [1280, 720],
  ];
  let ok = true;
  for (const [w, h] of sizes) {
    for (const t of times) {
      const { page, errors, external } = await open(`?t=${t}${extra}`, w, h);
      await new Promise((r) => setTimeout(r, 1200));
      const lay = await page.evaluate(layoutCheck);
      const st = await page.evaluate(() => ({ ...window.__relay.state, now: document.getElementById('v-now').textContent, lit: document.getElementById('v-lit').textContent }));
      const file = resolve(outDir, `shot_${w}x${h}_t${t}${tag}.png`);
      await page.screenshot({ path: file });
      const pass = !errors.length && !external.length && !lay.hScroll && !lay.overlaps.length && lay.bottom <= lay.innerH;
      ok &&= pass;
      console.log(`${pass ? '✓' : '✗'} ${w}x${h} t=${t}  lit=${st.lit} now=${st.now}  hScroll=${lay.hScroll} overlaps=${lay.overlaps.join(',') || 'none'} clippedTiles=${lay.clipped} footerBottom=${lay.bottom}/${lay.innerH}  errors=${errors.length} external=${external.length}  → ${file}`);
      errors.forEach((e) => console.log('   ', e));
      external.forEach((e) => console.log('    external:', e));
      await page.close();
    }
  }
  console.log(ok ? '\nSHOTS PASS' : '\nSHOTS FAIL');
} else if (mode === 'full') {
  const low = process.argv[3] === 'low';
  const { page, errors, external } = await open(low ? '?q=low' : '', 1920, 1080);
  const t0 = Date.now();
  const f0 = await page.evaluate(() => window.__relay.state.frame);
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await page.evaluate(() => window.__relay.state);
    process.stdout.write(`  t=${s.t.toFixed(1)}s n=${s.n} frame=${s.frame}\r`);
    if (!s.playing) break;
    if (Date.now() - t0 > 600000) throw new Error('播放超时');
  }
  console.log('');
  const wall = (Date.now() - t0) / 1000;
  const r = await page.evaluate(() => {
    const R = window.__relay;
    const cells = [...document.querySelectorAll('.b-cells i')];
    return {
      order: R.order,
      sizes: R.sizesKm,
      events: R.events,
      end: R.schedule.end,
      state: R.state,
      lit: document.getElementById('v-lit').textContent,
      bands: [...document.querySelectorAll('.b-count')].map((e) => e.textContent),
      cellsLit: cells.filter((c) => c.className === 'lit' || c.className === 'cur').length,
      cellsTotal: cells.length,
      opacity: R.beamOpacity,
    };
  });
  const frames = r.state.frame - f0;
  await page.screenshot({ path: resolve(outDir, `full_end${low ? '_low' : ''}.png`) });
  const expectedOrder = execSync('node scripts/check.mjs').toString().match(/ORDER=(.+)/)[1].trim().split(',');
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass, detail });
  add('无控制台错误 / 外部请求', !errors.length && !external.length, `errors=${errors.length} external=${external.length}`);
  add('接力顺序与数据表一致', JSON.stringify(r.order) === JSON.stringify(expectedOrder), `${r.order.length} 项`);
  add('尺寸严格递增', r.sizes.every((d, i) => i === 0 || d > r.sizes[i - 1]), '');
  const arrivals = r.events.filter((e) => e.i > 0);
  const bad = r.events.filter((e) => !(e.label && e.list && e.counter));
  add('63 次到达，标签 / 列表 / 计数同帧更新', arrivals.length === 63 && !bad.length, `到达 ${arrivals.length} 次，不同步 ${bad.length} 次`);
  const late = r.events.map((e) => e.t - e.tSched);
  const overOneFrame = r.events.filter((e) => e.t - e.tSched > e.frameDt + 1e-3);
  add('到达时刻与时间轴一致（滞后不超过 1 帧）', !overOneFrame.length && Math.min(...late) >= -1e-6, `最大滞后 ${Math.max(...late).toFixed(3)}s，超过 1 帧 ${overOneFrame.length} 次`);
  const o = r.opacity;
  add('已走光束亮度 ≤ 当前 35%', o.doneCore / o.activeCore <= 0.35 && o.doneGlow / o.activeGlow <= 0.35, `core ${((o.doneCore / o.activeCore) * 100).toFixed(0)}%  glow ${((o.doneGlow / o.activeGlow) * 100).toFixed(0)}%`);
  add('总时长 55–65 秒（时间轴）', r.end >= 55 && r.end <= 65, `${r.end.toFixed(2)} s；实际墙钟 ${wall.toFixed(1)} s`);
  add('终态 64/64、五段进度全满', r.lit === '64/64' && r.cellsLit === r.cellsTotal && r.bands.every((b) => b.split('/')[0] === b.split('/')[1]), `${r.lit} ${r.bands.join(' ')}`);
  checks.forEach((c) => console.log(`${c.pass ? '✓' : '✗'} ${c.name}  ${c.detail}`));
  console.log(`帧率（${low ? '低画质' : '默认画质'}，无头 Chrome）：${(frames / wall).toFixed(1)} fps（${frames} 帧 / ${wall.toFixed(1)} s）`);
  errors.forEach((e) => console.log('   ', e));
  console.log(checks.every((c) => c.pass) ? '\nFULL PASS' : '\nFULL FAIL');
}
if (mode === 'fps') {
  // 分别在太阳系阶段与银河阶段采样 6 秒
  for (const q of ['', 'q=low', 'q=high']) {
    const res = [];
    for (const t of [5, 50]) {
      const { page } = await open(`?t=${t}&play=1${q ? '&' + q : ''}`, 1920, 1080);
      await new Promise((r) => setTimeout(r, 1500));
      const fps = await page.evaluate(() => window.__relay.measureFps(6000));
      const quality = await page.evaluate(() => window.__relay.quality);
      res.push(`t≈${t}s ${fps.toFixed(1)} fps`);
      if (t === 5) res.unshift(`[${q || '自动'} → ${quality}]`);
      await page.close();
    }
    console.log(res.join('  '));
  }
}
await browser.close();
