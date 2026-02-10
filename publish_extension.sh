#!/bin/bash
# TRAD Stock Monitor Extension Publish Script
# 安全发布扩展到 VS Code Marketplace

set -e

echo "=== TRAD Stock Monitor 扩展发布脚本 ==="
echo ""

# 检查发布者名称
PUBLISHER=$(grep '\"publisher\"' package.json | head -1 | sed 's/.*: \"\\(.*\\)\".*/\\1/')
echo "发布者名称: $PUBLISHER"

# 检查版本号
VERSION=$(grep '\"version\"' package.json | head -1 | sed 's/.*: \"\\(.*\\)\".*/\\1/')
echo "版本号: $VERSION"

# 检查 .vsix 文件
VSIX_FILE="trad-stock-monitor-$VERSION.vsix"
if [ ! -f "$VSIX_FILE" ]; then
    echo "❌ 找不到 .vsix 文件: $VSIX_FILE"
    echo "请先运行: vsce package"
    exit 1
fi

echo "✅ 找到 .vsix 文件: $VSIX_FILE ($(du -h "$VSIX_FILE" | cut -f1))"

echo ""
echo "=== 发布选项 ==="
echo ""
echo "请选择发布方式："
echo "1. 使用 PAT 直接发布"
echo "2. 先登录再发布"
echo "3. 测试发布（不实际发布）"
echo ""

read -p "请输入选项 (1-3): " choice

case $choice in
    1)
        # 方法A：使用PAT直接发布
        echo ""
        echo "=== 使用 PAT 直接发布 ==="
        echo ""
        echo "请注意：PAT令牌将不会保存在脚本中，每次需要手动输入"
        echo ""
        read -sp "请输入您的 PAT 令牌: " PAT_TOKEN
        echo ""

        if [ -z "$PAT_TOKEN" ]; then
            echo "❌ PAT令牌不能为空"
            exit 1
        fi

        echo "正在发布扩展..."
        vsce publish -p "$PAT_TOKEN"
        ;;

    2)
        # 方法B：先登录再发布
        echo ""
        echo "=== 先登录再发布 ==="
        echo ""
        echo "步骤1: 登录到发布者账户 '$PUBLISHER'"
        echo "步骤2: 输入 PAT 令牌"
        echo "步骤3: 发布扩展"
        echo ""
        read -p "按 Enter 键开始登录..."

        vsce login "$PUBLISHER"

        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ 登录成功"
            echo "正在发布扩展..."
            vsce publish
        else
            echo "❌ 登录失败"
            exit 1
        fi
        ;;

    3)
        # 方法C：测试发布
        echo ""
        echo "=== 测试发布（不实际发布）==="
        echo ""
        echo "这只会检查扩展是否可以发布，不会实际发布到Marketplace"
        echo ""

        vsce publish --dry-run

        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ 测试发布成功！扩展可以正常发布。"
            echo ""
            echo "接下来可以："
            echo "1. 使用选项1或2实际发布"
            echo "2. 更新版本号后重新打包发布"
        fi
        ;;

    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

echo ""
echo "=== 发布完成 ==="
echo ""
echo "如果发布成功，您的扩展将在以下地址可见："
echo "https://marketplace.visualstudio.com/items?itemName=$PUBLISHER.trad-stock-monitor"
echo ""
echo "请等待几分钟让扩展在Marketplace上显示，然后可以通过VSCode搜索安装。"