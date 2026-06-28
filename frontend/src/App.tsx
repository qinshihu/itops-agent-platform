import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import ErrorBoundary from './shared/components/ErrorBoundary';
import ProtectedRoute from './shared/components/ProtectedRoute';
import Layout from './shared/layouts/Layout';

// ==================== 代码分割（按需加载）====================
const Login = lazy(() => import('./modules/auth/pages/Login'));
const ForcePasswordChange = lazy(() => import('./modules/auth/pages/ForcePasswordChange'));
const Dashboard = lazy(() => import('./modules/monitor/pages/Dashboard'));
const Servers = lazy(() => import('./modules/servers/pages/Servers'));
const Agents = lazy(() => import('./modules/ai/pages/Agents'));
const Workflows = lazy(() => import('./modules/workflow/pages/Workflows'));
const WorkflowEditor = lazy(() => import('./modules/workflow/pages/WorkflowEditor'));
const Tasks = lazy(() => import('./modules/workflow/pages/Tasks'));
const Alerts = lazy(() => import('./modules/alerts/pages/Alerts'));
const AlertMappings = lazy(() => import('./modules/alerts/pages/AlertMappings'));
const Knowledge = lazy(() => import('./modules/ai/pages/Knowledge'));
const Scripts = lazy(() => import('./modules/infra/pages/Scripts'));
const ScheduledTasks = lazy(() => import('./modules/workflow/pages/ScheduledTasks'));
const AuditLogs = lazy(() => import('./modules/infra/pages/AuditLogs'));
const Notifications = lazy(() => import('./modules/infra/pages/Notifications'));
const Reports = lazy(() => import('./modules/monitor/pages/Reports'));
const Users = lazy(() => import('./modules/auth/pages/Users'));
const Settings = lazy(() => import('./modules/infra/pages/Settings'));
const AlertNoiseManagement = lazy(() => import('./modules/alerts/pages/AlertNoiseManagement'));
const AlertAutoAnalysis = lazy(() => import('./modules/alerts/pages/AlertAutoAnalysis'));
const InspectionCenter = lazy(() => import('./modules/alerts/pages/InspectionCenter'));
const RootCauseAnalysis = lazy(() => import('./modules/ai/pages/RootCauseAnalysis'));
const TerminalPage = lazy(() => import('./modules/servers/pages/TerminalPage'));
const RemoteDesktop = lazy(() => import('./modules/servers/pages/RemoteDesktop'));
const BigScreenDashboard = lazy(() => import('./modules/monitor/pages/BigScreenDashboard'));
const RemediationPolicies = lazy(() => import('./modules/auto/pages/RemediationPolicies'));
const RemediationPolicyEditor = lazy(() => import('./modules/auto/pages/RemediationPolicyEditor'));
const RemediationExecutions = lazy(() => import('./modules/auto/pages/RemediationExecutions'));
const RemediationDashboard = lazy(() => import('./modules/auto/pages/RemediationDashboard'));
const Topology = lazy(() => import('./modules/network/pages/Topology'));
const AIRootCause = lazy(() => import('./modules/ai/pages/AIRootCause'));
const RCADetail = lazy(() => import('./modules/ai/pages/RCADetail'));
const RemediationWorkbench = lazy(() => import('./modules/auto/pages/RemediationWorkbench'));
const AIInsights = lazy(() => import('./modules/ai/pages/AIInsights'));
const NetworkDevices = lazy(() => import('./modules/network/pages/NetworkDevices'));
const SSHKeys = lazy(() => import('./modules/servers/pages/SSHKeys'));
const DbConnections = lazy(() => import('./modules/database/pages/DbConnections'));
const AIModels = lazy(() => import('./modules/ai/pages/AIModels'));
const SNMPPage = lazy(() => import('./modules/network/pages/SNMP'));
const NetworkDiscoveryPage = lazy(() => import('./modules/network/pages/NetworkDiscovery'));
const AlertCorrelationGroupsPage = lazy(() => import('./modules/alerts/pages/AlertCorrelationGroups'));
const Approvals = lazy(() => import('./modules/infra/pages/Approvals'));
const AiRemediations = lazy(() => import('./modules/ai/pages/AiRemediations'));
const FrontendTests = lazy(() => import('./shared/pages/FrontendTests'));
const NotFound = lazy(() => import('./shared/pages/NotFound'));

