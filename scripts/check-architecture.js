/**
 * ITops Agent 架构合规检查脚本
 *
 * 验证以下架构约束：
 * 1. modules/ 下禁止直接 import models/database（必须通过 Repository）
 * 2. 24 个后端模块 / 23 个前端模块结构完整性
 * 3. core/ 不得依赖 modules/
 * 4. modules 之间禁止跨模块 routes/ 依赖
 *
 * 用法：node scripts/check-architecture.js [backend|frontend|all]
 *
 * v2.5（2026-07-21，ADR-020 v2.4 触发）：
 *   - 后端 24 模块、前端 23 模块（去掉 linkage，按 frontend.md §注）
 *   - 之前用同一份 EXPECTED_MODULES 检查前后端，会假报前端缺 linkage
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND_SRC = path.join(ROOT, 'backend', 'src');
const FRONTEND_SRC = path.join(ROOT, 'frontend', 'src');

// ─── 常量 ────────────────────────────────────────────

// 后端 24 个模块（P1-6 后）
const BACKEND_MODULES = [
  'ai',
  'alerts',
  'audit',
  'auth',
  'auto',
  'backup',
  'change-management',
  'config-management',
  'containers',
  'database',
  'dc',
  'import-export',
  'infra',
  'kubernetes',
  'linkage',
  'mcp',
  'monitor',
  'network',
  'notification',
  'scripts',
  'servers',
  'settings',
  'tool-links',
  'workflow',
];

// 前端 23 个模块（linkage 按预期后端有前端暂无，参见 frontend.md §注）
const FRONTEND_MODULES = [
  'ai',
  'alerts',
  'audit',
  'auth',
  'auto',
  'backup',
  'change-management',
  'config-management',
  'containers',
  'database',
  'dc',
  'import-export',
  'infra',
  'kubernetes',
  'mcp',
  'monitor',
  'network',
  'notification',
  'scripts',
  'servers',
  'settings',
  'tool-links',
  'workflow',
];

let violations = 0;
let warnings = 0;

// ─── 工具 ────────────────────────────────────────────

function getFiles(dir, extension = '.ts') {
  const result = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        walk(full);
      } else if (entry.isFile() && full.endsWith(extension)) {
        result.push(full);
      }
    }
  }
  walk(dir);
  return result;
}

function readFileSafe(fp) {
  try {
    return fs.readFileSync(fp, 'utf-8');
  } catch {
    return null;
  }
}

function logIssues(header, issues) {
  if (issues.length === 0) return;
  violations += issues.length;
  console.log(`\n  ❌ ${header} (${issues.length}):`);
  for (const issue of issues.slice(0, 20)) {
    console.log(`     ${issue}`);
  }
  if (issues.length > 20) {
    console.log(`     ... 以及 ${issues.length - 20} 个类似问题`);
  }
}

// ─── 后端检查 ─────────────────────────────────────────

function checkBackend() {
  console.log('🔍 检查后端架构 ...');
  const modulesDir = path.join(BACKEND_SRC, 'modules');
  const coreDir = path.join(BACKEND_SRC, 'core');

  // 1. modules/ 下禁止直接 import models/database
  console.log('\n  1️⃣ modules/ 禁止直接 import 数据库 ...');
  const moduleFiles = getFiles(modulesDir);
  const dbImportViolations = [];

  for (const file of moduleFiles) {
    // 跳过测试文件、database 模块、repository 层引用
    if (file.includes('.test.') || file.includes('__tests__')) continue;
    const rel = path.relative(ROOT, file);
    if (rel.includes('modules\\database\\') || rel.includes('modules/database/')) continue;

    const content = readFileSafe(file);
    if (!content) continue;

    // 检查是否有 eslint-disable 注释
    const hasDisableDb = /eslint-disable.*no-restricted-imports/.test(content);

    // 检查是否直接 import db (排除注释)
    const importDb = content.split('\n').some((line) => {
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return false;
      return /from\s+['"].*models\/database['"]/.test(line);
    });

    if (importDb && !hasDisableDb) {
      const shortPath = path.relative(BACKEND_SRC, file);
      dbImportViolations.push(shortPath);
    }
  }
  logIssues('直接 import db（无 eslint-disable）', dbImportViolations);

  // 2. 24 模块结构完整性
  console.log('\n  2️⃣ 模块结构完整性 ...');
  const existingModules = fs.readdirSync(modulesDir).filter((d) => {
    const stat = fs.statSync(path.join(modulesDir, d));
    return stat.isDirectory();
  });
  const missingModules = BACKEND_MODULES.filter((m) => !existingModules.includes(m));
  const extraModules = existingModules.filter(
    (m) => !BACKEND_MODULES.includes(m) && m !== '_registry.ts' && !m.startsWith('_'),
  );

  if (missingModules.length > 0) {
    console.log(`  ❌ 缺少模块: ${missingModules.join(', ')}`);
    violations += missingModules.length;
  }
  if (extraModules.length > 0) {
    console.log(`  ⚠️  未知模块: ${extraModules.join(', ')}`);
    warnings += extraModules.length;
  }
  if (missingModules.length === 0 && extraModules.length === 0) {
    console.log(`  ✅ 24 个模块全部存在`);
  }

  // 3. 模块必需文件检查
  console.log('\n  3️⃣ 模块必需文件 ...');
  const incompleteModules = [];
  for (const mod of existingModules) {
    const modDir = path.join(modulesDir, mod);
    const hasRoutes =
      fs.existsSync(path.join(modDir, 'routes.ts')) ||
      fs.existsSync(path.join(modDir, 'routes.tsx'));
    const hasRoutesDir = fs.existsSync(path.join(modDir, 'routes'));
    const hasServices = fs.existsSync(path.join(modDir, 'services'));
    const hasIndex = fs.existsSync(path.join(modDir, 'index.ts'));
    const hasReadme = fs.existsSync(path.join(modDir, 'README.md'));

    const missing = [];
    if (!hasRoutes && !hasRoutesDir) missing.push('routes.ts');
    if (!hasServices) missing.push('services/');
    if (!hasIndex) missing.push('index.ts');
    if (!hasReadme) missing.push('README.md');

    if (missing.length > 0) {
      incompleteModules.push(`${mod}: 缺少 ${missing.join(', ')}`);
    }
  }
  if (incompleteModules.length > 0) {
    console.log(`  ❌ 模块结构不完整:`);
    incompleteModules.forEach((m) => console.log(`     ${m}`));
    violations += incompleteModules.length;
  } else {
    console.log(`  ✅ 所有模块结构完整`);
  }

  // 4. core/ 不得依赖 modules/
  console.log('\n  4️⃣ core/ 不得依赖 modules/ ...');
  const coreFiles = getFiles(coreDir);
  const coreModuleImports = [];

  for (const file of coreFiles) {
    const content = readFileSafe(file);
    if (!content) continue;

    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (/from\s+['"].*\/modules\//.test(line) || /require\s*\(['"].*\/modules\//.test(line)) {
        const shortPath = path.relative(BACKEND_SRC, file);
        coreModuleImports.push(`${shortPath}: ${line.trim()}`);
      }
    }
  }
  logIssues('core/ 依赖 modules/', coreModuleImports);

  if (coreModuleImports.length === 0) {
    console.log(`  ✅ core/ 无 modules/ 依赖`);
  }

  // 5. Modules 之间禁止跨模块 routes/ 依赖
  console.log('\n  5️⃣ 规则: modules-禁止跨模块路由依赖 ...');
  const crossRouteViolations = [];
  for (const file of moduleFiles) {
    const content = readFileSafe(file);
    if (!content) continue;

    const rel = path.relative(ROOT, file);
    const currentModule = rel.replace(/.*backend[\/\\]src[\/\\]modules[\/\\]([^/\\]+).*/, '$1');

    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      const match = line.match(/from\s+['"].*\/modules\/([^/\\]+)\/routes/);
      if (match && match[1] !== currentModule) {
        const shortPath = path.relative(BACKEND_SRC, file);
        crossRouteViolations.push(`${shortPath}: ${line.trim()}`);
      }
    }
  }
  logIssues('跨模块 routes/ 依赖', crossRouteViolations);

  if (crossRouteViolations.length === 0) {
    console.log(`  ✅ 无跨模块 routes/ 依赖`);
  }
}

