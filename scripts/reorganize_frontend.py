"""Frontend module restructuring for daima project.
Group pages and components by business domain, matching backend modules.
"""
import subprocess, shutil, re, os
from pathlib import Path

ROOT = Path(r'F:\自开发代码\多Agent运维平台\ITops agent\daima')
FE = ROOT / 'frontend' / 'src'

# === Define mappings ===
# Pages -> modules/{domain}/pages/
PAGE_MAPPINGS = {
    # auth
    'Login': 'auth',
    'ForcePasswordChange': 'auth',
    'Users': 'auth',
    # servers
    'Servers': 'servers',
    'SSHKeys': 'servers',
    'RemoteDesktop': 'servers',
    'TerminalPage': 'servers',
    # network
    'NetworkDevices': 'network',
    'Networks': 'network',
    'Topology': 'network',
    'SNMP': 'network',
    'NetworkDiscovery': 'network',
    # alerts
    'Alerts': 'alerts',
    'AlertMappings': 'alerts',
    'AlertNoiseManagement': 'alerts',
    'AlertAutoAnalysis': 'alerts',
    'AlertCorrelationGroups': 'alerts',
    'AlertProviders': 'alerts',
    'InspectionCenter': 'alerts',
    # ai
    'AIInsights': 'ai',
    'AIModels': 'ai',
    'AiRemediations': 'ai',
    'AIRootCause': 'ai',
    'Knowledge': 'ai',
    'RootCauseAnalysis': 'ai',
    'RCADetail': 'ai',
    'Agents': 'ai',
    'AIAgentConfig': 'ai',
    # dc
    'DataRoom': 'dc',
    # dc DataCenterManage is a directory
    # workflow
    'Workflows': 'workflow',
    'WorkflowEditor': 'workflow',
    'WorkflowProviders': 'workflow',
    'Tasks': 'workflow',
    'ScheduledTasks': 'workflow',
    # containers
    'Containers': 'containers',
    'ContainerLogs': 'containers',
    'ContainerMonitor': 'containers',
    'Images': 'containers',
    'Volumes': 'containers',
    'VirtualMachines': 'containers',
    'ImageRegistry': 'containers',
    'ComposeEditor': 'containers',
    'SnapshotPolicies': 'containers',
    # infra
    'Settings': 'infra',
    'ConfigTemplates': 'infra',
    'Scripts': 'infra',
    'Notifications': 'infra',
    'Approvals': 'infra',
    'AuditLogs': 'infra',
    'ToolLinks': 'infra',
    'ToolLinksManage': 'infra',
    'Tools': 'infra',
    'Backups': 'infra',
    # monitor
    'Dashboard': 'monitor',
    'BigScreenDashboard': 'monitor',
    'Reports': 'monitor',
    'CostAnalysis': 'monitor',
    # database
    'DbConnections': 'database',
    # auto
    'AutoScale': 'auto',
    'RemediationPolicies': 'auto',
    'RemediationPolicyEditor': 'auto',
    'RemediationExecutions': 'auto',
    'RemediationDashboard': 'auto',
    'RemediationWorkbench': 'auto',
    # kubernetes
    'Kubernetes': 'kubernetes',
    # shared (stay in shared/pages/)
    'NotFound': '_shared',
    'FrontendTests': '_shared',
}

# Components -> modules/{domain}/components/
COMPONENT_MAPPINGS = {
    # network
    'NetworkDeviceCard': 'network',
    'SnmpCredentials': 'network',
    'SnmpInspectionResult': 'network',
    'TopologyGraph': 'network',
    # alerts
    'ImpactChain': 'alerts',
    'InspectionHistory': 'alerts',
    'InspectionResult': 'alerts',
    # ai
    'ChatWidget': 'ai',
    'RecommendationCard': 'ai',
    # servers
    'WebTerminal': 'servers',
    # infra
    'AddDeviceModal': 'infra',
    'ImportExport': 'infra',
    # monitor
    'AnimatedBarChart': 'monitor',
    'AnimatedLineChart': 'monitor',
    'CircularProgress': 'monitor',
    'ParticleBackground': 'monitor',
    'TrendCharts': 'monitor',
}

def safe_git_mv(src, dst):
    """git mv with fallback to copy+delete"""
    dst.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(['git', 'mv', str(src), str(dst)], 
                          cwd=str(ROOT), capture_output=True, text=True, timeout=10)
    if result.returncode != 0:
        shutil.copy2(str(src), str(dst))
        src.unlink()

