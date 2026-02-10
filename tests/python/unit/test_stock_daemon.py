#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StockDaemon单元测试
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


class TestStockDaemon:
    """StockDaemon单元测试"""

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

    @pytest.mark.asyncio
    async def test_initialization(self, stock_daemon):
        """测试初始化"""
        assert stock_daemon.config is not None
        assert stock_daemon.running is False
        assert stock_daemon.task is None

    @pytest.mark.asyncio
    async def test_start_monitoring(self, stock_daemon):
        """测试开始监控"""
        with patch.object(stock_daemon, "_monitoring_loop", new_callable=AsyncMock) as mock_loop:
            await stock_daemon.start_monitoring()

            assert stock_daemon.running is True
            assert stock_daemon.task is not None
            mock_loop.assert_called_once()

    @pytest.mark.asyncio
    async def test_stop_monitoring(self, stock_daemon):
        """测试停止监控"""
        # 先启动监控
        stock_daemon.running = True
        stock_daemon.task = asyncio.create_task(asyncio.sleep(0.1))

        await stock_daemon.stop_monitoring()

        assert stock_daemon.running is False
        assert stock_daemon.task is None

    @pytest.mark.asyncio
    async def test_update_config(self, stock_daemon, mock_config):
        """测试更新配置"""
        new_config = MonitoringConfig(
            stocks=[
                StockConfig(
                    code="000002",
                    name="万科A",
                    buy_price=18.5,
                    quantity=150,
                    enabled=True,
                    exchange="sz",
                )
            ],
            settings=mock_config.settings,
        )

        stock_daemon.update_config(new_config)

        assert stock_daemon.config == new_config
        assert len(stock_daemon.config.stocks) == 1
        assert stock_daemon.config.stocks[0].code == "000002"

    @pytest.mark.asyncio
    async def test_process_request_valid(self, stock_daemon):
        """测试处理有效请求"""
        request = {
            "jsonrpc": "2.0",
            "id": "test-1",
            "method": "get_stock_data",
            "params": {"codes": ["600000"]},
        }

        with patch.object(stock_daemon, "get_stock_data", new_callable=AsyncMock) as mock_get_data:
            mock_get_data.return_value = [{"code": "600000", "current_price": 10.75}]

            response = await stock_daemon.process_request(request)

            assert response["jsonrpc"] == "2.0"
            assert response["id"] == "test-1"
            assert "result" in response
            assert response["result"][0]["code"] == "600000"

    @pytest.mark.asyncio
    async def test_process_request_invalid_method(self, stock_daemon):
        """测试处理无效方法请求"""
        request = {
            "jsonrpc": "2.0",
            "id": "test-2",
            "method": "invalid_method",
            "params": {},
        }

        response = await stock_daemon.process_request(request)

        assert response["jsonrpc"] == "2.0"
        assert response["id"] == "test-2"
        assert "error" in response
        assert response["error"]["code"] == -32601  # Method not found

    @pytest.mark.asyncio
    async def test_process_request_malformed(self, stock_daemon):
        """测试处理格式错误的请求"""
        request = {"invalid": "request"}

        response = await stock_daemon.process_request(request)

        assert "error" in response
        assert response["error"]["code"] == -32600  # Invalid Request

    @pytest.mark.asyncio
    async def test_get_stock_data(self, stock_daemon):
        """测试获取股票数据"""
        with patch.object(StockDataFetcher, "fetch_stock_data", new_callable=AsyncMock) as mock_fetch:
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

                result = await stock_daemon.get_stock_data(["600000"])

                assert len(result) == 1
                assert result[0]["code"] == "600000"
                assert result[0]["current_price"] == 10.75
                assert result[0]["profit_amount"] == 25.0

    @pytest.mark.asyncio
    async def test_get_stock_data_empty(self, stock_daemon):
        """测试获取空股票数据"""
        result = await stock_daemon.get_stock_data([])
        assert result == []

    @pytest.mark.asyncio
    async def test_get_stock_data_error(self, stock_daemon):
        """测试获取股票数据时出错"""
        with patch.object(StockDataFetcher, "fetch_stock_data", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = Exception("Network error")

            result = await stock_daemon.get_stock_data(["600000"])

            assert len(result) == 1
            assert "error" in result[0]
            assert result[0]["code"] == "600000"

    @pytest.mark.asyncio
    async def test_monitoring_loop(self, stock_daemon):
        """测试监控循环"""
        stock_daemon.running = True

        with patch.object(stock_daemon, "get_stock_data", new_callable=AsyncMock) as mock_get_data:
            mock_get_data.return_value = [{"code": "600000", "current_price": 10.75}]

            with patch.object(stock_daemon, "send_data", new_callable=AsyncMock) as mock_send:
                # 运行一次循环
                task = asyncio.create_task(stock_daemon._monitoring_loop())
                await asyncio.sleep(0.1)
                stock_daemon.running = False
                await task

                mock_get_data.assert_called()
                mock_send.assert_called()

    @pytest.mark.asyncio
    async def test_send_data(self, stock_daemon):
        """测试发送数据"""
        data = [{"code": "600000", "current_price": 10.75}]

        with patch("sys.stdout") as mock_stdout:
            mock_stdout.write = Mock()
            mock_stdout.flush = Mock()

            await stock_daemon.send_data(data)

            # 验证JSON被写入stdout
            mock_stdout.write.assert_called_once()
            call_args = mock_stdout.write.call_args[0][0]
            written_data = json.loads(call_args.strip())
            assert written_data["type"] == "data"
            assert written_data["data"] == data

    @pytest.mark.asyncio
    async def test_send_error(self, stock_daemon):
        """测试发送错误"""
        error_msg = "Test error"

        with patch("sys.stderr") as mock_stderr:
            mock_stderr.write = Mock()
            mock_stderr.flush = Mock()

            stock_daemon.send_error(error_msg)

            # 验证错误被写入stderr
            mock_stderr.write.assert_called_once()
            call_args = mock_stderr.write.call_args[0][0]
            written_error = json.loads(call_args.strip())
            assert written_error["type"] == "error"
            assert written_error["error"] == error_msg

    def test_validate_stock_code(self, stock_daemon):
        """测试验证股票代码"""
        # 有效的A股代码
        assert stock_daemon._validate_stock_code("600000") is True
        assert stock_daemon._validate_stock_code("000001") is True
        assert stock_daemon._validate_stock_code("300001") is True

        # 无效的代码
        assert stock_daemon._validate_stock_code("") is False
        assert stock_daemon._validate_stock_code("123") is False  # 太短
        assert stock_daemon._validate_stock_code("1234567") is False  # 太长
        assert stock_daemon._validate_stock_code("ABC123") is False  # 包含字母

    def test_filter_enabled_stocks(self, stock_daemon, mock_config):
        """测试过滤启用的股票"""
        # 添加一个禁用的股票
        disabled_stock = StockConfig(
            code="000002",
            name="万科A",
            buy_price=18.5,
            quantity=150,
            enabled=False,
            exchange="sz",
        )
        stock_daemon.config.stocks.append(disabled_stock)

        enabled_codes = stock_daemon._get_enabled_stock_codes()

        assert "600000" in enabled_codes
        assert "000001" in enabled_codes
        assert "000002" not in enabled_codes  # 禁用的股票不应该在列表中

    @pytest.mark.asyncio
    async def test_performance(self, stock_daemon, performance_recorder):
        """测试性能"""
        import time

        # 测试处理多个请求的性能
        requests = [
            {
                "jsonrpc": "2.0",
                "id": f"test-{i}",
                "method": "get_stock_data",
                "params": {"codes": ["600000", "000001"]},
            }
            for i in range(10)
        ]

        with patch.object(stock_daemon, "get_stock_data", new_callable=AsyncMock) as mock_get_data:
            mock_get_data.return_value = [
                {"code": "600000", "current_price": 10.75},
                {"code": "000001", "current_price": 15.25},
            ]

            start_time = time.time()

            tasks = [stock_daemon.process_request(req) for req in requests]
            results = await asyncio.gather(*tasks)

            end_time = time.time()
            duration = end_time - start_time

            performance_recorder.record("process_10_requests", duration)

            assert len(results) == 10
            # 应该在1秒内完成
            assert duration < 1.0


class TestMonitoringConfig:
    """MonitoringConfig测试"""

    def test_from_dict(self):
        """测试从字典创建配置"""
        config_dict = {
            "version": "1.0.0",
            "stocks": [
                {
                    "code": "600000",
                    "name": "浦发银行",
                    "buy_price": 10.5,
                    "quantity": 100,
                    "enabled": True,
                    "exchange": "sh",
                }
            ],
            "settings": {
                "update_interval": 20,
                "auto_start": True,
                "show_notifications": True,
                "price_alert_threshold": 5.0,
                "data_source_priority": "sina",
            },
        }

        config = MonitoringConfig.from_dict(config_dict)

        assert config.version == "1.0.0"
        assert len(config.stocks) == 1
        assert config.stocks[0].code == "600000"
        assert config.settings["update_interval"] == 20

    def test_to_dict(self):
        """测试转换为字典"""
        config = MonitoringConfig(
            stocks=[
                StockConfig(
                    code="600000",
                    name="浦发银行",
                    buy_price=10.5,
                    quantity=100,
                    enabled=True,
                    exchange="sh",
                )
            ],
            settings={
                "update_interval": 20,
                "auto_start": True,
                "show_notifications": True,
                "price_alert_threshold": 5.0,
                "data_source_priority": "sina",
            },
        )

        config_dict = config.to_dict()

        assert config_dict["version"] == "1.0.0"
        assert len(config_dict["stocks"]) == 1
        assert config_dict["stocks"][0]["code"] == "600000"
        assert config_dict["settings"]["update_interval"] == 20

    def test_validation(self):
        """测试配置验证"""
        # 有效的配置
        valid_config = MonitoringConfig(
            stocks=[
                StockConfig(
                    code="600000",
                    name="浦发银行",
                    buy_price=10.5,
                    quantity=100,
                    enabled=True,
                    exchange="sh",
                )
            ],
            settings={
                "update_interval": 20,
                "auto_start": True,
                "show_notifications": True,
                "price_alert_threshold": 5.0,
                "data_source_priority": "sina",
            },
        )

        assert valid_config.validate() is True

        # 无效的配置 - 负数的更新间隔
        invalid_config = MonitoringConfig(
            stocks=[],
            settings={
                "update_interval": -1,  # 无效
                "auto_start": True,
                "show_notifications": True,
                "price_alert_threshold": 5.0,
                "data_source_priority": "sina",
            },
        )

        assert invalid_config.validate() is False