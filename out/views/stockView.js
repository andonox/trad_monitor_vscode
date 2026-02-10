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
exports.StockTreeDataProvider = exports.SummaryTreeItem = exports.ControlTreeItem = exports.StockTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const stock_1 = require("../types/stock");
/**
 * Stock tree view item
 */
class StockTreeItem extends vscode.TreeItem {
    constructor(stockData, collapsibleState) {
        super(stockData.name || stockData.code, collapsibleState);
        this.stockData = stockData;
        this.collapsibleState = collapsibleState;
        // Set icon and color based on profit/loss
        if (stockData.profitAmount > 0) {
            this.iconPath = new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('charts.green'));
        }
        else if (stockData.profitAmount < 0) {
            this.iconPath = new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('charts.red'));
        }
        else {
            this.iconPath = new vscode.ThemeIcon('dash');
        }
        // Description shows profit/loss information
        const sign = stockData.profitAmount >= 0 ? '+' : '';
        this.description = `${sign}${stockData.profitAmount.toFixed(2)} CNY (${sign}${stockData.profitPercent.toFixed(2)}%)`;
        // Tooltip shows detailed information
        this.tooltip = new vscode.MarkdownString(`
### ${stockData.name} (${stockData.code})
- **Current Price**: ${stockData.currentPrice.toFixed(2)} CNY
- **Buy Price**: ${stockData.buyPrice.toFixed(2)} CNY
- **Position**: ${stockData.quantity} shares
- **Profit/Loss**: ${stockData.profitAmount.toFixed(2)} CNY (${stockData.profitPercent.toFixed(2)}%)
- **Market Value**: ${stockData.marketValue.toFixed(2)} CNY
- **Cost Basis**: ${stockData.costBasis.toFixed(2)} CNY
- **Change**: ${stockData.change.toFixed(2)} CNY (${stockData.changePercent.toFixed(2)}%)
- **Status**: ${stockData.enabled ? '✅ Enabled' : '❌ Disabled'}
- **Last Update**: ${new Date(stockData.lastUpdate).toLocaleTimeString()}
    `);
        // Context value for right-click menu
        this.contextValue = 'stockItem';
        // Command: show details when clicked
        this.command = {
            command: 'trad.showStockDetails',
            title: 'Show Stock Details',
            arguments: [stockData.code]
        };
    }
}
exports.StockTreeItem = StockTreeItem;
/**
 * Control tree view item
 */
class ControlTreeItem extends vscode.TreeItem {
    constructor(label, command, icon, tooltip, args) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(icon);
        this.command = {
            command,
            title: label,
            arguments: args
        };
        if (tooltip) {
            this.tooltip = tooltip;
        }
        this.contextValue = 'controlItem';
    }
}
exports.ControlTreeItem = ControlTreeItem;
/**
 * Summary tree view item
 */
class SummaryTreeItem extends vscode.TreeItem {
    constructor(summary) {
        const sign = summary.totalProfit >= 0 ? '+' : '';
        const label = `Summary: ${sign}${summary.totalProfit.toFixed(2)} CNY (${sign}${summary.totalProfitPercent.toFixed(2)}%)`;
        super(label, vscode.TreeItemCollapsibleState.None);
        // 根据总盈亏设置图标
        if (summary.totalProfit > 0) {
            this.iconPath = new vscode.ThemeIcon('graph', new vscode.ThemeColor('charts.green'));
        }
        else if (summary.totalProfit < 0) {
            this.iconPath = new vscode.ThemeIcon('graph', new vscode.ThemeColor('charts.red'));
        }
        else {
            this.iconPath = new vscode.ThemeIcon('graph');
        }
        // Tooltip shows detailed information
        this.tooltip = new vscode.MarkdownString(`
### Investment Summary
- **Total Profit/Loss**: ${sign}${summary.totalProfit.toFixed(2)} CNY (${sign}${summary.totalProfitPercent.toFixed(2)}%)
- **Total Market Value**: ${summary.totalMarketValue.toFixed(2)} CNY
- **Total Cost Basis**: ${summary.totalCostBasis.toFixed(2)} CNY
- **Stock Count**: ${summary.stockCount} stocks
- **Enabled Stocks**: ${summary.enabledCount} stocks
    `);
        this.contextValue = 'summaryItem';
    }
}
exports.SummaryTreeItem = SummaryTreeItem;
/**
 * Stock tree view provider
 */
