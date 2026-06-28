import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-950 flex items-center justify-center p-6">
      <div className="text-center max-w-lg">
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-red-500/20 to-yellow-500/20 flex items-center justify-center border border-red-500/30">
            <AlertTriangle className="w-16 h-16 text-yellow-400" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-slate-800 rounded-full border border-slate-700">
            <span className="text-3xl font-bold text-white">404</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">页面未找到</h1>
        <p className="text-slate-400 mb-8">您访问的页面不存在或已被移除</p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            返回上一页
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/30 transition-all"
          >
            <Home className="w-4 h-4" />
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
