// 验收脚本：用本机 Chrome（无头）以 file:// 打开页面，检查验收条件并截图。
// 用法：
//   node scripts/verify.mjs shots [t1,t2,...]   固定时刻截图（起承转合节奏）+ 布局 / 控制台 / 网络检查（1920×1080 与 1280×720）
//   node scripts/verify.mjs full [low] [pace=xx|all]  完整播放一轮：事件同帧、总时长、终态、帧率
//   node scripts/verify.mjs pace                 6 种节奏的时间表、切换、默认值与记忆、线宽
//   node scripts/verify.mjs milky <tag>          结尾画面银河旋臂区域平均亮度（与 milky_before.json 对比）
//   node scripts/verify.mjs rings <tag>          到达光圈亮度（同帧同尺寸对比系数 1 与当前系数）与冲击环大小
import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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

async function open(query, w, h, ctx = browser) {
  const page = await ctx.newPage();
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
  // 节奏菜单完整可见（在页脚内、在视口内）；页脚当前天体文字已删除
  const inFooter = (id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return r.width > 40 && r.left >= rects.footer.left && r.right <= Math.min(rects.footer.right, window.innerWidth) && r.top >= rects.footer.top - 1 && r.bottom <= rects.footer.bottom + 1;
  };
  const paceOk = inFooter('pace') && inFooter('zoom') && inFooter('speed') && inFooter('pause') && inFooter('replay');
  return {
    paceOk,
    footCur: !!document.getElementById('foot-cur'),
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
      // 固定时刻截图默认用“起承转合”，与改前可比；第 4 个参数可另指定 pace=
      const paceQ = extra.includes('pace=') ? '' : '&pace=classic';
      const { page, errors, external } = await open(`?t=${t}${paceQ}${extra}`, w, h);
      await new Promise((r) => setTimeout(r, 1200));
      const lay = await page.evaluate(layoutCheck);
      const st = await page.evaluate(() => ({ ...window.__relay.state, now: document.getElementById('v-now').textContent, lit: document.getElementById('v-lit').textContent }));
      const file = resolve(outDir, `shot_${w}x${h}_t${t}${tag}.png`);
      await page.screenshot({ path: file });
      const pass = !errors.length && !external.length && !lay.hScroll && !lay.overlaps.length && lay.bottom <= lay.innerH && lay.paceOk && !lay.footCur;
      ok &&= pass;
      console.log(`${pass ? '✓' : '✗'} ${w}x${h} t=${t}  lit=${st.lit} now=${st.now}  hScroll=${lay.hScroll} overlaps=${lay.overlaps.join(',') || 'none'} clippedTiles=${lay.clipped} footerBottom=${lay.bottom}/${lay.innerH} 焦距/节奏/速度/按钮可见=${lay.paceOk} foot-cur=${lay.footCur}  errors=${errors.length} external=${external.length}  → ${file}`);
      errors.forEach((e) => console.log('   ', e));
      external.forEach((e) => console.log('    external:', e));
      await page.close();
    }
  }
  console.log(ok ? '\nSHOTS PASS' : '\nSHOTS FAIL');
} else if (mode === 'full') {
  const args = process.argv.slice(3);
  const low = args.includes('low');
  const paceArg = (args.find((a) => a.startsWith('pace=')) || 'pace=gentle').slice(5);
  const speedArg = Number((args.find((a) => a.startsWith('speed=')) || 'speed=1').slice(6));
  const paces = paceArg === 'all' ? ['gentle', 'classic', 'uniform', 'lightpath', 'beat', 'slowing'] : [paceArg];
  const results = [];
  for (const pace of paces) results.push(await runFull(pace, low, speedArg));
  if (paces.length > 1) console.log(`\n汇总：${results.map((r, i) => `${paces[i]} ${r ? '✓' : '✗'}`).join('  ')}`);
  console.log(results.every(Boolean) ? '\nFULL PASS' : '\nFULL FAIL');
}

