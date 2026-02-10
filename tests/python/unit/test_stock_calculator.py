#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StockCalculator单元测试
"""
import sys
import math
from pathlib import Path

import pytest

# 添加scripts目录到Python路径
scripts_dir = Path(__file__).parent.parent.parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))

from stock_daemon import StockCalculator, StockConfig


class TestStockCalculator:
    """StockCalculator单元测试"""

    @pytest.fixture
    def calculator(self):
        """创建StockCalculator实例"""
        return StockCalculator()

    @pytest.fixture
    def stock_config(self):
        """模拟股票配置"""
        return StockConfig(
            code="600000",
            name="浦发银行",
            buy_price=10.5,
            quantity=100,
            enabled=True,
            exchange="sh",
        )

    def test_calculate_profit_profitable(self, calculator, stock_config):
        """测试计算盈利情况"""
        market_data = {
            "current_price": 10.75,
            "change": 0.25,
            "change_percent": 2.38,
        }

        result = calculator.calculate_profit(stock_config, market_data)

        assert result["profit_amount"] == pytest.approx(25.0)  # (10.75 - 10.5) * 100
        assert result["profit_percent"] == pytest.approx(2.38, rel=0.01)  # (0.25 / 10.5) * 100
        assert result["market_value"] == pytest.approx(1075.0)  # 10.75 * 100
        assert result["cost_basis"] == pytest.approx(1050.0)  # 10.5 * 100
        assert result["current_price"] == 10.75
        assert result["buy_price"] == 10.5
        assert result["quantity"] == 100

    def test_calculate_profit_loss(self, calculator, stock_config):
        """测试计算亏损情况"""
        market_data = {
            "current_price": 10.25,
            "change": -0.25,
            "change_percent": -2.38,
        }

        result = calculator.calculate_profit(stock_config, market_data)

        assert result["profit_amount"] == pytest.approx(-25.0)  # (10.25 - 10.5) * 100
        assert result["profit_percent"] == pytest.approx(-2.38, rel=0.01)  # (-0.25 / 10.5) * 100
        assert result["market_value"] == pytest.approx(1025.0)  # 10.25 * 100

    def test_calculate_profit_break_even(self, calculator, stock_config):
        """测试计算盈亏平衡情况"""
        market_data = {
            "current_price": 10.5,
            "change": 0.0,
            "change_percent": 0.0,
        }

        result = calculator.calculate_profit(stock_config, market_data)

        assert result["profit_amount"] == 0.0
        assert result["profit_percent"] == 0.0
        assert result["market_value"] == pytest.approx(1050.0)  # 10.5 * 100

    def test_calculate_profit_large_quantity(self, calculator):
        """测试计算大数量股票"""
        config = StockConfig(
            code="600000",
            name="浦发银行",
            buy_price=10.5,
            quantity=10000,  # 1万股
            enabled=True,
            exchange="sh",
        )

        market_data = {
            "current_price": 10.75,
            "change": 0.25,
            "change_percent": 2.38,
        }

        result = calculator.calculate_profit(config, market_data)

        assert result["profit_amount"] == pytest.approx(2500.0)  # (10.75 - 10.5) * 10000
        assert result["market_value"] == pytest.approx(107500.0)  # 10.75 * 10000
        assert result["cost_basis"] == pytest.approx(105000.0)  # 10.5 * 10000

    def test_calculate_profit_decimal_prices(self, calculator):
        """测试计算小数价格"""
        config = StockConfig(
            code="600000",
            name="浦发银行",
            buy_price=10.123,
            quantity=100,
            enabled=True,
            exchange="sh",
        )

        market_data = {
            "current_price": 10.456,
            "change": 0.333,
            "change_percent": 3.29,
        }

        result = calculator.calculate_profit(config, market_data)

        expected_profit = (10.456 - 10.123) * 100
        expected_percent = ((10.456 - 10.123) / 10.123) * 100

        assert result["profit_amount"] == pytest.approx(expected_profit, rel=0.001)
        assert result["profit_percent"] == pytest.approx(expected_percent, rel=0.001)
        assert result["market_value"] == pytest.approx(10.456 * 100, rel=0.001)

    def test_calculate_profit_missing_market_data(self, calculator, stock_config):
        """测试缺少市场数据的情况"""
        market_data = {
            "current_price": 10.75,
            # 缺少change和change_percent
        }

        result = calculator.calculate_profit(stock_config, market_data)

        # 应该计算change和change_percent
        expected_change = 10.75 - stock_config.buy_price
        expected_change_percent = (expected_change / stock_config.buy_price) * 100

        assert result["change"] == pytest.approx(expected_change, rel=0.001)
        assert result["change_percent"] == pytest.approx(expected_change_percent, rel=0.001)
        assert result["profit_amount"] == pytest.approx(expected_change * stock_config.quantity, rel=0.001)

    def test_calculate_profit_invalid_market_data(self, calculator, stock_config):
        """测试无效市场数据"""
        market_data = {
            "current_price": "invalid",  # 无效的价格
            "change": 0.25,
            "change_percent": 2.38,
        }

        with pytest.raises(ValueError):
            calculator.calculate_profit(stock_config, market_data)

    def test_calculate_profit_negative_price(self, calculator, stock_config):
        """测试负价格"""
        market_data = {
            "current_price": -10.75,  # 负价格
            "change": 0.25,
            "change_percent": 2.38,
        }

        with pytest.raises(ValueError):
            calculator.calculate_profit(stock_config, market_data)

    def test_calculate_profit_zero_quantity(self, calculator):
        """测试零数量"""
        config = StockConfig(
            code="600000",
            name="浦发银行",
            buy_price=10.5,
            quantity=0,  # 零数量
            enabled=True,
            exchange="sh",
        )

        market_data = {
            "current_price": 10.75,
            "change": 0.25,
            "change_percent": 2.38,
        }

        result = calculator.calculate_profit(config, market_data)

        assert result["profit_amount"] == 0.0
        assert result["market_value"] == 0.0
        assert result["cost_basis"] == 0.0

    def test_calculate_summary(self, calculator):
        """测试计算汇总数据"""
        stock_results = [
            {
                "code": "600000",
                "name": "浦发银行",
                "profit_amount": 25.0,
                "profit_percent": 2.38,
                "market_value": 1075.0,
                "cost_basis": 1050.0,
                "current_price": 10.75,
                "buy_price": 10.5,
                "quantity": 100,
            },
            {
                "code": "000001",
                "name": "平安银行",
                "profit_amount": 50.0,
                "profit_percent": 3.29,
                "market_value": 2000.0,
                "cost_basis": 1950.0,
                "current_price": 15.25,
                "buy_price": 15.2,
                "quantity": 200,
            },
        ]

        summary = calculator.calculate_summary(stock_results)

        assert summary["total_profit"] == pytest.approx(75.0)  # 25 + 50
        assert summary["total_market_value"] == pytest.approx(3075.0)  # 1075 + 2000
        assert summary["total_cost_basis"] == pytest.approx(3000.0)  # 1050 + 1950
        assert summary["total_profit_percent"] == pytest.approx(2.5, rel=0.01)  # 75 / 3000 * 100
        assert summary["stock_count"] == 2
        assert summary["profitable_count"] == 2
        assert summary["losing_count"] == 0

    def test_calculate_summary_with_losses(self, calculator):
        """测试计算包含亏损的汇总数据"""
        stock_results = [
            {
                "code": "600000",
                "name": "浦发银行",
                "profit_amount": 25.0,
                "profit_percent": 2.38,
                "market_value": 1075.0,
                "cost_basis": 1050.0,
            },
            {
                "code": "000001",
                "name": "平安银行",
                "profit_amount": -15.0,
                "profit_percent": -0.77,
                "market_value": 985.0,
                "cost_basis": 1000.0,
            },
        ]

        summary = calculator.calculate_summary(stock_results)

        assert summary["total_profit"] == pytest.approx(10.0)  # 25 - 15
        assert summary["total_market_value"] == pytest.approx(2060.0)  # 1075 + 985
        assert summary["total_cost_basis"] == pytest.approx(2050.0)  # 1050 + 1000
        assert summary["total_profit_percent"] == pytest.approx(0.49, rel=0.01)  # 10 / 2050 * 100
        assert summary["stock_count"] == 2
        assert summary["profitable_count"] == 1
        assert summary["losing_count"] == 1

    def test_calculate_summary_empty(self, calculator):
        """测试计算空汇总数据"""
        summary = calculator.calculate_summary([])

        assert summary["total_profit"] == 0.0
        assert summary["total_market_value"] == 0.0
        assert summary["total_cost_basis"] == 0.0
        assert summary["total_profit_percent"] == 0.0
        assert summary["stock_count"] == 0
        assert summary["profitable_count"] == 0
        assert summary["losing_count"] == 0

    def test_calculate_summary_invalid_data(self, calculator):
        """测试计算无效数据汇总"""
        stock_results = [
            {
                "code": "600000",
                "profit_amount": "invalid",  # 无效的盈利金额
                "market_value": 1075.0,
                "cost_basis": 1050.0,
            },
        ]

        with pytest.raises(ValueError):
            calculator.calculate_summary(stock_results)

    def test_format_currency(self, calculator):
        """测试格式化货币"""
        assert calculator._format_currency(1234.567) == "1,234.57"
        assert calculator._format_currency(0.0) == "0.00"
        assert calculator._format_currency(-1234.567) == "-1,234.57"
        assert calculator._format_currency(9999999.999) == "9,999,999.99"

    def test_format_percentage(self, calculator):
        """测试格式化百分比"""
        assert calculator._format_percentage(12.3456) == "12.35%"
        assert calculator._format_percentage(0.0) == "0.00%"
        assert calculator._format_percentage(-5.6789) == "-5.68%"
        assert calculator._format_percentage(100.0) == "100.00%"

    def test_round_to_decimal(self, calculator):
        """测试四舍五入到小数位"""
        assert calculator._round_to_decimal(123.4567, 2) == pytest.approx(123.46)
        assert calculator._round_to_decimal(123.4544, 2) == pytest.approx(123.45)
        assert calculator._round_to_decimal(123.4567, 0) == pytest.approx(123.0)
        assert calculator._round_to_decimal(123.4567, 4) == pytest.approx(123.4567)

    def test_calculate_average_price(self, calculator):
        """测试计算平均价格"""
        transactions = [
            {"price": 10.0, "quantity": 100},
            {"price": 11.0, "quantity": 200},
            {"price": 12.0, "quantity": 300},
        ]

        avg_price = calculator.calculate_average_price(transactions)
        expected = (10.0 * 100 + 11.0 * 200 + 12.0 * 300) / (100 + 200 + 300)

        assert avg_price == pytest.approx(expected, rel=0.001)

    def test_calculate_average_price_empty(self, calculator):
        """测试计算空交易的平均价格"""
        avg_price = calculator.calculate_average_price([])
        assert avg_price == 0.0

    def test_calculate_average_price_zero_total_quantity(self, calculator):
        """测试计算零总数量的平均价格"""
        transactions = [
            {"price": 10.0, "quantity": 0},
            {"price": 11.0, "quantity": 0},
        ]

        avg_price = calculator.calculate_average_price(transactions)
        assert avg_price == 0.0

    def test_calculate_performance_metrics(self, calculator, stock_config):
        """测试计算性能指标"""
        market_data = {
            "current_price": 10.75,
            "change": 0.25,
            "change_percent": 2.38,
            "high": 10.77,
            "low": 10.74,
            "volume": 100000,
            "amount": 1075000,
        }

        result = calculator.calculate_profit(stock_config, market_data)

        # 验证包含的性能指标
        assert "distance_to_high" in result
        assert "distance_to_low" in result
        assert "volume_ratio" in result

        expected_distance_to_high = ((10.77 - 10.75) / 10.75) * 100
        expected_distance_to_low = ((10.75 - 10.74) / 10.75) * 100

        assert result["distance_to_high"] == pytest.approx(expected_distance_to_high, rel=0.001)
        assert result["distance_to_low"] == pytest.approx(expected_distance_to_low, rel=0.001)

    def test_performance_large_dataset(self, calculator, performance_recorder):
        """测试大数据集性能"""
        import time

        # 创建1000个股票结果
        stock_results = []
        for i in range(1000):
            stock_results.append({
                "code": f"600{i:03d}",
                "name": f"股票{i}",
                "profit_amount": i * 10.0,
                "profit_percent": i * 0.1,
                "market_value": 10000.0 + i * 100.0,
                "cost_basis": 9500.0 + i * 100.0,
            })

        start_time = time.time()
        summary = calculator.calculate_summary(stock_results)
        end_time = time.time()

        duration = end_time - start_time
        performance_recorder.record("calculate_summary_1000_stocks", duration)

        assert summary["stock_count"] == 1000
        assert duration < 0.1  # 应该在0.1秒内完成

    def test_edge_cases(self, calculator):
        """测试边界情况"""
        # 极小价格
        config = StockConfig(
            code="600000",
            name="浦发银行",
            buy_price=0.0001,
            quantity=1000000,  # 大量
            enabled=True,
            exchange="sh",
        )

        market_data = {
            "current_price": 0.0002,
            "change": 0.0001,
            "change_percent": 100.0,
        }

        result = calculator.calculate_profit(config, market_data)

        assert result["profit_amount"] == pytest.approx(100.0, rel=0.001)  # (0.0002 - 0.0001) * 1000000
        assert result["profit_percent"] == pytest.approx(100.0, rel=0.001)

        # 极大价格
        config = StockConfig(
            code="600000",
            name="浦发银行",
            buy_price=10000.0,
            quantity=10,
            enabled=True,
            exchange="sh",
        )

        market_data = {
            "current_price": 20000.0,
            "change": 10000.0,
            "change_percent": 100.0,
        }

        result = calculator.calculate_profit(config, market_data)

        assert result["profit_amount"] == pytest.approx(100000.0, rel=0.001)  # (20000 - 10000) * 10
        assert result["profit_percent"] == pytest.approx(100.0, rel=0.001)

    def test_nan_handling(self, calculator, stock_config):
        """测试NaN值处理"""
        market_data = {
            "current_price": float('nan'),
            "change": 0.25,
            "change_percent": 2.38,
        }

        with pytest.raises(ValueError):
            calculator.calculate_profit(stock_config, market_data)

    def test_inf_handling(self, calculator, stock_config):
        """测试无穷值处理"""
        market_data = {
            "current_price": float('inf'),
            "change": 0.25,
            "change_percent": 2.38,
        }

        with pytest.raises(ValueError):
            calculator.calculate_profit(stock_config, market_data)