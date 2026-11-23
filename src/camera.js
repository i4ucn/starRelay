import * as THREE from 'three';

// 自定义镜头：目标点 + 对数距离 + 偏航/俯仰；“上方向”可在黄道北与银道北之间平滑过渡。
export function createRig(camera, dom) {
  const st = { target: new THREE.Vector3(), logDist: Math.log(30), yaw: 0.9, pitch: 0.5, up: new THREE.Vector3(0, 1, 0) };
  const want = { target: new THREE.Vector3(), logDist: Math.log(30), pitch: 0.5 };
  // zoom：在自动取景距离上叠加的对数缩放（-3…3，即 ×20…÷20）；由焦距滑块和滚轮设置，松手后保持
  const user = { yaw: 0, pitch: 0, zoom: 0, last: -1e9 };
  const ZOOM_MAX = 3;
  let onZoom = null;
  let now = 0;

  // ---- 交互：拖动旋转、滚轮缩放 ----
  let drag = null;
  dom.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    dom.setPointerCapture(e.pointerId);
    user.last = now;
  });
  dom.addEventListener('pointermove', (e) => {
    if (!drag) return;
    user.yaw -= (e.clientX - drag.x) * 0.006;
    user.pitch = THREE.MathUtils.clamp(user.pitch + (e.clientY - drag.y) * 0.005, -1.2, 1.0);
    drag = { x: e.clientX, y: e.clientY };
    user.last = now;
  });
  const end = () => (drag = null);
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);
  dom.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      user.zoom = THREE.MathUtils.clamp(user.zoom + e.deltaY * 0.0015, -ZOOM_MAX, ZOOM_MAX);
      user.last = now;
      if (onZoom) onZoom(user.zoom);
    },
    { passive: false },
  );

  const H0 = new THREE.Vector3();
  const H1 = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);

  function frame(target, dist, pitch) {
    want.target.copy(target);
    want.logDist = Math.log(Math.max(dist, 1e-6));
    if (pitch !== undefined) want.pitch = pitch;
  }

  function update(dt, t, { snap = false, yawSpeed = 0.07, up } = {}) {
    now = t;
    if (up) st.up.copy(up).normalize();
    const kT = snap ? 1 : 1 - Math.exp(-dt * 3.2);
    const kD = snap ? 1 : 1 - Math.exp(-dt * 2.8);
    // 目标点平滑：在对数尺度下移动距离与相机距离相称
    st.target.lerp(want.target, kT);
    st.logDist += (want.logDist - st.logDist) * kD;
    st.pitch += (want.pitch - st.pitch) * (snap ? 1 : 1 - Math.exp(-dt * 1.5));
    st.yaw += dt * yawSpeed;
    // 拖动造成的俯仰偏移 3 秒后慢慢回正；缩放（焦距）保持用户设定，不回弹
    if (t - user.last > 3) user.pitch -= user.pitch * (1 - Math.exp(-dt * 1.2));
    const dist = Math.exp(st.logDist + user.zoom);
    const U = st.up;
    H0.copy(Math.abs(U.dot(X)) > 0.95 ? Z : X).addScaledVector(U, -(Math.abs(U.dot(X)) > 0.95 ? U.dot(Z) : U.dot(X))).normalize();
    H1.crossVectors(U, H0);
    const yaw = st.yaw + user.yaw;
    const pitch = THREE.MathUtils.clamp(st.pitch + user.pitch, -1.45, 1.45);
    dir.copy(H0).multiplyScalar(Math.cos(yaw) * Math.cos(pitch)).addScaledVector(H1, Math.sin(yaw) * Math.cos(pitch)).addScaledVector(U, Math.sin(pitch));
    camera.position.copy(st.target).addScaledVector(dir, dist);
    camera.up.copy(U);
    camera.lookAt(st.target);
    camera.near = dist * 1e-3;
    camera.far = dist * 1e6;
    camera.updateProjectionMatrix();
    return dist;
  }

  return {
    frame,
    update,
    state: st,
    ZOOM_MAX,
    get zoom() {
      return user.zoom;
    },
    setZoom(z) {
      user.zoom = THREE.MathUtils.clamp(z, -ZOOM_MAX, ZOOM_MAX);
    },
    onZoom(fn) {
      onZoom = fn;
    },
  };
}
