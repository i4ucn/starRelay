// 太阳系天体（49 个，含太阳）。尺寸 d 为直径（km）。
// 口径：行星用 NASA Planetary Fact Sheet 赤道直径；卫星用 JPL SSD 卫星物理参数表的平均半径 ×2；
// 矮行星 / 小行星用所注论文的平均（或等体积）直径。位置数据见 solar.json（JPL Horizons, 2026-11-23）。
// look.type: rock | ice | gas | earth | sun | io | europa | titan | iapetus | venus | mars

export const SOLAR_BODIES = [
  // ---- 卫星 ----
  { id: 'deimos',    zh: '火卫二', en: 'Deimos',    kind: 'moon', parent: 'mars',    hz: '402', d: 12.4,   src: 'JPL SSD 卫星物理参数 R=6.2 km',      look: { type: 'rock', c: '#8a7f72' } },
  { id: 'phobos',    zh: '火卫一', en: 'Phobos',    kind: 'moon', parent: 'mars',    hz: '401', d: 22.2,   src: 'JPL SSD 卫星物理参数 R=11.08 km',    look: { type: 'rock', c: '#7a6e64' } },
  { id: 'puck',      zh: '天卫十五', en: 'Puck',    kind: 'moon', parent: 'uranus',  hz: '715', d: 162,    src: 'JPL SSD 卫星物理参数 R=81 km',       look: { type: 'rock', c: '#77736d' } },
  { id: 'amalthea',  zh: '木卫五', en: 'Amalthea',  kind: 'moon', parent: 'jupiter', hz: '505', d: 167,    src: 'JPL SSD 卫星物理参数 R=83.5 km',     look: { type: 'rock', c: '#a5553a' } },
  { id: 'janus',     zh: '土卫十', en: 'Janus',     kind: 'moon', parent: 'saturn',  hz: '610', d: 179,    src: 'JPL SSD 卫星物理参数 R=89.5 km',     look: { type: 'ice',  c: '#b8b2a6' } },
  { id: 'phoebe',    zh: '土卫九', en: 'Phoebe',    kind: 'moon', parent: 'saturn',  hz: '609', d: 213,    src: 'JPL SSD 卫星物理参数 R=106.5 km',    look: { type: 'rock', c: '#55504b' } },
  { id: 'hyperion',  zh: '土卫七', en: 'Hyperion',  kind: 'moon', parent: 'saturn',  hz: '607', d: 270,    src: 'JPL SSD 卫星物理参数 R=135 km',      look: { type: 'ice',  c: '#b39f86' } },
  { id: 'nereid',    zh: '海卫二', en: 'Nereid',    kind: 'moon', parent: 'neptune', hz: '802', d: 340,    src: 'JPL SSD 卫星物理参数 R=170 km',      look: { type: 'ice',  c: '#a9a6a0' } },
  { id: 'mimas',     zh: '土卫一', en: 'Mimas',     kind: 'moon', parent: 'saturn',  hz: '601', d: 396.4,  src: 'JPL SSD 卫星物理参数 R=198.2 km',    look: { type: 'ice',  c: '#c9c6c0' } },
  { id: 'proteus',   zh: '海卫八', en: 'Proteus',   kind: 'moon', parent: 'neptune', hz: '808', d: 420,    src: 'JPL SSD 卫星物理参数 R=210 km',      look: { type: 'rock', c: '#6f6a66' } },
  { id: 'miranda',   zh: '天卫五', en: 'Miranda',   kind: 'moon', parent: 'uranus',  hz: '705', d: 471.6,  src: 'JPL SSD 卫星物理参数 R=235.8 km',    look: { type: 'ice',  c: '#a9aeb3' } },
  { id: 'enceladus', zh: '土卫二', en: 'Enceladus', kind: 'moon', parent: 'saturn',  hz: '602', d: 504.2,  src: 'JPL SSD 卫星物理参数 R=252.1 km',    look: { type: 'ice',  c: '#f2f6fa' } },
  { id: 'tethys',    zh: '土卫三', en: 'Tethys',    kind: 'moon', parent: 'saturn',  hz: '603', d: 1062.2, src: 'JPL SSD 卫星物理参数 R=531.1 km',    look: { type: 'ice',  c: '#dcdad4' } },
  { id: 'dione',     zh: '土卫四', en: 'Dione',     kind: 'moon', parent: 'saturn',  hz: '604', d: 1122.8, src: 'JPL SSD 卫星物理参数 R=561.4 km',    look: { type: 'ice',  c: '#cfccc6' } },
  { id: 'ariel',     zh: '天卫一', en: 'Ariel',     kind: 'moon', parent: 'uranus',  hz: '701', d: 1157.8, src: 'JPL SSD 卫星物理参数 R=578.9 km',    look: { type: 'ice',  c: '#bfc2c4' } },
  { id: 'umbriel',   zh: '天卫二', en: 'Umbriel',   kind: 'moon', parent: 'uranus',  hz: '702', d: 1169.4, src: 'JPL SSD 卫星物理参数 R=584.7 km',    look: { type: 'rock', c: '#6c6a68' } },
  { id: 'charon',    zh: '冥卫一', en: 'Charon',    kind: 'moon', parent: 'pluto',   hz: '901', d: 1212,   src: 'JPL SSD 卫星物理参数 R=606 km',      look: { type: 'ice',  c: '#a39b94' } },
  { id: 'iapetus',   zh: '土卫八', en: 'Iapetus',   kind: 'moon', parent: 'saturn',  hz: '608', d: 1468.6, src: 'JPL SSD 卫星物理参数 R=734.3 km',    look: { type: 'iapetus', c: '#d8d0c0', c2: '#3a2f26' } },
  { id: 'oberon',    zh: '天卫四', en: 'Oberon',    kind: 'moon', parent: 'uranus',  hz: '704', d: 1522.8, src: 'JPL SSD 卫星物理参数 R=761.4 km',    look: { type: 'rock', c: '#8d817a' } },
  { id: 'rhea',      zh: '土卫五', en: 'Rhea',      kind: 'moon', parent: 'saturn',  hz: '605', d: 1527.6, src: 'JPL SSD 卫星物理参数 R=763.8 km',    look: { type: 'ice',  c: '#d2cfca' } },
  { id: 'titania',   zh: '天卫三', en: 'Titania',   kind: 'moon', parent: 'uranus',  hz: '703', d: 1577.8, src: 'JPL SSD 卫星物理参数 R=788.9 km',    look: { type: 'ice',  c: '#b0aaa4' } },
  { id: 'triton',    zh: '海卫一', en: 'Triton',    kind: 'moon', parent: 'neptune', hz: '801', d: 2706.8, src: 'JPL SSD 卫星物理参数 R=1353.4 km',   look: { type: 'ice',  c: '#d9c8c0' } },
  { id: 'europa',    zh: '木卫二', en: 'Europa',    kind: 'moon', parent: 'jupiter', hz: '502', d: 3121.6, src: 'JPL SSD 卫星物理参数 R=1560.8 km',   look: { type: 'europa', c: '#d8cdb2', c2: '#8a5a3c' } },
  { id: 'moon',      zh: '月球',   en: 'Moon',      kind: 'moon', parent: 'earth',   hz: '301', d: 3474.8, src: 'JPL SSD 卫星物理参数 R=1737.4 km',   look: { type: 'rock', c: '#9c9a96' } },
  { id: 'io',        zh: '木卫一', en: 'Io',        kind: 'moon', parent: 'jupiter', hz: '501', d: 3643.2, src: 'JPL SSD 卫星物理参数 R=1821.6 km',   look: { type: 'io', c: '#e3cf6a', c2: '#c46b2a' } },
  { id: 'callisto',  zh: '木卫四', en: 'Callisto',  kind: 'moon', parent: 'jupiter', hz: '504', d: 4820.6, src: 'JPL SSD 卫星物理参数 R=2410.3 km',   look: { type: 'rock', c: '#6e6255' } },
  { id: 'titan',     zh: '土卫六', en: 'Titan',     kind: 'moon', parent: 'saturn',  hz: '606', d: 5149.5, src: 'JPL SSD 卫星物理参数 R=2574.7 km',   look: { type: 'titan', c: '#d9a441' } },
  { id: 'ganymede',  zh: '木卫三', en: 'Ganymede',  kind: 'moon', parent: 'jupiter', hz: '503', d: 5262.4, src: 'JPL SSD 卫星物理参数 R=2631.2 km',   look: { type: 'rock', c: '#9a8e80' } },

  // ---- 小行星 ----
  { id: 'hygiea',   zh: '健神星', en: 'Hygiea',   kind: 'asteroid', hz: '10;',  d: 434,   src: 'Vernazza et al. 2020（433±8 km）',       look: { type: 'rock', c: '#5e5850' } },
  { id: 'pallas',   zh: '智神星', en: 'Pallas',   kind: 'asteroid', hz: '2;',   d: 512,   src: 'Marsset et al. 2020（平均直径 512 km）', look: { type: 'rock', c: '#7d7a76' } },
  { id: 'vesta',    zh: '灶神星', en: 'Vesta',    kind: 'asteroid', hz: '4;',   d: 525.4, src: 'Russell et al. 2012（Dawn）',            look: { type: 'rock', c: '#8f877c' } },

  // ---- 矮行星 / 候选矮行星 ----
  { id: 'orcus',    zh: '亡神星', en: 'Orcus',    kind: 'dwarf', hz: '90482;',  d: 910,    src: 'Brown & Butler 2017（910 km）',                 look: { type: 'ice', c: '#9a958f' } },
  { id: 'ceres',    zh: '谷神星', en: 'Ceres',    kind: 'dwarf', hz: '1;',      d: 939.4,  src: 'Park et al. 2019（Dawn，939.4 km）',           look: { type: 'rock', c: '#7c7670' } },
  { id: 'sedna',    zh: '赛德娜', en: 'Sedna',    kind: 'dwarf', hz: '90377;',  d: 995,    src: 'Pál et al. 2012（995±80 km）',                 look: { type: 'ice', c: '#b5523b' } },
  { id: 'quaoar',   zh: '创神星', en: 'Quaoar',   kind: 'dwarf', hz: '50000;',  d: 1110,   src: 'Braga-Ribas et al. 2013（1110±5 km）',          look: { type: 'ice', c: '#9b6b58' } },
  { id: 'gonggong', zh: '共工星', en: 'Gonggong', kind: 'dwarf', hz: '225088;', d: 1230,   src: 'Kiss et al. 2019（1230±50 km）',               look: { type: 'ice', c: '#a0503c' } },
  { id: 'makemake', zh: '鸟神星', en: 'Makemake', kind: 'dwarf', hz: '136472;', d: 1430,   src: 'Ortiz et al. 2012（1430±9 km）',               look: { type: 'ice', c: '#c4886a' } },
  { id: 'haumea',   zh: '妊神星', en: 'Haumea',   kind: 'dwarf', hz: '136108;', d: 1595,   src: 'Ortiz et al. 2017 三轴 1161×852×513 km 的等体积直径', look: { type: 'ice', c: '#e4e2de' } },
  { id: 'eris',     zh: '阋神星', en: 'Eris',     kind: 'dwarf', hz: '136199;', d: 2326,   src: 'Sicardy et al. 2011（2326±12 km）',            look: { type: 'ice', c: '#e9e6e1' } },
  { id: 'pluto',    zh: '冥王星', en: 'Pluto',    kind: 'dwarf', hz: '999',     d: 2376.6, src: 'Nimmo et al. 2017（New Horizons）',            look: { type: 'ice', c: '#c9a98b' } },

  // ---- 行星（NASA Planetary Fact Sheet 赤道直径）----
  { id: 'mercury', zh: '水星',   en: 'Mercury', kind: 'planet', hz: '199', d: 4879,   src: 'NASA Planetary Fact Sheet', look: { type: 'rock', c: '#9b8f84' }, pole: [281.01, 61.42] },
  { id: 'mars',    zh: '火星',   en: 'Mars',    kind: 'planet', hz: '499', d: 6792,   src: 'NASA Planetary Fact Sheet', look: { type: 'mars', c: '#c1440e', c2: '#e8b48a' }, pole: [317.68, 52.89] },
  { id: 'venus',   zh: '金星',   en: 'Venus',   kind: 'planet', hz: '299', d: 12104,  src: 'NASA Planetary Fact Sheet', look: { type: 'venus', c: '#e6c48a' }, pole: [272.76, 67.16] },
  { id: 'earth',   zh: '地球',   en: 'Earth',   kind: 'planet', hz: '399', d: 12756,  src: 'NASA Planetary Fact Sheet', look: { type: 'earth', c: '#2a5fa8' }, pole: [0, 90] },
  { id: 'neptune', zh: '海王星', en: 'Neptune', kind: 'planet', hz: '899', d: 49528,  src: 'NASA Planetary Fact Sheet', look: { type: 'gas', c: '#3d6fd6', c2: '#6f95ef' }, pole: [299.36, 43.46] },
  { id: 'uranus',  zh: '天王星', en: 'Uranus',  kind: 'planet', hz: '799', d: 51118,  src: 'NASA Planetary Fact Sheet', look: { type: 'gas', c: '#8fd3dc', c2: '#a9e3e8' }, pole: [257.31, -15.18] },
  { id: 'saturn',  zh: '土星',   en: 'Saturn',  kind: 'planet', hz: '699', d: 120536, src: 'NASA Planetary Fact Sheet', look: { type: 'gas', c: '#d8b878', c2: '#a88a55', ring: true }, pole: [40.59, 83.54] },
  { id: 'jupiter', zh: '木星',   en: 'Jupiter', kind: 'planet', hz: '599', d: 142984, src: 'NASA Planetary Fact Sheet', look: { type: 'gas', c: '#d6b48c', c2: '#9c6b46', spot: true }, pole: [268.06, 64.50] },

  // ---- 太阳 ----
  { id: 'sun', zh: '太阳', en: 'Sun', kind: 'star', d: 1392700, rsun: 1, spectral: 'G2V', src: 'IAU 2015 B3 名义太阳半径 695,700 km', look: { type: 'sun', c: '#ffd27a' }, pole: [286.13, 63.87] },
];

export const KM_PER_RSUN = 695700;

// 分段：边界按数据确定，保证每段是接力顺序中连续的一串
export const BANDS = [
  { key: 'I',   label: '< 1,000 km',         test: (km) => km < 1000 },
  { key: 'II',  label: '1,000 – 5,000 km',   test: (km) => km >= 1000 && km < 5000 },
  { key: 'III', label: '5,000 – 150,000 km', test: (km) => km >= 5000 && km < 1.5e5 },
  { key: 'IV',  label: '恒星 1 – 10 R☉',     test: (km) => km >= 1.5e5 && km < 10 * 2 * KM_PER_RSUN },
  { key: 'V',   label: '巨星 > 10 R☉',        test: (km) => km >= 10 * 2 * KM_PER_RSUN },
];

export const KINDS = {
  moon:     { zh: '卫星',   color: '#8fb0e0' },
  asteroid: { zh: '小行星', color: '#c79a6b' },
  dwarf:    { zh: '矮行星', color: '#c58be0' },
  planet:   { zh: '行星',   color: '#f5b942' },
  star:     { zh: '恒星',   color: '#ff7a45' },
};
