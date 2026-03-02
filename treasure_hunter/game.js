// Game State & Config
const config = {
    worldWidth: 2000,
    worldHeight: 2000,
    playerRadius: 15,
    enemyRadius: 15,
    beadRadius: 10,
    playerSpeed: 200, // px per second
    fps: 60
};

const skills = [
    { id: 'gas', name: '毒气', desc: '释放毒气云，触碰的野兽会死亡。', cd: 10 },
    { id: 'fast', name: '跑步快', desc: '5秒内移动速度翻倍。', cd: 10 },
    { id: 'stinger', name: '毒刺', desc: '向前方发射毒刺，击杀接触的第1只野兽。', cd: 5 },
    { id: 'face', name: '变脸人', desc: '变身！5秒内野兽看不到你，并且无敌。', cd: 15 }
];

let gameState = {
    phase: 'start', // 'start', 'playing', 'gameover'
    playerColor: '#E53935',
    playerSkill: null,
    lastTime: 0,
    keys: {},
    joystick: { x: 0, y: 0, active: false },
    camera: { x: 0, y: 0 },
    score: 0
};

// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const charOptions = document.querySelectorAll('.char-option');
const drawSkillBtn = document.getElementById('draw-skill-btn');
const skillResult = document.getElementById('skill-result');
const skillNameEl = document.getElementById('skill-name');
const skillDescEl = document.getElementById('skill-desc');
const startBtn = document.getElementById('start-btn');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const actionBtn = document.getElementById('action-btn');
const messageOverlay = document.getElementById('message-overlay');
const endTitle = document.getElementById('end-title');
const restartBtn = document.getElementById('restart-btn');

// --- UI Logic ---
charOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        charOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        gameState.playerColor = opt.dataset.color;
    });
});

drawSkillBtn.addEventListener('click', () => {
    const randomSkill = skills[Math.floor(Math.random() * skills.length)];
    gameState.playerSkill = randomSkill;

    skillNameEl.textContent = randomSkill.name;
    skillDescEl.textContent = randomSkill.desc;
    skillResult.classList.remove('hidden');

    // Update action button text
    actionBtn.textContent = randomSkill.name;

    startBtn.disabled = false;
});

startBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initGame();
});

restartBtn.addEventListener('click', () => {
    messageOverlay.classList.add('hidden');
    initGame();
});

// --- Game Engine ---

class Player {
    constructor(x, y, color, skill) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.skill = skill;
        this.vx = 0;
        this.vy = 0;
        this.baseSpeed = config.playerSpeed;
        this.speedM = 1; // Speed multiplier
        this.invulnerable = false;

