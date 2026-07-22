/**
 * DbConnections 主入口（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 DbConnections.tsx 587 行（workspace ≈ git HEAD）包含：
 *   - 1 interface
 *   - 7 useState
 *   - 1 query + 4 mutation
 *   - 5 handler
 *   - 主 page：header + 统计卡片 + 搜索 + card 网格 + form modal + delete modal
 *
 * 拆分后行为：8 个子模块按职责分离 + 主入口仅编排 ~80 行
 *   - types.ts                  — DbConnection + FormData + Payload + DB_TYPE_COLORS (60)
 *   - useDbConnectionsData.ts   — 7 state + 1 query + 4 mutation + 6 handler (220)
 *   - DbConnectionsHeader.tsx   — header + 4 统计卡 + 搜索 (140)
 *   - DbConnectionCard.tsx      — 单连接卡（含类型 color + 操作）(90)
 *   - DbConnectionFormModal.tsx — 创建/编辑 modal + 测试 (165)
 *   - DeleteDbConnectionModal.tsx — 删除确认 (50)
 *   - index.ts                  — barrel (15)
 *
 * 桶兼容：原 `lazy(() => import('./pages/DbConnections'))` 仍可用
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

import { Database } from 'lucide-react';
import { useDbConnectionsData } from './db-connections/useDbConnectionsData';
import { DbConnectionsHeader } from './db-connections/DbConnectionsHeader';
import { DbConnectionCard } from './db-connections/DbConnectionCard';
import { DbConnectionFormModal } from './db-connections/DbConnectionFormModal';
import { DeleteDbConnectionModal } from './db-connections/DeleteDbConnectionModal';

export default function DbConnections() {
  const data = useDbConnectionsData();

  return (
    <div className="h-full overflow-auto p-6 scrollbar-thin">
      <div className="space-y-6">
        <DbConnectionsHeader
          connections={data.connections}
          searchQuery={data.searchQuery}
          setSearchQuery={data.setSearchQuery}
          onAddNew={data.handleAddNew}
        />

        {data.isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
          </div>
        ) : data.filtered.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>暂无数据库连接</p>
            <p className="text-sm mt-1">点击上方"添加连接"按钮创建</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.filtered.map((conn) => (
              <DbConnectionCard
                key={conn.id}
                connection={conn}
                onEdit={data.handleEdit}
                onDelete={data.handleDelete}
              />
            ))}
          </div>
        )}

        <DbConnectionFormModal
          isOpen={data.isModalOpen}
          editingConn={data.editingConn}
          form={data.formData}
          setForm={data.setFormData}
          showPassword={data.showPassword}
          setShowPassword={data.setShowPassword}
          isSubmitting={data.isCreating || data.isUpdating}
          isTesting={data.isTesting}
          onClose={() => {
            data.setIsModalOpen(false);
          }}
          onSubmit={data.handleSubmit}
          onTest={data.handleTestConnection}
        />

        <DeleteDbConnectionModal
          pendingDelete={data.pendingDelete}
          onClose={() => {
            data.setShowDeleteConfirm(false);
          }}
          onConfirm={data.confirmDelete}
          isPending={data.isDeleting}
        />
      </div>
    </div>
  );
}
