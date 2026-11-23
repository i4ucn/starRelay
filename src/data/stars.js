// 比太阳大的 15 颗著名恒星。数值取自英文 Wikipedia 信息框（2026-11-23 抓取），source 记录其引用文献。
// 扁球恒星（河鼓二、织女星）用等体积平均半径 (a²c)^(1/3)，与妊神星的口径一致。
// approx: true 表示不确定性大，界面上会标“约”。

export const STARS = [
  { id: 'alphacen', zh: '南门二A', en: 'Alpha Centauri A', ra: '14 39 36.494', dec: '-60 50 02.3737', distLy: 4.344, rsun: 1.223, spectral: 'G2V',
    src: 'R: Ebrahimkutty et al. 2026 (arXiv:2609.18868)；距离: Akeson et al. 2021, AJ 162, 14' },
  { id: 'sirius', zh: '天狼星', en: 'Sirius A', ra: '06 45 08.917', dec: '-16 42 58.02', distLy: 8.61, rsun: 1.7144, spectral: 'A1V',
    src: 'R 与距离: Bond et al. 2017, ApJ 840, 70' },
  { id: 'altair', zh: '河鼓二', en: 'Altair', ra: '19 50 46.99855', dec: '+08 52 05.9563', distLy: 16.73, rsun: 1.848, spectral: 'A7V',
    src: 'R: Bouchaud et al. 2020, A&A 633, A78（赤道 2.008 / 极 1.565，取等体积平均）；距离: Hipparcos' },
  { id: 'vega', zh: '织女星', en: 'Vega', ra: '18 36 56.33635', dec: '+38 47 01.2802', distLy: 25.04, rsun: 2.619, spectral: 'A0V',
    src: 'R: Monnier et al. 2012, ApJ 761, L3（赤道 2.726 / 极 2.418，取等体积平均）；距离: Hipparcos' },
  { id: 'pollux', zh: '北河三', en: 'Pollux', ra: '07 45 18.94987', dec: '+28 01 34.3160', distLy: 33.78, rsun: 8.97, spectral: 'K0III',
    src: 'R: Baines et al. 2025, AJ 169, 293；距离: Hipparcos' },
  { id: 'arcturus', zh: '大角星', en: 'Arcturus', ra: '14 15 39.7', dec: '+19 10 56', distLy: 36.7, rsun: 25.4, spectral: 'K1.5III',
    src: 'R: Ramírez & Allende Prieto 2011, ApJ 743, 135；距离: Hipparcos' },
  { id: 'aldebaran', zh: '毕宿五', en: 'Aldebaran', ra: '04 35 55.23907', dec: '+16 30 33.4885', distLy: 67, rsun: 45.1, spectral: 'K5III',
    src: 'R: Hatzes et al. 2015, A&A 580, A31；距离: Hipparcos' },
  { id: 'canopus', zh: '老人星', en: 'Canopus', ra: '06 23 57.10988', dec: '-52 41 44.3810', distLy: 310, rsun: 73.3, spectral: 'A9II',
    src: 'R: Domiciano de Souza et al. 2021, A&A 654, A19（73.3±5.2）；距离: Hipparcos', note: '与参宿七仅差 0.8 R☉，误差范围重叠' },
  { id: 'rigel', zh: '参宿七', en: 'Rigel', ra: '05 14 32.27210', dec: '-08 12 05.8981', distLy: 848, rsun: 74.1, spectral: 'B8Ia',
    src: 'R: Baines et al. 2018, AJ 155, 30（74.1 +6.1/−7.3）；距离: de Almeida et al. 2022, MNRAS 515, 1', note: '与老人星误差范围重叠' },
  { id: 'deneb', zh: '天津四', en: 'Deneb', ra: '20 41 25.9', dec: '+45 16 49', distLy: 2029, rsun: 138, spectral: 'A2Ia', approx: true,
    src: '由光度 log L=5.03 与 Teff=8,900 K 推算（Wikipedia）；距离: Nurmakhametova et al. 2026, Galaxies 14, 87', note: '非直接测量' },
  { id: 'antares', zh: '心宿二', en: 'Antares', ra: '16 29 24.45970', dec: '-26 25 55.2094', distLy: 550, rsun: 680, spectral: 'M1.5Iab', approx: true,
    src: 'R: Ohnaka et al. 2013, A&A 555, A24；距离: Hipparcos（约 550 光年）', note: '半径随脉动变化约 19%' },
  { id: 'betelgeuse', zh: '参宿四', en: 'Betelgeuse', ra: '05 55 10.30536', dec: '+07 24 25.4304', distLy: 548, rsun: 764, spectral: 'M1Ia', approx: true,
    src: 'R: Joyce et al. 2020, ApJ 902, 63（764 +116/−62）；距离同文', note: '信息框给出 640–764 区间' },
  { id: 'uyscuti', zh: '盾牌座UY', en: 'UY Scuti', ra: '18 27 36.5334', dec: '-12 27 58.866', distLy: 5871, rsun: 909, spectral: 'M4Ia', approx: true,
    src: 'R: Healy et al. 2024, MNRAS 529, 3630；距离: Bailer-Jones et al. 2021（Gaia EDR3）', note: '旧值 1,708 R☉' },
  { id: 'vycma', zh: '大犬座VY', en: 'VY Canis Majoris', ra: '07 22 58.32877', dec: '-25 46 03.2355', distLy: 3820, rsun: 1420, spectral: 'M4Ia', approx: true,
    src: 'R 与距离: Wittkowski et al. 2012, A&A 540, L12（1,420±120）' },
  { id: 'st218', zh: '史蒂文森2-18', en: 'Stephenson 2-18', ra: '18 39 02.3709', dec: '-06 05 10.5357', distLy: 18900, rsun: 1840, spectral: 'M5Ia', approx: true,
    src: 'R: Siebert et al. 2026（arXiv:2609.31362，预印本）；距离: Davies et al. 2007, ApJ 671, 781', note: '旧值 2,150 R☉（Fok et al. 2012）' },
];

export function parseRa(s) {
  const [h, m, sec] = s.split(' ').map(Number);
  return 15 * (h + m / 60 + sec / 3600);
}
export function parseDec(s) {
  const sign = s.trim().startsWith('-') ? -1 : 1;
  const [d, m, sec] = s.replace(/^[+-]/, '').split(' ').map(Number);
  return sign * (d + m / 60 + sec / 3600);
}

export function spectralColor(sp) {
  const c = sp[0];
  return { O: '#9db4ff', B: '#aac4ff', A: '#e6eeff', F: '#fff4d8', G: '#ffe08a', K: '#ffb36b', M: '#ff7a4a' }[c] || '#ffffff';
}