        // Skill state
        this.skillTimer = 0;
        this.skillCooldown = 0;
        this.facing = { x: 1, y: 0 }; // default facing right
    }

    update(dt) {
        // Calculate input vector
        let dx = 0;
        let dy = 0;

        if (gameState.joystick.active) {
            dx = gameState.joystick.x;
            dy = gameState.joystick.y;
        } else {
            if (gameState.keys['w'] || gameState.keys['arrowup']) dy -= 1;
            if (gameState.keys['s'] || gameState.keys['arrowdown']) dy += 1;
            if (gameState.keys['a'] || gameState.keys['arrowleft']) dx -= 1;
            if (gameState.keys['d'] || gameState.keys['arrowright']) dx += 1;
        }

        // Normalize
        const len = Math.hypot(dx, dy);
        if (len > 0) {
            dx /= len;
            dy /= len;
            this.facing = { x: dx, y: dy };
        }

        const currentSpeed = this.baseSpeed * this.speedM;
        this.x += dx * currentSpeed * dt;
        this.y += dy * currentSpeed * dt;

        // Keep in bounds
        this.x = Math.max(config.playerRadius, Math.min(config.worldWidth - config.playerRadius, this.x));
        this.y = Math.max(config.playerRadius, Math.min(config.worldHeight - config.playerRadius, this.y));

        // Skill Timers
        if (this.skillCooldown > 0) {
            this.skillCooldown -= dt;
            if (this.skillCooldown <= 0) {
                actionBtn.classList.remove('on-cooldown');
                actionBtn.textContent = this.skill.name;
            } else {
                actionBtn.textContent = Math.ceil(this.skillCooldown) + 's';
            }
        }

        if (this.skillTimer > 0) {
            this.skillTimer -= dt;
            if (this.skillTimer <= 0) {
                // reset effects
                this.speedM = 1;
                this.invulnerable = false;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.invulnerable) {
            ctx.globalAlpha = 0.5;
        }

        // Body
        ctx.beginPath();
        ctx.arc(0, 0, config.playerRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Direction indicator (eye/nose)
        ctx.beginPath();
        ctx.arc(this.facing.x * 8, this.facing.y * 8, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        ctx.restore();
    }

    useSkill() {
        if (this.skillCooldown > 0 || gameState.phase !== 'playing') return;

        this.skillCooldown = this.skill.cd;
        actionBtn.classList.add('on-cooldown');

        switch (this.skill.id) {
            case 'gas':
                entities.push(new PoisonGas(this.x, this.y));
                break;
            case 'fast':
                this.speedM = 2;
                this.skillTimer = 5;
                break;
            case 'stinger':
                entities.push(new Stinger(this.x, this.y, this.facing.x, this.facing.y));
                break;
            case 'face':
                this.invulnerable = true;
                this.skillTimer = 5;
                break;
        }
    }
}

class Enemy {
    constructor(type, x, y) {
        this.type = type; // 'dragon' | 'runner'
        this.x = x;
        this.y = y;
        this.radius = config.enemyRadius;
        this.dead = false;

        if (this.type === 'dragon') {
            this.speed = config.playerSpeed * 0.4;
            this.color = '#795548'; // Brown
        } else {
            this.speed = config.playerSpeed * 1.2;
            this.color = '#FF9800'; // Orange
            const a = Math.random() * Math.PI * 2;
            this.vx = Math.cos(a) * this.speed;
            this.vy = Math.sin(a) * this.speed;
        }
    }

    update(dt) {
        if (this.type === 'dragon') {
            // Chase player if not invulnerable
            if (!player.invulnerable) {
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    this.x += (dx / dist) * this.speed * dt;
                    this.y += (dy / dist) * this.speed * dt;
                }
            } else {
                // Wander slowly
                this.x += (Math.random() - 0.5) * this.speed * dt;
                this.y += (Math.random() - 0.5) * this.speed * dt;
            }
        } else if (this.type === 'runner') {
            // Move fast, bounce off edges
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            // Randomly change direction sometimes
            if (Math.random() < 0.01) {
                const a = Math.random() * Math.PI * 2;
                this.vx = Math.cos(a) * this.speed;
                this.vy = Math.sin(a) * this.speed;
            }

            if (this.x < this.radius || this.x > config.worldWidth - this.radius) this.vx *= -1;
            if (this.y < this.radius || this.y > config.worldHeight - this.radius) this.vy *= -1;
        }

        // Ensure in bounds
        this.x = Math.max(this.radius, Math.min(config.worldWidth - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(config.worldHeight - this.radius, this.y));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();

        if (this.type === 'dragon') {
            // Draw dragon-like shape (triangle)
            ctx.moveTo(0, -this.radius);
            ctx.lineTo(this.radius, this.radius);
            ctx.lineTo(-this.radius, this.radius);
        } else {
            // Draw runner shape (circle with spikes)
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        }

        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.stroke();

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type === 'dragon' ? '龙' : '跑', 0, 0);

        ctx.restore();
    }
}

class Bead {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = config.beadRadius;
        this.pulse = 0;
    }

    update(dt) {
        this.pulse += dt * 5;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const scale = 1 + Math.sin(this.pulse) * 0.2;
        ctx.scale(scale, scale);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#00BFFF'; // Aquamarine
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00BFFF';
        ctx.fill();

        ctx.restore();
    }
}

