# TRAD Stock Monitor 扩展发布步骤（详细版）

## 📋 前提条件

1. **已安装 vsce 工具**：`npm install -g @vscode/vsce`
2. **已打包扩展**：`trad-stock-monitor-0.1.0.vsix` 文件已存在
3. **扩展已通过本地测试**：可以正常安装和使用

## 🚀 发布到 VS Code Marketplace 完整步骤

### 步骤 1：创建 Azure DevOps 账户

1. **访问** [Azure DevOps 组织创建页面](https://aka.ms/SignupAzureDevOps)
2. **使用 Microsoft 账户登录**（如果没有，需要先注册）
3. **创建新组织**：
   - 组织名称：建议使用 `trad-org`（可自定义）
   - 区域：选择离您最近的区域
4. **记住组织 URL**：`https://dev.azure.com/trad-org/`（将 `trad-org` 替换为您的组织名称）

### 步骤 2：创建 Marketplace 发布者账户

**重要**：发布者名称必须与 package.json 中的 `"publisher": "trad"` 完全一致，区分大小写。

1. **访问** [Visual Studio Marketplace 发布者管理](https://marketplace.visualstudio.com/manage)
2. **使用 Microsoft 账户登录**（与 Azure DevOps 相同的账户）
3. **创建发布者**：
   - 发布者 ID：`trad`（必须输入小写的 `trad`）
   - 发布者名称：`TRAD`（显示名称，可自定义）
   - 描述：`TRAD Stock Monitor 扩展发布者`
4. **验证邮箱**（如果需要）
5. **接受服务条款**

### 步骤 3：生成个人访问令牌 (PAT)

1. **访问您的 Azure DevOps 组织安全设置**：
   - 格式：`https://dev.azure.com/{您的组织名称}/_settings/security`
   - 例如：`https://dev.azure.com/trad-org/_settings/security`

2. **创建新令牌**：
   - 点击 "New Token" 或 "创建新令牌"
   - 填写以下信息：
     - **名称**：`VS Marketplace Publish`
     - **组织**：选择您创建的组织
     - **范围**：选择 `Marketplace`
     - **权限**：选择 `Manage`（发布权限）
     - **有效期**：建议 1 年（90天-1年均可）
   - 点击 "Create" 或 "创建"

3. **复制令牌**：
   - **重要**：令牌只显示一次！请立即复制并保存到安全的地方。
   - 令牌格式：一串类似 `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 的字符

### 步骤 4：发布扩展

您有三种发布方式可选：

#### 方式 A：使用脚本发布（推荐）

```bash
# 1. 确保有执行权限
chmod +x publish_extension.sh

# 2. 运行发布脚本
./publish_extension.sh

# 3. 根据提示选择发布方式（推荐选项1或3）
```

脚本会引导您完成发布过程。

#### 方式 B：手动命令发布

```bash
# 方法1：使用PAT直接发布（需要将 YOUR_PAT_TOKEN 替换为您的实际令牌）
vsce publish -p YOUR_PAT_TOKEN

# 方法2：先登录再发布
vsce login trad   # 提示时输入您的PAT令牌
vsce publish
```

#### 方式 C：测试发布（不实际发布）

```bash
# 只检查是否可以发布，不会实际发布到Marketplace
vsce publish --dry-run
```

### 步骤 5：验证发布

1. **等待几分钟**：发布后需要一些时间才能在 Marketplace 显示
2. **访问扩展页面**：
   - `https://marketplace.visualstudio.com/items?itemName=trad.trad-stock-monitor`
3. **验证信息**：
   - 名称：TRAD Stock Monitor
   - 版本：0.1.0
   - 发布者：trad
   - 描述：Real-time A-share stock profit/loss monitoring
4. **在 VSCode 中搜索安装**：
   - 打开 VSCode
   - 进入 Extensions 视图 (Ctrl+Shift+X)
   - 搜索 "TRAD Stock Monitor"
   - 点击安装

## ⚠️ 常见问题与解决方案

### 问题 1：发布者名称不匹配
```
Error: The Personal Access Token is not valid for publishing extensions for the publisher 'trad'.
```

**解决方案**：
- 确保 Marketplace 发布者名称与 package.json 中的 `publisher` 字段完全一致
- 区分大小写：`trad` ≠ `Trad` ≠ `TRAD`
- 检查发布者管理页面：https://marketplace.visualstudio.com/manage

### 问题 2：PAT 权限不足
```
Error: Access Denied: The Personal Access Token used has expired.
Error: Access Denied: The provided token is not valid for this operation.
```

**解决方案**：
1. 重新生成 PAT，确保选择 `Marketplace` 范围和 `Manage` 权限
2. 检查 PAT 是否过期
3. 确保 PAT 关联的组织与 Marketplace 发布者关联的组织一致

### 问题 3：仓库 URL 验证失败
```
Error: Repository URL is invalid or not accessible.
```

**解决方案**：
- 暂时忽略此检查：`vsce publish --no-dependencies`
- 或者确保 GitHub 仓库存在且可公开访问（虽然您说暂时不推送，但 URL 需要有效）

### 问题 4：扩展名称冲突
```
Error: Extension 'trad.trad-stock-monitor' already exists.
```

**解决方案**：
- 更新 package.json 中的版本号（如 0.1.1）
- 重新打包：`vsce package`
- 重新发布

## 🔧 发布前检查清单

- [ ] package.json 中的 `publisher` 字段为 `"trad"`
- [ ] package.json 中的 `version` 字段为 `"0.1.0"`
- [ ] `.vsix` 文件存在且可读
- [ ] 已创建 Azure DevOps 账户
- [ ] 已创建 Marketplace 发布者 `trad`
- [ ] 已生成 PAT 令牌（具有 Marketplace Manage 权限）
- [ ] 已备份 PAT 令牌到安全位置

## 📝 发布后操作

1. **测试安装**：在另一台电脑或新的 VSCode 实例中安装扩展
2. **更新 README**：如果推送代码到 GitHub，更新 README 中的徽章和链接
3. **收集反馈**：监控 Marketplace 评论和 GitHub Issues
4. **计划更新**：根据用户反馈规划下一个版本

## 🆘 紧急情况

如果发布过程中遇到问题：

1. **查看详细错误信息**：添加 `--verbose` 参数，如 `vsce publish -p YOUR_PAT_TOKEN --verbose`
2. **尝试跳过依赖检查**：`vsce publish --no-dependencies`
3. **检查网络连接**：确保可以访问 marketplace.visualstudio.com
4. **重新生成 PAT**：旧的 PAT 可能已失效

## 📞 支持

- **VS Code 扩展文档**：https://code.visualstudio.com/api
- **Marketplace 发布指南**：https://aka.ms/vscode-marketplace-publish
- **Azure DevOps 支持**：https://azure.microsoft.com/support/devops/

---

**祝您发布顺利！** 🎉

发布成功后，您的扩展将可供全球 VSCode 用户搜索和安装。