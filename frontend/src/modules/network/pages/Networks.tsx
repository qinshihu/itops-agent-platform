/**
 * Networks 主入口（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 Networks.tsx 599 行（workspace ≈ git HEAD）包含：
 *   - 3 interface + 5 const map
 *   - 7+ 14 useState 散布
 *   - 2 query + 4 mutation
 *   - 5+ handler
 *   - 3 view：selectedSubnet 详情 / 网段列表 / 空状态 + 2 modal
 *
 * 拆分后行为：10 个子模块按职责分离 + 主入口仅编排 ~95 行
 *   - types.ts                  — SubnetInfo + IpInfo + IpListData + 4 map (80)
 *   - useNetworksData.ts        — 7 state + 2 query + 4 mutation + 6 handler (270)
 *   - SubnetStatsCards.tsx      — 3 统计卡片 (45)
 *   - SubnetSearchFilter.tsx    — 搜索 + 类型过滤 (40)
 *   - SubnetListHeader.tsx      — 网段列表标题 + 刷新 + 新建 (35)
 *   - SubnetCard.tsx            — 单个子网卡 (115)
 *   - SubnetCreateModal.tsx     — 创建/编辑子网 modal (155)
 *   - SubnetDetailView.tsx      — selected subnet 详情 (含 IP 列表) (125)
 *   - IpListTable.tsx           — IP 列表 table (105)
 *   - index.ts                  — barrel (30)
 *
 * 桶兼容：原 `lazy(() => import('./pages/Networks'))` 仍可用
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

import { Globe } from 'lucide-react';
import { useNetworksData } from './networks/useNetworksData';
import { SubnetStatsCards } from './networks/SubnetStatsCards';
import { SubnetSearchFilter } from './networks/SubnetSearchFilter';
import { SubnetListHeader } from './networks/SubnetListHeader';
import { SubnetCard } from './networks/SubnetCard';
import { SubnetCreateModal } from './networks/SubnetCreateModal';
import { SubnetDetailView } from './networks/SubnetDetailView';
import type { SubnetInfo } from './networks/types';

export default function Networks() {
  const data = useNetworksData();

  // ── 派生：过滤后的子网 ──
  const filteredSubnets = data.subnets.filter((s) => {
    if (data.typeFilter && s.network_type !== data.typeFilter) return false;
    if (data.searchTerm) {
      const q = data.searchTerm.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.cidr.includes(q) ||
        (s.location || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── 派生：统计 ──
  const totalSubnets = data.subnets.length;
  const totalIps = data.subnets.reduce((sum, s) => sum + s.total_ips, 0);
  const usedIps = data.subnets.reduce((sum, s) => sum + s.used_ips, 0);

  // ── 详情视图 ──
  if (data.selectedSubnet) {
    return (
      <SubnetDetailView
        subnet={data.selectedSubnet}
        ipData={data.ipData}
        isLoadingIps={data.isLoadingIps}
        ipSearch={data.ipSearch}
        setIpSearch={data.setIpSearch}
        ipStatusFilter={data.ipStatusFilter}
        setIpStatusFilter={data.setIpStatusFilter}
        selectedIps={data.selectedIps}
        setSelectedIps={data.setSelectedIps}
        onBatchAction={data.handleBatchAction}
        onBack={() => {
          data.setSelectedSubnet(null);
          data.setSelectedIps(new Set());
        }}
      />
    );
  }

  // ── 列表视图 ──
  return (
    <div className="p-6 space-y-5">
      <SubnetListHeader onRefresh={data.refetch} onAdd={data.openCreateModal} />

      <SubnetStatsCards
        totalSubnets={totalSubnets}
        totalIps={totalIps}
        usedIps={usedIps}
      />

      <SubnetSearchFilter
        searchTerm={data.searchTerm}
        setSearchTerm={data.setSearchTerm}
        typeFilter={data.typeFilter}
        setTypeFilter={data.setTypeFilter}
      />

      {data.isLoadingSubnets ? (
        <div className="text-center py-16 text-text-tertiary">加载中...</div>
      ) : filteredSubnets.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <Globe size={48} className="text-text-tertiary mb-4" />
          <p className="text-text-secondary text-sm">暂无子网，点击"新建子网"开始规划</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubnets.map((s) => (
            <SubnetCard
              key={s.id}
              subnet={s}
              onSelect={(sub: SubnetInfo) => data.setSelectedSubnet(sub)}
              onEdit={data.handleEditSubnet}
              onDelete={(sub) => data.handleDeleteSubnet(sub.id)}
            />
          ))}
        </div>
      )}

      <SubnetCreateModal
        isOpen={data.subnetModal}
        editingSubnet={data.editingSubnet}
        form={data.subnetForm}
        setForm={data.setSubnetForm}
        isSubmitting={data.isCreating || data.isUpdating}
        onClose={data.closeSubnetModal}
        onSubmit={data.handleSubmitSubnet}
      />
    </div>
  );
}
