# Node v20.19.5 安装方案（fnm 双版本管理）

> **文档目的**：为 AIops 项目本机开发环境安装 Node v20.19.5（与项目 [.nvmrc](../.nvmrc) 一致）的可执行方案。
>
> **创建日期**：2026-07-20
> **适用范围**：Windows + PowerShell 环境，已安装 Node v24.17.0 全局版本，未安装任何 Node 版本管理工具
> **方案选择**：fnm（Fast Node Manager，Rust 实现）

---

## 一、方案概述

### 推荐方案：fnm 双版本管理

**fnm**（Fast Node Manager）是 Rust 实现的轻量 Node 版本管理工具，适合本方案的核心需求：

| 特性               | 说明                                             |
| ------------------ | ------------------------------------------------ |
| 保留现有 v24.17.0  | ✅ 不卸载、不破坏，全局继续用 v24                |
| 自动读 .nvmrc      | ✅ 进入项目目录自动切到 v20.19.5，无需手动 `use` |
| Windows 启动速度快 | 🟢 Rust 实现，比 nvm-windows 快 10 倍以上        |
| 装在 D 盘          | ✅ 满足用户硬约束 `D:\kaifahuanjing\`            |
| 破坏性             | 低                                               |

**核心策略**：v24 保持全局默认（其他项目用），AIops 项目专用 v20.19.5（通过 `.nvmrc` 自动切换）。

---

## 二、当前环境基线（检测时间：2026-07-20）

| 项目                   | 实际值                                             |
| ---------------------- | -------------------------------------------------- |
| 当前 Node 版本         | v24.17.0                                           |
| Node 安装路径          | `D:\kaifahuanjing\nodejs\node.exe` ✅ 已在 D 盘    |
| npm 版本               | 11.13.0                                            |
| nvm-windows            | 未安装                                             |
| fnm                    | 未安装                                             |
| nvs                    | 未安装                                             |
| D:\kaifahuanjing\ 目录 | 已存在，含 Docker、Git、nodejs、Python313 等子目录 |
| PATH 中 node 相关      | `D:\kaifahuanjing\nodejs\` + Trae CN SDK 路径      |

---

## 三、安装步骤（按顺序执行）

### Step 1：下载 fnm

打开 PowerShell（**普通用户权限即可**，不需要管理员），执行：

```powershell
# 创建 fnm 目录
New-Item -ItemType Directory -Force -Path "D:\kaifahuanjing\fnm"

# 下载 fnm for Windows（约 5MB）
Invoke-WebRequest -Uri "https://github.com/Schniz/fnm/releases/latest/download/fnm-windows.zip" -OutFile "D:\kaifahuanjing\fnm\fnm.zip"

# 解压
Expand-Archive -Path "D:\kaifahuanjing\fnm\fnm.zip" -DestinationPath "D:\kaifahuanjing\fnm\" -Force

# 删除 zip
Remove-Item "D:\kaifahuanjing\fnm\fnm.zip"

# 验证
D:\kaifahuanjing\fnm\fnm.exe --version
# 期望输出：fnm X.X.X
```

### Step 2：配置 fnm 环境变量（关键）

**fnm 需要在 PowerShell 启动时自动初始化**，否则切换版本不生效。

#### 2.1 添加 fnm 到 PATH

```powershell
# 1. 永久写入 FNM_DIR 到用户级环境变量（让 CMD/Git Bash/IDE 非终端环境也能读到，避免装到 C 盘）
[Environment]::SetEnvironmentVariable(
    "FNM_DIR",
    "D:\kaifahuanjing\fnm\node-versions",
    "User"
)
$env:FNM_DIR = "D:\kaifahuanjing\fnm\node-versions"

# 2. 添加 fnm 到用户级 PATH
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "User") + ";D:\kaifahuanjing\fnm",
    "User"
)

# 让当前会话也生效
$env:Path += ";D:\kaifahuanjing\fnm"

# 验证
fnm --version
# 期望输出：fnm X.X.X

# 验证 FNM_DIR（必须为 D 盘路径，否则 CMD/Git Bash 会装到 C 盘）
$env:FNM_DIR
# 期望：D:\kaifahuanjing\fnm\node-versions
```

#### 2.2 配置 PowerShell 自动初始化 fnm

修改你的 PowerShell 配置文件，让每次打开 PowerShell 自动初始化 fnm：

```powershell
# 查看配置文件路径
$PROFILE

