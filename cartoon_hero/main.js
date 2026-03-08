const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const uiHpBar = document.getElementById('ui-hp-bar');
const uiHpText = document.getElementById('ui-hp-text');
const uiTrees = document.getElementById('ui-trees').querySelector('.val');
const uiOres = document.getElementById('ui-ores').querySelector('.val');
const uiWeapon = document.getElementById('ui-weapon').querySelector('.val');
const btnUpgrade = document.getElementById('btn-upgrade');

const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
const joystickZone = document.getElementById('joystick-zone');

// Game State
const GAME_SIZE = 4000;
let lastTime = 0;
let gameTime = 0;

const WEAPONS = [
    { level: 0, name: '小刀', baseAtk: 2, treeCost: 0 },
    { level: 1, name: '宝剑', baseAtk: 5, treeCost: 5 },
    { level: 2, name: '青龙偃月刀', baseAtk: 10, treeCost: 10 },
    { level: 3, name: '方天戟', baseAtk: 20, treeCost: 15 }
];

const state = {
    camera: { x: 0, y: 0 },
    player: null,
    followers: [],
    monsters: [],
    trees: [],
    ores: [],
    particles: [],
    joyData: { active: false, x: 0, y: 0, dx: 0, dy: 0 },
    resources: { trees: 0, ores: 0 },
    weaponLevel: 0
};

// Input Handling
function initInput() {
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Joystick
    let startX = 0, startY = 0;
    let maxDist = 50;

    const onStart = (e) => {
        state.joyData.active = true;
        let touch = e.touches ? e.touches[0] : e;
        const rect = joystickZone.getBoundingClientRect();
        startX = touch.clientX;
        startY = touch.clientY;

        // Position base at touch
        joystickBase.style.left = `${startX - 60}px`;
        joystickBase.style.top = `${startY - 60}px`;
        joystickBase.style.bottom = 'auto';

        state.joyData.dx = 0;
        state.joyData.dy = 0;
        joystickStick.style.transform = `translate(0px, 0px)`;
    };

    const onMove = (e) => {
        if (!state.joyData.active) return;
        let touch = e.touches ? e.touches[0] : e;
        let dx = touch.clientX - startX;
        let dy = touch.clientY - startY;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        state.joyData.dx = dx / maxDist;
        state.joyData.dy = dy / maxDist;
        joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const onEnd = () => {
        state.joyData.active = false;
        state.joyData.dx = 0;
        state.joyData.dy = 0;
        joystickBase.style.left = '50px';
        joystickBase.style.bottom = '50px';
        joystickBase.style.top = 'auto';
        joystickStick.style.transform = `translate(0px, 0px)`;
    };

    joystickZone.addEventListener('touchstart', onStart, { passive: false });
    joystickZone.addEventListener('touchmove', onMove, { passive: false });
    joystickZone.addEventListener('touchend', onEnd);
    joystickZone.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    // Upgrade Event
    btnUpgrade.addEventListener('click', upgradeWeapon);
}

// Utils
function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Math logic for bounds
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// Drawing SVG Paths
function drawSvgPath(ctx, path, x, y, scale = 1, fillStyle, strokeStyle = '#000', lineWidth = 2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const p = new Path2D(path);
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill(p);
    }
    if (strokeStyle && lineWidth > 0) {
        ctx.lineWidth = lineWidth / scale;
        ctx.strokeStyle = strokeStyle;
        ctx.stroke(p);
    }
    ctx.restore();
}

// Entity Classes
class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
        this.removed = false;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.x = clamp(this.x, 0, GAME_SIZE);
        this.y = clamp(this.y, 0, GAME_SIZE);
    }
    draw(ctx) { }
}

class Character extends Entity {
    constructor(x, y) {
        super(x, y, 20);
        this.hp = 40;
        this.maxHp = 40;
        this.isPlayer = false;
        this.speed = 150;
        this.attackTimer = 0;
        this.facingRight = true;
        this.weaponSwingTimer = 0;
    }

    get attack() {
        let w = WEAPONS[state.weaponLevel];
        return w.baseAtk + state.resources.ores;
    }

