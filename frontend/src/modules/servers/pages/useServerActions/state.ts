/**
 * useServerActions 全 state 子模块（2026-07-21 拆分）
 *
 * 包含全部 useState + useEffect (tag click-outside) + useEscapeKey handlers
 * 这些都是原 useServerActions.ts L46-117 区域
 */

import { useEffect, useRef, useState } from 'react';
import type { Server, ServerGroup } from '../types';

interface ServerActionsState {
  // ---------- State ----------
  isModalOpen: boolean;
  setIsModalOpen: (v: boolean) => void;
  selectedServer: Server | null;
  setSelectedServer: (v: Server | null) => void;
  formData: any;
  setFormData: (v: any) => void;
  command: string;
  setCommand: (v: string) => void;
  commandResult: any;
  setCommandResult: (v: any) => void;
  isExecuting: boolean;
  setIsExecuting: (v: boolean) => void;
  complianceResults: any;
  setComplianceResults: (v: any) => void;
  isRunningCompliance: boolean;
  setIsRunningCompliance: (v: boolean) => void;
  activeTab: 'servers' | 'compliance' | 'command-history' | 'compliance-history';
  setActiveTab: (v: 'servers' | 'compliance' | 'command-history' | 'compliance-history') => void;
  showComplianceOptions: boolean;
  setShowComplianceOptions: (v: boolean) => void;
  selectedTag: string | null;
  setSelectedTag: (v: string | null) => void;
  selectedGroupId: string | null;
  setSelectedGroupId: (v: string | null) => void;
  isImportModalOpen: boolean;
  setIsImportModalOpen: (v: boolean) => void;
  isGroupModalOpen: boolean;
  setIsGroupModalOpen: (v: boolean) => void;
  isDeleteConfirmOpen: boolean;
  setIsDeleteConfirmOpen: (v: boolean) => void;
  pendingDeleteServer: { id: string; name: string } | null;
  setPendingDeleteServer: (v: { id: string; name: string } | null) => void;
  isCollecting: boolean;
  setIsCollecting: (v: boolean) => void;
  isCollectingMetrics: boolean;
  setIsCollectingMetrics: (v: boolean) => void;
  // AI 命令生成
  isAiCommandModalOpen: boolean;
  setIsAiCommandModalOpen: (v: boolean) => void;
  aiCommandServer: Server | null;
  setAiCommandServer: (v: Server | null) => void;
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  aiGeneratedCommand: string;
  setAiGeneratedCommand: (v: string) => void;
  aiCommandExplanation: string;
  setAiCommandExplanation: (v: string) => void;
  isAiGenerating: boolean;
  setIsAiGenerating: (v: boolean) => void;
  selectedAiAgent: { id: string; name: string } | null;
  setSelectedAiAgent: (v: { id: string; name: string } | null) => void;
  showAiCommandConfirm: boolean;
  setShowAiCommandConfirm: (v: boolean) => void;
  aiGenerationError: string;
  setAiGenerationError: (v: string) => void;
  // SSH Key
  selectedSshKeyId: string;
  setSelectedSshKeyId: (v: string) => void;
  sshKeySearchQuery: string;
  setSshKeySearchQuery: (v: string) => void;
  showSshKeyDropdown: boolean;
  setShowSshKeyDropdown: (v: boolean) => void;
  // Group
  groupFormData: { name: string; description: string; parent_id: string };
  setGroupFormData: (v: { name: string; description: string; parent_id: string }) => void;
  editingGroup: ServerGroup | null;
  setEditingGroup: (v: ServerGroup | null) => void;
  // Import
  importData: string;
  setImportData: (v: string) => void;
  importResult: any;
  setImportResult: (v: any) => void;
  // Sidebar
  showGroups: boolean;
  setShowGroups: (v: boolean) => void;
  // Tags
  tagDropdownOpen: boolean;
  setTagDropdownOpen: (v: boolean) => void;
  tagInputRef: React.RefObject<HTMLInputElement>;
  tagDropdownRef: React.RefObject<HTMLDivElement>;
  // Compliance options
  complianceOptions: { useAI: boolean; concurrency: number };
  setComplianceOptions: (v: { useAI: boolean; concurrency: number }) => void;
  resetForm: () => void;
}

