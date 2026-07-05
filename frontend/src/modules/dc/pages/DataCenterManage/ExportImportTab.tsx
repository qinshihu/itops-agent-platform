import { Button, Modal, Input } from 'antd';
import { Download, Upload, HardDrive } from 'lucide-react';
import type useDataCenter from './useDataCenter';

type DC = ReturnType<typeof useDataCenter>;

interface Props {
  dc: DC;
}

export default function ExportImportTab({ dc }: Props) {
  return (
    <>
      <div>
        <div className="mb-4 text-sm text-text-secondary">
          导出数据中心完整布局数据为 JSON 格式，包含机房、机柜、U位、生命周期和供电设备信息。
        </div>

        {/* 导出区域 */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Download size={18} className="text-blue-400" />
            <span className="text-sm font-medium text-text-primary">导出数据</span>
          </div>
          {dc.exportData ? (
            <>
              <p className="text-xs text-text-tertiary mb-3">
                包含 {dc.exportData.summary?.rooms || 0} 个机房, {dc.exportData.summary?.racks || 0} 个机柜, {dc.exportData.summary?.devices || 0} 个设备
              </p>
              <div className="flex gap-2">
                <Button icon={<Download size={14} />} onClick={dc.handleExportDownload}>下载 JSON 文件</Button>
                <Button icon={<HardDrive size={14} />} onClick={dc.handleExportCopy}>复制到剪贴板</Button>
              </div>
            </>
          ) : (
            <Button icon={<Download size={14} />} onClick={dc.loadExport}>加载导出数据</Button>
          )}
        </div>

        {/* 导入区域 */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Upload size={18} className="text-green-400" />
            <span className="text-sm font-medium text-text-primary">导入数据</span>
          </div>
          <Button icon={<Upload size={14} />} onClick={() => dc.setImportModalOpen(true)}>打开导入窗口</Button>
        </div>
      </div>

      {/* 导入 Modal */}
      <Modal
        title="导入数据中心数据"
        open={dc.importModalOpen}
        onOk={dc.handleImport}
        onCancel={() => { dc.setImportModalOpen(false); dc.setImportText(''); }}
        okText="导入"
        cancelText="取消"
        confirmLoading={dc.importLoading}
        width={700}
      >
        <div className="mb-2 text-xs text-text-tertiary">
          粘贴 JSON 数据。格式与导出数据一致，可包含 rooms, racks, slots, pdus 等字段。
        </div>
        <Input.TextArea
          rows={12}
          value={dc.importText}
          onChange={(e) => dc.setImportText(e.target.value)}
          placeholder='{"rooms": [...], "racks": [...], "slots": [...], "pdus": [...]}'
          className="font-mono text-xs"
        />
      </Modal>
    </>
  );
}