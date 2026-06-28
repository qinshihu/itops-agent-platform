import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Rack3D, SlotInfo, CableData } from './types';

interface SceneProps {
  racks: Rack3D[];
  rackSlotsMap: Record<string, SlotInfo[]>;
  onRackClick: (rackId: string) => void;
  selectedRackId?: string | null;
  hoveredRackId?: string | null;
  searchQuery?: string;
  onHoverChange?: (rackId: string | null) => void;
  /** 热力图数? { rackId: 归一化?0~1 }?=?1=?*/
  heatmapData?: Record<string, number>;
  /** 热力图模? 'temperature' | 'utilization' */
  heatmapMode?: 'temperature' | 'utilization';
  /** 线缆拓扑数据（父组件预计算端点位置） */
  cables?: CableData[];
}

// === 常量 ===
const RACK_W = 2.3;
const RACK_D = 2.2;
const PER_U = 0.04445;
const GAP_X = 2.2;
const GAP_Z = 4.0;
const CAM_FOCUS_DURATION = 800; // 相机聚焦动画时长 ms

// ========== 共享材质 ==========
const sharedMats = {
  body: null as THREE.MeshPhysicalMaterial | null,
  glass: null as THREE.MeshPhysicalMaterial | null,
  floor: null as THREE.MeshPhysicalMaterial | null,
  highlight: null as THREE.MeshBasicMaterial | null,
  outline: null as THREE.MeshBasicMaterial | null,
};

function mat(key: 'body' | 'glass' | 'floor' | 'highlight' | 'outline') {
  if (sharedMats[key]) return sharedMats[key]!;
  const m = ({
    body: new THREE.MeshPhysicalMaterial({ color: 0x1a2a3a, metalness: 0.6, roughness: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x88ccff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide, envMapIntensity: 0.5 }),
    floor: (() => { const t = new THREE.DataTexture(new Uint8Array([200,200,200,255]),1,1,THREE.RGBAFormat); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(20,20); t.anisotropy=4; return new THREE.MeshPhysicalMaterial({map:t,color:0x9eada8,metalness:0.05,roughness:0.6,clearcoat:0.1,clearcoatRoughness:0.8}); })(),
    highlight: new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0, side: THREE.BackSide }),
    outline: new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0 }),
  } as const)[key];
  sharedMats[key as keyof typeof sharedMats] = m as any;
  return m;
}

/** 热力图色值映? 0→蓝, 0.25→青, 0.5→绿, 0.75→黄, 1→红 */
function heatColor(value: number): THREE.Color {
  // HSL: hue ?240(? ?0(?
  const hue = 240 - value * 240;
  // 饱和度略降让颜色柔和一?
  return new THREE.Color(`hsl(${Math.max(0, Math.min(360, hue))}, 80%, ${45 + value * 20}%)`);
}

/** 根据 heat value 创建或克隆材?*/
function makeHeatMaterial(baseMat: THREE.MeshPhysicalMaterial, heatValue: number): THREE.MeshPhysicalMaterial {
  if (heatValue <= 0) return baseMat;
  const m = baseMat.clone();
  const c = heatColor(heatValue);
  m.color.copy(c);
  m.emissive = new THREE.Color(c).multiplyScalar(0.15);
  m.emissiveIntensity = 0.3;
  m.needsUpdate = true;
  return m;
}

