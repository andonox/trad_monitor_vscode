"""
Python测试共享配置和fixtures
"""
import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, List, Any
from unittest.mock import Mock, AsyncMock, MagicMock

import pytest
import aioresponses

# 添加scripts目录到Python路径
scripts_dir = Path(__file__).parent.parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))


@pytest.fixture
def mock_stock_data() -> Dict[str, Any]:
    """模拟股票数据"""
    return {
        "code": "600000",
        "name": "浦发银行",
        "current_price": 10.75,
        "buy_price": 10.50,
        "quantity": 100,
        "profit_amount": 25.00,
        "profit_percent": 2.38,
        "market_value": 1075.00,
        "cost_basis": 1050.00,
        "change": 0.25,
        "change_percent": 2.38,
        "last_update": 1640995200000,
    }


@pytest.fixture
def mock_stock_config() -> Dict[str, Any]:
    """模拟股票配置"""
    return {
        "code": "600000",
        "name": "浦发银行",
        "buy_price": 10.5,
        "quantity": 100,
        "enabled": True,
        "exchange": "sh",
    }


@pytest.fixture
def mock_plugin_config() -> Dict[str, Any]:
    """模拟插件配置"""
    return {
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
                "code": "000001",
                "name": "平安银行",
                "buy_price": 15.2,
                "quantity": 200,
                "enabled": True,
                "exchange": "sz",
            },
        ],
        "settings": {
            "update_interval": 20,
            "auto_start": True,
            "show_notifications": True,
            "price_alert_threshold": 5.0,
            "data_source_priority": "sina",
        },
    }


@pytest.fixture
def mock_sina_response() -> str:
    """模拟新浪财经API响应"""
    return 'var hq_str_sh600000="浦发银行,10.75,10.76,10.75,10.74,10.75,10.76,10.77,328476,3526894,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2026-02-10,15:30:00,00,";'


@pytest.fixture
def mock_akshare_data() -> List[Dict[str, Any]]:
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


@pytest.fixture
def aioresponse():
    """aiohttp响应mock"""
    with aioresponses.aioresponses() as m:
        yield m


@pytest.fixture
def event_loop():
    """为异步测试创建事件循环"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest.fixture
def temp_config_file(tmp_path):
    """临时配置文件"""
    config_file = tmp_path / "config.json"
    config_data = {
        "version": "1.0.0",
        "stocks": [],
        "settings": {
            "update_interval": 20,
            "auto_start": False,
            "show_notifications": False,
            "price_alert_threshold": 5.0,
            "data_source_priority": "sina",
        },
    }
    config_file.write_text(json.dumps(config_data, ensure_ascii=False, indent=2))
    return str(config_file)


@pytest.fixture
def mock_python_process():
    """模拟Python进程"""
    process = Mock()
    process.stdin = Mock()
    process.stdout = AsyncMock()
    process.stderr = AsyncMock()
    process.pid = 12345
    process.returncode = None

    # 模拟stdout数据流
    async def mock_readline():
        return json.dumps({
            "type": "data",
            "data": [{
                "code": "600000",
                "name": "浦发银行",
                "current_price": 10.75,
                "buy_price": 10.50,
                "quantity": 100,
                "profit_amount": 25.00,
                "profit_percent": 2.38,
            }]
        }).encode() + b"\n"

    process.stdout.readline = mock_readline
    return process


class PerformanceRecorder:
    """性能测试记录器"""

    def __init__(self):
        self.records = []

    def record(self, name: str, duration: float, memory_usage: float = 0):
        """记录性能数据"""
        self.records.append({
            "name": name,
            "duration": duration,
            "memory_usage": memory_usage,
            "timestamp": asyncio.get_event_loop().time(),
        })

    def get_summary(self) -> Dict[str, Any]:
        """获取性能摘要"""
        if not self.records:
            return {}

        durations = [r["duration"] for r in self.records]
        memory_usages = [r["memory_usage"] for r in self.records if r["memory_usage"] > 0]

        return {
            "total_tests": len(self.records),
            "avg_duration": sum(durations) / len(durations),
            "max_duration": max(durations),
            "min_duration": min(durations),
            "avg_memory": sum(memory_usages) / len(memory_usages) if memory_usages else 0,
            "max_memory": max(memory_usages) if memory_usages else 0,
        }


@pytest.fixture
def performance_recorder():
    """性能测试记录器fixture"""
    return PerformanceRecorder()