/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import api from '../lib/api';

/* ========== 类型 ========== */
interface Rack3D {
  id: string; name: string; roomName: string; roomLabel: string;
  row: number; totalU: number; usedU: number;
  deviceCount: number; alertCount: number; deviceStatus: string;
}
interface SlotInfo {
  id: string; startU: number; endU: number;
  deviceName: string; deviceType: string;
  deviceStatus: string | null;
  cpuUsage: number | null; memUsage: number | null; diskUsage: number | null;
}

const RACK_W = 2.3, RACK_D = 2.2, PER_U = 0.04445, GAP_X = 2.2, GAP_Z = 4.0;

export default function DataRoom3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rackMeshesRef = useRef<Map<string,{mesh:THREE.Mesh;door:THREE.Mesh;group:THREE.Group;data:Rack3D}>>(new Map());
  const animRef = useRef<number>(0);
  const raycaster = useRef(new THREE.Raycaster());

  const [racks, setRacks] = useState<Rack3D[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isReal, setIsReal] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [selectedRack, setSelectedRack] = useState<Rack3D | null>(null);
  const [rackSlots, setRackSlots] = useState<SlotInfo[]>([]);
  const [rackSlotsMap, setRackSlotsMap] = useState<Record<string, SlotInfo[]>>({});
  const [slotDetailOpen, setSlotDetailOpen] = useState(false);
  const navigate = useNavigate();

  // ===== 时间 =====
  const [timeStr, setTimeStr] = useState('');
  const [uptime, setUptime] = useState('已运行: 0天0小时0分');
  const startTime = useRef(Date.now());
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const wd = ['日','一','二','三','四','五','六'][now.getDay()];
      setTimeStr(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} 星期${wd} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`);
      const s = Math.floor((Date.now()-startTime.current)/1000);
      const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=s%60;
      setUptime(`已运行: ${d}天${h}小时${m}分`);
    };
    tick(); const iv = setInterval(tick,1000); return ()=>clearInterval(iv);
  }, []);

  // ===== 加载数据 =====
  useEffect(() => {
    const load = async () => {
      try {
        const [ovRes, rackRes, slotsRes] = await Promise.all([
          api.get('/api/dc/overview'),
          api.get('/api/dc/racks'),
          api.get('/api/dc/batch-slots').catch(() => ({ data: { data: [] } })),
        ]);
        const ov = ovRes.data.data;
        setOverview(ov);
        setIsReal(true);

        // 按机柜分组
        const slotsByRack: Record<string, SlotInfo[]> = {};
        for (const s of (slotsRes.data.data || [])) {
          if (!slotsByRack[s.rack_id]) slotsByRack[s.rack_id] = [];
          slotsByRack[s.rack_id].push({
            id: s.slot_id, startU: s.start_u, endU: s.end_u,
            deviceName: s.device_name || s.device_id, deviceType: s.device_type,
            deviceStatus: s.device_status || 'unknown',
            cpuUsage: null, memUsage: null, diskUsage: null,
          });
        }
        setRackSlotsMap(slotsByRack);

        const rawRacks = rackRes.data.data || [];
        if (rawRacks.length > 0) {
          const rd: Rack3D[] = rawRacks.map((r: any) => ({
            id: r.id, name: r.name, roomName: '', roomLabel: '',
            row: r.row_number || 1, totalU: r.total_u || 42, usedU: r.used_u || 0,
            deviceCount: r.device_count || 0, alertCount: 0,
            deviceStatus: 'normal',
          }));
          setRacks(rd);
        } else if (ov.rackData) {
          setRacks(ov.rackData.map((r: any,i:number) => ({
            id: r.id||`mock-${i}`, name: r.name, roomName: r.room_name||'', roomLabel: r.room_label||'',
            row: r.row_number||1, totalU: r.total_u||42, usedU: r.used_u||0,
            deviceCount: r.device_count||0, alertCount: r.alert_count||0,
            deviceStatus: (r.alert_count||0)>0?'warning':'normal',
          })));
        } else {
          setRacks([]);
        }
      } catch {
        setRacks([]);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  // ===== 加载U位 =====
  // ===== Three.js 场景 =====
  useEffect(() => {
    if (!canvasRef.current || loading) return;
    const canvas = canvasRef.current;
    const w = canvas.clientWidth, h = canvas.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141e2d);
    scene.fog = new THREE.FogExp2(0x141e2d, 0.003);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 200);
    camera.position.set(25, 15, 25);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x141e2d, 1);
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI/2.1;
    controls.minDistance = 8; controls.maxDistance = 60;
    controls.target.set(0, 3, 0);
    controlsRef.current = controls;

    // ===== 灯光系统（对齐监控大屏） =====
    scene.add(new THREE.AmbientLight(0x8899aa, 0.9));
    const mainLight = new THREE.DirectionalLight(0xddeeff, 1.4);
    mainLight.position.set(20,40,20); mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048; mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.left = -50; mainLight.shadow.camera.right = 50;
    mainLight.shadow.camera.top = 50; mainLight.shadow.camera.bottom = -50;
    mainLight.shadow.camera.near = 1; mainLight.shadow.camera.far = 100;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);
    const dl1 = new THREE.DirectionalLight(0x6688aa, 0.5); dl1.position.set(-25,20,0); scene.add(dl1);
    const dl2 = new THREE.DirectionalLight(0x7799bb, 0.4); dl2.position.set(25,20,0); scene.add(dl2);
    const dl3 = new THREE.DirectionalLight(0xffffff, 0.6); dl3.position.set(0,50,0); scene.add(dl3);
    const dl4 = new THREE.DirectionalLight(0x445566, 0.3); dl4.position.set(0,15,-30); scene.add(dl4);
    const dl5 = new THREE.DirectionalLight(0x556677, 0.25); dl5.position.set(0,10,30); scene.add(dl5);

    // 彩色氛围光
    const addPoint = (color:number,intensity:number,distance:number,x:number,y:number,z:number) => {
      const pl = new THREE.PointLight(color, intensity, distance);
      pl.position.set(x,y,z); scene.add(pl);
    };
    addPoint(0x00d4ff, 1.5, 60, -12, 10, 0);
    addPoint(0x00d4ff, 1.5, 60, 12, 10, 0);
    addPoint(0x4488ff, 1.0, 50, 0, 12, 0);
    addPoint(0x00ff88, 0.5, 40, 0, 8, -20);
    addPoint(0x6644ff, 0.4, 50, 0, 15, -15);
    addPoint(0xff8844, 0.4, 40, 0, 6, 15);
    addPoint(0x00d4ff, 0.8, 30, 0, 6, -15);
    addPoint(0x00d4ff, 0.8, 30, 0, 6, 15);
    scene.add(new THREE.HemisphereLight(0x667788, 0x1a2535, 0.6));

    // ===== 防静电架空地板 =====
    const tileCount = 40;
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = 256; tileCanvas.height = 256;
    const tctx = tileCanvas.getContext('2d')!;
    tctx.fillStyle = '#4a5a6a';
    tctx.fillRect(0, 0, 256, 256);
    for (let tx = 0; tx < 256; tx += 2) {
      for (let ty = 0; ty < 256; ty += 2) {
        const noise = Math.random() * 6 - 3;
        tctx.fillStyle = `rgb(${Math.max(0,Math.min(255,74+noise))},${Math.max(0,Math.min(255,90+noise))},${Math.max(0,Math.min(255,106+noise))})`;
        tctx.fillRect(tx, ty, 2, 2);
      }
    }
    tctx.strokeStyle = '#3a4a5a'; tctx.lineWidth = 2;
    tctx.strokeRect(1, 1, 254, 254);
    tctx.strokeStyle = 'rgba(100,140,170,0.5)'; tctx.lineWidth = 1;
    [64,128,192].forEach(pos => {
      tctx.beginPath(); tctx.moveTo(pos,4); tctx.lineTo(pos,252); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(4,pos); tctx.lineTo(252,pos); tctx.stroke();
    });
    const tileTex = new THREE.CanvasTexture(tileCanvas);
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(tileCount, tileCount);
    tileTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const floorMat = new THREE.MeshPhysicalMaterial({
      map: tileTex, color: 0x9eada8,
      metalness: 0.05, roughness: 0.6,
      clearcoat: 0.1, clearcoatRoughness: 0.8,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    // 底部浅色基底
    const baseFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ color: 0x6b7b76, roughness: 1 })
    );
    baseFloor.rotation.x = -Math.PI / 2;
    baseFloor.position.y = -0.01;
    scene.add(baseFloor);

    // 渲染循环
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 点击检测（替换 React onClick，避免 OrbitControls 拦截）
    const pointerPos = { x: 0, y: 0, downX: 0, downY: 0, down: false };
    const onPointerDown = (e: PointerEvent) => {
      pointerPos.downX = e.clientX;
      pointerPos.downY = e.clientY;
      pointerPos.down = true;
    };
    const onPointerUp = async (e: PointerEvent) => {
      if (!pointerPos.down) return;
      pointerPos.down = false;
      const dx = e.clientX - pointerPos.downX;
      const dy = e.clientY - pointerPos.downY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) return; // 拖拽跳过

      const rect = canvas.getBoundingClientRect();
      pointerPos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerPos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(new THREE.Vector2(pointerPos.x, pointerPos.y), camera);

      const targets: THREE.Object3D[] = [];
      rackMeshesRef.current.forEach(obj => targets.push(obj.mesh));
      const intersects = raycaster.current.intersectObjects(targets);
      if (intersects.length > 0) {
        const rackId = intersects[0].object.userData.rackId;
        if (rackId) {
          const rackObj = rackMeshesRef.current.get(rackId);
          if (rackObj) {
            setSelectedRack(rackObj.data);
            const res = await api.get(`/api/dc/slots/${rackId}`).catch(() => null);
            if (res?.data?.data) {
              setRackSlots(res.data.data.map((s: any) => ({
                id: s.slot_id || s.id,
                startU: s.start_u,
                endU: s.end_u,
                deviceName: s.device_name || s.device_id,
                deviceType: s.device_type,
                deviceStatus: s.device_status || s.server_status || 'unknown',
                cpuUsage: s.cpu_usage ?? null,
                memUsage: s.memory_usage ?? null,
                diskUsage: s.disk_usage ?? null,
              })));
            } else {
              setRackSlots([]);
            }
            setSlotDetailOpen(true);
          }
        }
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      camera.aspect = cw/ch; camera.updateProjectionMatrix();
      renderer.setSize(cw,ch,false);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      scene.clear();
    };
  }, [loading]);

  // ===== 材质/几何体缓存 =====
  const matsRef = useRef<Record<string, THREE.Material>>({});
  const geosRef = useRef<Record<string, THREE.BufferGeometry>>({});

  const ensureMat = useCallback((name: string, create: () => THREE.Material) => {
    if (!matsRef.current[name]) matsRef.current[name] = create();
    return matsRef.current[name];
  }, []);
  const ensureGeo = useCallback((name: string, create: () => THREE.BufferGeometry) => {
    if (!geosRef.current[name]) geosRef.current[name] = create();
    return geosRef.current[name];
  }, []);

  const createPerfTexture = useCallback((warn: boolean) => {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = warn ? '#1a1510' : '#101520';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#080c10';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillRect(x * 4 + 1, y * 4 + 1, 2, 2);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 10);
    return tex;
  }, []);

  const createLabelTexture = useCallback((text: string, warn: boolean) => {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.0)';
    ctx.fillRect(0, 0, 256, 64);
    // 边框
    ctx.strokeStyle = warn ? '#ff6644' : '#00d4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, 248, 56);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(6, 6, 244, 52);
    ctx.fillStyle = warn ? '#ff6644' : '#00d4ff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    return new THREE.CanvasTexture(cv);
  }, []);

  // 临时保留门动画引用（用于鼠标交互后续扩展）
  const animatedDoorsRef = useRef<THREE.Object3D[]>([]);
  const animatedLightsRef = useRef<{ obj: THREE.Object3D; origScale: number; phase: number; speed: number }[]>([]);

  // ===== 渲染机柜（匹配监控大屏精细度） =====
  useEffect(() => {
    if (!sceneRef.current || racks.length === 0) return;
    const scene = sceneRef.current;
    rackMeshesRef.current.forEach(obj => scene.remove(obj.group));
    rackMeshesRef.current.clear();
    animatedDoorsRef.current = [];
    animatedLightsRef.current = [];

    // 分组
    const roomGroups: Record<string,Rack3D[]> = {};
    for (const r of racks) {
      const k = r.roomName || r.roomLabel || 'default';
      if (!roomGroups[k]) roomGroups[k] = [];
      roomGroups[k].push(r);
    }

    let roomOffsetX = -(Object.keys(roomGroups).length * 8) / 2 + 4;

    for (const [, roomRacks] of Object.entries(roomGroups)) {
      const rows: Record<number,Rack3D[]> = {};
      for (const r of roomRacks) {
        const row = r.row || 1;
        if (!rows[row]) rows[row] = [];
        rows[row].push(r);
      }
      const sortedRows = Object.entries(rows).sort(([a],[b]) => Number(a)-Number(b));
      let rowIdx = 0;

      for (const [, rowRacks] of sortedRows) {
        const zOffset = -(sortedRows.length-1)*(RACK_D+GAP_Z)/2 + rowIdx*(RACK_D+GAP_Z);
        const rackWidth = rowRacks.length*(RACK_W+GAP_X);
        const startX = -(rackWidth-GAP_X)/2;

        rowRacks.forEach((rackData, i) => {
          const x = roomOffsetX + startX + i*(RACK_W+GAP_X) + RACK_W/2;
          const warn = rackData.alertCount > 0;

          // ===== makeRack（精细版-匹配监控大屏） =====
          const group = new THREE.Group();
          group.position.set(x, 0, zOffset);
          group.userData = { rackId: rackData.id, data: rackData };

          const rackH = rackData.totalU * PER_U;
          const halfH = rackH / 2;

          // 材质
          const bodyMat = ensureMat('rackBody' + (warn ? 'W' : 'N'), () => new THREE.MeshPhysicalMaterial({
            color: warn ? 0x3a2a18 : 0x1e2836, metalness: 0.85, roughness: 0.2,
            clearcoat: 0.3, clearcoatRoughness: 0.15,
          }));
          const topMat = ensureMat('rackTop', () => new THREE.MeshPhysicalMaterial({
            color: 0x2a3a4a, metalness: 0.9, roughness: 0.15,
            clearcoat: 0.5, clearcoatRoughness: 0.1,
          }));

          const frameMat = ensureMat('frameMetal', () => new THREE.MeshPhysicalMaterial({
            color: 0x3a5060, metalness: 0.95, roughness: 0.08,
            clearcoat: 0.8, clearcoatRoughness: 0.05,
          }));
          const glassMat = ensureMat('glassDoor', () => new THREE.MeshPhysicalMaterial({
            color: 0x00d4ff, metalness: 0.0, roughness: 0.05,
            transparent: true, opacity: 0.04,
            clearcoat: 1.0, clearcoatRoughness: 0.05,
            // @ts-ignore
            reflectivity: 0.9,
          }));
          const perfMat = ensureMat('perfFront' + (warn ? 'W' : 'N'), () => new THREE.MeshPhysicalMaterial({
            map: createPerfTexture(warn),
            color: warn ? 0x2a2015 : 0x1a2535,
            metalness: 0.7, roughness: 0.3, transparent: true, opacity: 0.3,
            side: THREE.DoubleSide,
          }));

          // LED 和光晕材质
          const ledG = ensureMat('ledG', () => new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
          const ledO = ensureMat('ledO', () => new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
          const ledR = ensureMat('ledR', () => new THREE.MeshBasicMaterial({ color: 0xff4444 }));
          const glowG = ensureMat('glowG', () => new THREE.MeshBasicMaterial({
            color: 0x00ff88, transparent: true, opacity: 0.3,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }));
          const glowR = ensureMat('glowR', () => new THREE.MeshBasicMaterial({
            color: 0xff4444, transparent: true, opacity: 0.3,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }));
          const sideGlow = ensureMat('sideGlow' + (warn ? 'O' : 'C'), () => new THREE.MeshBasicMaterial({
            color: warn ? 0xff6644 : 0x00d4ff, transparent: true, opacity: 0.15,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }));

          // 几何体缓存
          const ledGeo = ensureGeo('ledSphere', () => new THREE.SphereGeometry(0.018, 4, 4));
          const glowGeo = ensureGeo('glowSphere', () => new THREE.SphereGeometry(0.03, 4, 4));
          const holeGeo = ensureGeo('holePlane', () => new THREE.PlaneGeometry(0.012, 0.012));
          const portLedGeo = ensureGeo('portLed', () => new THREE.SphereGeometry(0.005, 4, 4));

          // === 后面板 ===
          const backP = new THREE.Mesh(new THREE.BoxGeometry(2.2, rackH, 0.08), bodyMat);
          backP.position.set(0, halfH, -1.05);
          backP.castShadow = true; backP.receiveShadow = true;
          group.add(backP);

          // === 左右侧板 ===
          const lSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, rackH, 2.1), bodyMat);
          lSide.position.set(-1.05, halfH, 0);
          lSide.castShadow = true; lSide.receiveShadow = true;
          group.add(lSide);
          const rSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, rackH, 2.1), bodyMat);
          rSide.position.set(1.05, halfH, 0);
          rSide.castShadow = true; rSide.receiveShadow = true;
          group.add(rSide);

          // === 顶板底板 ===
          const topP = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 2.2), topMat);
          topP.position.y = rackH + 0.04;
          topP.castShadow = true;
          group.add(topP);
          const botP = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 2.2), bodyMat);
          botP.position.y = 0.03;
          botP.castShadow = true;
          group.add(botP);

          // === 前面穿孔板 ===
          const perfF = new THREE.Mesh(new THREE.PlaneGeometry(2.0, rackH - 0.3), perfMat);
          perfF.position.set(0, halfH, 0.95);
          group.add(perfF);

          // === 玻璃门 ===
          const doorGroup = new THREE.Group();
          doorGroup.position.set(-1.05, 0, 1.12);
          doorGroup.userData.isRackDoor = true;
          const glassD = new THREE.Mesh(new THREE.BoxGeometry(2.1, rackH - 0.1, 0.03), glassMat);
          glassD.position.set(1.05, halfH, 0);
          glassD.castShadow = true;
          doorGroup.add(glassD);
          const ft = 0.05;
          const addFrame = (sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
            const f = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), frameMat);
            f.position.set(px, py, pz); doorGroup.add(f);
          };
          addFrame(ft, rackH - 0.1, ft, 0, halfH, 0);
          addFrame(ft, rackH - 0.1, ft, 2.16, halfH, 0);
          addFrame(2.22, ft, ft, 1.08, rackH + 0.02, 0);
          addFrame(2.22, ft, ft, 1.08, 0.03, 0);
          const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.08), frameMat);
          handle.position.set(2.08, halfH, 0.04);
          doorGroup.add(handle);
          animatedDoorsRef.current.push(doorGroup);
          group.add(doorGroup);

          // === 底座 ===
          const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 2.3), topMat);
          base.position.y = 0.03;
          base.castShadow = true;
          group.add(base);
          const footGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.1, 8);
          [[-0.9, -0.85], [0.9, -0.85], [-0.9, 0.85], [0.9, 0.85]].forEach(fp => {
            const foot = new THREE.Mesh(footGeo, topMat);
            foot.position.set(fp[0], 0.05, fp[1]);
            group.add(foot);
          });

          // === 根据实际U位数据渲染设备 ===
          const slotList = rackSlotsMap[rackData.id] || [];
          const ruH = rackH / rackData.totalU;
          // 按U位填充（从底部U1开始）
          for (let u = 1; u <= rackData.totalU; u++) {
            const slot = slotList.find(s => u >= s.startU && u <= s.endU);
            if (u === slot?.startU) {
              // 有设备渲染
              const hU = slot.endU - slot.startU + 1;
              const y = (slot.startU - 1) * ruH;
              const panelY = y + hU * ruH / 2;
              const isNet = slot.deviceType === 'network_device';
              const deviceMat = ensureMat('dev_' + (isNet ? 'net' : 'svr'), () => new THREE.MeshPhysicalMaterial({
                color: isNet ? 0x2a1a3a : 0x1a2a3a, metalness: 0.8, roughness: 0.2,
                clearcoat: 0.3, clearcoatRoughness: 0.15,
              }));
              const dev = new THREE.Mesh(new THREE.BoxGeometry(1.85, hU * ruH - 0.02, 1.7), deviceMat);
              dev.position.set(0, panelY, 0);
              dev.castShadow = true;
              group.add(dev);

              // 前面板装饰
              const stripMat2 = ensureMat('strip_' + (isNet ? 'net' : 'svr'), () => new THREE.MeshPhysicalMaterial({
                color: isNet ? 0x3a2a4a : 0x2a3a4a, metalness: 0.6, roughness: 0.2,
              }));
              const strip = new THREE.Mesh(new THREE.BoxGeometry(1.8, hU * ruH - 0.04, 0.02), stripMat2);
              strip.position.set(0, panelY, 0.99);
              group.add(strip);

              // 状态LED
              const ledM = slot.deviceStatus === 'online' || slot.deviceStatus === 'normal' ? ledG :
                slot.deviceStatus === 'warning' ? ledO : ledR;
              const glowM = slot.deviceStatus === 'online' || slot.deviceStatus === 'normal' ? glowG : glowR;
              const led = new THREE.Mesh(ledGeo, ledM);
              led.position.set(-0.82, panelY + 0.03, 1.01);
              group.add(led);
              const glow = new THREE.Mesh(glowGeo, glowM);
              glow.position.copy(led.position);
              group.add(glow);

              // 设备名称 label
              const devLabelTex = createLabelTexture(slot.deviceName.substring(0, 12), warn);
              const devLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.15),
                new THREE.MeshBasicMaterial({ map: devLabelTex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
              );
              devLabel.position.set(0, panelY, 1.01);
              group.add(devLabel);
            } else if (!slot) {
              // 空U位 - 打孔板
              const emptyMat = ensureMat('emptyU', () => new THREE.MeshPhysicalMaterial({
                color: 0x111822, metalness: 0.3, roughness: 0.6,
                transparent: true, opacity: 0.4,
              }));
              const emptyP = new THREE.Mesh(new THREE.BoxGeometry(1.85, ruH - 0.01, 1.7), emptyMat);
              emptyP.position.set(0, (u - 0.5) * ruH, 0);
              group.add(emptyP);
              // 前面板装饰小点
              const dotMat = ensureMat('dot', () => new THREE.MeshBasicMaterial({ color: 0x0a0e14 }));
              const dotGeo = ensureGeo('dotPlane', () => new THREE.PlaneGeometry(0.06, 0.06));
              for (let d = 0; d < 3; d++) {
                const dot = new THREE.Mesh(dotGeo, dotMat);
                dot.position.set(-0.6 + d * 0.6, (u - 0.5) * ruH, 1.0);
                group.add(dot);
              }
            }
          }

          // === 机柜编号标签 ===
          const labelTex = createLabelTexture(rackData.name, warn);
          const label = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4),
            new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
          );
          label.position.set(0, rackH + 0.3, 1.15);
          group.add(label);

          // === 顶部状态灯（带光晕和点光源） ===
          const sLed = new THREE.Mesh(ledGeo, warn ? ledR : ledG);
          sLed.position.set(0, rackH + 0.08, 1.12);
          sLed.scale.setScalar(4);
          group.add(sLed);
          const sGlow = new THREE.Mesh(glowGeo, warn ? glowR : glowG);
          sGlow.position.set(0, rackH + 0.08, 1.12);
          sGlow.scale.setScalar(4);
          group.add(sGlow);
          const sLight = new THREE.PointLight(warn ? 0xff4444 : 0x00ff88, 0.4, 3);
          sLight.position.set(0, rackH + 0.08, 1.18);
          group.add(sLight);

          // === 侧面发光条 ===
          const leftGlow = new THREE.Mesh(new THREE.BoxGeometry(0.01, rackH - 0.5, 0.01), sideGlow);
          leftGlow.position.set(-1.09, halfH, 1.1);
          group.add(leftGlow);
          const rightGlow = new THREE.Mesh(new THREE.BoxGeometry(0.01, rackH - 0.5, 0.01), sideGlow);
          rightGlow.position.set(1.09, halfH, 1.1);
          group.add(rightGlow);

          // === 不可见 hitbox（用于点击检测） ===
          const hit = new THREE.Mesh(
            new THREE.BoxGeometry(RACK_W * 2.5, rackH, RACK_D * 2.5),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide })
          );
          hit.position.y = halfH;
          hit.userData.isRack = true;
          hit.userData.rackId = rackData.id;
          group.add(hit);

          scene.add(group);
          rackMeshesRef.current.set(rackData.id, { mesh: hit, door: glassD, group, data: rackData });
        });
        rowIdx++;
      }
      roomOffsetX += 9;
    }
  }, [racks, rackSlotsMap, ensureMat, ensureGeo, createPerfTexture, createLabelTexture]);

  // ===== 渲染仪表盘 UI =====
  if (loading) {return (
    <div className="flex items-center justify-center h-full bg-[#0d1825]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-cyan-400 text-sm tracking-widest animate-pulse">构建数字孪生场景...</p>
      </div>
    </div>
  );}

  const summary = overview?.summary || { totalDevices: 0, onlineDevices: 0, alertDevices: 0, offlineDevices: 0, avgTemp: 0, avgHumidity: 0, totalRacks: 0 };

  return (
    <div className="relative w-full h-full bg-[#0d1825] overflow-hidden">
      {/* 网格背景叠加 - 对齐监控大屏效果 */}
      <div className="absolute inset-0 z-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,245,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.015) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
      }} />
      {/* 径向渐变背景光 */}
      <div className="absolute inset-0 z-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 20% 50%, rgba(0,80,150,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 30%, rgba(123,97,255,0.05) 0%, transparent 60%)',
      }} />
      {/* 3D Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Dashboard Overlay — 匹配 Demo 站的布局 */}

      {/* 数据模式标识 */}
      <div className="absolute top-2 left-2 z-20">
        <span className={`text-[10px] px-2 py-0.5 rounded ${isReal ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'}`}>
          {isReal ? '📡 实时数据' : '📦 无数据'}
        </span>
      </div>

      {/* 空数据覆盖层 */}
      {!isReal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="text-center bg-[#0a0e1a]/80 backdrop-blur border border-cyan-500/20 rounded-2xl px-8 py-6">
            <div className="text-4xl mb-3">🏢</div>
            <h3 className="text-lg font-bold text-white mb-2">暂无数据中心资产</h3>
            <p className="text-sm text-text-secondary mb-4">请先在数据中心管理中添加机房和机柜</p>
            <a href="/dc-manage" className="inline-block px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white text-sm pointer-events-auto hover:opacity-90 transition-opacity">
              前往数据中心管理
            </a>
          </div>
        </div>
      )}

      {/* 右上角状态 */}
      <div className="absolute top-2 right-[120px] z-20 flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-[#0a0e1a]/80 backdrop-blur border border-cyan-500/15 rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-green-400">系统正常</span>
        </div>
      </div>

      {/* 顶部标题 */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
        <h1 className="text-base font-bold tracking-[5px] bg-gradient-to-r from-cyan-400 via-white to-green-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(0,150,255,0.3)] animate-gradient">
          ◆ 机房数字孪生监控平台 ◆
        </h1>
      </div>

      {/* 时间 */}
      <div className="absolute top-10 left-2 z-20 text-[10px] text-text-tertiary font-mono">
        {timeStr} · ☀ 25°C 晴朗
      </div>

      {/* 底部紧凑指标条 - 固定浮层 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-[1200px]">
        <div className="bg-[#0a1420]/85 backdrop-blur-md border border-cyan-500/15 rounded-xl px-4 py-2.5 shadow-lg shadow-cyan-500/5">
          <div className="grid grid-cols-10 gap-2">
            {[
              { icon:'⚡', label:'PUE', value: (overview?.pue || 0).toFixed(2), color:'text-cyan-400' },
              { icon:'🔌', label:'总功', value: `${(overview?.totalPower || 0).toFixed(1)}kW`, color:'text-gray-300' },
              { icon:'❄', label:'制冷', value: `${(overview?.coolingPower || 0).toFixed(1)}kW`, color:'text-cyan-400' },
              { icon:'💻', label:'IT', value: `${(overview?.itPower || 0).toFixed(1)}kW`, color:'text-gray-300' },
              { icon:'🌡', label:'温度', value: `${(summary.avgTemp||24.5).toFixed(1)}°C`, color:'text-green-400' },
              { icon:'💧', label:'湿度', value: `${summary.avgHumidity||45}%`, color:'text-cyan-400' },
              { icon:'🖥', label:'设备', value: (summary.totalDevices||0).toLocaleString(), color:'text-gray-300' },
              { icon:'✅', label:'在线', value: (summary.onlineDevices||0).toLocaleString(), color:'text-green-400' },
              { icon:'⚠', label:'告警', value: summary.alertDevices||0, color:'text-orange-400' },
              { icon:'❌', label:'离线', value: summary.offlineDevices||0, color:'text-red-400' },
            ].map((m,i) => (
              <div key={i} className="text-center group hover:bg-white/5 rounded-lg py-1 transition-colors">
                <div className="text-[11px] leading-tight mb-0.5">{m.icon}</div>
                <div className={`text-xs font-bold font-mono ${m.color || 'text-gray-300'}`}>{m.value}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 操作提示 */}
      <div className="absolute bottom-[88px] left-4 z-20 bg-[#0a1420]/80 backdrop-blur border border-gray-700/50 rounded-md px-2.5 py-1 text-[10px] text-slate-400">
        🖱 旋转/缩放/平移 | 👆 点击机柜
      </div>

      {/* 实时告警条 - 右侧悬浮 */}
      <div className="absolute top-16 right-4 z-20 w-[280px] bg-[#0a1420]/90 backdrop-blur-md border border-red-500/15 rounded-xl overflow-hidden shadow-lg shadow-red-500/5">
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border-b border-red-500/10">
          <span className="text-xs">🔔</span>
          <span className="text-xs font-semibold text-red-400">实时告警</span>
          <span className="ml-auto text-[10px] bg-red-500/20 text-red-400 px-1.5 rounded-full font-mono">{alertsList.length}</span>
        </div>
        <div className="h-6 overflow-hidden px-3 py-1">
          <div className="animate-scroll-up flex gap-4 items-center h-full">
            {alertsList.length > 0 ? alertsList.map((a,i) => (
              <span key={i} className="text-[11px] whitespace-nowrap">
                <span className="text-slate-500">{a.time}</span>
                <span className="text-slate-600 mx-1">|</span>
                <span className={a.type==='error'?'text-red-400':a.type==='warn'?'text-orange-400':'text-cyan-400'}>{a.msg}</span>
              </span>
            )) : (
              <span className="text-[11px] text-slate-500 whitespace-nowrap">暂无告警信息</span>
            )}
          </div>
        </div>
      </div>

      {/* 机柜详情弹窗 */}
      {slotDetailOpen && selectedRack && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-[580px] max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div>
                <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${selectedRack.alertCount>0?'bg-red-500':'bg-green-500'}`} />
                  {selectedRack.name}
                </h3>
                <p className="text-[10px] text-text-tertiary mt-0.5">{selectedRack.roomName || selectedRack.roomLabel}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>已用 {selectedRack.usedU}/{selectedRack.totalU}U</span>
                {selectedRack.alertCount>0 && <span className="text-red-400">⚠ {selectedRack.alertCount}条告警</span>}
                <button onClick={()=>setSlotDetailOpen(false)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-800 text-gray-400">&times;</button>
              </div>
            </div>
            <div className="overflow-y-auto" style={{maxHeight:'calc(80vh - 110px)'}}>
              {rackSlots.length===0 ? (
                <div className="p-8 text-center text-gray-500 text-xs">该机柜暂无设备分配</div>
              ) : (
                <div className="p-3 space-y-0.5">
                  {(() => {
                    const items: React.ReactNode[] = [];
                    for (let u=selectedRack.totalU; u>=1; u--) {
                      const slot = rackSlots.find(s=>u>=s.startU && u<=s.endU);
                      if (u === slot?.endU) {
                        const h = slot.endU - slot.startU + 1;
                        items.push(
                          <div key={u} className="flex items-center px-2 py-0.5 rounded text-xs hover:bg-gray-800/60 border border-transparent hover:border-gray-700/50 cursor-pointer"
                            style={{height:`${Math.max(h*28,28)}px`}}
                            onClick={() => navigate(`/dc-manage?tab=slots&rack=${selectedRack.id}&startU=${slot.startU}&endU=${slot.endU}&deviceName=${encodeURIComponent(slot.deviceName)}`)}>
                            <span className="w-10 text-[10px] text-text-tertiary font-mono shrink-0">U{slot.startU}</span>
                            <span className={`px-1 text-[10px] ${slot.deviceType==='server'?'text-blue-400':'text-purple-400'}`}>
                              {slot.deviceType==='server'?'🖥':'🌐'}
                            </span>
                            <span className="text-[11px] text-gray-200 ml-1 truncate">{slot.deviceName}</span>
                            <span className={`ml-auto text-[10px] px-1 py-0.5 rounded ${
                              slot.deviceStatus==='online'||slot.deviceStatus==='normal'?'bg-green-500/20 text-green-400':
                              slot.deviceStatus==='warning'?'bg-yellow-500/20 text-yellow-400':
                              'bg-gray-500/20 text-text-secondary'
                            }`}>{slot.deviceStatus||'未知'}</span>
                          </div>
                        );
                      }
                    }
                    return items;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS 滚动动画 */}
      <style>{`
        @keyframes scrollUp {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-scroll-up {
          animation: scrollUp 30s linear infinite;
        }
        .animate-scroll-up:hover { animation-play-state: paused; }
        @keyframes grad {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 200% center; }
        }
        .animate-gradient {
          background-size: 200% auto;
          animation: grad 4s ease infinite;
        }
        @keyframes dot-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.6); }
          50% { box-shadow: 0 0 0 6px rgba(0, 255, 136, 0); }
        }
      `}</style>
    </div>
  );
}
