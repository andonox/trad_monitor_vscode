import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import { PythonClient } from './pythonClient';
import { StateManager } from './stateManager';
import { StockTreeDataProvider } from './views/stockView';

/**
 * VSCode extension main entry point
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('TRAD Stock Monitor extension activated');

    // Initialize core components
    const configManager = new ConfigManager(context);
    const pythonClient = new PythonClient(context);
    const stateManager = new StateManager(configManager, pythonClient);

    // Register TreeView
    const treeDataProvider = new StockTreeDataProvider(stateManager);
    const treeView = vscode.window.createTreeView('tradStockMonitor', {
        treeDataProvider,
        showCollapseAll: true
    });

    // Register commands
    const commands = [
        // Monitoring control commands
        vscode.commands.registerCommand('trad.startMonitoring', () => {
            stateManager.start();
        }),
        vscode.commands.registerCommand('trad.stopMonitoring', () => {
            stateManager.stop();
        }),
        vscode.commands.registerCommand('trad.refresh', () => {
            stateManager.refresh();
        }),

        // Configuration related commands
        vscode.commands.registerCommand('trad.openConfig', async () => {
            await openConfigurationWebview(context, configManager);
        }),
        vscode.commands.registerCommand('trad.addStock', async () => {
            await addStockInteractive(configManager);
        }),

        // Stock details command
        vscode.commands.registerCommand('trad.showStockDetails', (code: string) => {
            showStockDetails(code, stateManager);
        }),

        // Configuration management commands
        vscode.commands.registerCommand('trad.importConfig', async () => {
            const success = await configManager.importConfig();
            if (success) {
                vscode.window.showInformationMessage('Configuration imported successfully');
            }
        }),
        vscode.commands.registerCommand('trad.exportConfig', async () => {
            await configManager.exportConfig();
        }),
        vscode.commands.registerCommand('trad.resetConfig', async () => {
            configManager.resetToDefault();
        }),
        vscode.commands.registerCommand('trad.restoreConfig', async () => {
            const success = await configManager.restoreConfig();
            if (success) {
                vscode.window.showInformationMessage('Configuration restored successfully');
            }
        })
    ];

    // Add context subscriptions
    commands.forEach(command => context.subscriptions.push(command));
    context.subscriptions.push(treeView);
    context.subscriptions.push(stateManager);
    context.subscriptions.push(configManager);
    context.subscriptions.push(pythonClient);

    // Auto-start monitoring (if configured)
    const config = configManager.getConfig();
    if (config.settings.autoStart) {
        setTimeout(() => {
            stateManager.start().catch(error => {
                console.error('Auto-start monitoring failed:', error);
            });
        }, 2000); // 延迟2秒启动，确保插件完全初始化
    }

    // Register status bar
    const statusBarItem = createStatusBarItem(stateManager);
    context.subscriptions.push(statusBarItem);

    console.log('TRAD extension initialization completed');
}

/**
 * Open configuration Webview
 */