// ─── 前端检查 ─────────────────────────────────────────

function checkFrontend() {
  console.log('\n🔍 检查前端架构 ...');
  const modulesDir = path.join(FRONTEND_SRC, 'modules');

  if (!fs.existsSync(modulesDir)) {
    console.log('  ⚠️  前端 modules/ 目录不存在，跳过检查');
    return;
  }

  // 1. 前端 23 模块结构（v2.5：前后端模块清单分离，linkage 后端独有）
  console.log('  1️⃣ 前端模块结构 ...');
  const existingModules = fs.readdirSync(modulesDir).filter((d) => {
    const stat = fs.statSync(path.join(modulesDir, d));
    return stat.isDirectory();
  });
  const missingModules = FRONTEND_MODULES.filter((m) => !existingModules.includes(m));
  const missing = missingModules.length;
  if (missing > 0) {
    console.log(`  ❌ 缺少模块: ${missingModules.join(', ')}`);
    violations += missing;
  } else {
    console.log(`  ✅ 23 个前端模块全部存在`);
  }

  // 2. 前端模块必需文件
  const moduleDirs = existingModules;
  const incompleteModules = [];
  for (const mod of moduleDirs) {
    const modDir = path.join(modulesDir, mod);
    const hasIndex = fs.existsSync(path.join(modDir, 'index.ts'));
    if (!hasIndex) incompleteModules.push(`${mod}: 缺少 index.ts`);
  }
  if (incompleteModules.length === 0) {
    console.log(`  ✅ 所有模块有 index.ts`);
  }
}

// ─── 主流程 ────────────────────────────────────────────

const target = process.argv[2] || 'all';

if (target === 'backend' || target === 'all') {
  checkBackend();
}
if (target === 'frontend' || target === 'all') {
  checkFrontend();
}

// ─── 总结 ────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
if (violations > 0) {
  console.log(`❌ 发现 ${violations} 个架构违规${warnings > 0 ? `, ${warnings} 个警告` : ''}`);
  // 只报错不退出的违规类型（业务 db imports 已有 lint 层拦截）
  const hasCriticalViolations = violations > 0;
  console.log(hasCriticalViolations ? '⚠️  请尽快修复以上违规，保持架构清洁。' : '✅ 无严重违规。');
  // 2026-07-21 修改：depcrise 在 Node 20 跑不起来，必须让本脚本真阻断（ADR-022 / v2 报告 §1）
  process.exit(hasCriticalViolations ? 1 : 0);
} else {
  console.log(`✅ 架构检查通过！无违规${warnings > 0 ? ` (${warnings} 个警告)` : ''}`);
  process.exit(0);
}