// ========== 机柜构建 ==========
function buildRackMesh(rack: Rack3D, heatValue = 0) {
  const group = new THREE.Group();
  group.userData.rackId = rack.id;
  const rackH = rack.totalU * PER_U;
  const halfH = rackH / 2;
  const hasAlert = rack.alertCount > 0;

  // 主体（支持热力图着色）
  const bodyMat = heatValue > 0 ? makeHeatMaterial(mat('body'), heatValue) : mat('body');
  const body = new THREE.Mesh(new THREE.BoxGeometry(RACK_W, rackH, RACK_D), bodyMat);
  body.position.y = halfH;
  body.castShadow = true;
  body.userData.part = 'body';
  group.add(body);

  // 玻璃?
  const door = new THREE.Mesh(new THREE.BoxGeometry(RACK_W - 0.1, rackH - 0.1, 0.01), mat('glass'));
  door.position.set(0, halfH, RACK_D / 2 + 0.01);
  door.userData.part = 'door';
  group.add(door);

  // 侧面发光?
  const glowColor = hasAlert ? 0xff4444 : 0x00ff88;
  const glowMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.4 });
  for (const x of [-1.09, 1.09]) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.01, rackH - 0.5, 0.01), glowMat);
    g.position.set(x, halfH, 1.1);
    g.userData.part = 'glow';
    group.add(g);
  }

  // 顶部状态灯
  const sLight = new THREE.PointLight(hasAlert ? 0xff4444 : 0x00ff88, 0.4, 3);
  sLight.position.set(0, rackH + 0.08, 1.18);
  sLight.userData.part = 'light';
  group.add(sLight);

  // 标签
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256; labelCanvas.height = 64;
  const lCtx = labelCanvas.getContext('2d')!;
  lCtx.clearRect(0, 0, 256, 64);
  lCtx.fillStyle = '#88ccff';
  lCtx.font = 'bold 28px Arial';
  lCtx.textAlign = 'center';
  lCtx.fillText(rack.name, 128, 42);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
  const label = new THREE.Sprite(labelMat);
  label.position.set(0, rackH + 0.8, 0);
  label.scale.set(3, 0.75, 1);
  label.userData.part = 'label';
  group.add(label);

  // 占用?
  const usedRatio = Math.min(rack.totalU > 0 ? rack.usedU / rack.totalU : 0, 1);
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 8; pCanvas.height = 64;
  const pCtx = pCanvas.getContext('2d')!;
  pCtx.fillStyle = '#0a1420';
  pCtx.fillRect(0, 0, 8, 64);
  const fillH = Math.round(usedRatio * 64);
  const grad = pCtx.createLinearGradient(0, 64 - fillH, 0, 64);
  grad.addColorStop(0, hasAlert ? '#ff4444' : '#00ff88');
  grad.addColorStop(1, hasAlert ? '#ff8844' : '#00cc66');
  pCtx.fillStyle = grad;
  pCtx.fillRect(0, 64 - fillH, 8, fillH);
  const perfTex = new THREE.CanvasTexture(pCanvas);
  const perfMat = new THREE.SpriteMaterial({ map: perfTex, transparent: true, depthTest: false });
  const perfSprite = new THREE.Sprite(perfMat);
  perfSprite.position.set(RACK_W / 2 + 0.2, halfH, 0);
  perfSprite.scale.set(0.15, rackH * 0.8, 1);
  perfSprite.userData.part = 'perf';
  group.add(perfSprite);

  // 点击 hitbox
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(RACK_W * 2.5, rackH, RACK_D * 2.5),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  hit.position.y = halfH;
  hit.userData = { isRack: true, rackId: rack.id, part: 'hitbox' };
  group.add(hit);

  // 高亮边框（默认隐藏）
  const hl = new THREE.Mesh(
    new THREE.BoxGeometry(RACK_W + 0.15, rackH + 0.15, RACK_D + 0.15),
    mat('highlight')
  );
  hl.position.y = halfH;
  hl.userData.part = 'highlight';
  hl.visible = false;
  group.add(hl);

  return group;
}

// ========== 线缆构建 ==========
const CABLE_COLORS: Record<string, number> = {
  cat5: 0xcccccc, cat5e: 0xcccccc, cat6: 0x3366cc,
  cat6a: 0x3366cc, cat7: 0xff6600, cat8: 0xcc3300,
  fiber_om3: 0x33cc33, fiber_om4: 0x00aa00, fiber_os2: 0xffff00,
  coax: 0xdd8844, power: 0xff4444, default: 0x888888,
};

