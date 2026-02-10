# TRAD Stock Monitor Extension Publishing Guide

## ✅ **准备工作已完成**

### **1. 扩展打包**
- ✅ **package.json** 已更新为您的GitHub仓库：`https://github.com/andonox/trad_monitor_vscode.git`
- ✅ **.vscodeignore** 已创建，排除不必要的文件
- ✅ **扩展已重新打包**：`trad-stock-monitor-0.1.0.vsix` (61.67KB, 31个文件)
- ✅ **扩展已本地安装测试**：安装成功

### **2. 文件验证**
```bash
# 验证package.json配置
vsce verify

# 查看扩展内容
vsce ls --tree
```

## 🚀 **发布到 VS Code Marketplace**

### **步骤1：创建 Azure DevOps 账户**
1. **访问** [Azure DevOps 组织创建页面](https://aka.ms/SignupAzureDevOps)
2. **创建组织**：名称任意（如 `trad-org`）
3. **记住组织URL**：`https://dev.azure.com/trad-org/`

### **步骤2：创建发布者账户**
1. **登录** [Visual Studio Marketplace 发布者管理](https://marketplace.visualstudio.com/manage)
2. **创建发布者**：名称必须为 `trad`（与package.json中的`"publisher": "trad"`一致）
3. **验证邮箱**（如果需要）

### **步骤3：生成个人访问令牌 (PAT)**
1. **访问** 您的Azure DevOps组织设置：`https://dev.azure.com/trad-org/_settings/security`
2. **创建新令牌**：
   - **名称**：`VS Marketplace Publish`
   - **组织**：选择您的组织
   - **范围**：`Marketplace`
   - **权限**：`Manage`（发布）
   - **有效期**：建议1年
3. **复制令牌**（只显示一次！）

### **步骤4：发布扩展**

#### **方法A：使用PAT直接发布**
```bash
vsce publish -p <YOUR_PAT_TOKEN>
```

#### **方法B：先登录再发布**
```bash
vsce login trad  # 使用发布者名称 "trad"
# 提示时输入PAT令牌
vsce publish
```

#### **方法C：测试发布（不实际发布）**
```bash
vsce publish --dry-run
```

## 📝 **发布验证**

### **发布后检查**
1. **访问扩展页面**：`https://marketplace.visualstudio.com/items?itemName=trad.trad-stock-monitor`
2. **验证信息**：
   - 名称：TRAD Stock Monitor
   - 版本：0.1.0
   - 发布者：trad
   - 仓库链接：`https://github.com/andonox/trad_monitor_vscode.git`

### **更新扩展**
```bash
# 1. 更新package.json中的版本号（如0.1.1）
# 2. 更新CHANGELOG.md
# 3. 重新编译和打包
npm run compile
vsce package

# 4. 发布新版本
vsce publish
```

## ⚠️ **常见问题**

### **问题1：发布者名称不匹配**
```
Error: The Personal Access Token is not valid for publishing extensions for the publisher 'trad'.
```
**解决方案**：
- 确保Marketplace发布者名称与package.json中的`publisher`字段完全一致
- 区分大小写：`trad` ≠ `Trad` ≠ `TRAD`

### **问题2：PAT权限不足**
```
Error: Access Denied: The Personal Access Token used has expired.
```
**解决方案**：
- 重新生成PAT，确保选择`Marketplace`范围和`Manage`权限
- 检查PAT是否过期

### **问题3：仓库URL无效**
```
Error: Repository URL is invalid or not accessible.
```
**解决方案**：
- 确保GitHub仓库存在且可公开访问
- 或者暂时使用：`vsce publish --no-dependencies`

## 🔧 **本地测试（发布前必做）**

### **1. 完整功能测试**
```bash
# 运行功能测试脚本
./test_functional.sh

# 运行安装测试
./test_installation.sh
```

### **2. 手动测试步骤**
1. **重启VSCode** (Ctrl+R)
2. **验证TRAD图标**出现在活动栏
3. **打开TRAD Stock Monitor视图**
4. **添加测试股票**（代码：600000，价格：10.5，数量：100）
5. **启动监控**并验证数据更新
6. **检查详细视图**

### **3. 验证配置持久化**
- 配置保存在：`~/.trad/config.json`
- 重启VSCode后配置应保留

## 📊 **扩展信息**

| 字段 | 值 |
|------|-----|
| **名称** | TRAD Stock Monitor |
| **版本** | 0.1.0 |
| **发布者** | trad |
| **分类** | Other |
| **VSCode版本** | ^1.60.0 |
| **仓库** | https://github.com/andonox/trad_monitor_vscode.git |
| **许可证** | MIT |
| **关键词** | stock, monitor, trading, finance, chinese, a-share |

## 📞 **支持**

- **GitHub Issues**：https://github.com/andonox/trad_monitor_vscode/issues
- **Marketplace评论**：扩展页面下的评论区域
- **VS Code扩展文档**：https://code.visualstudio.com/api

## 🎯 **发布完成标志**

✅ **扩展出现在Marketplace**：搜索"TRAD Stock Monitor"
✅ **可安装**：在VSCode中搜索并安装扩展
✅ **功能正常**：股票监控、配置管理、实时更新
✅ **用户反馈**：收集并回应GitHub Issues

---

**发布后**：建议监控扩展的下载量、评分和用户反馈，根据反馈进行版本更新。

**祝您发布顺利！**