# ITops Agent 测试编写规范

> 本文档定义后端和前端测试的编写规范。所有 AI 辅助开发工具在生成/修改测试代码时必须遵守本规则。

---

## 一、通用规范

### 1.1 测试框架

- **测试框架**: Vitest（`vitest run` 运行，`vitest` 监听模式）
- **后端环境**: `node`（`backend/vitest.config.ts`）
- **前端环境**: `jsdom`（`frontend/vitest.config.ts`）

### 1.2 运行命令

| 命令 | 后端 | 前端 |
|------|------|------|
| 运行全部测试 | `npx vitest run` | `npx vitest run` |
| 监听模式 | `npx vitest` | `npx vitest` |
| 覆盖率报告 | `npx vitest run --coverage` | `npx vitest run --coverage` |

### 1.3 文件命名

- 测试文件与源文件同级，命名为 `<name>.test.ts` 或 `<name>.test.tsx`
- 每个测试文件对应一个源文件
- 测试文件放在 `test/` 目录下仅适用于跨模块测试（如前端冒烟测试）

### 1.4 测试结构

```typescript
// 文件头注释（说明测试目标）
/**
 * <模块名> 测试
 *
 * 验证：
 *   - 功能点 1
 *   - 功能点 2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ... vi.mock ...

describe('被测模块', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('功能 A', () => {
    it('正常情况', () => { /* ... */ });
    it('边界情况', () => { /* ... */ });
    it('错误处理', () => { /* ... */ });
  });

  describe('功能 B', () => {
    it('正常情况', () => { /* ... */ });
  });
});
```

---

## 二、后端测试规范

### 2.1 数据库 Mock（Repository 测试）

使用 `vi.hoisted` + `vi.mock` 模式 mock SQLite 数据库：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. vi.hoisted 定义共享 mock 对象（必须在所有 import 之前）
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    prepare: vi.fn(() => ({
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
      get: vi.fn(() => undefined),
      all: vi.fn(() => []),
    })),
    exec: vi.fn(),
  };
  return { mockDb };
});

// 2. vi.mock 数据库模块（必须在 import 被测模块之前）
vi.mock('../../models/database', () => ({ default: mockDb }));

// 3. import 被测模块
import { myRepository } from './myRepository';

// 4. mock 其他传递依赖（logger 等）
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('myRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('插入数据并使用 datetime 默认值', () => {
      const runSpy = vi.fn();
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('INSERT INTO');
        expect(sql).toContain("datetime('now', 'localtime')");
        return { run: runSpy, get: vi.fn(), all: vi.fn() };
      });

      myRepository.create({ id: '1', name: 'test' });

      expect(runSpy).toHaveBeenCalledWith('1', 'test');
    });
  });
});
```

### 2.2 SQL 感知的 Mock（Service 层测试）

对于需要模拟多个表查询的服务层测试，根据 SQL 内容返回不同 mock 数据：

```typescript
function setupDb(opts: { workflow?: unknown; policy?: unknown } = {}) {
  mocks.prepare.mockImplementation((sql: string) => {
    if (sql.includes('FROM workflows')) {
      return { get: vi.fn(() => opts.workflow), all: vi.fn(() => []), run: vi.fn() };
    }
    if (sql.includes('FROM remediation_policies')) {
      return { get: vi.fn(() => opts.policy), all: vi.fn(() => []), run: vi.fn() };
    }
    return { get: vi.fn(() => undefined), all: vi.fn(() => []), run: vi.fn() };
  });
}
```

### 2.3 DI 容器 Mock（Service 层测试）

使用 `container.replace()` 替换已注册的服务：

```typescript
import { container } from '../core/serviceContainer';

it('可通过 container.replace() 注入 mock repository', () => {
  const mockRepo = {
    toolLinks: { list: vi.fn(() => []) },
    scripts: { list: vi.fn(() => []) },
  };
  container.replace('infraRepository', mockRepo);
  const result = container.get<typeof mockRepo>('infraRepository');
  expect(result).toBe(mockRepo);
});
```

### 2.4 后端测试重点

| 测试层 | 被测对象 | 断言重点 |
|--------|---------|---------|
| Repository | 数据访问方法 | SQL 语句正确性、参数传递、JSON 解析、返回值类型 |
| Service | 业务逻辑 | 业务流程正确性、状态机转换、跨模块调用、错误处理 |
| Route | HTTP 接口 | 状态码、响应格式、参数校验 |

---

## 三、前端测试规范

### 3.1 纯函数测试

使用 `await import()` 动态导入避免模块级依赖：

```typescript
import { describe, it, expect } from 'vitest';