async function runFull(pace, low, speed = 1) {
  console.log(`\n── 节奏 ${pace}${speed !== 1 ? ` · ${speed} 倍速` : ''}${low ? '（低画质）' : ''} ──`);
  const { page, errors, external } = await open(`?pace=${pace}&speed=${speed}${low ? '&q=low' : ''}`, 1920, 1080);
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
      pace: R.pace,
      state: R.state,
      lit: document.getElementById('v-lit').textContent,
      bands: [...document.querySelectorAll('.b-count')].map((e) => e.textContent),
      cellsLit: cells.filter((c) => c.className === 'lit' || c.className === 'cur').length,
      cellsTotal: cells.length,
      opacity: R.beamOpacity,
    };
  });
  const frames = r.state.frame - f0;
  await page.screenshot({ path: resolve(outDir, `full_end_${pace}${low ? '_low' : ''}.png`) });
  await page.close();
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
  add(`节奏为 ${pace}、速度 ×${speed}`, r.pace === pace && r.state.speed === speed, `页面 ${r.pace} ×${r.state.speed}`);
  add('总时长 55–90 秒（时间轴）', r.end >= 55 && r.end <= 90, `${r.end.toFixed(2)} s；实际墙钟 ${wall.toFixed(1)} s（理论 ${(r.end / speed).toFixed(1)} s）`);
  add('终态 64/64、五段进度全满', r.lit === '64/64' && r.cellsLit === r.cellsTotal && r.bands.every((b) => b.split('/')[0] === b.split('/')[1]), `${r.lit} ${r.bands.join(' ')}`);
  checks.forEach((c) => console.log(`${c.pass ? '✓' : '✗'} ${c.name}  ${c.detail}`));
  console.log(`帧率（${low ? '低画质' : '默认画质'}，无头 Chrome）：${(frames / wall).toFixed(1)} fps（${frames} 帧 / ${wall.toFixed(1)} s）`);
  errors.forEach((e) => console.log('   ', e));
  return checks.every((c) => c.pass);
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
  // 4. 焦距滑块：真实鼠标拖动，松手保持；滚轮联动；双击复位（暂停状态下比较，自动取景不变）
  {
    const { page } = await open('?t=40&pace=classic', 1920, 1080);
    await sleep(1500);
    const z = () => page.evaluate(() => ({ ...window.__relay.state, slider: Number(document.getElementById('zoom').value), label: document.getElementById('zoom-val').textContent }));
    const z0 = await z();
    const box = await (await page.$('#zoom')).boundingBox();
    const cy = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, cy);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, cy, { steps: 5 });
    await page.mouse.move(box.x + box.width + 20, cy, { steps: 5 });
    await page.mouse.up();
    await sleep(300);
    const z1 = await z();
    const ratio = z0.camDist / z1.camDist;
    add('拖动焦距滑块到最右：镜头拉近约 20 倍', ratio > 18 && ratio < 22 && z1.slider === 3, `距离 ${z0.camDist.toPrecision(3)} → ${z1.camDist.toPrecision(3)}（×${ratio.toFixed(1)}），显示「${z1.label}」`);
    await page.screenshot({ path: resolve(outDir, 'zoom_in.png') });
    await sleep(5000);
    const z2 = await z();
    add('松手 5 秒后不回弹', Math.abs(z2.camDist / z1.camDist - 1) < 0.01 && z2.slider === 3, `5 秒后距离 ${z2.camDist.toPrecision(3)}，滑块 ${z2.slider}`);
    const cv = await (await page.$('#canvas-wrap canvas')).boundingBox();
    await page.mouse.move(cv.x + cv.width / 2, cv.y + cv.height / 2);
    await page.mouse.wheel({ deltaY: 800 });
    await sleep(300);
    const z3 = await z();
    add('滚轮缩放时滑块同步', Math.abs(z3.slider - -z3.zoom) < 0.011 && z3.slider < 3 - 1, `滚轮后滑块 ${z3.slider.toFixed(2)}，镜头缩放 ${(-z3.zoom).toFixed(2)}，显示「${z3.label}」`);
    await page.click('#zoom', { count: 2 });
    await sleep(300);
    const z4 = await z();
    add('双击滑块复位到 ×1', z4.slider === 0 && Math.abs(z4.camDist / z0.camDist - 1) < 0.01 && z4.label === '×1.0', `距离 ${z4.camDist.toPrecision(3)}（初始 ${z0.camDist.toPrecision(3)}），显示「${z4.label}」`);
    const sp = await page.evaluate(() => document.activeElement && document.activeElement.id);
    await page.keyboard.press('Space');
    await sleep(800);
    const z5 = await z();
    add('操作滑块后空格仍能暂停 / 继续', sp !== 'zoom' && z5.playing && z5.t > z4.t, `焦点=${sp || 'body'}，按空格后 playing=${z5.playing}`);
    await page.close();
  }
  // 5. 速度滑块：真实鼠标拖动 / 双击；页面内用 performance.now 测 2 秒墙钟内时间轴前进多少
  {
    const ctx = await browser.createBrowserContext();
    const { page, errors } = await open('?t=8&play=1&pace=classic', 1920, 1080, ctx);
    await sleep(1000);
    const sp = () => page.evaluate(() => ({ ...window.__relay.state, slider: Number(document.getElementById('speed').value), label: document.getElementById('speed-val').textContent, focus: document.activeElement && document.activeElement.id }));
    const rate = () =>
      page.evaluate(
        () =>
          new Promise((res) => {
            const R = window.__relay;
            const t0 = R.state.t;
            const w0 = performance.now();
            setTimeout(() => res({ adv: R.state.t - t0, wall: (performance.now() - w0) / 1000 }), 2000);
          }),
      );
    const box = await (await page.$('#speed')).boundingBox();
    const cy = box.y + box.height / 2;
    const dragTo = async (fromFrac, toX) => {
      await page.mouse.move(box.x + box.width * fromFrac, cy);
      await page.mouse.down();
      await page.mouse.move((box.x + box.width * fromFrac + toX) / 2, cy, { steps: 4 });
      await page.mouse.move(toX, cy, { steps: 4 });
      await page.mouse.up();
    };
    const within = (x, target) => Math.abs(x / target - 1) <= 0.15;
    const s0 = await sp();
    add('初始速度 ×1.0', s0.speed === 1 && s0.label === '×1.0', `「${s0.label}」`);

    await dragTo(0.5, box.x + box.width + 20);
    const s1 = await sp();
    const r1 = await rate();
    add('拖到最右 ×4.0：2 秒内前进约 8 秒', s1.label === '×4.0' && within(r1.adv / r1.wall, 4), `「${s1.label}」墙钟 ${r1.wall.toFixed(2)} s 前进 ${r1.adv.toFixed(2)} s（${(r1.adv / r1.wall).toFixed(2)} 倍）`);

    await dragTo(0.97, box.x - 20); // 滑块在最右时圆钮的位置（box 右边缘本身不在控件内）
    const s2 = await sp();
    const r2 = await rate();
    add('拖到最左 ×0.25：2 秒内前进约 0.5 秒', s2.label === '×0.25' && within(r2.adv / r2.wall, 0.25), `「${s2.label}」墙钟 ${r2.wall.toFixed(2)} s 前进 ${r2.adv.toFixed(2)} s（${(r2.adv / r2.wall).toFixed(2)} 倍）`);

    await page.click('#speed', { count: 2 });
    await sleep(200);
    const s3 = await sp();
    const r3 = await rate();
    add('双击复位 ×1.0：2 秒内前进约 2 秒', s3.label === '×1.0' && s3.speed === 1 && within(r3.adv / r3.wall, 1), `「${s3.label}」墙钟 ${r3.wall.toFixed(2)} s 前进 ${r3.adv.toFixed(2)} s`);

    // 暂停时调速：保持暂停，时间与计数不变；空格继续后按新速度前进
    const f = await sp();
    await page.keyboard.press('Space');
    await sleep(300);
    const p0 = await sp();
    await dragTo(0.5, box.x + box.width * 0.75);
    await sleep(800);
    const p1 = await sp();
    add('暂停时调速：仍暂停，时间与计数不变', !p0.playing && !p1.playing && p1.t === p0.t && p1.n === p0.n && p1.speed > 1.5, `焦点=${f.focus || 'body'}；t ${p0.t.toFixed(3)} → ${p1.t.toFixed(3)}，n ${p0.n} → ${p1.n}，速度「${p1.label}」`);
    await page.keyboard.press('Space');
    const r4 = await rate();
    const p2 = await sp();
    add('调完按空格继续，按新速度前进', p2.playing && p2.focus !== 'speed' && within(r4.adv / r4.wall, p2.speed), `速度 ×${p2.speed.toFixed(2)}，实测 ${(r4.adv / r4.wall).toFixed(2)} 倍`);

    // 刷新后记住；?speed= 优先
    const kept = p2.speed;
    await page.goto(pageUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__relay && window.__relay.state.frame > 3);
    const k1 = await sp();
    await page.goto(`${pageUrl}?speed=0.5`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__relay && window.__relay.state.frame > 3);
    const k2 = await sp();
    add('刷新后记住速度；?speed=0.5 优先', Math.abs(k1.speed - kept) < 1e-9 && k2.speed === 0.5 && k2.label === '×0.50', `刷新后 ×${k1.speed.toFixed(2)}（上次 ×${kept.toFixed(2)}），?speed=0.5 → 「${k2.label}」`);
    add('速度操作无控制台错误', !errors.length, errors.join(' | '));
    await page.screenshot({ path: resolve(outDir, 'speed_slider.png') });
    await page.close();
    await ctx.close();
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
      const { page } = await open(`?t=33.6&q=${q}&pace=classic`, 1920, 1080);
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

if (mode === 'milky') {
  // 银河旋臂星带亮度：结尾同一帧，只渲染银河粒子，去掉中心核球区域后取平均亮度（Rec.709，0–255）
  const tag = process.argv[3] || 'now';
  const out = {};
  for (const q of ['high', 'low']) {
    const { page } = await open(`?t=end&q=${q}&pace=classic`, 1920, 1080);
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: resolve(outDir, `milky_${tag}_${q}.png`) });
    out[q] = await page.evaluate(() => {
      const { world, galaxy } = window.__relay._dbg;
      const { scene, camera } = world;
      const milky = galaxy.group.children.find((o) => o.isGroup && o.children.some((c) => c.isPoints));
      const saved = [];
      const hide = (o) => (saved.push([o, o.visible]), (o.visible = false));
      scene.children.forEach((o) => o !== galaxy.group && hide(o));
      galaxy.group.children.forEach((o) => o !== milky && hide(o));
      milky.children.forEach((o) => !o.isPoints && hide(o));
      world.render(window.__relay.state.camDist);
      const gl = world.renderer.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      saved.forEach(([o, v]) => (o.visible = v));
      // 核球区域：银心周围半径 12,000 光年的圆（银道面内）投影到屏幕上的多边形
      const LY = 1e4;
      const poly = [];
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const v = galaxy.gc.clone().add({ x: Math.cos(a) * 12000 * LY, y: 0, z: Math.sin(a) * 12000 * LY }).project(camera);
        poly.push([(v.x * 0.5 + 0.5) * w, (v.y * 0.5 + 0.5) * h]);
      }
      const inside = (x, y) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i];
          const [xj, yj] = poly[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      let sum = 0;
      let n = 0;
      let all = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
          all += l;
          if (inside(x + 0.5, y + 0.5)) continue;
          sum += l;
          n++;
        }
      return { arms: +(sum / n).toFixed(3), whole: +(all / (w * h)).toFixed(3), maskedPx: w * h - n };
    });
    console.log(`${q.padEnd(4)} 旋臂区域平均亮度 ${out[q].arms}（整幅 ${out[q].whole}，去掉核球 ${out[q].maskedPx} 像素）`);
    await page.close();
  }
  writeFileSync(resolve(outDir, `milky_${tag}.json`), JSON.stringify(out, null, 2));
  const beforeFile = resolve(outDir, 'milky_before.json');
  if (tag !== 'before' && existsSync(beforeFile)) {
    const before = JSON.parse(readFileSync(beforeFile, 'utf8'));
    for (const q of ['high', 'low']) {
      const ratio = out[q].arms / before[q].arms;
      console.log(`${ratio >= 0.6 && ratio <= 0.73 ? '✓' : '✗'} ${q}：改后 / 改前 = ${(ratio * 100).toFixed(1)}%（目标 60%–73%，即减弱约 1/3）`);
    }
  }
}

