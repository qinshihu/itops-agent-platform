# PowerShell 文件操作安全规则

> 本文档定义 PowerShell 操作文件时的编码安全规则。所有 AI 辅助开发工具在 Windows 环境下使用 PowerShell 修改文件时必须遵守本规则。
>

---

## 一、问题背景

### 1.1 事件回顾（2026-07-20）

使用 PowerShell 5.1 的 `Get-Content -Raw` + `Set-Content -NoNewline` 批量替换 `docs/` 目录下 11 个 markdown 文件的路径时，**导致 290 个中文字符被破坏成 U+FFFD**（替换字符），且因 `docs/` 在 `.gitignore` 中无法用 git 恢复。

### 1.2 根本原因

PowerShell 5.1（Windows 默认版本）的文件 cmdlet **默认编码不是 UTF-8**：

| Cmdlet        | PowerShell 5.1 默认编码      | PowerShell 7+ 默认编码 |
| ------------- | ---------------------------- | ---------------------- |
| `Get-Content` | ANSI（中文系统是 GBK/CP936） | UTF-8                  |
| `Set-Content` | ASCII                        | UTF-8                  |
| `Out-File`    | UTF-16 LE（带 BOM）          | UTF-8                  |

### 1.3 损坏机制

```
原始文件（UTF-8 无 BOM，含中文）
   ↓
Get-Content -Raw         ← 用 GBK 解码 UTF-8 字节，多字节序列被误读
   ↓
字符串内容（部分中文字符已错乱）
   ↓
-replace 正则替换         ← ASCII 路径替换本身正确
   ↓
Set-Content -NoNewline   ← 用 ASCII 写回，非 ASCII 字符 → ? (0x3F)
   ↓
最终文件（中文位置变成 U+FFFD，不可逆）
```

**关键点**：ASCII 路径替换会成功，但中文内容会被破坏。这意味着**测试替换结果时不能只看路径是否正确，必须检查中文是否完好**。

### 1.4 第二次事件回顾（2026-07-20）

使用 PowerShell 5.1 的 `Get-Content`（返回字符串数组）+ `$lines[0..N] | Out-File -Encoding UTF8 -NoNewline` 截断 `c:\Users\123\.trae-cn\memory\user_profile.md` 时，**导致所有换行符被替换为空格，整个文件变成一行**。

**直接原因**：PowerShell 5.1 中 `Out-File` 处理字符串数组时，默认行为是用空格连接数组元素（而不是换行符），即使指定 `-Encoding UTF8` 也无法改变这个行为。

**根本原因**：AI 违反了 [1.md §三 第 2 条](./top-rules.md)「文件操作必须用 Edit/Write 工具，禁止使用 RunCommand 操作文件」的规则。

**与第一次事件的区别**：

| 维度                  | 第一次（§1.1）                   | 第二次（§1.4）                       |
| --------------------- | -------------------------------- | ------------------------------------ |
| 失败层次              | 编码层（默认编码不安全）         | 行为层（数组拼接逻辑反直觉）         |
| 显式 UTF-8 是否能解决 | ✅ 能（用 .NET API）             | ❌ 不能（Out-File 行为本身就是错的） |
| 是否不可逆            | ✅ 不可逆（中文被替换成 U+FFFD） | ❌ 可逆（用 Write 工具重写即可）     |
| 违反的规则            | powershell.md §5.2               | 1.md §三 + powershell.md §5.2        |

**关键教训**：即使 PowerShell 指定了 `-Encoding UTF8`，行为仍然不可靠。**文件内容修改必须用 Edit/Write 工具，绝不能用 PowerShell cmdlet**。

### 1.5 第三次事件回顾（2026-07-21 · P1-#15）

执行 P1-#15「把 `src/routes/dc/` 14 个文件迁移到 `src/modules/dc/routes/`」时，AI 调用 PowerShell `Copy-Item` + `Get-Content ... -Encoding UTF8 | ForEach-Object { Set-Content ... -NoNewline }` 批改 import 路径，**导致 13 个文件约 100+ 中文字符被破坏**（`// 告警检测：按服务器真实状态判断` 等注释里的中文变成 `锟斤拷锟斤拷`）。

**直接原因**：第一次 `Set-Content` 的写法是 `Get-Content ... -Raw | Set-Content ... -NoNewline`，**没有显式 `-Encoding` 参数**。PowerShell 5.1 默认写入编码是 ASCII（/ UTF-16 LE BOM），把内存里已用 GBK 错读过的 UTF-8 字符串当 ASCII 重写，中文部分全部塌陷。

