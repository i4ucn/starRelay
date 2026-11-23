import * as THREE from 'three';

// ---------- 程序噪声 ----------
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, seed, wrapX) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const w = (v) => (wrapX ? ((v % wrapX) + wrapX) % wrapX : v);
  const a = hash(w(xi), yi, seed);
  const b = hash(w(xi + 1), yi, seed);
  const c = hash(w(xi), yi + 1, seed);
  const d = hash(w(xi + 1), yi + 1, seed);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed, oct = 4, wrapX = 0) {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f, seed + i * 17, wrapX ? wrapX * f : 0);
    amp *= 0.5;
    f *= 2;
  }
  return s;
}
let seedCounter = 1;

const hex = (c) => new THREE.Color(c);
const mix = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));

function makeCanvasTex(w, h, painter) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  painter(img.data, w, h);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 表面贴图（等距柱状投影）
export function surfaceTexture(look, size = 256) {
  const seed = seedCounter++ * 31;
  const w = size;
  const h = size / 2;
  const base = hex(look.c);
  const alt = look.c2 ? hex(look.c2) : base.clone().multiplyScalar(0.55);
  const S = 8; // 噪声基础频率（经度方向周期 = S）
  return makeCanvasTex(w, h, (d) => {
    for (let y = 0; y < h; y++) {
      const lat = y / h; // 0..1
      for (let x = 0; x < w; x++) {
        const u = (x / w) * S;
        const v = lat * S * 0.5;
        let col;
        const n = fbm(u, v, seed, 5, S);
        switch (look.type) {
          case 'gas': {
            const band = Math.sin(lat * Math.PI * 14 + fbm(u * 0.5, v * 3, seed, 3, S * 0.5) * 3.2);
            const fine = fbm(u * 0.3, v * 12, seed + 5, 3, S * 0.3);
            col = mix(base, alt, 0.5 + 0.35 * band + 0.25 * (fine - 0.5));
            if (look.spot) {
              const dx = (x / w - 0.62) * 3.2;
              const dy = (lat - 0.64) * 6.5;
              const r = dx * dx + dy * dy;
              if (r < 1) col = mix(col, hex('#b5543a'), (1 - r) * 0.8);
            }
            break;
          }
          case 'earth': {
            const land = n > 0.53;
            col = land ? mix(hex('#3d6b35'), hex('#9a8a5c'), (n - 0.53) * 5) : mix(hex('#0d2a5e'), hex('#1f5aa0'), n * 1.4);
            if (lat < 0.07 || lat > 0.93) col = hex('#e8eef5');
            const cloud = fbm(u * 1.6, v * 2.2, seed + 99, 4, S * 1.6);
            if (cloud > 0.56) col = mix(col, hex('#ffffff'), (cloud - 0.56) * 3.5);
            break;
          }
          case 'mars': {
            col = mix(base, alt, (n - 0.35) * 1.6);
            if (lat < 0.05 || lat > 0.95) col = hex('#f2ede6');
            break;
          }
          case 'venus': {
            const sw = fbm(u * 0.6 + lat * 4, v * 2.5, seed, 4, S * 0.6);
            col = mix(base, hex('#fff1cf'), sw - 0.2);
            break;
          }
          case 'io': {
            col = mix(base, hex('#f2e49a'), n);
            const spot = fbm(u * 2.2, v * 2.2, seed + 7, 3, S * 2.2);
            if (spot > 0.62) col = mix(col, alt, (spot - 0.62) * 4);
            if (spot < 0.3) col = mix(col, hex('#2b2116'), (0.3 - spot) * 3);
            break;
          }
          case 'europa': {
            col = mix(base, hex('#f3ecdd'), n);
            const crack = Math.abs(Math.sin((u * 1.3 + fbm(u, v, seed + 3, 3, S) * 6) * 3.0));
            if (crack < 0.08) col = mix(col, alt, 0.7);
            break;
          }
          case 'titan': {
            col = mix(base, hex('#f0c46a'), 0.4 + 0.3 * Math.sin(lat * Math.PI * 4) + (n - 0.5) * 0.3);
            break;
          }
          case 'iapetus': {
            const lead = Math.cos((x / w) * Math.PI * 2) * 0.5 + 0.5;
            col = mix(base, alt, lead > 0.55 + (n - 0.5) * 0.4 ? 1 : 0.05);
            break;
          }
          case 'sun': {
            const g = fbm(u * 4, v * 4, seed, 4, S * 4);
            col = mix(hex('#ff8a1c'), hex('#fff3c2'), g * 1.3);
            break;
          }
          case 'ice': {
            col = mix(base.clone().multiplyScalar(0.78), base.clone().lerp(hex('#ffffff'), 0.25), n);
            break;
          }
          default: {
            // rock：带撞击坑的岩质
            col = mix(base.clone().multiplyScalar(0.6), base.clone().multiplyScalar(1.15), n);
            const crater = fbm(u * 3, v * 3, seed + 11, 2, S * 3);
            if (crater > 0.66) col.multiplyScalar(0.78);
          }
        }
        const i = (y * w + x) * 4;
        d[i] = Math.min(255, col.r * 255);
        d[i + 1] = Math.min(255, col.g * 255);
        d[i + 2] = Math.min(255, col.b * 255);
        d[i + 3] = 255;
      }
    }
  });
}

// 土星环：径向条带（u = 归一化半径）
export function saturnRingTexture() {
  return makeCanvasTex(512, 4, (d, w, h) => {
    for (let x = 0; x < w; x++) {
      const r = x / w;
      let a = 0.25 + 0.6 * fbm(r * 60, 0.5, 4242, 3);
      if (r > 0.57 && r < 0.62) a *= 0.08; // 卡西尼缝
      if (r < 0.12) a *= r / 0.12;
      if (r > 0.96) a *= (1 - r) / 0.04;
      const c = mix(hex('#c8b08a'), hex('#efe0c2'), fbm(r * 30, 1.5, 99, 2));
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        d[i] = c.r * 255;
        d[i + 1] = c.g * 255;
        d[i + 2] = c.b * 255;
        d[i + 3] = a * 255;
      }
    }
  });
}

// 径向辉光
export function glowTexture(stops = [[0, 1], [0.2, 0.6], [0.5, 0.12], [1, 0]]) {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 细圆环（冲击波 / 当前目标金圈）
export function ringTexture(width = 0.06) {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  const r0 = 1 - width * 3;
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(Math.max(0, r0 - 0.12), 'rgba(255,255,255,0)');
  g.addColorStop(r0, 'rgba(255,255,255,0.15)');
  g.addColorStop(1 - width * 1.5, 'rgba(255,255,255,1)');
  g.addColorStop(1 - width * 0.5, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 星芒（十字光）
export function flareTexture() {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, hgt] of [[s, 3], [3, s]]) {
    const lg = ctx.createLinearGradient(s / 2 - w / 2, s / 2 - hgt / 2, s / 2 + w / 2, s / 2 + hgt / 2);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(s / 2 - w / 2, s / 2 - hgt / 2, w, hgt);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
