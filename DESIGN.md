# TRAD股票监控VSCode插件设计方案

## 项目概述

基于现有的`stock_profit_calculator.py`脚本，开发一个VSCode插件，实现A股股票的实时盈亏监控功能。插件提供友好的图形界面，支持配置管理、实时数据更新（每20秒）和手动控制。

### 核心需求
1. **实时更新**：每20秒自动刷新股票数据
2. **配置管理**：支持添加/编辑/删除股票配置（代码、买入价、数量）
3. **控制功能**：一键开始/停止监控
4. **可视化显示**：在VSCode侧边栏清晰展示盈亏信息
5. **本地运行**：无需外部服务，完全本地化

## 系统架构

### 整体架构图
```
┌─────────────────────────────────────────────┐
│            VSCode Extension                 │
│  ┌─────────────┐  ┌────────────────────┐   │
│  │ TreeView    │  │ Webview Config     │   │
│  │ 股票列表显示  │  │ 配置管理界面       │   │
│  └─────────────┘  └────────────────────┘   │
│          │                     │            │
│  ┌───────▼─────────────────────▼────────┐   │
│  │      TypeScript Extension Core       │   │
│  │  • 状态管理                          │   │
│  │  • 定时器(20s)                       │   │
│  │  • Python进程通信                    │   │
│  └──────────────────────────────────────┘   │
│          │ IPC (JSON-RPC over stdio)        │
└──────────┼──────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────┐
│         Python Data Daemon                  │
│  • 异步数据获取引擎                         │
│  • 缓存管理                                │
│  • 实时盈亏计算                            │
│  • 配置持久化                              │
└─────────────────────────────────────────────┘
```

### 技术栈
- **前端**：TypeScript + VSCode Extension API
- **后端**：Python 3.8+ (asyncio, akshare, aiohttp)
- **通信**：JSON-RPC over stdio
- **配置**：JSON文件存储

## 详细设计

### 1. 目录结构
```
trad-vscode-plugin/
├── .vscode/                    # VSCode调试配置
├── src/                        # TypeScript源代码
│   ├── extension.ts            # 插件主入口
│   ├── stockProvider.ts        # TreeDataProvider
│   ├── configManager.ts        # 配置管理
│   ├── pythonClient.ts         # Python进程通信
│   ├── stateManager.ts         # 状态管理
│   ├── views/                  # UI组件
│   │   ├── stockView.ts        # 股票树视图
│   │   └── configWebview.ts    # 配置Webview
│   └── types/                  # 类型定义
│       ├── stock.ts
│       └── config.ts
├── scripts/                    # Python后端
│   ├── stock_daemon.py         # 主守护进程
│   ├── stock_client.py         # 轻量级客户端
│   └── requirements.txt        # Python依赖
├── media/                      # 图标资源
├── package.json                # 插件清单
├── tsconfig.json               # TypeScript配置
└── README.md
```

### 2. 配置管理设计

#### 2.1 配置数据结构
```typescript
interface StockConfig {
  code: string;           // 股票代码，如 "600000"
  name?: string;          // 股票名称（自动填充）
  buyPrice: number;       // 买入价格
  quantity: number;       // 买入数量
  enabled: boolean;       // 是否启用监控
  exchange?: string;      // 交易所后缀，如 "sh"（自动判断）
}

interface PluginConfig {
  version: string;        // 配置版本
  stocks: StockConfig[];  // 股票配置列表
  settings: {
    updateInterval: number;    // 更新间隔（秒），默认20
    autoStart: boolean;        // 启动时自动开始监控
    showNotifications: boolean; // 显示桌面通知
    priceAlertThreshold: number; // 价格预警阈值（%）
    dataSourcePriority: 'sina' | 'akshare'; // 数据源优先级
  };
}
```

#### 2.2 配置存储
- 位置：`~/.trad/config.json`
- 格式：带JSON Schema验证的JSON文件
- 备份：自动创建备份文件

