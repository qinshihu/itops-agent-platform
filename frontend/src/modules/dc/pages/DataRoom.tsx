import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { LayoutGrid, AlertTriangle, RefreshCw } from 'lucide-react';
import DataRoom3D from '../../../modules/dc/components/DataRoom3D';

/** 检测浏览器是否支持 WebGL */
function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

export default function DataRoom() {
  const navigate = useNavigate();
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(checkWebGLSupport());
  }, []);

  // 检测中 → 显示加载
  if (webglOk === null) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0d1825]">
        <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  // 不支持 WebGL → 降级显示
  if (!webglOk) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0d1825] gap-4">
        <AlertTriangle className="w-12 h-12 text-yellow-400" />
        <p className="text-gray-300 text-sm">您的浏览器不支持 WebGL，无法显示 3D 机房场景。</p>
        <p className="text-gray-500 text-xs">请使用 Chrome/Firefox/Edge 最新版本。</p>
        <Button
          type="primary"
          icon={<LayoutGrid size={12} />}
          size="small"
          onClick={() => navigate('/dc-manage')}
        >
          进入数据中心管理
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <DataRoom3D />

      {/* 右上角管理入口 */}
      <div className="absolute top-3 right-3 z-20">
        <Button
          type="primary"
          size="small"
          icon={<LayoutGrid size={12} />}
          className="flex items-center shadow-lg bg-gradient-to-r from-cyan-500 to-blue-600 border-0 hover:opacity-90 text-xs h-7"
          onClick={() => navigate('/dc-manage')}
        >
          数据中心管理
        </Button>
      </div>
    </div>
  );
}
