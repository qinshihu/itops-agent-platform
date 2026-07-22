/**
 * useServerActions 主 Hook（2026-07-21 拆分后精简版）
 *
 * 从原 801 行巨型 Hook 拆为：
 * - state.ts:     全 state + ESC + tag click-outside (130 行)
 * - queries.ts:   4 个 useQuery + 衍生数据 (130 行)
 * - mutations.ts: 11 个 useMutation (170 行)
 * - handlers.ts:  15 个 handle* 函数 (290 行)
 * - types.ts:     ApiError / ServerImportItem / ImportResult (40 行)
 * - useServerActions.ts (本文): 主 Hook 编排 (~80 行)
 *
 * 拆分原则遵循 frontend.md §5.1 + architecture.md §3.3.1
 * 调用方使用方式不变：`import { useServerActions } from '../useServerActions'`
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';
import { useToast } from '../../../../contexts/ToastContext';
import api from '../../../../lib/api';
import { useServerActionsState } from './state';
import { useServerActionsQueries } from './queries';
import { useServerActionsMutations } from './mutations';
import { useServerActionsHandlers } from './handlers';

// 转发类型导出，保持 `import type { ImportResult } from '../useServerActions'` 兼容
export type { ApiError, ServerImportItem, ImportResult } from './types';

export function useServerActions() {
  const navigate = useNavigate();
  const toast = useToast();

  // 1. State
  const state = useServerActionsState();

  // 2. Queries
  const queries = useServerActionsQueries(
    state.selectedServer,
    state.selectedTag,
    state.selectedGroupId,
    state.activeTab,
    state.sshKeySearchQuery,
  );

  // 3. Mutations（依赖 state setters 与 queries 的 refetch）
  const mutations = useServerActionsMutations(
    toast,
    state.resetForm,
    state.setIsModalOpen,
    state.setSelectedServer,
    state.setIsDeleteConfirmOpen,
    state.setPendingDeleteServer,
    state.setGroupFormData,
    state.setEditingGroup,
    state.setIsGroupModalOpen,
    state.formData,
    state.selectedSshKeyId,
    queries.refetchCommandHistory,
    queries.refetchComplianceHistory,
  );

  // 4. Handlers（依赖 state + queries + mutations）
  const handlers = useServerActionsHandlers(
    state.formData, state.setFormData,
    state.setSelectedServer, state.setSshKeySearchQuery,
    state.setSelectedSshKeyId, state.setIsModalOpen,
    state.setSelectedAiAgent, state.setIsAiCommandModalOpen,
    state.setIsAiGenerating, state.setAiGeneratedCommand,
    state.setAiCommandExplanation, state.setAiPrompt,
    state.setShowAiCommandConfirm,
    state.setAiGenerationError, state.setShowComplianceOptions,
    state.setIsRunningCompliance, state.setComplianceResults,
    state.setActiveTab, state.setIsExecuting, state.setCommandResult,
    state.setCommand, state.setIsCollecting, state.setIsCollectingMetrics,
    state.setImportData, state.setImportResult,
    state.setAiCommandServer, state.setTagDropdownOpen,
    state.tagInputRef,
    queries.agents, queries.sshKeys, queries.allTags,
    mutations.createMutation, mutations.updateMutation,
    mutations.testConnectionMutation, mutations.executeCommandMutation,
    mutations.runComplianceMutation, mutations.collectInfoMutation,
    mutations.collectAllMutation, mutations.collectMetricsMutation,
    mutations.collectAllMetricsMutation, mutations.importServersMutation,
    mutations.createGroupMutation, mutations.updateGroupMutation,
    state.selectedServer, state.complianceOptions,
    state.aiCommandServer, state.aiPrompt, state.aiGeneratedCommand,
    state.command, state.isExecuting, state.selectedAiAgent,
    state.editingGroup, state.groupFormData, state.importData,
    toast, api,
  );

  // 5. ESC keys handlers
  useEscapeKey({ onEscape: () => { state.setIsModalOpen(false); state.setSelectedServer(null); state.resetForm(); }, enabled: state.isModalOpen });
  useEscapeKey({ onEscape: () => state.setIsImportModalOpen(false), enabled: state.isImportModalOpen });
  useEscapeKey({ onEscape: () => { state.setIsGroupModalOpen(false); state.setEditingGroup(null); }, enabled: state.isGroupModalOpen });
  useEscapeKey({ onEscape: () => { state.setIsAiCommandModalOpen(false); state.setAiPrompt(''); state.setAiGeneratedCommand(''); state.setAiCommandExplanation(''); state.setAiGenerationError(''); state.setShowAiCommandConfirm(false); }, enabled: state.isAiCommandModalOpen });
  useEscapeKey({ onEscape: () => { state.setIsDeleteConfirmOpen(false); state.setPendingDeleteServer(null); }, enabled: state.isDeleteConfirmOpen });

  // 6. Return merge（保持原 return shape 100% 向后兼容）
  return useMemo(() => ({
    // State
    isModalOpen: state.isModalOpen, setIsModalOpen: state.setIsModalOpen,
    selectedServer: state.selectedServer, setSelectedServer: state.setSelectedServer,
    formData: state.formData, setFormData: state.setFormData,
    command: state.command, setCommand: state.setCommand,
    commandResult: state.commandResult, setCommandResult: state.setCommandResult,
    isExecuting: state.isExecuting, setIsExecuting: state.setIsExecuting,
    complianceResults: state.complianceResults, setComplianceResults: state.setComplianceResults,
    isRunningCompliance: state.isRunningCompliance, setIsRunningCompliance: state.setIsRunningCompliance,
    activeTab: state.activeTab, setActiveTab: state.setActiveTab,
    showComplianceOptions: state.showComplianceOptions, setShowComplianceOptions: state.setShowComplianceOptions,
    selectedTag: state.selectedTag, setSelectedTag: state.setSelectedTag,
    selectedGroupId: state.selectedGroupId, setSelectedGroupId: state.setSelectedGroupId,
    isImportModalOpen: state.isImportModalOpen, setIsImportModalOpen: state.setIsImportModalOpen,
    isGroupModalOpen: state.isGroupModalOpen, setIsGroupModalOpen: state.setIsGroupModalOpen,
    isDeleteConfirmOpen: state.isDeleteConfirmOpen, setIsDeleteConfirmOpen: state.setIsDeleteConfirmOpen,
    pendingDeleteServer: state.pendingDeleteServer, setPendingDeleteServer: state.setPendingDeleteServer,
    isCollecting: state.isCollecting, setIsCollecting: state.setIsCollecting,
    isCollectingMetrics: state.isCollectingMetrics, setIsCollectingMetrics: state.setIsCollectingMetrics,
    // AI
    isAiCommandModalOpen: state.isAiCommandModalOpen, setIsAiCommandModalOpen: state.setIsAiCommandModalOpen,
    aiCommandServer: state.aiCommandServer, setAiCommandServer: state.setAiCommandServer,
    aiPrompt: state.aiPrompt, setAiPrompt: state.setAiPrompt,
    aiGeneratedCommand: state.aiGeneratedCommand, setAiGeneratedCommand: state.setAiGeneratedCommand,
    aiCommandExplanation: state.aiCommandExplanation, setAiCommandExplanation: state.setAiCommandExplanation,
    isAiGenerating: state.isAiGenerating, setIsAiGenerating: state.setIsAiGenerating,
    selectedAiAgent: state.selectedAiAgent, setSelectedAiAgent: state.setSelectedAiAgent,
    showAiCommandConfirm: state.showAiCommandConfirm, setShowAiCommandConfirm: state.setShowAiCommandConfirm,
    aiGenerationError: state.aiGenerationError, setAiGenerationError: state.setAiGenerationError,
    // SSH
    selectedSshKeyId: state.selectedSshKeyId, setSelectedSshKeyId: state.setSelectedSshKeyId,
    sshKeySearchQuery: state.sshKeySearchQuery, setSshKeySearchQuery: state.setSshKeySearchQuery,
    showSshKeyDropdown: state.showSshKeyDropdown, setShowSshKeyDropdown: state.setShowSshKeyDropdown,
    // Group
    groupFormData: state.groupFormData, setGroupFormData: state.setGroupFormData,
    editingGroup: state.editingGroup, setEditingGroup: state.setEditingGroup,
    // Import
    importData: state.importData, setImportData: state.setImportData,
    importResult: state.importResult, setImportResult: state.setImportResult,
    // Sidebar
    showGroups: state.showGroups, setShowGroups: state.setShowGroups,
    // Tags
    tagDropdownOpen: state.tagDropdownOpen, setTagDropdownOpen: state.setTagDropdownOpen,
    tagInputRef: state.tagInputRef, tagDropdownRef: state.tagDropdownRef,
    // Compliance options
    complianceOptions: state.complianceOptions, setComplianceOptions: state.setComplianceOptions,
    // Data
    agents: queries.agents, sshKeys: queries.sshKeys, groupsData: queries.groupsData,
    servers: queries.servers, isLoading: queries.isLoading,
    allTags: queries.allTags, filteredSshKeys: queries.filteredSshKeys,
    filteredTagSuggestions: handlers.filteredTagSuggestions,
    filteredServers: queries.filteredServers,
    commandHistory: queries.commandHistory, refetchCommandHistory: queries.refetchCommandHistory,
    complianceHistory: queries.complianceHistory, refetchComplianceHistory: queries.refetchComplianceHistory,
    // Tag utilities
    parseCurrentTags: handlers.parseCurrentTags,
    getLastTagFragment: handlers.getLastTagFragment,
    addTagToInput: handlers.addTagToInput,
    removeTag: handlers.removeTag,
    // Handlers
    resetForm: state.resetForm,
    handleSubmit: handlers.handleSubmit,
    handleEdit: handlers.handleEdit,
    handleTestConnection: handlers.handleTestConnection,
    handleExecuteCommand: handlers.handleExecuteCommand,
    handleRunCompliance: handlers.handleRunCompliance,
    startComplianceCheck: handlers.startComplianceCheck,
    handleCollectInfo: handlers.handleCollectInfo,
    handleAiGenerateCommand: handlers.handleAiGenerateCommand,
    handleExecuteAiCommand: handlers.handleExecuteAiCommand,
    confirmExecuteAiCommand: handlers.confirmExecuteAiCommand,
    handleCollectAll: handlers.handleCollectAll,
    handleCollectMetrics: handlers.handleCollectMetrics,
    handleCollectAllMetrics: handlers.handleCollectAllMetrics,
    handleGroupSubmit: handlers.handleGroupSubmit,
    handleImport: handlers.handleImport,
    openAiCommandForServer: handlers.openAiCommandForServer,
    // Mutations
    createMutation: mutations.createMutation,
    updateMutation: mutations.updateMutation,
    deleteMutation: mutations.deleteMutation,
    testConnectionMutation: mutations.testConnectionMutation,
    executeCommandMutation: mutations.executeCommandMutation,
    runComplianceMutation: mutations.runComplianceMutation,
    // Nav
    navigate,
    // Query client
    queryClient: mutations.queryClient,
  }), [
    state, queries, mutations, handlers, navigate,
  ]);
}

// 默认导出兼容（部分代码可能用 import xxx from '../useServerActions'）
export default useServerActions;
