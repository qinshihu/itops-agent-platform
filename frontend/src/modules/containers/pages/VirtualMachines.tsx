import { CloneVMModal } from './virtual-machines/CloneVMModal';
import { DeleteVMConfirm } from './virtual-machines/DeleteVMConfirm';
import { PlatformManagementModal } from './virtual-machines/PlatformManagementModal';
import { SnapshotsDrawer } from './virtual-machines/SnapshotsDrawer';
import { VMFormModal } from './virtual-machines/VMFormModal';
import { VMList } from './virtual-machines/VMList';
import { VMPlatformSelector } from './virtual-machines/VMPlatformSelector';
import { VMStatsCards } from './virtual-machines/VMStatsCards';
import { VMStatsDrawer } from './virtual-machines/VMStatsDrawer';
import { VMToolbar } from './virtual-machines/VMToolbar';
import { useVirtualMachines } from './virtual-machines/useVirtualMachines';

export type { VM } from './virtual-machines/types';

export default function VirtualMachines() {
  const vm = useVirtualMachines();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">虚拟机管理</h1>
          <p className="text-sm text-text-secondary mt-1">
            跨平台管理 Proxmox / ESXi / KVM 虚拟机
          </p>
        </div>
      </div>

      <VMPlatformSelector
        platforms={vm.platforms}
        selectedPlatformId={vm.selectedPlatformId}
        selectedPlatform={vm.selectedPlatform}
        onSelectPlatform={vm.selectPlatform}
        onOpenPlatformModal={vm.openPlatformModal}
      />

      <VMStatsCards aggregatedStats={vm.aggregatedStats} />

      <VMToolbar
        search={vm.search}
        statusFilter={vm.statusFilter}
        syncing={vm.syncMutation.isPending}
        onSearchChange={vm.updateSearch}
        onStatusFilterChange={vm.updateStatusFilter}
        onRefresh={vm.refreshVMs}
        onSync={() => vm.syncMutation.mutate()}
        onCreateVM={vm.openCreateVM}
      />

      <VMList
        vms={vm.vms}
        isLoading={vm.vmsLoading}
        totalVMs={vm.totalVMs}
        page={vm.page}
        pageSize={vm.pageSize}
        selectedPlatformId={vm.selectedPlatformId}
        actionPending={vm.actionMutation.isPending}
        onAction={(id, action) => vm.actionMutation.mutate({ id, action })}
        onOpenSnapshots={vm.openSnapshots}
        onOpenClone={vm.openCloneModal}
        onOpenStats={vm.openStats}
        onEdit={vm.openEditVM}
        onDelete={(target) => vm.setDeleteConfirm({ id: target.id, name: target.name })}
        onPageChange={vm.setPage}
      />

      {vm.showPlatformModal && (
        <PlatformManagementModal
          platforms={vm.platforms}
          isLoading={vm.platformsLoading}
          form={vm.platformForm}
          creating={vm.createPlatformMutation.isPending}
          testing={vm.testConnectionMutation.isPending}
          onFormChange={vm.setPlatformForm}
          onClose={vm.closePlatformModal}
          onSubmit={() => vm.createPlatformMutation.mutate(vm.platformForm)}
          onTestConnection={(platformId) => vm.testConnectionMutation.mutate(platformId)}
          onDelete={(platformId) => vm.deletePlatformMutation.mutate(platformId)}
        />
      )}

      {vm.showVMModal && (
        <VMFormModal
          editingVM={vm.editingVM}
          form={vm.vmForm}
          saving={vm.createVMMutation.isPending || vm.updateVMMutation.isPending}
          onFormChange={vm.setVMForm}
          onClose={vm.closeVMModal}
          onSubmit={vm.submitVM}
        />
      )}

      {vm.showCloneModal && vm.cloneTarget && (
        <CloneVMModal
          target={vm.cloneTarget}
          cloneName={vm.cloneName}
          clonePowerOn={vm.clonePowerOn}
          cloning={vm.cloneMutation.isPending}
          onCloneNameChange={vm.setCloneName}
          onClonePowerOnChange={vm.setClonePowerOn}
          onClose={vm.closeCloneModal}
          onSubmit={() => vm.cloneMutation.mutate()}
        />
      )}

      {vm.showSnapshotDrawer && vm.snapshotVM && (
        <SnapshotsDrawer
          vm={vm.snapshotVM}
          snapshots={vm.snapshots}
          showCreate={vm.showSnapshotCreate}
          form={vm.snapshotForm}
          creating={vm.createSnapshotMutation.isPending}
          restoring={vm.restoreSnapshotMutation.isPending}
          deleting={vm.deleteSnapshotMutation.isPending}
          onClose={vm.closeSnapshots}
          onShowCreate={() => vm.setShowSnapshotCreate(true)}
          onHideCreate={() => vm.setShowSnapshotCreate(false)}
          onFormChange={vm.setSnapshotForm}
          onCreate={() => vm.createSnapshotMutation.mutate()}
          onRestore={(snapshotId) => vm.restoreSnapshotMutation.mutate(snapshotId)}
          onDelete={(snapshotId) => vm.deleteSnapshotMutation.mutate(snapshotId)}
        />
      )}

      {vm.showStatsDrawer && vm.statsVM && (
        <VMStatsDrawer
          vm={vm.statsVM}
          stats={vm.vmStatsData}
          onClose={vm.closeStats}
        />
      )}

      {vm.deleteConfirm && (
        <DeleteVMConfirm
          vmName={vm.deleteConfirm.name}
          deleting={vm.deleteVMMutation.isPending}
          onCancel={() => vm.setDeleteConfirm(null)}
          onConfirm={() => vm.deleteVMMutation.mutate(vm.deleteConfirm!.id)}
        />
      )}
    </div>
  );
}