**修复过程**：

1. `git checkout HEAD -- backend/src/routes/dc/` 还原 legacy 源文件（**前提：源文件必须在 git 跟踪下**）
2. 改用 `node fs.readFileSync/writeFileSync` 二进制级拷贝（保留原始 UTF-8 字节）
3. 改用 `node` 字符串 replace 批改 import 路径（`const txt = fs.readFileSync(fp, 'utf8'); fs.writeFileSync(fp, txt.replace(...), 'utf8')`）
4. 验证：`tsc --noEmit` 0 错 + 测试 903 通过

**与前两次事件的差异**：

| 维度                       | 第一次（docs/）   | 第二次（user_profile）     | 第三次（dc 迁移）                              |
| -------------------------- | ----------------- | -------------------------- | ---------------------------------------------- |
| 操作类型                   | 文本替换          | 文本截断                   | 二进制拷贝 + 文本替换                         |
| 用错的方式                 | `Set-Content`     | `Out-File`                 | `Set-Content -NoNewline`                      |
| 错误根因                   | 默认编码 ASCII    | 数组 → 空格连接            | 默认编码 ASCII（再次！）                       |
| 显式 `-Encoding UTF8` 是否有用 | ✅               | ❌                         | ✅（完美解决）                                  |
| 是否可逆                   | ❌（docs/ 不在 git） | ✅（用 Edit 重写）       | ✅（git checkout 还原）                         |
| 教训                       | 别用 default encoding | 别用 Out-File 处理数组 | **批量文本操作改用 node fs，禁用 Set-Content** |

**关键教训**：

- 即使之前事故已发生 2 次、第 3 次仍复现 → 意味着**当前规则不够强**或**没在被想起**。
- 跨文件批量操作应**永远用 node 脚本**，把"用 PowerShell cmdlet 操作文件内容"在所有场景里都划上 ❌。
- 源文件若在 git 跟踪下 → 即使误操作也能 `git checkout` 还原（**这是底线保障**）。

---

## 二、强制规则

### 2.1 工具选择优先级

按以下优先级选择文件操作工具：

| 优先级 | 工具                      | 适用场景                                                       | 编码安全        |
| ------ | ------------------------- | -------------------------------------------------------------- | --------------- |
| 1      | **Edit 工具**             | 单文件少量精确替换                                             | ✅ UTF-8 安全   |
| 2      | **Write 工具**            | 单文件创建/重写                                                | ✅ UTF-8 安全   |
| 3      | **Grep 工具**             | 批量文本搜索（不修改文件）                                     | ✅ 只读         |
| 4      | **Node.js 脚本**          | 批量内容替换                                                   | ✅ 原生 UTF-8   |
| 5      | **PowerShell + .NET API** | 批量文件**操作**（重命名、移动，**不修改内容**）               | ⚠️ 需显式 UTF-8 |
| 6      | **PowerShell cmdlet**     | ❌ 禁止用于文件**内容修改**（含中文或不含中文都禁止，见 §1.4） | ❌ 危险         |

### 2.2 禁止操作

以下操作**严禁**用于含中文的文件：

```powershell
# ❌ 禁止：使用默认编码的 Get-Content + Set-Content
$content = Get-Content -Path $file -Raw
Set-Content -Path $file -Value $newContent -NoNewline

# ❌ 禁止：使用默认编码的 Out-File
Get-Process | Out-File -FilePath $file

# ❌ 禁止：使用重定向操作符（默认 ASCII）
"some content" > $file
"some content" >> $file
```

### 2.4 强制规则：批量文件操作只能用 Node.js（2026-07-21 新增 §1.5 事件）

**适用场景**：跨多个文件做以下任一操作：

- 批量导入路径替换（如 `'../../repositories'` → `'../../../repositories'`）
- 批量重命名
- 批量文本替换（变量名、字段名、API key 等）
- 批量文件复制并改造内容（**第三次事件主因**）

**禁止的写法**：

```powershell
# ❌ 禁止：PowerShell + Set-Content 批量替换
Get-ChildItem *.ts | ForEach-Object {
  $c = Get-Content $_ -Raw;       # 默认编码 GBK 错读
  $c = $c -replace "...", "...";  # 字符串已损坏
  Set-Content $_ $c -NoNewline    # 默认 ASCII 写回，塌陷
}
```

