#!/bin/bash
# TRAD股票监控插件启动脚本

echo "=== TRAD股票监控插件启动 ==="

# 检查是否在项目目录中
if [ ! -f "package.json" ]; then
    echo "错误：请在项目根目录中运行此脚本"
    exit 1
fi

# 检查TypeScript编译
echo "1. 检查TypeScript编译..."
if [ ! -d "out" ] || [ -z "$(ls -A out/ 2>/dev/null)" ]; then
    echo "   - 编译TypeScript代码..."
    npm run compile
    if [ $? -ne 0 ]; then
        echo "   ❌ TypeScript编译失败"
        exit 1
    fi
    echo "   ✅ TypeScript编译成功"
else
    echo "   ✅ TypeScript已编译"
fi

# 检查Node.js依赖
echo "2. 检查Node.js依赖..."
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "   - 安装Node.js依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "   ❌ Node.js依赖安装失败"
        exit 1
    fi
    echo "   ✅ Node.js依赖已安装"
else
    echo "   ✅ Node.js依赖已安装"
fi

# 检查Python依赖
echo "3. 检查Python依赖..."
python3 -c "import akshare, pandas, requests, aiohttp" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "   - 安装Python依赖..."
    pip install akshare pandas requests aiohttp
    if [ $? -ne 0 ]; then
        echo "   ❌ Python依赖安装失败"
        exit 1
    fi
    echo "   ✅ Python依赖已安装"
else
    echo "   ✅ Python依赖已安装"
fi

# 检查TypeScript监视进程
echo "4. 启动TypeScript监视进程..."
WATCH_PID=$(ps aux | grep "tsc -watch -p" | grep -v grep | awk '{print $2}')
if [ -z "$WATCH_PID" ]; then
    echo "   - 启动 npm run watch (后台进程)..."
    npm run watch > /dev/null 2>&1 &
    WATCH_PID=$!
    echo "   ✅ 监视进程已启动 (PID: $WATCH_PID)"
    echo "   📝 注意：监视进程将在后台运行，修改TypeScript代码会自动重新编译"
else
    echo "   ✅ TypeScript监视进程已在运行 (PID: $WATCH_PID)"
fi

# 启动VSCode扩展开发主机
echo "5. 启动VSCode扩展开发主机..."
echo "   - 打开新的VSCode窗口加载插件..."
code --extensionDevelopmentPath="$(pwd)" 2>/dev/null &
EXT_PID=$!
echo "   ✅ 扩展开发窗口已启动"

echo ""
echo "=========================================="
echo "✅ TRAD股票监控插件已成功启动！"
echo ""
echo "📌 使用说明："
echo "   1. 在新打开的VSCode窗口中："
echo "      - 点击左侧活动栏的 TRAD 图标"
echo "      - 点击 ⚙️ 配置 添加股票"
echo "      - 点击 ▶ 开始监控 启动实时监控"
echo ""
echo "   2. 如果要停止插件："
echo "      - 关闭扩展开发窗口"
echo "      - 运行: kill $WATCH_PID 停止监视进程"
echo ""
echo "   3. 开发调试："
echo "      - 按 Ctrl+R 重新加载扩展窗口"
echo "      - 修改代码会自动重新编译"
echo ""
echo "🔧 故障排除："
echo "   - 如果股票数据无法获取：检查网络连接和Python依赖"
echo "   - 如果插件未显示：按 Ctrl+Shift+P 输入 'Developer: Reload Window'"
echo "   - 查看日志：Ctrl+Shift+I 打开开发者工具"
echo "=========================================="
echo ""
echo "🎯 快速测试：打开配置界面，添加股票代码 '600000'，买入价 '10.5'，数量 '100'，然后开始监控。"

# 保存进程ID到文件以便清理
echo "WATCH_PID=$WATCH_PID" > .extension_pids
echo "EXT_PID=$EXT_PID" >> .extension_pids

# 等待用户按下回车
echo ""
read -p "按回车键显示进程状态，或按 Ctrl+C 退出..."

# 显示进程状态
echo ""
echo "当前进程状态："
ps -p $WATCH_PID -o pid,cmd 2>/dev/null || echo "监视进程已退出"
ps -p $EXT_PID -o pid,cmd 2>/dev/null || echo "扩展窗口已关闭"