    update(dt) {
        super.update(dt);
        if (this.vx > 0) this.facingRight = true;
        else if (this.vx < 0) this.facingRight = false;

        // Auto Attack
        this.attackTimer -= dt;
        this.weaponSwingTimer -= dt;

        if (this.attackTimer <= 0) {
            let target = null;
            let minD = Infinity;
            for (let m of state.monsters) {
                let d = dist(this.x, this.y, m.x, m.y);
                if (d < 80 && d < minD) {
                    minD = d;
                    target = m;
                }
            }
            if (target) {
                target.hp -= this.attack;
                this.attackTimer = 1.0;
                this.weaponSwingTimer = 0.2;
                this.facingRight = target.x > this.x;
                // spawn damage text
                state.particles.push(new DamageText(target.x, target.y - 20, this.attack, '#fff'));
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (!this.facingRight) ctx.scale(-1, 1);

        // Minecraft style blocky body
        // Feet
        ctx.fillStyle = '#1B1464'; // Dark blue pants
        ctx.fillRect(-10, 10, 8, 10);
        ctx.fillRect(2, 10, 8, 10);

        // Body
        ctx.fillStyle = this.isPlayer ? '#00A8FF' : '#44bd32'; // Cyan shirt for player, green for followers
        ctx.fillRect(-10, -10, 20, 20);

        // Head
        ctx.fillStyle = '#fbc531'; // Skin color
        ctx.fillRect(-10, -28, 18, 18);

        // Face
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, -20, 4, 3); // Eye
        ctx.fillRect(4, -20, 4, 3); // Eye
        ctx.fillStyle = '#8e44ad';
        if (this.isPlayer) {
            // Cap or something
            ctx.fillStyle = '#ff4757';
            ctx.fillRect(-10, -28, 18, 4);
        }

        // Weapon
        ctx.save();
        if (this.weaponSwingTimer > 0) {
            ctx.rotate(-Math.PI / 4);
        }

        let wColor = "#bdc3c7";
        let length = 20;
        switch (state.weaponLevel) {
            case 0: wColor = "#95a5a6"; length = 15; break;
            case 1: wColor = "#3498db"; length = 25; break;
            case 2: wColor = "#2ecc71"; length = 35; break;
            case 3: wColor = "#e74c3c"; length = 40; break;
        }

        // Draw pixelated sword
        ctx.fillStyle = '#7f8c8d'; // Handle
        ctx.fillRect(8, -2, 4, 4);
        ctx.fillStyle = wColor;
        ctx.fillRect(12, -2, length, 4);
        // Crossguard
        ctx.fillStyle = '#34495e';
        ctx.fillRect(10, -8, 2, 16);

        ctx.restore();
        ctx.restore();

        // Draw HP
        if (this.isPlayer && this.hp < this.maxHp) {
            drawHpBar(ctx, this.x, this.y - 45, this.hp, this.maxHp);
        }
    }
}

class Monster extends Entity {
    constructor(x, y) {
        super(x, y, 15);
        this.hp = 20;
        this.maxHp = 20;
        this.speed = 50;
        this.attackTimer = 0;
    }

    update(dt) {
        if (this.hp <= 0) {
            this.removed = true;
            return;
        }

        let px = state.player.x;
        let py = state.player.y;
        let d = dist(this.x, this.y, px, py);

        if (d > 20) {
            this.vx = (px - this.x) / d * this.speed;
            this.vy = (py - this.y) / d * this.speed;
        } else {
            this.vx = 0;
            this.vy = 0;
        }

        super.update(dt);

        // Attack player
        this.attackTimer -= dt;
        if (d < 30 && this.attackTimer <= 0) {
            state.player.hp -= 2;
            this.attackTimer = 1.0;
            state.particles.push(new DamageText(state.player.x, state.player.y - 20, 2, '#ff4757'));
        }
    }

