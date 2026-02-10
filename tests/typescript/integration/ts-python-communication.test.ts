import { StateManager } from '../../../src/stateManager';
import { ConfigManager } from '../../../src/configManager';
import { PythonClient } from '../../../src/pythonClient';
import { MonitoringState, PluginConfig } from '../../../src/types/stock';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';
import { mockPluginConfig, mockStockData } from '../setup';

// Mock VSCode API和子进程
jest.mock('vscode');
jest.mock('child_process');

describe('TypeScript-Python通信集成测试', () => {
  let stateManager: StateManager;
  let configManager: ConfigManager;
  let pythonClient: PythonClient;
  let mockProcess: any;
  let mockStdout: EventEmitter;
  let mockStderr: EventEmitter;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // 设置mock进程
    mockStdout = new EventEmitter();
    mockStderr = new EventEmitter();

    mockProcess = {
      pid: 12345,
      stdin: {
        write: jest.fn(),
        end: jest.fn(),
      },
      stdout: mockStdout,
      stderr: mockStderr,
      kill: jest.fn(),
      on: jest.fn((event, handler) => {
        if (event === 'exit') {
          mockProcess.exitHandler = handler;
        }
        return mockProcess;
      }),
      exitCode: null,
    };

    // Mock spawn函数
    (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);

    // 创建mock上下文
    mockContext = {
      globalStorageUri: {
        fsPath: '/tmp/test-storage',
      },
    } as any;

    // 创建真实实例（使用mock依赖）
    configManager = new ConfigManager(mockContext);
    pythonClient = new PythonClient();
    stateManager = new StateManager(configManager, pythonClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (pythonClient.isDaemonRunning()) {
      pythonClient.stopDaemon();
    }
  });

  describe('完整监控流程', () => {
    it('应该完成完整的启动-监控-停止流程', async () => {
      // 1. 启动监控
      await stateManager.start();
      expect(stateManager.getState()).toBe(MonitoringState.RUNNING);

      // 2. 模拟Python进程发送数据
      const stockData = {
        type: 'data' as const,
        data: [mockStockData],
      };

      mockStdout.emit('data', Buffer.from(JSON.stringify(stockData) + '\n'));

      // 3. 验证数据被正确接收和处理
      await new Promise(resolve => setTimeout(resolve, 100)); // 等待异步处理

      const receivedData = stateManager.getStockData();
      expect(receivedData).toHaveLength(1);
      expect(receivedData[0].code).toBe('600000');
      expect(receivedData[0].currentPrice).toBe(10.75);

      // 4. 验证汇总数据
      const summary = stateManager.getSummaryData();
      expect(summary).not.toBeNull();
      expect(summary?.totalProfit).toBe(25.0);
      expect(summary?.totalMarketValue).toBe(1075.0);

      // 5. 停止监控
      await stateManager.stop();
      expect(stateManager.getState()).toBe(MonitoringState.STOPPED);
    });

    it('应该处理配置更新并发送到Python进程', async () => {
      await stateManager.start();

      // 更新配置
      const newConfig: PluginConfig = {
        ...mockPluginConfig,
        settings: {
          ...mockPluginConfig.settings,
          updateInterval: 30,
        },
      };

      // 模拟配置更新命令
      (vscode.commands.executeCommand as jest.Mock).mockImplementation((command, ...args) => {
        if (command === 'trad.onConfigChanged') {
          const configHandler = args[0];
          configHandler(newConfig);
        }
      });

      // 触发配置更新
      await vscode.commands.executeCommand('trad.onConfigChanged', newConfig);

      // 验证配置被发送到Python进程
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(newConfig))
      );
    });

    it('应该处理Python进程错误并恢复', async () => {
      const errorListener = jest.fn();
      stateManager.onError(errorListener);

      await stateManager.start();

      // 模拟Python进程发送错误
      const errorData = {
        type: 'error' as const,
        error: 'Network error',
      };

      mockStderr.emit('data', Buffer.from(JSON.stringify(errorData) + '\n'));

      // 验证错误被处理
      expect(errorListener).toHaveBeenCalledWith(errorData);

      // 模拟进程退出
      mockProcess.exitCode = 1;
      if (mockProcess.exitHandler) {
        mockProcess.exitHandler(1);
      }

      // 验证状态更新
      expect(stateManager.getState()).toBe(MonitoringState.STOPPED);
    });
  });

  describe('数据流测试', () => {
    it('应该处理高频数据更新', async () => {
      await stateManager.start();

      const dataListener = jest.fn();
      stateManager.onStockUpdate(dataListener);

      // 发送10次数据更新
      for (let i = 0; i < 10; i++) {
        const stockData = {
          type: 'data' as const,
          data: [{
            ...mockStockData,
            code: `6000${i.toString().padStart(2, '0')}`,
            currentPrice: 10.0 + i * 0.1,
          }],
        };

        mockStdout.emit('data', Buffer.from(JSON.stringify(stockData) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 10)); // 小延迟
      }

      // 验证所有数据都被处理
      expect(dataListener).toHaveBeenCalledTimes(10);

      const finalData = stateManager.getStockData();
      expect(finalData).toHaveLength(1); // 只保留最后一次的数据
      expect(finalData[0].code).toBe('600009');
    });

    it('应该处理大数据包', async () => {
      await stateManager.start();

      // 创建包含100个股票的大数据包
      const largeData = {
        type: 'data' as const,
        data: Array.from({ length: 100 }, (_, i) => ({
          ...mockStockData,
          code: `600${i.toString().padStart(3, '0')}`,
          name: `股票${i + 1}`,
          currentPrice: 10.0 + i * 0.1,
          profitAmount: i * 10,
        })),
      };

      const jsonData = JSON.stringify(largeData);

      // 分块发送大数据
      const chunkSize = 100;
      for (let i = 0; i < jsonData.length; i += chunkSize) {
        const chunk = jsonData.slice(i, i + chunkSize);
        mockStdout.emit('data', Buffer.from(chunk));
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      mockStdout.emit('data', Buffer.from('\n')); // 结束符

      await new Promise(resolve => setTimeout(resolve, 100));

      const receivedData = stateManager.getStockData();
      expect(receivedData).toHaveLength(100);
    });
  });

  describe('错误恢复测试', () => {
    it('应该从JSON解析错误中恢复', async () => {
      await stateManager.start();

      // 发送无效JSON
      mockStdout.emit('data', Buffer.from('invalid json\n'));

      // 发送有效JSON
      const validData = {
        type: 'data' as const,
        data: [mockStockData],
      };
      mockStdout.emit('data', Buffer.from(JSON.stringify(validData) + '\n'));

      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证有效数据被处理
      const receivedData = stateManager.getStockData();
      expect(receivedData).toHaveLength(1);
    });

    it('应该从进程崩溃中恢复', async () => {
      await stateManager.start();

      // 模拟进程崩溃
      mockProcess.exitCode = 1;
      if (mockProcess.exitHandler) {
        mockProcess.exitHandler(1);
      }

      // 验证状态更新
      expect(stateManager.getState()).toBe(MonitoringState.STOPPED);

      // 尝试重新启动
      (child_process.spawn as jest.Mock).mockClear();
      (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);

      await stateManager.start();
      expect(stateManager.getState()).toBe(MonitoringState.RUNNING);
    });
  });

  describe('性能测试', () => {
    it('应该在高负载下保持稳定', async () => {
      const startTime = performance.now();

      await stateManager.start();

      // 模拟高频率数据更新（100次/秒，持续1秒）
      const updates = 100;
      const updateInterval = 10; // 10ms

      for (let i = 0; i < updates; i++) {
        const stockData = {
          type: 'data' as const,
          data: [{
            ...mockStockData,
            currentPrice: 10.0 + Math.random() * 2,
            profitAmount: Math.random() * 100,
          }],
        };

        mockStdout.emit('data', Buffer.from(JSON.stringify(stockData) + '\n'));
        await new Promise(resolve => setTimeout(resolve, updateInterval));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 应该在合理时间内完成
      expect(duration).toBeLessThan(updates * updateInterval * 2); // 两倍时间

      // 验证数据一致性
      const receivedData = stateManager.getStockData();
      expect(receivedData).toHaveLength(1);
    });

    it('应该处理并发配置更新', async () => {
      await stateManager.start();

      // 并发发送多个配置更新
      const updates = 10;
      const promises = [];

      for (let i = 0; i < updates; i++) {
        const newConfig: PluginConfig = {
          ...mockPluginConfig,
          settings: {
            ...mockPluginConfig.settings,
            updateInterval: 20 + i,
          },
        };

        promises.push(
          vscode.commands.executeCommand('trad.onConfigChanged', newConfig)
        );
      }

      await Promise.all(promises);

      // 验证最后一个配置被发送
      const lastCall = (mockProcess.stdin.write as jest.Mock).mock.calls.slice(-1)[0];
      const sentConfig = JSON.parse(lastCall[0]);
      expect(sentConfig.settings.updateInterval).toBe(29); // 20 + 9
    });
  });

  describe('内存管理测试', () => {
    it('应该正确清理资源', async () => {
      await stateManager.start();

      // 添加多个监听器
      const listeners = [];
      for (let i = 0; i < 10; i++) {
        const listener = jest.fn();
        const remove = stateManager.onStockUpdate(listener);
        listeners.push({ listener, remove });
      }

      // 发送一些数据
      for (let i = 0; i < 5; i++) {
        const stockData = {
          type: 'data' as const,
          data: [mockStockData],
        };
        mockStdout.emit('data', Buffer.from(JSON.stringify(stockData) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 移除一半监听器
      for (let i = 0; i < 5; i++) {
        listeners[i].remove();
      }

      // 发送更多数据
      const stockData = {
        type: 'data' as const,
        data: [mockStockData],
      };
      mockStdout.emit('data', Buffer.from(JSON.stringify(stockData) + '\n'));

      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证只有剩余的监听器被调用
      for (let i = 0; i < 10; i++) {
        if (i < 5) {
          expect(listeners[i].listener).toHaveBeenCalledTimes(5); // 移除前接收了5次
        } else {
          expect(listeners[i].listener).toHaveBeenCalledTimes(6); // 所有6次
        }
      }

      // 停止监控
      await stateManager.stop();

      // 验证进程被清理
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });

  describe('端到端场景测试', () => {
    it('应该模拟真实用户场景', async () => {
      // 场景：用户启动监控 -> 添加股票 -> 更新配置 -> 接收数据 -> 停止监控

      // 1. 用户启动监控
      await stateManager.start();
      expect(stateManager.getState()).toBe(MonitoringState.RUNNING);

      // 2. 用户添加新股票（通过配置管理器）
      const newStock = {
        code: '000002',
        name: '万科A',
        buyPrice: 18.5,
        quantity: 150,
        enabled: true,
        exchange: 'sz',
      };

      // 模拟配置更新
      const updatedConfig: PluginConfig = {
        ...mockPluginConfig,
        stocks: [...mockPluginConfig.stocks, newStock],
      };

      (vscode.commands.executeCommand as jest.Mock).mockImplementation((command, ...args) => {
        if (command === 'trad.onConfigChanged') {
          const configHandler = args[0];
          configHandler(updatedConfig);
        }
      });

      await vscode.commands.executeCommand('trad.onConfigChanged', updatedConfig);

      // 3. 模拟Python进程发送包含新股票的数据
      const stockData = {
        type: 'data' as const,
        data: [
          mockStockData,
          {
            ...mockStockData,
            code: '000002',
            name: '万科A',
            currentPrice: 19.0,
            buyPrice: 18.5,
            quantity: 150,
            profitAmount: 75.0,
            profitPercent: 4.05,
          },
        ],
      };

      mockStdout.emit('data', Buffer.from(JSON.stringify(stockData) + '\n'));
      await new Promise(resolve => setTimeout(resolve, 100));

      // 4. 验证数据正确性
      const receivedData = stateManager.getStockData();
      expect(receivedData).toHaveLength(2);

      const wankeStock = receivedData.find(s => s.code === '000002');
      expect(wankeStock).toBeDefined();
      expect(wankeStock?.profitAmount).toBe(75.0);

      const summary = stateManager.getSummaryData();
      expect(summary?.totalProfit).toBe(100.0); // 25 + 75
      expect(summary?.stockCount).toBe(2);

      // 5. 用户停止监控
      await stateManager.stop();
      expect(stateManager.getState()).toBe(MonitoringState.STOPPED);
    });
  });
});