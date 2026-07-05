import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, isValidElement } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import ErrorBoundary from './shared/components/ErrorBoundary';
import ProtectedRoute from './shared/components/ProtectedRoute';
import Layout from './shared/layouts/Layout';

// 模块路由聚合
import { protectedRoutes, publicRoutes } from './modules/_routes.tsx';

const NotFound = lazy(() => import('./shared/pages/NotFound'));

// ==================== 加载占位 ====================
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">加载中...</p>
      </div>
    </div>
  );
}

function SuspenseRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function ThemedConfigProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          borderRadius: 6,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolveElement = (el: any) => {
    if (!el) return null;
    if (isValidElement(el)) return el;
    const Component = el as React.ComponentType;
    return <Component />;
  };

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ThemedConfigProvider>
          <AuthProvider>
            <ToastProvider>
              <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                <Routes>
                  {/* 公开路由 */}
                  {publicRoutes.map((route) => (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={<SuspenseRoute>{resolveElement(route.element)}</SuspenseRoute>}
                    />
                  ))}

                  {/* 受保护路由 */}
                  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    {protectedRoutes.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={
                          <SuspenseRoute>
                            <ProtectedRoute>
                              {resolveElement(route.element)}
                            </ProtectedRoute>
                          </SuspenseRoute>
                        }
                      />
                    ))}
                  </Route>

                  {/* 404 */}
                  <Route path="*" element={<SuspenseRoute><NotFound /></SuspenseRoute>} />
                </Routes>
              </BrowserRouter>
            </QueryClientProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemedConfigProvider>
    </ThemeProvider>
  </ErrorBoundary>
  );
}

export default App;