    draw(ctx) {
        // Creeper/Zombie style blocky entity
        ctx.save();
        ctx.translate(this.x, this.y);

        // Body
        ctx.fillStyle = '#44bd32'; // Green
        ctx.fillRect(-12, -25, 24, 50);

        // Face
        ctx.fillStyle = 'black';
        ctx.fillRect(-6, -18, 4, 4); // Left eye
        ctx.fillRect(2, -18, 4, 4);  // Right eye
        ctx.fillRect(-2, -10, 4, 8); // "Mouth"
        ctx.fillRect(-4, -4, 2, 4);
        ctx.fillRect(2, -4, 2, 4);

        ctx.restore();

        if (this.hp < this.maxHp) {
            drawHpBar(ctx, this.x, this.y - 40, this.hp, this.maxHp);
        }
    }
}

class Resource extends Entity {
    constructor(x, y, type) {
        super(x, y, 15);
        this.type = type; // 'tree' or 'ore'
        this.hp = 3;
        this.maxHp = 3;
        this.harvestTimer = 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.type === 'tree') {
            // Minecraft Tree
            // Trunk
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(-8, 0, 16, 25);
            // Leaves (blocky)
            ctx.fillStyle = '#2e7d32';
            ctx.fillRect(-20, -30, 40, 40);
            ctx.fillStyle = '#388e3c';
            ctx.fillRect(-15, -25, 30, 30);
        } else {
            // Minecraft Ore Block
            ctx.fillStyle = '#757575'; // Stone
            ctx.fillRect(-15, -15, 30, 30);
            // Specks
            ctx.fillStyle = '#ffeb3b'; // Goldish/Ore color
            ctx.fillRect(-8, -8, 4, 4);
            ctx.fillRect(4, 2, 5, 5);
            ctx.fillRect(-10, 5, 3, 3);
            ctx.fillRect(5, -10, 4, 4);
        }
        ctx.restore();
    }
}

class DamageText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
    }
    update(dt) {
        this.y -= 20 * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px sans-serif';
        ctx.globalAlpha = this.life;
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.strokeText(this.text, this.x, this.y);
    }
}

function drawHpBar(ctx, x, y, hp, maxHp) {
    const w = 40;
    const h = 6;
    ctx.fillStyle = 'black';
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(x - w / 2, y, w * (hp / maxHp), h);
}

// Logic
function upgradeWeapon() {
    const next = WEAPONS[state.weaponLevel + 1];
    if (next && state.resources.trees >= next.treeCost) {
        state.resources.trees -= next.treeCost;
        state.weaponLevel++;
        updateUI();
    }
}

function updateUI() {
    uiHpBar.style.width = `${Math.max(0, state.player.hp / state.player.maxHp * 100)}%`;
    uiHpText.innerText = `${Math.ceil(Math.max(0, state.player.hp))} / ${state.player.maxHp}`;
    uiTrees.innerText = state.resources.trees;

    // Animation on value update
    document.getElementById('ui-trees').classList.remove('anim-pop');
    void document.getElementById('ui-trees').offsetWidth;
    document.getElementById('ui-trees').classList.add('anim-pop');

    uiOres.innerText = state.resources.ores;

    const w = WEAPONS[state.weaponLevel];
    uiWeapon.innerText = `${w.name} (Atk: ${w.baseAtk + state.resources.ores})`;

    // Check upgrade
    const next = WEAPONS[state.weaponLevel + 1];
    if (next && state.resources.trees >= next.treeCost) {
        btnUpgrade.innerText = `升为${next.name} (-${next.treeCost}树)`;
        btnUpgrade.classList.remove('hidden');
    } else {
        btnUpgrade.classList.add('hidden');
    }

    // Player Death
    if (state.player.hp <= 0) {
        document.getElementById('btn-upgrade').innerText = "Game Over (Refresh)";
        document.getElementById('btn-upgrade').classList.remove('hidden');
        document.getElementById('btn-upgrade').onclick = () => location.reload();
    }
}

function spawnEntities() {
    // Player
    state.player = new Character(GAME_SIZE / 2, GAME_SIZE / 2);
    state.player.isPlayer = true;

    // Followers
    let f1 = new Character(GAME_SIZE / 2 - 40, GAME_SIZE / 2);
    let f2 = new Character(GAME_SIZE / 2 + 40, GAME_SIZE / 2);
    state.followers.push(f1, f2);

    // Resources
    for (let i = 0; i < 200; i++) {
        state.trees.push(new Resource(Math.random() * GAME_SIZE, Math.random() * GAME_SIZE, 'tree'));
    }
    for (let i = 0; i < 150; i++) {
        state.ores.push(new Resource(Math.random() * GAME_SIZE, Math.random() * GAME_SIZE, 'ore'));
    }

    // Monsters
    for (let i = 0; i < 100; i++) {
        state.monsters.push(new Monster(Math.random() * GAME_SIZE, Math.random() * GAME_SIZE));
    }
}

