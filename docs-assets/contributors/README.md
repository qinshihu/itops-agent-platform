# 贡献者头像文件夹

本文件夹用于存放项目贡献者的头像图片，包括 GitHub 用户、微信贡献者、社区成员等。

## 📁 目录结构

```
docs-assets/contributors/
├── README.md                    # 本说明文件
├── qinshihu.png                # 示例：GitHub 用户头像
├── wechat-friend1.png          # 示例：微信贡献者头像
├── community-member.png        # 示例：社区成员头像
└── ...                         # 其他贡献者头像
```

## 🖼️ 图片规范

### 格式要求
- **推荐格式**：PNG（支持透明背景）
- **备选格式**：JPG / JPEG
- **不推荐**：GIF（动画图在表格中可能显示异常）

### 尺寸要求
- **推荐尺寸**：200×200 像素（正方形）
- **最小尺寸**：100×100 像素
- **最大尺寸**：500×500 像素（避免过大文件）
- **文件大小**：建议 < 100KB

### 命名规范
```
GitHub 用户：  github-username.png          （如 qinshihu.png）
微信用户：    wechat-nickname.png           （如 wechat-xiaoming.png）
社区成员：    member-name.png               （如 member-zhangsan.png）
组织/公司：   org-organization.png          （如 org-mycompany.png）
```

## 📥 添加头像步骤

### 方式一：GitHub 用户（自动获取头像）

1. 访问 `https://github.com/用户名`
2. 右键点击头像 → 「在新标签页中打开图片」
3. 复制图片 URL（如 `https://avatars.githubusercontent.com/u/12345678?v=4`）
4. 在浏览器中打开该 URL，右键保存图片
5. 将图片重命名为 `用户名.png`
6. 放到此文件夹中

### 方式二：微信贡献者

1. 从微信中保存好友头像到本地
   - PC 微信：好友资料 → 右键头像 → 保存图片
   - 手机微信：好友资料 → 点击头像 → 长按 → 保存到相册
2. 将图片重命名为 `wechat-昵称.png`
3. 放到此文件夹中

### 方式三：其他贡献者（手动上传）

1. 收集贡献者头像图片
2. 使用图片编辑器裁剪为正方形
3. 重命名为有意义的文件名
4. 放到此文件夹中

## 🔗 在 README 中引用

在 README 的「特别鸣谢」表格中使用相对路径引用：

```markdown
| <img src="./docs-assets/contributors/qinshihu.png" width="60" height="60" style="border-radius:50%;" /> | **谭策** ([@qinshihu](https://github.com/qinshihu)) | 项目作者 | 项目架构设计、核心功能开发 |
```

## 💡 小贴士

1. **圆形头像**：表格中使用 `style="border-radius:50%;"` 自动将头像显示为圆形，无需提前裁剪
2. **透明背景**：如果头像有背景，建议使用 PNG 格式保留透明效果
3. **统一风格**：可以考虑所有头像使用相同的背景色或风格，保持视觉统一
4. **定期更新**：新增贡献者时，记得同时更新此文件夹和 README 表格

## ✅ 已添加头像列表

| 文件名 | 贡献者 | 类型 | 备注 |
|--------|--------|------|------|
| （等待添加） | | | |

> 添加新头像后，请在此表格中登记一行信息。