// Skill Effects
class PoisonGas {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 80;
        this.life = 3; // 3 seconds
        this.dead = false;
    }
    update(dt) {
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(156, 39, 176, ${this.life / 3 * 0.5})`; // Purple gas
        ctx.fill();
        ctx.restore();
    }
}

class Stinger {
    constructor(x, y, dx, dy) {
        this.x = x;
        this.y = y;
        this.vx = dx * 400; // Fast
        this.vy = dy * 400;
        this.radius = 5;
        this.life = 2; // 2 seconds
        this.dead = false;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#4CAF50';
        ctx.fill();
        ctx.restore();
    }
}

// Globals
let player;
let enemies = [];
let bead;
let entities = []; // Skill effects
let trees = [];

function generateForest() {
    trees = [];
    for (let i = 0; i < 200; i++) {
        trees.push({
            x: Math.random() * config.worldWidth,
            y: Math.random() * config.worldHeight,
            r: 10 + Math.random() * 20
        });
    }
}

function initGame() {
    gameState.phase = 'playing';
    player = new Player(config.worldWidth / 2, config.worldHeight / 2, gameState.playerColor, gameState.playerSkill);

    // Reset buttons
    actionBtn.classList.remove('on-cooldown');
    actionBtn.textContent = player.skill.name;

    enemies = [];
    entities = [];

    // Spawn Bead far from player
    let bx, by;
    do {
        bx = Math.random() * (config.worldWidth - 100) + 50;
        by = Math.random() * (config.worldHeight - 100) + 50;
    } while (Math.hypot(bx - player.x, by - player.y) < 800);
    bead = new Bead(bx, by);

    // Spawn Enemies
    for (let i = 0; i < 15; i++) {
        let ex, ey;
        do {
            ex = Math.random() * config.worldWidth;
            ey = Math.random() * config.worldHeight;
        } while (Math.hypot(ex - player.x, ey - player.y) < 300); // Don't spawn too close to player

        const type = Math.random() > 0.5 ? 'dragon' : 'runner';
        enemies.push(new Enemy(type, ex, ey));
    }

    generateForest();

    gameState.lastTime = performance.now();
    resizeCanvas();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

function checkCollisions() {
    // Player vs Enemies
    if (!player.invulnerable) {
        for (let e of enemies) {
            if (Math.hypot(player.x - e.x, player.y - e.y) < config.playerRadius + e.radius) {
                gameOver(false);
                return;
            }
        }
    }

    // Player vs Bead
    if (Math.hypot(player.x - bead.x, player.y - bead.y) < config.playerRadius + bead.radius) {
        gameOver(true);
        return;
    }

    // Entities vs Enemies
    for (let e of enemies) {
        for (let ent of entities) {
            if (ent instanceof PoisonGas && !ent.dead) {
                if (Math.hypot(e.x - ent.x, e.y - ent.y) < e.radius + ent.radius) {
                    e.dead = true;
                }
            } else if (ent instanceof Stinger && !ent.dead) {
                if (Math.hypot(e.x - ent.x, e.y - ent.y) < e.radius + ent.radius) {
                    e.dead = true;
                    ent.dead = true; // Stinger disappears on hit
                }
            }
        }
    }

    // Remove dead enemies & entities
    enemies = enemies.filter(e => !e.dead);
    entities = entities.filter(ent => !ent.dead);
}

function updateCamera() {
    // Center camera on player
    gameState.camera.x = player.x - canvas.width / 2;
    gameState.camera.y = player.y - canvas.height / 2;

    // Clamp camera
    gameState.camera.x = Math.max(0, Math.min(config.worldWidth - canvas.width, gameState.camera.x));
    gameState.camera.y = Math.max(0, Math.min(config.worldHeight - canvas.height, gameState.camera.y));
}

function gameLoop(timestamp) {
    if (gameState.phase !== 'playing') return;

    const dt = Math.min((timestamp - gameState.lastTime) / 1000, 0.1); // Cap dt
    gameState.lastTime = timestamp;

    // Update
    player.update(dt);
    enemies.forEach(e => e.update(dt));
    bead.update(dt);
    entities.forEach(ent => ent.update(dt));

    checkCollisions();

    if (gameState.phase !== 'playing') return; // Might be set in checkCollisions

    updateCamera();

    // Draw
    draw();

    requestAnimationFrame(gameLoop);
}

function draw() {
    // Clear & background
    ctx.fillStyle = '#1b5e20';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-gameState.camera.x, -gameState.camera.y);

    // Draw Grid / Floor patterns
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 1;
    for (let i = 0; i < config.worldWidth; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, config.worldHeight); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(config.worldWidth, i); ctx.stroke();
    }

    // Draw Trees (Background)
    ctx.fillStyle = '#0a3d11';
    trees.forEach(t => {
        // Only draw if in viewport
        if (t.x > gameState.camera.x - 50 && t.x < gameState.camera.x + canvas.width + 50 &&
            t.y > gameState.camera.y - 50 && t.y < gameState.camera.y + canvas.height + 50) {
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Draw game objects
    bead.draw(ctx);
    entities.forEach(ent => ent.draw(ctx));
    enemies.forEach(e => e.draw(ctx));
    player.draw(ctx);

    // Draw indicators for bead if out of screen
    drawOffscreenIndicator(bead.x, bead.y, '#00BFFF', ctx);

    ctx.restore();
}

function drawOffscreenIndicator(tx, ty, color, ctx) {
    const margin = 20;
    const viewLeft = gameState.camera.x + margin;
    const viewRight = gameState.camera.x + canvas.width - margin;
    const viewTop = gameState.camera.y + margin;
    const viewBottom = gameState.camera.y + canvas.height - margin;

    // Check if target is out of bounds
    if (tx < viewLeft || tx > viewRight || ty < viewTop || ty > viewBottom) {
        // Find intersection with screen edges
        let ix = Math.max(viewLeft, Math.min(viewRight, tx));
        let iy = Math.max(viewTop, Math.min(viewBottom, ty));

        ctx.beginPath();
        ctx.arc(ix, iy, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
}

function gameOver(win) {
    gameState.phase = 'gameover';
    messageOverlay.classList.remove('hidden');
    if (win) {
        endTitle.textContent = "你找到了海蓝珠！胜利！";
        endTitle.style.color = "#4CAF50";
        endTitle.style.textShadow = "0 0 10px rgba(76,175,80,0.5)";
    } else {
        endTitle.textContent = "你被野兽吃掉了！";
        endTitle.style.color = "#f44336";
        endTitle.style.textShadow = "0 0 10px rgba(244,67,54,0.5)";
    }
}

// --- Input Handling ---

// Keyboard
window.addEventListener('keydown', (e) => {
    gameState.keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' || e.key === 'Spacebar') {
        if (player) player.useSkill();
    }
});
window.addEventListener('keyup', (e) => {
    gameState.keys[e.key.toLowerCase()] = false;
});

// Controls Action Button
actionBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (player) player.useSkill(); });
actionBtn.addEventListener('mousedown', (e) => { e.preventDefault(); if (player) player.useSkill(); });

// Joystick
const joystickZone = document.getElementById('joystick-zone');
const joystickStick = document.getElementById('joystick-stick');
let joystickCenter = { x: 0, y: 0 };
let joystickRadius = 60; // Half of 120px

function handleJoystickStart(e) {
    e.preventDefault();
    const rect = joystickZone.getBoundingClientRect();
    joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
    gameState.joystick.active = true;
    handleJoystickMove(e);
}

function handleJoystickMove(e) {
    if (!gameState.joystick.active) return;
    e.preventDefault();
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let dx = clientX - joystickCenter.x;
    let dy = clientY - joystickCenter.y;
    let dist = Math.hypot(dx, dy);

    if (dist > joystickRadius) {
        dx = (dx / dist) * joystickRadius;
        dy = (dy / dist) * joystickRadius;
    }

    joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Normalize for movement (-1 to +1)
    gameState.joystick.x = dx / joystickRadius;
    gameState.joystick.y = dy / joystickRadius;
}

function handleJoystickEnd(e) {
    if (!gameState.joystick.active) return;
    e.preventDefault();
    gameState.joystick.active = false;
    gameState.joystick.x = 0;
    gameState.joystick.y = 0;
    joystickStick.style.transform = `translate(-50%, -50%)`;
}

joystickZone.addEventListener('touchstart', handleJoystickStart, { passive: false });
document.addEventListener('touchmove', handleJoystickMove, { passive: false });
document.addEventListener('touchend', handleJoystickEnd, { passive: false });

// Mouse support for joystick (testing on desktop)
joystickZone.addEventListener('mousedown', handleJoystickStart);
document.addEventListener('mousemove', handleJoystickMove);
document.addEventListener('mouseup', handleJoystickEnd);
