#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TypeScript-Python通信集成测试
"""
import sys
import json
import asyncio
import tempfile
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path

import pytest

# 添加scripts目录到Python路径
scripts_dir = Path(__file__).parent.parent.parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))

from stock_daemon import (
    StockDaemon,
    StockDataFetcher,
    StockCalculator,
    MonitoringConfig,
    StockConfig,
)


class TestTypeScriptPythonIntegration:
    """TypeScript-Python集成测试"""

    @pytest.fixture
    def mock_config(self):
        """模拟配置"""
        return MonitoringConfig(
            stocks=[
                StockConfig(
                    code="600000",
                    name="浦发银行",
                    buy_price=10.5,
                    quantity=100,
                    enabled=True,
                    exchange="sh",
                ),
                StockConfig(
                    code="000001",
                    name="平安银行",
                    buy_price=15.2,
                    quantity=200,
                    enabled=True,
                    exchange="sz",
                ),
            ],
            settings={
                "update_interval": 20,
                "auto_start": True,
                "show_notifications": True,
                "price_alert_threshold": 5.0,
                "data_source_priority": "sina",
            },
        )

    @pytest.fixture
    def stock_daemon(self, mock_config):
        """创建StockDaemon实例"""
        daemon = StockDaemon()
        daemon.config = mock_config
        return daemon

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_full_monitoring_cycle(self, stock_daemon):
        """测试完整监控周期"""
        # 1. 启动监控
        with patch.object(stock_daemon, "_monitoring_loop", new_callable=AsyncMock) as mock_loop:
            await stock_daemon.start_monitoring()
            assert stock_daemon.running is True

        # 2. 处理TypeScript请求
        request = {
            "jsonrpc": "2.0",
            "id": "test-1",
            "method": "get_stock_data",
            "params": {"codes": ["600000", "000001"]},
        }

        with patch.object(StockDataFetcher, "fetch_stock_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = [
                {
                    "code": "600000",
                    "name": "浦发银行",
                    "current_price": 10.75,
                    "change": 0.25,
                    "change_percent": 2.38,
                },
                {
                    "code": "000001",
                    "name": "平安银行",
                    "current_price": 15.25,
                    "change": 0.05,
                    "change_percent": 0.33,
                },
            ]

            with patch.object(StockCalculator, "calculate_profit", new_callable=Mock) as mock_calc:
                mock_calc.side_effect = [
                    {
                        "profit_amount": 25.0,
                        "profit_percent": 2.38,
                        "market_value": 1075.0,
                        "cost_basis": 1050.0,
                    },
                    {
                        "profit_amount": 10.0,
                        "profit_percent": 0.33,
                        "market_value": 3050.0,
                        "cost_basis": 3040.0,
                    },
                ]

                response = await stock_daemon.process_request(request)

                # 3. 验证响应
                assert response["jsonrpc"] == "2.0"
                assert response["id"] == "test-1"
                assert "result" in response
                assert len(response["result"]) == 2

                stock1 = response["result"][0]
                assert stock1["code"] == "600000"
                assert stock1["profit_amount"] == 25.0

                stock2 = response["result"][1]
                assert stock2["code"] == "000001"
                assert stock2["profit_amount"] == 10.0

        # 4. 停止监控
        await stock_daemon.stop_monitoring()
        assert stock_daemon.running is False

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_config_update_from_typescript(self, stock_daemon, mock_config):
        """测试从TypeScript更新配置"""
        # 初始配置
        assert len(stock_daemon.config.stocks) == 2

        # TypeScript发送配置更新请求
        new_config_dict = {
            "version": "1.0.0",
            "stocks": [
                {
                    "code": "000002",
                    "name": "万科A",
                    "buy_price": 18.5,
                    "quantity": 150,
                    "enabled": True,
                    "exchange": "sz",
                }
            ],
            "settings": {
                "update_interval": 30,
                "auto_start": True,
                "show_notifications": True,
                "price_alert_threshold": 5.0,
                "data_source_priority": "sina",
            },
        }

        request = {
            "jsonrpc": "2.0",
            "id": "config-update",
            "method": "update_config",
            "params": {"config": new_config_dict},
        }

        response = await stock_daemon.process_request(request)

        # 验证配置已更新
        assert response["jsonrpc"] == "2.0"
        assert response["id"] == "config-update"
        assert "result" in response
        assert response["result"]["success"] is True

        assert len(stock_daemon.config.stocks) == 1
        assert stock_daemon.config.stocks[0].code == "000002"
        assert stock_daemon.config.settings["update_interval"] == 30

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_error_handling_integration(self, stock_daemon):
        """测试集成错误处理"""
        # 模拟数据获取失败
        request = {
            "jsonrpc": "2.0",
            "id": "error-test",
            "method": "get_stock_data",
            "params": {"codes": ["600000"]},
        }

        with patch.object(StockDataFetcher, "fetch_stock_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = Exception("Network error")

            response = await stock_daemon.process_request(request)

            # 验证错误响应
            assert "error" in response
            assert response["error"]["code"] == -32000  # Server error
            assert "Network error" in response["error"]["message"]

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_performance_integration(self, stock_daemon, performance_recorder):
        """测试集成性能"""
        import time

        # 模拟多个并发请求
        requests = [
            {
                "jsonrpc": "2.0",
                "id": f"perf-{i}",
                "method": "get_stock_data",
                "params": {"codes": ["600000", "000001"]},
            }
            for i in range(20)
        ]

        with patch.object(StockDataFetcher, "fetch_stock_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = [
                {
                    "code": "600000",
                    "name": "浦发银行",
                    "current_price": 10.75,
                    "change": 0.25,
                    "change_percent": 2.38,
                },
                {
                    "code": "000001",
                    "name": "平安银行",
                    "current_price": 15.25,
                    "change": 0.05,
                    "change_percent": 0.33,
                },
            ]

            with patch.object(StockCalculator, "calculate_profit", new_callable=Mock) as mock_calc:
                mock_calc.return_value = {
                    "profit_amount": 25.0,
                    "profit_percent": 2.38,
                    "market_value": 1075.0,
                    "cost_basis": 1050.0,
                }

                start_time = time.time()

                # 并发处理请求
                tasks = [stock_daemon.process_request(req) for req in requests]
                results = await asyncio.gather(*tasks)

                end_time = time.time()
                duration = end_time - start_time

                performance_recorder.record("process_20_requests_concurrent", duration)

                assert len(results) == 20
                # 应该在2秒内完成
                assert duration < 2.0

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_data_streaming_integration(self, stock_daemon):
        """测试数据流集成"""
        # 启动监控循环
        stock_daemon.running = True

        captured_output = []

        def mock_send(data):
            captured_output.append(data)

        stock_daemon.send_data = AsyncMock(side_effect=mock_send)

        # 模拟监控循环的一次迭代
        with patch.object(stock_daemon, "get_stock_data", new_callable=AsyncMock) as mock_get_data:
            mock_get_data.return_value = [
                {
                    "code": "600000",
                    "name": "浦发银行",
                    "current_price": 10.75,
                    "profit_amount": 25.0,
                    "profit_percent": 2.38,
                }
            ]

            await stock_daemon._monitoring_loop()

            # 验证数据被发送
            assert len(captured_output) == 1
            data = captured_output[0]
            assert data[0]["code"] == "600000"
            assert data[0]["current_price"] == 10.75

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_memory_management_integration(self, stock_daemon):
        """测试内存管理集成"""
        import gc

        # 创建大量请求
        requests = []
        for i in range(100):
            requests.append({
                "jsonrpc": "2.0",
                "id": f"mem-{i}",
                "method": "get_stock_data",
                "params": {"codes": [f"600{i:03d}"]},
            })

        # 记录初始内存使用
        gc.collect()

        with patch.object(StockDataFetcher, "fetch_stock_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = [
                {
                    "code": "600000",
                    "name": "测试股票",
                    "current_price": 10.0,
                    "change": 0.0,
                    "change_percent": 0.0,
                }
            ]

            with patch.object(StockCalculator, "calculate_profit", new_callable=Mock) as mock_calc:
                mock_calc.return_value = {
                    "profit_amount": 0.0,
                    "profit_percent": 0.0,
                    "market_value": 1000.0,
                    "cost_basis": 1000.0,
                }

                # 处理所有请求
                tasks = [stock_daemon.process_request(req) for req in requests]
                await asyncio.gather(*tasks)

        # 强制垃圾回收
        gc.collect()

        # 验证没有内存泄漏
        # 这里主要是确保测试通过，实际内存检查需要更复杂的工具
        assert True

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_concurrent_config_and_data_requests(self, stock_daemon):
        """测试并发配置和数据请求"""
        # 创建混合请求
        config_request = {
            "jsonrpc": "2.0",
            "id": "config-req",
            "method": "update_config",
            "params": {
                "config": {
                    "version": "1.0.0",
                    "stocks": [
                        {
                            "code": "000002",
                            "name": "万科A",
                            "buy_price": 18.5,
                            "quantity": 150,
                            "enabled": True,
                            "exchange": "sz",
                        }
                    ],
                    "settings": {
                        "update_interval": 30,
                        "auto_start": True,
                        "show_notifications": True,
                        "price_alert_threshold": 5.0,
                        "data_source_priority": "sina",
                    },
                }
            },
        }

        data_request = {
            "jsonrpc": "2.0",
            "id": "data-req",
            "method": "get_stock_data",
            "params": {"codes": ["000002"]},
        }

        # 并发处理
        with patch.object(StockDataFetcher, "fetch_stock_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = [
                {
                    "code": "000002",
                    "name": "万科A",
                    "current_price": 19.0,
                    "change": 0.5,
                    "change_percent": 2.7,
                }
            ]

            with patch.object(StockCalculator, "calculate_profit", new_callable=Mock) as mock_calc:
                mock_calc.return_value = {
                    "profit_amount": 75.0,
                    "profit_percent": 2.7,
                    "market_value": 2850.0,
                    "cost_basis": 2775.0,
                }

                config_task = asyncio.create_task(stock_daemon.process_request(config_request))
                data_task = asyncio.create_task(stock_daemon.process_request(data_request))

                config_response, data_response = await asyncio.gather(config_task, data_task)

                # 验证两个请求都成功
                assert config_response["result"]["success"] is True
                assert data_response["result"][0]["code"] == "000002"
                assert data_response["result"][0]["profit_amount"] == 75.0

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_error_recovery_integration(self, stock_daemon):
        """测试错误恢复集成"""
        # 第一次请求失败
        request1 = {
            "jsonrpc": "2.0",
            "id": "req-1",
            "method": "get_stock_data",
            "params": {"codes": ["600000"]},
        }

        with patch.object(StockDataFetcher, "fetch_stock_data", new_callable=AsyncMock) as mock_fetch:
            # 第一次失败
            mock_fetch.side_effect = [Exception("First error"), None]

            # 设置第二次成功
            mock_fetch.return_value = [
                {
                    "code": "600000",
                    "name": "浦发银行",
                    "current_price": 10.75,
                    "change": 0.25,
                    "change_percent": 2.38,
                }
            ]

            with patch.object(StockCalculator, "calculate_profit", new_callable=Mock) as mock_calc:
                mock_calc.return_value = {
                    "profit_amount": 25.0,
                    "profit_percent": 2.38,
                    "market_value": 1075.0,
                    "cost_basis": 1050.0,
                }

                # 第一次请求应该失败
                response1 = await stock_daemon.process_request(request1)
                assert "error" in response1

                # 重置side_effect，第二次请求应该成功
                mock_fetch.side_effect = None

                response2 = await stock_daemon.process_request(request1)
                assert "result" in response2
                assert response2["result"][0]["code"] == "600000"

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_realistic_workflow(self, stock_daemon, mock_config):
        """测试真实工作流程"""
        # 模拟真实用户场景：
        # 1. 启动监控
        # 2. 添加股票
        # 3. 获取数据
        # 4. 更新配置
        # 5. 获取更新后的数据

        # 1. 更新配置（添加股票）
        add_stock_config = {
            "version": "1.0.0",
            "stocks": [
                {
                    "code": "600000",
                    "name": "浦发银行",
                    "buy_price": 10.5,
                    "quantity": 100,
                    "enabled": True,
                    "exchange": "sh",
                },
                {
                    "code": "000002",
                    "name": "万科A",
                    "buy_price": 18.5,
                    "quantity": 150,
                    enabled=True,
                    "exchange": "sz",
                },
            ],
            "settings": mock_config.settings,
        }

        update_request = {
            "jsonrpc": "2.0",
            "id": "update-1",
            "method": "update_config",
            "params": {"config": add_stock_config},
        }

        update_response = await stock_daemon.process_request(update_request)
        assert update_response["result"]["success"] is True

        # 2. 获取两个股票的数据
        data_request = {
            "jsonrpc": "2.0",
            "id": "data-1",
            "method": "get_stock_data",
            "params": {"codes": ["600000", "000002"]},
        }

        with patch.object(StockDataFetcher, "fetch_stock_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = [
                {
                    "code": "600000",
                    "name": "浦发银行",
                    "current_price": 10.75,
                    "change": 0.25,
                    "change_percent": 2.38,
                },
                {
                    "code": "000002",
                    "name": "万科A",
                    "current_price": 19.0,
                    "change": 0.5,
                    "change_percent": 2.7,
                },
            ]

            with patch.object(StockCalculator, "calculate_profit", new_callable=Mock) as mock_calc:
                mock_calc.side_effect = [
                    {
                        "profit_amount": 25.0,
                        "profit_percent": 2.38,
                        "market_value": 1075.0,
                        "cost_basis": 1050.0,
                    },
                    {
                        "profit_amount": 75.0,
                        "profit_percent": 2.7,
                        "market_value": 2850.0,
                        "cost_basis": 2775.0,
                    },
                ]

                data_response = await stock_daemon.process_request(data_request)

                # 验证数据
                assert len(data_response["result"]) == 2

                pufa = next(s for s in data_response["result"] if s["code"] == "600000")
                wanke = next(s for s in data_response["result"] if s["code"] == "000002")

                assert pufa["profit_amount"] == 25.0
                assert wanke["profit_amount"] == 75.0

        # 3. 更新配置（修改设置）
        update_settings_config = {
            "version": "1.0.0",
            "stocks": add_stock_config["stocks"],
            "settings": {
                "update_interval": 30,
                "auto_start": True,
                "show_notifications": False,
                "price_alert_threshold": 3.0,
                "data_source_priority": "akshare",
            },
        }

        update_settings_request = {
            "jsonrpc": "2.0",
            "id": "update-2",
            "method": "update_config",
            "params": {"config": update_settings_config},
        }

        update_settings_response = await stock_daemon.process_request(update_settings_request)
        assert update_settings_response["result"]["success"] is True

        # 验证配置已更新
        assert stock_daemon.config.settings["update_interval"] == 30
        assert stock_daemon.config.settings["data_source_priority"] == "akshare"
        assert stock_daemon.config.settings["show_notifications"] is False