#!/bin/bash
# TRAD股票监控插件测试运行脚本

set -e  # 遇到错误时退出

echo "=========================================="
echo "TRAD股票监控插件测试套件"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函数：打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 函数：检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "命令 '$1' 未找到，请先安装"
        exit 1
    fi
}

# 函数：运行测试并检查结果
run_test() {
    local test_name=$1
    local test_command=$2

    print_info "运行测试: $test_name"
    echo "命令: $test_command"
    echo "------------------------------------------"

    if eval $test_command; then
        print_success "$test_name 测试通过"
        return 0
    else
        print_error "$test_name 测试失败"
        return 1
    fi
}

# 主函数
main() {
    local total_tests=0
    local passed_tests=0
    local failed_tests=0

    # 检查必要命令
    print_info "检查必要命令..."
    check_command "npm"
    check_command "python3"
    check_command "pytest"

    # 获取项目根目录
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    cd "$PROJECT_ROOT"

    print_info "项目根目录: $PROJECT_ROOT"

    # 1. 安装TypeScript依赖
    print_info "安装TypeScript依赖..."
    if [ ! -d "node_modules" ]; then
        npm install
    else
        print_info "node_modules已存在，跳过安装"
    fi

    # 2. 安装Python测试依赖
    print_info "安装Python测试依赖..."
    if [ -f "scripts/requirements-test.txt" ]; then
        pip3 install -r scripts/requirements-test.txt
    else
        print_warning "未找到requirements-test.txt文件"
    fi

    # 3. 编译TypeScript代码
    print_info "编译TypeScript代码..."
    npm run compile

    # 4. 运行TypeScript单元测试
    ((total_tests++))
    if run_test "TypeScript单元测试" "npm run test:unit"; then
        ((passed_tests++))
    else
        ((failed_tests++))
    fi

    # 5. 运行TypeScript单元测试覆盖率
    ((total_tests++))
    if run_test "TypeScript测试覆盖率" "npm run test:unit:coverage"; then
        ((passed_tests++))
    else
        ((failed_tests++))
    fi

    # 6. 运行Python单元测试
    ((total_tests++))
    if run_test "Python单元测试" "cd scripts && python3 -m pytest ../tests/python/unit/ -v --cov=stock_daemon --cov-report=term-missing"; then
        ((passed_tests++))
    else
        ((failed_tests++))
    fi

    # 7. 运行Python集成测试
    ((total_tests++))
    if run_test "Python集成测试" "cd scripts && python3 -m pytest ../tests/python/integration/ -v -m integration"; then
        ((passed_tests++))
    else
        ((failed_tests++))
    fi

    # 8. 运行端到端测试（如果存在）
    if [ -f "out/test/runTest.js" ]; then
        ((total_tests++))
        if run_test "VSCode端到端测试" "npm run test:e2e"; then
            ((passed_tests++))
        else
            ((failed_tests++))
        fi
    else
        print_warning "未找到端到端测试，跳过"
    fi

    # 9. 运行所有测试
    ((total_tests++))
    if run_test "所有测试" "npm run test:all"; then
        ((passed_tests++))
    else
        ((failed_tests++))
    fi

    # 10. 生成测试报告
    print_info "生成测试报告..."

    # TypeScript覆盖率报告
    if [ -d "coverage" ]; then
        print_info "TypeScript覆盖率报告已生成: file://$PROJECT_ROOT/coverage/lcov-report/index.html"
    fi

    # Python覆盖率报告
    if [ -d "scripts/htmlcov" ]; then
        print_info "Python覆盖率报告已生成: file://$PROJECT_ROOT/scripts/htmlcov/index.html"
    fi

    # 输出测试摘要
    echo ""
    echo "=========================================="
    echo "测试摘要"
    echo "=========================================="
    echo "总测试套件: $total_tests"
    echo -e "${GREEN}通过: $passed_tests${NC}"

    if [ $failed_tests -gt 0 ]; then
        echo -e "${RED}失败: $failed_tests${NC}"
        echo ""
        print_error "部分测试失败，请检查详细输出"
        exit 1
    else
        echo -e "${GREEN}失败: $failed_tests${NC}"
        echo ""
        print_success "所有测试通过！"
        exit 0
    fi
}

# 处理命令行参数
case "$1" in
    "typescript")
        print_info "只运行TypeScript测试..."
        npm run test:unit
        npm run test:unit:coverage
        ;;
    "python")
        print_info "只运行Python测试..."
        cd scripts && python3 -m pytest ../tests/python/ -v --cov=stock_daemon --cov-report=term-missing
        ;;
    "unit")
        print_info "只运行单元测试..."
        npm run test:unit
        cd scripts && python3 -m pytest ../tests/python/unit/ -v
        ;;
    "integration")
        print_info "只运行集成测试..."
        cd scripts && python3 -m pytest ../tests/python/integration/ -v -m integration
        ;;
    "coverage")
        print_info "生成覆盖率报告..."
        npm run test:unit:coverage
        cd scripts && python3 -m pytest ../tests/python/ -v --cov=stock_daemon --cov-report=html
        ;;
    "clean")
        print_info "清理测试文件..."
        rm -rf coverage
        rm -rf scripts/.coverage
        rm -rf scripts/htmlcov
        rm -rf scripts/__pycache__
        rm -rf tests/__pycache__
        rm -rf tests/python/__pycache__
        rm -rf tests/python/unit/__pycache__
        rm -rf tests/python/integration/__pycache__
        print_success "清理完成"
        ;;
    "help"|"-h"|"--help")
        echo "用法: $0 [选项]"
        echo ""
        echo "选项:"
        echo "  typescript    只运行TypeScript测试"
        echo "  python        只运行Python测试"
        echo "  unit          只运行单元测试"
        echo "  integration   只运行集成测试"
        echo "  coverage      生成覆盖率报告"
        echo "  clean         清理测试文件"
        echo "  help          显示此帮助信息"
        echo ""
        echo "如果不提供选项，则运行所有测试"
        ;;
    *)
        # 运行所有测试
        main
        ;;
esac