function updateFollowers(dt) {
    // Follow player
    const poses = [
        { dx: -40, dy: -40 },
        { dx: 40, dy: 40 }
    ];
    state.followers.forEach((f, i) => {
        let tx = state.player.x + poses[i].dx;
        let ty = state.player.y + poses[i].dy;
        let d = dist(f.x, f.y, tx, ty);
        if (d > 10) {
            f.vx = (tx - f.x) / d * (state.player.speed * 0.9);
            f.vy = (ty - f.y) / d * (state.player.speed * 0.9);
        } else {
            f.vx = 0; f.vy = 0;
        }
        f.update(dt);
        // Followers are immortal, but can attack
    });
}

function doHarvesting(dt) {
    // Harvest trees & ores nearby
    const p = state.player;

    const checkCollisions = (arr) => {
        for (let i = arr.length - 1; i >= 0; i--) {
            let res = arr[i];
            if (dist(p.x, p.y, res.x, res.y) < 40) {
                res.harvestTimer += dt;
                if (res.harvestTimer > 0.5) { // 0.5s to gather
                    if (res.type === 'tree') state.resources.trees++;
                    else if (res.type === 'ore') state.resources.ores++;

                    state.particles.push(new DamageText(res.x, res.y, '+1', res.type === 'tree' ? '#2ecc71' : '#f1c40f'));
                    arr.splice(i, 1);
                    updateUI();
                }
            } else {
                res.harvestTimer = 0;
            }
        }
    };

    checkCollisions(state.trees);
    checkCollisions(state.ores);
}

function update(dt) {
    if (!state.player || state.player.hp <= 0) return;

    // Player move
    state.player.vx = state.joyData.dx * state.player.speed;
    state.player.vy = state.joyData.dy * state.player.speed;
    state.player.update(dt);

    updateFollowers(dt);
    doHarvesting(dt);

    // Monsters
    let aliveMonsters = [];
    for (let m of state.monsters) {
        m.update(dt);
        if (!m.removed) aliveMonsters.push(m);
    }
    state.monsters = aliveMonsters;

    // Spawn more monsters if too few
    if (Math.random() < 0.05 && state.monsters.length < 50) { // Keep map populated
        state.monsters.push(new Monster(Math.random() * GAME_SIZE, Math.random() * GAME_SIZE));
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i];
        p.update(dt);
        if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Camera Follow
    const targetCamX = state.player.x - canvas.width / 2;
    const targetCamY = state.player.y - canvas.height / 2;
    state.camera.x += (targetCamX - state.camera.x) * 10 * dt;
    state.camera.y += (targetCamY - state.camera.y) * 10 * dt;
    state.camera.x = clamp(state.camera.x, 0, GAME_SIZE - canvas.width);
    state.camera.y = clamp(state.camera.y, 0, GAME_SIZE - canvas.height);

    updateUI();
}

function drawBackground() {
    ctx.fillStyle = '#5d914d'; // Darker grass
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);

    // Blocky Grass Pattern (Checkerboard)
    const blockSize = 50;
    const startX = Math.floor(state.camera.x / blockSize) * blockSize;
    const startY = Math.floor(state.camera.y / blockSize) * blockSize;
    const endX = state.camera.x + canvas.width + blockSize;
    const endY = state.camera.y + canvas.height + blockSize;

    for (let x = startX; x < endX; x += blockSize) {
        for (let y = startY; y < endY; y += blockSize) {
            if ((Math.floor(x / blockSize) + Math.floor(y / blockSize)) % 2 === 0) {
                ctx.fillStyle = '#7DAF6C'; // Lighter grass
                ctx.fillRect(x, y, blockSize, blockSize);
            }
        }
    }

    // Map boundaries
    ctx.strokeStyle = '#2d4d22';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, GAME_SIZE, GAME_SIZE);

    // Entities
    const inView = (e) => (
        e.x > state.camera.x - 50 && e.x < state.camera.x + canvas.width + 50 &&
        e.y > state.camera.y - 50 && e.y < state.camera.y + canvas.height + 50
    );

    state.trees.filter(inView).forEach(t => t.draw(ctx));
    state.ores.filter(inView).forEach(o => o.draw(ctx));
    state.followers.forEach(f => f.draw(ctx));
    state.monsters.filter(inView).forEach(m => m.draw(ctx));
    if (state.player.hp > 0) state.player.draw(ctx);

    state.particles.forEach(p => p.draw(ctx));

    ctx.restore();
}

function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1) || 0;
    lastTime = timestamp;
    gameTime += dt;

    update(dt);
    drawBackground();

    requestAnimationFrame(loop);
}

// Init
initInput();
spawnEntities();
updateUI();
requestAnimationFrame(loop);