**唯一允许的批量写法**：Node.js + fs

```javascript
// ✅ 强制：用 node fs 批量替换（保留 UTF-8 字节完整）
const fs = require('fs');
const path = require('path');
const dst = 'c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes';
const reps = [
  ['../../repositories', '../../../repositories'],
  ['../../middleware/auth', '../../../middleware/auth'],
  ['../../utils/errorHelpers', '../../../utils/errorHelpers'],
];
for (const f of fs.readdirSync(dst)) {
  const fp = path.join(dst, f);
  let txt = fs.readFileSync(fp, 'utf8');
  for (const [o, n] of reps) txt = txt.split(o).join(n);
  fs.writeFileSync(fp, txt, 'utf8');
}
```

**为什么选 Node.js**：

| 维度                | PowerShell 5.1 + cmdlet        | Node.js              |
| ------------------- | ------------------------------ | -------------------- |
| 默认编码            | ASCII / GBK / UTF-16（不可控） | UTF-8                |
| 跨平台              | 仅 Windows                     | 全平台               |
| 字符串处理          | `-replace` 语法特殊             | 标准 JS 字符串方法   |
| 错误可逆            | 视场景而定（第三次事件严重）    | 写出前可用 git 复原 |
| 推荐指数            | ❌（已 3 次事故）              | ✅（强推）          |

### 2.3 安全操作模式

#### 模式 A：单文件编辑（推荐使用 Edit 工具）

```
直接使用 Edit 工具，无需 PowerShell
```

#### 模式 B：批量替换（推荐使用 Node.js）

```javascript
// replace-paths.js
const fs = require('fs');

function replaceInFile(filePath, oldStr, newStr) {
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = content.split(oldStr).join(newStr);
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

const files = ['docs/file1.md', 'docs/file2.md'];

files.forEach((f) => replaceInFile(f, 'old/path', 'new/path'));
```

执行：`node replace-paths.js`（Node.js 原生 UTF-8，无编码问题）

#### 模式 C：PowerShell 批量替换（必须用 .NET API）

```powershell
# ✅ 安全：使用 .NET API 显式指定 UTF-8
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

Get-ChildItem -Path $targetDir -Filter "*.md" -File | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
    $newContent = $content -replace [regex]::Escape($oldStr), $newStr
    if ($content -ne $newContent) {
        [System.IO.File]::WriteAllText($_.FullName, $newContent, $utf8NoBom)
        Write-Host "Updated: $($_.Name)"
    }
}
```

**关键点**：

- 读取：`[System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)`
- 写入：`[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))`
- `$false` 表示不写 BOM，保持原文件风格

#### 模式 D：文件重命名/移动（PowerShell cmdlet 安全）

```powershell
# ✅ 安全：只改文件名，不动内容
Get-ChildItem -Path $dir -Filter "*.md" | Rename-Item -NewName { $_.Name -replace 'old', 'new' }

# ✅ 安全：移动文件
Move-Item -Path $source -Destination $dest
```

---

## 三、验证规则

### 3.1 修改前验证

操作前先检查文件是否含中文：

```powershell
# 检查文件是否含非 ASCII 字符
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$hasNonAscii = [regex]::IsMatch($content, '[^\x00-\x7F]')
if ($hasNonAscii) {
    Write-Host "WARNING: File contains non-ASCII characters, use UTF-8 safe method"
}
```

### 3.2 修改后验证

操作后必须验证中文是否完好：

```powershell
# ✅ 验证：检查是否有 U+FFFD 替换字符
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$replacementChars = ([regex]::Matches($content, "[\uFFFD]")).Count
if ($replacementChars -gt 0) {
    Write-Host "ERROR: $replacementChars corrupted characters detected in $file"
    Write-Host "DO NOT COMMIT — restore from backup immediately"
} else {
    Write-Host "OK: No corruption detected"
}
```

### 3.3 备份规则

对**不在 git 跟踪**下的文件（如 `docs/` 目录）进行批量修改前，必须先备份：

```powershell
# 批量修改前先备份
$backupDir = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item -Path $targetDir -Destination $backupDir -Recurse
Write-Host "Backup created: $backupDir"
```

---

## 四、PowerShell 版本说明

### 4.1 版本差异

