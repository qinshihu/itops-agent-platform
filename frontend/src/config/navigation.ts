import {
  LayoutDashboard,
  Monitor,
  Server,
  Network,
  Router,
  Radio,
  Globe,
  Database,
  Key,
  Terminal,
  MonitorPlay,
  Container,
  Box,
  Activity,
  HardDrive,
  Image as ImageIcon,
  Cpu,
  Layers,
  Camera,
  Package,
  DollarSign,
  TrendingUp,
  Building2,
  LayoutGrid,
  Zap,
  Bot,
  Wrench,
  GitBranch,
  Cog,
  Play,
  ShieldCheck,
  FileCode,
  Clock,
  FileText,
  AlertTriangle,
  Bell,
  Link2,
  Shield,
  Search,
  Brain,
  Lightbulb,
  ListChecks,
  Workflow,
  BarChart3,
  BookMarked,
  BookOpen,
  MessageSquare,
  Users,
  FlaskConical,
  Settings,
  Home,
  ServerCog,
  Code2,
  LineChart as LineChartIcon,
  Archive,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  name: string;
  icon: LucideIcon;
  items: NavItem[];
};

/** 侧边栏导航分组配置 */
export const navigationGroups: NavGroup[] = [
  {
    name: "nav.home",
    icon: Home,
    items: [
      { name: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "nav.bigScreen", href: "/big-screen", icon: Monitor },
    ],
  },
  {
    name: "nav.serverMgmt",
    icon: ServerCog,
    items: [
      { name: "nav.servers", href: "/servers", icon: Server },
      { name: "nav.networkDevices", href: "/network-devices", icon: Network },
      { name: "nav.networks", href: "/networks", icon: Router },
      { name: "nav.snmp", href: "/snmp", icon: Radio },
      { name: "nav.networkDiscovery", href: "/network-discovery", icon: Globe },
      { name: "nav.dbConnections", href: "/db-connections", icon: Database },
      { name: "nav.sshKeys", href: "/ssh-keys", icon: Key },
      { name: "nav.terminal", href: "/terminal", icon: Terminal },
      { name: "nav.remoteDesktop", href: "/remote-desktop", icon: MonitorPlay },
      // 注：/backups 在 backup 模块，放在 nav.systemUsers 组（系统级备份设置）
    ],
  },
  {
    name: "nav.containersVirtualization",
    icon: Box,
    items: [
      { name: "nav.containers", href: "/containers", icon: Container },
      {
        name: "nav.containerMonitor",
        href: "/container-monitor",
        icon: Activity,
      },
      { name: "nav.containerLogs", href: "/container-logs", icon: Terminal },
      { name: "nav.images", href: "/images", icon: ImageIcon },
      { name: "nav.volumes", href: "/volumes", icon: HardDrive },
      { name: "nav.virtualMachines", href: "/virtual-machines", icon: Cpu },
      { name: "nav.compose", href: "/compose", icon: Layers },
      {
        name: "nav.snapshotPolicies",
        href: "/snapshot-policies",
        icon: Camera,
      },
      { name: "nav.vmMigrations", href: "/vm-migrations", icon: GitBranch },
      { name: "nav.imageRegistry", href: "/image-registry", icon: Package },
      { name: "nav.kubernetes", href: "/kubernetes", icon: Container },
      { name: "nav.costAnalysis", href: "/cost-analysis", icon: DollarSign },
      { name: "nav.autoScale", href: "/auto-scale", icon: TrendingUp },
    ],
  },
  {
    name: "nav.dataCenter",
    icon: Building2,
    items: [
      { name: "nav.dcInfrastructure", href: "/dc-manage", icon: LayoutGrid },
      { name: "nav.dcRoom3D", href: "/data-room", icon: Monitor },
    ],
  },
  {
    name: "nav.autoExecution",
    icon: Zap,
    items: [
      { name: "nav.agents", href: "/agents", icon: Bot },
      { name: "nav.agentTools", href: "/agents/tools", icon: Wrench },
      { name: "nav.workflows", href: "/workflows", icon: GitBranch },
      {
        name: "nav.workflowProviders",
        href: "/workflows/providers",
        icon: SlidersHorizontal,
      },
      { name: "nav.tasks", href: "/tasks", icon: Play },
      { name: "nav.approvals", href: "/approvals", icon: ShieldCheck },
      { name: "nav.scripts", href: "/scripts", icon: FileCode },
      { name: "nav.scheduledTasks", href: "/scheduled-tasks", icon: Clock },
      {
        name: "nav.configTemplates",
        href: "/config-templates",
        icon: FileText,
      },
    ],
  },
  {
    name: "nav.alertsAI",
    icon: AlertTriangle,
    items: [
      { name: "nav.alerts", href: "/alerts", icon: Bell },
      { name: "nav.alertMappings", href: "/alert-mappings", icon: Link2 },
      { name: "nav.alertNoise", href: "/alert-noise", icon: Shield },
      {
        name: "nav.alertCorrelation",
        href: "/alert-correlation-groups",
        icon: Layers,
      },
      {
        name: "nav.rootCauseAnalysis",
        href: "/root-cause-analysis",
        icon: Search,
      },
      { name: "nav.aiRootCause", href: "/ai-root-cause", icon: Brain },
      { name: "nav.topology", href: "/topology", icon: Network },
      { name: "nav.aiInsights", href: "/ai-insights", icon: Lightbulb },
      {
        name: "nav.alertAutoAnalysis",
        href: "/alert-auto-analysis",
        icon: Zap,
      },
      {
        name: "nav.inspectionCenter",
        href: "/inspection-center",
        icon: Activity,
      },
      { name: "nav.alertProviders", href: "/alerts/providers", icon: Radio },
      { name: "nav.zabbixQuery", href: "/zabbix", icon: Activity },
      { name: "nav.prometheusQuery", href: "/prometheus", icon: LineChartIcon },
    ],
  },
  {
    name: "nav.mcp",
    icon: Code2,
    items: [
      { name: "nav.mcpOverview", href: "/mcp/overview", icon: LayoutDashboard },
      { name: "nav.mcpTools", href: "/mcp/tools", icon: Wrench },
      {
        name: "nav.mcpExternalServers",
        href: "/mcp/external-servers",
        icon: Server,
      },
      { name: "nav.mcpTester", href: "/mcp/tester", icon: Play },
    ],
  },
  {
    name: "nav.autoRemediation",
    icon: ShieldCheck,
    items: [
      {
        name: "nav.remediationPolicies",
        href: "/remediation-policies",
        icon: Wrench,
      },
      {
        name: "nav.remediationDashboard",
        href: "/remediation-dashboard",
        icon: BarChart3,
      },
      {
        name: "nav.remediationExecutions",
        href: "/remediation-executions",
        icon: ListChecks,
      },
      {
        name: "nav.remediationWorkbench",
        href: "/remediation-workbench",
        icon: Workflow,
      },
      { name: "nav.aiRemediations", href: "/ai-remediations", icon: Lightbulb },
    ],
  },
  {
    name: "nav.knowledgeReports",
    icon: BookMarked,
    items: [
      { name: "nav.knowledge", href: "/knowledge", icon: BookOpen },
      { name: "nav.auditLogs", href: "/audit", icon: Shield },
      {
        name: "nav.notifications",
        href: "/notifications",
        icon: MessageSquare,
      },
      { name: "nav.reports", href: "/reports", icon: FileText },
    ],
  },
  {
    name: "nav.systemUsers",
    icon: Cog,
    items: [
      { name: "nav.users", href: "/users", icon: Users },
      {
        name: "nav.frontendTests",
        href: "/frontend-tests",
        icon: FlaskConical,
      },
      { name: "nav.toolLinks", href: "/tool-links", icon: Link2 },
      { name: "nav.settings", href: "/settings", icon: Settings },
      // 注：/tools（infra 模块）与 /agents/tools 功能重复（都调用 /agents/tools/* API），
      // 因此不单独暴露，用户通过 /agents/tools 访问工具测试 UI。
    ],
  },
];
