import * as THREE from 'three';
import { AU_KM, compress, orbitArcs, toThree, eqToEcl, raDecToEq, solarGroupQuaternion } from '../math/astro.js';
import { surfaceTexture, saturnRingTexture, glowTexture } from './textures.js';
import { KINDS } from '../data/bodies.js';

// 天体视觉半径（太阳系压缩单位）：∝ 直径^0.4
export const visRadius = (dkm) => 0.012 * Math.pow(dkm / 1000, 0.4);

export function createSolarSystem(scene, order, solarData, { low }) {
  const group = new THREE.Group();
  group.name = 'solar';
  group.quaternion.copy(solarGroupQuaternion());
  scene.add(group);

  const sphere = new THREE.SphereGeometry(1, low ? 24 : 48, low ? 16 : 32);
  const glowTex = glowTexture();
  const byId = Object.fromEntries(order.map((b) => [b.id, b]));
  const bodies = order.filter((b) => b.kind !== 'star' || b.id === 'sun');

  const fadeMats = []; // 远距离淡出的材质 {mat, base}
  const details = new THREE.Group(); // 轨道线与小天体带：淡出后整体隐藏
  group.add(details);
  const spinners = [];
  const nodes = {};

  // ---------- 位置 ----------
  const local = {};
  const moonInfo = {};
  for (const b of bodies) {
    if (b.parent) continue;
    local[b.id] = b.id === 'sun' ? new THREE.Vector3() : compress(solarData.bodies[b.id].r);
  }
  for (const b of bodies) {
    if (!b.parent) continue;
    const parent = byId[b.parent];
    const rel = solarData.bodies[b.id].rel;
    const relKm = Math.hypot(...rel.r) * AU_KM;
    const k = 1.8 + 1.1 * Math.log(relKm / (parent.d / 2));
    const dist = visRadius(parent.d) * k;
    const dir = toThree(rel.r).normalize();
    const h = new THREE.Vector3().crossVectors(new THREE.Vector3(...rel.r), new THREE.Vector3(...rel.v));
    const normal = toThree(h.toArray()).normalize();
    local[b.id] = local[b.parent].clone().add(dir.clone().multiplyScalar(dist));
    moonInfo[b.id] = { dist, dir, normal, center: local[b.parent] };
  }

  // ---------- 轨道线 ----------
  const orbitMat = (op) => {
    const m = new THREE.LineBasicMaterial({ color: 0xc9a25a, transparent: true, opacity: op, depthWrite: false });
    fadeMats.push({ mat: m, base: op });
    return m;
  };
  const planetOrbitMat = orbitMat(0.22);
  const smallOrbitMat = orbitMat(0.1);
  const moonOrbitMat = orbitMat(0.16);
  for (const b of bodies) {
    if (b.id === 'sun') continue;
    if (b.parent) {
      const { dist, dir, normal, center } = moonInfo[b.id];
      const e2 = new THREE.Vector3().crossVectors(normal, dir);
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(center.clone().add(dir.clone().multiplyScalar(Math.cos(a) * dist)).add(e2.clone().multiplyScalar(Math.sin(a) * dist)));
      }
      details.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), moonOrbitMat));
    } else {
      const rec = solarData.bodies[b.id];
      const { arcs } = orbitArcs(rec.r, rec.v);
      for (const arc of arcs) {
        const pts = arc.map((p) => compress(p));
        details.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), b.kind === 'planet' ? planetOrbitMat : smallOrbitMat));
      }
    }
  }

  // ---------- 小行星带 / 柯伊伯带 ----------
  const belt = (count, aMin, aMax, incl, color, size, seed) => {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = aMin + (aMax - aMin) * rnd();
      const th = rnd() * Math.PI * 2;
      const inc = (rnd() - 0.5) * 2 * incl;
      const r = [a * Math.cos(th) * Math.cos(inc), a * Math.sin(th) * Math.cos(inc), a * Math.sin(inc)];
      pos.set(compress(r).toArray(), i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false });
    fadeMats.push({ mat: m, base: 0.55 });
    details.add(new THREE.Points(g, m));
  };
  belt(low ? 1200 : 2600, 2.1, 3.3, 0.15, 0x8a7a66, 1.2, 4321);
  belt(low ? 1500 : 3600, 30, 50, 0.25, 0x6f7f9a, 1.2, 8765);

  // ---------- 天体 ----------
  const sunLight = new THREE.PointLight(0xfff1dc, 2.6, 0, 0);
  group.add(sunLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.07));

  for (const b of bodies) {
    const holder = new THREE.Group();
    holder.position.copy(local[b.id]);
    group.add(holder);
    const r = visRadius(b.d);
    let mesh;
    if (b.id === 'sun') {
      mesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ map: surfaceTexture(b.look, low ? 256 : 512), color: 0xffffff }));
      const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb04a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      corona.scale.setScalar(r * 3.6);
      holder.add(corona);
      const outer = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a2a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      outer.scale.setScalar(r * 9);
      holder.add(outer);
    } else {
      const tex = surfaceTexture(b.look, b.kind === 'planet' ? (low ? 256 : 512) : 128);
      mesh = new THREE.Mesh(
        sphere,
        new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05 }),
      );
    }
    mesh.scale.setScalar(r);
    holder.add(mesh);

    // 自转轴
    if (b.pole) {
      const pole = toThree(eqToEcl(raDecToEq(b.pole[0], b.pole[1]))).normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pole);
    } else if (moonInfo[b.id]) {
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), moonInfo[b.id].normal);
    }
    if (b.look.ring) {
      const inner = 1.24;
      const outer = 2.27;
      const rg = new THREE.RingGeometry(inner, outer, 160, 1);
      const p = rg.attributes.position;
      const uv = rg.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const rr = Math.hypot(p.getX(i), p.getY(i));
        uv.setXY(i, (rr - inner) / (outer - inner), 0.5);
      }
      rg.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: saturnRingTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xdddddd }));
      mesh.add(ring);
    }
    const spin = b.id === 'sun' ? 0.05 : b.kind === 'planet' ? 0.25 : 0.08;
    spinners.push({ mesh, spin });

    // 标记点（恒定屏幕尺寸）
    const marker = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: KINDS[b.kind].color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false }),
    );
    marker.scale.setScalar(0.014);
    holder.add(marker);
    // 点亮后的光晕（世界尺寸）
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc35a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(r * 5);
    holder.add(halo);

    const minFrame = moonInfo[b.id] ? moonInfo[b.id].dist * 1.6 : b.id === 'sun' ? 1.4 : Math.max(r * 12, 0.12);
    const labelRange = moonInfo[b.id] ? moonInfo[b.id].dist * 7 : b.id === 'sun' ? 300 : 40;
    nodes[b.id] = { body: b, holder, mesh, marker, halo, radius: r, minFrame, labelRange, solar: true, worldPos: new THREE.Vector3() };
  }

  group.updateMatrixWorld(true);
  for (const id in nodes) nodes[id].holder.getWorldPosition(nodes[id].worldPos);
  const eclipticUp = new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion);

  function update(dt, camDist) {
    for (const s of spinners) s.mesh.rotateY(dt * s.spin);
    // 拉远到银河尺度时淡出太阳系细节
    const f = 1 - THREE.MathUtils.smoothstep(Math.log10(camDist), Math.log10(250), Math.log10(2500));
    for (const { mat, base } of fadeMats) mat.opacity = base * f;
    details.visible = f > 0.002;
    // 天体网格在银河尺度下只有亚像素大小，隐藏以省顶点（太阳保留，作为银河中的一颗恒星）
    for (const id in nodes) if (id !== 'sun') nodes[id].mesh.visible = f > 0.002;
    return f;
  }

  return { group, nodes, eclipticUp, update };
}
