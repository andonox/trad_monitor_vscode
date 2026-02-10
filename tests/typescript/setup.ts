/**
 * TypeScript测试全局设置
 */
import 'jest';

// 扩展全局类型声明
declare global {
  var mockConsole: () => void;
  var restoreConsole: () => void;
}

// Mock VSCode API
jest.mock('vscode', () => {
  const mock = {
    window: {
      createStatusBarItem: jest.fn(() => ({
        text: '',
        tooltip: '',
        command: '',
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn()
      })),
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      createOutputChannel: jest.fn(() => ({
        appendLine: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn()
      })),
      createWebviewPanel: jest.fn(() => ({
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn(),
          postMessage: jest.fn()
        },
        reveal: jest.fn(),
        onDidDispose: jest.fn(),
        dispose: jest.fn()
      }))
    },
    commands: {
      registerCommand: jest.fn(() => ({
        dispose: jest.fn()
      })),
      executeCommand: jest.fn()
    },
    workspace: {
      getConfiguration: jest.fn(() => ({
        get: jest.fn(),
        update: jest.fn()
      })),
      workspaceFolders: [],
      onDidChangeConfiguration: jest.fn()
    },
    extensions: {
      getExtension: jest.fn()
    },
    EventEmitter: jest.fn(() => ({
      event: jest.fn(),
      fire: jest.fn(),
      dispose: jest.fn()
    })),
    TreeItem: jest.fn(),
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1,
      Expanded: 2
    },
    ThemeIcon: jest.fn(),
    ThemeColor: jest.fn(),
    MarkdownString: jest.fn(),
    Uri: {
      file: jest.fn(),
      parse: jest.fn()
    },
    ViewColumn: {
      One: 1,
      Two: 2,
      Three: 3
    },
    StatusBarAlignment: {
      Left: 1,
      Right: 2
    }
  };
  return mock;
}, { virtual: true });

// 全局测试辅助函数
global.mockConsole = () => {
  const originalConsole = { ...console };

  beforeEach(() => {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    console.debug = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  });
};

// 测试超时设置
jest.setTimeout(10000);

// 测试数据
export const mockStockData = {
  code: '600000',
  name: '浦发银行',
  currentPrice: 10.75,
  buyPrice: 10.50,
  quantity: 100,
  profitAmount: 25.00,
  profitPercent: 2.38,
  marketValue: 1075.00,
  costBasis: 1050.00,
  change: 0.25,
  changePercent: 2.38,
  lastUpdate: 1640995200000,
  enabled: true
};

export const mockStockConfig = {
  code: '600000',
  name: '浦发银行',
  buyPrice: 10.5,
  quantity: 100,
  enabled: true,
  exchange: 'sh'
};

export const mockPluginConfig = {
  version: '1.0.0',
  stocks: [
    {
      code: '600000',
      name: '浦发银行',
      buyPrice: 10.5,
      quantity: 100,
      enabled: true,
      exchange: 'sh'
    },
    {
      code: '000001',
      name: '平安银行',
      buyPrice: 15.2,
      quantity: 200,
      enabled: true,
      exchange: 'sz'
    }
  ],
  settings: {
    updateInterval: 20,
    autoStart: true,
    showNotifications: true,
    priceAlertThreshold: 5.0,
    dataSourcePriority: 'sina' as const
  }
};

// 模拟Python进程响应
export const mockPythonResponse = {
  type: 'data',
  data: [mockStockData]
};

// 模拟错误响应
export const mockPythonError = {
  type: 'error',
  error: 'Network error'
};

// 性能测试辅助
export class PerformanceRecorder {
  private records: Array<{name: string; duration: number; memory?: number}> = [];

  record(name: string, duration: number, memory?: number) {
    this.records.push({ name, duration, memory });
  }

  getSummary() {
    if (this.records.length === 0) {
      return {};
    }

    const durations = this.records.map(r => r.duration);
    const memories = this.records.filter(r => r.memory !== undefined).map(r => r.memory!);

    return {
      totalTests: this.records.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      avgMemory: memories.length > 0 ? memories.reduce((a, b) => a + b, 0) / memories.length : 0,
      maxMemory: memories.length > 0 ? Math.max(...memories) : 0
    };
  }
}