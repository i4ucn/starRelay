import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export function createWorld(container, { low }) {
  const renderer = new THREE.WebGLRenderer({ antialias: !low, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5));
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1e-4, 1e12);

  // 星空背景：跟随相机，处于“无穷远”
  const sky = new THREE.Group();
  sky.renderOrder = -10;
  scene.add(sky);
  const addStars = (count, size, bright, seed) => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pos.set([r * Math.cos(th), u, r * Math.sin(th)], i * 3);
      const t = rnd();
      c.setHSL(t < 0.2 ? 0.6 : t < 0.5 ? 0.1 : 0.12, t < 0.5 ? 0.5 : 0.15, bright * (0.35 + 0.65 * rnd()));
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, opacity: 1 });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = -10;
    sky.add(p);
    return p;
  };
  const skyDim = addStars(low ? 2500 : 6000, 1.2, 0.55, 12345);
  const skyBright = addStars(low ? 250 : 500, 2.2, 0.95, 777);

  let composer = null;
  let bloom = null;
  if (!low) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 1.05, 0.55, 0.12);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const size = { w: 1, h: 1 };
  const resizeListeners = [];
  function resize() {
    const r = container.getBoundingClientRect();
    size.w = Math.max(1, Math.floor(r.width));
    size.h = Math.max(1, Math.floor(r.height));
    renderer.setSize(size.w, size.h);
    labelRenderer.setSize(size.w, size.h);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setSize(size.w, size.h);
      bloom.resolution.set(size.w / 2, size.h / 2);
    }
    resizeListeners.forEach((f) => f(size.w, size.h));
  }
  new ResizeObserver(resize).observe(container);
  resize();

  function render(camDist) {
    sky.position.copy(camera.position);
    sky.scale.setScalar(camDist * 1000);
    if (composer) composer.render();
    else renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  // 银河尺度下减弱辉光，避免粒子叠加过曝
  function setBloom(galaxyFade) {
    if (bloom) bloom.strength = 1.05 - 0.55 * galaxyFade;
  }

  return { renderer, scene, camera, render, setBloom, size, onResize: (f) => resizeListeners.push(f), skyDim, skyBright, labelRenderer };
}