class StockTreeDataProvider {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.state = stock_1.MonitoringState.STOPPED;
        this.stockData = [];
        this.summaryData = null;
        // Listen for state changes
        stateManager.addStateListener((state) => {
            this.state = state;
            this.refresh();
        });
        // Listen for data updates
        stateManager.addUpdateListener((data) => {
            this.stockData = data;
            this.summaryData = stateManager.getSummary();
            this.refresh();
        });
        // Initial data fetch
        this.stockData = stateManager.getStockData();
        this.summaryData = stateManager.getSummary();
        this.state = stateManager.getState();
    }
    /**
     * Refresh tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children items
     */
    getChildren(element) {
        console.log('getChildren called, element:', element ? {
            label: element.label,
            contextValue: element.contextValue,
            collapsibleState: element.collapsibleState
        } : 'root');
        if (!element) {
            // Root node: show control items and stock list
            const rootItems = this.getRootItems();
            console.log('Returning root items:', rootItems.map(item => item.label));
            return Promise.resolve(rootItems);
        }
        else if (element.contextValue === 'stockListHeader') {
            // Stock list children items
            const stockItems = this.getStockItems();
            console.log('Returning stock items, count:', stockItems.length);
            return Promise.resolve(stockItems);
        }
        console.log('No matching element, returning empty array');
        return Promise.resolve([]);
    }
    /**
     * Get root items
     */
    getRootItems() {
        console.log('getRootItems called, stockData:', this.stockData.length, this.stockData);
        console.log('state:', this.state, 'summary:', this.summaryData);
        const items = [];
        // Title item
        const titleItem = new vscode.TreeItem(`TRAD Stock Monitor [${this.getStateText()}]`, vscode.TreeItemCollapsibleState.None);
        titleItem.iconPath = new vscode.ThemeIcon('graph');
        titleItem.contextValue = 'titleItem';
        items.push(titleItem);
        // Control items
        items.push(...this.getControlItems());
        // Summary item (if data exists)
        if (this.summaryData) {
            items.push(new SummaryTreeItem(this.summaryData));
        }
        // Stock list item
        if (this.stockData.length > 0) {
            const stockListHeader = new vscode.TreeItem(`Stock List (${this.stockData.length})`, vscode.TreeItemCollapsibleState.Collapsed);
            stockListHeader.iconPath = new vscode.ThemeIcon('list-tree');
            stockListHeader.contextValue = 'stockListHeader';
            items.push(stockListHeader);
        }
        return items;
    }
    /**
     * Get control items
     */
    getControlItems() {
        const items = [];
        // Show different control items based on state
        switch (this.state) {
            case stock_1.MonitoringState.STOPPED:
            case stock_1.MonitoringState.ERROR:
                items.push(new ControlTreeItem('▶ Start Monitoring', 'trad.startMonitoring', 'play', 'Start stock monitoring'));
                break;
            case stock_1.MonitoringState.RUNNING:
                items.push(new ControlTreeItem('⏹ Stop Monitoring', 'trad.stopMonitoring', 'stop', 'Stop stock monitoring'));
                items.push(new ControlTreeItem('🔄 Manual Refresh', 'trad.refresh', 'refresh', 'Manually refresh stock data'));
                break;
            case stock_1.MonitoringState.STARTING:
            case stock_1.MonitoringState.STOPPING:
                items.push(new ControlTreeItem('⏳ Processing...', '', 'sync~spin', 'Please wait'));
                break;
        }
        // Always show configuration item
        items.push(new ControlTreeItem('⚙️ Configuration', 'trad.openConfig', 'gear', 'Open configuration interface'));
        // Add stock item
        items.push(new ControlTreeItem('➕ Add Stock', 'trad.addStock', 'add', 'Add new stock'));
        return items;
    }
    /**
     * Get stock items
     */
    getStockItems() {
        console.log('getStockItems called, stockData length:', this.stockData.length);
        console.log('stockData:', this.stockData);
        try {
            const items = this.stockData.map(stock => {
                console.log('Creating StockTreeItem for:', stock.code, stock.name);
                return new StockTreeItem(stock, vscode.TreeItemCollapsibleState.None);
            });
            console.log('Created stock items:', items.length);
            return items;
        }
        catch (error) {
            console.error('Error creating stock items:', error);
            return [];
        }
    }
    /**
     * Get state text
     */
    getStateText() {
        switch (this.state) {
            case stock_1.MonitoringState.STOPPED:
                return 'Stopped';
            case stock_1.MonitoringState.STARTING:
                return 'Starting';
            case stock_1.MonitoringState.RUNNING:
                return 'Running';
            case stock_1.MonitoringState.STOPPING:
                return 'Stopping';
            case stock_1.MonitoringState.ERROR:
                return 'Error';
            default:
                return 'Unknown';
        }
    }
    /**
     * Handle tree item click
     */
    handleTreeItemClick(item) {
        if (item instanceof StockTreeItem) {
            // Show stock details
            vscode.commands.executeCommand('trad.showStockDetails', item.stockData.code);
        }
    }
    /**
     * Dispose tree view provider
     */
    dispose() {
        this._onDidChangeTreeData.dispose();
    }
}
exports.StockTreeDataProvider = StockTreeDataProvider;
//# sourceMappingURL=stockView.js.map