import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { sizeText } from '../data/order.js';

export function createLabels(order, nodes, scene) {
  const items = order.map((b, i) => {
    const anchor = document.createElement('div');
    anchor.className = 'lbl-anchor';
    anchor.innerHTML = `<div class="lbl"><b>${b.zh}</b><em>${b.en.toUpperCase()}</em><span>${sizeText(b)}</span></div>`;
    const obj = new CSS2DObject(anchor);
    obj.visible = false;
    nodes[i].holder.add(obj);
    return { obj, el: anchor, node: nodes[i] };
  });

  // 银河尺度下把太阳系标签合并为一个
  const sysEl = document.createElement('div');
  sysEl.className = 'lbl-anchor';
  sysEl.innerHTML = `<div class="lbl sys"><b>太阳系</b><em>SOLAR SYSTEM</em><span>49 bodies</span></div>`;
  const sysObj = new CSS2DObject(sysEl);
  sysObj.visible = false;
  scene.add(sysObj);

  let n = 0;
  function setN(nNew) {
    n = nNew;
    items.forEach((it, i) => {
      const shown = i < n;
      it.el.classList.toggle('shown', shown);
      it.el.classList.toggle('current', i === n - 1);
      it.el.classList.toggle('visited', i < n - 1);
      it.obj.visible = shown; // 先显示，LOD 在 update 中再细化（当前标签永远显示）
    });
  }

  // LOD：已点亮的旧标签只在镜头足够近时显示，避免挤成一团
  function update(camPos, solarFade) {
    items.forEach((it, i) => {
      if (i >= n) return;
      if (i === n - 1) {
        it.obj.visible = true;
        return;
      }
      const d = camPos.distanceTo(it.node.worldPos);
      let vis = d < it.node.labelRange;
      if (it.node.solar && solarFade < 0.35) vis = false;
      it.obj.visible = vis;
    });
    // 太阳是当前天体时不显示汇总标签，避免与“太阳”标签重叠
    sysObj.visible = n >= 50 && solarFade < 0.35;
  }

  return { setN, update, el: (i) => items[i].el };
}
