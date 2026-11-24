import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { flareTexture, ringTexture, glowTexture } from './scene/textures.js';

// 亮度口径：已走过的光束 ≤ 当前光束的 35%
export const BEAM_OPACITY = { activeCore: 1.0, activeGlow: 0.35, doneCore: 0.22, doneGlow: 0.07 };
// 线宽（像素）：行进中的光束在 2.4 / 10 的基础上缩减 1/3
export const BEAM_WIDTH = { activeCore: 1.6, activeGlow: 6.7, doneCore: 1.4, doneGlow: 5 };

// 到达光圈：冲击环最大直径（屏高比例，原 0.195，缩小约 1/4）；
// 两个光圈的亮度系数按实测屏幕亮度（光圈周围固定圆形区域的平均亮度）校准为原来的约 3/4：
// 低画质下亮度与系数成正比，取 0.75；高画质另有辉光后处理，0.7 时金圈 79%、冲击环 73%
const PULSE_START = 0.025;
const PULSE_END = 0.146;
const RING_DIM = { low: 0.75, high: 0.7 };
// 光束头部（光头）：半径为原来（0.07 屏高）的 2/3；亮度系数按实测屏幕亮度（同帧同尺寸、光头周围固定区域平均亮度）
// 校准为原来的约 2/3：低画质 0.66、高画质 0.57（辉光后处理使响应非线性）
const HEAD_SIZE = 0.07 * (2 / 3);
const HEAD_DIM = { low: 0.66, high: 0.57 };

export function createBeams(scene, world, nodeList, { low = false } = {}) {
  const ringDim = low ? RING_DIM.low : RING_DIM.high;
  const headDim = low ? HEAD_DIM.low : HEAD_DIM.high;
  const mk = (color, width, opacity) =>
    new LineMaterial({ color, linewidth: width, worldUnits: false, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const mats = {
    activeCore: mk(0xfff0c4, BEAM_WIDTH.activeCore, BEAM_OPACITY.activeCore),
    activeGlow: mk(0xffa63a, BEAM_WIDTH.activeGlow, BEAM_OPACITY.activeGlow),
    doneCore: mk(0xffc860, BEAM_WIDTH.doneCore, BEAM_OPACITY.doneCore),
    doneGlow: mk(0xff9a30, BEAM_WIDTH.doneGlow, BEAM_OPACITY.doneGlow),
  };
  const setRes = (w, h) => Object.values(mats).forEach((m) => m.resolution.set(w, h));
  setRes(world.size.w, world.size.h);
  world.onResize(setRes);

  const beams = [];
  for (let k = 0; k < nodeList.length - 1; k++) {
    const A = nodeList[k].worldPos;
    const B = nodeList[k + 1].worldPos;
    const geo = new LineSegmentsGeometry();
    geo.setPositions([A.x, A.y, A.z, A.x, A.y, A.z]);
    const glow = new LineSegments2(geo, mats.activeGlow);
    const core = new LineSegments2(geo, mats.activeCore);
    for (const l of [glow, core]) {
      l.frustumCulled = false;
      l.visible = false;
      l.renderOrder = 5;
      scene.add(l);
    }
    beams.push({ A, B, geo, glow, core, state: 'hidden', p: -1 });
  }

  function setGeom(b, p) {
    if (b.p === p) return;
    b.p = p;
    const arr = b.geo.attributes.instanceStart.data.array;
    arr[0] = b.A.x;
    arr[1] = b.A.y;
    arr[2] = b.A.z;
    arr[3] = b.A.x + (b.B.x - b.A.x) * p;
    arr[4] = b.A.y + (b.B.y - b.A.y) * p;
    arr[5] = b.A.z + (b.B.z - b.A.z) * p;
    b.geo.attributes.instanceStart.data.needsUpdate = true;
  }

  // 光束头部
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture(), color: 0xfff6dc, transparent: true, opacity: headDim, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false }));
  head.scale.setScalar(HEAD_SIZE);
  head.renderOrder = 6;
  head.visible = false;
  scene.add(head);
  // 外层辉光：作为子节点，尺寸是光斑的 1.3 倍，随光斑一起缩放
  const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa040, transparent: true, opacity: 0.8 * headDim, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false }));
  head.add(headGlow);
  headGlow.scale.setScalar(1.3);

  // 冲击环（池）
  const ringTex = ringTexture(0.05);
  const pulses = [];
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: 0xffc04a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false }));
    sp.visible = false;
    sp.renderOrder = 7;
    scene.add(sp);
    pulses.push({ sp, t0: -1 });
  }
  let pulseIdx = 0;
  // 当前目标金圈
  const target = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(0.07), color: 0xffc85a, transparent: true, opacity: 0.95 * ringDim, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false }));
  target.renderOrder = 7;
  target.visible = false;
  scene.add(target);
  let targetPos = null;

  return {
    beams,
    // 设置第 k 跳的状态：hidden / active(p) / done
    set(k, state, p = 1) {
      const b = beams[k];
      if (state === 'hidden') {
        b.glow.visible = b.core.visible = false;
        b.state = state;
        return;
      }
      b.glow.visible = b.core.visible = true;
      if (state === 'active') {
        b.glow.material = mats.activeGlow;
        b.core.material = mats.activeCore;
        setGeom(b, Math.max(1e-6, p));
      } else {
        b.glow.material = mats.doneGlow;
        b.core.material = mats.doneCore;
        setGeom(b, 1);
      }
      b.state = state;
    },
    setHead(pos) {
      head.visible = !!pos;
      if (pos) head.position.copy(pos);
    },
    pulse(pos, now) {
      const p = pulses[pulseIdx++ % pulses.length];
      p.sp.position.copy(pos);
      p.t0 = now;
      p.sp.visible = true;
    },
    setTarget(pos) {
      targetPos = pos;
      target.visible = !!pos;
      if (pos) target.position.copy(pos);
    },
    update(now) {
      for (const p of pulses) {
        if (p.t0 < 0) continue;
        const u = (now - p.t0) / 0.9;
        if (u >= 1) {
          p.sp.visible = false;
          p.t0 = -1;
          continue;
        }
        const e = 1 - Math.pow(1 - u, 3);
        p.sp.scale.setScalar(PULSE_START + (PULSE_END - PULSE_START) * e);
        p.sp.material.opacity = (1 - u) * ringDim;
      }
      if (targetPos) {
        const s = 0.05 + 0.006 * Math.sin(now * 5);
        target.scale.setScalar(s);
        target.material.rotation = now * 0.6;
      }
    },
    materials: mats,
    _rings: { target, pulses, dim: ringDim }, // 供验收测量
    _head: { head, headGlow, dim: headDim, size: HEAD_SIZE },
  };
}
