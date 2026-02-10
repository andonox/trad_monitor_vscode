import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { PythonCommand, PythonResponse, PluginConfig } from './types/stock';

/**
 * Python客户端，负责与Python守护进程通信
 */
export class PythonClient {
  private pythonProcess: child_process.ChildProcess | null = null;
  private pendingRequests: Map<string, (response: PythonResponse) => void> = new Map();
  private messageBuffer: string = '';
  private isConnected: boolean = false;
  private restartCount: number = 0;
  private maxRestarts: number = 5;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * 启动Python守护进程
   */
  async startDaemon(): Promise<boolean> {
    try {
      if (this.pythonProcess && !this.pythonProcess.killed) {
        await this.stopDaemon();
      }

      const pythonPath = this.getPythonPath();
      const daemonPath = path.join(this.context.extensionPath, 'scripts', 'stock_daemon.py');

      this.pythonProcess = child_process.spawn(pythonPath, [daemonPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      this.setupProcessHandlers();
      this.isConnected = true;
      this.restartCount = 0;

      vscode.window.showInformationMessage('Python守护进程已启动');
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`启动Python守护进程失败: ${error}`);
      return false;
    }
  }

  /**
   * 停止Python守护进程
   */
  async stopDaemon(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pythonProcess || this.pythonProcess.killed) {
        resolve();
        return;
      }

      this.pythonProcess.once('exit', () => {
        this.pythonProcess = null;
        this.isConnected = false;
        resolve();
      });

      this.pythonProcess.kill('SIGTERM');
    });
  }

  /**
   * 发送命令到Python进程
   */
  async sendCommand(command: PythonCommand): Promise<PythonResponse> {
    if (!this.pythonProcess || this.pythonProcess.killed) {
      throw new Error('Python进程未运行');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(command.id);
        reject(new Error(`命令超时: ${command.command}`));
      }, 10000); // 10秒超时

      this.pendingRequests.set(command.id, (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      });

      const message = JSON.stringify(command) + '\n';
      this.pythonProcess!.stdin!.write(message);
    });
  }

  /**
   * 发送配置到Python进程
   */
  async sendConfig(config: PluginConfig): Promise<void> {
    const command: PythonCommand = {
      type: 'command',
      command: 'set_config',
      id: this.generateId(),
      timestamp: Date.now(),
      payload: config
    };

    await this.sendCommand(command);
  }

  /**
   * 从Python进程获取配置
   */
  async getConfig(): Promise<PluginConfig | null> {
    const command: PythonCommand = {
      type: 'command',
      command: 'get_config',
      id: this.generateId(),
      timestamp: Date.now()
    };

    const response = await this.sendCommand(command);
    return response.data || null;
  }

  /**
   * 请求更新股票数据
   */
  async requestUpdate(): Promise<any> {
    const command: PythonCommand = {
      type: 'command',
      command: 'update',
      id: this.generateId(),
      timestamp: Date.now()
    };

    const response = await this.sendCommand(command);
    return response.data || [];
  }

  /**
   * 设置进程处理器
   */
  private setupProcessHandlers(): void {
    if (!this.pythonProcess) {
      return;
    }

    // 标准输出处理
    this.pythonProcess.stdout!.on('data', (data: Buffer) => {
      this.messageBuffer += data.toString();
      this.processMessages();
    });

    // 标准错误处理
    this.pythonProcess.stderr!.on('data', (data: Buffer) => {
      console.error(`Python stderr: ${data.toString()}`);
    });

    // 进程退出处理
    this.pythonProcess.on('exit', (code, signal) => {
      this.isConnected = false;
      console.log(`Python进程退出，代码: ${code}, 信号: ${signal}`);

      if (code !== 0 && code !== null) {
        this.handleProcessExit();
      }
    });

    // 进程错误处理
    this.pythonProcess.on('error', (error) => {
      console.error(`Python进程错误: ${error}`);
      this.isConnected = false;
    });
  }

  /**
   * 处理进程退出
   */
  private async handleProcessExit(): Promise<void> {
    if (this.restartCount >= this.maxRestarts) {
      vscode.window.showErrorMessage(
        'Python守护进程多次重启失败，请检查Python环境和依赖'
      );
      return;
    }

    this.restartCount++;

    vscode.window.showWarningMessage(
      `Python守护进程异常退出，正在重启 (${this.restartCount}/${this.maxRestarts})`
    );

    // 等待1秒后重启
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      await this.startDaemon();
      vscode.window.showInformationMessage('Python守护进程已重启');
    } catch (error) {
      vscode.window.showErrorMessage(`重启失败: ${error}`);
    }
  }

  /**
   * 处理消息缓冲区
   */
  private processMessages(): void {
    const lines = this.messageBuffer.split('\n');

    // 保留最后一行（可能不完整）
    this.messageBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const response: PythonResponse = JSON.parse(line);
        this.handleResponse(response);
      } catch (error) {
        console.error(`解析Python响应失败: ${error}, 原始数据: ${line}`);
      }
    }
  }

  /**
   * 处理响应
   */
  private handleResponse(response: PythonResponse): void {
    const callback = this.pendingRequests.get(response.id);
    if (callback) {
      this.pendingRequests.delete(response.id);
      callback(response);
    } else if (response.type === 'data') {
      // 推送数据到事件总线
      vscode.commands.executeCommand('trad.onStockData', response.data);
    } else if (response.type === 'error') {
      console.error(`Python错误: ${response.error}`);
      vscode.window.showErrorMessage(`Python进程错误: ${response.error}`);
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取Python路径
   */
  private getPythonPath(): string {
    const config = vscode.workspace.getConfiguration('trad');
    const customPath = config.get<string>('pythonPath');

    if (customPath) {
      return customPath;
    }

    // 默认使用系统Python
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  /**
   * 检查是否已连接
   */
  isDaemonConnected(): boolean {
    return this.isConnected && this.pythonProcess !== null && !this.pythonProcess.killed;
  }

  /**
   * 销毁客户端
   */
  dispose(): void {
    if (this.pythonProcess && !this.pythonProcess.killed) {
      this.pythonProcess.kill('SIGTERM');
    }
    this.pendingRequests.clear();
  }
}