#### 2.3 配置界面
**Webview配置面板布局**：
```
┌─────────────────────────────────────────────┐
│          股票监控配置                         │
├─────────────────────────────────────────────┤
│ 股票列表                                    │
│ ┌─────┬────────┬──────┬──────┬──────┬────┐ │
│ │ 代码│ 名称   │ 买入价│ 数量 │ 启用 │操作│ │
│ ├─────┼────────┼──────┼──────┼──────┼────┤ │
│ │600000│浦发银行│10.50 │100   │✅    │✏️✕ │ │
│ │000001│平安银行│15.20 │200   │✅    │✏️✕ │ │
│ │300750│宁德时代│200.00│50    │❌    │✏️✕ │ │
│ └─────┴────────┴──────┴──────┴──────┴────┘ │
│                                           │
│ [添加股票]                                │
│                                           │
│ 全局设置                                  │
│  更新间隔: 20 秒  [15|20|30|60]          │
│  □ 启动时自动开始监控                      │
│  □ 价格波动超过 5% 时显示通知              │
│  数据源优先级: [新浪财经] [akshare]       │
│                                           │
│ [保存配置] [取消]                         │
└─────────────────────────────────────────────┘
```

### 3. 实时控制功能

#### 3.1 控制界面
**位置1：TreeView标题栏**
```
📈 TRAD股票监控 [运行中]
├── ▶ 开始监控  (当停止时显示)
├── ⏹ 停止监控  (当运行时显示)
├── ⚙️ 配置
└── 🔄 手动刷新
```

**位置2：VSCode状态栏**
```
[TRAD] 📈 +2.5% | ▶ 开始 | ⏹ 停止 | ⚙️ 配置
```

**位置3：命令面板命令**
- `trad.startMonitoring` - 开始监控
- `trad.stopMonitoring` - 停止监控
- `trad.addStock` - 添加股票
- `trad.openConfig` - 打开配置
- `trad.refresh` - 手动刷新

#### 3.2 状态管理
```typescript
enum MonitoringState {
  STOPPED = 'stopped',      // 已停止
  STARTING = 'starting',    // 启动中
  RUNNING = 'running',      // 运行中
  STOPPING = 'stopping',    // 停止中
  ERROR = 'error'           // 错误状态
}

class MonitoringManager {
  private state: MonitoringState = MonitoringState.STOPPED;
  private timer: NodeJS.Timeout | null = null;
  private config: PluginConfig;
  private pythonClient: PythonClient;

  async start(): Promise<void> {
    if (this.state !== MonitoringState.STOPPED) return;

    this.state = MonitoringState.STARTING;
    this.updateUI();

    try {
      // 1. 启动Python守护进程
      const success = await this.pythonClient.startDaemon();
      if (!success) throw new Error('无法启动Python守护进程');

      // 2. 发送配置给Python进程
      await this.sendConfigToDaemon();

      // 3. 开始定时更新
      this.startUpdateTimer();

      this.state = MonitoringState.RUNNING;
      vscode.window.showInformationMessage('股票监控已启动');

    } catch (error) {
      this.state = MonitoringState.ERROR;
      vscode.window.showErrorMessage(`启动失败: ${error.message}`);
    }

    this.updateUI();
  }

  async stop(): Promise<void> {
    if (this.state !== MonitoringState.RUNNING) return;

    this.state = MonitoringState.STOPPING;
    this.updateUI();

    // 1. 停止定时器
    this.stopUpdateTimer();

    // 2. 通知Python进程停止
    await this.pythonClient.sendCommand({ command: 'pause' });

    // 3. 更新状态
    this.state = MonitoringState.STOPPED;
    this.updateUI();

    vscode.window.showInformationMessage('股票监控已停止');
  }

  private startUpdateTimer(): void {
    const interval = this.config.settings.updateInterval * 1000;
    this.timer = setInterval(async () => {
      if (this.state === MonitoringState.RUNNING) {
        await this.performUpdate();
      }
    }, interval);

    // 立即执行一次更新
    this.performUpdate();
  }

  private stopUpdateTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
```

### 4. 通信协议

#### 4.1 TypeScript → Python 命令
```json
{
  "type": "command",
  "command": "start|stop|pause|resume|update|get_config|set_config",
  "id": "request_id",
  "timestamp": 1640995200000,
  "payload": {
    // 命令相关数据
  }
}
```

#### 4.2 Python → TypeScript 响应
```json
{
  "type": "response|data|error|status",
  "id": "request_id",
  "timestamp": 1640995200000,
  "data": [
    {
      "code": "600000",
      "name": "浦发银行",
      "currentPrice": 10.75,
      "buyPrice": 10.50,
      "quantity": 100,
      "profitAmount": 25.00,
      "profitPercent": 2.38,
      "marketValue": 1075.00,
      "costBasis": 1050.00,
      "change": 0.25,
      "changePercent": 2.38,
      "lastUpdate": 1640995200000
    }
  ],
  "error": null,
  "status": "running"
}
```