async function openConfigurationWebview(context: vscode.ExtensionContext, configManager: ConfigManager): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
        'tradConfig',
        'TRAD Stock Monitor Configuration',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Get current configuration
    const config = configManager.getConfig();

    // Set Webview HTML content
    panel.webview.html = getWebviewContent(config);

    // Handle messages from Webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'saveConfig':
                    try {
                        configManager.updateConfig(message.config);
                        vscode.window.showInformationMessage('Configuration saved');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to save configuration: ${error}`);
                    }
                    break;
                case 'addStock':
                    await addStockInteractive(configManager);
                    break;
                case 'removeStock':
                    configManager.removeStock(message.code);
                    break;
                case 'toggleStock':
                    configManager.updateStock(message.code, { enabled: message.enabled });
                    break;
                case 'exportConfig':
                    await configManager.exportConfig();
                    break;
                case 'importConfig':
                    const importSuccess = await configManager.importConfig();
                    if (importSuccess) {
                        // Reload configuration and update Webview
                        const updatedConfig = configManager.getConfig();
                        panel.webview.html = getWebviewContent(updatedConfig);
                    }
                    break;
                case 'resetConfig':
                    configManager.resetToDefault();
                    // Reload configuration and update Webview
                    const defaultConfig = configManager.getConfig();
                    panel.webview.html = getWebviewContent(defaultConfig);
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

/**
 * Get Webview HTML content
 */
function getWebviewContent(config: any): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TRAD Configuration</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
                padding: 20px;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
            }
            .section {
                margin-bottom: 30px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                padding: 20px;
                background-color: var(--vscode-editor-background);
            }
            h2 {
                margin-top: 0;
                color: var(--vscode-editor-foreground);
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 10px;
            }
            .form-group {
                margin-bottom: 15px;
            }
            label {
                display: block;
                margin-bottom: 5px;
                color: var(--vscode-editor-foreground);
            }
            input, select {
                width: 100%;
                padding: 8px;
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                box-sizing: border-box;
            }
            button {
                padding: 8px 16px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            .stock-list {
                margin-top: 20px;
            }
            .stock-item {
                display: flex;
                align-items: center;
                padding: 10px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                margin-bottom: 10px;
                background-color: var(--vscode-editor-background);
            }
            .stock-info {
                flex: 1;
            }
            .stock-actions button {
                margin-left: 10px;
            }
            .status {
                padding: 10px;
                border-radius: 4px;
                margin-bottom: 15px;
            }
            .status.success {
                background-color: var(--vscode-editorInfo-background);
                color: var(--vscode-editorInfo-foreground);
            }
            .status.error {
                background-color: var(--vscode-editorError-background);
                color: var(--vscode-editorError-foreground);
            }
        </style>
    </head>
    <body>
        <h1>TRAD Stock Monitor Configuration</h1>

        <div class="section">
            <h2>Global Settings</h2>
            <div class="form-group">
                <label for="updateInterval">Update Interval (seconds)</label>
                <input type="number" id="updateInterval" value="${config.settings.updateInterval}" min="5" max="3600">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="autoStart" ${config.settings.autoStart ? 'checked' : ''}>
                    Auto-start monitoring on launch
                </label>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="showNotifications" ${config.settings.showNotifications ? 'checked' : ''}>
                    Show desktop notifications
                </label>
            </div>
            <div class="form-group">
                <label for="priceAlertThreshold">Price Alert Threshold (%)</label>
                <input type="number" id="priceAlertThreshold" value="${config.settings.priceAlertThreshold}" min="0.1" max="50" step="0.1">
            </div>
            <div class="form-group">
                <label for="dataSourcePriority">Data Source Priority</label>
                <select id="dataSourcePriority">
                    <option value="sina" ${config.settings.dataSourcePriority === 'sina' ? 'selected' : ''}>Sina Finance API</option>
                    <option value="akshare" ${config.settings.dataSourcePriority === 'akshare' ? 'selected' : ''}>akshare</option>
                </select>
            </div>
        </div>

        <div class="section">
            <h2>Stock Configuration</h2>
            <button onclick="addStock()">Add Stock</button>

            <div class="stock-list" id="stockList">
                ${config.stocks.map((stock: any, index: number) => `
                    <div class="stock-item" data-code="${stock.code}">
                        <div class="stock-info">
                            <strong>${stock.code}</strong> ${stock.name || ''}
                            <br>
                            Buy Price: ${stock.buyPrice} CNY, Quantity: ${stock.quantity} shares
                        </div>
                        <div class="stock-actions">
                            <button onclick="toggleStock('${stock.code}', ${!stock.enabled})">
                                ${stock.enabled ? 'Disable' : 'Enable'}
                            </button>
                            <button onclick="removeStock('${stock.code}')">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <button onclick="saveConfig()">Save Configuration</button>
            <button onclick="vscode.postMessage({ command: 'exportConfig' })">Export Configuration</button>
            <button onclick="vscode.postMessage({ command: 'importConfig' })">Import Configuration</button>
            <button onclick="vscode.postMessage({ command: 'resetConfig' })">Reset to Default</button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function saveConfig() {
                const config = {
                    version: '1.0.0',
                    stocks: ${JSON.stringify(config.stocks)},
                    settings: {
                        updateInterval: parseInt(document.getElementById('updateInterval').value),
                        autoStart: document.getElementById('autoStart').checked,
                        showNotifications: document.getElementById('showNotifications').checked,
                        priceAlertThreshold: parseFloat(document.getElementById('priceAlertThreshold').value),
                        dataSourcePriority: document.getElementById('dataSourcePriority').value
                    }
                };

                vscode.postMessage({
                    command: 'saveConfig',
                    config: config
                });
            }

            function addStock() {
                vscode.postMessage({ command: 'addStock' });
            }

            function removeStock(code) {
                if (confirm('Are you sure you want to delete this stock?')) {
                    vscode.postMessage({
                        command: 'removeStock',
                        code: code
                    });
                }
            }

            function toggleStock(code, enabled) {
                vscode.postMessage({
                    command: 'toggleStock',
                    code: code,
                    enabled: enabled
                });
            }

            // 保存当前配置状态
            vscode.setState({ config: ${JSON.stringify(config)} });
        </script>
    </body>
    </html>`;
}

/**
 * 交互式添加股票
 */
async function addStockInteractive(configManager: ConfigManager): Promise<void> {
    const code = await vscode.window.showInputBox({
        prompt: 'Please enter stock code (e.g., 600000)',
        placeHolder: 'Stock Code',
        validateInput: (value) => {
            if (!value || value.length < 6) {
                return 'Please enter a valid stock code (6 digits)';
            }
            if (!/^\d+$/.test(value)) {
                return 'Stock code can only contain digits';
            }
            return null;
        }
    });

    if (!code) {
        return;
    }

    const buyPriceStr = await vscode.window.showInputBox({
        prompt: 'Please enter buy price (CNY)',
        placeHolder: 'Buy Price',
        validateInput: (value) => {
            const price = parseFloat(value || '');
            if (isNaN(price) || price <= 0) {
                return 'Please enter a valid positive price';
            }
            return null;
        }
    });

    if (!buyPriceStr) {
        return;
    }

    const quantityStr = await vscode.window.showInputBox({
        prompt: 'Please enter quantity (shares)',
        placeHolder: 'Quantity',
        value: '100',
        validateInput: (value) => {
            const quantity = parseInt(value || '');
            if (isNaN(quantity) || quantity <= 0) {
                return 'Please enter a valid positive integer quantity';
            }
            return null;
        }
    });

    if (!quantityStr) {
        return;
    }

    const enabled = await vscode.window.showQuickPick(['Enable', 'Disable'], {
        placeHolder: 'Enable monitoring?'
    }) === 'Enable';

    const stockConfig = {
        code,
        buyPrice: parseFloat(buyPriceStr),
        quantity: parseInt(quantityStr),
        enabled
    };

    configManager.addStock(stockConfig);
    vscode.window.showInformationMessage(`Stock ${code} added`);
}

/**
 * Show stock details
 */
function showStockDetails(code: string, stateManager: StateManager): void {
    const stock = stateManager.getStock(code);
    if (!stock) {
        vscode.window.showWarningMessage(`No data found for stock ${code}`);
        return;
    }

    const summary = stateManager.getSummary();
    const sign = stock.profitAmount >= 0 ? '+' : '';

    const panel = vscode.window.createWebviewPanel(
        `stockDetails_${code}`,
        `${stock.name} (${stock.code}) Details`,
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${stock.name} Details</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                h1 {
                    margin-top: 0;
                    color: var(--vscode-editor-foreground);
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .info-item {
                    padding: 15px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    background-color: var(--vscode-editor-background);
                }
                .info-label {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 5px;
                }
                .info-value {
                    font-size: 18px;
                    font-weight: bold;
                }
                .profit-positive {
                    color: var(--vscode-charts-green);
                }
                .profit-negative {
                    color: var(--vscode-charts-red);
                }
                .summary {
                    padding: 20px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    background-color: var(--vscode-editor-background);
                }
                .last-update {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    text-align: right;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <h1>${stock.name} (${stock.code})</h1>

            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Current Price</div>
                    <div class="info-value">${stock.currentPrice.toFixed(2)}元</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Buy Price</div>
                    <div class="info-value">${stock.buyPrice.toFixed(2)}元</div>
                </div>
                <div class="info-item">
                    <div class="info-label">持仓数量</div>
                    <div class="info-value">${stock.quantity}股</div>
                </div>
                <div class="info-item">
                    <div class="info-label">涨跌额</div>
                    <div class="info-value ${stock.change >= 0 ? 'profit-positive' : 'profit-negative'}">
                        ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}元
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">涨跌幅</div>
                    <div class="info-value ${stock.changePercent >= 0 ? 'profit-positive' : 'profit-negative'}">
                        ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">盈亏金额</div>
                    <div class="info-value ${stock.profitAmount >= 0 ? 'profit-positive' : 'profit-negative'}">
                        ${sign}${stock.profitAmount.toFixed(2)}元
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">盈亏比例</div>
                    <div class="info-value ${stock.profitPercent >= 0 ? 'profit-positive' : 'profit-negative'}">
                        ${sign}${stock.profitPercent.toFixed(2)}%
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">当前市值</div>
                    <div class="info-value">${stock.marketValue.toFixed(2)}元</div>
                </div>
                <div class="info-item">
                    <div class="info-label">持仓成本</div>
                    <div class="info-value">${stock.costBasis.toFixed(2)}元</div>
                </div>
                <div class="info-item">
                    <div class="info-label">监控状态</div>
                    <div class="info-value">${stock.enabled ? '✅ 启用' : '❌ 停用'}</div>
                </div>
            </div>

            ${summary ? `
            <div class="summary">
                <h3>投资汇总</h3>
                <p>总盈亏: ${summary.totalProfit >= 0 ? '+' : ''}${summary.totalProfit.toFixed(2)}元 (${summary.totalProfitPercent >= 0 ? '+' : ''}${summary.totalProfitPercent.toFixed(2)}%)</p>
                <p>总市值: ${summary.totalMarketValue.toFixed(2)}元</p>
                <p>总成本: ${summary.totalCostBasis.toFixed(2)}元</p>
                <p>股票总数: ${summary.stockCount}只</p>
                <p>启用数量: ${summary.enabledCount}只</p>
            </div>
            ` : ''}

            <div class="last-update">
                最后更新时间: ${new Date(stock.lastUpdate).toLocaleString()}
            </div>
        </body>
        </html>`;
}

/**
 * 创建状态栏项
 */
function createStatusBarItem(stateManager: StateManager): vscode.StatusBarItem {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(graph) TRAD';
    statusBarItem.tooltip = 'TRAD股票监控';
    statusBarItem.command = 'trad.openConfig';
    statusBarItem.show();

    // 监听状态变化更新状态栏
    const stateListener = (state: string) => {
        switch (state) {
            case 'running':
                statusBarItem.text = '$(graph) TRAD: 运行中';
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            case 'stopped':
                statusBarItem.text = '$(graph) TRAD: 已停止';
                statusBarItem.backgroundColor = undefined;
                break;
            case 'error':
                statusBarItem.text = '$(graph) TRAD: 错误';
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
            default:
                statusBarItem.text = '$(graph) TRAD';
        }
    };

    stateManager.addStateListener(stateListener);

    // 创建可销毁的状态栏项
    const disposableStatusBarItem = {
        ...statusBarItem,
        dispose: () => {
            stateManager.removeStateListener(stateListener);
            statusBarItem.dispose();
        }
    };

    return disposableStatusBarItem as vscode.StatusBarItem;
}

/**
 * 插件停用时的清理工作
 */
export function deactivate() {
    console.log('TRAD股票监控插件已停用');
}