# 通常输出：
# C:\Users\123\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1（PowerShell 5）
# 或
# C:\Users\123\Documents\PowerShell\Microsoft.PowerShell_profile.ps1（PowerShell 7）
```

完整操作命令（双写 Profile，含幂等性检查）：

```powershell
# 同时写入 PowerShell 5.1 和 7 的 Profile（避免 Trae CN 用 PS7 时配置不生效）
$profile51 = "C:\Users\123\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
$profile7  = "C:\Users\123\Documents\PowerShell\Microsoft.PowerShell_profile.ps1"

foreach ($profilePath in @($profile51, $profile7)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $profilePath) | Out-Null

    # 幂等性检查（多次执行不会重复堆积）
    $profileContent = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
    if ($profileContent -match "FNM_DIR") {
        Write-Host "已存在配置：$profilePath" -ForegroundColor Yellow
    } else {
        $fnmConfig = @'

# === fnm (Node Version Manager) 配置 ===
$env:FNM_DIR = "D:\kaifahuanjing\fnm\node-versions"
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
}
'@
        Add-Content -Path $profilePath -Value $fnmConfig -Encoding UTF8
        Write-Host "已写入：$profilePath" -ForegroundColor Green
    }
}

# 查看当前终端的 Profile 内容
Get-Content $PROFILE
```

**为什么需要双写**：

| PowerShell 版本                        | Profile 路径                                                                |
| -------------------------------------- | --------------------------------------------------------------------------- |
| PowerShell 5.1（Windows 默认）         | `C:\Users\123\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1` |
| PowerShell 7（Trae CN 内置终端可能用） | `C:\Users\123\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`        |

两个版本的 Profile 是**不同文件**，只写一个会导致另一个版本的终端不自动加载 fnm 配置。双写确保两个版本都能自动初始化。

### Step 3：重启 PowerShell 并验证 fnm 安装

**关闭当前 PowerShell 窗口，重新打开一个新窗口**，然后执行：

```powershell
# 验证 fnm 已就绪
fnm --version
# 期望：fnm X.X.X

# 验证环境变量
$env:FNM_DIR
# 期望：D:\kaifahuanjing\fnm\node-versions
```

### Step 4：用 fnm 安装 Node v20.19.5

```powershell
# 安装 v20.19.5（fnm 会自动装到 D:\kaifahuanjing\fnm\node-versions\v20.19.5\installation\）
fnm install 20.19.5

# 验证已安装
fnm list
# 期望输出：
# * system
# * v20.19.5
```

### Step 5：配置项目自动切换

进入 AIops 项目目录，验证 fnm 自动切换：

```powershell
cd c:\Users\123\Desktop\daima\AIops

# 验证 .nvmrc 文件
Get-Content .nvmrc
# 期望：20.19.5

# 验证自动切换（如果 Step 2.2 配置正确，进入目录会自动切换）
node -v
# 期望：v20.19.5

# 如果没自动切换，手动执行
fnm use
# 期望：Using Node v20.19.5
```

### Step 6：重新编译 native 模块（关键！）

切换 Node 版本后，必须**重新编译** better-sqlite3 等 native 模块，否则会报 `NODE_MODULE_VERSION mismatch` 错误：

```powershell
# 确认当前在项目目录且 Node 是 v20.19.5
cd c:\Users\123\Desktop\daima\AIops
node -v  # 期望：v20.19.5

# 清理后端依赖
cd backend
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# 重新安装（会自动用 v20.19.5 编译 native 模块）
npm install

# 验证 better-sqlite3 可加载
npx tsx -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); console.log('better-sqlite3 OK')"
# 期望：better-sqlite3 OK

# 验证后端能启动
npm run dev
# 期望：后端启动在 http://localhost:3001
# Ctrl+C 退出
```

### Step 7：验证前端

```powershell
# 新开一个 PowerShell 窗口
cd c:\Users\123\Desktop\daima\AIops\frontend
node -v  # 期望：v20.19.5

# 前端依赖不需要重装：Vite 5 的 esbuild 是平台二进制（按 OS/Arch 区分），
# 不是 Node native module，切换 Node 版本不需要重新安装。
# 只需清理 Vite 的预编译缓存，避免旧缓存导致的奇怪问题
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue

