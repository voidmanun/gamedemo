/**
 * Block World Survival - Core Game Logic
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Constants
const TILE_SIZE = 50;
const MAP_COLS = 50;
const MAP_ROWS = 50;

const TILES = {
    GRASS: 0,
    TREE: 1,
    STONE: 2
};

const TILE_COLORS = {
    [TILES.GRASS]: '#2ecc71', // Green
    [TILES.TREE]: '#27ae60',  // Darker Green
    [TILES.STONE]: '#7f8c8d'  // Gray
};

const SOLID_TILES = [TILES.TREE, TILES.STONE];

// World Generation
const WORLD = [];
for (let y = 0; y < MAP_ROWS; y++) {
    const row = [];
    for (let x = 0; x < MAP_COLS; x++) {
        if (Math.random() < 0.1) row.push(TILES.STONE);
        else if (Math.random() < 0.2) row.push(TILES.TREE);
        else row.push(TILES.GRASS);
    }
    WORLD.push(row);
}

// Visual Effects
const PARTICLES = [];

function spawnDamageNumber(x, y, amount, isPlayerDamage = false) {
    PARTICLES.push({
        x: x,
        y: y - 20,
        text: `-${amount}`,
        life: 1.0,
        color: isPlayerDamage ? '#e74c3c' : '#f1c40f',
        vy: -30
    });
}

// Entities
const PLAYER = {
    x: MAP_COLS * TILE_SIZE / 2,
    y: MAP_ROWS * TILE_SIZE / 2,
    width: 30,
    height: 30,
    speed: 250,
    hp: 100,
    maxHp: 100,
    inventory: { wood: 0 },
    equipped: null, // 'sword'
    color: '#3498db', // Blue player
    flashTime: 0
};

const MONSTERS = [];
const MONSTER_SPEED = 120;
const MONSTER_DAMAGE = 15;
const MONSTER_HP = 30;

function fixSpawn() {
    let tX = Math.floor(PLAYER.x / TILE_SIZE);
    let tY = Math.floor(PLAYER.y / TILE_SIZE);

    // search for nearest grass
    for (let radius = 0; radius < 10; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const checkX = tX + dx;
                const checkY = tY + dy;
                if (checkX >= 0 && checkX < MAP_COLS && checkY >= 0 && checkY < MAP_ROWS) {
                    if (WORLD[checkY][checkX] === TILES.GRASS) {
                        PLAYER.x = checkX * TILE_SIZE + TILE_SIZE / 2;
                        PLAYER.y = checkY * TILE_SIZE + TILE_SIZE / 2;
                        return;
                    }
                }
            }
        }
    }
}
fixSpawn();

function spawnMonster() {
    for (let i = 0; i < 50; i++) { // Max 50 attempts
        let tX = Math.floor(Math.random() * MAP_COLS);
        let tY = Math.floor(Math.random() * MAP_ROWS);
        if (WORLD[tY][tX] === TILES.GRASS) {
            let x = tX * TILE_SIZE + TILE_SIZE / 2;
            let y = tY * TILE_SIZE + TILE_SIZE / 2;
            // Don't spawn too close to player
            if (Math.hypot(x - PLAYER.x, y - PLAYER.y) > 400) {
                MONSTERS.push({
                    x, y,
                    width: 30, height: 30,
                    speed: MONSTER_SPEED,
                    hp: MONSTER_HP,
                    maxHp: MONSTER_HP,
                    color: '#e74c3c',
                    lastAttackTime: 0,
                    flashTime: 0
                });
                return;
            }
        }
    }
}

// Initial monsters
for (let i = 0; i < 15; i++) spawnMonster();

const CAMERA = {
    x: 0,
    y: 0
};

// Game State
const GAME = {
    state: 'PLAYING', // PLAYING, GAMEOVER
    lastTime: performance.now(),
    deltaTime: 0,
};

// Input State
const INPUT = {
    joystick: {
        active: false,
        originX: 0,
        originY: 0,
        dirX: 0,
        dirY: 0
    },
    action: false,
    keys: {}
};

// Keyboard support for desktop testing
window.addEventListener('keydown', (e) => INPUT.keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => INPUT.keys[e.key.toLowerCase()] = false);

// Resize Canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Joystick Logic
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');

joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (GAME.state !== 'PLAYING') return;
    const touch = e.changedTouches[0];
    INPUT.joystick.active = true;
    INPUT.joystick.originX = touch.clientX;
    INPUT.joystick.originY = touch.clientY;

    joystickBase.style.display = 'block';
    joystickBase.style.left = (touch.clientX - 60) + 'px';
    joystickBase.style.top = (touch.clientY - 60) + 'px';

    updateJoystickStick(touch.clientX, touch.clientY);
}, { passive: false });

joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!INPUT.joystick.active) return;
    const touch = e.changedTouches[0];
    updateJoystickStick(touch.clientX, touch.clientY);
}, { passive: false });

const endTouch = (e) => {
    e.preventDefault();
    INPUT.joystick.active = false;
    joystickBase.style.display = 'none';
    joystickStick.style.transform = `translate(-50%, -50%)`;
    INPUT.joystick.dirX = 0;
    INPUT.joystick.dirY = 0;
};

joystickZone.addEventListener('touchend', endTouch);
joystickZone.addEventListener('touchcancel', endTouch);

function updateJoystickStick(clientX, clientY) {
    let dx = clientX - INPUT.joystick.originX;
    let dy = clientY - INPUT.joystick.originY;

    const maxRadius = 60;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
    }

    joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    if (dist > 5) {
        INPUT.joystick.dirX = dx / maxRadius;
        INPUT.joystick.dirY = dy / maxRadius;
    } else {
        INPUT.joystick.dirX = 0;
        INPUT.joystick.dirY = 0;
    }
}

// Action Button Logic
const actionBtn = document.getElementById('action-btn');
actionBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (GAME.state !== 'PLAYING') return;
    INPUT.action = true;
    actionBtn.style.backgroundColor = "rgba(255, 255, 255, 0.6)";
});

actionBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    INPUT.action = false;
    actionBtn.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
});

// AABB Collision functions
function checkTileCollision(x, y, width, height) {
    const corners = [
        { x: x - width / 2, y: y - height / 2 },
        { x: x + width / 2, y: y - height / 2 },
        { x: x - width / 2, y: y + height / 2 },
        { x: x + width / 2, y: y + height / 2 }
    ];

    for (let c of corners) {
        const tX = Math.floor(c.x / TILE_SIZE);
        const tY = Math.floor(c.y / TILE_SIZE);
        if (tX < 0 || tX >= MAP_COLS || tY < 0 || tY >= MAP_ROWS) return true;
        if (SOLID_TILES.includes(WORLD[tY][tX])) return true;
    }
    return false;
}

// Crafting System
const craftBtn = document.getElementById('craft-sword-btn');
craftBtn.addEventListener('click', () => {
    if (GAME.state !== 'PLAYING') return;
    if (PLAYER.inventory.wood >= 5 && PLAYER.equipped !== 'sword') {
        PLAYER.inventory.wood -= 5;
        document.getElementById('wood-count').innerText = PLAYER.inventory.wood;
        PLAYER.equipped = 'sword';
        craftBtn.innerText = 'Sword Equipped!';
        craftBtn.disabled = true;
        PLAYER.color = '#f1c40f'; // Yellow when armed
    }
});
craftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    craftBtn.click();
});

// Restart Game
document.getElementById('restart-btn').addEventListener('click', () => {
    PLAYER.hp = PLAYER.maxHp;
    PLAYER.inventory.wood = 0;
    PLAYER.equipped = null;
    document.getElementById('wood-count').innerText = 0;
    document.getElementById('health-fill').style.width = '100%';

    craftBtn.disabled = true;
    craftBtn.innerText = 'Craft Sword (5 Wood)';
    PLAYER.color = '#3498db';

    document.getElementById('game-over-screen').classList.add('hidden');
    GAME.state = 'PLAYING';

    MONSTERS.length = 0;
    for (let i = 0; i < 15; i++) spawnMonster();
    PARTICLES.length = 0;

    PLAYER.x = MAP_COLS * TILE_SIZE / 2;
    PLAYER.y = MAP_ROWS * TILE_SIZE / 2;
    fixSpawn();
    CAMERA.x = PLAYER.x - canvas.width / 2;
    CAMERA.y = PLAYER.y - canvas.height / 2;
});

// Action logic (Mining / Attacking)
let lastActionTime = 0;
const ACTION_COOLDOWN = 300; // ms

function performAction(time) {
    if (time - lastActionTime < ACTION_COOLDOWN) return;
    lastActionTime = time;

    let actionDone = false;
    let attackDamage = PLAYER.equipped === 'sword' ? 20 : 10;
    let attackRange = PLAYER.equipped === 'sword' ? 90 : 60;

    // 1. Try to attack monsters
    for (let i = MONSTERS.length - 1; i >= 0; i--) {
        let m = MONSTERS[i];
        if (Math.hypot(PLAYER.x - m.x, PLAYER.y - m.y) < attackRange) {
            m.hp -= attackDamage;
            m.flashTime = time;

            // Knockback
            m.x += (m.x - PLAYER.x > 0 ? 1 : -1) * 20;
            m.y += (m.y - PLAYER.y > 0 ? 1 : -1) * 20;

            spawnDamageNumber(m.x, m.y, attackDamage, false);

            if (m.hp <= 0) {
                MONSTERS.splice(i, 1);
                setTimeout(spawnMonster, 3000);
            }
            actionDone = true;
            break;
        }
    }

    if (actionDone) return;

    // 2. Try to mine a tree
    const pTX = Math.floor(PLAYER.x / TILE_SIZE);
    const pTY = Math.floor(PLAYER.y / TILE_SIZE);

    for (let y = pTY - 1; y <= pTY + 1; y++) {
        for (let x = pTX - 1; x <= pTX + 1; x++) {
            if (x >= 0 && x < MAP_COLS && y >= 0 && y < MAP_ROWS) {
                if (WORLD[y][x] === TILES.TREE) {
                    const tileCenterX = x * TILE_SIZE + TILE_SIZE / 2;
                    const tileCenterY = y * TILE_SIZE + TILE_SIZE / 2;
                    if (Math.hypot(PLAYER.x - tileCenterX, PLAYER.y - tileCenterY) < 80) {
                        WORLD[y][x] = TILES.GRASS;
                        PLAYER.inventory.wood += 1;
                        document.getElementById('wood-count').innerText = PLAYER.inventory.wood;
                        actionDone = true;

                        // Particle text for +1 Wood
                        PARTICLES.push({
                            x: tileCenterX, y: tileCenterY,
                            text: "+1 Wood", life: 1.0, color: '#8e44ad', vy: -20
                        });

                        if (PLAYER.inventory.wood >= 5 && PLAYER.equipped !== 'sword') {
                            craftBtn.disabled = false;
                        }
                        break;
                    }
                }
            }
        }
        if (actionDone) break;
    }
}

// Main Loop
function gameLoop(time) {
    GAME.deltaTime = (time - GAME.lastTime) / 1000;
    GAME.lastTime = time;

    update(time, GAME.deltaTime);
    render(time);

    requestAnimationFrame(gameLoop);
}

function update(time, dt) {
    if (GAME.state !== 'PLAYING') return;

    // Actions
    if (INPUT.action || INPUT.keys[' ']) {
        performAction(time);
    }

    // Movement Vector
    let vx = 0;
    let vy = 0;

    if (INPUT.joystick.active) {
        vx = INPUT.joystick.dirX;
        vy = INPUT.joystick.dirY;
    } else {
        // Keyboard fallback
        if (INPUT.keys['w'] || INPUT.keys['arrowup']) vy = -1;
        if (INPUT.keys['s'] || INPUT.keys['arrowdown']) vy = 1;
        if (INPUT.keys['a'] || INPUT.keys['arrowleft']) vx = -1;
        if (INPUT.keys['d'] || INPUT.keys['arrowright']) vx = 1;

        if (vx !== 0 && vy !== 0) {
            const length = Math.hypot(vx, vy);
            vx /= length;
            vy /= length;
        }
    }

    // Player Move
    if (vx !== 0) {
        const newX = PLAYER.x + vx * PLAYER.speed * dt;
        if (!checkTileCollision(newX, PLAYER.y, PLAYER.width, PLAYER.height)) {
            PLAYER.x = newX;
        }
    }
    if (vy !== 0) {
        const newY = PLAYER.y + vy * PLAYER.speed * dt;
        if (!checkTileCollision(PLAYER.x, newY, PLAYER.width, PLAYER.height)) {
            PLAYER.y = newY;
        }
    }

    // Update Monsters
    for (let i = MONSTERS.length - 1; i >= 0; i--) {
        let m = MONSTERS[i];
        let dx = PLAYER.x - m.x;
        let dy = PLAYER.y - m.y;
        let dist = Math.hypot(dx, dy);

        // Aggro and move
        if (dist < 400 && dist > 15) { // 400 aggro range
            let mvX = (dx / dist) * m.speed * dt;
            let mvY = (dy / dist) * m.speed * dt;

            if (!checkTileCollision(m.x + mvX, m.y, m.width, m.height)) m.x += mvX;
            if (!checkTileCollision(m.x, m.y + mvY, m.width, m.height)) m.y += mvY;
        }

        // Attack Player
        if (dist < 40 && time - m.lastAttackTime > 1000) {
            m.lastAttackTime = time;
            PLAYER.hp -= MONSTER_DAMAGE;
            document.getElementById('health-fill').style.width = Math.max(0, (PLAYER.hp / PLAYER.maxHp) * 100) + '%';

            PLAYER.flashTime = time;
            spawnDamageNumber(PLAYER.x, PLAYER.y, MONSTER_DAMAGE, true);

            if (PLAYER.hp <= 0) {
                GAME.state = 'GAMEOVER';
                document.getElementById('game-over-screen').classList.remove('hidden');
                endTouch({ preventDefault: () => { } });
                INPUT.action = false;
            }
        }
    }

    // Update Particles
    for (let i = PARTICLES.length - 1; i >= 0; i--) {
        let p = PARTICLES[i];
        p.life -= dt;
        p.y += p.vy * dt;
        if (p.life <= 0) PARTICLES.splice(i, 1);
    }

    // Camera follow player smoothly
    const targetCamX = PLAYER.x - canvas.width / 2;
    const targetCamY = PLAYER.y - canvas.height / 2;
    CAMERA.x += (targetCamX - CAMERA.x) * 10 * dt;
    CAMERA.y += (targetCamY - CAMERA.y) * 10 * dt;

    // Clamp camera
    CAMERA.x = Math.max(0, Math.min(CAMERA.x, MAP_COLS * TILE_SIZE - canvas.width));
    CAMERA.y = Math.max(0, Math.min(CAMERA.y, MAP_ROWS * TILE_SIZE - canvas.height));
}

function render(time) {
    ctx.fillStyle = '#111'; // Dark background outside map
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (GAME.state === 'PLAYING' || GAME.state === 'GAMEOVER') {
        const startCol = Math.max(0, Math.floor(CAMERA.x / TILE_SIZE));
        const endCol = Math.min(MAP_COLS, startCol + (canvas.width / TILE_SIZE) + 2);
        const startRow = Math.max(0, Math.floor(CAMERA.y / TILE_SIZE));
        const endRow = Math.min(MAP_ROWS, startRow + (canvas.height / TILE_SIZE) + 2);

        // Draw World
        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const tile = WORLD[y][x];
                ctx.fillStyle = TILE_COLORS[tile];

                const screenX = x * TILE_SIZE - CAMERA.x;
                const screenY = y * TILE_SIZE - CAMERA.y;

                ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1); // +1 to prevent tearing

                if (tile === TILES.TREE) {
                    ctx.fillStyle = '#1e8449';
                    ctx.beginPath();
                    ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                    ctx.fill();
                } else if (tile === TILES.STONE) {
                    ctx.fillStyle = '#95a5a6';
                    ctx.fillRect(screenX + 10, screenY + 10, TILE_SIZE - 20, TILE_SIZE - 20);
                }
            }
        }

        // Object Sorting (Draw monsters and player in Y order)
        const renderQueue = [];
        for (let m of MONSTERS) renderQueue.push({ type: 'monster', obj: m, y: m.y });
        renderQueue.push({ type: 'player', obj: PLAYER, y: PLAYER.y });
        renderQueue.sort((a, b) => a.y - b.y);

        for (let item of renderQueue) {
            if (item.type === 'monster') {
                const m = item.obj;
                ctx.fillStyle = (time - m.flashTime < 150) ? '#fff' : m.color;
                ctx.fillRect(m.x - m.width / 2 - CAMERA.x, m.y - m.height / 2 - CAMERA.y, m.width, m.height);

                // Eyes
                ctx.fillStyle = '#000';
                ctx.fillRect(m.x - m.width / 2 + 5 - CAMERA.x, m.y - m.height / 2 + 5 - CAMERA.y, 5, 5);
                ctx.fillRect(m.x + m.width / 2 - 10 - CAMERA.x, m.y - m.height / 2 + 5 - CAMERA.y, 5, 5);

                if (m.hp < m.maxHp) {
                    const healthRatio = m.hp / m.maxHp;
                    ctx.fillStyle = '#c0392b';
                    ctx.fillRect(m.x - m.width / 2 - CAMERA.x, m.y - m.height / 2 - 10 - CAMERA.y, m.width, 4);
                    ctx.fillStyle = '#2ecc71';
                    ctx.fillRect(m.x - m.width / 2 - CAMERA.x, m.y - m.height / 2 - 10 - CAMERA.y, m.width * healthRatio, 4);
                }
            } else {
                // Draw Player
                ctx.fillStyle = (time - PLAYER.flashTime < 200) ? 'red' : PLAYER.color;

                if (PLAYER.equipped === 'sword') {
                    const timeSwing = (time - lastActionTime);
                    ctx.save();
                    ctx.translate(PLAYER.x - CAMERA.x, PLAYER.y - CAMERA.y);

                    ctx.fillStyle = '#bdc3c7';
                    ctx.translate(15, 0);
                    if (timeSwing < 200) {
                        ctx.rotate(Math.PI / 4 * (timeSwing / 200));
                    } else {
                        ctx.rotate(-Math.PI / 6);
                    }
                    // Handle
                    ctx.fillStyle = '#8e44ad';
                    ctx.fillRect(-2, 5, 9, 8);
                    // Blade
                    ctx.fillStyle = '#bdc3c7';
                    ctx.fillRect(0, -25, 5, 30);
                    ctx.restore();
                }

                ctx.fillRect(PLAYER.x - PLAYER.width / 2 - CAMERA.x, PLAYER.y - PLAYER.height / 2 - CAMERA.y, PLAYER.width, PLAYER.height);

                // Eyes
                ctx.fillStyle = '#fff';
                ctx.fillRect(PLAYER.x - PLAYER.width / 2 + 5 - CAMERA.x, PLAYER.y - PLAYER.height / 2 + 5 - CAMERA.y, 5, 5);
                ctx.fillRect(PLAYER.x + PLAYER.width / 2 - 10 - CAMERA.x, PLAYER.y - PLAYER.height / 2 + 5 - CAMERA.y, 5, 5);

                if (time - lastActionTime < 150) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(PLAYER.x - CAMERA.x, PLAYER.y - CAMERA.y, PLAYER.equipped === 'sword' ? 60 : 40, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }

        // Draw Particles
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        for (let p of PARTICLES) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillText(p.text, p.x - CAMERA.x, p.y - CAMERA.y);
            // Outline
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000';
            ctx.strokeText(p.text, p.x - CAMERA.x, p.y - CAMERA.y);
        }
        ctx.globalAlpha = 1.0;
        ctx.textAlign = 'left';
    }
}

// Initial UI setup
document.getElementById('craft-sword-btn').disabled = true;

// Start
requestAnimationFrame(gameLoop);
