/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it, expect, vi as _vi } from "vitest";

/**
 * 重构拆分后的子组件存在性测试
 *
 * 重构中 Servers.tsx、Settings.tsx、Containers.tsx
 * 被拆分为多个小组件，本测试确保各子组件可正常导入。
 *
 * 注意：部分组件使用 named export（非 default export）
 */

describe("Server Sub-Components", () => {
  it("should export GroupTree (ServerGroupSection)", async () => {
    const { GroupTree } =
      await import("../../modules/servers/pages/ServerGroupSection");
    expect(GroupTree).toBeDefined();
  });

  it("should export ServerListSection", async () => {
    const { ServerListSection } =
      await import("../../modules/servers/pages/ServerListSection");
    expect(ServerListSection).toBeDefined();
  });

  it("should export CommandSection", async () => {
    const { CommandSection } =
      await import("../../modules/servers/pages/CommandSection");
    expect(CommandSection).toBeDefined();
  });

  it("should export ServerFormModal", async () => {
    const { ServerFormModal } =
      await import("../../modules/servers/pages/ServerFormModal");
    expect(ServerFormModal).toBeDefined();
  });

  it("should export SshKeySection", async () => {
    const { SshKeySection } =
      await import("../../modules/servers/pages/SshKeySection");
    expect(SshKeySection).toBeDefined();
  });
});

describe("Settings Sub-Components", () => {
  it("should export GeneralSettings", async () => {
    const { default: GeneralSettings } =
      await import("../../modules/settings/pages/settings/GeneralSettings");
    expect(GeneralSettings).toBeDefined();
  });

  it("should export SecuritySettings", async () => {
    const { default: SecuritySettings } =
      await import("../../modules/settings/pages/settings/SecuritySettings");
    expect(SecuritySettings).toBeDefined();
  });

  it("should export NotificationSettings", async () => {
    const { default: NotificationSettings } =
      await import("../../modules/notification/pages/NotificationSettings");
    expect(NotificationSettings).toBeDefined();
  });

  it("should export ModelSettings", async () => {
    const { default: ModelSettings } =
      await import("../../modules/settings/pages/settings/ModelSettings");
    expect(ModelSettings).toBeDefined();
  });

  it("should export BackupSettings", async () => {
    const { default: BackupSettings } =
      await import("../../modules/backup/pages/BackupSettings");
    expect(BackupSettings).toBeDefined();
  });
});

describe("Container Sub-Components", () => {
  it("should export ContainerDetail", async () => {
    const { ContainerDetail } =
      await import("../../modules/containers/pages/ContainerDetail");
    expect(ContainerDetail).toBeDefined();
  });

  it("should define ContainerMonitor default component", async () => {
    const source = await readFile(
      resolve(__dirname, "../../modules/containers/pages/ContainerMonitor.tsx"),
      "utf8",
    );
    expect(source).toContain("export default function ContainerMonitor");
  });

  it("should define ContainerLogs default component", async () => {
    const source = await readFile(
      resolve(__dirname, "../../modules/containers/pages/ContainerLogs.tsx"),
      "utf8",
    );
    expect(source).toContain("export default function ContainerLogs");
  });

  it("should export ImageRegistry", async () => {
    const { default: ImageRegistry } =
      await import("../../modules/containers/pages/ImageRegistry");
    expect(ImageRegistry).toBeDefined();
  });

  it("should export SnapshotPolicies", async () => {
    const { default: SnapshotPolicies } =
      await import("../../modules/containers/pages/SnapshotPolicies");
    expect(SnapshotPolicies).toBeDefined();
  });

  it("should export VirtualMachines", async () => {
    const { default: VirtualMachines } =
      await import("../../modules/containers/pages/VirtualMachines");
    expect(VirtualMachines).toBeDefined();
  });
});

describe("AI Components", () => {
  it("should export RecommendationCard", async () => {
    const { default: RecommendationCard } =
      await import("../../modules/ai/components/RecommendationCard");
    expect(RecommendationCard).toBeDefined();
  });
});

describe("Alert Components", () => {
  it("should export InspectionResult", async () => {
    const { default: InspectionResult } =
      await import("../../modules/alerts/components/InspectionResult");
    expect(InspectionResult).toBeDefined();
  });

  it("should export InspectionHistory", async () => {
    const { default: InspectionHistory } =
      await import("../../modules/alerts/components/InspectionHistory");
    expect(InspectionHistory).toBeDefined();
  });

  it("should export ImpactChain", async () => {
    const { default: ImpactChain } =
      await import("../../modules/alerts/components/ImpactChain");
    expect(ImpactChain).toBeDefined();
  });
});

describe("Infra Components", () => {
  it("should export ImportExport", async () => {
    const { ImportExport } =
      await import("../../modules/import-export/components/ImportExport");
    expect(ImportExport).toBeDefined();
  });

  it("should export AddDeviceModal", async () => {
    const { default: AddDeviceModal } =
      await import("../../modules/infra/components/AddDeviceModal");
    expect(AddDeviceModal).toBeDefined();
  });
});
