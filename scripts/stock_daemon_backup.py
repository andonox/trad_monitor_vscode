#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Real-time A-share stock price query and profit/loss calculation script

【Usage Methods】
Method 1: Directly run the script (using configuration parameters)
  python stock_profit_calculator.py
  Modify the configuration area at the top of the script to set stock code, purchase price, etc.

Method 2: Command line parameters
  python stock_profit_calculator.py -c 600000 -b 10.5 -q 100
  python stock_profit_calculator.py -f stocks.txt
  python stock_profit_calculator.py -i    # Interactive mode
  python stock_profit_calculator.py -d    # Demo mode

【Data Sources】
1. akshare (recommended): pip install akshare pandas
2. Sina Finance API: pip install requests

【Features】
- Query real-time stock prices (supports Shanghai, Shenzhen, ChiNext, STAR Market)
- Calculate profit/loss (supports custom purchase price and quantity)
- Configuration mode: Set parameters directly in the script
- Command line mode: Specify stocks through parameters
- Batch query: Process multiple stocks through files
- Demo mode: View example usage
"""

import sys
import argparse
import time
import json

# Try to import requests
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("Note: requests library not installed. To use Sina Finance API data source, install: pip install requests")

# Try to import akshare (optional)
try:
    import akshare as ak
    HAS_AKSHARE = True
except ImportError:
    HAS_AKSHARE = False
    print("Note: akshare library not installed. To use akshare data source, install: pip install akshare pandas")

# Try to import pandas (optional)
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print("Note: pandas library not installed. To use akshare data source, install: pip install pandas")


# ============================================================================
# Configuration area: Users can modify parameters here, then run the script
# ============================================================================

# Single stock configuration example
SINGLE_STOCK_CONFIG = {
    "code": "600000",      # Stock code
    "buy_price": 10.5,     # Purchase price
    "quantity": 100        # Purchase quantity
}

# Batch stocks configuration example
BATCH_STOCKS_CONFIG = [
    {"code": "600373", "buy_price": 10.4, "quantity": 5100},
    {"code": "002015", "buy_price": 13.2, "quantity": 1600},


]

# Run mode configuration
# Optional values: "single" - Single stock mode, "batch" - Batch mode, "demo" - Demo mode
RUN_MODE = "batch"  # Mode used when running the script directly


def get_stock_suffix(code):
    if code.startswith(('6', '9')):
        return 'sh'
    elif code.startswith(('0', '2', '3')):
        return 'sz'
    else:
        # Default to Shanghai Stock Exchange
        return 'sh'


def get_real_time_price_sina(stock_code):
    if not HAS_REQUESTS:
        return None, None

    try:
        suffix = get_stock_suffix(stock_code)
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
        # Parse format: var hq_str_sh600000="Bank of Communications,14.850,14.860,...";
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
            # If the 4th value is invalid, try the 2nd value (opening price)
            try:
                current_price = float(data_parts[1])
            except (ValueError, IndexError):
                return None, None

        return current_price, stock_name

    except Exception as e:
        print(f"Sina Finance API failed to fetch data: {e}")
        return None, None


def get_real_time_price_akshare(stock_code):
    if not HAS_AKSHARE or not HAS_PANDAS:
        return None, None

    try:
        # Get all A-share real-time data
        stock_zh_a_spot_df = ak.stock_zh_a_spot()

        # Build code with suffix for matching
        suffix = get_stock_suffix(stock_code)
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
        print(f"akshare failed to fetch data: {e}")
        return None, None


def get_real_time_price(stock_code):
    # 首先尝试akshare
    current_price, stock_name = get_real_time_price_akshare(stock_code)

    if current_price is not None:
        return current_price, stock_name

    # If akshare fails, try Sina Finance API
    current_price, stock_name = get_real_time_price_sina(stock_code)

    if current_price is not None:
        return current_price, stock_name

    print(f"Failed to get price for stock {stock_code}, please check:")
    print("1. Whether the stock code is correct (e.g.: 600000, 000001)")
    print("2. Whether the network connection is normal")
    print("3. Whether the necessary data source libraries are installed:")
    if not HAS_AKSHARE:
        print("   - akshare: pip install akshare pandas")
    if not HAS_REQUESTS:
        print("   - requests: pip install requests")

    return None, None


def calculate_profit(current_price, buy_price, quantity):
    """Calculate profit/loss

    Args:
        current_price: Current price
        buy_price: Purchase price
        quantity: Purchase quantity

    Returns:
        tuple: (profit amount, profit percentage)
    """
    profit_amount = (current_price - buy_price) * quantity
    profit_percent = (current_price / buy_price - 1) * 100 if buy_price != 0 else 0

    return profit_amount, profit_percent


def display_stock_info(stock_code, stock_name, current_price):
    """Display basic stock information"""
    print(f"\n{'='*50}")
    print(f"Stock Code: {stock_code}")
    print(f"Stock Name: {stock_name}")
    print(f"Current Price: {current_price:.2f} RMB")
    print(f"{'='*50}")


def display_profit_info(buy_price, quantity, profit_amount, profit_percent):
    """Display profit/loss information"""
    print(f"\nPurchase Price: {buy_price:.2f} RMB")
    print(f"Purchase Quantity: {quantity} shares")
    print(f"Portfolio Value: {buy_price * quantity:.2f} RMB")
    print(f"Current Value: {(buy_price + profit_amount / quantity) * quantity:.2f} RMB")
    print(f"\nProfit/Loss Amount: {profit_amount:+.2f} RMB")
    print(f"Profit/Loss Percentage: {profit_percent:+.2f}%")

    if profit_amount > 0:
        print("Status: Profit ✅")
    elif profit_amount < 0:
        print("Status: Loss ❌")
    else:
        print("Status: Break-even ⏸️")


def interactive_mode():
    """Interactive mode"""
    print("A-share Real-time Stock Price Query and Profit/Loss Calculation")
    print("="*50)

    # Input stock code
    while True:
        stock_code = input("\nEnter stock code (e.g.: 600000): ").strip()
        if stock_code:
            break
        print("Stock code cannot be empty")

    # Get real-time price
    print(f"Getting real-time price for {stock_code}...")
    current_price, stock_name = get_real_time_price(stock_code)

    if current_price is None:
        print("Failed to get stock price, please check stock code or network connection")
        return

    display_stock_info(stock_code, stock_name, current_price)

    # Input purchase information
    while True:
        try:
            buy_price_input = input("\nEnter purchase price (RMB, press Enter to use current price): ").strip()
            if not buy_price_input:
                buy_price = current_price
                print(f"Using current price as purchase price: {buy_price:.2f} RMB")
                break
            buy_price = float(buy_price_input)
            if buy_price > 0:
                break
            print("Purchase price must be greater than 0")
        except ValueError:
            print("Please enter a valid number")

    while True:
        try:
            quantity_input = input("Enter purchase quantity (shares): ").strip()
            quantity = int(quantity_input)
            if quantity > 0:
                break
            print("Purchase quantity must be greater than 0")
        except ValueError:
            print("Please enter a valid integer")

    # Calculate profit/loss
    profit_amount, profit_percent = calculate_profit(current_price, buy_price, quantity)

    # Display results
    display_profit_info(buy_price, quantity, profit_amount, profit_percent)


def batch_mode(stock_codes, buy_prices=None, quantities=None):
    """Batch mode

    Args:
        stock_codes: List of stock codes
        buy_prices: List of purchase prices (optional)
        quantities: List of purchase quantities (optional)
    """
    print("Batch Stock Query Mode")
    print("="*50)

    results = []

    for i, stock_code in enumerate(stock_codes):
        print(f"\nQuerying stock {i+1}/{len(stock_codes)}: {stock_code}")

        current_price, stock_name = get_real_time_price(stock_code)
        if current_price is None:
            results.append((stock_code, None, None, None, None, None))
            continue

        buy_price = buy_prices[i] if buy_prices and i < len(buy_prices) else current_price
        quantity = quantities[i] if quantities and i < len(quantities) else 100

        profit_amount, profit_percent = calculate_profit(current_price, buy_price, quantity)

        results.append((stock_code, stock_name, current_price, buy_price, quantity, profit_amount, profit_percent))

        print(f"  {stock_name}: Current {current_price:.2f}, Buy {buy_price:.2f}, P/L {profit_amount:+.2f} ({profit_percent:+.2f}%)")

    # Summary display
    if results:
        print(f"\n{'='*50}")
        print("Batch Query Results Summary:")
        print(f"{'Code':<10} {'Name':<10} {'Current':<8} {'Buy':<8} {'P/L Amt':<10} {'P/L %':<8}")
        print("-"*60)

        total_profit = 0
        total_investment = 0

        for result in results:
            if result[1] is None:
                print(f"{result[0]:<10} {'Failed':<10}")
                continue

            stock_code, stock_name, current_price, buy_price, quantity, profit_amount, profit_percent = result
            print(f"{stock_code:<10} {stock_name:<10} {current_price:<8.2f} {buy_price:<8.2f} {profit_amount:<+10.2f} {profit_percent:<+8.2f}%")

            total_profit += profit_amount
            total_investment += buy_price * quantity

        if total_investment > 0:
            total_profit_percent = (total_profit / total_investment) * 100
            print(f"\nTotal Investment: {total_investment:.2f} RMB")
            print(f"Total Profit/Loss: {total_profit:+.2f} RMB ({total_profit_percent:+.2f}%)")


def config_mode():
    """Configuration mode: Run using parameters configured at the top of the script"""
    print("="*60)
    print("A-share Real-time Stock Price Query and Profit/Loss Calculation - Configuration Mode")
    print("="*60)
    print("Note: To modify parameters, edit the configuration area at the top of the script")
    print("-"*60)

    if RUN_MODE == "single":
        # Single stock mode
        print(f"\nRun Mode: Single Stock")
        print(f"Stock Code: {SINGLE_STOCK_CONFIG['code']}")
        print(f"Purchase Price: {SINGLE_STOCK_CONFIG['buy_price']}")
        print(f"Purchase Quantity: {SINGLE_STOCK_CONFIG['quantity']}")

        current_price, stock_name = get_real_time_price(SINGLE_STOCK_CONFIG['code'])
        if current_price is not None:
            display_stock_info(SINGLE_STOCK_CONFIG['code'], stock_name, current_price)
            profit_amount, profit_percent = calculate_profit(
                current_price,
                SINGLE_STOCK_CONFIG['buy_price'],
                SINGLE_STOCK_CONFIG['quantity']
            )
            display_profit_info(
                SINGLE_STOCK_CONFIG['buy_price'],
                SINGLE_STOCK_CONFIG['quantity'],
                profit_amount,
                profit_percent
            )

    elif RUN_MODE == "batch":
        # Batch mode
        print(f"\nRun Mode: Batch Query")
        print(f"Number of Stocks: {len(BATCH_STOCKS_CONFIG)}")

        stock_codes = [stock["code"] for stock in BATCH_STOCKS_CONFIG]
        buy_prices = [stock["buy_price"] for stock in BATCH_STOCKS_CONFIG]
        quantities = [stock["quantity"] for stock in BATCH_STOCKS_CONFIG]

        batch_mode(stock_codes, buy_prices, quantities)

    elif RUN_MODE == "demo":
        # Demo mode
        demo()
    else:
        print(f"Error: Unknown run mode: {RUN_MODE}")
        print("Please modify RUN_MODE to 'single', 'batch' or 'demo'")

    print("\n" + "="*60)
    print("Configuration mode run completed!")
    print("="*60)


def demo():
    """演示脚本功能，直接在代码中设置参数示例"""
    print("="*60)
    print("A股实时股价查询及盈亏计算 - 演示模式")
    print("="*60)

    # 示例1：单股票查询
    print("\n1. 单股票查询示例:")
    print("-"*40)

    # 直接在代码中设置参数
    stock_code = "600000"  # 浦发银行
    buy_price = 10.5       # 买入价格
    quantity = 100         # 买入数量

    print(f"股票代码: {stock_code}")
    print(f"买入价格: {buy_price}")
    print(f"买入数量: {quantity}")

    current_price, stock_name = get_real_time_price(stock_code)
    if current_price is not None:
        display_stock_info(stock_code, stock_name, current_price)
        profit_amount, profit_percent = calculate_profit(current_price, buy_price, quantity)
        display_profit_info(buy_price, quantity, profit_amount, profit_percent)

    # 示例2：另一只股票
    print("\n\n2. 创业板股票示例:")
    print("-"*40)

    stock_code2 = "300750"  # 宁德时代
    buy_price2 = 200.0
    quantity2 = 50

    print(f"股票代码: {stock_code2}")
    print(f"买入价格: {buy_price2}")
    print(f"买入数量: {quantity2}")

    current_price2, stock_name2 = get_real_time_price(stock_code2)
    if current_price2 is not None:
        display_stock_info(stock_code2, stock_name2, current_price2)
        profit_amount2, profit_percent2 = calculate_profit(current_price2, buy_price2, quantity2)
        display_profit_info(buy_price2, quantity2, profit_amount2, profit_percent2)

    # 示例3：批量查询演示
    print("\n\n3. 批量查询示例:")
    print("-"*40)

    stock_codes = ["600000", "000001", "300750"]
    buy_prices = [10.5, 15.2, 200.0]
    quantities = [100, 200, 50]

    print(f"股票列表: {', '.join(stock_codes)}")
    print(f"买入价格: {buy_prices}")
    print(f"买入数量: {quantities}")

    batch_mode(stock_codes, buy_prices, quantities)

    print("\n" + "="*60)
    print("演示结束！")
    print("="*60)


def main():
    # 检查是否有可用的数据源
    if not HAS_AKSHARE and not HAS_REQUESTS:
        print("错误: 没有可用的数据源库")
        print("请至少安装以下库之一：")
        print("1. akshare: pip install akshare pandas")
        print("2. requests: pip install requests")
        print("\n推荐安装akshare，数据更全面：pip install akshare pandas")
        sys.exit(1)

    parser = argparse.ArgumentParser(
        description='A股实时股价查询及盈亏计算',
        epilog='''
使用示例：
  python stock_profit_calculator.py                     # 使用配置模式（编辑脚本顶部配置）
  python stock_profit_calculator.py -c 600000           # 查询单股票
  python stock_profit_calculator.py -c 600000 -b 10.5 -q 100  # 带买入参数
  python stock_profit_calculator.py -f stocks.txt       # 批量查询
  python stock_profit_calculator.py -i                  # 交互式模式
  python stock_profit_calculator.py -d                  # 演示模式
        ''',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('-c', '--code', help='股票代码，例如: 600000')
    parser.add_argument('-b', '--buy-price', type=float, help='买入价格')
    parser.add_argument('-q', '--quantity', type=int, default=100, help='买入数量，默认100')
    parser.add_argument('-f', '--file', help='批量模式文件，每行格式: 代码,买入价,数量（后两者可选）')
    parser.add_argument('-i', '--interactive', action='store_true', help='交互式模式')
    parser.add_argument('-d', '--demo', action='store_true', help='演示模式：直接在代码中查看示例')
    parser.add_argument('--config', action='store_true', help='使用脚本顶部的配置参数运行')

    args = parser.parse_args()

    # 检查是否提供了任何参数
    has_args = any([args.code, args.file, args.interactive, args.demo, args.config])

    if args.demo:
        # 演示模式
        demo()
    elif args.config:
        # 配置模式
        config_mode()
    elif args.interactive:
        # 交互式模式（需要明确指定 -i）
        interactive_mode()
    elif args.file:
        # 批量模式
        try:
            stock_codes = []
            buy_prices = []
            quantities = []

            with open(args.file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue

                    parts = line.split(',')
                    stock_codes.append(parts[0].strip())

                    if len(parts) > 1 and parts[1].strip():
                        buy_prices.append(float(parts[1].strip()))

                    if len(parts) > 2 and parts[2].strip():
                        quantities.append(int(parts[2].strip()))

            if not stock_codes:
                print("文件中没有有效的股票代码")
                return

            batch_mode(stock_codes,
                      buy_prices if buy_prices else None,
                      quantities if quantities else None)

        except FileNotFoundError:
            print(f"文件不存在: {args.file}")
        except Exception as e:
            print(f"读取文件时出错: {e}")
    elif args.code:
        # 单股票模式
        current_price, stock_name = get_real_time_price(args.code)
        if current_price is None:
            print(f"获取股票 {args.code} 价格失败")
            return

        buy_price = args.buy_price if args.buy_price else current_price
        quantity = args.quantity

        display_stock_info(args.code, stock_name, current_price)

        profit_amount, profit_percent = calculate_profit(current_price, buy_price, quantity)

        display_profit_info(buy_price, quantity, profit_amount, profit_percent)
    elif not has_args:
        # 没有任何参数，使用配置模式
        config_mode()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()