# 启动验证
npm run dev
# 期望：前端启动在 http://localhost:3000
# Ctrl+C 退出
```

**为什么前端不需要 `npm install`**：

| 依赖                      | 类型               | 是否需要重装 | 原因                                             |
| ------------------------- | ------------------ | ------------ | ------------------------------------------------ |
| `better-sqlite3`（后端）  | Node native module | ✅ 需要      | 依赖 `NODE_MODULE_VERSION`，切换 Node 必须重编译 |
| `ssh2`（后端）            | 可选 native module | ⚠️ 建议重装  | 含 native binding，可能因版本不匹配报错          |
| `vite`/`esbuild`（前端）  | 平台二进制         | ❌ 不需要    | 按 OS/Arch 区分（win32-x64），与 Node 版本无关   |
| `antd`/`react`/`axios` 等 | 纯 JS              | ❌ 不需要    | 与 Node 版本无关                                 |

---

## 四、日常使用方式

### 进入项目时

**自动切换**（如果配置正确）：

```powershell
cd c:\Users\123\Desktop\daima\AIops
# fnm 自动读取 .nvmrc，切换到 v20.19.5
node -v  # v20.19.5
```

**手动切换**（如果自动切换失效）：

```powershell
fnm use  # 在项目目录执行
```

### 退出项目时

fnm 不会自动切换回全局版本，但你也不需要切换 — 直接关闭终端或开新终端即可。

### 其他项目用 v24

```powershell
cd D:\其他项目目录
# 该目录没有 .nvmrc，fnm 会用 system（即 D:\kaifahuanjing\nodejs\node.exe v24.17.0）
node -v  # v24.17.0
```

---

## 五、故障排查

### 问题 1：`fnm : 无法将"fnm"项识别为 cmdlet`

**原因**：PATH 未生效或 PowerShell 配置文件未加载。

**解决**：

1. 关闭所有 PowerShell 窗口，重新打开
2. 检查 `D:\kaifahuanjing\fnm` 是否在 PATH：`$env:Path -split ';' | Select-String fnm`
3. 如果不在，重新执行 Step 2.1

### 问题 2：进入项目后 `node -v` 还是显示 v24

**原因**：fnm 未自动初始化。

**解决**：

1. 检查 PowerShell 配置文件是否包含 fnm 初始化代码：`Get-Content $PROFILE`
2. 如果没有，重新执行 Step 2.2
3. 重启 PowerShell

### 问题 3：`Error: NODE_MODULE_VERSION mismatch`

**原因**：better-sqlite3 是用 v24 编译的，但运行时是 v20。

**解决**：

```powershell
cd c:\Users\123\Desktop\daima\AIops\backend
Remove-Item -Recurse -Force node_modules
npm install
```

### 问题 4：`fnm install 20.19.5` 卡住

**原因**：网络问题，从 nodejs.org 下载慢。

**解决方案 A：临时使用国内镜像（推荐，仅当前会话生效）**：

```powershell
$env:FNM_NODE_DIST_MIRROR = "https://npmmirror.com/mirrors/node/"
fnm install 20.19.5
```

**解决方案 B：永久使用国内镜像（可选，适合需要频繁装多个 Node 版本）**：

```powershell
# 写入用户级环境变量，重启 PowerShell 后永久生效
[Environment]::SetEnvironmentVariable(
    "FNM_NODE_DIST_MIRROR",
    "https://npmmirror.com/mirrors/node/",
    "User"
)

# 让当前会话也生效
$env:FNM_NODE_DIST_MIRROR = "https://npmmirror.com/mirrors/node/"

# 验证
$env:FNM_NODE_DIST_MIRROR
# 期望：https://npmmirror.com/mirrors/node/
```

**说明**：

- Node 安装通常是一次性操作，建议用方案 A 临时设置即可
- 方案 B 适合需要多次安装不同 Node 版本（如 v18、v20、v22）的场景
- 如果配置了方案 B 后想恢复默认源，删除该环境变量即可：

```powershell
[Environment]::SetEnvironmentVariable("FNM_NODE_DIST_MIRROR", $null, "User")
```

### 问题 5：PATH 中有多个 node 路径导致冲突

**原因**：Trae CN SDK 也带 node，可能与 fnm 冲突。

**解决**：

```powershell
# 检查所有 node 路径
where.exe node

