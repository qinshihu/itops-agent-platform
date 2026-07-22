/**
 * 自定义 ESLint 规则（2026-07-21 P1-#17）
 *
 * 规则名：no-restricted-eslint-disable
 *
 * 为什么：
 *   v2 报告 §9.2 #17 项"禁止 /* eslint-disable *\/ 绕过 no-restricted-imports"。
 *   ESLint 内置规则不能用注释触发器（comment 触发器在 ESLint 8+ 已弃用）。
 *   所以写自定义 rule，专门检测 `eslint-disable-next-line no-restricted-imports` 注释。
 *
 * 用法：
 *   .eslintrc.json 添加：
 *     "plugins": ["local-rules"],
 *     "rules": { "local-rules/no-restricted-eslint-disable": "error" }
 *   plugins: ['local-rules'] 配置 @eslint/eslintrc 加载路径，文件写：
 *     node_modules/eslint-plugin-local-rules/index.js
 *   或在 .eslintrc.json 用 `eslint-plugin-local-rules` 入口
 *
 * 实现：
 *   扫描 Program.comments，匹配 `^\s*eslint-disable(-next-line)?\s+no-restricted-imports`
 *   如果命中，调用 context.report
 *
 * 关联：
 *   - v2 报告 §9.2 #17 P1 项：ESLint max-lines 升 error + 禁 eslint-disable 绕过
 *   - ADR-024 §五未做事项
 */

'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止使用 /* eslint-disable */ 或 // eslint-disable-next-line 绕过 no-restricted-imports 规则',
      category: 'Best Practices',
      recommended: false,
    },
    messages: {
      forbidden:
        '禁止用 `eslint-disable` 注释绕过 `no-restricted-imports`。' +
        '违反时应该修复代码（如使用 repository 模式）而不是禁用规则。',
    },
    schema: [{
      type: 'object',
      properties: {
        allowAppEntry: { type: 'boolean' },
      },
      additionalProperties: false,
    }],
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();
    const options = context.options[0] || {};
    return {
      Program(node) {
        const comments = sourceCode.getAllComments
          ? sourceCode.getAllComments()
          : node.comments || [];

        for (const comment of comments) {
          const text = comment.value;
          // 匹配：  " eslint-disable [no-restricted-imports, ...]"
          //       或 " eslint-disable-next-line no-restricted-imports ..."
          //       或 " eslint-disable-line no-restricted-imports ..."
          const match = text.match(
            /^\s*eslint-disable(?:-next-line|-line)?\s+([^,\s]+(?:\s*,\s*[^,\s]+)*)/,
          );
          if (!match) continue;
          const ruleNames = match[1]
            .split(/\s*,\s*/)
            .map((s) => s.trim());
          if (!ruleNames.includes('no-restricted-imports')) continue;

          // 选项 1: 允许 app entry (默认 false，仅当 allowAppEntry=true 时豁免)
          // 选项 2: 允许 test 文件 (.test.ts)
          if (options.allowAppEntry && /--\s*app entry/i.test(text)) {
            continue;
          }
          if (/\.test\.ts$/i.test(context.filename) && /test file/i.test(text)) {
            continue;
          }

          context.report({
            node: comment,
            messageId: 'forbidden',
          });
        }
      },
    };
  },
};
