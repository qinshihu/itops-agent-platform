import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, AlertCircle, Globe, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/auth/login', { username, password });

      if (response.data.success) {
        login(response.data.data.token, response.data.data.user, response.data.data.refreshToken);
        
        // 检查是否需要强制修改密码
        if (response.data.data.user.passwordMustChange) {
          navigate('/force-password-change', { replace: true });
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(response.data.error || response.data.message || '登录失败，请检查用户名和密码');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* 背景效果 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* 主内容 */}
      <div className="relative z-10 w-full max-w-lg px-4 flex flex-col min-h-screen">
        {/* 主要内容区域 - 可伸缩 */}
        <div className="flex-1 flex flex-col justify-center">
          {/* Logo和标题 */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 mb-6 shadow-2xl overflow-hidden">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              ITOps Agent 平台
            </h1>
            <p className="text-slate-300 text-sm tracking-wide">
              多Agent自动化平台
            </p>
          </div>

          {/* 登录卡片 */}
          <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-10 border border-white/10 shadow-2xl">
            <h2 className="text-2xl font-semibold text-white mb-8 text-center">
              用户登录
            </h2>

            {/* 错误提示 */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 用户名 */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-3 ml-1">
                  用户名
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 hover:border-white/20"
                    required
                  />
                </div>
              </div>

              {/* 密码 */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-3 ml-1">
                  密码
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 hover:border-white/20"
                    required
                  />
                </div>
              </div>

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-semibold rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    登录中...
                  </>
                ) : (
                  <>
                    登录
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* 底部版权和链接 - 固定在底部偏上 */}
        <div className="py-8">
          <div className="flex items-center justify-center gap-3">
            <a
              href="https://www.zjzwfw.cloud/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors duration-200"
            >
              <Globe className="w-4 h-4" />
              <span className="text-sm">www.zjzwfw.cloud</span>
            </a>
            <span className="text-slate-500 text-sm">•</span>
            <p className="text-slate-400 text-sm">
              © 2026 ITOps Agent 平台
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
