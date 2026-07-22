import { useNavigate } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider, Controls, Background, MiniMap, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Trash2 } from 'lucide-react';
import { EditorToolbar } from './workflow-editor/EditorToolbar';
import { NodePanel } from './workflow-editor/NodePanel';
import { nodeTypes } from './workflow-editor/WorkflowNodes';
import { useWorkflowEditor } from './workflow-editor/useWorkflowEditor';

function WorkflowEditorContent() {
  const navigate = useNavigate();
  const wf = useWorkflowEditor();

  return (
    <div className="h-full flex flex-col">
      <EditorToolbar
        isNew={wf.id === 'new'}
        showExecute={!!wf.id && wf.id !== 'new'}
        name={wf.name}
        description={wf.description}
        isTemplate={wf.isTemplate}
        validationErrors={wf.validationErrors}
        historyIndex={wf.historyIndex}
        historyLength={wf.historyLength}
        saving={wf.saveMutation.isPending}
        onBack={() => navigate('/workflows')}
        onNameChange={wf.setName}
        onDescriptionChange={wf.setDescription}
        onTemplateChange={wf.setIsTemplate}
        onUndo={wf.handleUndo}
        onRedo={wf.handleRedo}
        onImport={wf.handleImport}
        onExport={wf.handleExport}
        onExecute={wf.handleExecute}
        onSave={wf.handleSave}
        fileInputRef={wf.fileInputRef}
      />

      <div className="flex-1 flex min-h-0">
        <NodePanel
          agents={wf.agents ?? []}
          providers={wf.providers ?? []}
          selectedNode={wf.selectedNode}
          onDeleteSelectedNode={wf.deleteSelectedNode}
          onDuplicateSelectedNode={wf.duplicateSelectedNode}
          onUpdateNodeLabel={wf.updateNodeLabel}
          onUpdateNodeDescription={wf.updateNodeDescription}
          onUpdateNodeInputKey={wf.updateNodeInputKey}
          onUpdateNodeOutputKey={wf.updateNodeOutputKey}
          onUpdateNodePrompt={wf.updateNodePrompt}
          onUpdateApprovalConfig={wf.updateApprovalConfig}
          onUpdateProviderId={wf.updateProviderId}
          onUpdateProviderConfig={wf.updateProviderConfig}
          onUpdateVerificationConfig={wf.updateVerificationConfig}
          onUpdateRiskAssessConfig={wf.updateRiskAssessConfig}
          onUpdateDecisionConfig={wf.updateDecisionConfig}
          onUpdateKnowledgeConfig={wf.updateKnowledgeConfig}
          onUpdateRollbackConfig={wf.updateRollbackConfig}
          onUpdateGenericConfig={wf.updateGenericConfig}
        />

        <div className="flex-1 flex flex-col">
          <div className="flex-1" ref={wf.reactFlowWrapper}>
            <ReactFlow
              nodes={wf.nodes}
              edges={wf.edges}
              onNodesChange={wf.onNodesChange}
              onEdgesChange={wf.onEdgesChange}
              onConnect={wf.onConnect}
              onInit={wf.setReactFlowInstance}
              onDrop={wf.onDrop}
              onDragOver={wf.onDragOver}
              onNodeClick={wf.onNodeClick}
              onPaneClick={wf.onPaneClick}
              nodeTypes={nodeTypes}
              proOptions={wf.proOptions}
              fitView
            >
              <Background gap={16} size={1} />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  return node.selected ? '#3b82f6' : '#475569';
                }}
                className="border border-border rounded-lg overflow-hidden"
              />
              <Panel position="top-center">
                <div className="bg-surface/95 backdrop-blur-sm px-4 py-2 rounded-lg border border-border shadow-lg">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-text-secondary">
                      从左侧拖拽Agent到画布创建节点
                    </span>
                    <span className="text-text-secondary">•</span>
                    <span className="text-text-secondary">
                      {wf.nodes.length} 个节点
                    </span>
                    <span className="text-text-secondary">•</span>
                    <span className="text-text-secondary">
                      {wf.edges.length} 条连接
                    </span>
                  </div>
                </div>
              </Panel>
              <Panel position="bottom-left">
                <div className="bg-surface/95 backdrop-blur-sm p-2 rounded-lg border border-border">
                  <button
                    onClick={wf.handleClear}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    清空画布
                  </button>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorContent />
    </ReactFlowProvider>
  );
}