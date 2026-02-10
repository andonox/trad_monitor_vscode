import { PythonClient } from '../../../src/pythonClient';
import { PluginConfig } from '../../../src/types/stock';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';
import { mockPluginConfig, mockPythonResponse, mockPythonError } from '../setup';

// Mock VSCode API和子进程
jest.mock('vscode');
jest.mock('child_process');

describe('PythonClient', () => {
  let pythonClient: PythonClient;
  let mockSpawn: jest.MockedFunction<typeof child_process.spawn>;
  let mockProcess: any;
  let mockStdout: EventEmitter;
  let mockStderr: EventEmitter;

  beforeEach(() => {
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
          // 存储退出处理器以便测试
          mockProcess.exitHandler = handler;
        }
        return mockProcess;
      }),
      exitCode: null,
    };

    mockSpawn = child_process.spawn as jest.MockedFunction<typeof child_process.spawn>;
    mockSpawn.mockReturnValue(mockProcess);

    pythonClient = new PythonClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
    pythonClient.stopDaemon();
  });

  describe('startDaemon()', () => {
    it('应该成功启动Python守护进程', async () => {
      const result = await pythonClient.startDaemon();

      expect(mockSpawn).toHaveBeenCalledWith(
        'python3',
        expect.arrayContaining([expect.stringContaining('stock_daemon.py')]),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: expect.any(String),
        })
      );
      expect(result).toBe(true);
      expect(pythonClient.isDaemonRunning()).toBe(true);
    });

    it('如果进程启动失败应该返回false', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn error');
      });

      const result = await pythonClient.startDaemon();

      expect(result).toBe(false);
      expect(pythonClient.isDaemonRunning()).toBe(false);
    });

    it('如果守护进程已经在运行应该返回true', async () => {
      await pythonClient.startDaemon();
      const result = await pythonClient.startDaemon(); // 第二次调用

      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledTimes(1); // 只启动一次
    });
  });

  describe('stopDaemon()', () => {
    it('应该停止正在运行的守护进程', async () => {
      await pythonClient.startDaemon();
      await pythonClient.stopDaemon();

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(pythonClient.isDaemonRunning()).toBe(false);
    });

    it('如果守护进程没有运行应该不执行任何操作', async () => {
      await pythonClient.stopDaemon();

      expect(mockProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe('sendConfig()', () => {
    it('应该发送配置到Python进程', async () => {
      await pythonClient.startDaemon();
      const result = await pythonClient.sendConfig(mockPluginConfig);

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(mockPluginConfig))
      );
      expect(result).toBe(true);
    });

    it('如果进程没有运行应该返回false', async () => {
      const result = await pythonClient.sendConfig(mockPluginConfig);

      expect(result).toBe(false);
      expect(mockProcess.stdin.write).not.toHaveBeenCalled();
    });

    it('应该处理写入错误', async () => {
      await pythonClient.startDaemon();
      mockProcess.stdin.write.mockImplementation(() => {
        throw new Error('Write error');
      });

      const result = await pythonClient.sendConfig(mockPluginConfig);

      expect(result).toBe(false);
    });
  });

  describe('数据处理', () => {
    it('应该解析有效的JSON数据', (done) => {
      pythonClient.startDaemon();

      const dataListener = jest.fn((data) => {
        expect(data.type).toBe('data');
        expect(data.data).toHaveLength(1);
        expect(data.data[0].code).toBe('600000');
        done();
      });

      pythonClient.onData(dataListener);

      // 模拟stdout数据
      const jsonData = JSON.stringify(mockPythonResponse);
      mockStdout.emit('data', Buffer.from(jsonData + '\n'));
    });

    it('应该处理错误响应', (done) => {
      pythonClient.startDaemon();

      const errorListener = jest.fn((error) => {
        expect(error.type).toBe('error');
        expect(error.error).toBe('Network error');
        done();
      });

      pythonClient.onError(errorListener);

      // 模拟stderr数据
      const jsonError = JSON.stringify(mockPythonError);
      mockStderr.emit('data', Buffer.from(jsonError + '\n'));
    });

    it('应该忽略无效的JSON数据', () => {
      pythonClient.startDaemon();

      const dataListener = jest.fn();
      const errorListener = jest.fn();

      pythonClient.onData(dataListener);
      pythonClient.onError(errorListener);

      // 发送无效JSON
      mockStdout.emit('data', Buffer.from('invalid json\n'));

      expect(dataListener).not.toHaveBeenCalled();
      expect(errorListener).not.toHaveBeenCalled();
    });

    it('应该处理分块数据', (done) => {
      pythonClient.startDaemon();

      const dataListener = jest.fn((data) => {
        expect(data.type).toBe('data');
        done();
      });

      pythonClient.onData(dataListener);

      // 分两次发送数据
      const jsonData = JSON.stringify(mockPythonResponse);
      const halfLength = Math.floor(jsonData.length / 2);

      mockStdout.emit('data', Buffer.from(jsonData.slice(0, halfLength)));
      mockStdout.emit('data', Buffer.from(jsonData.slice(halfLength) + '\n'));
    });
  });

  describe('进程退出处理', () => {
    it('应该处理正常退出', (done) => {
      pythonClient.startDaemon();

      const exitListener = jest.fn((code) => {
        expect(code).toBe(0);
        done();
      });

      pythonClient.onExit(exitListener);

      // 模拟进程退出
      mockProcess.exitCode = 0;
      if (mockProcess.exitHandler) {
        mockProcess.exitHandler(0);
      }
    });

    it('应该处理异常退出', (done) => {
      pythonClient.startDaemon();

      const exitListener = jest.fn((code) => {
        expect(code).toBe(1);
        done();
      });

      pythonClient.onExit(exitListener);

      // 模拟进程异常退出
      mockProcess.exitCode = 1;
      if (mockProcess.exitHandler) {
        mockProcess.exitHandler(1);
      }
    });

    it('进程退出后应该清理资源', async () => {
      await pythonClient.startDaemon();

      // 模拟进程退出
      mockProcess.exitCode = 0;
      if (mockProcess.exitHandler) {
        mockProcess.exitHandler(0);
      }

      expect(pythonClient.isDaemonRunning()).toBe(false);

      // 尝试发送配置应该失败
      const result = await pythonClient.sendConfig(mockPluginConfig);
      expect(result).toBe(false);
    });
  });

  describe('事件监听器管理', () => {
    it('应该添加和移除数据监听器', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const remove1 = pythonClient.onData(listener1);
      const remove2 = pythonClient.onData(listener2);

      // 触发数据事件
      pythonClient['handleData'](mockPythonResponse);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      // 移除第一个监听器
      remove1();
      jest.clearAllMocks();

      // 再次触发数据事件
      pythonClient['handleData'](mockPythonResponse);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('应该添加和移除错误监听器', () => {
      const listener = jest.fn();
      const remove = pythonClient.onError(listener);

      // 触发错误事件
      pythonClient['handleError'](mockPythonError);

      expect(listener).toHaveBeenCalled();

      // 移除监听器
      remove();
      jest.clearAllMocks();

      // 再次触发错误事件
      pythonClient['handleError'](mockPythonError);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('性能测试', () => {
    it('应该处理高频数据更新', () => {
      pythonClient.startDaemon();

      const dataListener = jest.fn();
      pythonClient.onData(dataListener);

      // 发送100条数据
      for (let i = 0; i < 100; i++) {
        const data = {
          type: 'data' as const,
          data: [{ ...mockPythonResponse.data[0], code: `6000${i.toString().padStart(2, '0')}` }],
        };
        pythonClient['handleData'](data);
      }

      expect(dataListener).toHaveBeenCalledTimes(100);
    });
  });
});