if (mode === 'rings') {
  // 到达时的两个光圈：目标金圈、冲击环（扩散到 u=0.15 时）。只渲染该光圈，取圈内亮像素的平均亮度（Rec.709，0–255）
  const tag = process.argv[3] || 'now';
  const out = {};
  for (const q of ['high', 'low']) {
    const { page } = await open(`?t=33.6&q=${q}&pace=classic`, 1920, 1080);
    await new Promise((r) => setTimeout(r, 1000));
    out[q] = await page.evaluate(() => {
      const { world, beams } = window.__relay._dbg;
      const { scene, camera } = world;
      const { target, pulses } = beams._rings;
      const measure = (obj, radiusFrac) => {
        const saved = scene.children.map((o) => [o, o.visible]);
        scene.children.forEach((o) => (o.visible = o === obj));
        world.render(window.__relay.state.camDist);
        const gl = world.renderer.getContext();
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        const px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        saved.forEach(([o, v]) => (o.visible = v));
        const v = obj.position.clone().project(camera);
        const cx = (v.x * 0.5 + 0.5) * w;
        const cy = (v.y * 0.5 + 0.5) * h;
        const R = radiusFrac * h;
        // 固定圆形区域内全部像素的平均亮度（与测太阳时同一口径；不设阈值，避免辉光外缘进出统计范围）
        let sum = 0;
        let n = 0;
        for (let y = Math.max(0, Math.floor(cy - R)); y < Math.min(h, cy + R); y++)
          for (let x = Math.max(0, Math.floor(cx - R)); x < Math.min(w, cx + R); x++) {
            if (Math.hypot(x - cx, y - cy) > R) continue;
            const i = (y * w + x) * 4;
            sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
            n++;
          }
        return { mean: +(sum / n).toFixed(3) };
      };
      // 亮度只比较不透明度：同一帧、同样大小下，“系数 1”与“系数 k”各渲染一次，取平均亮度之比
      const dim = beams._rings.dim;
      const now = performance.now() / 1000;
      const p = pulses[0];
      p.sp.position.copy(target.position);
      p.t0 = now - 0.9 * 0.15; // 冲击环扩散到 u=0.15（最亮的阶段）
      p.sp.visible = true;
      beams.update(now);
      const pulseOp = p.sp.material.opacity / dim; // 系数 1 时的不透明度
      const ratioAt = (k) => {
        target.material.opacity = 0.95;
        const t1 = measure(target, 0.1).mean;
        target.material.opacity = 0.95 * k;
        const t2 = measure(target, 0.1).mean;
        p.sp.material.opacity = pulseOp;
        const p1 = measure(p.sp, 0.3).mean;
        p.sp.material.opacity = pulseOp * k;
        const p2 = measure(p.sp, 0.3).mean;
        return { target: +(t2 / t1).toFixed(4), pulse: +(p2 / p1).toFixed(4) };
      };
      const scan = Object.fromEntries([0.5, 0.6, 0.7, 0.8, 0.9].map((k) => [k, ratioAt(k)]));
      const current = ratioAt(dim);
      target.material.opacity = 0.95 * dim;
      // 冲击环扩散到 u=0.95 时的大小（最外圈直径）
      p.t0 = now - 0.9 * 0.95;
      beams.update(now);
      const scaleEnd = p.sp.scale.x;
      p.sp.visible = false;
      p.t0 = -1;
      return { dim, current, scan, pulseScaleAtEnd: +scaleEnd.toFixed(4) };
    });
    const o = out[q];
    console.log(`${q.padEnd(4)} 系数扫描（金圈 / 冲击环 亮度比）：${Object.entries(o.scan).map(([k, r]) => `${k}→${(r.target * 100).toFixed(0)}%/${(r.pulse * 100).toFixed(0)}%`).join('  ')}`);
    await page.close();
  }
  writeFileSync(resolve(outDir, `rings_${tag}.json`), JSON.stringify(out, null, 2));
  for (const q of ['high', 'low']) {
    const c = out[q].current;
    for (const k of ['target', 'pulse']) console.log(`${c[k] >= 0.7 && c[k] <= 0.8 ? '✓' : '✗'} ${q} ${k === 'target' ? '目标金圈' : '冲击环'}亮度（系数 ${out[q].dim}）：改后 / 改前 = ${(c[k] * 100).toFixed(1)}%（目标 70%–80%）`);
    const sr = out[q].pulseScaleAtEnd / 0.195;
    console.log(`${sr >= 0.7 && sr <= 0.8 ? '✓' : '✗'} ${q} 冲击环最外圈直径：${out[q].pulseScaleAtEnd} / 原 0.195 = ${(sr * 100).toFixed(1)}%（目标约 75%）`);
  }
}

