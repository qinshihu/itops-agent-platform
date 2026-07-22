import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Rack3D } from './types';

export type ViewMode = 'overview' | 'zoneA' | 'zoneB';

interface SceneProps {
  racks: Rack3D[];
  onRackClick: (rackId: string) => void;
  selectedRackId?: string | null;
  hoveredRackId?: string | null;
  onHoverChange?: (rackId: string | null) => void;
  heatmapData?: Record<string, number>;
  viewMode: ViewMode;
}

/** Three.js 对象的 userData 扩展属性 */
interface RackUserData {
  rackId?: string;
  isRackDoor?: boolean;
  isStatusLed?: boolean;
  isGlow?: boolean;
  targetRotation?: number;
}

type ThreeObject = THREE.Object3D & { isMesh?: boolean; material?: THREE.Material & { opacity?: number }; userData: RackUserData };

// ── 纹理缓存 ──
const texCache: Record<string, THREE.CanvasTexture> = {};

function floorTex(): THREE.CanvasTexture {
  if (texCache._floor) return texCache._floor;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4a5a6a';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 3) {
    for (let y = 0; y < 256; y += 3) {
      const n = (Math.random() - 0.5) * 10;
      const v = Math.max(0, Math.min(255, 74 + n));
      ctx.fillStyle = `rgb(${v},${v+8},${v+20})`;
      ctx.fillRect(x, y, 3, 3);
    }
  }
  ctx.strokeStyle = '#3a4a55';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);
  ctx.strokeStyle = 'rgba(100,120,140,0.5)';
  ctx.lineWidth = 1;
  [64, 128, 192].forEach(p => {
    ctx.beginPath(); ctx.moveTo(p, 4); ctx.lineTo(p, 252); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, p); ctx.lineTo(252, p); ctx.stroke();
  });
  texCache._floor = new THREE.CanvasTexture(c);
  return texCache._floor;
}

function labelTex(id: string, warn: boolean): THREE.CanvasTexture {
  const k = `L_${id}_${warn}`;
  if (texCache[k]) return texCache[k];
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  if (warn) { g.addColorStop(0, 'rgba(255,80,50,0.15)'); g.addColorStop(0.5, 'rgba(255,80,50,0.3)'); g.addColorStop(1, 'rgba(255,80,50,0.15)'); }
  else { g.addColorStop(0, 'rgba(0,212,255,0.1)'); g.addColorStop(0.5, 'rgba(0,212,255,0.22)'); g.addColorStop(1, 'rgba(0,212,255,0.1)'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = warn ? 'rgba(255,100,60,0.6)' : 'rgba(0,212,255,0.5)';
  ctx.lineWidth = 2; ctx.strokeRect(2, 2, 252, 60);
  ctx.fillStyle = warn ? '#ff8866' : '#00d4ff';
  ctx.font = 'bold 32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = warn ? '#ff4422' : '#00aacc'; ctx.shadowBlur = 8;
  ctx.fillText(id, 128, 34);
  texCache[k] = new THREE.CanvasTexture(c);
  return texCache[k];
}

const geo = {
  led: new THREE.SphereGeometry(0.02, 4, 4),
  glow: new THREE.SphereGeometry(0.035, 4, 4),
  foot: new THREE.CylinderGeometry(0.06, 0.08, 0.1, 8),
};

// 提亮机柜颜色
const mats = {
  bodyN: new THREE.MeshStandardMaterial({ color: 0x6a7a8a, metalness: 0.6, roughness: 0.35 }),
  bodyW: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, metalness: 0.6, roughness: 0.35 }),
  top: new THREE.MeshStandardMaterial({ color: 0x7a8a9a, metalness: 0.7, roughness: 0.25 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x8a9aaa, metalness: 0.85, roughness: 0.15 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xaaddff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.08 }),
  serverN: new THREE.MeshStandardMaterial({ color: 0x5a6a7a, metalness: 0.5, roughness: 0.35 }),
  serverW: new THREE.MeshStandardMaterial({ color: 0x6a5a3a, metalness: 0.5, roughness: 0.35 }),
  ledG: new THREE.MeshBasicMaterial({ color: 0x00ff88 }),
  ledC: new THREE.MeshBasicMaterial({ color: 0x00d4ff }),
  ledR: new THREE.MeshBasicMaterial({ color: 0xff4444 }),
  glowG: new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
  glowR: new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
  sideC: new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
  sideO: new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
};

