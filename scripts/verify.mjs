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
if (mode === 'interact') {
  const checks = [];
  const add = (name, pass, detail = '') => {
    checks.push(pass);
    console.log(`${pass ? '✓' : '✗'} ${name}  ${detail}`);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const st = (page) => page.evaluate(() => ({ ...window.__relay.state, lit: document.getElementById('v-lit').textContent, status: document.getElementById('status-text').textContent, btn: document.getElementById('pause').textContent, scroll: document.getElementById('list').scrollTop, maxScroll: document.getElementById('list').scrollHeight - document.getElementById('list').clientHeight, done: window.__relay.doneBeams() }));
  const overList = async (page) => {
    const b = await (await page.$('#list')).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  };

  // 1a. 播放到结尾后，列表能滚回顶部
  {
    const { page } = await open('?t=end', 1920, 1080);
    await sleep(800);
    const s0 = await st(page);
    await overList(page);
    await page.mouse.wheel({ deltaY: -20000 });
    await sleep(1500);
    const s1 = await st(page);
    add('结尾时列表可滚回顶部', s0.scroll > 100 && s1.scroll < 50, `滚动前 ${Math.round(s0.scroll)}/${Math.round(s0.maxScroll)} → 1.5 秒后 ${Math.round(s1.scroll)}`);
    await page.close();
  }
  // 1b. 播放中手动滚动，4 秒内不被拉回；之后恢复自动跟随
  {
    const { page } = await open('?t=20&play=1', 1920, 1080);
    await sleep(1000);
    await overList(page);
    await page.mouse.wheel({ deltaY: -20000 });
    await sleep(300);
    const a = await st(page);
    await sleep(2500);
    const b = await st(page);
    add('播放中手动滚动后不被拉回（2.5 秒内）', a.scroll < 50 && b.scroll < 50 && b.n > a.n, `滚动后 ${Math.round(a.scroll)} → ${Math.round(b.scroll)}，期间到达 ${b.n - a.n} 个天体`);
    await sleep(3500);
    const c = await st(page);
    add('停止操作 4 秒后恢复自动跟随', c.scroll > 100, `scrollTop=${Math.round(c.scroll)}（当前第 ${c.n} 个）`);
    await page.close();
  }
  // 2. 暂停 / 继续（按钮与空格）
  {
    const { page } = await open('?t=10&play=1', 1920, 1080);
    await sleep(800);
    await page.click('#pause');
    const p1 = await st(page);
    await sleep(2000);
    const p2 = await st(page);
    add('点“暂停”后 2 秒内时间不动', Math.abs(p2.t - p1.t) < 0.01 && !p2.playing, `t ${p1.t.toFixed(2)} → ${p2.t.toFixed(2)}`);
    add('按钮变“继续”、状态行“已暂停”', p2.btn.includes('继续') && p2.status === '已暂停', `按钮「${p2.btn}」状态「${p2.status}」`);
    await page.click('#pause');
    await sleep(1000);
    const p3 = await st(page);
    add('再点“继续”时间前进', p3.t > p2.t + 0.5 && p3.playing, `t ${p2.t.toFixed(2)} → ${p3.t.toFixed(2)}，按钮「${p3.btn}」`);
    await page.keyboard.press('Space');
    const k1 = await st(page);
    await sleep(1500);
    const k2 = await st(page);
    await page.keyboard.press('Space');
    await sleep(1000);
    const k3 = await st(page);
    add('空格键暂停 / 继续', Math.abs(k2.t - k1.t) < 0.01 && !k2.playing && k3.t > k2.t + 0.5, `暂停 ${k1.t.toFixed(2)}→${k2.t.toFixed(2)}，继续后 ${k3.t.toFixed(2)}`);
    await page.screenshot({ path: resolve(outDir, 'interact_paused.png') });
    await page.click('#pause'); // 留一张暂停态截图
    await sleep(500);
    await page.screenshot({ path: resolve(outDir, 'interact_paused.png') });
    await page.close();
  }
  // 3. 点击天体跳转
  {
    const { page } = await open('', 1920, 1080);
    await sleep(1000);
    for (const [i, name] of [
      [46, '土星'],
      [1, '火卫一'],
      [57, '参宿七'],
    ]) {
      await page.click(`.row[data-i="${i}"]`);
      await sleep(250);
      const s = await st(page);
      const dom = await page.evaluate((i) => ({ row: document.querySelector(`.row[data-i="${i}"]`).classList.contains('current'), label: window.__relay._dbg.labels.el(i).classList.contains('current'), now: document.getElementById('v-now').textContent }), i);
      add(`点击${name}：当前 ${i + 1}/64、已走光束 ${i} 条、标签与列表同步`, s.n === i + 1 && s.lit === `${i + 1}/64` && s.done === i && dom.row && dom.label && dom.now === name, `n=${s.n} 计数=${s.lit} 光束=${s.done} 列表=${dom.row} 标签=${dom.label} 当前=${dom.now}`);
      if (i === 46) await page.screenshot({ path: resolve(outDir, 'interact_jump_saturn.png') });
      await sleep(3000);
      const s2 = await st(page);
      add(`点击${name} 3 秒后继续接力`, s2.n > i + 1 && s2.playing, `n ${s.n} → ${s2.n}`);
    }
    await page.close();
  }
  console.log(checks.every(Boolean) ? '\nINTERACT PASS' : '\nINTERACT FAIL');
}

if (mode === 'sun') {
  // 太阳亮度：同一帧（木星 → 太阳途中）太阳周围圆形区域的平均亮度（Rec.709，0–255）
  const tag = process.argv[3] || 'now';
  const out = {};
  for (const q of ['high', 'low']) {
    const samples = [];
    for (let k = 0; k < 3; k++) {
      const { page } = await open(`?t=33.6&q=${q}`, 1920, 1080);
      await new Promise((r) => setTimeout(r, 800));
      const m = await page.evaluate(() => {
        const { world, solar } = window.__relay._dbg;
        const gl = world.renderer.getContext();
        world.render(window.__relay.state.camDist);
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        const px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const v = solar.nodes.sun.worldPos.clone().project(world.camera);
        const cx = (v.x * 0.5 + 0.5) * w;
        const cy = (v.y * 0.5 + 0.5) * h;
        const R = Math.round(h * 0.12);
        let sum = 0;
        let n = 0;
        for (let y = Math.max(0, Math.floor(cy - R)); y < Math.min(h, cy + R); y++)
          for (let x = Math.max(0, Math.floor(cx - R)); x < Math.min(w, cx + R); x++) {
            if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
            const i = (y * w + x) * 4;
            sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
            n++;
          }
        return { lum: sum / n, cx: Math.round(cx), cy: Math.round(h - cy), R, inView: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1 };
      });
      samples.push(m);
      if (k === 0) await page.screenshot({ path: resolve(outDir, `sun_${tag}_${q}.png`) });
      await page.close();
    }
    const lum = samples.reduce((a, s) => a + s.lum, 0) / samples.length;
    out[q] = { lum: +lum.toFixed(2), samples: samples.map((s) => +s.lum.toFixed(2)), center: [samples[0].cx, samples[0].cy], R: samples[0].R, inView: samples.every((s) => s.inView) };
    console.log(`${q.padEnd(4)} 太阳区域平均亮度 ${lum.toFixed(2)}  （样本 ${out[q].samples.join(' / ')}，中心 ${out[q].center}，半径 ${out[q].R}px，在画面内 ${out[q].inView}）`);
  }
  const { writeFileSync, readFileSync } = await import('node:fs');
  writeFileSync(resolve(outDir, `sun_${tag}.json`), JSON.stringify(out, null, 2));
  const beforeFile = resolve(outDir, 'sun_before.json');
  if (tag !== 'before' && existsSync(beforeFile)) {
    const before = JSON.parse(readFileSync(beforeFile, 'utf8'));
    for (const q of ['high', 'low']) {
      const ratio = out[q].lum / before[q].lum;
      console.log(`${ratio >= 0.45 && ratio <= 0.6 ? '✓' : '✗'} ${q}：改后 / 改前 = ${(ratio * 100).toFixed(1)}%（目标 45%–60%）`);
    }
  }
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
