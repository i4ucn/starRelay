import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { flareTexture, ringTexture, glowTexture } from './scene/textures.js';

// 亮度口径：已走过的光束 ≤ 当前光束的 35%
export const BEAM_OPACITY = { activeCore: 1.0, activeGlow: 0.35, doneCore: 0.22, doneGlow: 0.07 };

export function createBeams(scene, world, nodeList) {
  const mk = (color, width, opacity) =>
    new LineMaterial({ color, linewidth: width, worldUnits: false, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const mats = {
    activeCore: mk(0xfff0c4, 2.4, BEAM_OPACITY.activeCore),
    activeGlow: mk(0xffa63a, 10, BEAM_OPACITY.activeGlow),
    doneCore: mk(0xffc860, 1.4, BEAM_OPACITY.doneCore),
    doneGlow: mk(0xff9a30, 5, BEAM_OPACITY.doneGlow),
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
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture(), color: 0xfff6dc, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false }));
  head.scale.setScalar(0.07);
  head.renderOrder = 6;
  head.visible = false;
  scene.add(head);
  const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa040, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false }));
  headGlow.scale.setScalar(0.09);
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
  const target = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(0.07), color: 0xffc85a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false }));
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
        p.sp.scale.setScalar(0.025 + 0.17 * e);
        p.sp.material.opacity = 1 - u;
      }
      if (targetPos) {
        const s = 0.05 + 0.006 * Math.sin(now * 5);
        target.scale.setScalar(s);
        target.material.rotation = now * 0.6;
      }
    },
    materials: mats,
  };
}
