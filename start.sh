#!/bin/bash
# 启动所有游戏的脚本

echo "Stopping existing Game Hub servers (Port 4096)..."
# Kill any process listening on port 4096
lsof -ti:4096 | xargs kill -9 2>/dev/null
# Defensively kill matching script names
pkill -f "node start_games.js" 2>/dev/null
pkill -f "python3 -m http.server 4096" 2>/dev/null

echo "Starting Voidman's Game Hub..."
cd "$(dirname "$0")"

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null
then
    echo "This script requires Node.js. Starting fallback Python server on port 4096..."
    python3 -m http.server 4096
    exit
fi

# 运行专门的 Node 服务器
node start_games.js
