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

        // Draw body (Cartoon Person)
        const bodyPath = "M-10,0 Q-10,-20 0,-20 Q10,-20 10,0 L10,15 Q10,25 0,25 Q-10,25 -10,15 Z";
        drawSvgPath(ctx, bodyPath, 0, 0, 1, '#fbc531');

        // Draw eyes
        drawSvgPath(ctx, "M3,-10 A2,2 0 1,0 7,-10 A2,2 0 1,0 3,-10", 0, 0, 1, 'white', null);
        drawSvgPath(ctx, "M5,-10 A1,1 0 1,0 6,-10 A1,1 0 1,0 5,-10", 0, 0, 1, 'black', null);

        // Feather (only for player)
        if (this.isPlayer) {
            const featherPath = "M0,-20 Q5,-35 15,-40 Q5,-30 0,-20";
            drawSvgPath(ctx, featherPath, 0, 0, 1, '#ff4757');
        }

        // Weapon
        if (this.weaponSwingTimer > 0) {
            ctx.rotate(Math.PI / 4);
        }

        let wPath = "";
        let wColor = "#bdc3c7";
        switch (state.weaponLevel) {
            case 0: // 小刀
                wPath = "M10,0 L25,0 L20,-5 L10,-5 Z"; wColor = "#95a5a6"; break;
            case 1: // 宝剑
                wPath = "M10,0 L35,0 L30,-10 L10,-10 Z M15,-15 L15,5"; wColor = "#3498db"; break;
            case 2: // 青龙偃月刀
                wPath = "M-10,0 L40,0 M30,-15 Q45,-15 50,0 Q35,5 30,-5 Z"; wColor = "#2ecc71"; break;
            case 3: // 方天戟
                wPath = "M-10,0 L50,0 M40,-15 L40,15 M45,-10 A10,10 0 0,0 45,10"; wColor = "#e74c3c"; break;
        }
        drawSvgPath(ctx, wPath, 0, 0, 1, wColor);

        ctx.restore();

        // Draw HP
        if (this.isPlayer && this.hp < this.maxHp) {
            drawHpBar(ctx, this.x, this.y - 35, this.hp, this.maxHp);
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
            state.player.hp -= 2; // Monster attack is fixed or so... Wait, rules didn't say, I'll set it to 2.
            this.attackTimer = 1.0;
            state.particles.push(new DamageText(state.player.x, state.player.y - 20, 2, '#ff4757'));
        }
    }

    draw(ctx) {
        // Orange Rectangle
        ctx.fillStyle = '#e67e22';
        ctx.strokeStyle = '#d35400';
        ctx.lineWidth = 2;
        ctx.fillRect(this.x - 15, this.y - 25, 30, 50);
        ctx.strokeRect(this.x - 15, this.y - 25, 30, 50);

        // Eyes
        ctx.fillStyle = 'black';
        ctx.fillRect(this.x - 8, this.y - 15, 4, 4);
        ctx.fillRect(this.x + 4, this.y - 15, 4, 4);

        if (this.hp < this.maxHp) {
            drawHpBar(ctx, this.x, this.y - 35, this.hp, this.maxHp);
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
        if (this.type === 'tree') {
            // Tree SVG
            drawSvgPath(ctx, "M-5,10 L5,10 L5,0 L-5,0 Z", this.x, this.y, 1, '#8e44ad'); // Trunk
            drawSvgPath(ctx, "M0,-25 L15,0 L-15,0 Z", this.x, this.y, 1, '#27ae60'); // Top
            drawSvgPath(ctx, "M0,-15 L20,5 L-20,5 Z", this.x, this.y, 1, '#2ecc71'); // Bottom
        } else {
            // Ore SVG
            const orePath = "M-10,5 L0,-10 L15,-5 L10,15 L-5,10 Z";
            drawSvgPath(ctx, orePath, this.x, this.y, 1, '#7f8c8d', '#2c3e50');
            // Sparkle
            drawSvgPath(ctx, "M0,0 M2,-2 L4,-4 M-2,-2 L-4,-4 M2,2 L4,4 M-2,2 L-4,4", this.x - 5, this.y - 5, 1, null, '#f1c40f');
        }
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
    ctx.fillStyle = '#7DAF6C';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);

    // Map boundaries
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, GAME_SIZE, GAME_SIZE);

    // Grid
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 2;
    const startX = Math.floor(state.camera.x / 100) * 100;
    const startY = Math.floor(state.camera.y / 100) * 100;
    for (let x = startX; x < state.camera.x + canvas.width; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, state.camera.y); ctx.lineTo(x, state.camera.y + canvas.height); ctx.stroke();
    }
    for (let y = startY; y < state.camera.y + canvas.height; y += 100) {
        ctx.beginPath(); ctx.moveTo(state.camera.x, y); ctx.lineTo(state.camera.x + canvas.width, y); ctx.stroke();
    }

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
