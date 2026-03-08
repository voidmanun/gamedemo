#!/bin/bash
# 启动所有游戏的脚本

echo "Starting Voidman's Game Hub..."
cd "$(dirname "$0")"

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null
then
    echo "This script requires Node.js. Starting fallback Python server on port 3000..."
    python3 -m http.server 4096
    exit
fi

# 运行专门的 Node 服务器
node start_games.js