export function useServerActionsState(): ServerActionsState {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    port: 22,
    username: '',
    password: '',
    private_key: '',
    use_ssh_key: false,
    description: '',
    tags: '',
    os_type: 'linux' as 'linux' | 'windows',
    vnc_port: 5900,
    vnc_password: '',
  });
  const [command, setCommand] = useState('');
  const [commandResult, setCommandResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [complianceResults, setComplianceResults] = useState<any | null>(null);
  const [isRunningCompliance, setIsRunningCompliance] = useState(false);
  const [activeTab, setActiveTab] = useState<'servers' | 'compliance' | 'command-history' | 'compliance-history'>('servers');
  const [showComplianceOptions, setShowComplianceOptions] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [pendingDeleteServer, setPendingDeleteServer] = useState<{ id: string; name: string } | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isCollectingMetrics, setIsCollectingMetrics] = useState(false);
  // AI 命令生成相关
  const [isAiCommandModalOpen, setIsAiCommandModalOpen] = useState(false);
  const [aiCommandServer, setAiCommandServer] = useState<Server | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGeneratedCommand, setAiGeneratedCommand] = useState('');
  const [aiCommandExplanation, setAiCommandExplanation] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [selectedAiAgent, setSelectedAiAgent] = useState<{ id: string; name: string } | null>(null);
  const [showAiCommandConfirm, setShowAiCommandConfirm] = useState(false);
  const [aiGenerationError, setAiGenerationError] = useState('');

  // SSH Key related
  const [selectedSshKeyId, setSelectedSshKeyId] = useState<string>('');
  const [sshKeySearchQuery, setSshKeySearchQuery] = useState('');
  const [showSshKeyDropdown, setShowSshKeyDropdown] = useState(false);

  // Group related
  const [groupFormData, setGroupFormData] = useState({ name: '', description: '', parent_id: '' });
  const [editingGroup, setEditingGroup] = useState<ServerGroup | null>(null);

  // Import related
  const [importData, setImportData] = useState('');
  const [importResult, setImportResult] = useState<any>(null);

  // Group sidebar
  const [showGroups, setShowGroups] = useState(false);

  // Tag input
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Compliance options
  const [complianceOptions, setComplianceOptions] = useState({ useAI: true, concurrency: 5 });

  // ---------- Tag click-outside effect ----------
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(e.target as Node) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(e.target as Node)
      ) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      hostname: '',
      port: 22,
      username: '',
      password: '',
      private_key: '',
      use_ssh_key: false,
      description: '',
      tags: '',
      os_type: 'linux' as 'linux' | 'windows',
      vnc_port: 5900,
      vnc_password: '',
    });
    setSelectedSshKeyId('');
    setSshKeySearchQuery('');
    setShowSshKeyDropdown(false);
  };

  return {
    isModalOpen, setIsModalOpen,
    selectedServer, setSelectedServer,
    formData, setFormData,
    command, setCommand,
    commandResult, setCommandResult,
    isExecuting, setIsExecuting,
    complianceResults, setComplianceResults,
    isRunningCompliance, setIsRunningCompliance,
    activeTab, setActiveTab,
    showComplianceOptions, setShowComplianceOptions,
    selectedTag, setSelectedTag,
    selectedGroupId, setSelectedGroupId,
    isImportModalOpen, setIsImportModalOpen,
    isGroupModalOpen, setIsGroupModalOpen,
    isDeleteConfirmOpen, setIsDeleteConfirmOpen,
    pendingDeleteServer, setPendingDeleteServer,
    isCollecting, setIsCollecting,
    isCollectingMetrics, setIsCollectingMetrics,
    // AI
    isAiCommandModalOpen, setIsAiCommandModalOpen,
    aiCommandServer, setAiCommandServer,
    aiPrompt, setAiPrompt,
    aiGeneratedCommand, setAiGeneratedCommand,
    aiCommandExplanation, setAiCommandExplanation,
    isAiGenerating, setIsAiGenerating,
    selectedAiAgent, setSelectedAiAgent,
    showAiCommandConfirm, setShowAiCommandConfirm,
    aiGenerationError, setAiGenerationError,
    // SSH
    selectedSshKeyId, setSelectedSshKeyId,
    sshKeySearchQuery, setSshKeySearchQuery,
    showSshKeyDropdown, setShowSshKeyDropdown,
    // Group
    groupFormData, setGroupFormData,
    editingGroup, setEditingGroup,
    // Import
    importData, setImportData,
    importResult, setImportResult,
    // Sidebar
    showGroups, setShowGroups,
    // Tags
    tagDropdownOpen, setTagDropdownOpen,
    tagInputRef, tagDropdownRef,
    // Compliance options
    complianceOptions, setComplianceOptions,
    resetForm,
  };
}