| 特性               | PowerShell 5.1  | PowerShell 7+       |
| ------------------ | --------------- | ------------------- |
| 默认编码           | ANSI/ASCII      | UTF-8               |
| `Get-Content -Raw` | GBK（中文系统） | UTF-8               |
| `Set-Content`      | ASCII           | UTF-8               |
| 跨平台             | 仅 Windows      | Windows/Linux/macOS |

### 4.2 检查 PowerShell 版本

```powershell
$PSVersionTable.PSVersion
```

**本机环境**：PowerShell 5.1（Windows 默认版本，编码不安全）

### 4.3 升级建议

建议安装 PowerShell 7+（Core）用于文件操作：

```powershell
# 检查是否已安装 PowerShell 7
pwsh -v
```

如已安装，可用 `pwsh` 替代 `powershell` 执行脚本，默认 UTF-8 编码更安全。

---

## 五、AI 开发辅助规则

### 5.1 AI 在使用 PowerShell 前必须确认

1. **确认 PowerShell 版本**：`$PSVersionTable.PSVersion`
2. **确认文件编码**：是否为 UTF-8（无 BOM）
3. **确认文件是否含中文**：如有中文，必须使用 .NET API
4. **确认文件是否在 git 跟踪下**：如不在，必须先备份

### 5.2 AI 禁止的操作

