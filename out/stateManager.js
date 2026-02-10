"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateManager = void 0;
const vscode = __importStar(require("vscode"));
const stock_1 = require("./types/stock");
/**
 * 状态管理器
 */
class StateManager {
    constructor(configManager, pythonClient) {
        this.configManager = configManager;
        this.pythonClient = pythonClient;
        this.state = stock_1.MonitoringState.STOPPED;
        this.timer = null;
        this.stockData = new Map();
        this.summaryData = null;
        this.updateListeners = [];
        this.stateListeners = [];
        this.configChangeListener = null;
        this.stockDataListener = null;
        // 监听配置变化
        this.configChangeListener = vscode.commands.registerCommand('trad.onConfigChanged', (config) => {
            this.handleConfigChange(config);
        });
        // 监听股票数据
        this.stockDataListener = vscode.commands.registerCommand('trad.onStockData', (data) => {
            this.handleStockData(data);
        });
    }
    /**
     * 开始监控
     */
    async start() {
        if (this.state !== stock_1.MonitoringState.STOPPED) {
            return;
        }
        this.setState(stock_1.MonitoringState.STARTING);
        try {
            // 1. 启动Python守护进程
            const success = await this.pythonClient.startDaemon();
            if (!success) {
                throw new Error('无法启动Python守护进程');
            }
            // 2. 发送配置给Python进程
            const config = this.configManager.getConfig();
            await this.pythonClient.sendConfig(config);
            // 3. 开始定时更新
            this.startUpdateTimer();
            this.setState(stock_1.MonitoringState.RUNNING);
            vscode.window.showInformationMessage('股票监控已启动');
        }
        catch (error) {
            this.setState(stock_1.MonitoringState.ERROR);
            vscode.window.showErrorMessage(`启动失败: ${error}`);
        }
    }
    /**
     * 停止监控
     */
    async stop() {
        if (this.state !== stock_1.MonitoringState.RUNNING) {
            return;
        }
        this.setState(stock_1.MonitoringState.STOPPING);
        // 1. 停止定时器
        this.stopUpdateTimer();
        // 2. 通知Python进程停止
        try {
            await this.pythonClient.sendCommand({
                type: 'command',
                command: 'pause',
                id: this.generateId(),
                timestamp: Date.now()
            });
        }
        catch (error) {
            console.warn(`通知Python进程停止失败: ${error}`);
        }
        // 3. 更新状态
        this.setState(stock_1.MonitoringState.STOPPED);
        vscode.window.showInformationMessage('股票监控已停止');
    }
    /**
     * 手动刷新
     */
    async refresh() {
        if (this.state !== stock_1.MonitoringState.RUNNING) {
            vscode.window.showWarningMessage('监控未运行，无法刷新');
            return;
        }
        try {
            const data = await this.pythonClient.requestUpdate();
            this.handleStockData(data);
            vscode.window.showInformationMessage('股票数据已刷新');
        }
        catch (error) {
            vscode.window.showErrorMessage(`刷新失败: ${error}`);
        }
    }
    /**
     * 获取当前状态
     */
    getState() {
        return this.state;
    }
    /**
     * 获取股票数据
     */
    getStockData() {
        return Array.from(this.stockData.values());
    }
    /**
     * 获取单个股票数据
     */
    getStock(code) {
        return this.stockData.get(code);
    }
    /**
     * 获取汇总数据
     */
    getSummary() {
        return this.summaryData;
    }
    /**
     * 添加数据更新监听器
     */
    addUpdateListener(listener) {
        this.updateListeners.push(listener);
    }
    /**
     * 移除数据更新监听器
     */
    removeUpdateListener(listener) {
        const index = this.updateListeners.indexOf(listener);
        if (index >= 0) {
            this.updateListeners.splice(index, 1);
        }
    }
    /**
     * 添加状态监听器
     */
    addStateListener(listener) {
        this.stateListeners.push(listener);
    }
    /**
     * 移除状态监听器
     */
    removeStateListener(listener) {
        const index = this.stateListeners.indexOf(listener);
        if (index >= 0) {
            this.stateListeners.splice(index, 1);
        }
    }
    /**
     * 设置状态
     */
    setState(newState) {
        this.state = newState;
        this.notifyStateListeners();
    }
    /**
     * 开始更新定时器
     */
    startUpdateTimer() {
        const config = this.configManager.getConfig();
        const interval = config.settings.updateInterval * 1000;
        this.stopUpdateTimer(); // 确保没有重复的定时器
        this.timer = setInterval(async () => {
            if (this.state === stock_1.MonitoringState.RUNNING) {
                await this.performUpdate();
            }
        }, interval);
        // 立即执行一次更新
        this.performUpdate();
    }
    /**
     * 停止更新定时器
     */
    stopUpdateTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    /**
     * 执行更新
     */
    async performUpdate() {
        try {
            const data = await this.pythonClient.requestUpdate();
            this.handleStockData(data);
        }
        catch (error) {
            console.error(`更新股票数据失败: ${error}`);
            // 错误处理：可以尝试重启Python进程
            if (this.state === stock_1.MonitoringState.RUNNING) {
                this.setState(stock_1.MonitoringState.ERROR);
                vscode.window.showErrorMessage(`更新失败: ${error}`);
            }
        }
    }
    /**
     * 处理股票数据
     */
    handleStockData(data) {
        if (!Array.isArray(data)) {
            return;
        }
        // 更新股票数据
        for (const stock of data) {
            this.stockData.set(stock.code, stock);
        }
        // 计算汇总数据
        this.calculateSummary();
        // 通知监听器
        this.notifyUpdateListeners();
    }
    /**
     * 处理配置变化
     */
    handleConfigChange(config) {
        if (this.state === stock_1.MonitoringState.RUNNING) {
            // 如果正在运行，重新发送配置给Python进程
            this.pythonClient.sendConfig(config).catch(error => {
                console.error(`发送配置更新失败: ${error}`);
            });
        }
    }
    /**
     * 计算汇总数据
     */
    calculateSummary() {
        const stocks = Array.from(this.stockData.values());
        const enabledStocks = stocks.filter(s => s.enabled);
        let totalProfit = 0;
        let totalMarketValue = 0;
        let totalCostBasis = 0;
        for (const stock of enabledStocks) {
            totalProfit += stock.profitAmount;
            totalMarketValue += stock.marketValue;
            totalCostBasis += stock.costBasis;
        }
        const totalProfitPercent = totalCostBasis > 0 ? (totalProfit / totalCostBasis) * 100 : 0;
        this.summaryData = {
            totalProfit,
            totalProfitPercent,
            totalMarketValue,
            totalCostBasis,
            stockCount: stocks.length,
            enabledCount: enabledStocks.length
        };
    }
    /**
     * 通知数据更新监听器
     */
    notifyUpdateListeners() {
        const data = this.getStockData();
        for (const listener of this.updateListeners) {
            try {
                listener(data);
            }
            catch (error) {
                console.error(`通知更新监听器失败: ${error}`);
            }
        }
    }
    /**
     * 通知状态监听器
     */
    notifyStateListeners() {
        for (const listener of this.stateListeners) {
            try {
                listener(this.state);
            }
            catch (error) {
                console.error(`通知状态监听器失败: ${error}`);
            }
        }
    }
    /**
     * 生成唯一ID
     */
    generateId() {
        return `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * 销毁状态管理器
     */
    dispose() {
        this.stopUpdateTimer();
        this.updateListeners = [];
        this.stateListeners = [];
        this.stockData.clear();
        if (this.configChangeListener) {
            this.configChangeListener.dispose();
            this.configChangeListener = null;
        }
        if (this.stockDataListener) {
            this.stockDataListener.dispose();
            this.stockDataListener = null;
        }
    }
}
exports.StateManager = StateManager;
//# sourceMappingURL=stateManager.js.map