#### 4.3 Python守护进程接口
```python
# stock_daemon.py 核心类
class StockDaemon:
    def __init__(self):
        self.running = False
        self.update_interval = 20
        self.stock_configs = []
        self.cache = {}
        self.update_task = None

    async def handle_command(self, command_json: str):
        """处理来自插件的命令"""
        command = json.loads(command_json)
        cmd_type = command.get('type')

        if cmd_type == 'command':
            cmd = command.get('command')

            if cmd == 'start':
                await self.start_monitoring()
                return {'status': 'started'}

            elif cmd == 'stop':
                await self.stop_monitoring()
                return {'status': 'stopped'}

            elif cmd == 'pause':
                self.running = False
                return {'status': 'paused'}

            elif cmd == 'resume':
                self.running = True
                return {'status': 'resumed'}

            elif cmd == 'update':
                data = await self.fetch_all_stocks()
                return {'type': 'data', 'data': data}

            elif cmd == 'set_config':
                self.update_config(command['payload'])
                return {'status': 'config_updated'}

    async def start_monitoring(self):
        """开始监控循环"""
        self.running = True

        while self.running:
            try:
                data = await self.fetch_all_stocks()
                # 发送数据到插件
                self.send_to_plugin({'type': 'data', 'data': data})

                # 等待更新间隔
                await asyncio.sleep(self.update_interval)

            except Exception as e:
                self.send_to_plugin({'type': 'error', 'error': str(e)})
                await asyncio.sleep(5)  # 错误后等待5秒重试
```

### 5. 性能优化策略

#### 5.1 数据获取优化
```python
# 批量获取替代方案（比akshare全量获取快10倍）
async def batch_fetch_sina(stock_codes):
    """批量获取新浪财经数据"""
    # 按交易所分组
    sh_codes = [code for code in stock_codes if code.startswith(('6', '9'))]
    sz_codes = [code for code in stock_codes if code.startswith(('0', '2', '3'))]

    # 构造批量URL
    urls = []
    if sh_codes:
        urls.append(f"http://hq.sinajs.cn/list={','.join(f'sh{code}' for code in sh_codes)}")
    if sz_codes:
        urls.append(f"http://hq.sinajs.cn/list={','.join(f'sz{code}' for code in sz_codes)}")

    # 并发请求
    async with aiohttp.ClientSession() as session:
        tasks = [self.fetch_url(session, url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    return self.parse_batch_results(results)
```

#### 5.2 缓存策略
- **股票基础信息**：缓存5分钟（名称、交易所）
- **实时价格**：缓存20秒（与更新间隔一致）
- **计算结果**：缓存至下次数据更新
- **网络请求**：失败时使用缓存数据降级

#### 5.3 按需更新策略
```typescript
// 智能更新：只更新活跃的、可见的股票
class SmartUpdater {
  private activeStocks: Set<string> = new Set();
  private visibleStocks: Set<string> = new Set();

  // 监控列表中的股票：每20秒更新
  // 非活跃股票：每60秒更新或暂停更新
  // 界面隐藏时：降低更新频率或暂停

  updateFrequency(stockCode: string): number {
    if (!this.activeStocks.has(stockCode)) {
      return 60 * 1000; // 非活跃股票：60秒更新一次
    }

    if (!this.visibleStocks.has(stockCode)) {
      return 30 * 1000; // 不可见股票：30秒更新一次
    }

    return 20 * 1000; // 活跃且可见：20秒更新一次
  }
}
```

### 6. 用户操作流程

#### 6.1 首次使用流程
```
1. 安装插件 → 侧边栏出现"TRAD股票监控"
2. 点击⚙️配置按钮 → 打开配置Webview
3. 添加股票：填写代码、买入价、数量
4. 设置更新间隔：20秒
5. 点击"保存配置"
6. 点击"开始监控"按钮
```

#### 6.2 日常使用流程
```
开始监控：
  点击"▶开始"按钮 → 状态变绿 → 20秒后显示数据 → 持续更新

添加股票：
  点击"添加股票" → 填写表单 → 自动加入监控列表

停止监控：
  点击"⏹停止"按钮 → 停止获取数据 → 状态变灰

临时调整：
  右键股票 → "暂停监控此股票" → 该股票停止更新
```