const RW = 2.2, RD = 1.2, RH = 5.5;
const UH = RH / 42;

function createRack(rack: Rack3D): THREE.Group {
  const g = new THREE.Group();
  g.userData = { rackId: rack.id };
  const warn = rack.alertCount > 0;
  const bm = warn ? mats.bodyW : mats.bodyN;
  const sm = warn ? mats.serverW : mats.serverN;
  const sgm = warn ? mats.sideO : mats.sideC;

  const back = new THREE.Mesh(new THREE.BoxGeometry(RW, RH, 0.06), bm);
  back.position.set(0, RH / 2, -RD / 2);
  back.castShadow = back.receiveShadow = true; g.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.06, RH, RD), bm);
  left.position.set(-RW / 2, RH / 2, 0);
  left.castShadow = left.receiveShadow = true; g.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(0.06, RH, RD), bm);
  right.position.set(RW / 2, RH / 2, 0);
  right.castShadow = right.receiveShadow = true; g.add(right);

  const top = new THREE.Mesh(new THREE.BoxGeometry(RW + 0.1, 0.06, RD + 0.1), mats.top);
  top.position.y = RH + 0.03; top.castShadow = true; g.add(top);

  const bottom = new THREE.Mesh(new THREE.BoxGeometry(RW + 0.1, 0.04, RD + 0.1), bm);
  bottom.position.y = 0.02; bottom.castShadow = true; g.add(bottom);

  [[-RW / 2 + 0.2, -RD / 2 + 0.2], [RW / 2 - 0.2, -RD / 2 + 0.2], [-RW / 2 + 0.2, RD / 2 - 0.2], [RW / 2 - 0.2, RD / 2 - 0.2]].forEach(([fx, fz]) => {
    const f = new THREE.Mesh(geo.foot, mats.top);
    f.position.set(fx, 0.05, fz); g.add(f);
  });

  // 单开门：铰链在机柜右前侧，整扇门绕此铰链向左侧外开
  const ft = 0.04;
  const fm = mats.frame;
  const doorWidth = RW - 0.1;

  const doorPivot = new THREE.Group();
  // 铰链放在右前侧（现实服务器机柜单开门多为右铰链）
  doorPivot.position.set(RW / 2 - ft / 2, 0, RD / 2);
  doorPivot.userData = { isRackDoor: true, side: 'right' };

  // 玻璃面中心相对 pivot 向左偏移半门宽
  const glass = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, RH - 0.1, 0.02), mats.glass);
  glass.position.set(-doorWidth / 2, RH / 2, 0); doorPivot.add(glass);

  // 边框：顶/底/左（铰链侧不需外框）
  const tf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, ft, ft), fm);
  tf.position.set(-doorWidth / 2, RH + ft / 2, 0); doorPivot.add(tf);
  const bf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, ft, ft), fm);
  bf.position.set(-doorWidth / 2, ft / 2, 0); doorPivot.add(bf);
  const of = new THREE.Mesh(new THREE.BoxGeometry(ft, RH - 0.1, ft), fm);
  // 外侧边框（门的左边缘，远离铰链一侧）
  of.position.set(-doorWidth, RH / 2, 0); doorPivot.add(of);

  // 把手在门的内侧左侧（远离铰链，便于开门）
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.06), fm);
  handle.position.set(-doorWidth + 0.2, RH / 2, 0.04); doorPivot.add(handle);

  g.add(doorPivot);

  const usedU = Math.min(rack.usedU, rack.totalU);
  for (let u = 0; u < usedU; u++) {
    const y = UH * (u + 0.5);
    const server = new THREE.Mesh(new THREE.BoxGeometry(RW - 0.3, UH * 0.85, RD - 0.2), sm);
    server.position.set(0, y, 0); server.castShadow = true; g.add(server);
    const ledM = warn ? mats.ledR : (u % 3 === 0 ? mats.ledG : mats.ledC);
    const led = new THREE.Mesh(geo.led, ledM);
    led.position.set(-RW / 2 + 0.2, y, RD / 2 - 0.02); g.add(led);
    const gl = new THREE.Mesh(geo.glow, warn ? mats.glowR : mats.glowG);
    gl.position.copy(led.position); g.add(gl);
  }

  const lt = labelTex(rack.name, warn);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.4),
    new THREE.MeshBasicMaterial({ map: lt, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  label.position.set(0, RH + 0.5, RD / 2 + 0.01); g.add(label);

  const sl = new THREE.Mesh(geo.led, warn ? mats.ledR : mats.ledG);
  sl.position.set(0, RH + 0.03, RD / 2 + 0.01); sl.scale.setScalar(3);
  sl.userData = { isStatusLed: true }; g.add(sl);
  const sg = new THREE.Mesh(geo.glow, warn ? mats.glowR : mats.glowG);
  sg.position.copy(sl.position); sg.scale.setScalar(3);
  sg.userData = { isGlow: true }; g.add(sg);

  const lg = new THREE.Mesh(new THREE.BoxGeometry(0.01, RH * 0.9, 0.01), sgm);
  lg.position.set(-RW / 2 - 0.01, RH / 2, RD / 2 - 0.05); g.add(lg);
  const rg = new THREE.Mesh(new THREE.BoxGeometry(0.01, RH * 0.9, 0.01), sgm);
  rg.position.set(RW / 2 + 0.01, RH / 2, RD / 2 - 0.05); g.add(rg);

  return g;
}

function createEnv(scene: THREE.Scene) {
  const ft = floorTex();
  ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
  ft.repeat.set(40, 40);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ map: ft, color: 0x6a7a8a, metalness: 0.05, roughness: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(80, 40, 0x4488aa, 0x335577);
  grid.position.y = 0.02;
  grid.material.opacity = 0.5;
  grid.material.transparent = true;
  scene.add(grid);
}

// 视图相机目标
// 机柜布局：col*4.5 沿 X 方向（-16..+15.5），row*10 沿 Z 方向（A=row0 → Z=-5，B=row1 → Z=+5）
// 机柜底部 FLOOR_OFFSET=3.5（地板在 y=0，机柜底高于地板 3.5）
// 设计原则：相机 Y 取机柜中点附近（不站太高），target Y 取机柜中点，Z 拉远保证视野宽度
// 这样地板永远在视野底部，机柜站在地板上，符合"地面感"
const FLOOR_OFFSET = 3.5;
const TGT_Y = FLOOR_OFFSET + RH / 2; // = 6.25，机柜中点 Y（RH 在文件顶部已声明）
const VIEW_TARGETS: Record<ViewMode, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  // 总览：俯角 ~20°，相机 Y 抬高确保地板占视野底部 1/3、机柜在中上部
  overview: { pos: new THREE.Vector3(0, TGT_Y + 18, 48), target: new THREE.Vector3(0, TGT_Y, 0) },
  // zoneA：从 A 区南侧远处斜俯视 A 区（俯角 ~16°），地板在下、机柜立面朝相机
  zoneA:    { pos: new THREE.Vector3(0, TGT_Y + 15, -50), target: new THREE.Vector3(0, TGT_Y, -5) },
  // zoneB：从 B 区北侧远处斜俯视 B 区
  zoneB:    { pos: new THREE.Vector3(0, TGT_Y + 15, 50),  target: new THREE.Vector3(0, TGT_Y, 5) },
};

