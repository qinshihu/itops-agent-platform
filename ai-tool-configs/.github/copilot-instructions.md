# GitHub Copilot Instructions

> **本项目 AI 协作的完整规则集中在 [AGENTS.md](../AGENTS.md)。**
>
> 本文件**只**包含 GitHub Copilot 特有的简短提示。

---

## Working in this project

1. **First**: Read [AGENTS.md](../AGENTS.md) — contains 5 iron rules and naming conventions
2. **Architecture**: 4A layers + DDD modules. See [architecture.md](../.trae/rules/architecture.md)
3. **Frontend**: 23 modules. See [frontend.md](../.trae/rules/frontend.md)
4. **Top rules**: [top-rules.md](../.trae/rules/top-rules.md) — required reporting, code locations

## Layering (most important)

```
core/  →  modules/  →  routes/      ← one-way only
```

- ❌ Routes must NOT directly import `repositories/` — use `services/` layer (ADR-016)
- ❌ `core/` must NOT import `modules/`
- ❌ Don't write business logic in `routes/` handlers — write to `services/`

## File size

- New files must be **≤500 lines** (excluding comments/blanks)
- If you generate a >500 line file, split it into a subdirectory (see [tool/SchemaTable.tsx](../frontend/src/modules/ai/pages/agents/tool/SchemaTable.tsx) for the pattern)

## Naming

| Type | Convention | Example |
|---|---|---|
| Variables/functions | camelCase | `agentToolRegistry` |
| Classes/interfaces | PascalCase | `AgentTool` |
| Constants | UPPER_SNAKE | `MCP_RATE_LIMIT_PER_MINUTE` |
| Database tables/columns | snake_case | `audit_logs.user_id` |
| HTTP paths | kebab-case | `/api/v1/agents/tools` |

## Forbidden

- `any` type — use `unknown` or specific types
- `process.env.X` — write to `settings` table, manage via `/settings` page
- Direct `axios` calls in frontend — use `import api from '@/lib/api'`
- `localStorage.getItem('token')` — use `useAuth()` hook
- Modifying existing migrations — create a new `v0XX_*.ts`

## Module map

24 backend modules / 23 frontend modules. See [architecture.md §1.2](../.trae/rules/architecture.md) §1.2 for the full list. When changing module count, update THREE places: `.trae/rules/`, `.trae/documents/`, `.trae/adr/README.md`.

## Verification after changes

```bash
# Backend
cd backend && npx tsc --noEmit && npm run lint

# Frontend
cd frontend && npx tsc --noEmit && npm run lint

# Architecture check
npx depcruise --config .dependency-cruiser.json backend/src
```

## Reports

- New reports → `docs/<name>.md`
- Architecture decisions → `.trae/adr/NNN-<slug>.md`

---

**Full rules**: [AGENTS.md](../AGENTS.md)
**Last updated**: 2026-07-21