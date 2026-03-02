const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const mainMenu = document.getElementById('main-menu');
const gameOverPanel = document.getElementById('game-over-panel');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const vehicleBtns = document.querySelectorAll('.vehicle-btn');
const colorBtns = document.querySelectorAll('.color-btn');

// Score Elements
const currentScoreEl = document.getElementById('current-score');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');

// Game State
let gameState = 'menu'; // menu, playing, gameover
let w = window.innerWidth;
let h = window.innerHeight;
// Limit width to 600px
if (w > 600) w = 600;

let lastTime = 0;
let score = 0;
let bestScore = localStorage.getItem('doodleBestScore') || 0;

// Player Settings from UI
let selectedVehicle = 'car';
let selectedColor = '#3498db';

// --- Game Objects ---

const player = {
    x: w / 2,
    y: h * 0.8,
    width: 40,
    height: 60,
    speed: 0, // Horizontal speed
    maxSpeed: 300, // px per second
    acceleration: 800,
    friction: 0.9,
    baseY: h * 0.8  // The Y position stays mostly fixed in view
};

// Track generation
const trackLines = [];
const numTrackSegments = 30;
const segmentHeight = h / (numTrackSegments - 10);
let trackOffsetY = 0;
let trackBaseX = w / 2;
let trackWidth = w * 0.6;
let curveTrend = 0;
let curvePhase = 0;
// Track speed (how fast road moves down)
let gameSpeed = 300;

// Entities (Obstacles & Collectibles)
let entities = [];


// --- Initialization ---

function resize() {
    w = window.innerWidth;
    if (w > 600) w = 600;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    player.baseY = h * 0.8;
}
window.addEventListener('resize', resize);
resize();


// --- Input Handling ---

let isTouchingLeft = false;
let isTouchingRight = false;

// Touch events for the screen halves
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd);
canvas.addEventListener('touchcancel', handleTouchEnd);

function handleTouchStart(e) {
    if (gameState !== 'playing') return;
    e.preventDefault();
    updateTouchParams(e.touches);
}
function handleTouchMove(e) {
    if (gameState !== 'playing') return;
    e.preventDefault();
    updateTouchParams(e.touches);
}
function handleTouchEnd(e) {
    if (gameState !== 'playing') return;
    updateTouchParams(e.touches);
}
function updateTouchParams(touches) {
    isTouchingLeft = false;
    isTouchingRight = false;
    for (let i = 0; i < touches.length; i++) {
        let tx = touches[i].clientX;
        // Adjust tx if game container is centered and window > 600
        let containerRect = canvas.getBoundingClientRect();
        let relX = tx - containerRect.left;

        if (relX < w / 2) {
            isTouchingLeft = true;
        } else {
            isTouchingRight = true;
        }
    }
}

// Keyboard for testing on PC
window.addEventListener('keydown', (e) => {
    if (gameState !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key === 'a') isTouchingLeft = true;
    if (e.key === 'ArrowRight' || e.key === 'd') isTouchingRight = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') isTouchingLeft = false;
    if (e.key === 'ArrowRight' || e.key === 'd') isTouchingRight = false;
});


// --- UI Event Listeners ---

vehicleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        vehicleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedVehicle = btn.dataset.vehicle;
    });
});

colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedColor = btn.dataset.color;
    });
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
menuBtn.addEventListener('click', showMenu);

function showMenu() {
    gameState = 'menu';
    gameOverPanel.classList.add('hidden');
    hud.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    // Clear canvas
    ctx.clearRect(0, 0, w, h);
}


// --- Game Logic ---

