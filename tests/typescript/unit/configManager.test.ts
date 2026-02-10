import { ConfigManager } from '../../../src/configManager';
import { PluginConfig, StockConfig } from '../../../src/types/stock';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { mockPluginConfig, mockStockConfig } from '../setup';

// Mock VSCode API和文件系统
jest.mock('vscode');
jest.mock('fs');
jest.mock('path');

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockContext: vscode.ExtensionContext;
  let mockFs: jest.Mocked<typeof fs>;
  let mockPath: jest.Mocked<typeof path>;

  beforeEach(() => {
    mockFs = fs as jest.Mocked<typeof fs>;
    mockPath = path as jest.Mocked<typeof path>;

    mockContext = {
      globalStorageUri: {
        fsPath: '/tmp/test-storage',
      },
    } as any;

    // 设置mock返回值
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockPluginConfig));
    mockFs.writeFileSync.mockImplementation(() => undefined);

    configManager = new ConfigManager(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    it('应该创建配置目录', () => {
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/tmp/test-storage/../trad', { recursive: true });
    });

    it('应该加载配置文件', () => {
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/tmp/test-storage/../trad/config.json', 'utf8');
    });

    it('如果配置文件不存在应该使用默认配置', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readFileSync.mockImplementation(() => { throw new Error('File not found'); });

      const newConfigManager = new ConfigManager(mockContext);
      const config = newConfigManager.getConfig();

      expect(config.version).toBe('1.0.0');
      expect(config.stocks).toHaveLength(0);
      expect(config.settings.updateInterval).toBe(20);
    });
  });

  describe('getConfig()', () => {
    it('应该返回配置的深拷贝', () => {
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // 确保是深拷贝
    });
  });

  describe('updateConfig()', () => {
    it('应该更新配置并保存', () => {
      const newSettings = {
        updateInterval: 30,
        autoStart: true,
        showNotifications: false,
        priceAlertThreshold: 3.0,
        dataSourcePriority: 'akshare' as const,
      };

      configManager.updateConfig({
        settings: newSettings,
      });

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.settings.updateInterval).toBe(30);
      expect(updatedConfig.settings.dataSourcePriority).toBe('akshare');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('应该合并部分更新', () => {
      configManager.updateConfig({
        version: '1.1.0',
      });

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.version).toBe('1.1.0');
      expect(updatedConfig.settings.updateInterval).toBe(20); // 保持原值
    });
  });

  describe('addStock()', () => {
    it('应该添加新的股票配置', () => {
      const newStock: StockConfig = {
        code: '000002',
        name: '万科A',
        buyPrice: 18.5,
        quantity: 150,
        enabled: true,
        exchange: 'sz',
      };

      configManager.addStock(newStock);

      const config = configManager.getConfig();
      expect(config.stocks).toHaveLength(3); // 原有2个 + 新增1个
      expect(config.stocks[2].code).toBe('000002');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('如果股票已存在应该更新而不是添加', () => {
      const existingStock = { ...mockStockConfig };
      configManager.addStock(existingStock);

      const config = configManager.getConfig();
      expect(config.stocks).toHaveLength(2); // 数量不变
    });
  });

  describe('removeStock()', () => {
    it('应该移除指定的股票配置', () => {
      configManager.removeStock('600000');

      const config = configManager.getConfig();
      expect(config.stocks).toHaveLength(1);
      expect(config.stocks[0].code).toBe('000001');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('如果股票不存在应该不执行任何操作', () => {
      configManager.removeStock('999999');

      const config = configManager.getConfig();
      expect(config.stocks).toHaveLength(2); // 数量不变
    });
  });

  describe('updateStock()', () => {
    it('应该更新现有的股票配置', () => {
      const updatedStock = {
        code: '600000',
        name: '浦发银行(更新)',
        buyPrice: 11.0,
        quantity: 150,
        enabled: false,
        exchange: 'sh',
      };

      configManager.updateStock('600000', updatedStock);

      const config = configManager.getConfig();
      const stock = config.stocks.find(s => s.code === '600000');
      expect(stock?.name).toBe('浦发银行(更新)');
      expect(stock?.buyPrice).toBe(11.0);
      expect(stock?.quantity).toBe(150);
      expect(stock?.enabled).toBe(false);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('如果股票不存在应该抛出错误', () => {
      const updatedStock = {
        code: '999999',
        name: '不存在的股票',
        buyPrice: 10.0,
        quantity: 100,
        enabled: true,
        exchange: 'sh',
      };

      expect(() => {
        configManager.updateStock('999999', updatedStock);
      }).toThrow('Stock not found: 999999');
    });
  });

  describe('getStock()', () => {
    it('应该返回指定的股票配置', () => {
      const stock = configManager.getStock('600000');
      expect(stock?.code).toBe('600000');
      expect(stock?.name).toBe('浦发银行');
    });

    it('如果股票不存在应该返回undefined', () => {
      const stock = configManager.getStock('999999');
      expect(stock).toBeUndefined();
    });
  });

  describe('validateStockConfig()', () => {
    it('应该验证有效的股票配置', () => {
      const validStock: StockConfig = {
        code: '000002',
        name: '万科A',
        buyPrice: 18.5,
        quantity: 150,
        enabled: true,
        exchange: 'sz',
      };

      expect(() => {
        configManager['validateStockConfig'](validStock);
      }).not.toThrow();
    });

    it('应该拒绝无效的股票代码', () => {
      const invalidStock: StockConfig = {
        code: 'invalid',
        name: '无效股票',
        buyPrice: 10.0,
        quantity: 100,
        enabled: true,
        exchange: 'sh',
      };

      expect(() => {
        configManager['validateStockConfig'](invalidStock);
      }).toThrow('Invalid stock code');
    });

    it('应该拒绝负数的买入价格', () => {
      const invalidStock: StockConfig = {
        code: '000002',
        name: '万科A',
        buyPrice: -10.0,
        quantity: 100,
        enabled: true,
        exchange: 'sz',
      };

      expect(() => {
        configManager['validateStockConfig'](invalidStock);
      }).toThrow('Buy price must be positive');
    });

    it('应该拒绝零或负数的数量', () => {
      const invalidStock: StockConfig = {
        code: '000002',
        name: '万科A',
        buyPrice: 18.5,
        quantity: 0,
        enabled: true,
        exchange: 'sz',
      };

      expect(() => {
        configManager['validateStockConfig'](invalidStock);
      }).toThrow('Quantity must be positive');
    });
  });

  describe('文件操作错误处理', () => {
    it('应该处理文件读取错误', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      expect(() => {
        new ConfigManager(mockContext);
      }).not.toThrow();
    });

    it('应该处理文件写入错误', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      expect(() => {
        configManager.updateConfig({ version: '1.1.0' });
      }).not.toThrow();
    });
  });
});