const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4096;
const PUBLIC_DIR = __dirname;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((request, response) => {
    console.log(`[${new Date().toLocaleTimeString()}] HTTP Request: ${request.url}`);

    // Parse URL to ignore query strings like ?v=2
    const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    let pathname = parsedUrl.pathname;

    // Default to game hub
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Get the file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    let contentType = mimeTypes[extname] || 'application/octet-stream';

    // Read the file and serve
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                console.error(`404 File Not Found: ${filePath}`);
                response.writeHead(404, { 'Content-Type': 'text/html' });
                response.end("<h1>404 Not Found</h1><p>The requested file does not exist.</p>", 'utf-8');
            } else {
                console.error(`500 Server Error: ${error.code}`);
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            // Set cache headers to help with game assets but allow fresh reloads
            response.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, must-revalidate'
            });
            response.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🎮 Voidman's Game Hub is running at: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
    console.log(`Serving games from: ${PUBLIC_DIR}`);
    console.log(`Press Ctrl+C to stop the server.\n`);
});
