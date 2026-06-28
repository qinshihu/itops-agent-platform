import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Network, Plus, Trash2, Search, RefreshCw, Edit, Globe,
  Router, MapPin, Layers, ArrowLeft, Check, X, AlertCircle,
  MoreHorizontal, Upload,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';

// ==================== 类型定义 ====================
interface SubnetInfo {
  id: string;
  name: string;
  cidr: string;
  gateway: string | null;
  vlan_id: number | null;
  network_type: string;
  location: string | null;
  description: string | null;
  status: string;
  total_ips: number;
  used_ips: number;
  created_at: string;
}

interface IpInfo {
  id: string;
  subnet_id: string;
  ip_address: string;
  status: 'available' | 'used' | 'reserved';
  device_id: string | null;
  device_name: string | null;
  mac_address: string | null;
  description: string | null;
}

interface IpListData {
  ips: IpInfo[];
  stats: Array<{ status: string; count: number }>;
  total: number;
}

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  lan: { label: 'LAN', color: 'text-blue-400 bg-blue-500/10' },
  wan: { label: 'WAN', color: 'text-orange-400 bg-orange-500/10' },
  dmz: { label: 'DMZ', color: 'text-red-400 bg-red-500/10' },
  mgmt: { label: '管理', color: 'text-purple-400 bg-purple-500/10' },
  storage: { label: '存储', color: 'text-cyan-400 bg-cyan-500/10' },
  other: { label: '其他', color: 'text-text-tertiary bg-surface' },
};

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active: { label: '使用中', className: 'bg-green-500/10 text-green-400' },
  reserved: { label: '已预留', className: 'bg-yellow-500/10 text-yellow-400' },
  deprecated: { label: '已废弃', className: 'bg-red-500/10 text-red-400' },
};

const IP_STATUS_MAP: Record<string, { label: string; className: string }> = {
  available: { label: '可用', className: 'bg-green-500/10 text-green-400' },
  used: { label: '已用', className: 'bg-blue-500/10 text-blue-400' },
  reserved: { label: '预留', className: 'bg-yellow-500/10 text-yellow-400' },
};