// ===== 新增页面 =====
const ConfigTemplates = lazy(() => import('./modules/infra/pages/ConfigTemplates'));
const Containers = lazy(() => import('./modules/containers/pages/Containers'));
const ContainerMonitor = lazy(() => import('./modules/containers/pages/ContainerMonitor'));
const ContainerLogs = lazy(() => import('./modules/containers/pages/ContainerLogs'));
const DataCenterManage = lazy(() => import('./modules/dc/pages/DataCenterManage'));
const DataRoom = lazy(() => import('./modules/dc/pages/DataRoom'));
const Images = lazy(() => import('./modules/containers/pages/Images'));
const Networks = lazy(() => import('./modules/network/pages/Networks'));
const ToolLinks = lazy(() => import('./modules/infra/pages/ToolLinks'));
const VirtualMachines = lazy(() => import('./modules/containers/pages/VirtualMachines'));
const Volumes = lazy(() => import('./modules/containers/pages/Volumes'));
const ComposeEditor = lazy(() => import('./modules/containers/pages/ComposeEditor'));
const SnapshotPolicies = lazy(() => import('./modules/containers/pages/SnapshotPolicies'));
const ImageRegistry = lazy(() => import('./modules/containers/pages/ImageRegistry'));
const Kubernetes = lazy(() => import('./modules/kubernetes/pages/Kubernetes'));
const CostAnalysis = lazy(() => import('./modules/monitor/pages/CostAnalysis'));
const AutoScale = lazy(() => import('./modules/auto/pages/AutoScale'));
const Tools = lazy(() => import('./modules/infra/pages/Tools'));
const WorkflowProviders = lazy(() => import('./modules/workflow/pages/WorkflowProviders'));
const AlertProviders = lazy(() => import('./modules/alerts/pages/AlertProviders'));

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
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ThemedConfigProvider>
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
                    <Route path="db-connections" element={<SuspenseRoute><ProtectedRoute><DbConnections /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="network-devices" element={<SuspenseRoute><ProtectedRoute><NetworkDevices /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="agents" element={<SuspenseRoute><ProtectedRoute><Agents /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="agents/tools" element={<SuspenseRoute><ProtectedRoute><Tools /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="workflows" element={<SuspenseRoute><ProtectedRoute><Workflows /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="workflows/providers" element={<SuspenseRoute><ProtectedRoute><WorkflowProviders /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="workflows/:id" element={<SuspenseRoute><ProtectedRoute><WorkflowEditor /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="tasks" element={<SuspenseRoute><ProtectedRoute><Tasks /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alerts" element={<SuspenseRoute><ProtectedRoute><Alerts /></ProtectedRoute></SuspenseRoute>} />
                    <Route path="alerts/providers" element={<SuspenseRoute><ProtectedRoute><AlertProviders /></ProtectedRoute></SuspenseRoute>} />
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
                  <Route path="approvals" element={<SuspenseRoute><ProtectedRoute><Approvals /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="ai-remediations" element={<SuspenseRoute><ProtectedRoute><AiRemediations /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="config-templates" element={<SuspenseRoute><ProtectedRoute><ConfigTemplates /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="containers" element={<SuspenseRoute><ProtectedRoute><Containers /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="container-monitor" element={<SuspenseRoute><ProtectedRoute><ContainerMonitor /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="container-logs" element={<SuspenseRoute><ProtectedRoute><ContainerLogs /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="dc-manage" element={<SuspenseRoute><ProtectedRoute><DataCenterManage /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="data-room" element={<SuspenseRoute><ProtectedRoute><DataRoom /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="images" element={<SuspenseRoute><ProtectedRoute><Images /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="networks" element={<SuspenseRoute><ProtectedRoute><Networks /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="tool-links" element={<SuspenseRoute><ProtectedRoute><ToolLinks /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="virtual-machines" element={<SuspenseRoute><ProtectedRoute><VirtualMachines /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="volumes" element={<SuspenseRoute><ProtectedRoute><Volumes /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="compose" element={<SuspenseRoute><ProtectedRoute><ComposeEditor /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="snapshot-policies" element={<SuspenseRoute><ProtectedRoute><SnapshotPolicies /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="image-registry" element={<SuspenseRoute><ProtectedRoute><ImageRegistry /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="kubernetes" element={<SuspenseRoute><ProtectedRoute><Kubernetes /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="cost-analysis" element={<SuspenseRoute><ProtectedRoute><CostAnalysis /></ProtectedRoute></SuspenseRoute>} />
                  <Route path="auto-scale" element={<SuspenseRoute><ProtectedRoute><AutoScale /></ProtectedRoute></SuspenseRoute>} />
                  </Route>
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
