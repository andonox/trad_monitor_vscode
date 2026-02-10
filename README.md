# TRAD Stock Monitor VSCode Extension

Real-time A-share stock profit/loss monitoring extension for Visual Studio Code.

## Features

- Real-time stock price monitoring (20-second intervals)
- Profit/loss calculation based on purchase price and quantity
- Configuration management for multiple stocks
- Start/stop monitoring control
- TreeView display in sidebar
- Status bar integration

## Requirements

- VSCode 1.60.0 or higher
- Python 3.8+ with dependencies:
  - akshare>=1.18.22 (recommended)
  - pandas>=1.3.0
  - requests>=2.26.0
  - aiohttp>=3.8.0

## Installation

1. Install Python dependencies:
   ```bash
   pip install akshare pandas requests aiohttp
   ```

2. Install the extension in VSCode.

## Usage

1. Open the TRAD Stock Monitor view in the sidebar.
2. Click the gear icon to configure stocks.
3. Add stocks with code, purchase price, and quantity.
4. Click "Start Monitoring" to begin real-time updates.

## Configuration

Configuration is stored in `~/.trad/config.json`.

Example configuration:
```json
{
  "version": "1.0.0",
  "stocks": [
    {
      "code": "600000",
      "name": "浦发银行",
      "buyPrice": 10.5,
      "quantity": 100,
      "enabled": true
    }
  ],
  "settings": {
    "updateInterval": 20,
    "autoStart": false,
    "showNotifications": true,
    "priceAlertThreshold": 5.0,
    "dataSourcePriority": "sina"
  }
}
```

## Development

See [DESIGN.md](./DESIGN.md) for detailed architecture and implementation details.

## License

MIT
