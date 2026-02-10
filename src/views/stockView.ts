import * as vscode from 'vscode';
import { StockData, MonitoringState, SummaryData } from '../types/stock';
import { StateManager } from '../stateManager';

/**
 * Stock tree view item
 */
export class StockTreeItem extends vscode.TreeItem {
  constructor(
    public readonly stockData: StockData,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(stockData.name || stockData.code, collapsibleState);

    // Set icon and color based on profit/loss
    if (stockData.profitAmount > 0) {
      this.iconPath = new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('charts.green'));
    } else if (stockData.profitAmount < 0) {
      this.iconPath = new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('charts.red'));
    } else {
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

/**
 * Control tree view item
 */
export class ControlTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    command: string,
    icon: string,
    tooltip?: string,
    args?: any[]
  ) {
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

/**
 * Summary tree view item
 */
export class SummaryTreeItem extends vscode.TreeItem {
  constructor(summary: SummaryData) {
    const sign = summary.totalProfit >= 0 ? '+' : '';
    const label = `Summary: ${sign}${summary.totalProfit.toFixed(2)} CNY (${sign}${summary.totalProfitPercent.toFixed(2)}%)`;

    super(label, vscode.TreeItemCollapsibleState.None);

    // 根据总盈亏设置图标
    if (summary.totalProfit > 0) {
      this.iconPath = new vscode.ThemeIcon('graph', new vscode.ThemeColor('charts.green'));
    } else if (summary.totalProfit < 0) {
      this.iconPath = new vscode.ThemeIcon('graph', new vscode.ThemeColor('charts.red'));
    } else {
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

/**
 * Stock tree view provider
 */
export class StockTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private state: MonitoringState = MonitoringState.STOPPED;
  private stockData: StockData[] = [];
  private summaryData: SummaryData | null = null;

  constructor(private stateManager: StateManager) {
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
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children items
   */
  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
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
    } else if (element.contextValue === 'stockListHeader') {
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
  private getRootItems(): vscode.TreeItem[] {
    console.log('getRootItems called, stockData:', this.stockData.length, this.stockData);
    console.log('state:', this.state, 'summary:', this.summaryData);

    const items: vscode.TreeItem[] = [];

    // Title item
    const titleItem = new vscode.TreeItem(
      `TRAD Stock Monitor [${this.getStateText()}]`,
      vscode.TreeItemCollapsibleState.None
    );
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
      const stockListHeader = new vscode.TreeItem(
        `Stock List (${this.stockData.length})`,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      stockListHeader.iconPath = new vscode.ThemeIcon('list-tree');
      stockListHeader.contextValue = 'stockListHeader';
      items.push(stockListHeader);
    }

    return items;
  }

  /**
   * Get control items
   */
  private getControlItems(): vscode.TreeItem[] {
    const items: vscode.TreeItem[] = [];

    // Show different control items based on state
    switch (this.state) {
      case MonitoringState.STOPPED:
      case MonitoringState.ERROR:
        items.push(new ControlTreeItem(
          '▶ Start Monitoring',
          'trad.startMonitoring',
          'play',
          'Start stock monitoring'
        ));
        break;

      case MonitoringState.RUNNING:
        items.push(new ControlTreeItem(
          '⏹ Stop Monitoring',
          'trad.stopMonitoring',
          'stop',
          'Stop stock monitoring'
        ));
        items.push(new ControlTreeItem(
          '🔄 Manual Refresh',
          'trad.refresh',
          'refresh',
          'Manually refresh stock data'
        ));
        break;

      case MonitoringState.STARTING:
      case MonitoringState.STOPPING:
        items.push(new ControlTreeItem(
          '⏳ Processing...',
          '',
          'sync~spin',
          'Please wait'
        ));
        break;
    }

    // Always show configuration item
    items.push(new ControlTreeItem(
      '⚙️ Configuration',
      'trad.openConfig',
      'gear',
      'Open configuration interface'
    ));

    // Add stock item
    items.push(new ControlTreeItem(
      '➕ Add Stock',
      'trad.addStock',
      'add',
      'Add new stock'
    ));

    return items;
  }

  /**
   * Get stock items
   */
  private getStockItems(): StockTreeItem[] {
    console.log('getStockItems called, stockData length:', this.stockData.length);
    console.log('stockData:', this.stockData);

    try {
      const items = this.stockData.map(stock => {
        console.log('Creating StockTreeItem for:', stock.code, stock.name);
        return new StockTreeItem(stock, vscode.TreeItemCollapsibleState.None);
      });
      console.log('Created stock items:', items.length);
      return items;
    } catch (error) {
      console.error('Error creating stock items:', error);
      return [];
    }
  }

  /**
   * Get state text
   */
  private getStateText(): string {
    switch (this.state) {
      case MonitoringState.STOPPED:
        return 'Stopped';
      case MonitoringState.STARTING:
        return 'Starting';
      case MonitoringState.RUNNING:
        return 'Running';
      case MonitoringState.STOPPING:
        return 'Stopping';
      case MonitoringState.ERROR:
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  /**
   * Handle tree item click
   */
  handleTreeItemClick(item: vscode.TreeItem): void {
    if (item instanceof StockTreeItem) {
      // Show stock details
      vscode.commands.executeCommand('trad.showStockDetails', item.stockData.code);
    }
  }

  /**
   * Dispose tree view provider
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}