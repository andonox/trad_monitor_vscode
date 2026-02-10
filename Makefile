# TRAD股票监控插件Makefile

.PHONY: help install test test-ts test-py test-unit test-integration coverage clean

# 默认目标
.DEFAULT_GOAL := help

# 帮助信息
help:
	@echo "TRAD股票监控插件构建和测试工具"
	@echo ""
	@echo "可用命令:"
	@echo "  make install     安装所有依赖"
	@echo "  make test        运行所有测试"
	@echo "  make test-ts     运行TypeScript测试"
	@echo "  make test-py     运行Python测试"
	@echo "  make test-unit   运行单元测试"
	@echo "  make test-integration 运行集成测试"
	@echo "  make coverage    生成覆盖率报告"
	@echo "  make clean       清理生成的文件"
	@echo "  make help        显示此帮助信息"
	@echo ""
	@echo "环境变量:"
	@echo "  COVERAGE_MIN=85  设置最小覆盖率阈值（默认85%）"

# 安装依赖
install: install-ts install-py

install-ts:
	@echo "安装TypeScript依赖..."
	npm install

install-py:
	@echo "安装Python依赖..."
	cd scripts && pip3 install -r requirements-test.txt

# 编译TypeScript
compile:
	@echo "编译TypeScript代码..."
	npm run compile

# 运行所有测试
test: compile test-ts test-py

# 运行TypeScript测试
test-ts: compile
	@echo "运行TypeScript测试..."
	npm run test:unit

# 运行Python测试
test-py:
	@echo "运行Python测试..."
	cd scripts && python3 -m pytest ../tests/python/ -v --cov=stock_daemon --cov-report=term-missing

# 运行单元测试
test-unit: compile
	@echo "运行TypeScript单元测试..."
	npm run test:unit
	@echo "运行Python单元测试..."
	cd scripts && python3 -m pytest ../tests/python/unit/ -v

# 运行集成测试
test-integration:
	@echo "运行集成测试..."
	cd scripts && python3 -m pytest ../tests/python/integration/ -v -m integration

# 生成覆盖率报告
coverage: coverage-ts coverage-py

coverage-ts: compile
	@echo "生成TypeScript覆盖率报告..."
	npm run test:unit:coverage
	@if [ -d "coverage" ]; then \
		echo "TypeScript覆盖率报告: file://$(PWD)/coverage/lcov-report/index.html"; \
	fi

coverage-py:
	@echo "生成Python覆盖率报告..."
	cd scripts && python3 -m pytest ../tests/python/ -v --cov=stock_daemon --cov-report=html
	@if [ -d "scripts/htmlcov" ]; then \
		echo "Python覆盖率报告: file://$(PWD)/scripts/htmlcov/index.html"; \
	fi

# 检查覆盖率阈值
check-coverage: coverage-ts coverage-py
	@echo "检查覆盖率阈值..."
	@echo "TypeScript覆盖率:"
	@if [ -f "coverage/coverage-summary.json" ]; then \
		node -e " \
			const fs = require('fs'); \
			const data = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8')); \
			const total = data.total; \
			const min = process.env.COVERAGE_MIN || 85; \
			console.log('Lines: ' + total.lines.pct + '%'); \
			console.log('Statements: ' + total.statements.pct + '%'); \
			console.log('Functions: ' + total.functions.pct + '%'); \
			console.log('Branches: ' + total.branches.pct + '%'); \
			if (total.lines.pct < min || total.statements.pct < min || total.functions.pct < min || total.branches.pct < min) { \
				console.error('错误: 覆盖率低于阈值 ' + min + '%'); \
				process.exit(1); \
			} \
		"; \
	else \
		echo "警告: 未找到TypeScript覆盖率报告"; \
	fi
	@echo "Python覆盖率:"
	@if [ -f "scripts/.coverage" ]; then \
		cd scripts && python3 -m coverage report --fail-under=$(or $(COVERAGE_MIN),85) || exit 1; \
	else \
		echo "警告: 未找到Python覆盖率报告"; \
	fi

# 清理生成的文件
clean:
	@echo "清理生成的文件..."
	rm -rf out
	rm -rf coverage
	rm -rf scripts/.coverage
	rm -rf scripts/htmlcov
	rm -rf scripts/__pycache__
	rm -rf tests/__pycache__
	rm -rf tests/python/__pycache__
	rm -rf tests/python/unit/__pycache__
	rm -rf tests/python/integration/__pycache__
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "清理完成"

# 开发模式：监听文件变化并自动测试
dev: compile
	@echo "启动开发模式..."
	@echo "TypeScript文件监听中..."
	npm run watch &
	@echo "TypeScript测试监听中..."
	npm run test:unit:watch &
	@wait

# 预提交检查
pre-commit: test check-coverage
	@echo "预提交检查通过"

# 构建发布版本
build: clean compile
	@echo "构建发布版本..."
	vsce package
	@if [ -f "*.vsix" ]; then \
		echo "发布包已生成: $(shell ls *.vsix)"; \
	fi

# 运行端到端测试
test-e2e: compile
	@echo "运行端到端测试..."
	npm run test:e2e

# 性能测试
perf-test:
	@echo "运行性能测试..."
	@echo "TypeScript性能测试..."
	npm run test:unit -- --testNamePattern="性能测试"
	@echo "Python性能测试..."
	cd scripts && python3 -m pytest ../tests/python/ -v -m performance

# 安全检查
security-check:
	@echo "运行安全检查..."
	@echo "检查npm依赖漏洞..."
	npm audit
	@echo "检查Python依赖漏洞..."
	cd scripts && pip-audit || echo "pip-audit未安装，跳过Python安全检查"

# 代码质量检查
lint:
	@echo "运行代码质量检查..."
	@echo "TypeScript代码检查..."
	npx eslint src/**/*.ts --fix || true
	@echo "Python代码检查..."
	cd scripts && python3 -m black stock_daemon.py --check || true
	cd scripts && python3 -m isort stock_daemon.py --check-only || true
	cd scripts && python3 -m flake8 stock_daemon.py || true

# 格式化代码
format:
	@echo "格式化代码..."
	@echo "格式化TypeScript代码..."
	npx prettier --write "src/**/*.ts"
	@echo "格式化Python代码..."
	cd scripts && python3 -m black stock_daemon.py
	cd scripts && python3 -m isort stock_daemon.py

# 依赖更新
update-deps:
	@echo "更新依赖..."
	@echo "更新npm依赖..."
	npm update
	@echo "更新Python依赖..."
	cd scripts && pip3 list --outdated --format=freeze | grep -v '^\-e' | cut -d = -f 1 | xargs -n1 pip3 install -U || true

# 版本管理
version:
	@echo "当前版本:"
	@node -e "console.log(require('./package.json').version)"
	@echo ""
	@echo "可用命令:"
	@echo "  make version-patch  更新补丁版本 (x.y.z -> x.y.z+1)"
	@echo "  make version-minor  更新次要版本 (x.y.z -> x.y+1.0)"
	@echo "  make version-major  更新主要版本 (x.y.z -> x+1.0.0)"

version-patch:
	@npm version patch

version-minor:
	@npm version minor

version-major:
	@npm version major