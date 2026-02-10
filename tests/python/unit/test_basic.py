#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
基本Python测试
"""
import pytest


def test_basic_math():
    """基本数学测试"""
    assert 1 + 1 == 2
    assert 10 * 10 == 100


def test_string_operations():
    """字符串操作测试"""
    assert "hello" + " " + "world" == "hello world"
    assert len("test") == 4


def test_list_operations():
    """列表操作测试"""
    numbers = [1, 2, 3, 4, 5]
    assert sum(numbers) == 15
    assert len(numbers) == 5


def test_dict_operations():
    """字典操作测试"""
    data = {"a": 1, "b": 2, "c": 3}
    assert data["a"] == 1
    assert len(data) == 3


@pytest.mark.asyncio
async def test_async_operation():
    """异步操作测试"""
    result = await async_add(1, 2)
    assert result == 3


async def async_add(a, b):
    """异步加法函数"""
    return a + b


class TestCalculator:
    """计算器测试类"""

    def test_addition(self):
        """加法测试"""
        assert self.add(2, 3) == 5
        assert self.add(-1, 1) == 0

    def test_multiplication(self):
        """乘法测试"""
        assert self.multiply(2, 3) == 6
        assert self.multiply(0, 100) == 0

    def add(self, a, b):
        """加法方法"""
        return a + b

    def multiply(self, a, b):
        """乘法方法"""
        return a * b


@pytest.fixture
def sample_data():
    """测试fixture"""
    return {"numbers": [1, 2, 3, 4, 5], "sum": 15}


def test_with_fixture(sample_data):
    """使用fixture的测试"""
    assert sum(sample_data["numbers"]) == sample_data["sum"]


def test_exception():
    """异常测试"""
    with pytest.raises(ValueError):
        raise ValueError("Test exception")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])