'use strict';

/**
 * ITops Agent 自定义 ESLint 规则集合（2026-07-21 P1-#17）
 *
 * 当前规则：
 *   - no-restricted-eslint-disable：禁止用 /* eslint-disable *\/ 绕过 no-restricted-imports
 *
 * 关联：
 *   - v2 报告 §9.2 #17 P1 项
 *   - ADR-024 §五未做事项
 */

module.exports = {
  rules: {
    'no-restricted-eslint-disable': require('../eslint-local-rules/no-restricted-eslint-disable'),
  },
};