export default function Scene({ racks, onRackClick, selectedRackId, hoveredRackId, onHoverChange, heatmapData, viewMode }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rackMap = useRef<Map<string, THREE.Group>>(new Map());
  const ray = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const anim = useRef<{ doors: THREE.Group[]; leds: THREE.Mesh[]; glows: THREE.Mesh[] }>({ doors: [], leds: [], glows: [] });
  const viewModeRef = useRef(viewMode);
  // 视图切换 tween 锁：期间 raf loop 跳过 controls.update()，避免 OrbitControls 用旧 spherical 覆盖相机位置
  const isTweeningView = useRef(false);

  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  // 初始化
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const w = cv.clientWidth, h = cv.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e2e3e);
    scene.fog = new THREE.Fog(0x1e2e3e, 40, 120);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    camera.position.copy(VIEW_TARGETS.overview.pos);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false });
    renderer.setClearColor(0x1e2e3e);
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, cv);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 6;
    controls.maxDistance = 70;
    controls.target.copy(VIEW_TARGETS.overview.target);
    controlsRef.current = controls;

    // 灯光
    scene.add(new THREE.AmbientLight(0xbbccdd, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    scene.add(new THREE.DirectionalLight(0x99aacc, 0.5)).position.set(-20, 25, -10);
    scene.add(new THREE.DirectionalLight(0xaabbdd, 0.4)).position.set(20, 20, 10);
    scene.add(new THREE.PointLight(0x00d4ff, 2.5, 50)).position.set(-10, 8, 0);
    scene.add(new THREE.PointLight(0x00d4ff, 2.5, 50)).position.set(10, 8, 0);
    scene.add(new THREE.PointLight(0x4488ff, 1.5, 40)).position.set(0, 10, 0);
    scene.add(new THREE.HemisphereLight(0x99aacc, 0x445566, 0.6));

    createEnv(scene);

    // 交互
    let dragging = false, ds = { x: 0, y: 0 };

    const onDown = (e: PointerEvent) => {
      dragging = false; ds = { x: e.clientX, y: e.clientY };
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
    };
    const onMove = (e: PointerEvent) => {
      if (Math.abs(e.clientX - ds.x) > 3 || Math.abs(e.clientY - ds.y) > 3) dragging = true;
      const r = cv.getBoundingClientRect();
      mouse.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.current.setFromCamera(mouse.current, camera);
      const hits = ray.current.intersectObjects(
        Array.from(rackMap.current.values()).flatMap(g => { const a: THREE.Object3D[] = []; g.traverse(c => { if ((c as ThreeObject).isMesh) a.push(c); }); return a; }),
        false
      );
      let hid: string | null = null;
      if (hits.length > 0) { let c: THREE.Object3D | null = hits[0].object; while (c && !(c as ThreeObject).userData?.rackId) c = c.parent; if (c) hid = (c as ThreeObject).userData.rackId ?? null; }
      onHoverChange?.(hid);
    };
    const onUp = (e: PointerEvent) => {
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      if (dragging) return;
      const r = cv.getBoundingClientRect();
      mouse.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.current.setFromCamera(mouse.current, camera);
      const hits = ray.current.intersectObjects(
        Array.from(rackMap.current.values()).flatMap(g => { const a: THREE.Object3D[] = []; g.traverse(c => { if ((c as ThreeObject).isMesh) a.push(c); }); return a; }),
        false
      );
      if (hits.length > 0) { let c: THREE.Object3D | null = hits[0].object; while (c && !(c as ThreeObject).userData?.rackId) c = c.parent; if (c) onRackClick((c as ThreeObject).userData.rackId!); }
    };
    cv.addEventListener('pointerdown', onDown);

    const onResize = () => {
      const r = cv.getBoundingClientRect();
      camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
      renderer.setSize(r.width, r.height, false);
    };
    window.addEventListener('resize', onResize);

    let aid: number;
    let lastDebugUpdate = 0;
    const loop = () => {
      aid = requestAnimationFrame(loop);
      // 视图 tween 期间不调用 controls.update()，否则 OrbitControls 会用旧 spherical 反算 camera.position 覆盖 tween
      if (!isTweeningView.current) controls.update();
      const t = Date.now() * 0.001;

      // 调试面板：每 100ms 更新一次相机/目标坐标（节流）
      if (debugRef.current && t - lastDebugUpdate > 0.1) {
        lastDebugUpdate = t;
        debugRef.current.textContent =
          `viewMode: ${viewModeRef.current}\n` +
          `camera pos: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})\n` +
          `target:     (${controls.target.x.toFixed(2)}, ${controls.target.y.toFixed(2)}, ${controls.target.z.toFixed(2)})`;
      }
      anim.current.doors.forEach(d => {
        const tg = (d.userData as RackUserData).targetRotation || 0;
        const df = tg - d.rotation.y;
        if (Math.abs(df) > 0.001) d.rotation.y += df * 0.1;
        else d.rotation.y = tg;
      });
      anim.current.leds.forEach(l => { ((l as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.6 * Math.sin(t * 3); });
      anim.current.glows.forEach(g => {
        g.scale.setScalar(0.7 + 0.5 * Math.sin(t * 3));
        ((g as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.3 * Math.sin(t * 3);
      });
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      window.removeEventListener('resize', onResize);
      cv.removeEventListener('pointerdown', onDown);
      cancelAnimationFrame(aid);
      renderer.dispose();
      scene.clear();
      controls.dispose();
    };
  }, []);

  // 视图切换
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const vt = VIEW_TARGETS[viewMode];
    // 平滑动画：用 tween 锁让 raf loop 跳过 controls.update()，否则 OrbitControls 会用旧 spherical 反算 camera.position
    isTweeningView.current = true;
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = vt.pos;
    const endTarget = vt.target;
    const startTime = Date.now();
    const duration = 800;

    // eslint-disable-next-line no-console
    console.log(
      `[viewTween] START viewMode=${viewMode} | startPos=(${startPos.x.toFixed(2)},${startPos.y.toFixed(2)},${startPos.z.toFixed(2)}) startTarget=(${startTarget.x.toFixed(2)},${startTarget.y.toFixed(2)},${startTarget.z.toFixed(2)}) -> endPos=(${endPos.x.toFixed(2)},${endPos.y.toFixed(2)},${endPos.z.toFixed(2)}) endTarget=(${endTarget.x.toFixed(2)},${endTarget.y.toFixed(2)},${endTarget.z.toFixed(2)})`
    );

    const animView = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
      camera.position.lerpVectors(startPos, endPos, ease);
      controls.target.lerpVectors(startTarget, endTarget, ease);
      camera.lookAt(controls.target);
      // eslint-disable-next-line no-console
      console.log(
        `[viewTween] FRAME t=${t.toFixed(3)} viewMode=${viewMode} | pos=(${camera.position.x.toFixed(2)},${camera.position.y.toFixed(2)},${camera.position.z.toFixed(2)}) target=(${controls.target.x.toFixed(2)},${controls.target.y.toFixed(2)},${controls.target.z.toFixed(2)})`
      );
      if (t < 1) {
        requestAnimationFrame(animView);
      } else {
        // 动画结束：让 OrbitControls 用新的 camera/target 重新构建内部 spherical 状态
        controls.update();
        isTweeningView.current = false;
        // eslint-disable-next-line no-console
        console.log(
          `[viewTween] END viewMode=${viewMode} | finalPos=(${camera.position.x.toFixed(2)},${camera.position.y.toFixed(2)},${camera.position.z.toFixed(2)}) finalTarget=(${controls.target.x.toFixed(2)},${controls.target.y.toFixed(2)},${controls.target.z.toFixed(2)})`
        );
      }
    };
    animView();
  }, [viewMode]);

  // 更新机柜
  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return;
    rackMap.current.forEach(g => scene.remove(g));
    rackMap.current.clear();
    anim.current = { doors: [], leds: [], glows: [] };

    const spacing = 4.5;
    const FLOOR_OFFSET = 3.5; // 抬高机柜底部，让地板在视野中相对下沉
    racks.forEach((rack, i) => {
      const g = createRack(rack);
      const col = i % 8, row = Math.floor(i / 8);
      g.position.set(-16 + col * spacing, FLOOR_OFFSET, -5 + row * 10);
      scene.add(g);
      rackMap.current.set(rack.id, g);
      g.traverse(o => {
        if ((o as ThreeObject).userData?.isRackDoor) anim.current.doors.push(o as THREE.Group);
        if ((o as ThreeObject).userData?.isStatusLed) anim.current.leds.push(o as THREE.Mesh);
        if ((o as ThreeObject).userData?.isGlow) anim.current.glows.push(o as THREE.Mesh);
      });
    });
  }, [racks, heatmapData]);

  // 高亮
  useEffect(() => {
    rackMap.current.forEach((g, id) => {
      const sel = id === selectedRackId, hov = id === hoveredRackId;
      g.scale.setScalar(sel || hov ? 1.03 : 1);
      g.traverse(o => {
        if ((o as ThreeObject).userData?.isRackDoor) {
          // 单开门：铰链在右，门向左侧外开约 110°（绕 Y 逆时针 = 正角度）
          (o as ThreeObject).userData.targetRotation = sel ? Math.PI * (110 / 180) : 0;
        }
      });
    });
  }, [selectedRackId, hoveredRackId]);

  const [debugHost] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.id = 'scene-debug-overlay-host';
    el.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(el);
    return el;
  });
  useEffect(() => {
    return () => { debugHost?.remove(); };
  }, [debugHost]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />
      {debugHost && createPortal(
        <div
          data-debug-camera
          ref={debugRef}
          style={{
            padding: '10px 14px', background: '#000', color: '#00ff88',
            font: 'bold 14px/1.6 ui-monospace,Consolas,monospace', border: '2px solid #00ff88', borderRadius: 6,
            whiteSpace: 'pre', minWidth: 240,
          }}>
          {`viewMode: ${viewMode}\nracks: ${racks.length}\ncamera pos: (--, --, --)\ntarget:     (--, --, --)`}
        </div>,
        debugHost
      )}
    </>
  );
}
