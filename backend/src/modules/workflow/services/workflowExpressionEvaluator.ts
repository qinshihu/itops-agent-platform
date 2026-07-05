/**
 * 表达式求值器
 * 支持变量替换、简单比较、正则匹配、JavaScript 表达式
 */

import { logger } from '../../../utils/logger';

/** 工作流变量值类型：基础类型 + 嵌套对象 */
type WorkflowVariableValue = string | number | boolean | null | object;

/** 工作流变量映射：动态键值对，值可以是基础类型或嵌套对象 */
export type WorkflowVariables = Record<string, WorkflowVariableValue>;

/**
 * 解析模板字符串中的 {{variable}} 占位符并替换为实际值
 */
export function resolveExpression(expr: string, variables: WorkflowVariables): string {
  if (!expr) return '';
  return expr.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = getNestedValue(variables, trimmedKey);
    return value !== undefined ? String(value) : match;
  });
}

/**
 * 获取嵌套对象值，支持 dot notation: "node1.output.status"
 */
export function getNestedValue(obj: WorkflowVariables, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as WorkflowVariables)[part];
  }
  return current;
}

/**
 * 设置嵌套对象值
 */
export function setNestedValue(obj: WorkflowVariables, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: WorkflowVariables = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as WorkflowVariables;
  }
  (current as Record<string, unknown>)[parts[parts.length - 1]] = value;
}

/**
 * 求值条件表达式，返回布尔值
 */
export function evaluateExpression(
  expression: string,
  variables: WorkflowVariables,
  type: 'javascript' | 'simple_compare' | 'regex_match' | 'json_path' = 'simple_compare'
): boolean {
  // 先解析模板变量
  const resolvedExpr = resolveExpression(expression, variables);

  try {
    switch (type) {
      case 'simple_compare':
        return evaluateSimpleCompare(resolvedExpr, variables);
      case 'regex_match':
        return evaluateRegex(resolvedExpr, variables);
      case 'json_path':
        return evaluateJsonPath(resolvedExpr, variables);
      case 'javascript':
        return evaluateJavaScript(expression, variables);
      default:
        return evaluateSimpleCompare(resolvedExpr, variables);
    }
  } catch (error) {
    logger.error('Expression evaluation failed:', { expression, type, error });
    return false;
  }
}

/**
 * 简单比较: "value == 'xxx'", "value != 'xxx'", "value > 10", "value", "!value"
 */
function evaluateSimpleCompare(resolvedExpr: string, variables: WorkflowVariables): boolean {
  const expr = resolvedExpr.trim();

  // 布尔检查: "!value" → 取反
  if (expr.startsWith('!') && !expr.includes('!=')) {
    const varName = expr.slice(1).trim();
    const val = variables[varName];
    return !val;
  }

  // 比较操作符
  const operators = ['===', '!==', '==', '!=', '>=', '<=', '>', '<', ' contains ', ' startsWith ', ' endsWith '];
  for (const op of operators) {
    const idx = expr.indexOf(op);
    if (idx !== -1) {
      const leftStr = expr.substring(0, idx).trim();
      const rightStr = expr.substring(idx + op.length).trim();

      // 解析左值
      const left = parseValue(leftStr, variables);
      // 解析右值（去掉引号）
      const right = parseLiteral(rightStr);

      const trimmedOp = op.trim();
      switch (trimmedOp) {
        case '===': return left === right;
        // eslint-disable-next-line eqeqeq
        case '==': return left == right;
        case '!==': return left !== right;
        // eslint-disable-next-line eqeqeq
        case '!=': return left != right;
        case '>': return Number(left) > Number(right);
        case '<': return Number(left) < Number(right);
        case '>=': return Number(left) >= Number(right);
        case '<=': return Number(left) <= Number(right);
        case 'contains': return String(left).includes(String(right));
        case 'startsWith': return String(left).startsWith(String(right));
        case 'endsWith': return String(left).endsWith(String(right));
      }
    }
  }

  // 真值检查: "value" → 是否为 truthy
  const val = parseValue(expr, variables);
  return !!val;
}

/**
 * 正则匹配: "pattern" 对变量值进行正则测试
 */
function evaluateRegex(resolvedExpr: string, variables: WorkflowVariables): boolean {
  // 期望格式: "variable =~ /pattern/" 或已解析的 "value =~ /pattern/"
  const match = resolvedExpr.match(/^(.+?)\s*=~\s*\/(.+?)\/([gimsuy]*)$/);
  if (match) {
    const [, valueStr, pattern, flags] = match;
    const value = String(parseValue(valueStr.trim(), variables));
    return new RegExp(pattern, flags).test(value);
  }
  // 退化为在变量值中搜索该字符串
  const resolvedLower = resolvedExpr.toLowerCase();
  for (const [, val] of Object.entries(variables)) {
    if (String(val).toLowerCase().includes(resolvedLower)) {
      return true;
    }
  }
  return false;
}

/**
 * JSON Path 检查: 检查路径是否存在且为真值
 */
function evaluateJsonPath(resolvedExpr: string, variables: WorkflowVariables): boolean {
  const value = getNestedValue(variables, resolvedExpr.trim());
  return value !== undefined && value !== null && value !== '' && value !== false;
}

/**
 * JavaScript 表达式求值（沙箱环境）
 */
function evaluateJavaScript(expression: string, variables: WorkflowVariables): boolean {
  // 解析模板变量
  const resolved = resolveExpression(expression, variables);
  // 构造一个带变量的函数
  const varNames = Object.keys(variables);
  const varValues = Object.values(variables);
  try {
    const fn = new Function(...varNames, `"use strict"; return Boolean(${resolved});`);
    return fn(...varValues);
  } catch {
    // 退化为简单比较
    return evaluateSimpleCompare(resolved, variables);
  }
}

/**
 * 解析值为实际类型
 */
function parseValue(str: string, variables: WorkflowVariables): unknown {
  const trimmed = str.trim();
  // 字符串字面量（带引号）
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  // 数字
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  // 布尔
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  // 变量引用
  if (trimmed in variables) {
    return variables[trimmed];
  }
  // 嵌套路径
  const nested = getNestedValue(variables, trimmed);
  if (nested !== undefined) return nested;
  // 返回原始字符串
  return trimmed;
}

/**
 * 解析字面量值
 */
function parseLiteral(str: string): unknown {
  const trimmed = str.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  return trimmed;
}