# 如果 Trae CN SDK 的 node 优先级高于 fnm，调整 PATH 顺序
# 把 D:\kaifahuanjing\fnm 移到 PATH 最前面
```

---

## 六、验证清单（全部通过才算成功）

```powershell
# 1. fnm 已安装
fnm --version

# 2. v20.19.5 已安装
fnm list

# 3. 项目目录自动切换
cd c:\Users\123\Desktop\daima\AIops
node -v  # v20.19.5

# 4. 其他目录仍是 v24
cd c:\
node -v  # v24.17.0

# 5. better-sqlite3 可加载
cd c:\Users\123\Desktop\daima\AIops\backend
npx tsx -e "require('better-sqlite3')(':memory:')"

# 6. 后端可启动
npm run dev  # 访问 http://localhost:3001

# 7. 前端可启动
cd ..\frontend
npm run dev  # 访问 http://localhost:3000
```

---

## 七、一键脚本（可选）

如果你想一次性执行 Step 1-4，可以保存以下内容为 `install-fnm.ps1` 然后执行：

```powershell
# install-fnm.ps1 - fnm 安装脚本
$ErrorActionPreference = "Stop"

Write-Host "=== Step 1: 下载 fnm ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "D:\kaifahuanjing\fnm" | Out-Null
Invoke-WebRequest -Uri "https://github.com/Schniz/fnm/releases/latest/download/fnm-windows.zip" -OutFile "D:\kaifahuanjing\fnm\fnm.zip"
Expand-Archive -Path "D:\kaifahuanjing\fnm\fnm.zip" -DestinationPath "D:\kaifahuanjing\fnm\" -Force
Remove-Item "D:\kaifahuanjing\fnm\fnm.zip"

Write-Host "=== Step 2: 配置 PATH 和 FNM_DIR ===" -ForegroundColor Cyan
# 2.1 永久写入 FNM_DIR 到用户级环境变量（避免 CMD/Git Bash/IDE 装到 C 盘）
[Environment]::SetEnvironmentVariable(
    "FNM_DIR",
    "D:\kaifahuanjing\fnm\node-versions",
    "User"
)
$env:FNM_DIR = "D:\kaifahuanjing\fnm\node-versions"

# 2.2 添加 fnm 到用户级 PATH（幂等性检查）
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notmatch "fnm") {
    [Environment]::SetEnvironmentVariable("Path", $userPath + ";D:\kaifahuanjing\fnm", "User")
}
$env:Path += ";D:\kaifahuanjing\fnm"

Write-Host "=== Step 3: 双写 PowerShell 5.1 和 7 的 Profile ===" -ForegroundColor Cyan
$profile51 = "C:\Users\123\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
$profile7  = "C:\Users\123\Documents\PowerShell\Microsoft.PowerShell_profile.ps1"

foreach ($profilePath in @($profile51, $profile7)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $profilePath) | Out-Null

    # 幂等性检查（多次执行不会重复堆积）
    $profileContent = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
    if ($profileContent -match "FNM_DIR") {
        Write-Host "已存在配置：$profilePath" -ForegroundColor Yellow
    } else {
        $fnmConfig = @'

# === fnm (Node Version Manager) 配置 ===
$env:FNM_DIR = "D:\kaifahuanjing\fnm\node-versions"
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
}
'@
        Add-Content -Path $profilePath -Value $fnmConfig -Encoding UTF8
        Write-Host "已写入：$profilePath" -ForegroundColor Green
    }
}

Write-Host "=== Step 4: 安装 Node v20.19.5（使用国内镜像加速）===" -ForegroundColor Cyan
# 临时使用国内镜像（仅当前会话生效，避免国内下载 nodejs.org 卡死）
$env:FNM_NODE_DIST_MIRROR = "https://npmmirror.com/mirrors/node/"
fnm install 20.19.5

