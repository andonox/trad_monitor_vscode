import { StockViewProvider } from '../../../src/views/stockView';
import { StockData, MonitoringState } from '../../../src/types/stock';
import * as vscode from 'vscode';
import { mockStockData } from '../setup';

// Mock VSCode API
jest.mock('vscode');

describe('StockViewProvider', () => {
  let stockViewProvider: StockViewProvider;
  let mockContext: vscode.ExtensionContext;
  let mockTreeView: vscode.TreeView<any>;
  let mockTreeDataChangeEvent: vscode.EventEmitter<any>;

  beforeEach(() => {
    mockTreeDataChangeEvent = new vscode.EventEmitter<any>();

    mockContext = {
      subscriptions: [],
    } as any;

    mockTreeView = {
      visible: true,
      onDidChangeVisibility: jest.fn(),
      onDidChangeSelection: jest.fn(),
      reveal: jest.fn(),
      dispose: jest.fn(),
    } as any;

    // Mock TreeView创建
    (vscode.window.createTreeView as jest.Mock).mockReturnValue(mockTreeView);

    stockViewProvider = new StockViewProvider(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    it('应该创建TreeView并注册事件', () => {
      expect(vscode.window.createTreeView).toHaveBeenCalledWith(
        'tradStockMonitor',
        expect.objectContaining({
          treeDataProvider: stockViewProvider,
          showCollapseAll: true,
        })
      );

      expect(mockContext.subscriptions).toContain(mockTreeView);
    });
  });

  describe('getTreeItem()', () => {
    it('应该为股票数据创建TreeItem', () => {
      const stockData: StockData = {
        ...mockStockData,
        code: '600000',
        name: '浦发银行',
        currentPrice: 10.75,
        profitAmount: 25.0,
        profitPercent: 2.38,
      };

      const element = {
        type: 'stock' as const,
        data: stockData,
      };

      const treeItem = stockViewProvider.getTreeItem(element);

      expect(treeItem.label).toBe('浦发银行 (600000)');
      expect(treeItem.description).toContain('10.75');
      expect(treeItem.tooltip).toContain('盈利: ¥25.00');
      expect(treeItem.iconPath).toBeDefined();
      expect(treeItem.contextValue).toBe('stock');
    });

    it('应该为汇总数据创建TreeItem', () => {
      const summaryData = {
        type: 'summary' as const,
        data: {
          totalProfit: 75.0,
          totalProfitPercent: 2.5,
          totalMarketValue: 3075.0,
          totalCostBasis: 3000.0,
          stockCount: 2,
          lastUpdate: Date.now(),
        },
      };

      const treeItem = stockViewProvider.getTreeItem(summaryData);

      expect(treeItem.label).toBe('总览');
      expect(treeItem.description).toContain('¥75.00');
      expect(treeItem.tooltip).toContain('总市值: ¥3075.00');
      expect(treeItem.iconPath).toBeDefined();
      expect(treeItem.contextValue).toBe('summary');
    });

    it('应该为状态信息创建TreeItem', () => {
      const statusData = {
        type: 'status' as const,
        data: {
          state: MonitoringState.RUNNING,
          message: '监控运行中',
          lastUpdate: Date.now(),
        },
      };

      const treeItem = stockViewProvider.getTreeItem(statusData);

      expect(treeItem.label).toBe('状态');
      expect(treeItem.description).toBe('监控运行中');
      expect(treeItem.tooltip).toContain('监控运行中');
      expect(treeItem.iconPath).toBeDefined();
      expect(treeItem.contextValue).toBe('status');
    });
  });

  describe('getChildren()', () => {
    it('当没有父元素时应该返回根元素', () => {
      const children = stockViewProvider.getChildren();

      expect(children).toHaveLength(3);
      expect(children[0].type).toBe('summary');
      expect(children[1].type).toBe('status');
      expect(children[2].type).toBe('stocks-header');
    });

    it('当父元素是stocks-header时应该返回股票列表', () => {
      const stockDataArray = [mockStockData];
      stockViewProvider.updateStockData(stockDataArray);

      const parent = { type: 'stocks-header' as const };
      const children = stockViewProvider.getChildren(parent);

      expect(children).toHaveLength(1);
      expect(children[0].type).toBe('stock');
      expect(children[0].data.code).toBe('600000');
    });

    it('当没有股票数据时应该返回空数组', () => {
      const parent = { type: 'stocks-header' as const };
      const children = stockViewProvider.getChildren(parent);

      expect(children).toHaveLength(0);
    });
  });

  describe('updateStockData()', () => {
    it('应该更新股票数据并触发刷新', () => {
      const refreshSpy = jest.spyOn(stockViewProvider, 'refresh');

      const stockDataArray = [
        mockStockData,
        { ...mockStockData, code: '000001', name: '平安银行' },
      ];

      stockViewProvider.updateStockData(stockDataArray);

      expect(refreshSpy).toHaveBeenCalled();
      expect(stockViewProvider['stockData']).toHaveLength(2);
    });

    it('应该计算汇总数据', () => {
      const stockDataArray = [
        { ...mockStockData, profitAmount: 25.0, marketValue: 1075.0, costBasis: 1050.0 },
        { ...mockStockData, code: '000001', profitAmount: 50.0, marketValue: 2000.0, costBasis: 1950.0 },
      ];

      stockViewProvider.updateStockData(stockDataArray);

      const summary = stockViewProvider['summaryData'];
      expect(summary).not.toBeNull();
      expect(summary?.totalProfit).toBe(75.0);
      expect(summary?.totalMarketValue).toBe(3075.0);
      expect(summary?.totalCostBasis).toBe(3000.0);
      expect(summary?.stockCount).toBe(2);
    });
  });

  describe('updateState()', () => {
    it('应该更新监控状态并触发刷新', () => {
      const refreshSpy = jest.spyOn(stockViewProvider, 'refresh');

      stockViewProvider.updateState(MonitoringState.RUNNING, '监控运行中');

      expect(refreshSpy).toHaveBeenCalled();
      expect(stockViewProvider['currentState']).toBe(MonitoringState.RUNNING);
      expect(stockViewProvider['statusMessage']).toBe('监控运行中');
    });

    it('应该为不同状态设置不同的状态消息', () => {
      stockViewProvider.updateState(MonitoringState.STOPPED, '监控已停止');
      expect(stockViewProvider['statusMessage']).toBe('监控已停止');

      stockViewProvider.updateState(MonitoringState.ERROR, '发生错误');
      expect(stockViewProvider['statusMessage']).toBe('发生错误');

      stockViewProvider.updateState(MonitoringState.STARTING, '正在启动...');
      expect(stockViewProvider['statusMessage']).toBe('正在启动...');
    });
  });

  describe('refresh()', () => {
    it('应该触发_treeDataChange事件', () => {
      const listener = jest.fn();
      stockViewProvider.onDidChangeTreeData(listener);

      stockViewProvider.refresh();

      expect(listener).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getParent()', () => {
    it('应该返回正确的父元素', () => {
      const stockElement = { type: 'stock' as const, data: mockStockData };
      const parent = stockViewProvider.getParent(stockElement);

      expect(parent?.type).toBe('stocks-header');
    });

    it('根元素应该返回undefined', () => {
      const summaryElement = { type: 'summary' as const, data: {} as any };
      const parent = stockViewProvider.getParent(summaryElement);

      expect(parent).toBeUndefined();
    });
  });

  describe('图标生成', () => {
    it('应该为盈利股票生成绿色图标', () => {
      const profitableStock: StockData = {
        ...mockStockData,
        profitPercent: 5.0,
      };

      const element = {
        type: 'stock' as const,
        data: profitableStock,
      };

      const treeItem = stockViewProvider.getTreeItem(element);
      expect(treeItem.iconPath).toBeDefined();
    });

    it('应该为亏损股票生成红色图标', () => {
      const losingStock: StockData = {
        ...mockStockData,
        profitPercent: -3.0,
      };

      const element = {
        type: 'stock' as const,
        data: losingStock,
      };

      const treeItem = stockViewProvider.getTreeItem(element);
      expect(treeItem.iconPath).toBeDefined();
    });

    it('应该为平盘股票生成灰色图标', () => {
      const neutralStock: StockData = {
        ...mockStockData,
        profitPercent: 0.0,
      };

      const element = {
        type: 'stock' as const,
        data: neutralStock,
      };

      const treeItem = stockViewProvider.getTreeItem(element);
      expect(treeItem.iconPath).toBeDefined();
    });
  });

  describe('工具提示生成', () => {
    it('应该为股票生成详细的工具提示', () => {
      const stockData: StockData = {
        ...mockStockData,
        code: '600000',
        name: '浦发银行',
        currentPrice: 10.75,
        buyPrice: 10.5,
        quantity: 100,
        profitAmount: 25.0,
        profitPercent: 2.38,
        marketValue: 1075.0,
        costBasis: 1050.0,
        change: 0.25,
        changePercent: 2.38,
        lastUpdate: 1640995200000,
      };

      const element = {
        type: 'stock' as const,
        data: stockData,
      };

      const treeItem = stockViewProvider.getTreeItem(element);
      const tooltip = treeItem.tooltip as vscode.MarkdownString;

      expect(tooltip.value).toContain('浦发银行 (600000)');
      expect(tooltip.value).toContain('当前价: ¥10.75');
      expect(tooltip.value).toContain('买入价: ¥10.50');
      expect(tooltip.value).toContain('持仓: 100股');
      expect(tooltip.value).toContain('盈利: ¥25.00');
      expect(tooltip.value).toContain('收益率: 2.38%');
    });

    it('应该为汇总生成工具提示', () => {
      const summaryData = {
        type: 'summary' as const,
        data: {
          totalProfit: 75.0,
          totalProfitPercent: 2.5,
          totalMarketValue: 3075.0,
          totalCostBasis: 3000.0,
          stockCount: 2,
          lastUpdate: Date.now(),
        },
      };

      const treeItem = stockViewProvider.getTreeItem(summaryData);
      const tooltip = treeItem.tooltip as vscode.MarkdownString;

      expect(tooltip.value).toContain('总盈利: ¥75.00');
      expect(tooltip.value).toContain('总收益率: 2.50%');
      expect(tooltip.value).toContain('总市值: ¥3075.00');
      expect(tooltip.value).toContain('总成本: ¥3000.00');
      expect(tooltip.value).toContain('股票数量: 2');
    });
  });

  describe('性能测试', () => {
    it('应该高效处理大量股票数据', () => {
      const startTime = performance.now();

      // 生成100个股票数据
      const stockDataArray = Array.from({ length: 100 }, (_, i) => ({
        ...mockStockData,
        code: `600${i.toString().padStart(3, '0')}`,
        name: `测试股票${i + 1}`,
        currentPrice: 10 + i * 0.1,
        profitAmount: i * 10,
      }));

      stockViewProvider.updateStockData(stockDataArray);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 应该在100ms内完成
      expect(duration).toBeLessThan(100);

      // 验证数据正确性
      const parent = { type: 'stocks-header' as const };
      const children = stockViewProvider.getChildren(parent);
      expect(children).toHaveLength(100);
    });
  });
});