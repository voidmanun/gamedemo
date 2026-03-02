const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const winScreen = document.getElementById('winScreen');
const gameOverText = document.querySelector('#gameOverScreen p');

let width, height;
let dpr = window.devicePixelRatio || 1;

let gameState = 'start'; // start, playing, gameover, win

let originalPathPoints = [];
let pathPoints = [];
let path2D;

let player = {
    x: 0,
    y: 0,
    baseColor: '#3498db',
    color: '#3498db'
};

let baseRadius = 10;
let playerRadius;

let basePathWidth = 30;
let PATH_WIDTH = 0;
let BORDER_WIDTH = 0;
let SAFE_WIDTH = 0;

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    // We intentionally DO NOT use ctx.scale(dpr, dpr) so we can be 100% physically accurate
}

window.addEventListener('resize', () => {
    resize();
    if (gameState === 'start' || gameState === 'playing') {
        initGame();
    }
});

function initGame() {
    // scale widths relative to screen width, but keep reasonable bounds
    basePathWidth = Math.max(30, Math.min(55, width * 0.12));

    PATH_WIDTH = basePathWidth * dpr;
    BORDER_WIDTH = PATH_WIDTH + 15 * dpr; // 7.5px border each side physically

    // Player physical radius
    playerRadius = baseRadius * dpr;
    SAFE_WIDTH = PATH_WIDTH - playerRadius * 1.5; // slight tolerance

    // Super complex winding path
    originalPathPoints = [
        { x: width * 0.8, y: height * 0.92 },
        { x: width * 0.8, y: height * 0.83 },
        { x: width * 0.2, y: height * 0.83 },
        { x: width * 0.2, y: height * 0.74 },
        { x: width * 0.8, y: height * 0.74 },
        { x: width * 0.8, y: height * 0.65 },
        { x: width * 0.4, y: height * 0.65 },
        { x: width * 0.4, y: height * 0.56 },
        { x: width * 0.2, y: height * 0.56 },
        { x: width * 0.2, y: height * 0.47 },
        { x: width * 0.8, y: height * 0.47 },
        { x: width * 0.8, y: height * 0.38 },
        { x: width * 0.5, y: height * 0.38 },
        { x: width * 0.5, y: height * 0.29 },
        { x: width * 0.2, y: height * 0.29 },
        { x: width * 0.2, y: height * 0.20 },
        { x: width * 0.8, y: height * 0.20 },
        { x: width * 0.8, y: height * 0.10 },
    ];

    // Convert to physical coords
    pathPoints = originalPathPoints.map(p => ({
        x: p.x * dpr,
        y: p.y * dpr
    }));

    path2D = new Path2D();
    if (pathPoints.length > 0) {
        path2D.moveTo(pathPoints[0].x, pathPoints[0].y);
        for (let i = 1; i < pathPoints.length; i++) {
            path2D.lineTo(pathPoints[i].x, pathPoints[i].y);
        }
    }

    resetPlayer();

    draw();
}