Write-Host "=== 完成！请关闭并重新打开 PowerShell ===" -ForegroundColor Green
Write-Host "新窗口中执行：" -ForegroundColor Yellow
Write-Host "  cd c:\Users\123\Desktop\daima\AIops" -ForegroundColor Yellow
Write-Host "  node -v  # 应该显示 v20.19.5" -ForegroundColor Yellow
```

---

## 八、注意事项汇总

### 安装位置（硬约束 - 必须遵守）

⚠️ **必须装在 `D:\kaifahuanjing\` 目录下，绝不默认装到 C 盘**（用户硬约束）

| 安装路径                              | 用途                 |
| ------------------------------------- | -------------------- |
| `D:\kaifahuanjing\fnm\`               | fnm 可执行文件       |
| `D:\kaifahuanjing\fnm\node-versions\` | fnm 安装的 Node 版本 |

### 与现有 Node v24.17.0 共存

安装 v20.19.5 后**不要卸载 v24**，通过版本管理工具切换：

```powershell
# 进入项目目录后切换（fnm 最方便，自动读 .nvmrc）
cd c:\Users\123\Desktop\daima\AIops
fnm use --version-file    # 自动读取 .nvmrc 切换到 20.19.5
```

**关键**：让 v24 保持全局默认（其他项目用），AIops 项目专用 v20.19.5。

### PATH 环境变量冲突风险

⚠️ 这是 Windows 上最常见的坑：

| 问题               | 表现                    | 解决方案                                           |
| ------------------ | ----------------------- | -------------------------------------------------- |
| 全局 node 路径优先 | `node -v` 还是显示 v24  | 把 fnm 路径放在系统 PATH 最前面                    |
| npm 全局包路径冲突 | 全局包跑到错误版本下    | `npm config get prefix` 检查，确保是当前版本的路径 |
| 多个 node.exe 残留 | which node 显示多个路径 | 用 `where.exe node` 排查，清理 PATH 中冗余路径     |
| Trae CN SDK 干扰   | Trae CN 自带 node 抢占  | 把 fnm 路径放在 Trae CN SDK 路径之前               |

### better-sqlite3 native 模块（项目核心依赖）

[backend/package.json](../backend/package.json) 依赖 `better-sqlite3@^11.7.0`，这是 native 模块，安装时可能踩坑：

| 场景                                 | 解决方案                                                        |
| ------------------------------------ | --------------------------------------------------------------- |
| 预编译二进制可用（大多数情况）       | `npm install` 直接成功，无需任何工具                            |
| 预编译二进制不可用                   | 需 Visual Studio Build Tools 2022 + Python 3.x，从源码编译      |
| 切换 Node 版本后 better-sqlite3 报错 | 进入 `backend/` 目录重新 `npm install` 重新编译 native 模块     |
| 报 `NODE_MODULE_VERSION` 不匹配      | 删除 `backend/node_modules/better-sqlite3` 后重新 `npm install` |

**强烈建议**：切换到 v20.19.5 后，**必须**重新执行 `cd backend; npm install` 重新编译 native 模块，否则会报 `NODE_MODULE_VERSION mismatch`。

### npm 全局包策略（用户硬约束）

用户约束：「For Node.js/frontend projects, install dependencies locally in the project root, never globally」

⚠️ 但 npm 本身就是全局的，所以需要区分：

| 类型                                         | 全局/本地                      | 说明                                 |
| -------------------------------------------- | ------------------------------ | ------------------------------------ |
| 项目依赖（express、antd、better-sqlite3 等） | ✅ 本地（项目内 node_modules） | 严格遵守约束                         |
| 开发工具（npm 自身、npx 调用）               | 🟡 全局                        | 系统级，无法本地化                   |
| 全局 CLI 工具（如 prettier、eslint）         | ❌ 不要全局装                  | 用 npx 或项目内 devDependencies 调用 |

切换 Node 版本后，全局包**不会自动迁移**，需要重新装一次：

```powershell
# 切换到 v20.19.5 后，按需重装全局工具
npm install -g npm@latest  # 确保 npm 版本一致
```

### PowerShell 编码安全（项目硬规则）

⚠️ 根据 [powershell.md](../.trae/rules/powershell.md) 规则，在 PowerShell 中处理含中文路径或文件时：

```powershell
# 1. 切换 PowerShell 编码为 UTF-8（每次新会话执行）
chcp 65001
$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

