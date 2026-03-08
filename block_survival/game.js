/**
 * Block World Survival - Core Game Logic
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Constants
const TILE_SIZE = 50;
const MAP_COLS = 50;
const MAP_ROWS = 50;

// World Generation
const LAYERS = {
    SURFACE: 0,
    UNDERGROUND: 1
};
let CURRENT_LAYER = LAYERS.SURFACE;

const TILES = {
    GRASS: 0,
    TREE: 1,
    STONE: 2,
    WATER: 3,
    DIRT: 4,
    WALL: 5,
    FLOOR: 6,
    COPPER: 7,
    SILVER: 8,
    GOLD: 9,
    DIAMOND: 10,
    LADDER_UP: 11,
    LADDER_DOWN: 12
};

const TILE_COLORS = {
    [TILES.GRASS]: '#2ecc71',
    [TILES.TREE]: '#27ae60',
    [TILES.STONE]: '#7f8c8d',
    [TILES.WATER]: '#3498db',
    [TILES.DIRT]: '#8d6e63',
    [TILES.WALL]: '#5d4037',
    [TILES.FLOOR]: '#a1887f',
    [TILES.COPPER]: '#d35400',
    [TILES.SILVER]: '#bdc3c7',
    [TILES.GOLD]: '#f1c40f',
    [TILES.DIAMOND]: '#00e5ff',
    [TILES.LADDER_UP]: '#e67e22',
    [TILES.LADDER_DOWN]: '#e67e22'
};

const SOLID_TILES = [TILES.TREE, TILES.STONE, TILES.WALL];

const MONSTERS = [];
const ANIMALS = [];
const FISH = [];
const VILLAGERS = [];
const GHOSTS = [];
const PARTICLES = [];

const WORLD = [[], []]; // [surface, underground]

function generateWorld() {
    // Surface
    for (let y = 0; y < MAP_ROWS; y++) {
        const row = [];
        for (let x = 0; x < MAP_COLS; x++) {
            let r = Math.random();
            if (r < 0.05) row.push(TILES.WATER);
            else if (r < 0.15) row.push(TILES.TREE);
            else if (r < 0.18) row.push(TILES.STONE);
            else row.push(TILES.GRASS);
        }
        WORLD[LAYERS.SURFACE].push(row);
    }

    // Underground
    for (let y = 0; y < MAP_ROWS; y++) {
        const row = [];
        for (let x = 0; x < MAP_COLS; x++) {
            let r = Math.random();
            if (r < 0.02) row.push(TILES.DIAMOND);
            else if (r < 0.05) row.push(TILES.GOLD);
            else if (r < 0.10) row.push(TILES.SILVER);
            else if (r < 0.20) row.push(TILES.COPPER);
            else if (r < 0.70) row.push(TILES.STONE);
            else row.push(TILES.DIRT);
        }
        WORLD[LAYERS.UNDERGROUND].push(row);
    }

    // Ladders (fixed positions for now)
    WORLD[LAYERS.SURFACE][10][10] = TILES.LADDER_DOWN;
    WORLD[LAYERS.UNDERGROUND][10][10] = TILES.LADDER_UP;

    // Add Houses
    for (let i = 0; i < 5; i++) {
        let hX = Math.floor(Math.random() * (MAP_COLS - 10)) + 5;
        let hY = Math.floor(Math.random() * (MAP_ROWS - 10)) + 5;
        buildHouse(hX, hY);
    }
}

function buildHouse(x, y) {
    const w = 5;
    const h = 4;
    for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
            if (dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1) {
                if (dx === Math.floor(w / 2) && dy === h - 1) {
                    WORLD[LAYERS.SURFACE][y + dy][x + dx] = TILES.FLOOR; // Doorway
                } else {
                    WORLD[LAYERS.SURFACE][y + dy][x + dx] = TILES.WALL;
                }
            } else {
                WORLD[LAYERS.SURFACE][y + dy][x + dx] = TILES.FLOOR;
            }
        }
    }
    // Spawn villager inside
    VILLAGERS.push({
        x: (x + 2) * TILE_SIZE + TILE_SIZE / 2,
        y: (y + 1) * TILE_SIZE + TILE_SIZE / 2,
        width: 25, height: 25,
        color: '#e67e22',
        name: '村民'
    });
}
generateWorld();

function spawnAnimal() {
    for (let i = 0; i < 20; i++) {
        let tX = Math.floor(Math.random() * MAP_COLS);
        let tY = Math.floor(Math.random() * MAP_ROWS);
        if (WORLD[LAYERS.SURFACE][tY][tX] === TILES.GRASS) {
            ANIMALS.push({
                x: tX * TILE_SIZE + TILE_SIZE / 2,
                y: tY * TILE_SIZE + TILE_SIZE / 2,
                width: 20, height: 20,
                speed: 50,
                color: '#ecf0f1',
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                lastMove: 0
            });
            return;
        }
    }
}

for (let i = 0; i < 10; i++) spawnAnimal();

function spawnFish() {
    for (let i = 0; i < 50; i++) {
        let tX = Math.floor(Math.random() * MAP_COLS);
        let tY = Math.floor(Math.random() * MAP_ROWS);
        if (WORLD[LAYERS.SURFACE][tY][tX] === TILES.WATER) {
            FISH.push({
                x: tX * TILE_SIZE + TILE_SIZE / 2,
                y: tY * TILE_SIZE + TILE_SIZE / 2,
                width: 15, height: 10,
                speed: 30,
                color: '#f39c12',
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                lastMove: 0
            });
            return;
        }
    }
}
for (let i = 0; i < 8; i++) spawnFish();

// Visual Effects

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
    level: 1,
    xp: 0,
    maxXp: 100,
    attack: 10,
    inventory: { wood: 0, copper: 0, silver: 0, gold: 0, diamond: 0, weapons: [] },
    equipped: null, // index in weapons array
    color: '#3498db', // Blue player
    flashTime: 0
};

const MONSTER_SPEED = 120;
const MONSTER_DAMAGE_BASE = 15;
const MONSTER_HP_BASE = 30;

let TIME = 0; // 0 to 24000 (typical minecraft-like cycle)
const DAY_LENGTH = 120000; // 2 minutes per day cycle

// Entities Setup Complete

function getDifficultyScale() {
    // Increase difficulty over time (every 1 minute) or by player level
    const timeScale = Math.floor(GAME.lastTime / 60000); // 1 = 1 minute
    return 1 + (timeScale * 0.2) + (PLAYER.level * 0.1);
}

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
                    if (WORLD[LAYERS.SURFACE][checkY][checkX] === TILES.GRASS) {
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

// Game State
const GAME = {
    state: 'PLAYING', // PLAYING, GAMEOVER
    lastTime: performance.now(),
    deltaTime: 0,
};

function spawnMonster() {
    const scale = getDifficultyScale();
    const hp = Math.floor(MONSTER_HP_BASE * scale);
    const damage = Math.floor(MONSTER_DAMAGE_BASE * scale);

    for (let i = 0; i < 50; i++) { // Max 50 attempts
        let tX = Math.floor(Math.random() * MAP_COLS);
        let tY = Math.floor(Math.random() * MAP_ROWS);
        if (WORLD[LAYERS.SURFACE][tY][tX] === TILES.GRASS) {
            let x = tX * TILE_SIZE + TILE_SIZE / 2;
            let y = tY * TILE_SIZE + TILE_SIZE / 2;
            // Don't spawn too close to player
            if (Math.hypot(x - PLAYER.x, y - PLAYER.y) > 400) {
                MONSTERS.push({
                    x, y,
                    width: 30, height: 30,
                    speed: MONSTER_SPEED + (Math.random() * 20),
                    hp: hp,
                    maxHp: hp,
                    damage: damage,
                    xpValue: Math.floor(10 * scale),
                    color: '#e74c3c',
                    lastAttackTime: 0,
                    flashTime: 0
                });
                return;
            }
        }
    }
}

function spawnGhost() {
    let x = PLAYER.x + (Math.random() - 0.5) * 800;
    let y = PLAYER.y + (Math.random() - 0.5) * 800;
    if (Math.hypot(x - PLAYER.x, y - PLAYER.y) > 300) {
        GHOSTS.push({
            x, y,
            width: 20, height: 20,
            speed: 80,
            lastAttackTime: 0
        });
    }
}

// Initial monsters
for (let i = 0; i < 15; i++) spawnMonster();

const CAMERA = {
    x: 0,
    y: 0
};

// Game State defined above where needed

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
        if (SOLID_TILES.includes(WORLD[CURRENT_LAYER][tY][tX])) return true;
    }
    return false;
}

const WEAPON_TYPES = {
    WOOD_SWORD: { name: "木剑", damage: 20, wood: 5, copper: 0, silver: 0, gold: 0, diamond: 0, color: '#8d6e63' },
    COPPER_SWORD: { name: "铜剑", damage: 40, wood: 2, copper: 10, silver: 0, gold: 0, diamond: 0, color: '#d35400' },
    SILVER_SWORD: { name: "银剑", damage: 70, wood: 2, copper: 0, silver: 8, gold: 0, diamond: 0, color: '#bdc3c7' },
    GOLD_SWORD: { name: "金剑", damage: 120, wood: 2, copper: 0, silver: 0, gold: 6, diamond: 0, color: '#f1c40f' },
    DIAMOND_SWORD: { name: "钻石剑", damage: 250, wood: 2, copper: 0, silver: 0, gold: 0, diamond: 4, color: '#00e5ff' }
};

function craftWeapon(typeKey) {
    const type = WEAPON_TYPES[typeKey];
    if (PLAYER.inventory.wood >= type.wood &&
        PLAYER.inventory.copper >= type.copper &&
        PLAYER.inventory.silver >= type.silver &&
        PLAYER.inventory.gold >= type.gold &&
        PLAYER.inventory.diamond >= type.diamond) {

        PLAYER.inventory.wood -= type.wood;
        PLAYER.inventory.copper -= type.copper;
        PLAYER.inventory.silver -= type.silver;
        PLAYER.inventory.gold -= type.gold;
        PLAYER.inventory.diamond -= type.diamond;

        PLAYER.inventory.weapons.push({ type: typeKey, level: 1 });
        updateHUD();
        spawnDamageNumber(PLAYER.x, PLAYER.y, `Crafted ${type.name}!`, false);
    }
}

function mergeWeapons() {
    console.log("Merge clicked! Current weapons:", JSON.parse(JSON.stringify(PLAYER.inventory.weapons)));

    // Find two identical weapons
    for (let i = 0; i < PLAYER.inventory.weapons.length; i++) {
        for (let j = i + 1; j < PLAYER.inventory.weapons.length; j++) {
            const w1 = PLAYER.inventory.weapons[i];
            const w2 = PLAYER.inventory.weapons[j];

            console.log(`Comparing [${i}] %o with [${j}] %o`, w1, w2);

            if (w1.type === w2.type && w1.level === w2.level) {
                w1.level++; // Upgrade first weapon
                PLAYER.inventory.weapons.splice(j, 1); // Remove second weapon

                // If the player had the deleted weapon equipped, or had a weapon after it equipped, adjust index
                if (PLAYER.equipped === j) {
                    PLAYER.equipped = i; // Switch to the upgraded one
                } else if (PLAYER.equipped > j) {
                    PLAYER.equipped--; // Shift index down
                }

                console.log(`Merged! New upgraded weapon:`, w1);
                spawnDamageNumber(PLAYER.x, PLAYER.y, `合成为 ${w1.level} 级!`, false);
                updateHUD();
                return;
            }
        }
    }
    spawnDamageNumber(PLAYER.x, PLAYER.y, "没有可合成的武器!", false);
}

// Restart Game
document.getElementById('restart-btn').addEventListener('click', () => {
    PLAYER.hp = PLAYER.maxHp;
    PLAYER.inventory.wood = 0;
    PLAYER.equipped = null;
    document.getElementById('wood-count').innerText = 0;
    document.getElementById('health-fill').style.width = '100%';

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

    // Calculate damage based on equipped weapon
    let attackDamage = PLAYER.attack;
    let attackRange = 60;

    if (PLAYER.equipped !== null) {
        const weapon = PLAYER.inventory.weapons[PLAYER.equipped];
        const base = WEAPON_TYPES[weapon.type];
        attackDamage += base.damage * weapon.level;
        attackRange = 90;
    }

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
                // Award XP
                PLAYER.xp += m.xpValue;
                spawnDamageNumber(PLAYER.x, PLAYER.y - 40, `+${m.xpValue} XP`, false);
                checkLevelUp();

                MONSTERS.splice(i, 1);
                setTimeout(spawnMonster, 3000);
            }
            actionDone = true;
            break;
        }
    }

    if (actionDone) return;

    // 1b. Try to hunt animals/fish for food (HP)
    for (let i = ANIMALS.length - 1; i >= 0; i--) {
        let a = ANIMALS[i];
        if (Math.hypot(PLAYER.x - a.x, PLAYER.y - a.y) < attackRange) {
            PLAYER.hp = Math.min(PLAYER.maxHp, PLAYER.hp + 15);
            spawnDamageNumber(a.x, a.y, "+15 HP (Meat)", false);
            ANIMALS.splice(i, 1);
            setTimeout(spawnAnimal, 5000);
            actionDone = true;
            break;
        }
    }
    if (!actionDone) {
        for (let i = FISH.length - 1; i >= 0; i--) {
            let f = FISH[i];
            if (Math.hypot(PLAYER.x - f.x, PLAYER.y - f.y) < attackRange) {
                PLAYER.hp = Math.min(PLAYER.maxHp, PLAYER.hp + 10);
                spawnDamageNumber(f.x, f.y, "+10 HP (Fish)", false);
                FISH.splice(i, 1);
                setTimeout(spawnFish, 5000);
                actionDone = true;
                break;
            }
        }
    }
    if (actionDone) { updateHUD(); return; }

    // 2. Try to move between layers (Ladders)
    const pTX = Math.floor(PLAYER.x / TILE_SIZE);
    const pTY = Math.floor(PLAYER.y / TILE_SIZE);
    const centerTile = WORLD[CURRENT_LAYER][pTY][pTX];

    if (centerTile === TILES.LADDER_DOWN) {
        CURRENT_LAYER = LAYERS.UNDERGROUND;
        spawnDamageNumber(PLAYER.x, PLAYER.y, "Descending...", false);
        actionDone = true;
    } else if (centerTile === TILES.LADDER_UP) {
        CURRENT_LAYER = LAYERS.SURFACE;
        spawnDamageNumber(PLAYER.x, PLAYER.y, "Ascending...", false);
        actionDone = true;
    }

    if (actionDone) return;

    // 3. Try to mine
    let closestTile = null;
    let minDistance = 80; // max gathering range

    for (let y = pTY - 2; y <= pTY + 2; y++) {
        for (let x = pTX - 2; x <= pTX + 2; x++) {
            if (x >= 0 && x < MAP_COLS && y >= 0 && y < MAP_ROWS) {
                const tile = WORLD[CURRENT_LAYER][y][x];

                // Skip unminable tiles
                if (![TILES.TREE, TILES.COPPER, TILES.SILVER, TILES.GOLD, TILES.DIAMOND, TILES.STONE].includes(tile)) continue;

                const tileCenterX = x * TILE_SIZE + TILE_SIZE / 2;
                const tileCenterY = y * TILE_SIZE + TILE_SIZE / 2;
                const dist = Math.hypot(PLAYER.x - tileCenterX, PLAYER.y - tileCenterY);

                if (dist < minDistance) {
                    closestTile = { x, y, tile, tileCenterX, tileCenterY };
                    minDistance = dist;
                }
            }
        }
    }

    if (closestTile) {
        const { x, y, tile, tileCenterX, tileCenterY } = closestTile;
        if (tile === TILES.TREE) {
            WORLD[CURRENT_LAYER][y][x] = TILES.GRASS;
            PLAYER.inventory.wood += 1;
            PARTICLES.push({ x: tileCenterX, y: tileCenterY, text: "+1 木头", life: 1.0, color: '#8e44ad', vy: -20 });
            actionDone = true;
        } else {
            let res = "石头";
            let color = "#7f8c8d";
            if (tile === TILES.COPPER) { res = "铜"; color = "#d35400"; PLAYER.inventory.copper++; }
            else if (tile === TILES.SILVER) { res = "银"; color = "#bdc3c7"; PLAYER.inventory.silver++; }
            else if (tile === TILES.GOLD) { res = "金"; color = "#f1c40f"; PLAYER.inventory.gold++; }
            else if (tile === TILES.DIAMOND) { res = "钻石"; color = "#00e5ff"; PLAYER.inventory.diamond++; }

            WORLD[CURRENT_LAYER][y][x] = (CURRENT_LAYER === LAYERS.SURFACE) ? TILES.GRASS : TILES.DIRT;
            PARTICLES.push({ x: tileCenterX, y: tileCenterY, text: tile === TILES.STONE ? "击碎石头" : `+1 ${res}`, life: 1.0, color: color, vy: -20 });
            actionDone = true;
        }

        if (actionDone) {
            updateHUD();
        }
    }
}

function checkLevelUp() {
    if (PLAYER.xp >= PLAYER.maxXp) {
        PLAYER.level++;
        PLAYER.xp -= PLAYER.maxXp;
        PLAYER.maxXp = Math.floor(PLAYER.maxXp * 1.5);
        PLAYER.maxHp += 20;
        PLAYER.hp = PLAYER.maxHp;
        PLAYER.attack += 5;
        spawnDamageNumber(PLAYER.x, PLAYER.y - 60, `LEVEL UP! (${PLAYER.level})`, false);
        document.getElementById('health-fill').style.width = '100%';
        updateHUD();
    } else {
        updateHUD();
    }
}

function updateHUD() {
    document.getElementById('wood-count').innerText = PLAYER.inventory.wood;
    document.getElementById('copper-count').innerText = PLAYER.inventory.copper;
    document.getElementById('silver-count').innerText = PLAYER.inventory.silver;
    document.getElementById('gold-count').innerText = PLAYER.inventory.gold;
    document.getElementById('diamond-count').innerText = PLAYER.inventory.diamond;
    document.getElementById('player-level').innerText = PLAYER.level;
    document.getElementById('player-xp').innerText = PLAYER.xp;
    document.getElementById('player-max-xp').innerText = PLAYER.maxXp;

    // Auto-equip if we have weapons but nothing equipped
    if (PLAYER.equipped === null && PLAYER.inventory.weapons.length > 0) {
        PLAYER.equipped = 0;
    }

    if (PLAYER.equipped !== null && PLAYER.inventory.weapons[PLAYER.equipped]) {
        const w = PLAYER.inventory.weapons[PLAYER.equipped];
        document.getElementById('env-weapon').innerText = `${WEAPON_TYPES[w.type].name} (+${w.level})`;
    } else {
        document.getElementById('env-weapon').innerText = "无";
    }
}

// Main Loop
function gameLoop(time) {
    let d = document.getElementById("debug-err");
    if (d) d.innerHTML = "W:" + canvas.width + " H:" + canvas.height + " Cx:" + Math.floor(CAMERA.x) + " T:" + Math.floor(time);

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

    // Update Time
    TIME = (time % DAY_LENGTH) / DAY_LENGTH; // 0 to 1

    // Update Ghosts (Night only)
    const isNight = TIME > 0.5;
    if (isNight && GHOSTS.length < 5 && Math.random() < 0.01) {
        spawnGhost();
    }

    for (let i = GHOSTS.length - 1; i >= 0; i--) {
        let g = GHOSTS[i];
        if (!isNight) {
            GHOSTS.splice(i, 1);
            continue;
        }
        let dx = PLAYER.x - g.x;
        let dy = PLAYER.y - g.y;
        let dist = Math.hypot(dx, dy);

        // Ghost movement (slow, phasing through walls)
        g.x += (dx / dist) * g.speed * dt;
        g.y += (dy / dist) * g.speed * dt;

        if (dist < 30 && time - g.lastAttackTime > 1500) {
            g.lastAttackTime = time;
            PLAYER.hp -= 20;
            spawnDamageNumber(PLAYER.x, PLAYER.y, 20, true);
            document.getElementById('health-fill').style.width = Math.max(0, (PLAYER.hp / PLAYER.maxHp) * 100) + '%';
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
            PLAYER.hp -= m.damage;
            document.getElementById('health-fill').style.width = Math.max(0, (PLAYER.hp / PLAYER.maxHp) * 100) + '%';

            PLAYER.flashTime = time;
            spawnDamageNumber(PLAYER.x, PLAYER.y, m.damage, true);

            if (PLAYER.hp <= 0) {
                GAME.state = 'GAMEOVER';
                document.getElementById('game-over-screen').classList.remove('hidden');
                endTouch({ preventDefault: () => { } });
                INPUT.action = false;
            }
        }
    }

    // Update Animals and Fish
    if (CURRENT_LAYER === LAYERS.SURFACE) {
        for (let a of ANIMALS) {
            if (time - a.lastMove > 2000) {
                a.vx = (Math.random() - 0.5) * 2;
                a.vy = (Math.random() - 0.5) * 2;
                a.lastMove = time;
            }
            let nx = a.x + a.vx * a.speed * dt;
            let ny = a.y + a.vy * a.speed * dt;
            if (!checkTileCollision(nx, ny, a.width, a.height)) {
                a.x = nx;
                a.y = ny;
            }
        }
        for (let f of FISH) {
            if (time - f.lastMove > 1500) {
                f.vx = (Math.random() - 0.5) * 2;
                f.vy = (Math.random() - 0.5) * 2;
                f.lastMove = time;
            }
            f.x += f.vx * f.speed * dt;
            f.y += f.vy * f.speed * dt;
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
    const targetCamX = PLAYER.x - (canvas.width || 800) / 2;
    const targetCamY = PLAYER.y - (canvas.height || 600) / 2;
    CAMERA.x += (targetCamX - CAMERA.x) * 10 * dt;
    CAMERA.y += (targetCamY - CAMERA.y) * 10 * dt;

    if (isNaN(CAMERA.x)) CAMERA.x = targetCamX;
    if (isNaN(CAMERA.y)) CAMERA.y = targetCamY;

    // Clamp camera
    CAMERA.x = Math.max(0, Math.min(CAMERA.x, MAP_COLS * TILE_SIZE - (canvas.width || 800)));
    CAMERA.y = Math.max(0, Math.min(CAMERA.y, MAP_ROWS * TILE_SIZE - (canvas.height || 600)));
}

function render(time) {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Night overlay
    const isNight = TIME > 0.5;
    const darkness = isNight ? (TIME - 0.5) * 2 : (0.5 - TIME) * 2; // Simple linear ramp
    const overlayAlpha = Math.max(0, Math.min(0.6, isNight ? (TIME - 0.5) * 1.2 : 0));

    if (GAME.state === 'PLAYING' || GAME.state === 'GAMEOVER') {
        const startCol = Math.max(0, Math.floor(CAMERA.x / TILE_SIZE));
        const endCol = Math.min(MAP_COLS, startCol + (canvas.width / TILE_SIZE) + 2);
        const startRow = Math.max(0, Math.floor(CAMERA.y / TILE_SIZE));
        const endRow = Math.min(MAP_ROWS, startRow + (canvas.height / TILE_SIZE) + 2);

        // Draw World
        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const tile = WORLD[CURRENT_LAYER][y][x];
                const screenX = x * TILE_SIZE - CAMERA.x;
                const screenY = y * TILE_SIZE - CAMERA.y;

                // 1. Draw base shadow/depth (3D effect)
                if (SOLID_TILES.includes(tile) || tile === TILES.DIRT) {
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.fillRect(screenX, screenY + 5, TILE_SIZE, TILE_SIZE);
                }

                // 2. Draw tile top
                ctx.fillStyle = TILE_COLORS[tile];
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

                // 3. Decorative details
                if (tile === TILES.TREE) {
                    ctx.fillStyle = '#1e8449';
                    ctx.beginPath();
                    ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2 - 5, TILE_SIZE / 2.5, 0, Math.PI * 2);
                    ctx.fill();
                    // Trunk shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(screenX + TILE_SIZE / 2 - 5, screenY + TILE_SIZE / 2, 10, 15);
                } else if (tile === TILES.STONE || [TILES.COPPER, TILES.SILVER, TILES.GOLD, TILES.DIAMOND].includes(tile)) {
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    ctx.fillRect(screenX + 5, screenY + 5, TILE_SIZE - 10, 10);
                } else if (tile === TILES.LADDER_DOWN || tile === TILES.LADDER_UP) {
                    ctx.fillStyle = '#8e44ad';
                    ctx.fillRect(screenX + 5, screenY + 5, TILE_SIZE - 10, TILE_SIZE - 10);
                    ctx.strokeStyle = '#fff';
                    ctx.strokeRect(screenX + 10, screenY + 10, TILE_SIZE - 20, TILE_SIZE - 20);
                } else if (tile === TILES.WATER) {
                    // Shine effect
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(screenX + 30, screenY + 10, 10, 2);
                }
            }
        }

        // Draw Animals
        if (CURRENT_LAYER === LAYERS.SURFACE) {
            for (let a of ANIMALS) {
                ctx.fillStyle = a.color;
                ctx.fillRect(a.x - a.width / 2 - CAMERA.x, a.y - a.height / 2 - CAMERA.y, a.width, a.height);
            }
            for (let v of VILLAGERS) {
                ctx.fillStyle = v.color;
                ctx.fillRect(v.x - v.width / 2 - CAMERA.x, v.y - v.height / 2 - CAMERA.y, v.width, v.height);
                ctx.fillStyle = '#fff';
                ctx.font = '10px Arial';
                ctx.fillText(v.name, v.x - 15 - CAMERA.x, v.y - 20 - CAMERA.y);
            }
            for (let f of FISH) {
                ctx.fillStyle = f.color;
                ctx.fillRect(f.x - f.width / 2 - CAMERA.x, f.y - f.height / 2 - CAMERA.y, f.width, f.height);
            }
        }

        // Draw Ghosts
        for (let g of GHOSTS) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(g.x - CAMERA.x, g.y - CAMERA.y, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
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

                if (PLAYER.equipped !== null) {
                    const timeSwing = (time - lastActionTime);
                    const weaponObj = PLAYER.inventory.weapons[PLAYER.equipped];
                    const weaponType = WEAPON_TYPES[weaponObj.type];

                    ctx.save();
                    ctx.translate(PLAYER.x - CAMERA.x, PLAYER.y - CAMERA.y);

                    ctx.fillStyle = weaponType.color;
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
                    ctx.fillStyle = weaponType.color;
                    ctx.fillRect(0, -25, 5, 30);

                    // Level indicator
                    ctx.fillStyle = '#fff';
                    ctx.font = '10px Arial';
                    ctx.fillText(`+${weaponObj.level}`, 0, 0);

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
        ctx.save();
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
        ctx.restore();


        // Night Overlay
        if (overlayAlpha > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
}

// Initial UI setup
// (Handled dynamically in updateHUD)

let dErr = document.getElementById("debug-err");
if (dErr) dErr.innerHTML += "Script Reached End<br>";

// Start
requestAnimationFrame(gameLoop);
