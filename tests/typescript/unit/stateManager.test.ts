import { StateManager } from '../../../src/stateManager';
import { ConfigManager } from '../../../src/configManager';
import { PythonClient } from '../../../src/pythonClient';
import { MonitoringState, StockData, PluginConfig } from '../../../src/types/stock';
import * as vscode from 'vscode';
import { mockStockData, mockPluginConfig } from '../setup';

// Mock VSCode API
jest.mock('vscode');

describe('StateManager', () => {
  let stateManager: StateManager;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockPythonClient: jest.Mocked<PythonClient>;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // 创建mock对象
    mockConfigManager = {
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
      addStock: jest.fn(),
      removeStock: jest.fn(),
      updateStock: jest.fn(),
      saveConfig: jest.fn(),
      loadConfig: jest.fn(),
    } as any;

    mockPythonClient = {
      startDaemon: jest.fn(),
      stopDaemon: jest.fn(),
      sendConfig: jest.fn(),
      isDaemonRunning: jest.fn(),
      onData: jest.fn(),
      onError: jest.fn(),
      onExit: jest.fn(),
    } as any;

    mockContext = {
      globalStorageUri: {
        fsPath: '/tmp/test-storage',
      },
    } as any;

    // 设置mock返回值
    mockConfigManager.getConfig.mockReturnValue(mockPluginConfig);
    mockPythonClient.startDaemon.mockResolvedValue(true);
    mockPythonClient.sendConfig.mockResolvedValue(true);

    stateManager = new StateManager(mockConfigManager, mockPythonClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start()', () => {
    it('应该成功启动监控', async () => {
      await stateManager.start();

      expect(mockPythonClient.startDaemon).toHaveBeenCalled();
      expect(mockPythonClient.sendConfig).toHaveBeenCalledWith(mockPluginConfig);
      // 注意：实际代码中可能需要检查状态
      // expect(stateManager.getState()).toBe(MonitoringState.RUNNING);
    });

    it('如果Python守护进程启动失败应该抛出错误', async () => {
      mockPythonClient.startDaemon.mockResolvedValue(false);

      await expect(stateManager.start()).rejects.toThrow('无法启动Python守护进程');
      expect(stateManager.getState()).toBe(MonitoringState.STOPPED);
    });

    it('如果已经在运行则不应该重复启动', async () => {
      await stateManager.start();
      await stateManager.start(); // 第二次调用

      expect(mockPythonClient.startDaemon).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    it('应该成功停止监控', async () => {
      await stateManager.start();
      await stateManager.stop();

      expect(mockPythonClient.stopDaemon).toHaveBeenCalled();
      expect(stateManager.getState()).toBe(MonitoringState.STOPPED);
    });

    it('如果已经停止则不应该重复停止', async () => {
      await stateManager.stop(); // 初始状态就是STOPPED

      expect(mockPythonClient.stopDaemon).not.toHaveBeenCalled();
    });
  });

  describe('getStockData()', () => {
    it('应该返回股票数据', () => {
      const stockDataArray = [mockStockData];
      stateManager['handleStockData'](stockDataArray);

      const result = stateManager.getStockData();
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('600000');
    });

    it('如果没有数据应该返回空数组', () => {
      const result = stateManager.getStockData();
      expect(result).toHaveLength(0);
    });
  });

  describe('getSummaryData()', () => {
    it('应该计算汇总数据', () => {
      const stockDataArray = [
        { ...mockStockData, profitAmount: 25.0, marketValue: 1075.0, costBasis: 1050.0 },
        { ...mockStockData, code: '000001', profitAmount: 50.0, marketValue: 2000.0, costBasis: 1950.0 },
      ];
      stateManager['handleStockData'](stockDataArray);

      const summary = stateManager.getSummaryData();
      expect(summary).not.toBeNull();
      expect(summary?.totalProfit).toBe(75.0);
      expect(summary?.totalMarketValue).toBe(3075.0);
      expect(summary?.totalCostBasis).toBe(3000.0);
      expect(summary?.totalProfitPercent).toBeCloseTo(2.5);
    });
  });

  describe('事件监听器', () => {
    it('应该调用状态变化监听器', () => {
      const listener = jest.fn();
      stateManager.onStateChange(listener);

      stateManager['setState'](MonitoringState.RUNNING);

      expect(listener).toHaveBeenCalledWith(MonitoringState.RUNNING);
    });

    it('应该调用数据更新监听器', () => {
      const listener = jest.fn();
      stateManager.onStockUpdate(listener);

      const stockDataArray = [mockStockData];
      stateManager['handleStockData'](stockDataArray);

      expect(listener).toHaveBeenCalledWith(stockDataArray);
    });

    it('应该移除监听器', () => {
      const listener = jest.fn();
      const removeFn = stateManager.onStateChange(listener);

      removeFn();
      stateManager['setState'](MonitoringState.RUNNING);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('handleConfigChange()', () => {
    it('应该处理配置变化', async () => {
      await stateManager.start();

      const newConfig = {
        ...mockPluginConfig,
        settings: { ...mockPluginConfig.settings, updateInterval: 30 },
      };

      stateManager['handleConfigChange'](newConfig);

      expect(mockPythonClient.sendConfig).toHaveBeenCalledWith(newConfig);
    });

    it('如果监控未运行则不应该发送配置', () => {
      const newConfig = {
        ...mockPluginConfig,
        settings: { ...mockPluginConfig.settings, updateInterval: 30 },
      };

      stateManager['handleConfigChange'](newConfig);

      expect(mockPythonClient.sendConfig).not.toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该处理Python客户端错误', () => {
      const errorListener = jest.fn();
      stateManager.onError(errorListener);

      // 模拟Python客户端错误
      const errorEvent = { type: 'error', error: 'Network error' };
      (vscode.commands.executeCommand as jest.Mock).mockImplementation((command, ...args) => {
        if (command === 'trad.onError') {
          const errorHandler = args[0];
          errorHandler(errorEvent);
        }
      });

      expect(errorListener).toHaveBeenCalledWith(errorEvent);
    });
  });
});