# 2. 项目路径含中文用户名（c:\Users\123\Desktop\daima\AIops）
# 但 "123" 是英文，daima 也是英文，所以相对安全
# 如果路径有中文（如 c:\Users\张三\Desktop\），必须用引号包裹
```

### 与 VS Code / Trae CN 集成

[.vscode/settings.json](../.vscode/settings.json) 已配置 ESLint 双工作目录（backend/frontend），无需手动调整。但需要：

1. **重启 VS Code / Trae CN**：安装新 Node 版本后必须重启编辑器，否则终端和 ESLint 还会用旧版本的 PATH
2. **检查 ESLint Server**：`Ctrl+Shift+P` → `ESLint: Restart ESLint Server`，让它用新 Node 重新加载
3. **TypeScript Server**：`Ctrl+Shift+P` → `TypeScript: Restart TS Server`

#### Trae CN 内置终端的 PowerShell 版本检查（关键）

⚠️ Trae CN 内置终端可能使用不同的 PowerShell 版本，导致 Profile 路径不同：

| PowerShell 版本 | Profile 路径                                                                |
| --------------- | --------------------------------------------------------------------------- |
| PowerShell 5.1  | `C:\Users\123\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1` |
| PowerShell 7    | `C:\Users\123\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`        |

如果 Trae CN 内置终端使用 PowerShell 7，但你在 PowerShell 5.1 中执行了 Step 2.2，则 fnm 配置不会在 Trae CN 终端中自动加载（因为两个版本的 Profile 路径不同）。

**验证步骤**（在 Trae CN 内置终端中执行）：

```powershell
# 查看当前 PowerShell 版本
$PSVersionTable.PSVersion

# 查看当前 Profile 路径（不同版本指向不同文件）
$PROFILE

