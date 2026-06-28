"""
Fix frontend import paths after module restructuring.

Bug fix: old version used `f"'../" * depth` which produced
  `'../'../'../` instead of the correct `../../../`
"""
import re
from pathlib import Path

FE = Path(r'F:\自开发代码\多Agent运维平台\ITops agent\daima\frontend\src')

PAGE_MODULE = {
    'Login': 'auth', 'ForcePasswordChange': 'auth', 'Users': 'auth',
    'Servers': 'servers', 'SSHKeys': 'servers', 'RemoteDesktop': 'servers', 'TerminalPage': 'servers',
    'NetworkDevices': 'network', 'Networks': 'network', 'Topology': 'network', 'SNMP': 'network', 'NetworkDiscovery': 'network',
    'Alerts': 'alerts', 'AlertMappings': 'alerts', 'AlertNoiseManagement': 'alerts', 'AlertAutoAnalysis': 'alerts',
    'AlertCorrelationGroups': 'alerts', 'AlertProviders': 'alerts', 'InspectionCenter': 'alerts',
    'AIInsights': 'ai', 'AIModels': 'ai', 'AiRemediations': 'ai', 'AIRootCause': 'ai',
    'Knowledge': 'ai', 'RootCauseAnalysis': 'ai', 'RCADetail': 'ai', 'Agents': 'ai',
    'DataRoom': 'dc',
    'Workflows': 'workflow', 'WorkflowEditor': 'workflow', 'WorkflowProviders': 'workflow',
    'Tasks': 'workflow', 'ScheduledTasks': 'workflow',
    'Containers': 'containers', 'ContainerLogs': 'containers', 'ContainerMonitor': 'containers',
    'Images': 'containers', 'Volumes': 'containers', 'VirtualMachines': 'containers',
    'ImageRegistry': 'containers', 'ComposeEditor': 'containers', 'SnapshotPolicies': 'containers',
    'Settings': 'infra', 'ConfigTemplates': 'infra', 'Scripts': 'infra',
    'Notifications': 'infra', 'Approvals': 'infra', 'AuditLogs': 'infra',
    'ToolLinks': 'infra', 'ToolLinksManage': 'infra', 'Tools': 'infra',
    'Dashboard': 'monitor', 'BigScreenDashboard': 'monitor', 'Reports': 'monitor', 'CostAnalysis': 'monitor',
    'DbConnections': 'database',
    'AutoScale': 'auto', 'RemediationPolicies': 'auto', 'RemediationPolicyEditor': 'auto',
    'RemediationExecutions': 'auto', 'RemediationDashboard': 'auto', 'RemediationWorkbench': 'auto',
    'Kubernetes': 'kubernetes',
    'NotFound': None,  # stays in shared/pages
    'FrontendTests': None,  # stays in shared/pages
}

COMP_MODULE = {
    'NetworkDeviceCard': 'network', 'SnmpCredentials': 'network', 'SnmpInspectionResult': 'network',
    'TopologyGraph': 'network',
    'ImpactChain': 'alerts', 'InspectionHistory': 'alerts', 'InspectionResult': 'alerts',
    'ChatWidget': 'ai', 'RecommendationCard': 'ai',
    'WebTerminal': 'servers',
    'AddDeviceModal': 'infra', 'ImportExport': 'infra',
    'AnimatedBarChart': 'monitor', 'AnimatedLineChart': 'monitor', 'CircularProgress': 'monitor',
    'ParticleBackground': 'monitor', 'TrendCharts': 'monitor',
}


def up_levels(n):
    """Return e.g. '../../../' for n=3"""
    return '../' * n


def fix_module_file(file_path):
    """Fix imports in a file that was moved into modules/ or shared/."""
    rel = file_path.relative_to(FE)
    parts = list(rel.parent.parts)

    if not parts or parts[0] not in ('modules', 'shared'):
        return 0

    content = file_path.read_text('utf-8', errors='ignore')
    original = content
    changes = 0
    depth = len(parts)  # 3 for modules/*/pages/, 2 for shared/components/

    # Pattern 1: Root-level dirs that stayed (lib/, contexts/, config/, hooks/, i18n/, test/, utils/)
    stay_dirs = ['lib/', 'contexts/', 'config/', 'hooks/', 'i18n/', 'test/', 'utils/']
    for d in stay_dirs:
        for prefix_level in range(1, 5):
            old = "'" + up_levels(prefix_level) + d
            if old in content:
                new = "'" + up_levels(depth) + d
                if new != old:
                    content = content.replace(old, new)
                    changes += 1

    # Pattern 2: Components that moved to specific modules
    for comp_name, domain in COMP_MODULE.items():
        for prefix_level in range(1, 5):
            old = "'" + up_levels(prefix_level) + f"components/{comp_name}'"
            if old in content:
                new = "'" + up_levels(depth) + f"modules/{domain}/components/{comp_name}'"
                content = content.replace(old, new)
                changes += 1

    # Pattern 3: DataRoom3D directory
    for prefix_level in range(1, 5):
        old = "'" + up_levels(prefix_level) + "components/DataRoom3D'"
        if old in content:
            new = "'" + up_levels(depth) + "modules/dc/components/DataRoom3D'"
            content = content.replace(old, new)
            changes += 1

    # Pattern 4: Shared components
    for shared_name in ['ErrorBoundary', 'ProtectedRoute', 'MarkdownOutput']:
        for prefix_level in range(1, 5):
            old = "'" + up_levels(prefix_level) + f"components/{shared_name}'"
            if old in content:
                new = "'" + up_levels(depth) + f"shared/components/{shared_name}'"
                content = content.replace(old, new)
                changes += 1

    # Pattern 5: Layout
    for prefix_level in range(1, 5):
        old = "'" + up_levels(prefix_level) + "layout/Layout'"
        if old in content:
            new = "'" + up_levels(depth) + "shared/layouts/Layout'"
            content = content.replace(old, new)
            changes += 1

    if content != original:
        file_path.write_text(content, 'utf-8')

    return changes


def main():
    print("=" * 60)
    print("  修复前端 import 路径 (v2)")
    print("=" * 60)

    total_changes = 0
    fixed_files = 0

    for f in sorted(FE.rglob('*')):
        if f.is_dir() or 'node_modules' in str(f):
            continue
        if f.suffix not in ('.tsx', '.ts'):
            continue

        try:
            changes = fix_module_file(f)
            if changes > 0:
                total_changes += changes
                fixed_files += 1
                print(f"  [{changes:3d}] {f.relative_to(FE)}")
        except Exception as e:
            print(f"  ERROR: {f.relative_to(FE)}: {e}")

    print(f"\n=== 总结 ===")
    print(f"Fixed {total_changes} imports in {fixed_files} files")


if __name__ == '__main__':
    main()