#### 6.3 快捷键支持
```json
// package.json中的快捷键配置
{
  "key": "ctrl+alt+t s",  // Ctrl+Alt+T, 然后按S
  "command": "trad.start",
  "when": "tradViewFocus"
},
{
  "key": "ctrl+alt+t p",  // Ctrl+Alt+T, 然后按P
  "command": "trad.stop",
  "when": "tradViewFocus"
},
{
  "key": "ctrl+alt+t a",  // Ctrl+Alt+T, 然后按A
  "command": "trad.addStock"
}
```

### 7. 错误处理和恢复

#### 7.1 网络异常处理
```typescript
class ErrorHandler {
  private retryCount = 0;
  private maxRetries = 3;

  async fetchWithRetry(stockCodes: string[]): Promise<StockData[]> {
    try {
      const data = await this.fetchStocks(stockCodes);
      this.retryCount = 0; // 重置重试计数
      return data;
    } catch (error) {
      this.retryCount++;

      if (this.retryCount >= this.maxRetries) {
        // 超过重试次数，进入降级模式
        await this.enterDegradedMode();
        throw new Error(`获取失败，已尝试${this.retryCount}次`);
      }

      // 指数退避重试
      const delay = Math.pow(2, this.retryCount) * 1000;
      await this.sleep(delay);
      return this.fetchWithRetry(stockCodes);
    }
  }

  private enterDegradedMode(): void {
    // 1. 切换到备用数据源
    // 2. 延长更新间隔
    // 3. 显示警告信息
    vscode.window.showWarningMessage(
      '网络不稳定，已切换到备用数据源，更新间隔延长至60秒'
    );
  }
}
```

#### 7.2 进程异常处理
```typescript
class ProcessManager {
  private pythonProcess: ChildProcess | null = null;
  private restartCount = 0;
  private maxRestarts = 5;

  async restartDaemon(): Promise<boolean> {
    if (this.restartCount >= this.maxRestarts) {
      vscode.window.showErrorMessage(
        'Python守护进程多次重启失败，请检查Python环境和依赖'
      );
      return false;
    }

    this.restartCount++;

    try {
      await this.stopDaemon();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.startDaemon();

      vscode.window.showInformationMessage(
        `Python守护进程已重启 (${this.restartCount}/${this.maxRestarts})`
      );

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`重启失败: ${error.message}`);
      return false;
    }
  }
}
```

### 8. 界面设计细节

#### 8.1 TreeView项目设计
```typescript
class StockTreeItem extends vscode.TreeItem {
  constructor(
    public readonly stockData: StockData,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(stockData.name || stockData.code, collapsibleState);

    // 根据盈亏设置图标和颜色
    if (stockData.profitAmount > 0) {
      this.iconPath = new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('charts.green'));
    } else if (stockData.profitAmount < 0) {
      this.iconPath = new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('charts.red'));
    } else {
      this.iconPath = new vscode.ThemeIcon('dash');
    }

    // 工具提示显示详细信息
    this.tooltip = new vscode.MarkdownString(`
### ${stockData.name} (${stockData.code})
- **当前价**: ${stockData.currentPrice.toFixed(2)}元
- **买入价**: ${stockData.buyPrice.toFixed(2)}元
- **持仓**: ${stockData.quantity}股
- **盈亏**: ${stockData.profitAmount.toFixed(2)}元 (${stockData.profitPercent.toFixed(2)}%)
- **市值**: ${stockData.marketValue.toFixed(2)}元
- **更新时间**: ${new Date(stockData.lastUpdate).toLocaleTimeString()}
    `);

    // 描述显示盈亏信息
    this.description = `${stockData.profitAmount.toFixed(2)}元 (${stockData.profitPercent.toFixed(2)}%)`;
  }
}
```

#### 8.2 状态栏设计
```typescript
class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
  }

  update(state: MonitoringState, summary?: SummaryData) {
    let text = 'TRAD';

    // 添加状态图标
    switch(state) {
      case MonitoringState.RUNNING:
        text += ' $(play)';
        break;
      case MonitoringState.STOPPED:
        text += ' $(stop)';
        break;
      case MonitoringState.ERROR:
        text += ' $(error)';
        break;
      default:
        text += ' $(sync~spin)';
    }

    // 添加汇总信息
    if (summary) {
      const sign = summary.totalProfit >= 0 ? '+' : '';
      text += ` ${sign}${summary.totalProfit.toFixed(2)}元 (${sign}${summary.totalProfitPercent.toFixed(2)}%)`;
    }

    this.statusBarItem.text = text;
    this.statusBarItem.tooltip = '点击切换监控状态';
    this.statusBarItem.command = 'trad.toggleMonitoring';
    this.statusBarItem.show();
  }
}
```

