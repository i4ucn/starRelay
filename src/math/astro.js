import * as THREE from 'three';

export const AU_KM = 1.495978707e8;
export const LY_AU = 63241.077;
export const LIGHT_SEC_PER_AU = 499.004784;
export const MU_SUN = 2.9591220828559115e-4; // au^3 / day^2
export const LY = 1e4; // 世界单位：太阳系压缩坐标里 1 单位 ≈ 1 AU 处；1 光年 = LY 单位

const EPS = THREE.MathUtils.degToRad(23.4392911); // J2000 黄赤交角

// ICRS(J2000 赤道) → 银道坐标 旋转矩阵（Hipparcos 定义）
const EQ2GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];

const mul3 = (m, v) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

export const eclToEq = ([x, y, z]) => [x, y * Math.cos(EPS) - z * Math.sin(EPS), y * Math.sin(EPS) + z * Math.cos(EPS)];
export const eqToEcl = ([x, y, z]) => [x, y * Math.cos(EPS) + z * Math.sin(EPS), -y * Math.sin(EPS) + z * Math.cos(EPS)];
export const eqToGal = (v) => mul3(EQ2GAL, v);

// 天文右手坐标 (x, y, z 北) → three.js (y 朝上)
export const toThree = ([x, y, z]) => new THREE.Vector3(x, z, -y);

export function raDecToEq(raDeg, decDeg) {
  const ra = THREE.MathUtils.degToRad(raDeg);
  const dec = THREE.MathUtils.degToRad(decDeg);
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

// 太阳系子组（黄道坐标，three 映射后）→ 世界（银道坐标，three 映射后）的旋转
export function solarGroupQuaternion() {
  const cols = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].map((e) => eqToGal(eclToEq(e))); // 黄道基向量在银道坐标中的表示
  // local three 轴：X=ecl x, Y=ecl z, Z=-ecl y
  const lx = toThree(cols[0]);
  const ly = toThree(cols[2]);
  const lz = toThree(cols[1]).multiplyScalar(-1);
  const m = new THREE.Matrix4().makeBasis(lx, ly, lz);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

// 恒星：赤经赤纬（度）+ 距离（光年）→ 世界坐标
export function starWorldPos(raDeg, decDeg, distLy) {
  const g = eqToGal(raDecToEq(raDeg, decDeg));
  return toThree(g).multiplyScalar(distLy * LY);
}
// 恒星真实位置（光年，银道坐标），用于光程统计
export function starGalLy(raDeg, decDeg, distLy) {
  return eqToGal(raDecToEq(raDeg, decDeg)).map((c) => c * distLy);
}

// 太阳系压缩：方向不变，距离取 √r（au）
export function compress(rAu) {
  const r = Math.hypot(rAu[0], rAu[1], rAu[2]);
  if (r === 0) return new THREE.Vector3();
  const s = Math.sqrt(r) / r;
  return toThree([rAu[0] * s, rAu[1] * s, rAu[2] * s]);
}

// 状态向量 → 轨道采样点（黄道 au）。返回若干段（只保留 r<rMax 的部分）
export function orbitArcs(r, v, mu = MU_SUN, rMax = 130, n = 360) {
  const R = new THREE.Vector3(...r);
  const V = new THREE.Vector3(...v);
  const rl = R.length();
  const h = new THREE.Vector3().crossVectors(R, V);
  const evec = R.clone()
    .multiplyScalar(V.lengthSq() - mu / rl)
    .sub(V.clone().multiplyScalar(R.dot(V)))
    .divideScalar(mu);
  const e = evec.length();
  const p = h.lengthSq() / mu;
  const W = h.clone().normalize();
  const P = e > 1e-6 ? evec.clone().normalize() : R.clone().normalize();
  const Q = new THREE.Vector3().crossVectors(W, P);
  const arcs = [];
  let cur = [];
  for (let i = 0; i <= n; i++) {
    const nu = (i / n) * Math.PI * 2;
    const rr = p / (1 + e * Math.cos(nu));
    if (rr > 0 && rr < rMax) {
      cur.push(P.clone().multiplyScalar(Math.cos(nu) * rr).add(Q.clone().multiplyScalar(Math.sin(nu) * rr)).toArray());
    } else if (cur.length) {
      arcs.push(cur);
      cur = [];
    }
  }
  if (cur.length) arcs.push(cur);
  // 若首尾相连（闭合椭圆被切成两段），合并
  if (arcs.length > 1) {
    const first = arcs[0];
    const last = arcs[arcs.length - 1];
    if (first.length && last.length && Math.abs(first[0][0] - last[last.length - 1][0]) < 1e-9) {
      arcs[0] = last.concat(first);
      arcs.pop();
    }
  }
  return { arcs, e, a: p / (1 - e * e) };
}

// 光行时间格式化（秒）
export function fmtLightTime(sec) {
  if (sec < 1) return '0 秒';
  if (sec < 60) return `${sec.toFixed(1)} 秒`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分 ${Math.floor(sec % 60)} 秒`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} 小时`;
  const days = sec / 86400;
  if (days < 365.25) return `${days.toFixed(1)} 天`;
  const yr = days / 365.25;
  if (yr < 1e4) return `${yr < 100 ? yr.toFixed(1) : Math.round(yr).toLocaleString('en-US')} 年`;
  return `${(yr / 1e4).toFixed(2)} 万年`;
}

export function fmtDistAu(au) {
  const ly = au / LY_AU;
  if (ly < 0.05) return au < 100 ? `${au.toFixed(2)} AU` : `${Math.round(au).toLocaleString('en-US')} AU`;
  if (ly < 1e4) return `${ly < 100 ? ly.toFixed(2) : Math.round(ly).toLocaleString('en-US')} 光年`;
  return `${(ly / 1e4).toFixed(2)} 万光年`;
}

export function fmtScale(x) {
  if (x < 1e4) return `×${x < 10 ? x.toFixed(1) : Math.round(x).toLocaleString('en-US')}`;
  if (x < 1e8) return `×${(x / 1e4).toFixed(x < 1e5 ? 2 : 1)} 万`;
  return `×${(x / 1e8).toFixed(2)} 亿`;
}
