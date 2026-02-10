#!/bin/bash
# TRAD股票监控插件停止脚本

echo "=== 停止TRAD股票监控插件 ==="

# 检查进程ID文件
if [ ! -f ".extension_pids" ]; then
    echo "❌ 未找到进程ID文件，可能插件未通过启动脚本运行"
    echo "   请手动停止相关进程："
    echo "   1. 查找TypeScript监视进程: ps aux | grep 'tsc -watch -p'"
    echo "   2. 关闭VSCode扩展开发窗口"
    exit 1
fi

# 读取进程ID
source .extension_pids 2>/dev/null

# 停止TypeScript监视进程
if [ ! -z "$WATCH_PID" ] && ps -p $WATCH_PID > /dev/null 2>&1; then
    echo "🛑 停止TypeScript监视进程 (PID: $WATCH_PID)..."
    kill $WATCH_PID 2>/dev/null
    sleep 1
    if ps -p $WATCH_PID > /dev/null 2>&1; then
        kill -9 $WATCH_PID 2>/dev/null
        echo "   ✅ 监视进程已强制停止"
    else
        echo "   ✅ 监视进程已停止"
    fi
else
    echo "   ℹ️ TypeScript监视进程未运行"
fi

# 停止VSCode扩展开发窗口（只能提醒用户手动关闭）
if [ ! -z "$EXT_PID" ] && ps -p $EXT_PID > /dev/null 2>&1; then
    echo "🛑 VSCode扩展开发窗口仍在运行 (PID: $EXT_PID)"
    echo "   请手动关闭该窗口，或运行: kill $EXT_PID"
else
    echo "   ℹ️ VSCode扩展开发窗口已关闭"
fi

# 清理进程ID文件
rm -f .extension_pids
echo "🧹 已清理进程记录"

echo ""
echo "=========================================="
echo "✅ TRAD股票监控插件已停止"
echo ""
echo "📌 如需重新启动，运行: ./start_extension.sh"
echo "=========================================="