## 实施计划

### 第一阶段：Python后端改造（2-3天）
1. **重构数据获取模块**
   - 实现异步并发版本
   - 添加缓存装饰器
   - 优化数据源选择逻辑

2. **创建守护进程框架**
   - 实现JSON-RPC over stdio
   - 添加配置文件管理
   - 实现定时更新循环

3. **性能测试与优化**
   - 对比不同数据源速度
   - 测试并发请求性能
   - 验证缓存效果

### 第二阶段：VSCode插件基础（3-4天）
1. **创建插件骨架**
   ```bash
   npm install -g yo generator-code
   yo code trad-stock-monitor
   ```

2. **实现核心模块**
   - Python进程管理
   - TreeDataProvider实现
   - 配置管理界面

3. **集成与调试**
   - 进程通信测试
   - 定时器集成
   - 错误处理机制

### 第三阶段：控制功能完善（2-3天）
1. **状态管理实现**
   - 开始/停止控制逻辑
   - 状态同步
   - UI状态更新

2. **配置管理完善**
   - Webview配置界面
   - 配置验证
   - 实时保存

3. **用户体验优化**
   - 快捷键支持
   - 状态栏集成
   - 错误提示

### 第四阶段：测试与优化（1-2天）
1. **功能测试**
   - 多股票监控测试
   - 网络异常恢复测试
   - 长时间运行稳定性测试

2. **性能优化**
   - 内存使用优化
   - CPU占用优化
   - 响应速度优化

3. **文档编写**
   - 用户使用指南
   - 开发文档
   - 故障排除指南

## 扩展功能路线图

### 短期扩展（1-2个月）
1. **价格预警功能**
   - 涨跌阈值设置
   - 桌面通知
   - 声音提醒

2. **分组管理**
   - 按板块分组
   - 自定义分组
   - 分组汇总

3. **数据导出**
   - CSV格式导出
   - 盈亏报告
   - 历史数据

### 中期扩展（3-6个月）
1. **多市场支持**
   - 港股
   - 美股
   - 基金

2. **技术分析**
   - K线图显示
   - 技术指标计算
   - 趋势分析

3. **策略提醒**
   - 价格突破提醒
   - 成交量异常提醒
   - 资金流向提醒

### 长期愿景（6个月以上）
1. **智能推荐**
   - 基于持仓推荐相关股票
   - 风险分散建议
   - 时机提醒

2. **情绪分析**
   - 新闻舆情分析
   - 社交媒体情绪
   - 市场情绪指数

3. **自动化交易接口**（需谨慎）
   - 券商API对接
   - 条件单设置
   - 风险控制

## 附录

### A. 性能指标目标
- **数据更新延迟**：< 3秒（10只股票并发）
- **内存占用**：< 50MB（Python进程 + Node.js进程）
- **CPU占用**：< 5%（空闲时）
- **启动时间**：< 3秒

### B. 兼容性要求
- **VSCode版本**：>= 1.60.0
- **Python版本**：>= 3.8
- **操作系统**：Windows 10+, macOS 10.15+, Linux

### C. 依赖库列表
```json
{
  "Python依赖": [
    "akshare>=1.18.22",
    "pandas>=1.3.0",
    "requests>=2.26.0",
    "aiohttp>=3.8.0",
    "asyncio>=3.4.3"
  ],
  "Node.js依赖": [
    "@types/vscode": "^1.60.0",
    "@types/node": "^16.11.0",
    "typescript": "^4.5.0"
  ]
}
```

### D. 配置文件示例
```json
{
  "version": "1.0.0",
  "stocks": [
    {
      "code": "600000",
      "name": "浦发银行",
      "buyPrice": 10.5,
      "quantity": 100,
      "enabled": true,
      "exchange": "sh"
    },
    {
      "code": "000001",
      "name": "平安银行",
      "buyPrice": 15.2,
      "quantity": 200,
      "enabled": true,
      "exchange": "sz"
    }
  ],
  "settings": {
    "updateInterval": 20,
    "autoStart": true,
    "showNotifications": true,
    "priceAlertThreshold": 5.0,
    "dataSourcePriority": "sina"
  }
}
```

---

**文档版本**：1.0.0
**最后更新**：2026-02-10
**设计者**：Claude Code
**基于脚本**：`stock_profit_calculator.py`

*注意：此设计方案为初步规划，具体实现时可能需要根据实际情况调整。*