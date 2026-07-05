import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as XYFlow from '@xyflow/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import api from '../../lib/api';
import VirtualMachines from '../../modules/containers/pages/VirtualMachines';
import WorkflowEditor from '../../modules/workflow/pages/WorkflowEditor';
import BigScreenDashboard from '../../modules/monitor/pages/BigScreenDashboard';
import Agents from '../../modules/ai/pages/Agents';
import Kubernetes from '../../modules/kubernetes/pages/Kubernetes';

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof XYFlow>('@xyflow/react');
  return {
    ...actual,
    ReactFlow: () => <div data-testid="react-flow" />,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Controls: () => <div data-testid="flow-controls" />,
    Background: () => <div data-testid="flow-background" />,
    MiniMap: () => <div data-testid="flow-minimap" />,
    Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('../../modules/monitor/components/ParticleBackground', () => ({ default: () => <div data-testid="particle-background" /> }));
vi.mock('../../modules/monitor/components/AnimatedLineChart', () => ({ default: () => <div data-testid="line-chart" /> }));
vi.mock('../../modules/monitor/components/AnimatedBarChart', () => ({ default: () => <div data-testid="bar-chart" /> }));
vi.mock('../../modules/monitor/components/CircularProgress', () => ({ default: () => <div data-testid="circular-progress" /> }));
vi.mock('../../modules/kubernetes/pages/k8s/PodList', () => ({ default: () => <div data-testid="pod-list" /> }));
vi.mock('../../modules/kubernetes/pages/k8s/ServiceList', () => ({ default: () => <div data-testid="service-list" /> }));
vi.mock('../../modules/kubernetes/pages/k8s/NodeList', () => ({ default: () => <div data-testid="node-list" /> }));

const apiGet = vi.mocked(api.get);

function success(data: unknown) {
  return Promise.resolve({ data: { data } });
}

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation((url: string) => {
    if (url.includes('/api/virtual-machines/platforms')) return success([]);
    if (url.includes('/api/virtual-machines/stats')) {
      return success({ platforms: [], summary: { total: 0, poweredOn: 0, poweredOff: 0, suspended: 0 }, sqliteFallback: false });
    }
    if (url.includes('/api/virtual-machines')) return Promise.resolve({ data: { data: [], total: 0, source: 'test' } });
    if (url.includes('/api/agents')) return success([]);
    if (url.includes('/api/workflows/providers/list')) return success([]);
    if (url.includes('/api/dashboard/full')) {
      return success({
        stats: {
          servers: { total: 0, enabled: 0 },
          agents: { total: 0, enabled: 0 },
          tasks: { total: 0, running: 0, completed: 0, failed: 0 },
          alerts: { total: 0, critical: 0, warning: 0, resolved: 0 },
        },
        recentTasks: [],
        recentAlerts: [],
        servers: [],
      });
    }
    if (url.includes('/api/dashboard/alert-trends')) return success([]);
    if (url.includes('/api/dashboard/task-trends')) return success([]);
    if (url.includes('/api/dashboard/agent-stats')) {
      return success({ agents: [], overall: { totalExecutions: 0, totalSuccess: 0, overallSuccessRate: 0, todayExecutions: 0 } });
    }
    if (url.includes('/api/dashboard/task-distribution')) return success({ byStatus: [], byWorkflow: [] });
    if (url.includes('/api/dashboard/remediation-stats')) return success({ total: 0, success: 0, failed: 0, pending: 0 });
    if (url.includes('/api/dashboard/server-metrics')) return success({ servers: [] });
    if (url.includes('/api/dashboard/sla-stats')) return success({ availability: 100, mttr: 0, mtbf: 0 });
    if (url.includes('/api/tasks')) return success([]);
    if (url.includes('/api/servers')) return success([]);
    if (url.includes('/api/db-connections')) return success([]);
    if (url.includes('/api/kubernetes/contexts')) return success([]);
    return success([]);
  });
});

describe('核心页面冒烟测试', () => {
  it('渲染虚拟机管理页面', async () => {
    renderWithProviders(<VirtualMachines />);
    expect(await screen.findByText('虚拟机管理')).toBeInTheDocument();
    expect(screen.getByText(/跨平台管理/)).toBeInTheDocument();
  });

  it('渲染工作流编辑器页面', async () => {
    renderWithProviders(<WorkflowEditor />, ['/workflows/new']);
    expect(await screen.findByText('编辑工作流')).toBeInTheDocument();
    expect(screen.getByText('可用节点')).toBeInTheDocument();
  });

  it('渲染运维监控大屏页面', async () => {
    renderWithProviders(<BigScreenDashboard />);
    expect(await screen.findByText('ITOps 运维监控大屏')).toBeInTheDocument();
    expect(screen.getByText('系统资源监控')).toBeInTheDocument();
  });

  it('渲染 Agent 管理页面', async () => {
    renderWithProviders(<Agents />);
    expect(await screen.findByText('Agent管理')).toBeInTheDocument();
    expect(screen.getByText('管理运维自动化Agent')).toBeInTheDocument();
  });

  it('渲染 Kubernetes 页面无集群状态', async () => {
    renderWithProviders(<Kubernetes />);
    await waitFor(() => expect(screen.getByText('K8s 集群不可用')).toBeInTheDocument());
    expect(screen.getByText('请导入 kubeconfig 配置以连接 K8s 集群')).toBeInTheDocument();
  });
});
