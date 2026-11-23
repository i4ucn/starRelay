import { BANDS, KINDS } from '../data/bodies.js';
import { sizeText } from '../data/order.js';

const USER_HOLD_MS = 4000; // 用户手动滚动后，这段时间内不自动滚动

export function createList(order, onPick) {
  const list = document.getElementById('list');
  let html = '';
  BANDS.forEach((band, bi) => {
    const items = order.filter((b) => b.band === bi);
    html += `<div class="sec"><div class="sec-head"><span class="sec-ic">◎</span>${band.key} · ${band.label}<span class="sec-n">${items.length}</span></div>`;
    for (const b of items) {
      html += `<div class="row" data-i="${b.index}" title="点击从此处继续｜${b.src}${b.note ? '｜' + b.note : ''}">
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

  // 点击某个天体：从它被点亮的时刻继续
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row && onPick) onPick(Number(row.dataset.i));
  });

  // 记录用户手动操作列表的时间
  let lastUser = -Infinity;
  const markUser = () => (lastUser = performance.now());
  list.addEventListener('wheel', markUser, { passive: true });
  list.addEventListener('pointerdown', markUser);
  list.addEventListener('touchstart', markUser, { passive: true });

  let lastN = -1;
  let scrollTarget = 0;
  let auto = false; // 只在当前天体变化时自动滚一次，到位即停

  const maxScroll = () => Math.max(0, list.scrollHeight - list.clientHeight);

  function setN(n) {
    if (n === lastN) return;
    lastN = n;
    rows.forEach((r, i) => {
      r.classList.toggle('lit', i < n - 1);
      r.classList.toggle('current', i === n - 1);
    });
    const cur = rows[Math.max(0, n - 1)];
    scrollTarget = Math.min(maxScroll(), Math.max(0, cur.offsetTop - list.clientHeight * 0.42));
    auto = performance.now() - lastUser > USER_HOLD_MS;
  }

  function update(dt, snap) {
    if (!auto) return;
    if (performance.now() - lastUser < USER_HOLD_MS) {
      auto = false; // 用户正在操作：让出控制权
      return;
    }
    const d = scrollTarget - list.scrollTop;
    if (Math.abs(d) < 1) {
      auto = false;
      return;
    }
    const before = list.scrollTop;
    list.scrollTop += snap ? d : d * (1 - Math.exp(-dt * 8));
    if (list.scrollTop === before && dt > 0) auto = false; // 已经滚不动（到边界）就停，绝不卡住用户
  }

  return { setN, update, row: (i) => rows[i] };
}