// ==================== 组件 ====================
export default function Networks() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // 状态
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedSubnet, setSelectedSubnet] = useState<SubnetInfo | null>(null);
  const [ipSearch, setIpSearch] = useState('');
  const [ipStatusFilter, setIpStatusFilter] = useState('');

  // 弹窗状态
  const [subnetModal, setSubnetModal] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<SubnetInfo | null>(null);
  const [subnetName, setSubnetName] = useState('');
  const [subnetCidr, setSubnetCidr] = useState('');
  const [subnetGateway, setSubnetGateway] = useState('');
  const [subnetVlan, setSubnetVlan] = useState('');
  const [subnetType, setSubnetType] = useState('lan');
  const [subnetLocation, setSubnetLocation] = useState('');
  const [subnetDesc, setSubnetDesc] = useState('');

  // 所选IP
  const [selectedIps, setSelectedIps] = useState<Set<string>>(new Set());
  const [ipActionModal, setIpActionModal] = useState<'use' | 'reserve' | 'release' | null>(null);

  // ==================== 获取子网 ====================
  const { data: subnets = [], isLoading } = useQuery<SubnetInfo[]>({
    queryKey: ['network-subnets'],
    queryFn: async () => {
      const res = await api.get('/api/network-subnets');
      return res.data.data as SubnetInfo[];
    },
    refetchInterval: 30000,
  });

  // ==================== 获取子网 IP ====================
  const { data: ipData, isLoading: ipsLoading } = useQuery<IpListData>({
    queryKey: ['network-subnet-ips', selectedSubnet?.id, ipStatusFilter, ipSearch],
    queryFn: async () => {
      const res = await api.get(`/api/network-subnets/${selectedSubnet!.id}/ips`, {
        params: { status: ipStatusFilter || undefined, search: ipSearch || undefined, pageSize: 500 },
      });
      return res.data.data as IpListData;
    },
    enabled: !!selectedSubnet,
  });

  // ==================== 创建子网 ====================
  const createMutation = useMutation({
    mutationFn: async () => {
      return api.post('/api/network-subnets', {
        name: subnetName, cidr: subnetCidr, gateway: subnetGateway || undefined,
        vlan_id: subnetVlan ? parseInt(subnetVlan) : undefined, network_type: subnetType,
        location: subnetLocation || undefined, description: subnetDesc || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-subnets'] });
      toast.success('子网已创建');
      closeSubnetModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || '创建失败'),
  });

  // ==================== 更新子网 ====================
  const updateMutation = useMutation({
    mutationFn: async () => {
      return api.put(`/api/network-subnets/${editingSubnet!.id}`, {
        name: subnetName, gateway: subnetGateway || null, vlan_id: subnetVlan ? parseInt(subnetVlan) : null,
        network_type: subnetType, location: subnetLocation || null, description: subnetDesc || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-subnets'] });
      toast.success('子网已更新');
      closeSubnetModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || '更新失败'),
  });

  // ==================== 删除子网 ====================
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/network-subnets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-subnets'] });
      toast.success('子网已删除');
    },
    onError: () => toast.error('删除失败'),
  });

  // ==================== 批量操作IP ====================
  const batchIpMutation = useMutation({
    mutationFn: async (status: string) => {
      return api.post(`/api/network-subnets/${selectedSubnet!.id}/ips/batch`, {
        ip_ids: Array.from(selectedIps),
        status,
        device_name: status === 'used' ? '手动分配' : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-subnet-ips', selectedSubnet?.id] });
      queryClient.invalidateQueries({ queryKey: ['network-subnets'] });
      toast.success('操作成功');
      setSelectedIps(new Set());
      setIpActionModal(null);
    },
    onError: () => toast.error('操作失败'),
  });

  // ==================== 打开编辑弹窗 ====================
  const openEditModal = (s: SubnetInfo) => {
    setEditingSubnet(s);
    setSubnetName(s.name);
    setSubnetCidr(s.cidr);
    setSubnetGateway(s.gateway || '');
    setSubnetVlan(s.vlan_id?.toString() || '');
    setSubnetType(s.network_type || 'lan');
    setSubnetLocation(s.location || '');
    setSubnetDesc(s.description || '');
    setSubnetModal(true);
  };

  const closeSubnetModal = () => {
    setSubnetModal(false);
    setEditingSubnet(null);
    setSubnetName('');
    setSubnetCidr('');
    setSubnetGateway('');
    setSubnetVlan('');
    setSubnetType('lan');
    setSubnetLocation('');
    setSubnetDesc('');
  };

  // ==================== 过滤 ====================
  const filteredSubnets = subnets.filter(s => {
    if (typeFilter && s.network_type !== typeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.cidr.includes(q) ||
        (s.location || '').toLowerCase().includes(q);
    }
    return true;
  });

  // 统计
  const totalSubnets = subnets.length;
  const totalIps = subnets.reduce((sum, s) => sum + s.total_ips, 0);
  const usedIps = subnets.reduce((sum, s) => sum + s.used_ips, 0);

  // ==================== IP 详情视图 ====================
  if (selectedSubnet) {
    const ips = ipData?.ips || [];
    const stats = ipData?.stats || [];

    return (
      <div className="p-6 space-y-5">
        {/* 返回 */}
        <button
          onClick={() => { setSelectedSubnet(null); setSelectedIps(new Set()); }}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} /> 返回子网列表
        </button>

        {/* 子网信息 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary font-mono">{selectedSubnet.cidr}</h1>
            <p className="text-text-secondary text-sm mt-0.5">{selectedSubnet.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIps.size > 0 && (
              <>
                <button onClick={() => setIpActionModal('use')}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors">
                  标记为已用
                </button>
                <button onClick={() => setIpActionModal('reserve')}
                  className="px-3 py-1.5 text-xs font-medium bg-yellow-500/10 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-colors">
                  标记为预留
                </button>
                <button onClick={() => setIpActionModal('release')}
                  className="px-3 py-1.5 text-xs font-medium bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors">
                  释放
                </button>
              </>
            )}
          </div>
        </div>

        {/* IP 统计 */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map(s => (
            <div key={s.status} className={clsx(
              'bg-card border border-border rounded-lg p-3 text-center cursor-pointer transition-all',
              ipStatusFilter === s.status ? 'ring-2 ring-primary/50' : 'hover:border-primary/30',
            )}
              onClick={() => setIpStatusFilter(ipStatusFilter === s.status ? '' : s.status)}
            >
              <p className={clsx('text-xs mb-1', IP_STATUS_MAP[s.status]?.className)}>
                {IP_STATUS_MAP[s.status]?.label || s.status}
              </p>
              <p className="text-lg font-bold text-text-primary">{s.count}</p>
            </div>
          ))}
        </div>

        {/* 搜索 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text" placeholder="搜索IP、设备名、MAC..."
              value={ipSearch} onChange={(e) => setIpSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* IP 列表 */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-surface border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary w-10">
                    <input type="checkbox"
                      checked={ips.length > 0 && selectedIps.size === ips.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIps(new Set(ips.map(ip => ip.id)));
                        else setSelectedIps(new Set());
                      }}
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">IP 地址</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">状态</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">设备</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">MAC</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {ipsLoading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-text-tertiary">加载中...</td></tr>
                ) : ips.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-text-tertiary">无 IP 数据</td></tr>
                ) : ips.map(ip => {
                  const isSelected = selectedIps.has(ip.id);
                  return (
                    <tr key={ip.id}
                      className={clsx(
                        'hover:bg-surface/50 transition-colors cursor-pointer',
                        isSelected && 'bg-primary/5',
                      )}
                      onClick={() => {
                        const next = new Set(selectedIps);
                        if (next.has(ip.id)) next.delete(ip.id);
                        else next.add(ip.id);
                        setSelectedIps(next);
                      }}
                    >
                      <td className="px-4 py-2">
                        <input type="checkbox" checked={isSelected} readOnly className="pointer-events-none" />
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-text-primary">{ip.ip_address}</td>
                      <td className="px-4 py-2">
                        <span className={clsx(
                          'inline-block px-2 py-0.5 rounded text-xs font-medium',
                          IP_STATUS_MAP[ip.status]?.className,
                        )}>
                          {IP_STATUS_MAP[ip.status]?.label || ip.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-text-secondary">{ip.device_name || '-'}</td>
                      <td className="px-4 py-2 text-sm font-mono text-text-tertiary">{ip.mac_address || '-'}</td>
                      <td className="px-4 py-2 text-sm text-text-tertiary">{ip.description || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* IP 批量操作确认 */}
        {ipActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIpActionModal(null)} />
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <AlertCircle size={20} className="text-yellow-400" />
                <h3 className="text-lg font-semibold text-text-primary">确认操作</h3>
              </div>
              <p className="text-text-secondary text-sm">
                {ipActionModal === 'use' && `将 ${selectedIps.size} 个IP标记为"已用"？`}
                {ipActionModal === 'reserve' && `将 ${selectedIps.size} 个IP标记为"预留"？`}
                {ipActionModal === 'release' && `释放 ${selectedIps.size} 个IP为"可用"？`}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setIpActionModal(null)}
                  className="px-4 py-2 text-sm text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors">
                  取消
                </button>
                <button onClick={() => {
                  const statusMap = { use: 'used', reserve: 'reserved', release: 'available' };
                  batchIpMutation.mutate(statusMap[ipActionModal]);
                }}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors">
                  确认
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== 子网列表视图 ====================
  return (
    <div className="p-6 space-y-5">
      {/* 页面标题 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">网段管理</h1>
          <p className="text-text-secondary text-sm mt-0.5">IP子网规划与地址分配</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['network-subnets'] })}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary bg-surface hover:bg-border/50 rounded-lg transition-colors border border-border">
            <RefreshCw size={14} /> 刷新
          </button>
          <button onClick={() => setSubnetModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors">
            <Plus size={14} /> 新建子网
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-text-tertiary text-xs">子网总数</p><p className="text-2xl font-bold text-text-primary mt-1">{totalSubnets}</p></div>
          <Layers size={28} className="text-blue-400" />
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-text-tertiary text-xs">IP 总量</p><p className="text-2xl font-bold text-text-primary mt-1">{totalIps.toLocaleString()}</p></div>
          <Network size={28} className="text-green-400" />
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-text-tertiary text-xs">已分配</p><p className="text-2xl font-bold text-text-primary mt-1">{usedIps.toLocaleString()}</p></div>
          <Router size={28} className="text-yellow-400" />
        </div>
      </div>

      {/* 搜索 + 过滤 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="搜索名称、CIDR、位置..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-primary"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary">
          <option value="">全部类型</option>
          {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* 子网列表 */}
      {isLoading ? (
        <div className="text-center py-16 text-text-tertiary">加载中...</div>
      ) : filteredSubnets.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <Globe size={48} className="text-text-tertiary mb-4" />
          <p className="text-text-secondary text-sm">暂无子网，点击"新建子网"开始规划</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubnets.map(s => {
            const type = TYPE_MAP[s.network_type] || TYPE_MAP.other;
            const status = STATUS_MAP[s.status] || STATUS_MAP.active;
            const usagePercent = s.total_ips > 0 ? Math.round((s.used_ips / s.total_ips) * 100) : 0;

            return (
              <div key={s.id}
                onClick={() => setSelectedSubnet(s)}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5 group"
              >
                {/* 头部 */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary font-mono group-hover:text-primary transition-colors">{s.cidr}</h3>
                    <p className="text-xs text-text-secondary mt-0.5">{s.name}</p>
                  </div>
                  <span className={clsx('text-xs px-2 py-0.5 rounded', type.color)}>{type.label}</span>
                </div>

                {/* 信息行 */}
                <div className="space-y-1.5 text-xs text-text-secondary mb-3">
                  {s.gateway && <div className="flex items-center gap-1"><Router size={12} /><span className="font-mono">{s.gateway}</span></div>}
                  {s.vlan_id && <div className="flex items-center gap-1"><Layers size={12} />VLAN {s.vlan_id}</div>}
                  {s.location && <div className="flex items-center gap-1"><MapPin size={12} />{s.location}</div>}
                </div>

                {/* 用量条 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-tertiary">使用率</span>
                    <span className="text-text-secondary font-mono">{s.used_ips}/{s.total_ips} ({usagePercent}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className={clsx(
                      'h-full rounded-full transition-all',
                      usagePercent > 80 ? 'bg-red-400' : usagePercent > 50 ? 'bg-yellow-400' : 'bg-green-400',
                    )}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                  <span className={clsx('text-xs px-2 py-0.5 rounded', status.className)}>{status.label}</span>
                  <div className="flex-1" />
                  <button onClick={(e) => { e.stopPropagation(); openEditModal(s); }}
                    className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface transition-colors">
                    <Edit size={14} />
                  </button>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`确定要删除子网 ${s.cidr} 吗？`)) deleteMutation.mutate(s.id);
                  }}
                    className="p-1.5 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== 创建/编辑子网弹窗 ==================== */}
      {subnetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSubnetModal} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">
                {editingSubnet ? '编辑子网' : '新建子网'}
              </h3>
              <button onClick={closeSubnetModal}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">名称</label>
                <input type="text" value={subnetName} onChange={(e) => setSubnetName(e.target.value)}
                  placeholder="例如：生产环境-核心网段" className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">CIDR <span className="text-red-400">*</span></label>
                  <input type="text" value={subnetCidr} onChange={(e) => setSubnetCidr(e.target.value)}
                    disabled={!!editingSubnet} placeholder="192.168.1.0/24"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-primary disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">VLAN ID</label>
                  <input type="number" value={subnetVlan} onChange={(e) => setSubnetVlan(e.target.value)}
                    placeholder="1-4094" min={1} max={4094}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1.5">网关</label>
                <input type="text" value={subnetGateway} onChange={(e) => setSubnetGateway(e.target.value)}
                  placeholder="192.168.1.1" className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-primary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">网络类型</label>
                  <select value={subnetType} onChange={(e) => setSubnetType(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary">
                    {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">位置/机房</label>
                  <input type="text" value={subnetLocation} onChange={(e) => setSubnetLocation(e.target.value)}
                    placeholder="例如：北京-A机房" className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1.5">备注</label>
                <textarea value={subnetDesc} onChange={(e) => setSubnetDesc(e.target.value)} rows={2}
                  placeholder="子网用途说明..." className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary resize-none" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
              <button onClick={closeSubnetModal}
                className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-border/50 transition-colors">
                取消
              </button>
              <button
                onClick={() => editingSubnet ? updateMutation.mutate() : createMutation.mutate()}
                disabled={!subnetName.trim() || (!editingSubnet && !subnetCidr.trim())}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50">
                {editingSubnet ? <Check size={14} /> : <Plus size={14} />}
                {editingSubnet ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
