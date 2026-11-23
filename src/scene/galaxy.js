import * as THREE from 'three';
import { LY, starWorldPos } from '../math/astro.js';
import { parseRa, parseDec, spectralColor } from '../data/stars.js';
import { glowTexture, flareTexture } from './textures.js';

const R_SUN_GC = 26000; // 太阳到银心距离（光年）

export function createGalaxy(scene, order, { low }) {
  const group = new THREE.Group();
  group.name = 'galaxy';
  scene.add(group);
  const gc = new THREE.Vector3(R_SUN_GC * LY, 0, 0); // 银道坐标 x 轴指向银心

  // ---------- 程序生成的银河（旋臂 + 核球 + 棒） ----------
  let s = 20261123;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const gauss = () => {
    let u = 0;
    for (let i = 0; i < 4; i++) u += rnd();
    return (u - 2) / 0.577;
  };
  const N = low ? 30000 : 90000;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const cBulge = new THREE.Color('#ffd49a');
  const cArmA = new THREE.Color('#b9cdff');
  const cArmB = new THREE.Color('#fff0dc');
  const cHII = new THREE.Color('#ff8fc8');
  const c = new THREE.Color();
  const pitch = THREE.MathUtils.degToRad(12.5);
  const sunAngle = Math.PI; // 太阳在银心的 -x 方向
  for (let i = 0; i < N; i++) {
    let x;
    let y;
    let z;
    const t = rnd();
    if (t < 0.2) {
      // 核球 + 棒
      const bar = rnd() < 0.5;
      const sx = bar ? 9000 : 4200;
      const sz = bar ? 3000 : 4200;
      const lx = gauss() * sx;
      const lz = gauss() * sz;
      const ang = THREE.MathUtils.degToRad(28);
      x = lx * Math.cos(ang) - lz * Math.sin(ang);
      z = lx * Math.sin(ang) + lz * Math.cos(ang);
      y = gauss() * 1400;
      c.copy(cBulge).multiplyScalar(0.18 + 0.22 * rnd());
    } else {
      const arm = Math.floor(rnd() * 4);
      let r = 4000 + -Math.log(1 - rnd() * 0.985) * 11000;
      r = Math.min(r, 52000);
      const theta0 = sunAngle + arm * (Math.PI / 2) + 0.35;
      const theta = theta0 + Math.log(r / 4000) / Math.tan(pitch) + gauss() * (0.16 + 0.1 * rnd());
      const spread = gauss() * r * 0.035;
      x = (r + spread) * Math.cos(theta);
      z = (r + spread) * Math.sin(theta);
      y = gauss() * (450 * (1 - r / 70000) + 80);
      const k = rnd();
      if (k < 0.04) c.copy(cHII);
      else c.copy(cArmA).lerp(cArmB, rnd());
      c.multiplyScalar(0.22 + 0.5 * rnd());
    }
    pos.set([gc.x + x * LY, y * LY, z * LY], i * 3);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dustMat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const dust = new THREE.Points(g, dustMat);
  dust.frustumCulled = false;
  const milky = new THREE.Group(); // 银河粒子与辉光：看不见时整体隐藏，省掉大量顶点计算
  milky.visible = false;
  group.add(milky);
  milky.add(dust);

  const glowTex = glowTexture([[0, 1], [0.15, 0.55], [0.45, 0.12], [1, 0]]);
  // 银盘弥漫光（平面）
  const discMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0x6f7fb0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.scale.setScalar(115000 * LY);
  disc.position.copy(gc);
  if (!low) milky.add(disc); // 满屏的弥漫光在软件渲染下很贵（约 30 ms/帧），低画质省掉
  // 核心辉光
  const coreMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffc27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const core = new THREE.Sprite(coreMat);
  core.scale.setScalar(15000 * LY);
  core.position.copy(gc);
  milky.add(core);

  // ---------- 恒星 ----------
  const flare = flareTexture();
  const nodes = {};
  const stars = order.filter((b) => b.kind === 'star' && b.id !== 'sun');
  for (const b of stars) {
    b.ra_deg = parseRa(b.ra);
    b.dec_deg = parseDec(b.dec);
    const holder = new THREE.Group();
    holder.position.copy(starWorldPos(b.ra_deg, b.dec_deg, b.distLy));
    group.add(holder);
    const color = new THREE.Color(spectralColor(b.spectral));
    const size = 0.022 + 0.011 * Math.log10(b.rsun + 1);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: flare, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false }));
    marker.scale.setScalar(size * 0.6);
    holder.add(marker);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc35a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false }));
    halo.scale.setScalar(size * 2.4);
    holder.add(halo);
    nodes[b.id] = { body: b, holder, marker, halo, baseSize: size, color, solar: false, worldPos: holder.position.clone(), minFrame: 0, labelRange: 0 };
  }
  // 标签可见范围：最近邻距离的若干倍
  const all = Object.values(nodes);
  for (const n of all) {
    let nearest = n.worldPos.length(); // 到太阳
    for (const m of all) if (m !== n) nearest = Math.min(nearest, n.worldPos.distanceTo(m.worldPos));
    n.labelRange = nearest * 28;
  }

  function update(camDist) {
    const ly = camDist / LY;
    const f = THREE.MathUtils.smoothstep(Math.log10(ly), Math.log10(60), Math.log10(5000));
    dustMat.opacity = 0.75 * f;
    discMat.opacity = 0.16 * f;
    coreMat.opacity = 0.28 * f;
    milky.visible = f > 0.002;
    return f;
  }

  return { group, nodes, gc, update };
}