function resetPlayer() {
    if (pathPoints.length > 0) {
        player.x = pathPoints[0].x;
        player.y = pathPoints[0].y;
        player.color = player.baseColor;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background 
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw path border (red)
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = BORDER_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path2D);

    // Draw safe path (gray)
    ctx.strokeStyle = '#d2dae2';
    ctx.lineWidth = PATH_WIDTH;
    ctx.stroke(path2D);

    // Draw start area
    ctx.beginPath();
    ctx.arc(pathPoints[0].x, pathPoints[0].y, PATH_WIDTH / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#2ecc71';
    ctx.fill();
    ctx.closePath();

    // Draw end area
    ctx.beginPath();
    ctx.arc(pathPoints[pathPoints.length - 1].x, pathPoints[pathPoints.length - 1].y, PATH_WIDTH / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#f1c40f';
    ctx.fill();
    ctx.closePath();

    // Draw text on start and end
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${16 * dpr}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Start', pathPoints[0].x, pathPoints[0].y);

    ctx.fillStyle = '#2c3e50';
    ctx.fillText('End', pathPoints[pathPoints.length - 1].x, pathPoints[pathPoints.length - 1].y);

    // Draw Player
    ctx.beginPath();
    ctx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    // highlight player
    ctx.lineWidth = 3 * dpr;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.closePath();
}

let lastTime = 0;
let animationFrameId;

function update(time) {
    if (gameState !== 'playing') return;

    let dt = lastTime ? (time - lastTime) : 16;
    if (dt > 100) dt = 16;
    lastTime = time;

    // Check win condition (reached end area)
    const endPoint = pathPoints[pathPoints.length - 1];
    const endDist = Math.hypot(player.x - endPoint.x, player.y - endPoint.y);
    if (endDist < PATH_WIDTH / 2) {
        win();
        return;
    }

    draw();
    animationFrameId = requestAnimationFrame(update);
}

// Drag & touch handling
let isDragging = false;
let pointerId = null;

function handleDragStart(clientX, clientY, pId) {
    if (gameState === 'start') {
        // Automatically start game if they tap on start screen outside of button
        return;
    }
    if (gameState !== 'playing') return;

    const physX = clientX * dpr;
    const physY = clientY * dpr;

    const dist = Math.hypot(physX - player.x, physY - player.y);
    if (dist <= Math.max(playerRadius * 3, 50 * dpr)) {
        isDragging = true;
        pointerId = pId;
        player.color = '#2980b9'; // darker when dragging
        draw(); // immediate feedback
    }
}

function handleDragMove(clientX, clientY, pId) {
    if (!isDragging || gameState !== 'playing' || pointerId !== pId) return;

    const physX = clientX * dpr;
    const physY = clientY * dpr;

    const dist = Math.hypot(physX - player.x, physY - player.y);
    const steps = Math.max(1, Math.ceil(dist / (4 * dpr))); // check every 4 physical px

    ctx.lineWidth = SAFE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i <= steps; i++) {
        const cx = player.x + (physX - player.x) * (i / steps);
        const cy = player.y + (physY - player.y) * (i / steps);

        if (!ctx.isPointInStroke(path2D, cx, cy)) {
            // Out of bounds
            player.x = cx;
            player.y = cy;
            die('你碰到了红色的死亡边界！');
            return;
        }
    }

    player.x = physX;
    player.y = physY;
}

function handleDragEnd(pId) {
    if (pointerId === pId) {
        isDragging = false;
        pointerId = null;
        player.color = player.baseColor;
    }
}

// Support both mouse and touch using modern unified events
canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (e.isPrimary) {
        handleDragStart(e.clientX, e.clientY, e.pointerId);
    }
});

canvas.addEventListener('pointermove', e => {
    e.preventDefault();
    if (e.isPrimary) {
        handleDragMove(e.clientX, e.clientY, e.pointerId);
    }
});

canvas.addEventListener('pointerup', e => {
    e.preventDefault();
    if (e.isPrimary) handleDragEnd(e.pointerId);
});

canvas.addEventListener('pointercancel', e => {
    e.preventDefault();
    if (e.isPrimary) handleDragEnd(e.pointerId);
});

// Polyfill for strict touch environments to prevent scrolling
canvas.addEventListener('touchstart', e => { e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); }, { passive: false });


function startGame() {
    resetPlayer();
    gameState = 'playing';
    startScreen.style.display = 'none';
    lastTime = 0;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(update);
}

function die(reason) {
    gameState = 'gameover';
    if (gameOverText) gameOverText.innerText = reason;
    gameOverScreen.style.display = 'flex';
    draw(); // Draw one last time to show where you died
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
}

function win() {
    gameState = 'win';
    winScreen.style.display = 'flex';
    draw();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
}

function showStartScreen() {
    resetPlayer();
    initGame();
    gameState = 'start';
    startScreen.style.display = 'flex';
    gameOverScreen.style.display = 'none';
    winScreen.style.display = 'none';
}

document.querySelectorAll('.restart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        gameOverScreen.style.display = 'none';
        winScreen.style.display = 'none';
        showStartScreen();
    });
});

document.querySelectorAll('.start-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        startGame();
    });
});

// Initialize on load
resize();
showStartScreen();