def main():
    print("=" * 60)
    print("  daima 前端模块化重构")
    print("=" * 60)
    
    # Step 1: Create module directories
    print("\n[1/4] 创建目录结构...")
    dirs_created = set()
    for name, domain in PAGE_MAPPINGS.items():
        d = FE / 'modules' / domain / 'pages'
        d.mkdir(parents=True, exist_ok=True)
        dirs_created.add(str(d))
    for name, domain in COMPONENT_MAPPINGS.items():
        d = FE / 'modules' / domain / 'components'
        d.mkdir(parents=True, exist_ok=True)
        dirs_created.add(str(d))
    # shared directories
    (FE / 'shared' / 'components').mkdir(parents=True, exist_ok=True)
    (FE / 'shared' / 'layouts').mkdir(parents=True, exist_ok=True)
    (FE / 'shared' / 'pages').mkdir(parents=True, exist_ok=True)
    (FE / 'shared' / 'hooks').mkdir(parents=True, exist_ok=True)
    (FE / 'shared' / 'config').mkdir(parents=True, exist_ok=True)
    print(f"      已创建 {len(dirs_created)} 个目录")
    
    # Step 2: Move pages
    print("\n[2/4] 迁移页面文件...")
    moved = 0
    for name, domain in PAGE_MAPPINGS.items():
        src_file = FE / 'pages' / f'{name}.tsx'
        if not src_file.exists():
            print(f"  SKIP (no .tsx): pages/{name}")
            # Check if it's a directory
            src_dir = FE / 'pages' / name
            if src_dir.is_dir():
                dst_dir = FE / 'modules' / domain / 'pages' / name
                safe_git_mv(src_dir, dst_dir)
                print(f"  MOVE DIR: pages/{name}/ -> modules/{domain}/pages/{name}/")
                moved += 1
            continue
        dst_file = FE / 'modules' / domain / 'pages' / f'{name}.tsx'
        safe_git_mv(src_file, dst_file)
        print(f"  MOVE: pages/{name}.tsx -> modules/{domain}/pages/{name}.tsx")
        moved += 1
    print(f"      已迁移 {moved} 个页面")
    
    # Step 3: Move components
    print("\n[3/4] 迁移组件文件...")
    moved_comp = 0
    for name, domain in COMPONENT_MAPPINGS.items():
        src_file = FE / 'components' / f'{name}.tsx'
        if not src_file.exists():
            # Check for directory
            src_dir = FE / 'components' / name
            if src_dir.is_dir():
                dst_dir = FE / 'modules' / domain / 'components' / name
                safe_git_mv(src_dir, dst_dir)
                print(f"  MOVE DIR: components/{name}/ -> modules/{domain}/components/{name}/")
                moved_comp += 1
            continue
        dst_file = FE / 'modules' / domain / 'components' / f'{name}.tsx'
        safe_git_mv(src_file, dst_file)
        print(f"  MOVE: components/{name}.tsx -> modules/{domain}/components/{name}.tsx")
        moved_comp += 1
    
    # Move DataRoom3D (already a directory module)
    src_dr = FE / 'components' / 'DataRoom3D'
    if src_dr.exists():
        dst_dr = FE / 'modules' / 'dc' / 'components' / 'DataRoom3D'
        safe_git_mv(src_dr, dst_dr)
        print(f"  MOVE DIR: components/DataRoom3D/ -> modules/dc/components/DataRoom3D/")
        moved_comp += 1
    
    # Move layout
    src_layout = FE / 'components' / 'layout'
    if src_layout.exists():
        dst_layout = FE / 'shared' / 'layouts'
        # Move individual files
        for f in src_layout.rglob('*'):
            if f.is_file():
                rel = f.relative_to(src_layout)
                dst_f = dst_layout / rel
                safe_git_mv(f, dst_f)
        print(f"  MOVE: components/layout/ -> shared/layouts/")
        moved_comp += 1
    
    print(f"      已迁移 {moved_comp} 个组件")
    
    # Step 4: Move shared components
    print("\n[4/4] 迁移共享组件...")
    shared_components = ['ErrorBoundary', 'ProtectedRoute', 'MarkdownOutput']
    for name in shared_components:
        src = FE / 'components' / f'{name}.tsx'
        if src.exists():
            dst = FE / 'shared' / 'components' / f'{name}.tsx'
            safe_git_mv(src, dst)
            print(f"  MOVE: components/{name}.tsx -> shared/components/{name}.tsx")
    
    print("\n" + "=" * 60)
    print("  文件迁移完成！下一步：")
    print("  1. 运行 scripts/fix_frontend_imports.py 更新 import 路径")
    print("  2. cd frontend && npm run build 验证编译")
    print("=" * 60)


if __name__ == '__main__':
    main()