# 检查 Profile 中是否已包含 fnm 配置
Get-Content $PROFILE -ErrorAction SilentlyContinue | Select-String "FNM_DIR"
# 期望：能匹配到一行
```

如果上方检查未匹配到 `FNM_DIR`，说明该 PowerShell 版本的 Profile 还没写入配置 —— 直接回到 [Step 2.2](#step-2配置-fnm-环境变量关键) 重新执行即可。Step 2.2 已使用双写循环（同时覆盖 PowerShell 5.1 和 7 两个版本的 Profile），执行一次即可让所有终端自动初始化 fnm。

### 与 Docker 开发环境的关系

如果用 [local-dev/](../local-dev) 的 Docker 开发环境，**Docker 容器内有独立的 Node 版本**（由 [local-dev/Dockerfile.backend.dev](../local-dev/Dockerfile.backend.dev) 决定），与宿主机 Node 版本无关。

也就是说：

- **宿主机直接开发**（方式一）→ 必须装 v20.19.5
- **Docker 开发环境**（方式二）→ 宿主机 Node 版本无所谓，容器内有自己的

---

## 九、不推荐的做法

❌ **不要**卸载 v24.17.0 — 留着其他项目用
❌ **不要**直接从 nodejs.org 下载 .msi 装 v20 — 无法多版本切换，且默认装 C 盘
❌ **不要**把 v20.19.5 装到 `C:\Program Files\nodejs\` — 违反 D 盘约束
❌ **不要**用 `npm install -g` 装项目业务依赖 — 违反本地依赖约束
❌ **不要**在没切到 v20.19.5 时直接 `npm install` backend — native 模块会编译成错误版本
❌ **不要**用 winget 装 fnm — 默认装到 C 盘，违反 D 盘约束

---

## 十、推荐执行顺序

1. **先关闭所有正在运行的 backend/frontend dev server**
2. 执行 Step 1-5（fnm 安装和 v20.19.5 安装）
3. **重启 PowerShell**（关键，让 PATH 和 Profile 生效）
4. 执行 Step 6（重新编译 backend 的 native 模块）
5. 执行 Step 7（验证前端）
6. 执行第六节验证清单全部通过

---

## 十一、参考资源

- 项目 Node 版本固定：[`.nvmrc`](../.nvmrc)（内容：`20.19.5`）
- 项目顶层规则：[`.trae/rules/top-rules.md §四`](../.trae/rules/top-rules.md)（本地开发方式）
- PowerShell 编码安全：[`.trae/rules/powershell.md`](../.trae/rules/powershell.md)
- 后端依赖：[`backend/package.json`](../backend/package.json)（含 better-sqlite3 native 模块）
- 本地开发 Docker 环境：[`local-dev/`](../local-dev)（备选方案 D）
- fnm 官方文档：https://github.com/Schniz/fnm
- fnm Windows 安装指南：https://github.com/Schniz/fnm#windows

---

## 十二、实际执行记录（2026-07-20）

### 执行概况

| 步骤 | 状态 | 完成时间 | 备注 |
| --- | --- | --- | --- |
| Step 1：下载 fnm | ✅ 完成 | 2026-07-20 21:44 | fnm 1.39.0，3.4MB |
| Step 2：配置环境变量 | ✅ 完成 | 2026-07-20 21:53 | FNM_DIR + PATH + PS 5.1/7 双写 Profile |
| Step 3：验证 fnm 安装 | ✅ 完成 | 2026-07-20 21:56 | 新窗口验证通过 |
| Step 4：安装 Node v20.19.5 | ✅ 完成 | 2026-07-20 21:56 | 使用 npmmirror 镜像，28.51 MiB |
| Step 5：配置项目自动切换 | ✅ 完成 | 2026-07-20 22:03 | 进入 AIops 目录自动切到 v20.19.5 |
| Step 6：重新编译 backend | ⏳ 待执行 | - | - |
| Step 7：验证前端 | ⏳ 待执行 | - | - |

### 实际安装路径（与方案预期不同）

| 项目 | 方案预期路径 | 实际路径 |
| --- | --- | --- |
| fnm 可执行文件 | `D:\kaifahuanjing\fnm\fnm.exe` | ✅ 一致 |
| FNM_DIR | `D:\kaifahuanjing\fnm\node-versions` | ✅ 一致 |
| Node v20.19.5 安装路径 | `D:\kaifahuanjing\fnm\node-versions\v20.19.5\installation\` | ⚠️ `D:\kaifahuanjing\fnm\node-versions\node-versions\v20.19.5\installation\` |

### 已知问题与处理决策

#### 问题 1：FNM_DIR 嵌套目录（已接受）

- **现象**：fnm 1.39.0 在 FNM_DIR（`D:\kaifahuanjing\fnm\node-versions`）下又创建 `node-versions` 子目录，导致实际安装路径多一层
- **影响**：功能正常，仅路径冗余
- **决策**：用户选择"接受现状，继续 Step 5"（2026-07-20）
- **后续动作**：已更新 user_profile.md 和 rule-env-python-node-git.md 中的路径描述以匹配实际

#### 问题 2：fnm.zip 未自动删除（待清理）

- **现象**：Step 1 下载的 `D:\kaifahuanjing\fnm\fnm.zip`（3.3MB）因 Trae CN 沙箱限制未自动删除
- **影响**：占 3.3MB 磁盘空间
- **决策**：需用户手动执行 `Remove-Item "D:\kaifahuanjing\fnm\fnm.zip"`

#### 问题 3：fnm 离开项目目录不自动切回 system（设计行为）

- **现象**：cd 进入 AIops 目录自动切换 v20.19.5；cd 离开后仍是 v20.19.5
- **原因**：fnm 的 `--use-on-cd` 只在进入含 .nvmrc 的目录时触发切换，离开时不切换
- **决策**：接受 fnm 设计行为，新开 PowerShell 窗口或 `fnm use system` 可切回 v24

### 镜像源使用情况

- **临时镜像源**：`$env:FNM_NODE_DIST_MIRROR = "https://npmmirror.com/mirrors/node/"`（仅当前会话生效）
- **未永久写入用户级环境变量**：保持灵活性，未来安装其他 Node 版本时按需临时设置

### 文档同步情况

本次执行后已同步更新以下文件：

- ✅ `c:\Users\123\.trae-cn\user_rules\rule-env-python-node-git.md`（§1 Node.js 环境、§7 多版本环境、§七 工具链路径速查）
- ✅ `c:\Users\123\.trae-cn\memory\user_profile.md`（§1 Node.js 环境、§7 多版本环境）
- ✅ `c:\Users\123\.trae-cn\memory\projects\-c-Users-123-Desktop-daima-AIops\project_memory.md`（追加 fnm 安装记录）
- ✅ 本文件（追加第十二章 实际执行记录）