- ❌ 禁止用 `Get-Content` + `Set-Content` 修改含中文的文件
- ❌ 禁止用 `>` 或 `>>` 重定向写入含中文的文件
- ❌ 禁止在未验证编码安全的情况下批量修改文件
- ❌ 禁止在未备份的情况下修改非 git 跟踪的文件
- ❌ **禁止用 RunCommand + 任何 PowerShell cmdlet（`Out-File` / `Set-Content` / `Add-Content` / `>` / `>>`）修改文件内容**，必须用 Edit/Write 工具。即使指定 `-Encoding UTF8` 也不可靠（详见 §1.4 第二次事件：Out-File 把字符串数组用空格连接，整个文件变成一行）。本条是对 [1.md §三](./top-rules.md) 「禁止使用 RunCommand 操作文件」的具体细化。
- ❌ **新增 2026-07-21**：禁止跨多个文件做内容修改时用任何 PowerShell cmdlets — 包括「复制 + 替换」、「批量重命名 + 改内容」、「批量改 import 路径」等。**必须用 node fs.readFileSync/writeFileSync**（详见 [§2.4](#24-强制规则批量文件操作只能用-nodejs2026-07-21-新增-15-事件) + [§1.5 第三次事件](#15-第三次事件回顾2026-07-21--p1-15)）。
- ❌ **强制自检**：执行批量操作前，AI 必须问自己「这个操作能被 n 次 Edit 调用替代吗？」如果能 → 用 Edit，不能才考虑 node 脚本，**永远不**考虑 PowerShell cmdlet。

### 5.3 AI 推荐的工作流

1. **单文件修改**：直接使用 Edit 工具
2. **批量搜索**：使用 Grep 工具
3. **批量替换**：
   - 优先：编写 Node.js 脚本执行
   - 次选：PowerShell + .NET API（显式 UTF-8）
4. **修改后验证**：检查 U+FFFD 字符数，确认中文未损坏
5. **提交前检查**：如文件在 git 跟踪下，用 `git diff` 复核

---

## 六、参考资源

- [PowerShell 5.1 编码问题详解](https://learn.microsoft.com/en-us/powershell/scripting/dev-cross-plat/character-encoding)
- [System.IO.File API 文档](https://learn.microsoft.com/en-us/dotnet/api/system.io.file)
- 本规则由 2026-07-20 `docs/` 目录编码损坏事件触发建立
- 关联规则：[1.md §九 本地 Node 环境](./top-rules.md)（推荐用 Node.js 替代 PowerShell 处理文件内容）

---

## 七、事件复盘记录

### 2026-07-20 `docs/` 目录编码损坏事件

- **触发场景**：用 `Get-Content -Raw` + `Set-Content -NoNewline` 批量替换 11 个 markdown 文件中的绝对路径
- **损坏范围**：11 个文件，共 88 处路径替换成功，但引入 290+ 个 U+FFFD 替换字符
- **无法恢复原因**：`docs/` 目录在 `.gitignore` 第 86 行，git 不跟踪
- **教训**：
  1. PowerShell 5.1 的 cmdlet 默认编码不安全
  2. 批量修改前必须备份
  3. 修改后必须验证中文完整性
  4. 非 git 跟踪文件更要谨慎，无恢复手段

### 2026-07-20 user_profile.md 换行符丢失事件（第二次）

- **触发场景**：用 PowerShell 截断 `c:\Users\123\.trae-cn\memory\user_profile.md` 删除 §11 §12 章节
- **错误操作**：`$lines = Get-Content $file; $lines[0..N] | Out-File -FilePath $file -Encoding UTF8 -NoNewline`
- **失败机制**：PowerShell 5.1 的 `Out-File` 处理字符串数组时用空格连接元素而非换行符，导致整个文件变成一行
- **恢复方式**：用 Write 工具重写整个文件，内容已完整恢复（无不可逆损失）
- **违反规则**：[1.md §三](./top-rules.md) 「禁止使用 RunCommand 操作文件」 + 本文件 [§5.2](#52-ai-禁止的操作)
- **与第一次事件的差异**：第一次是编码层失败（显式 UTF-8 能解决），第二次是行为层失败（显式 UTF-8 也救不了）
- **教训**：
  1. **PowerShell + 显式 UTF-8 也不可靠**：编码正确不代表行为正确
  2. 文件内容修改必须用 Edit/Write 工具，这是 [1.md §三](./top-rules.md) 的硬性规则
  3. AI 在执行文件操作前必须自问：「这个操作能用 Edit/Write 工具完成吗？」如果能，就必须用 Edit/Write
  4. RunCommand 仅用于系统命令和终端操作（git/npm/docker 等），不用于文件读写

### 2026-07-21 P1-#15 `src/routes/dc/` 14 文件编码事故（第三次 · 北京时间 02:00–03:00）

- **触发场景**：批量把 14 个 `src/routes/dc/*.ts` 复制到 `src/modules/dc/routes/*.ts`，并批改它们的 import 路径
- **错误操作**：
  ```powershell
  # 这是触发事故的写法（用了 -Encoding UTF8 也没用，因 Read 默认就是 GBK）
  Get-ChildItem "$dc\*.ts" | ForEach-Object {
    $c = Get-Content $_ -Raw -Encoding UTF8;
    [System.IO.File]::WriteAllText($_.FullName, $c, [System.Text.UTF8Encoding]::new($false))  # 也曾尝试过
  }
  ```
- **失败机制**：第二次 `Set-Content` 没显式参数 → 默认 ASCII 写回 → 中文全塌陷成 `锟斤拷`
- **损坏范围**：13 个文件，~ 100+ 中文字符（主要是注释里的中文状态/分类文案、错误提示等）
- **修复过程**：
  1. `git checkout HEAD -- backend/src/routes/dc/`（legacy 源在 git 跟踪下，可还原）
  2. 改用 `node fs.readFileSync/writeFileSync` 二进制级拷贝 → UTF-8 字节完整保留
  3. 改用 `node` 字符串 `split+join` 批改 import 路径
  4. `tsc --noEmit` 0 错 + `npm test` 903 通过 → 验证 OK
- **违反规则**：
  - [1.md §四](./top-rules.md) 「禁止使用 RunCommand 操作文件」
  - 本文件 [§2.4](#24-强制规则批量文件操作只能用-nodejs2026-07-21-新增-15-事件)（本节为该事件新增）
  - 本文件 [§5.2](#52-ai-禁止的操作)
- **与前两次事件的差异**：
  - 第一次（docs/）：默认编码 ASCII，不可逆
  - 第二次（user_profile）：Out-File 处理数组用空格连接，行为反直觉
  - **第三次（P1-#15）**：明知已存在问题，仍尝试 PowerShell cmdlet 写文件 → 默认编码再次塌陷
- **教训**：
  1. **批量文件内容修改永远用 node fs**，把"用 PS cmdlet 改文件内容"彻底划掉
  2. 已发生 2 次事故的规则仍被违反 → 必须在所有 batch 操作的工具调用前**强制插入自检**：能用 Edit/Write 吗？能 → 必须用 Edit/Write
  3. 源文件必须在 git 跟踪下，这是**底线保障**（否则不可逆）
  4. 业务上 `src/routes/dc/` 的 14 文件现已搬到 `src/modules/dc/routes/`，**但 `src/routes/dc/` 目录及 14 文件仍然存在**（git status 显示 deleted），后续 clean up 时 delete 即可
- **关联 ADR**：[ADR-025 §五.2](.trae/adr/025-p1-batch-fixes.md)
