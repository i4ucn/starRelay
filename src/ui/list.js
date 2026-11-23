import { BANDS, KINDS } from '../data/bodies.js';
import { sizeText } from '../data/order.js';

export function createList(order) {
  const list = document.getElementById('list');
  let html = '';
  BANDS.forEach((band, bi) => {
    const items = order.filter((b) => b.band === bi);
    html += `<div class="sec"><div class="sec-head"><span class="sec-ic">◎</span>${band.key} · ${band.label}<span class="sec-n">${items.length}</span></div>`;
    for (const b of items) {
      html += `<div class="row" data-i="${b.index}" title="${b.src}${b.note ? '｜' + b.note : ''}">
        <span class="ic"></span>
        <span class="idx">${String(b.index + 1).padStart(2, '0')}</span>
        <span class="nm"><b>${b.zh}</b><em>${b.en}</em></span>
        <span class="sz">${sizeText(b, true)}</span>
        <span class="tag" style="--k:${KINDS[b.kind].color}">${KINDS[b.kind].zh}</span>
      </div>`;
    }
    html += '</div>';
  });
  list.innerHTML = html;
  const rows = [...list.querySelectorAll('.row')];
  let lastN = -1;
  let scrollTarget = 0;

  function setN(n) {
    if (n === lastN) return;
    lastN = n;
    rows.forEach((r, i) => {
      r.classList.toggle('lit', i < n - 1);
      r.classList.toggle('current', i === n - 1);
    });
    const cur = rows[Math.max(0, n - 1)];
    scrollTarget = Math.max(0, cur.offsetTop - list.clientHeight * 0.42);
  }
  function update(dt, snap) {
    const d = scrollTarget - list.scrollTop;
    if (Math.abs(d) < 0.5) return;
    list.scrollTop += snap ? d : d * (1 - Math.exp(-dt * 8));
  }
  return { setN, update, row: (i) => rows[i] };
}
