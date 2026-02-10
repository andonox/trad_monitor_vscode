#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TRAD股票监控 - Python守护进程
支持JSON-RPC over stdio通信协议
"""

import sys
import json
import time
import asyncio
import threading
import traceback
from typing import Dict, List, Any, Optional, Tuple
import argparse

# Try to import requests
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print(json.dumps({
        "type": "error",
        "id": "system",
        "timestamp": int(time.time() * 1000),
        "error": "requests library not installed. To use Sina Finance API data source, install: pip install requests"
    }), file=sys.stderr, flush=True)

# Try to import akshare (optional)
try:
    import akshare as ak
    HAS_AKSHARE = True
except ImportError:
    HAS_AKSHARE = False
    print(json.dumps({
        "type": "error",
        "id": "system",
        "timestamp": int(time.time() * 1000),
        "error": "akshare library not installed. To use akshare data source, install: pip install akshare pandas"
    }), file=sys.stderr, flush=True)

# Try to import pandas (optional)
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print(json.dumps({
        "type": "error",
        "id": "system",
        "timestamp": int(time.time() * 1000),
        "error": "pandas library not installed. To use akshare data source, install: pip install pandas"
    }), file=sys.stderr, flush=True)


class StockDataFetcher:
    """股票数据获取器"""

    @staticmethod
    def get_stock_suffix(code: str) -> str:
        """获取股票交易所后缀"""
        if code.startswith(('6', '9')):
            return 'sh'
        elif code.startswith(('0', '2', '3')):
            return 'sz'
        else:
            return 'sh'

    @staticmethod
    def get_real_time_price_sina(stock_code: str) -> Tuple[Optional[float], Optional[str]]:
        """通过新浪财经API获取实时股价"""
        if not HAS_REQUESTS:
            return None, None

        try:
            suffix = StockDataFetcher.get_stock_suffix(stock_code)
            url = f"http://hq.sinajs.cn/list={suffix}{stock_code}"

            headers = {
                'Referer': 'http://finance.sina.com.cn',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }

            response = requests.get(url, headers=headers, timeout=10)
            response.encoding = 'gbk'

            if response.status_code != 200:
                return None, None

            content = response.text
            if '="' not in content:
                return None, None

            data_str = content.split('="')[1].rstrip('";')
            data_parts = data_str.split(',')

            if len(data_parts) < 2:
                return None, None

            stock_name = data_parts[0]
            try:
                current_price = float(data_parts[3])  # Current price is the 4th value (index 3)
            except (ValueError, IndexError):
                try:
                    current_price = float(data_parts[1])
                except (ValueError, IndexError):
                    return None, None

            return current_price, stock_name

        except Exception as e:
            print(json.dumps({
                "type": "error",
                "id": "system",
                "timestamp": int(time.time() * 1000),
                "error": f"Sina Finance API failed: {str(e)}"
            }), file=sys.stderr, flush=True)
            return None, None

    @staticmethod
    def get_real_time_price_akshare(stock_code: str) -> Tuple[Optional[float], Optional[str]]:
        """通过akshare获取实时股价"""
        if not HAS_AKSHARE or not HAS_PANDAS:
            return None, None

        try:
            # Get all A-share real-time data
            stock_zh_a_spot_df = ak.stock_zh_a_spot()

            # Build code with suffix for matching
            suffix = StockDataFetcher.get_stock_suffix(stock_code)
            full_code = f"{stock_code}.{suffix}"

            # Find matching stock
            matched = stock_zh_a_spot_df[stock_zh_a_spot_df['代码'] == full_code]

            if not matched.empty:
                current_price = matched.iloc[0]['最新价']
                stock_name = matched.iloc[0]['名称']
                return current_price, stock_name
            else:
                # Try matching without suffix
                matched = stock_zh_a_spot_df[stock_zh_a_spot_df['代码'].str.startswith(stock_code)]
                if not matched.empty:
                    current_price = matched.iloc[0]['最新价']
                    stock_name = matched.iloc[0]['名称']
                    return current_price, stock_name
                else:
                    return None, None

        except Exception as e:
            print(json.dumps({
                "type": "error",
                "id": "system",
                "timestamp": int(time.time() * 1000),
                "error": f"akshare failed: {str(e)}"
            }), file=sys.stderr, flush=True)
            return None, None

    @staticmethod
    def get_real_time_price(stock_code: str, data_source_priority: str = 'sina') -> Tuple[Optional[float], Optional[str]]:
        """获取实时股价（自动选择数据源）"""
        if data_source_priority == 'akshare' and HAS_AKSHARE:
            price, name = StockDataFetcher.get_real_time_price_akshare(stock_code)
            if price is not None:
                return price, name

        if HAS_REQUESTS:
            price, name = StockDataFetcher.get_real_time_price_sina(stock_code)
            if price is not None:
                return price, name

        # 如果首选数据源失败，尝试另一个
        if data_source_priority == 'sina' and HAS_AKSHARE:
            price, name = StockDataFetcher.get_real_time_price_akshare(stock_code)
            if price is not None:
                return price, name

        return None, None


class StockCalculator:
    """股票计算器"""

    @staticmethod
    def calculate_stock_data(stock_config: Dict[str, Any],
                            current_price: float,
                            stock_name: str) -> Dict[str, Any]:
        """计算股票数据"""
        buy_price = stock_config.get('buyPrice', current_price)
        quantity = stock_config.get('quantity', 100)
        enabled = stock_config.get('enabled', True)

        # 计算盈亏
        profit_amount = (current_price - buy_price) * quantity
        profit_percent = (current_price / buy_price - 1) * 100 if buy_price != 0 else 0

        # 计算涨跌（相对于前一日收盘价？这里使用买入价作为参考）
        change = current_price - buy_price
        change_percent = profit_percent

        # 计算市值和成本
        market_value = current_price * quantity
        cost_basis = buy_price * quantity

        return {
            "code": stock_config['code'],
            "name": stock_name,
            "currentPrice": round(current_price, 4),
            "buyPrice": round(buy_price, 4),
            "quantity": quantity,
            "profitAmount": round(profit_amount, 2),
            "profitPercent": round(profit_percent, 2),
            "marketValue": round(market_value, 2),
            "costBasis": round(cost_basis, 2),
            "change": round(change, 4),
            "changePercent": round(change_percent, 2),
            "lastUpdate": int(time.time() * 1000),
            "enabled": enabled
        }

    @staticmethod
    def calculate_summary(stock_data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """计算汇总数据"""
        enabled_stocks = [s for s in stock_data_list if s.get('enabled', True)]

        total_profit = sum(s.get('profitAmount', 0) for s in enabled_stocks)
        total_market_value = sum(s.get('marketValue', 0) for s in enabled_stocks)
        total_cost_basis = sum(s.get('costBasis', 0) for s in enabled_stocks)

        total_profit_percent = (total_profit / total_cost_basis * 100) if total_cost_basis > 0 else 0

        return {
            "totalProfit": round(total_profit, 2),
            "totalProfitPercent": round(total_profit_percent, 2),
            "totalMarketValue": round(total_market_value, 2),
            "totalCostBasis": round(total_cost_basis, 2),
            "stockCount": len(stock_data_list),
            "enabledCount": len(enabled_stocks)
        }


class StockDaemon:
    """股票监控守护进程"""

    def __init__(self):
        self.config = {
            "version": "1.0.0",
            "stocks": [],
            "settings": {
                "updateInterval": 20,
                "autoStart": False,
                "showNotifications": True,
                "priceAlertThreshold": 5.0,
                "dataSourcePriority": "sina"
            }
        }
        self.is_running = False
        self.update_task = None
        self.event_loop = None
        self.fetcher = StockDataFetcher()
        self.calculator = StockCalculator()

        # 检查数据源可用性
        if not HAS_AKSHARE and not HAS_REQUESTS:
            self.send_error("system", "No data source available. Please install: pip install akshare pandas OR pip install requests")

    def send_response(self, response_type: str, request_id: str, data: Any = None, error: str = None, status: str = None):
        """发送响应"""
        response = {
            "type": response_type,
            "id": request_id,
            "timestamp": int(time.time() * 1000)
        }

        if data is not None:
            response["data"] = data
        if error is not None:
            response["error"] = error
        if status is not None:
            response["status"] = status

        print(json.dumps(response, ensure_ascii=False), flush=True)

    def send_error(self, request_id: str, error_message: str):
        """发送错误响应"""
        self.send_response("error", request_id, error=error_message)

    def handle_command(self, command: Dict[str, Any]):
        """处理命令"""
        try:
            cmd_type = command.get("type")
            cmd = command.get("command")
            request_id = command.get("id", "unknown")

            if cmd_type != "command":
                self.send_error(request_id, f"Invalid command type: {cmd_type}")
                return

            handler_name = f"handle_{cmd}"
            if hasattr(self, handler_name):
                handler = getattr(self, handler_name)
                handler(request_id, command.get("payload"))
            else:
                self.send_error(request_id, f"Unknown command: {cmd}")

        except Exception as e:
            error_msg = f"Command handler error: {str(e)}\n{traceback.format_exc()}"
            self.send_error(command.get("id", "unknown"), error_msg)

    def handle_start(self, request_id: str, payload: Any = None):
        """处理start命令"""
        if self.is_running:
            self.send_response("status", request_id, status="already_running")
            return

        self.is_running = True
        self.send_response("response", request_id, data={"status": "started"})

        # 启动更新循环
        if self.event_loop is None:
            self.event_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.event_loop)

        self.update_task = asyncio.ensure_future(self.update_loop(), loop=self.event_loop)

    def handle_stop(self, request_id: str, payload: Any = None):
        """处理stop命令"""
        if not self.is_running:
            self.send_response("status", request_id, status="already_stopped")
            return

        self.is_running = False

        # 取消更新任务
        if self.update_task and not self.update_task.done():
            self.update_task.cancel()

        self.send_response("response", request_id, data={"status": "stopped"})

    def handle_pause(self, request_id: str, payload: Any = None):
        """处理pause命令"""
        self.is_running = False
        self.send_response("response", request_id, data={"status": "paused"})

    def handle_resume(self, request_id: str, payload: Any = None):
        """处理resume命令"""
        self.is_running = True
        self.send_response("response", request_id, data={"status": "resumed"})

    def handle_update(self, request_id: str, payload: Any = None):
        """处理update命令"""
        try:
            stock_data = self.fetch_stock_data()
            self.send_response("data", request_id, data=stock_data)
        except Exception as e:
            self.send_error(request_id, f"Update failed: {str(e)}")

    def handle_get_config(self, request_id: str, payload: Any = None):
        """处理get_config命令"""
        self.send_response("response", request_id, data=self.config)

    def handle_set_config(self, request_id: str, payload: Any = None):
        """处理set_config命令"""
        if not payload:
            self.send_error(request_id, "No configuration provided")
            return

        try:
            # 验证和更新配置
            self.update_config(payload)
            self.send_response("response", request_id, data={"status": "config_updated"})
        except Exception as e:
            self.send_error(request_id, f"Config update failed: {str(e)}")

    def update_config(self, new_config: Dict[str, Any]):
        """更新配置"""
        # 合并配置
        if "version" in new_config:
            self.config["version"] = new_config["version"]

        if "stocks" in new_config:
            # 验证股票配置
            valid_stocks = []
            for stock in new_config["stocks"]:
                if isinstance(stock, dict) and "code" in stock:
                    valid_stocks.append({
                        "code": stock["code"],
                        "name": stock.get("name"),
                        "buyPrice": float(stock.get("buyPrice", 0)),
                        "quantity": int(stock.get("quantity", 100)),
                        "enabled": bool(stock.get("enabled", True)),
                        "exchange": stock.get("exchange")
                    })
            self.config["stocks"] = valid_stocks

        if "settings" in new_config:
            self.config["settings"].update(new_config["settings"])

    async def update_loop(self):
        """更新循环"""
        while self.is_running:
            try:
                stock_data = self.fetch_stock_data()
                self.send_response("data", "auto_update", data=stock_data)

                # 等待更新间隔
                interval = self.config["settings"]["updateInterval"]
                await asyncio.sleep(interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                error_msg = f"Update loop error: {str(e)}"
                print(json.dumps({
                    "type": "error",
                    "id": "update_loop",
                    "timestamp": int(time.time() * 1000),
                    "error": error_msg
                }), file=sys.stderr, flush=True)

                # 出错后等待一段时间再重试
                await asyncio.sleep(5)

    def fetch_stock_data(self) -> List[Dict[str, Any]]:
        """获取股票数据"""
        stock_data_list = []
        data_source = self.config["settings"]["dataSourcePriority"]

        for stock_config in self.config["stocks"]:
            if not stock_config.get("enabled", True):
                continue

            code = stock_config["code"]
            current_price, stock_name = self.fetcher.get_real_time_price(code, data_source)

            if current_price is None:
                # 如果获取失败，跳过这只股票
                continue

            stock_data = self.calculator.calculate_stock_data(stock_config, current_price, stock_name)
            stock_data_list.append(stock_data)

        return stock_data_list

    def run(self):
        """运行守护进程"""
        print(json.dumps({
            "type": "status",
            "id": "system",
            "timestamp": int(time.time() * 1000),
            "status": "daemon_started",
            "data": {
                "has_akshare": HAS_AKSHARE,
                "has_requests": HAS_REQUESTS,
                "has_pandas": HAS_PANDAS
            }
        }), flush=True)

        # 读取标准输入
        buffer = ""
        while True:
            try:
                line = sys.stdin.readline()
                if not line:  # EOF
                    break

                buffer += line
                if buffer.endswith('\n'):
                    lines = buffer.strip().split('\n')
                    for line_content in lines:
                        if line_content.strip():
                            try:
                                command = json.loads(line_content)
                                self.handle_command(command)
                            except json.JSONDecodeError as e:
                                self.send_error("parse_error", f"Invalid JSON: {str(e)}")
                    buffer = ""

            except KeyboardInterrupt:
                break
            except Exception as e:
                error_msg = f"Main loop error: {str(e)}\n{traceback.format_exc()}"
                print(json.dumps({
                    "type": "error",
                    "id": "main_loop",
                    "timestamp": int(time.time() * 1000),
                    "error": error_msg
                }), file=sys.stderr, flush=True)

        # 清理
        if self.is_running:
            self.is_running = False
            if self.update_task and not self.update_task.done():
                self.update_task.cancel()

        print(json.dumps({
            "type": "status",
            "id": "system",
            "timestamp": int(time.time() * 1000),
            "status": "daemon_stopped"
        }), flush=True)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='TRAD股票监控守护进程')
    parser.add_argument('--test', action='store_true', help='测试模式')
    args = parser.parse_args()

    if args.test:
        # 测试模式：运行一次更新并退出
        daemon = StockDaemon()
        daemon.config["stocks"] = [
            {"code": "600000", "buyPrice": 10.5, "quantity": 100, "enabled": True},
            {"code": "000001", "buyPrice": 15.2, "quantity": 200, "enabled": True}
        ]

        print("测试模式：获取股票数据...")
        stock_data = daemon.fetch_stock_data()
        print(json.dumps(stock_data, indent=2, ensure_ascii=False))

        if stock_data:
            summary = daemon.calculator.calculate_summary(stock_data)
            print("\n汇总数据：")
            print(json.dumps(summary, indent=2, ensure_ascii=False))
        return

    # 正常守护进程模式
    daemon = StockDaemon()
    daemon.run()


if __name__ == "__main__":
    main()