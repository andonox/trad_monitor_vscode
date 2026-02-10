/**
 * 股票配置接口
 */
export interface StockConfig {
  code: string;           // 股票代码，如 "600000"
  name?: string;          // 股票名称（自动填充）
  buyPrice: number;       // 买入价格
  quantity: number;       // 买入数量
  enabled: boolean;       // 是否启用监控
  exchange?: string;      // 交易所后缀，如 "sh"（自动判断）
}

/**
 * 股票数据接口
 */
export interface StockData {
  code: string;           // 股票代码
  name: string;          // 股票名称
  currentPrice: number;  // 当前价格
  buyPrice: number;      // 买入价格
  quantity: number;      // 买入数量
  profitAmount: number;  // 盈亏金额
  profitPercent: number; // 盈亏百分比
  marketValue: number;   // 市值
  costBasis: number;     // 成本
  change: number;        // 涨跌额
  changePercent: number; // 涨跌幅
  lastUpdate: number;    // 最后更新时间戳
  enabled: boolean;      // 是否启用
}

/**
 * 汇总数据接口
 */
export interface SummaryData {
  totalProfit: number;      // 总盈亏金额
  totalProfitPercent: number; // 总盈亏百分比
  totalMarketValue: number; // 总市值
  totalCostBasis: number;   // 总成本
  stockCount: number;       // 股票数量
  enabledCount: number;     // 启用数量
}

/**
 * 插件配置接口
 */
export interface PluginConfig {
  version: string;        // 配置版本
  stocks: StockConfig[];  // 股票配置列表
  settings: {
    updateInterval: number;    // 更新间隔（秒），默认20
    autoStart: boolean;        // 启动时自动开始监控
    showNotifications: boolean; // 显示桌面通知
    priceAlertThreshold: number; // 价格预警阈值（%）
    dataSourcePriority: 'sina' | 'akshare'; // 数据源优先级
  };
}

/**
 * 监控状态枚举
 */
export enum MonitoringState {
  STOPPED = 'stopped',      // 已停止
  STARTING = 'starting',    // 启动中
  RUNNING = 'running',      // 运行中
  STOPPING = 'stopping',    // 停止中
  ERROR = 'error'           // 错误状态
}

/**
 * Python进程通信命令类型
 */
export type PythonCommandType =
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'update'
  | 'get_config'
  | 'set_config';

/**
 * Python进程通信消息接口
 */
export interface PythonCommand {
  type: 'command';
  command: PythonCommandType;
  id: string;
  timestamp: number;
  payload?: any;
}

/**
 * Python进程响应接口
 */
export interface PythonResponse {
  type: 'response' | 'data' | 'error' | 'status';
  id: string;
  timestamp: number;
  data?: any;
  error?: string;
  status?: string;
}