if (mode === 'pace') {
  const ok = [];
  const add = (name, pass, detail = '') => {
    ok.push(pass);
    console.log(`${pass ? '✓' : '✗'} ${name}  ${detail}`);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
  const onGrid = (x, step) => Math.abs(x / step - Math.round(x / step)) * step < 1e-3; // 误差 < 1 ms

  // ---- 1. 时间表（不播放，直接读）----
  {
    const { page, errors, external } = await open('?pace=classic', 1280, 720);
    const S = await page.evaluate(() => Object.fromEntries(window.__relay.paces.map((p) => [p.id, window.__relay.scheduleOf(p.id)])));
    const segAu = await page.evaluate(() => window.__relay.segAu);
    const width = await page.evaluate(() => window.__relay.beamWidth);
    await page.close();
    const before = JSON.parse(readFileSync(resolve(outDir, 'classic_before.json'), 'utf8'));
    const fmt = (s) => `总长 ${s.end.toFixed(2)} s，每跳 ${Math.min(...s.durations).toFixed(2)}–${Math.max(...s.durations).toFixed(2)} s`;
    add('6 种节奏都有 64 次到达、时刻严格递增', Object.values(S).every((s) => s.arrive.length === 64 && s.durations.length === 63 && s.arrive.every((a, i) => i === 0 || a > s.arrive[i - 1])), Object.keys(S).join(' / '));

    const u = S.uniform;
    add('匀速：每跳 0.9 s，总长 61.2 s', u.durations.every((d) => d === 0.9) && near(u.end, 61.2), fmt(u));

    const c = S.classic;
    const maxDiff = Math.max(...c.arrive.map((a, i) => Math.abs(a - before.arrive[i])));
    add('起承转合：到达时刻与改前逐项相等，总长 61.47 s', c.arrive.length === before.arrive.length && maxDiff < 1e-9 && near(c.end, 61.47), `最大差 ${maxDiff.toExponential(1)}，${fmt(c)}`);

    const g = S.gentle;
    const gRule = g.durations.every((d, k) => d === Math.max(before.durations[k], 1.0));
    const gMid = g.durations.slice(9, 38).every((d) => d === 1.0);
    add('舒缓：每跳 = max(起承转合, 1.0)，中段每跳 1.0 s，总长约 79 s', gRule && gMid && g.end > 78.5 && g.end < 79.5, fmt(g));

    const L = S.lightpath;
    const idx = segAu.map((_, k) => k).sort((a, b) => segAu[a] - segAu[b]);
    const mono = idx.every((k, i) => i === 0 || L.durations[k] >= L.durations[idx[i - 1]] - 1e-12);
    add('光程：按真实光程排序后时长单调不减，0.45–2.2 s，总长 75–85 s', mono && near(Math.min(...L.durations), 0.45) && near(Math.max(...L.durations), 2.2) && L.end >= 75 && L.end <= 85, `${fmt(L)}；最短一跳 ${segAu[idx[0]].toExponential(2)} AU，最长 ${segAu[idx[62]].toExponential(2)} AU`);

    const b = S.beat;
    const bGrid = [...b.starts, ...b.arrive, ...b.starts.map((s, k) => s + b.travels[k])].every((x) => onGrid(x, 0.5));
    add('卡点 120 BPM：起跳与到达都在 0.5 s 拍点上，总长 83.5 s', bGrid && near(b.end, 83.5), fmt(b));

    const sl = S.slowing;
    add('渐慢：严格递增，0.5 → 1.8 s，总长约 77 s', sl.durations.every((d, k) => k === 0 || d > sl.durations[k - 1]) && near(sl.durations[0], 0.5) && near(sl.durations[62], 1.8) && Math.abs(sl.end - 76.95) < 0.01, fmt(sl));

    const { page: p100 } = await open('?pace=beat&bpm=100', 1280, 720);
    const b100 = await p100.evaluate(() => window.__relay.schedule);
    await p100.close();
    add('卡点 ?bpm=100：起跳与到达都在 0.6 s 拍点上', b100.pace === 'beat' && b100.bpm === 100 && [...b100.starts, ...b100.arrive].every((x) => onGrid(x, 0.6)), `总长 ${b100.end.toFixed(2)} s`);

    add('行进中光束线宽缩减 1/3，已走光束不变', near(width.activeCore, 2.4 * (2 / 3), 0.01) && near(width.activeGlow, 10 * (2 / 3), 0.05) && width.doneCore === 1.4 && width.doneGlow === 5, `核心 2.4→${width.activeCore}，辉光 10→${width.activeGlow}，已走 ${width.doneCore}/${width.doneGlow}`);
    add('无控制台错误 / 外部请求', !errors.length && !external.length, `errors=${errors.length} external=${external.length}`);
  }

  // ---- 3. 默认值、切换、记忆、URL 指定（全新的无痕上下文）----
  {
    const ctx = await browser.createBrowserContext();
    const { page, errors } = await open('?t=20&play=1', 1920, 1080, ctx);
    const opts = await page.evaluate(() => [...document.querySelectorAll('#pace option')].map((o) => o.textContent));
    const d0 = await page.evaluate(() => ({ pace: window.__relay.pace, sel: document.getElementById('pace').value }));
    add('全新浏览器默认“舒缓”，菜单 6 项', d0.pace === 'gentle' && d0.sel === 'gentle' && opts.length === 6, `pace=${d0.pace} 菜单=${opts.join(' | ')}`);

    // 播放中切到“匀速”
    await sleep(1000);
    await page.select('#pace', 'uniform');
    const sw1 = await page.evaluate(() => {
      const R = window.__relay;
      const sw = R.paceSwitches.at(-1);
      return { sw, nAtNew: R.schedule.arrive.filter((a) => a <= sw.to).length, pace: R.pace };
    });
    await sleep(2000);
    const a2 = await page.evaluate(() => window.__relay.state);
    add('播放中切到“匀速”：天体计数不变、不回开头', sw1.pace === 'uniform' && sw1.nAtNew === sw1.sw.n && sw1.sw.n > 5, `切换时第 ${sw1.sw.n} 个，t ${sw1.sw.from}→${sw1.sw.to}，新时间表下同一时刻为第 ${sw1.nAtNew} 个`);
    add('切换后继续播放，2 秒内点亮新天体', a2.playing && a2.n > sw1.sw.n, `n ${sw1.sw.n} → ${a2.n}`);

    // 暂停时切到“卡点”：保持暂停、计数不变，继续后前进
    await page.click('#pause');
    const p0 = await page.evaluate(() => window.__relay.state);
    await page.select('#pace', 'beat');
    await sleep(600);
    const p1 = await page.evaluate(() => ({ ...window.__relay.state, pace: window.__relay.pace }));
    add('暂停时切到“卡点”：仍暂停、计数不变', p1.pace === 'beat' && !p1.playing && p1.n === p0.n, `n ${p0.n} → ${p1.n}，t ${p0.t.toFixed(2)} → ${p1.t.toFixed(2)}`);
    await page.click('#pause');
    await sleep(2500);
    const p2 = await page.evaluate(() => window.__relay.state);
    add('继续后接着点亮', p2.playing && p2.n > p1.n, `n ${p1.n} → ${p2.n}`);
    await page.screenshot({ path: resolve(outDir, 'pace_switched.png') });

    // 刷新后记住上次选择；?pace= 优先；无效值回退到记住的选择
    await page.goto(pageUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__relay && window.__relay.state.frame > 3);
    const r1 = await page.evaluate(() => ({ pace: window.__relay.pace, sel: document.getElementById('pace').value }));
    add('刷新后仍是上次选的“卡点”', r1.pace === 'beat' && r1.sel === 'beat', `pace=${r1.pace}`);
    await page.goto(`${pageUrl}?pace=lightpath`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__relay && window.__relay.state.frame > 3);
    const r2 = await page.evaluate(() => window.__relay.pace);
    await page.goto(`${pageUrl}?pace=xyz`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__relay && window.__relay.state.frame > 3);
    const r3 = await page.evaluate(() => window.__relay.pace);
    add('?pace=lightpath 直接指定；无效值回退到上次选择', r2 === 'lightpath' && r3 === 'beat', `?pace=lightpath → ${r2}，?pace=xyz → ${r3}`);
    add('切换过程无控制台错误', !errors.length, errors.join(' | '));
    await page.close();
    await ctx.close();
  }

  // ---- 匀速节奏下“太阳 → 南门二”这一跳（镜头追赶效果）----
  {
    const { page } = await open('?pace=uniform', 1920, 1080);
    const s = await page.evaluate(() => window.__relay.schedule);
    const tMid = s.starts[48] + s.travels[48] * 0.6;
    await page.goto(`${pageUrl}?pace=uniform&t=${(s.starts[48] - 0.6).toFixed(3)}&play=1`, { waitUntil: 'load' });
    await page.waitForFunction((tm) => window.__relay && window.__relay.state.t >= tm, { timeout: 60000 }, tMid);
    await page.screenshot({ path: resolve(outDir, 'pace_uniform_exit.png') });
    console.log(`  截图：匀速节奏出太阳系那一跳（t≈${tMid.toFixed(2)} s）→ shots/pace_uniform_exit.png`);
    await page.close();
  }
  console.log(ok.every(Boolean) ? '\nPACE PASS' : '\nPACE FAIL');
}

if (mode === 'fps') {
  // 分别在太阳系阶段与银河阶段采样 6 秒
  for (const q of ['', 'q=low', 'q=high']) {
    const res = [];
    for (const t of [5, 50]) {
      const { page } = await open(`?t=${t}&play=1&pace=classic${q ? '&' + q : ''}`, 1920, 1080);
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
