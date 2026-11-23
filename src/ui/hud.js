import { BANDS, KINDS } from '../data/bodies.js';
import { sizeText } from '../data/order.js';
import { fmtDistAu, fmtLightTime, fmtScale, LIGHT_SEC_PER_AU } from '../math/astro.js';

const $ = (id) => document.getElementById(id);
const pad = (n, w = 3) => String(n).padStart(w, '0');

export function createHud(order) {
  const N = order.length;
  const first = order[0];

  // ---- 统计卡片 ----
  const tiles = [
    ['lit', '已点亮', 'LIT'],
    ['now', '当前', 'NOW'],
    ['size', '尺寸', 'SIZE'],
    ['path', '累计光程', 'PATH'],
    ['light', '光行时间', 'LIGHT TIME'],
    ['scale', '尺度', 'SCALE'],
  ];
  $('stats').innerHTML = tiles
    .map(
      ([k, zh, en]) => `<div class="tile tile-${k}">
        <div class="t-label">${en} <span>${zh}</span></div>
        <div class="t-value" id="v-${k}">—</div>
        <div class="t-sub" id="s-${k}">&nbsp;</div>
        ${k === 'lit' ? '<div class="t-bar"><i id="litbar"></i></div>' : ''}
      </div>`,
    )
    .join('');

  // ---- 分段进度条 ----
  const bandCounts = BANDS.map((_, bi) => order.filter((b) => b.band === bi).length);
  $('bands').innerHTML = BANDS.map(
    (b, bi) => `<div class="band" id="band-${bi}">
      <div class="b-head"><span class="b-key">${b.key}</span><span class="b-label">${b.label}</span><span class="b-count" id="bc-${bi}">0/${bandCounts[bi]}</span></div>
      <div class="b-cells">${order
        .filter((x) => x.band === bi)
        .map((x) => `<i data-i="${x.index}"></i>`)
        .join('')}</div>
    </div>`,
  ).join('');
  const cells = [...document.querySelectorAll('.b-cells i')];

  // ---- 图例 ----
  $('legend').innerHTML = Object.values(KINDS)
    .map((k) => `<span><i style="background:${k.color}"></i>${k.zh}</span>`)
    .join('');

  let lastN = -1;
  function setN(n) {
    if (n === lastN) return;
    lastN = n;
    const cur = order[n - 1];
    $('v-lit').textContent = `${n}/${N}`;
    $('litbar').style.width = `${(n / N) * 100}%`;
    $('s-lit').textContent = `${Math.max(0, n - 1)} 跳 / ${N - 1}`;
    $('v-now').textContent = cur ? cur.zh : '—';
    $('s-now').textContent = cur ? cur.en.toUpperCase() : 'STANDBY';
    $('v-size').textContent = cur ? sizeText(cur, true) : '—';
    $('s-size').textContent = cur ? KINDS[cur.kind].zh : '';
    $('v-scale').textContent = cur ? fmtScale(cur.d / first.d) : '—';
    $('s-scale').textContent = `相对${first.zh}`;
    $('nodes').textContent = `${n} nodes · ${Math.max(0, n - 1)} links`;
    $('foot-cur').textContent = cur ? `${pad(n)}/${pad(N)}  ${cur.zh} · ${cur.en}` : `000/${pad(N)}  待发射`;
    BANDS.forEach((_, bi) => {
      const lit = order.filter((b) => b.band === bi && b.index < n).length;
      $(`bc-${bi}`).textContent = `${lit}/${bandCounts[bi]}`;
      $(`band-${bi}`).classList.toggle('full', lit === bandCounts[bi]);
      $(`band-${bi}`).classList.toggle('active', cur && cur.band === bi);
    });
    cells.forEach((c) => {
      const i = +c.dataset.i;
      c.className = i < n - 1 ? 'lit' : i === n - 1 ? 'cur' : '';
    });
  }

  let lastLive = '';
  function setLive(pathAu, segAu) {
    const key = pathAu.toPrecision(5);
    if (key === lastLive) return;
    lastLive = key;
    $('v-path').textContent = fmtDistAu(pathAu);
    $('s-path').textContent = segAu > 0 ? `本段 ${fmtDistAu(segAu)}` : ' ';
    $('v-light').textContent = fmtLightTime(pathAu * LIGHT_SEC_PER_AU);
    $('s-light').textContent = '光速走完全程';
  }

  let lastPhase = '';
  function setPhase({ milky, done }) {
    const ph = `${milky}|${done}`;
    if (ph === lastPhase) return;
    lastPhase = ph;
    $('path').textContent = milky ? '~/milky-way' : '~/solar-system';
    $('status-text').textContent = done ? `完成 · ${N}/${N}` : '传输中…';
    document.body.classList.toggle('done', done);
  }

  return { setN, setLive, setPhase, counterText: () => $('v-lit').textContent };
}
