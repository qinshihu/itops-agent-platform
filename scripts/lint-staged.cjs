/**
 * lint-staged 辅助脚本 - 对暂存文件运行 ESLint + Prettier
 * 用法: node scripts/lint-staged.cjs <backend|frontend> <file1> <file2> ...
 */
const path = require('path');

const cwd = process.argv[2]; // 'backend' or 'frontend'
const files = process.argv.slice(3);

if (!cwd || files.length === 0) {
  process.exit(0);
}

async function main() {
  const absCwd = path.resolve(cwd);

  const originalCwd = process.cwd();
  process.chdir(absCwd);

  try {
    const { ESLint } = require(path.join(absCwd, 'node_modules', 'eslint'));
    const prettier = require(path.join(absCwd, 'node_modules', 'prettier'));
    const fs = require('fs');

    const eslint = new ESLint({
      fix: true,
      errorOnUnmatchedPattern: false,
    });

    // 将根目录相对路径转换为子目录相对路径（兼容 Windows 的 / 和 \ 分隔符）
    const relativeFiles = files
      .map(f => {
        // 先标准化为正斜杠
        const normalized = f.replace(/\\/g, '/');
        const prefix = cwd + '/';
        if (normalized.startsWith(prefix)) return normalized.slice(prefix.length);
        return normalized;
      })
      .filter(f => f);

    if (relativeFiles.length === 0) {
      return;
    }

    // Step 1: Prettier 格式化
    console.log(`\nRunning Prettier on ${relativeFiles.length} file(s)...`);
    for (const file of relativeFiles) {
      try {
        const filePath = path.join(absCwd, file);
        const source = fs.readFileSync(filePath, 'utf8');
        const config = await prettier.resolveConfig(filePath);
        const formatted = await prettier.format(source, {
          ...config,
          filepath: filePath,
        });
        if (formatted !== source) {
          fs.writeFileSync(filePath, formatted, 'utf8');
          console.log(`  ✨ ${file}`);
        }
      } catch (err) {
        console.warn(`  ⚠️  Prettier skipped ${file}: ${err.message}`);
      }
    }

    // Step 2: ESLint 检查 + 修复
    console.log(`\nRunning ESLint on ${relativeFiles.length} file(s)...`);
    const results = await eslint.lintFiles(relativeFiles);
    await ESLint.outputFixes(results);

    const formatter = await eslint.loadFormatter('stylish');
    const resultText = formatter.format(results);

    if (resultText) {
      console.log(resultText);
    }

    const hasErrors = results.some(r => r.errorCount > 0);
    if (hasErrors) {
      console.error(`\n❌ ${cwd} code check failed! Fix the errors above before committing.`);
      process.exitCode = 1;
    } else {
      console.log(`✅ ${cwd} lint passed.`);
    }
  } finally {
    process.chdir(originalCwd);
  }
}

main().catch(err => {
  console.error('lint-staged script error:', err.message);
  process.exit(1);
});