function startGame() {
    gameState = 'playing';
    mainMenu.classList.add('hidden');
    gameOverPanel.classList.add('hidden');
    hud.classList.remove('hidden');

    score = 0;
    currentScoreEl.innerText = score;
    gameSpeed = 300;

    player.x = w / 2;
    player.y = player.baseY;
    player.speed = 0;
    player.width = getVehicleDimensions(selectedVehicle).w;
    player.height = getVehicleDimensions(selectedVehicle).h;

    initTrack();
    entities = [];

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function getVehicleDimensions(vType) {
    switch (vType) {
        case 'bike': return { w: 30, h: 50 };
        case 'ufo': return { w: 60, h: 50 };
        case 'rabbit': return { w: 40, h: 40 };
        case 'car':
        default: return { w: 45, h: 65 };
    }
}

function initTrack() {
    trackLines.length = 0;
    for (let i = 0; i < numTrackSegments; i++) {
        trackLines.push({
            x: w / 2,
            y: h - i * segmentHeight
        });
    }
    trackOffsetY = 0;
    trackBaseX = w / 2;
    curvePhase = 0;
    curveTrend = 0;
}

function gameOver() {
    gameState = 'gameover';
    hud.classList.add('hidden');
    gameOverPanel.classList.remove('hidden');

    finalScoreEl.innerText = Math.floor(score);
    if (score > bestScore) {
        bestScore = Math.floor(score);
        localStorage.setItem('doodleBestScore', bestScore);
    }
    bestScoreEl.innerText = bestScore;
}

// --- Main Loop ---

function gameLoop(timestamp) {
    if (gameState !== 'playing') return;

    let dt = (timestamp - lastTime) / 1000;
    // cap dt to prevent big jumps on tab switch
    if (dt > 0.1) dt = 0.1;
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}


function update(dt) {
    // 1. Update Player position based on input
    if (isTouchingLeft) {
        player.speed -= player.acceleration * dt;
    } else if (isTouchingRight) {
        player.speed += player.acceleration * dt;
    } else {
        // Friction
        player.speed *= player.friction;
    }

    // clamp speed
    if (player.speed > player.maxSpeed) player.speed = player.maxSpeed;
    if (player.speed < -player.maxSpeed) player.speed = -player.maxSpeed;

    player.x += player.speed * dt;


    // 2. Update Track
    gameSpeed += dt * 5; // Gradually increase speed
    let moveDist = gameSpeed * dt;
    trackOffsetY += moveDist;

    // Increase score based on distance
    score += moveDist * 0.05;
    currentScoreEl.innerText = Math.floor(score);

    while (trackOffsetY >= segmentHeight) {
        trackOffsetY -= segmentHeight;

        // Remove bottom segment
        trackLines.shift();

        // Generate new top segment
        let lastNode = trackLines[trackLines.length - 1];

        curvePhase += 0.05;
        // Perlin noise like random wander
        if (Math.random() < 0.05) {
            curveTrend = (Math.random() - 0.5) * 6;
        }

        trackBaseX += curveTrend + Math.sin(curvePhase) * 5;

        // Constrain track to screen
        let halfTrack = trackWidth / 2;
        if (trackBaseX < halfTrack + 10) trackBaseX = halfTrack + 10;
        if (trackBaseX > w - halfTrack - 10) trackBaseX = w - halfTrack - 10;

        trackLines.push({
            x: trackBaseX,
            y: lastNode.y - segmentHeight // Will be translated in draw
        });

        // Update Y for all segments so they remain relative to screen
        for (let i = 0; i < trackLines.length; i++) {
            trackLines[i].y += segmentHeight;
        }

        // Chance to spawn entity at the new segment
        spawnEntity(trackLines[trackLines.length - 1]);
    }


    // 3. Keep player roughly in bounds of the local track segment
    // Find the track segment closest to player Y
    let closestSegLineIndex = 0;
    for (let i = 0; i < trackLines.length - 1; i++) {
        if (trackLines[i].y >= player.y && trackLines[i + 1].y <= player.y) {
            closestSegLineIndex = i;
            break;
        }
    }
    let pNode = trackLines[closestSegLineIndex];
    if (pNode) {
        // Simple bounding bounds (grass collision)
        let leftBound = pNode.x - trackWidth / 2;
        let rightBound = pNode.x + trackWidth / 2;

        // If player hits grass, slow down heavily or maybe end game
        if (player.x - player.width / 2 < leftBound || player.x + player.width / 2 > rightBound) {
            // Option 1: Game Over on Grass
            // gameOver();
            // Option 2: Just constrain and slow down
            if (player.x - player.width / 2 < leftBound) player.x = leftBound + player.width / 2;
            if (player.x + player.width / 2 > rightBound) player.x = rightBound - player.width / 2;
            player.speed *= 0.8;
            score -= dt * 5; // penalty
            if (score < 0) score = 0;
        }
    }


    // 4. Update Entities
    for (let i = entities.length - 1; i >= 0; i--) {
        let ent = entities[i];
        ent.y += moveDist;

        // Collision Detection
        if (!ent.collected &&
            player.x < ent.x + ent.size &&
            player.x + player.width > ent.x - ent.size &&
            player.y < ent.y + ent.size &&
            player.y + player.height > ent.y - ent.size) {

            if (ent.type === 'cone') {
                gameOver();
                return;
            } else if (ent.type === 'star') {
                score += 50;
                ent.collected = true;
                // Add pop animation effect later
            } else if (ent.type === 'circle' || ent.type === 'rect') {
                score += 10;
                ent.collected = true;
            }
        }

        // Remove if off screen bottom
        if (ent.y > h + 50 || ent.collected) {
            entities.splice(i, 1);
        }
    }
}

function spawnEntity(trackNode) {
    if (Math.random() > 0.15) return; // 15% chance per segment

    // Local relative X offset on the road
    let xOffset = (Math.random() - 0.5) * (trackWidth - 40);

    let typeRand = Math.random();
    let type = 'cone';
    let size = 15;

    if (typeRand < 0.3) {
        type = 'star';
        size = 20;
    } else if (typeRand < 0.5) {
        type = 'circle';
        size = 15;
    } else if (typeRand < 0.6) {
        type = 'rect';
        size = 15;
    } else {
        type = 'cone';
        size = 18;
    }

    entities.push({
        x: trackNode.x + xOffset,
        y: trackNode.y,
        type: type,
        size: size,
        collected: false
    });
}

// --- Rendering ---

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, w, h);
    
    // Draw background grid lines (doodle style)
    drawBackgroundGrid();

    // Draw Track
    drawTrack();

    // Draw Entities
    for (let ent of entities) {
        if (!ent.collected) {
            drawEntity(ent);
        }
    }

    // Draw Player
    drawPlayer();
}

