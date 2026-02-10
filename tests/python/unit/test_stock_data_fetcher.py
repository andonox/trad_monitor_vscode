#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StockDataFetcher单元测试
"""
import sys
import json
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path

import pytest
import aioresponses

# 添加scripts目录到Python路径
scripts_dir = Path(__file__).parent.parent.parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))

from stock_daemon import StockDataFetcher


class TestStockDataFetcher:
    """StockDataFetcher单元测试"""

    @pytest.fixture
    def fetcher(self):
        """创建StockDataFetcher实例"""
        return StockDataFetcher()

    @pytest.fixture
    def mock_sina_response(self):
        """模拟新浪财经API响应"""
        return 'var hq_str_sh600000="浦发银行,10.75,10.76,10.75,10.74,10.75,10.76,10.77,328476,3526894,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2026-02-10,15:30:00,00,";'

    @pytest.fixture
    def mock_akshare_data(self):
        """模拟akshare数据"""
        return [
            {
                "代码": "600000.sh",
                "名称": "浦发银行",
                "最新价": 10.75,
                "涨跌额": 0.25,
                "涨跌幅": 2.38,
                "成交量": 328476,
                "成交额": 3526894,
                "振幅": 1.86,
                "最高": 10.77,
                "最低": 10.74,
                "今开": 10.76,
                "昨收": 10.50,
                "换手率": 0.18,
            }
        ]

    @pytest.mark.asyncio
    async def test_initialization(self, fetcher):
        """测试初始化"""
        assert fetcher.data_sources == ["sina", "akshare"]
        assert fetcher.timeout == 10

    @pytest.mark.asyncio
    async def test_fetch_stock_data_sina_success(self, fetcher, mock_sina_response, aioresponse):
        """测试从新浪财经成功获取数据"""
        # 模拟API响应
        aioresponse.get(
            "http://hq.sinajs.cn/list=sh600000",
            body=mock_sina_response,
            content_type="text/javascript; charset=GBK",
        )

        result = await fetcher.fetch_stock_data_sina(["600000"])

        assert len(result) == 1
        assert result[0]["code"] == "600000"
        assert result[0]["name"] == "浦发银行"
        assert result[0]["current_price"] == 10.75
        assert result[0]["change"] == 0.25
        assert result[0]["change_percent"] == pytest.approx(2.38, rel=0.01)

    @pytest.mark.asyncio
    async def test_fetch_stock_data_sina_multiple(self, fetcher, mock_sina_response, aioresponse):
        """测试从新浪财经获取多个股票数据"""
        # 模拟多个API响应
        responses = [
            'var hq_str_sh600000="浦发银行,10.75,10.76,10.75,10.74,10.75,10.76,10.77,328476,3526894,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2026-02-10,15:30:00,00,";',
            'var hq_str_sz000001="平安银行,15.25,15.26,15.25,15.24,15.25,15.26,15.27,428476,4526894,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2026-02-10,15:30:00,00,";',
        ]

        aioresponse.get(
            "http://hq.sinajs.cn/list=sh600000,sz000001",
            body="".join(responses),
            content_type="text/javascript; charset=GBK",
        )

        result = await fetcher.fetch_stock_data_sina(["600000", "000001"])

        assert len(result) == 2
        assert result[0]["code"] == "600000"
        assert result[0]["current_price"] == 10.75
        assert result[1]["code"] == "000001"
        assert result[1]["current_price"] == 15.25

    @pytest.mark.asyncio
    async def test_fetch_stock_data_sina_network_error(self, fetcher, aioresponse):
        """测试新浪财经网络错误"""
        aioresponse.get(
            "http://hq.sinajs.cn/list=sh600000",
            status=500,
            body="Internal Server Error",
        )

        result = await fetcher.fetch_stock_data_sina(["600000"])

        assert len(result) == 1
        assert "error" in result[0]
        assert result[0]["code"] == "600000"

    @pytest.mark.asyncio
    async def test_fetch_stock_data_sina_invalid_response(self, fetcher, aioresponse):
        """测试新浪财经无效响应"""
        aioresponse.get(
            "http://hq.sinajs.cn/list=sh600000",
            body="invalid response",
            content_type="text/javascript; charset=GBK",
        )

        result = await fetcher.fetch_stock_data_sina(["600000"])

        assert len(result) == 1
        assert "error" in result[0]
        assert result[0]["code"] == "600000"

    @pytest.mark.asyncio
    async def test_fetch_stock_data_sina_empty_data(self, fetcher, aioresponse):
        """测试新浪财经空数据"""
        aioresponse.get(
            "http://hq.sinajs.cn/list=sh600000",
            body='var hq_str_sh600000="";',
            content_type="text/javascript; charset=GBK",
        )

        result = await fetcher.fetch_stock_data_sina(["600000"])

        assert len(result) == 1
        assert "error" in result[0]
        assert result[0]["code"] == "600000"

    @pytest.mark.asyncio
    @patch("akshare.stock_zh_a_spot")
    async def test_fetch_stock_data_akshare_success(self, mock_akshare, fetcher, mock_akshare_data):
        """测试从akshare成功获取数据"""
        mock_akshare.return_value = mock_akshare_data

        result = await fetcher.fetch_stock_data_akshare(["600000"])

        assert len(result) == 1
        assert result[0]["code"] == "600000"
        assert result[0]["name"] == "浦发银行"
        assert result[0]["current_price"] == 10.75
        assert result[0]["change"] == 0.25
        assert result[0]["change_percent"] == 2.38

    @pytest.mark.asyncio
    @patch("akshare.stock_zh_a_spot")
    async def test_fetch_stock_data_akshare_empty(self, mock_akshare, fetcher):
        """测试akshare返回空数据"""
        mock_akshare.return_value = []

        result = await fetcher.fetch_stock_data_akshare(["600000"])

        assert len(result) == 1
        assert "error" in result[0]
        assert result[0]["code"] == "600000"

    @pytest.mark.asyncio
    @patch("akshare.stock_zh_a_spot")
    async def test_fetch_stock_data_akshare_exception(self, mock_akshare, fetcher):
        """测试akshare异常"""
        mock_akshare.side_effect = Exception("akshare error")

        result = await fetcher.fetch_stock_data_akshare(["600000"])

        assert len(result) == 1
        assert "error" in result[0]
        assert result[0]["code"] == "600000"

    @pytest.mark.asyncio
    async def test_fetch_stock_data_priority_sina(self, fetcher, mock_sina_response, aioresponse):
        """测试按优先级获取数据（新浪优先）"""
        aioresponse.get(
            "http://hq.sinajs.cn/list=sh600000",
            body=mock_sina_response,
            content_type="text/javascript; charset=GBK",
        )

        result = await fetcher.fetch_stock_data(["600000"], priority="sina")

        assert len(result) == 1
        assert result[0]["code"] == "600000"
        assert result[0]["current_price"] == 10.75

    @pytest.mark.asyncio
    @patch("akshare.stock_zh_a_spot")
    async def test_fetch_stock_data_priority_akshare(self, mock_akshare, fetcher, mock_akshare_data):
        """测试按优先级获取数据（akshare优先）"""
        mock_akshare.return_value = mock_akshare_data

        result = await fetcher.fetch_stock_data(["600000"], priority="akshare")

        assert len(result) == 1
        assert result[0]["code"] == "600000"
        assert result[0]["current_price"] == 10.75

    @pytest.mark.asyncio
    async def test_fetch_stock_data_fallback(self, fetcher, mock_sina_response, aioresponse):
        """测试数据源回退机制"""
        # 第一个数据源失败
        aioresponse.get(
            "http://hq.sinajs.cn/list=sh600000",
            status=500,
            body="Internal Server Error",
        )

        # 第二个数据源成功
        with patch("akshare.stock_zh_a_spot") as mock_akshare:
            mock_akshare.return_value = [
                {
                    "代码": "600000.sh",
                    "名称": "浦发银行",
                    "最新价": 10.75,
                    "涨跌额": 0.25,
                    "涨跌幅": 2.38,
                }
            ]

            result = await fetcher.fetch_stock_data(["600000"])

            assert len(result) == 1
            assert result[0]["code"] == "600000"
            assert result[0]["current_price"] == 10.75

    @pytest.mark.asyncio
    async def test_fetch_stock_data_all_failed(self, fetcher, aioresponse):
        """测试所有数据源都失败"""
        aioresponse.get(
            "http://hq.sinajs.cn/list=sh600000",
            status=500,
            body="Internal Server Error",
        )

        with patch("akshare.stock_zh_a_spot") as mock_akshare:
            mock_akshare.side_effect = Exception("akshare error")

            result = await fetcher.fetch_stock_data(["600000"])

            assert len(result) == 1
            assert "error" in result[0]
            assert result[0]["code"] == "600000"

    @pytest.mark.asyncio
    async def test_parse_sina_response(self, fetcher, mock_sina_response):
        """测试解析新浪财经响应"""
        result = fetcher._parse_sina_response(mock_sina_response, "sh600000")

        assert result["code"] == "600000"
        assert result["name"] == "浦发银行"
        assert result["current_price"] == 10.75
        assert result["change"] == 0.25
        assert result["change_percent"] == pytest.approx(2.38, rel=0.01)
        assert result["volume"] == 328476
        assert result["amount"] == 3526894
        assert result["high"] == 10.77
        assert result["low"] == 10.74
        assert result["open"] == 10.76
        assert result["prev_close"] == 10.50

    def test_parse_sina_response_invalid(self, fetcher):
        """测试解析无效的新浪财经响应"""
        result = fetcher._parse_sina_response("invalid response", "sh600000")
        assert "error" in result

    def test_parse_sina_response_empty(self, fetcher):
        """测试解析空的新浪财经响应"""
        result = fetcher._parse_sina_response('var hq_str_sh600000="";', "sh600000")
        assert "error" in result

    def test_parse_sina_response_missing_fields(self, fetcher):
        """测试解析字段不全的新浪财经响应"""
        response = 'var hq_str_sh600000="浦发银行,10.75";'  # 缺少必要字段
        result = fetcher._parse_sina_response(response, "sh600000")
        assert "error" in result

    def test_build_sina_list_param(self, fetcher):
        """测试构建新浪财经列表参数"""
        # 上海股票
        assert fetcher._build_sina_list_param(["600000"]) == "sh600000"
        # 深圳股票
        assert fetcher._build_sina_list_param(["000001"]) == "sz000001"
        # 混合股票
        assert fetcher._build_sina_list_param(["600000", "000001"]) == "sh600000,sz000001"
        # 无效代码
        assert fetcher._build_sina_list_param(["invalid"]) == ""

    def test_validate_stock_code(self, fetcher):
        """测试验证股票代码"""
        # 有效的上海股票
        assert fetcher._validate_stock_code("600000") == ("600000", "sh")
        # 有效的深圳股票
        assert fetcher._validate_stock_code("000001") == ("000001", "sz")
        # 有效的创业板股票
        assert fetcher._validate_stock_code("300001") == ("300001", "sz")
        # 无效的代码
        assert fetcher._validate_stock_code("123") is None
        assert fetcher._validate_stock_code("1234567") is None
        assert fetcher._validate_stock_code("ABC123") is None

    @pytest.mark.asyncio
    async def test_performance_single_stock(self, fetcher, mock_sina_response, aioresponse, performance_recorder):
        """测试单个股票性能"""
        import time

        aioresponse.get(
            "http://hq.sinajs.cn/list=sh600000",
            body=mock_sina_response,
            content_type="text/javascript; charset=GBK",
        )

        start_time = time.time()
        result = await fetcher.fetch_stock_data_sina(["600000"])
        end_time = time.time()

        duration = end_time - start_time
        performance_recorder.record("fetch_single_stock_sina", duration)

        assert len(result) == 1
        assert duration < 2.0  # 应该在2秒内完成

    @pytest.mark.asyncio
    async def test_performance_multiple_stocks(self, fetcher, aioresponse, performance_recorder):
        """测试多个股票性能"""
        import time

        # 模拟10个股票的响应
        responses = []
        for i in range(10):
            code = f"600{i:03d}"
            price = 10.0 + i * 0.1
            response = f'var hq_str_sh{code}="股票{code},{price},{price+0.01},{price},{price-0.01},{price},{price+0.01},{price+0.02},10000,100000,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2026-02-10,15:30:00,00,";'
            responses.append(response)

        aioresponse.get(
            "http://hq.sinajs.cn/list=sh600000,sh600001,sh600002,sh600003,sh600004,sh600005,sh600006,sh600007,sh600008,sh600009",
            body="".join(responses),
            content_type="text/javascript; charset=GBK",
        )

        codes = [f"600{i:03d}" for i in range(10)]

        start_time = time.time()
        result = await fetcher.fetch_stock_data_sina(codes)
        end_time = time.time()

        duration = end_time - start_time
        performance_recorder.record("fetch_10_stocks_sina", duration)

        assert len(result) == 10
        assert duration < 3.0  # 应该在3秒内完成

    @pytest.mark.asyncio
    async def test_concurrent_requests(self, fetcher, mock_sina_response, aioresponse):
        """测试并发请求"""
        # 设置多个响应
        for i in range(5):
            code = f"600{i:03d}"
            aioresponse.get(
                f"http://hq.sinajs.cn/list=sh{code}",
                body=mock_sina_response,
                content_type="text/javascript; charset=GBK",
            )

        codes = [f"600{i:03d}" for i in range(5)]

        # 并发获取数据
        tasks = [fetcher.fetch_stock_data_sina([code]) for code in codes]
        results = await asyncio.gather(*tasks)

        assert len(results) == 5
        for result in results:
            assert len(result) == 1
            assert "current_price" in result[0]