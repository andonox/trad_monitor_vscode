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
exports.ConfigManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * 配置管理器
 */
class ConfigManager {
    constructor(context) {
        this.context = context;
        this.configDir = path.join(context.globalStorageUri.fsPath, '..', 'trad');
        this.configPath = path.join(this.configDir, 'config.json');
        this.config = this.loadDefaultConfig();
        this.ensureConfigDir();
        this.loadConfig();
    }
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig,
            settings: {
                ...this.config.settings,
                ...(newConfig.settings || {})
            }
        };
        this.saveConfig();
    }
    /**
     * 添加股票配置
     */
    addStock(stock) {
        // 检查是否已存在
        const existingIndex = this.config.stocks.findIndex(s => s.code === stock.code);
        if (existingIndex >= 0) {
            // 更新现有股票
            this.config.stocks[existingIndex] = {
                ...this.config.stocks[existingIndex],
                ...stock
            };
        }
        else {
            // 添加新股票
            this.config.stocks.push(stock);
        }
        this.saveConfig();
    }
    /**
     * 更新股票配置
     */
    updateStock(code, updates) {
        const index = this.config.stocks.findIndex(s => s.code === code);
        if (index >= 0) {
            this.config.stocks[index] = {
                ...this.config.stocks[index],
                ...updates
            };
            this.saveConfig();
        }
    }
    /**
     * 删除股票配置
     */
    removeStock(code) {
        this.config.stocks = this.config.stocks.filter(s => s.code !== code);
        this.saveConfig();
    }
    /**
     * 获取股票配置
     */
    getStock(code) {
        return this.config.stocks.find(s => s.code === code);
    }
    /**
     * 获取所有股票配置
     */
    getAllStocks() {
        return [...this.config.stocks];
    }
    /**
     * 获取启用的股票配置
     */
    getEnabledStocks() {
        return this.config.stocks.filter(s => s.enabled);
    }
    /**
     * 保存配置
     */
    saveConfig() {
        try {
            // 创建备份
            this.createBackup();
            // 保存新配置
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
            // 触发配置更新事件
            vscode.commands.executeCommand('trad.onConfigChanged', this.config);
        }
        catch (error) {
            vscode.window.showErrorMessage(`保存配置失败: ${error}`);
        }
    }
    /**
     * 加载配置
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf8');
                const loadedConfig = JSON.parse(content);
                // 验证和合并配置
                this.config = this.validateAndMergeConfig(loadedConfig);
            }
            else {
                // 使用默认配置并保存
                this.saveConfig();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`加载配置失败: ${error}`);
            // 使用默认配置
            this.config = this.loadDefaultConfig();
        }
    }
    /**
     * 验证和合并配置
     */
    validateAndMergeConfig(loadedConfig) {
        const defaultConfig = this.loadDefaultConfig();
        // 确保版本兼容性
        if (!loadedConfig.version || loadedConfig.version !== defaultConfig.version) {
            // 版本不匹配，使用默认配置
            return defaultConfig;
        }
        // 合并配置
        return {
            version: loadedConfig.version || defaultConfig.version,
            stocks: this.validateStocks(loadedConfig.stocks || defaultConfig.stocks),
            settings: {
                ...defaultConfig.settings,
                ...(loadedConfig.settings || {})
            }
        };
    }
    /**
     * 验证股票配置
     */
    validateStocks(stocks) {
        if (!Array.isArray(stocks)) {
            return [];
        }
        return stocks.filter(stock => {
            return (stock &&
                typeof stock.code === 'string' &&
                stock.code.length >= 6 &&
                typeof stock.buyPrice === 'number' &&
                stock.buyPrice > 0 &&
                typeof stock.quantity === 'number' &&
                stock.quantity > 0 &&
                typeof stock.enabled === 'boolean');
        }).map(stock => ({
            code: stock.code,
            name: stock.name || undefined,
            buyPrice: stock.buyPrice,
            quantity: stock.quantity,
            enabled: stock.enabled,
            exchange: stock.exchange || undefined
        }));
    }
    /**
     * 加载默认配置
     */
    loadDefaultConfig() {
        return {
            version: '1.0.0',
            stocks: [],
            settings: {
                updateInterval: 20,
                autoStart: false,
                showNotifications: true,
                priceAlertThreshold: 5.0,
                dataSourcePriority: 'sina'
            }
        };
    }
    /**
     * 确保配置目录存在
     */
    ensureConfigDir() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }
    /**
     * 创建配置备份
     */
    createBackup() {
        if (fs.existsSync(this.configPath)) {
            const backupPath = `${this.configPath}.backup`;
            try {
                fs.copyFileSync(this.configPath, backupPath);
            }
            catch (error) {
                console.warn(`创建配置备份失败: ${error}`);
            }
        }
    }
    /**
     * 恢复配置
     */
    async restoreConfig() {
        const backupPath = `${this.configPath}.backup`;
        if (!fs.existsSync(backupPath)) {
            vscode.window.showErrorMessage('没有找到备份文件');
            return false;
        }
        try {
            fs.copyFileSync(backupPath, this.configPath);
            this.loadConfig();
            vscode.window.showInformationMessage('配置已从备份恢复');
            return true;
        }
        catch (error) {
            vscode.window.showErrorMessage(`恢复配置失败: ${error}`);
            return false;
        }
    }
    /**
     * 导出配置
     */
    async exportConfig() {
        const options = {
            defaultUri: vscode.Uri.file(path.join(this.configDir, 'trad_config_export.json')),
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            }
        };
        const fileUri = await vscode.window.showSaveDialog(options);
        if (fileUri) {
            try {
                fs.writeFileSync(fileUri.fsPath, JSON.stringify(this.config, null, 2), 'utf8');
                vscode.window.showInformationMessage(`配置已导出到: ${fileUri.fsPath}`);
            }
            catch (error) {
                vscode.window.showErrorMessage(`导出配置失败: ${error}`);
            }
        }
    }
    /**
     * 导入配置
     */
    async importConfig() {
        const options = {
            canSelectMany: false,
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            }
        };
        const fileUris = await vscode.window.showOpenDialog(options);
        if (fileUris && fileUris.length > 0) {
            try {
                const content = fs.readFileSync(fileUris[0].fsPath, 'utf8');
                const importedConfig = JSON.parse(content);
                // 验证配置
                const validatedConfig = this.validateAndMergeConfig(importedConfig);
                // 创建当前配置的备份
                this.createBackup();
                // 应用新配置
                this.config = validatedConfig;
                this.saveConfig();
                vscode.window.showInformationMessage('配置已导入并应用');
                return true;
            }
            catch (error) {
                vscode.window.showErrorMessage(`导入配置失败: ${error}`);
                return false;
            }
        }
        return false;
    }
    /**
     * 重置为默认配置
     */
    resetToDefault() {
        const result = vscode.window.showWarningMessage('确定要重置为默认配置吗？当前配置将丢失。', { modal: true }, '确定', '取消');
        result.then(selection => {
            if (selection === '确定') {
                this.config = this.loadDefaultConfig();
                this.saveConfig();
                vscode.window.showInformationMessage('已重置为默认配置');
            }
        });
    }
    /**
     * 销毁配置管理器
     */
    dispose() {
        // 清理资源
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=configManager.js.map