function drawBackgroundGrid() {
    ctx.save();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    // slightly wavy lines
    for(let i=0; i<w; i+=40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + Math.sin(Date.now() / 1000 + i) * 2, h);
        ctx.stroke();
    }
    for(let i=0; i<h; i+=40) {
        ctx.beginPath();
        let yOffset = (trackOffsetY % 40);
        ctx.moveTo(0, i + yOffset);
        ctx.lineTo(w, i + yOffset + Math.cos(Date.now() / 1000 + i) * 2);
        ctx.stroke();
    }
    ctx.restore();
}

function drawTrack() {
    if (trackLines.length < 2) return;
    
    ctx.save();
    
    // Fill road
    ctx.beginPath();
    ctx.moveTo(trackLines[0].x - trackWidth/2, trackLines[0].y);
    for(let i=1; i<trackLines.length; i++) {
        ctx.lineTo(trackLines[i].x - trackWidth/2, trackLines[i].y);
    }
    for(let i=trackLines.length-1; i>=0; i--) {
        ctx.lineTo(trackLines[i].x + trackWidth/2, trackLines[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    
    // Draw road borders (doodle thick lines)
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2c3e50';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Left border
    ctx.beginPath();
    ctx.moveTo(trackLines[0].x - trackWidth/2, trackLines[0].y);
    for(let i=1; i<trackLines.length; i++) {
        // Add some jitter for doodle feel
        let jitterX = (Math.random() - 0.5) * 4;
        ctx.lineTo(trackLines[i].x - trackWidth/2 + jitterX, trackLines[i].y);
    }
    ctx.stroke();
    
    // Right border
    ctx.beginPath();
    ctx.moveTo(trackLines[0].x + trackWidth/2, trackLines[0].y);
    for(let i=1; i<trackLines.length; i++) {
        let jitterX = (Math.random() - 0.5) * 4;
        ctx.lineTo(trackLines[i].x + trackWidth/2 + jitterX, trackLines[i].y);
    }
    ctx.stroke();
    
    // Draw center dashed line
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#95a5a6';
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.moveTo(trackLines[0].x, trackLines[0].y);
    for(let i=1; i<trackLines.length; i++) {
        // Add jitter
        let jitterX = (Math.random() - 0.5) * 2;
        ctx.lineTo(trackLines[i].x + jitterX, trackLines[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.restore();
}

function drawEntity(ent) {
    ctx.save();
    ctx.translate(ent.x, ent.y);
    
    // Rotate slightly for animation
    if(ent.type !== 'cone') {
        ctx.rotate(Date.now() / 500);
    }
    
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (ent.type === 'cone') {
        // Draw Triangle Cone
        ctx.strokeStyle = '#d35400';
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.moveTo(0, -ent.size);
        ctx.lineTo(ent.size, ent.size);
        ctx.lineTo(-ent.size, ent.size);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Stripes
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-ent.size * 0.5, 0);
        ctx.lineTo(ent.size * 0.5, 0);
        ctx.stroke();
        
    } else if (ent.type === 'star') {
        // Draw Star
        ctx.strokeStyle = '#f39c12';
        ctx.fillStyle = '#f1c40f';
        drawStarPath(ctx, 0, 0, 5, ent.size, ent.size/2);
        ctx.fill();
        ctx.stroke();
        
    } else if (ent.type === 'circle') {
        // Draw Circle
        ctx.strokeStyle = '#2980b9';
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(0, 0, ent.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
    } else if (ent.type === 'rect') {
        // Draw Rect
        ctx.strokeStyle = '#8e44ad';
        ctx.fillStyle = '#9b59b6';
        ctx.fillRect(-ent.size, -ent.size, ent.size * 2, ent.size * 2);
        ctx.strokeRect(-ent.size, -ent.size, ent.size * 2, ent.size * 2);
    }
    
    ctx.restore();
}

function drawStarPath(ctx, x, y, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x_pos = x;
    let y_pos = y;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(x, y - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x_pos = x + Math.cos(rot) * outerRadius;
        y_pos = y + Math.sin(rot) * outerRadius;
        ctx.lineTo(x_pos, y_pos);
        rot += step;

        x_pos = x + Math.cos(rot) * innerRadius;
        y_pos = y + Math.sin(rot) * innerRadius;
        ctx.lineTo(x_pos, y_pos);
        rot += step;
    }
    ctx.lineTo(x, y - outerRadius);
    ctx.closePath();
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Tilt based on speed / turning
    let tilt = player.speed / player.maxSpeed * 0.2; // roughly +/- 0.2 radians
    ctx.rotate(tilt);
    
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2c3e50';
    
    // Draw vehicle
    if (selectedVehicle === 'car') {
        drawCar();
    } else if (selectedVehicle === 'bike') {
        drawBike();
    } else if (selectedVehicle === 'ufo') {
        drawUFO();
    } else if (selectedVehicle === 'rabbit') {
        drawRabbit();
    }
    
    ctx.restore();
}

// --- Specific Vehicle Renderers ---

function drawCar() {
    let w = player.width;
    let h = player.height;
    
    // Wheels
    ctx.fillStyle = '#333';
    ctx.fillRect(-w/2 - 5, -h/2 + 10, 8, 15);
    ctx.fillRect(w/2 - 3, -h/2 + 10, 8, 15);
    ctx.fillRect(-w/2 - 5, h/2 - 25, 8, 15);
    ctx.fillRect(w/2 - 3, h/2 - 25, 8, 15);
    
    // Body
    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 10);
    ctx.fill();
    ctx.stroke();
    
    // Windows
    ctx.fillStyle = '#aaddff';
    ctx.beginPath();
    ctx.roundRect(-w/2 + 5, -h/2 + 15, w - 10, 20, 5);
    ctx.fill();
    ctx.stroke();
    
    // Doodle headlights
    ctx.fillStyle = '#fff000';
    ctx.beginPath();
    ctx.arc(-w/2 + 10, -h/2 + 5, 5, 0, Math.PI*2);
    ctx.arc(w/2 - 10, -h/2 + 5, 5, 0, Math.PI*2);
    ctx.fill();
}

function drawBike() {
    let w = player.width;
    let h = player.height;
    
    // Wheels
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -h/2 + 10, 12, 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, h/2 - 10, 12, 0, Math.PI*2);
    ctx.stroke();
    
    // Frame
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -h/2 + 10);
    ctx.lineTo(0, h/2 - 10);
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    
    // Handlebars
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(-15, -h/2 + 5);
    ctx.lineTo(15, -h/2 + 5);
    ctx.stroke();
}

function drawUFO() {
    let w = player.width;
    let h = player.height;
    
    // Glass dome
    ctx.fillStyle = 'rgba(170, 221, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(0, -5, 18, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    
    // Body saucer
    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, w/2, 15, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    
    // Lights
    let time = Date.now() / 200;
    let lights = [-20, 0, 20];
    for (let i=0; i<lights.length; i++) {
        ctx.fillStyle = (Math.sin(time + i) > 0) ? '#f1c40f' : '#e74c3c';
        ctx.beginPath();
        ctx.arc(lights[i], 0, 4, 0, Math.PI*2);
        ctx.fill();
    }
}

function drawRabbit() {
    // Top-down rabbit doodle
    let w = player.width;
    let h = player.height;
    
    ctx.fillStyle = selectedColor;
    
    // Ears
    let earFlap = Math.sin(Date.now() / 100) * 0.1; // flapping ears
    ctx.save();
    ctx.translate(-10, -15);
    ctx.rotate(-0.2 + earFlap);
    ctx.beginPath();
    ctx.ellipse(0, -15, 6, 15, 0, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    
    ctx.save();
    ctx.translate(10, -15);
    ctx.rotate(0.2 - earFlap);
    ctx.beginPath();
    ctx.ellipse(0, -15, 6, 15, 0, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 10, 18, 22, 0, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    
    // Head
    ctx.beginPath();
    ctx.arc(0, -10, 15, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    
    // Tail
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 32, 6, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
}