function buildCableMesh(cables: CableData[]) {
  const group = new THREE.Group();
  group.name = 'cables';

  for (const cable of cables) {
    if (cable.status !== 'connected') continue;
    const a = cable.a_position;
    const b = cable.b_position;
    const midY = Math.max(a[1], b[1]) + 1.5;
    const points = [
      new THREE.Vector3(a[0], a[1], a[2]),
      new THREE.Vector3(a[0], midY, a[2]),
      new THREE.Vector3((a[0] + b[0]) / 2, midY + 0.5, (a[2] + b[2]) / 2),
      new THREE.Vector3(b[0], midY, b[2]),
      new THREE.Vector3(b[0], b[1], b[2]),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const geom = new THREE.TubeGeometry(curve, 20, 0.04, 6, false);
    const color = CABLE_COLORS[cable.cable_type] || CABLE_COLORS.default;
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      roughness: 0.4,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = { part: 'cable', cableId: cable.id };
    group.add(mesh);
  }
  return group;
}

// ========== 高亮状态管?==========
function setRackHighlight(group: THREE.Group, state: 'none' | 'hover' | 'selected' | 'search') {
  // ?traverse 找到 highlight mesh
  let hlMesh: THREE.Mesh | null = null;
  group.traverse(c => { if (c.userData?.part === 'highlight') hlMesh = c as THREE.Mesh; });
  if (!hlMesh) return;

  const mat = hlMesh.material as THREE.MeshBasicMaterial;
  hlMesh.visible = state !== 'none';
  switch (state) {
    case 'hover':
      mat.color.setHex(0x00ffcc);
      mat.opacity = 0.3;
      break;
    case 'selected':
      mat.color.setHex(0x00ccff);
      mat.opacity = 0.5;
      break;
    case 'search':
      mat.color.setHex(0xffdd00);
      mat.opacity = 0.25;
      break;
  }
}

// ========== 场景组件 ==========
export default function Scene({
  racks, rackSlotsMap, onRackClick,
  selectedRackId, hoveredRackId, searchQuery, onHoverChange,
  heatmapData, heatmapMode = 'temperature',
  cables = [],
}: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rackGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const cableGroupRef = useRef<THREE.Group | null>(null);
  const animRef = useRef<number>(0);
  const prevHoverRef = useRef<string | null>(null);
  const prevSelectedRef = useRef<string | null>(null);
  const prevSearchRef = useRef<string>('');

  // 相机聚焦动画状?
  const focusState = useRef<{
    active: boolean;
    startTime: number;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
  } | null>(null);

  // 窗口自适应
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cameraRef.current || !rendererRef.current) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    cameraRef.current.aspect = w / h;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(w, h, false);
  }, []);

  /** 聚焦到指定机?*/
  const focusRack = useCallback((rackId: string | null) => {
    if (!rackId || !cameraRef.current || !controlsRef.current) return;
    const group = rackGroupsRef.current.get(rackId);
    if (!group) return;

    const pos = new THREE.Vector3();
    group.getWorldPosition(pos);

    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    focusState.current = {
      active: true,
      startTime: performance.now(),
      startPos: cam.position.clone(),
      endPos: new THREE.Vector3(pos.x + 8, pos.y + 4, pos.z + 8),
      startTarget: ctrl.target.clone(),
      endTarget: pos.clone(),
    };
  }, []);

  // ===== 初始?Three.js =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141e2d);
    scene.fog = new THREE.FogExp2(0x141e2d, 0.003);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    camera.position.set(25, 15, 25);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x141e2d, 1);
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 灯光
    scene.add(new THREE.AmbientLight(0x334466, 0.6));
    const dl = new THREE.DirectionalLight(0xffeedd, 1.5);
    dl.position.set(20, 30, 10); dl.castShadow = true; dl.shadow.mapSize.width = 2048; dl.shadow.mapSize.height = 2048;
    scene.add(dl);
    const fl = new THREE.DirectionalLight(0x4488ff, 0.4);
    fl.position.set(-20, 10, -20); scene.add(fl);
    scene.add(new THREE.HemisphereLight(0x88ccff, 0x445566, 0.6));

    // 地面
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat('floor'));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);
    const bf = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x6b7b76, roughness: 1 }));
    bf.rotation.x = -Math.PI / 2; bf.position.y = -0.01;
    scene.add(bf);

    window.addEventListener('resize', handleResize);

    // 点击 + 悬停检?
    const pointer = { x: 0, y: 0, downX: 0, downY: 0, down: false };

    const getHitTargets = () => {
      const targets: THREE.Object3D[] = [];
      rackGroupsRef.current.forEach(g => {
        g.children.forEach(c => { if (c.userData?.isRack) targets.push(c); });
      });
      return targets;
    };

    const getRackIdFromHit = (x: number, y: number): string | null => {
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(x, y), camera);
      const hits = rc.intersectObjects(getHitTargets());
      return hits.length > 0 ? hits[0].object.userData.rackId : null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointer.downX = e.clientX; pointer.downY = e.clientY; pointer.down = true;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointer.down) return;
      pointer.down = false;
      if (Math.abs(e.clientX - pointer.downX) > 6 || Math.abs(e.clientY - pointer.downY) > 6) return;
      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const py = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const rackId = getRackIdFromHit(px, py);
      if (rackId) onRackClick(rackId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const py = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const rackId = getRackIdFromHit(px, py);
      if (rackId !== prevHoverRef.current) {
        prevHoverRef.current = rackId;
        onHoverChange?.(rackId);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);

    // 渲染循环（含相机聚焦动画?
    const animate = (time: number) => {
      animRef.current = requestAnimationFrame(animate);

      // 相机聚焦动画
      const fs = focusState.current;
      if (fs?.active) {
        const elapsed = time - fs.startTime;
        const t = Math.min(elapsed / CAM_FOCUS_DURATION, 1);
        const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
        camera.position.lerpVectors(fs.startPos, fs.endPos, ease);
        controls.target.lerpVectors(fs.startTarget, fs.endTarget, ease);
        if (t >= 1) {
          focusState.current = null;
          // 保持 controls 不抖?
          controls.target.copy(fs.endTarget);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate(performance.now());

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      controls.dispose();
      renderer.dispose();
      scene.clear();
      Object.keys(sharedMats).forEach(k => (sharedMats as any)[k] = null);
      rackGroupsRef.current.clear();
      cableGroupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 机柜数据变化重建 =====
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    rackGroupsRef.current.forEach(g => { scene.remove(g); });
    rackGroupsRef.current.clear();

    if (racks.length === 0) return;

    const roomGroups = new Map<string, Rack3D[]>();
    for (const rack of racks) {
      const key = rack.roomName || 'default';
      if (!roomGroups.has(key)) roomGroups.set(key, []);
      roomGroups.get(key)!.push(rack);
    }

    let roomOffsetX = -(Math.max(roomGroups.size - 1, 0) * 9) / 2;

    for (const [, roomRacks] of roomGroups) {
      const byRow = new Map<number, Rack3D[]>();
      for (const r of roomRacks) byRow.set(r.row || 1, [...(byRow.get(r.row || 1) || []), r]);
      const rows = [...byRow.entries()].sort(([a], [b]) => a - b);
      const totalDepth = (rows.length - 1) * GAP_Z;

      rows.forEach(([, rowRacks], rowIdx) => {
        const rowZ = rowIdx * GAP_Z - totalDepth / 2;
        rowRacks.forEach((rack, rackIdx) => {
          const rackX = rackIdx * GAP_X - ((rowRacks.length - 1) * GAP_X) / 2 + roomOffsetX;
          const heatValue = heatmapData ? (heatmapData[rack.id] || 0) : 0;
          const group = buildRackMesh(rack, heatValue);
          group.position.set(rackX, 0, rowZ);
          scene.add(group);
          rackGroupsRef.current.set(rack.id, group);
        });
      });
      roomOffsetX += 9;
    }
  }, [racks]);

  // ===== 线缆拓扑渲染 =====
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 移除旧线缆
    if (cableGroupRef.current) {
      scene.remove(cableGroupRef.current);
      cableGroupRef.current = null;
    }

    // 渲染新线缆
    if (cables.length > 0) {
      const cableGroup = buildCableMesh(cables);
      scene.add(cableGroup);
      cableGroupRef.current = cableGroup;
    }
  }, [cables]);

  // ===== 高亮状态同?=====
  useEffect(() => {
    const prev = prevSelectedRef.current;
    if (prev && prev !== selectedRackId) {
      const g = rackGroupsRef.current.get(prev);
      if (g) setRackHighlight(g, 'none');
    }
    if (selectedRackId) {
      const g = rackGroupsRef.current.get(selectedRackId);
      if (g) setRackHighlight(g, 'selected');
    }
    prevSelectedRef.current = selectedRackId ?? null;
  }, [selectedRackId]);

  useEffect(() => {
    const prev = prevHoverRef.current;
    if (prev && prev !== hoveredRackId && prev !== selectedRackId) {
      const g = rackGroupsRef.current.get(prev);
      if (g) setRackHighlight(g, 'none');
    }
    if (hoveredRackId && hoveredRackId !== selectedRackId) {
      const g = rackGroupsRef.current.get(hoveredRackId);
      if (g) setRackHighlight(g, 'hover');
    }
  }, [hoveredRackId, selectedRackId]);

  // ===== 搜索高亮 =====
  useEffect(() => {
    const q = (searchQuery || '').toLowerCase().trim();
    const prev = prevSearchRef.current;

    // 清除旧搜索高?
    if (prev) {
      rackGroupsRef.current.forEach((g, id) => {
        if (id !== selectedRackId && id !== hoveredRackId) {
          setRackHighlight(g, 'none');
        }
      });
    }

    if (q) {
      rackGroupsRef.current.forEach((g, id) => {
        const rack = racks.find(r => r.id === id);
        const match = rack && rack.name.toLowerCase().includes(q);
        if (match && id !== selectedRackId && id !== hoveredRackId) {
          setRackHighlight(g, 'search');
        }
      });
    }

    prevSearchRef.current = q;
  }, [searchQuery, racks, selectedRackId, hoveredRackId]);

  // ===== 选中时触发相机聚?=====
  useEffect(() => {
    if (selectedRackId) focusRack(selectedRackId);
  }, [selectedRackId, focusRack]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
    />
  );
}

