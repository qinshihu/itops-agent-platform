import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout/Layout';

// ==================== 代码分割（按需加载）====================
const Login = lazy(() => import('./pages/Login'));
const ForcePasswordChange = lazy(() => import('./pages/ForcePasswordChange'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Servers = lazy(() => import('./pages/Servers'));
const Agents = lazy(() => import('./pages/Agents'));
const Workflows = lazy(() => import('./pages/Workflows'));
const WorkflowEditor = lazy(() => import('./pages/WorkflowEditor'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Alerts = lazy(() => import('./pages/Alerts'));
const AlertMappings = lazy(() => import('./pages/AlertMappings'));
const Knowledge = lazy(() => import('./pages/Knowledge'));
const Scripts = lazy(() => import('./pages/Scripts'));
const ScheduledTasks = lazy(() => import('./pages/ScheduledTasks'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const AlertNoiseManagement = lazy(() => import('./pages/AlertNoiseManagement'));
const AlertAutoAnalysis = lazy(() => import('./pages/AlertAutoAnalysis'));
const InspectionCenter = lazy(() => import('./pages/InspectionCenter'));
const RootCauseAnalysis = lazy(() => import('./pages/RootCauseAnalysis'));
const TerminalPage = lazy(() => import('./pages/TerminalPage'));
const RemoteDesktop = lazy(() => import('./pages/RemoteDesktop'));
const BigScreenDashboard = lazy(() => import('./pages/BigScreenDashboard'));
const RemediationPolicies = lazy(() => import('./pages/RemediationPolicies'));
const RemediationPolicyEditor = lazy(() => import('./pages/RemediationPolicyEditor'));
const RemediationExecutions = lazy(() => import('./pages/RemediationExecutions'));
const RemediationDashboard = lazy(() => import('./pages/RemediationDashboard'));
const Topology = lazy(() => import('./pages/Topology'));
const AIRootCause = lazy(() => import('./pages/AIRootCause'));
const RCADetail = lazy(() => import('./pages/RCADetail'));
const RemediationWorkbench = lazy(() => import('./pages/RemediationWorkbench'));
const AIInsights = lazy(() => import('./pages/AIInsights'));
const NetworkDevices = lazy(() => import('./pages/NetworkDevices'));
const SSHKeys = lazy(() => import('./pages/SSHKeys'));
const AIModels = lazy(() => import('./pages/AIModels'));
const SNMPPage = lazy(() => import('./pages/SNMP'));
const NetworkDiscoveryPage = lazy(() => import('./pages/NetworkDiscovery'));
const AlertCorrelationGroupsPage = lazy(() => import('./pages/AlertCorrelationGroups'));
const FrontendTests = lazy(() => import('./pages/FrontendTests'));
const NotFound = lazy(() => import('./pages/NotFound'));

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <QueryClientProvider client={queryClient}>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<SuspenseRoute><Login /></SuspenseRoute>} />
                  <Route path="/force-password-change" element={<SuspenseRoute><ProtectedRoute><ForcePasswordChange /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<SuspenseRoute><ProtectedRoute><Dashboard /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="servers" element={<SuspenseRoute><ProtectedRoute><Servers /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="ssh-keys" element={<SuspenseRoute><ProtectedRoute><SSHKeys /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="network-devices" element={<SuspenseRoute><ProtectedRoute><NetworkDevices /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="agents" element={<SuspenseRoute><ProtectedRoute><Agents /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="workflows" element={<SuspenseRoute><ProtectedRoute><Workflows /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="workflows/:id" element={<SuspenseRoute><ProtectedRoute><WorkflowEditor /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="tasks" element={<SuspenseRoute><ProtectedRoute><Tasks /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alerts" element={<SuspenseRoute><ProtectedRoute><Alerts /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alert-mappings" element={<SuspenseRoute><ProtectedRoute><AlertMappings /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="knowledge" element={<SuspenseRoute><ProtectedRoute><Knowledge /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="scripts" element={<SuspenseRoute><ProtectedRoute><Scripts /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="scheduled-tasks" element={<SuspenseRoute><ProtectedRoute><ScheduledTasks /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="audit" element={<SuspenseRoute><ProtectedRoute><AuditLogs /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="notifications" element={<SuspenseRoute><ProtectedRoute><Notifications /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="reports" element={<SuspenseRoute><ProtectedRoute><Reports /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="users" element={<SuspenseRoute><ProtectedRoute><Users /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="settings" element={<SuspenseRoute><ProtectedRoute><Settings /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alert-noise" element={<SuspenseRoute><ProtectedRoute><AlertNoiseManagement /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="root-cause-analysis" element={<SuspenseRoute><ProtectedRoute><RootCauseAnalysis /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="terminal" element={<SuspenseRoute><ProtectedRoute><TerminalPage /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remote-desktop" element={<SuspenseRoute><ProtectedRoute><RemoteDesktop /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alert-auto-analysis" element={<SuspenseRoute><ProtectedRoute><AlertAutoAnalysis /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="inspection-center" element={<SuspenseRoute><ProtectedRoute><InspectionCenter /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remote-desktop/:serverId" element={<SuspenseRoute><ProtectedRoute><RemoteDesktop /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="big-screen" element={<SuspenseRoute><ProtectedRoute><BigScreenDashboard /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remediation-policies" element={<SuspenseRoute><ProtectedRoute><RemediationPolicies /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remediation-policies/:id" element={<SuspenseRoute><ProtectedRoute><RemediationPolicyEditor /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remediation-executions" element={<SuspenseRoute><ProtectedRoute><RemediationExecutions /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remediation-dashboard" element={<SuspenseRoute><ProtectedRoute><RemediationDashboard /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="topology" element={<SuspenseRoute><ProtectedRoute><Topology /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="ai-root-cause" element={<SuspenseRoute><ProtectedRoute><AIRootCause /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="ai-root-cause/:id" element={<SuspenseRoute><ProtectedRoute><RCADetail /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="remediation-workbench" element={<SuspenseRoute><ProtectedRoute><RemediationWorkbench /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="ai-insights" element={<SuspenseRoute><ProtectedRoute><AIInsights /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="frontend-tests" element={<SuspenseRoute><ProtectedRoute><FrontendTests /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="snmp" element={<SuspenseRoute><ProtectedRoute><SNMPPage /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="network-discovery" element={<SuspenseRoute><ProtectedRoute><NetworkDiscoveryPage /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="alert-correlation-groups" element={<SuspenseRoute><ProtectedRoute><AlertCorrelationGroupsPage /></ProtectedRoute></SuspenseRoute>} />
                  </Route>
                  <Route path="*" element={<SuspenseRoute><NotFound /></SuspenseRoute>} />
                </Routes>
              </BrowserRouter>
            </QueryClientProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