describe('Password Validator', () => {
  it('should validate minimum length', async () => {
    const { validatePassword } = await import('../../utils/passwordValidator');
    const result = validatePassword('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.details.minLength).toBe(false);
  });

  it('should accept a valid password', async () => {
    const { validatePassword } = await import('../../utils/passwordValidator');
    const result = validatePassword('Abcdefg1!@');
    expect(result.valid).toBe(true);
  });
});
```

### 3.2 页面组件测试

使用 `renderWithProviders` 工具函数渲染组件：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils/renderWithProviders';

// 1. Mock API 模块
vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../../lib/api';
const apiGet = vi.mocked(api.get);

function success(data: unknown) {
  return Promise.resolve({ data: { data } });
}

describe('核心页面冒烟测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/api/virtual-machines')) {
        return Promise.resolve({ data: { data: [], total: 0, source: 'test' } });
      }
      if (url.includes('/api/agents')) return success([]);
      return success([]);
    });
  });

  it('渲染虚拟机管理页面', async () => {
    renderWithProviders(<VirtualMachines />);
    expect(await screen.findByText('虚拟机管理')).toBeInTheDocument();
  });
});
```

### 3.3 renderWithProviders 工具函数

```typescript
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { ToastProvider } from '../../contexts/ToastContext';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, initialEntries: string[] = ['/']) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ToastProvider>{ui}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
```

### 3.4 大型依赖 Mock

对于图表库、3D 引擎等大型依赖，使用组件 mock：

```typescript
// Mock React Flow（工作流编辑器）
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    ReactFlow: () => <div data-testid="react-flow" />,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Controls: () => <div data-testid="flow-controls" />,
    Background: () => <div data-testid="flow-background" />,
  };
});

// Mock 图表组件
vi.mock('../../modules/monitor/components/ParticleBackground', () => ({
  default: () => <div data-testid="particle-background" />,
}));
vi.mock('../../modules/monitor/components/AnimatedLineChart', () => ({
  default: () => <div data-testid="line-chart" />,
}));
```

### 3.5 前端测试重点

| 测试类型 | 被测对象 | 断言重点 |
|---------|---------|---------|
| 纯函数 | 工具函数/验证器 | 输入输出正确性、边界条件 |
| API 模块 | axios 封装 | 实例创建、超时配置、拦截器 |
| 页面组件 | React 渲染 | 文案存在性、异步数据加载、空状态/错误状态 |
| 路由 | 路由配置 | 路径正确性、懒加载 |

---

## 四、测试编写原则

### 4.1 必须测试

- ✅ Repository 层：每个方法的 SQL 语句正确性
- ✅ Service 层：核心业务流程、状态机转换、错误处理
- ✅ 纯函数/工具函数：输入输出正确性
- ✅ 关键页面：冒烟测试（能渲染不崩溃）

### 4.2 不必测试

- ❌ 简单的 getter/setter
- ❌ 纯配置/常量文件
- ❌ 第三方库的内部实现
- ❌ Migration 文件（数据库迁移脚本）
- ❌ `.d.ts` 类型声明文件

### 4.3 命名规范

```typescript
// ✅ 正确的测试命名
it('插入数据并使用 datetime 默认值', () => {});
it('should validate minimum length', async () => {});
it('渲染虚拟机管理页面', async () => {});

// ❌ 错误的测试命名
it('test1', () => {});
it('works', () => {});
```

### 4.4 隔离原则

- 每个 `it` 测试用例必须独立，不依赖其他测试的执行顺序
- `beforeEach` 中统一调用 `vi.clearAllMocks()` 保证测试隔离
- 不要在测试之间共享可变状态

---

## 五、禁止事项

1. ❌ 禁止在测试中连接真实数据库（必须 mock）
2. ❌ 禁止在测试中发送真实 HTTP 请求（必须 mock）
3. ❌ 禁止测试之间共享可变状态
4. ❌ 禁止使用 `any` 类型的 mock 对象
5. ❌ 禁止跳过测试而不加注释说明原因（`it.skip` 需要注释）
6. ❌ 禁止在测试中使用 `setTimeout` 等待（使用 `waitFor` 或 `vi.advanceTimersByTime`）
7. ❌ 禁止创建超过 300 行的测试文件（应拆分）