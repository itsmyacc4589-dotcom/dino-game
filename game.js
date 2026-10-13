// Modern Canvas Dino Runner Engine
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM UI Elements
const currentScoreEl = document.getElementById('current-score-val');
const highScoreEl = document.getElementById('high-score-val');
const speedValEl = document.getElementById('speed-val');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScoreEl = document.getElementById('final-score');
const newRecordTag = document.getElementById('new-record-tag');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const soundIcon = document.getElementById('sound-icon');
const btnJump = document.getElementById('btn-jump');
const btnDuck = document.getElementById('btn-duck');

// Audio Synthesizer via Web Audio API (zero external assets needed)
class SoundFx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  jump() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sine';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.12);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  scoreMilestone() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.18, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.08 + 0.15);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.16);
    });
  }

  shield() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.25);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  hit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.28);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.28);
    osc.start(now);
    osc.stop(now + 0.29);
  }
}

const audio = new SoundFx();

// Game State Constants
const GROUND_Y = 270;
const GRAVITY = 0.65;
const BASE_SPEED = 6.0;
const MAX_SPEED = 14.0;

// Game State Variables
let gameState = 'IDLE'; // IDLE, RUNNING, GAMEOVER, PAUSED
let score = 0;
let highScore = parseInt(localStorage.getItem('cyber_dino_hi_score') || '0', 10);
let speed = BASE_SPEED;
let frameCount = 0;
let particles = [];
let obstacles = [];
let clouds = [];
let stars = [];
let powerups = [];

// High score initial display
highScoreEl.textContent = String(highScore).padStart(5, '0');

// Input tracking
const keys = {
  jump: false,
  duck: false,
};

// Player Object
const dino = {
  x: 50,
  y: GROUND_Y,
  width: 44,
  height: 48,
  duckHeight: 28,
  vy: 0,
  isJumping: false,
  isDucking: false,
  hasShield: false,
  shieldTimer: 0,
  runLeg: 0,
  legTimer: 0,

  reset() {
    this.x = 60;
    this.y = GROUND_Y - this.height;
    this.vy = 0;
    this.isJumping = false;
    this.isDucking = false;
    this.hasShield = false;
    this.shieldTimer = 0;
    this.runLeg = 0;
  },

  jump() {
    if (!this.isJumping && !this.isDucking) {
      this.vy = -12.5;
      this.isJumping = true;
      audio.jump();
      createDustParticles(this.x + 15, GROUND_Y, 8);
    }
  },

  update() {
    // Ducking logic
    if (keys.duck && !this.isJumping) {
      this.isDucking = true;
    } else {
      this.isDucking = false;
    }

    // Fast-drop if ducking while in air
    if (this.isJumping && keys.duck) {
      this.vy += 1.2;
    }

    const currentHeight = this.isDucking ? this.duckHeight : this.height;

    // Apply gravity
    if (this.isJumping) {
      this.vy += GRAVITY;
      this.y += this.vy;

      if (this.y + currentHeight >= GROUND_Y) {
        this.y = GROUND_Y - currentHeight;
        this.vy = 0;
        this.isJumping = false;
        createDustParticles(this.x + 20, GROUND_Y, 6);
      }
    } else {
      this.y = GROUND_Y - currentHeight;
    }

    // Shield duration countdown
    if (this.hasShield) {
      this.shieldTimer--;
      if (this.shieldTimer <= 0) {
        this.hasShield = false;
      }
    }

    // Leg animation cycling
    this.legTimer++;
    if (this.legTimer > Math.max(3, 8 - Math.floor(speed * 0.35))) {
      this.runLeg = 1 - this.runLeg;
      this.legTimer = 0;
    }
  },

  draw() {
    ctx.save();

    const currentHeight = this.isDucking ? this.duckHeight : this.height;
    const px = this.x;
    const py = this.y;

    // Shield Aura
    if (this.hasShield) {
      ctx.beginPath();
      ctx.arc(px + this.width / 2, py + currentHeight / 2, 34, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 + Math.sin(frameCount * 0.15) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#10b981'; // Cyber Neon Green Dino

    if (this.isDucking) {
      // Ducking Dino Sprite Rendering
      // Head & snout
      ctx.fillRect(px + 28, py + 4, 26, 14);
      // Eye
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(px + 44, py + 6, 3, 3);
      ctx.fillStyle = '#10b981';
      // Body
      ctx.fillRect(px + 10, py + 10, 30, 14);
      // Tail
      ctx.fillRect(px, py + 8, 12, 10);
      // Legs
      if (this.runLeg === 0) {
        ctx.fillRect(px + 16, py + 22, 6, 6);
        ctx.fillRect(px + 28, py + 24, 6, 4);
      } else {
        ctx.fillRect(px + 16, py + 24, 6, 4);
        ctx.fillRect(px + 28, py + 22, 6, 6);
      }
    } else {
      // Standing / Jumping Dino
      // Head
      ctx.fillRect(px + 20, py, 22, 18);
      // Snout
      ctx.fillRect(px + 32, py + 4, 12, 10);
      // Eye
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(px + 34, py + 4, 4, 4);
      ctx.fillStyle = '#10b981';
      // Jaw
      ctx.fillRect(px + 24, py + 18, 14, 4);
      // Body
      ctx.fillRect(px + 10, py + 16, 18, 22);
      // Tail
      ctx.fillRect(px, py + 20, 12, 14);
      ctx.fillRect(px - 4, py + 16, 6, 8);
      // Arm
      ctx.fillRect(px + 28, py + 24, 6, 4);

      // Running legs
      if (this.isJumping) {
        ctx.fillRect(px + 12, py + 38, 4, 8);
        ctx.fillRect(px + 22, py + 38, 4, 8);
      } else if (this.runLeg === 0) {
        ctx.fillRect(px + 12, py + 38, 5, 10);
        ctx.fillRect(px + 22, py + 38, 5, 5);
      } else {
        ctx.fillRect(px + 12, py + 38, 5, 5);
        ctx.fillRect(px + 22, py + 38, 5, 10);
      }
    }

    ctx.restore();
  },

  getBounds() {
    const curH = this.isDucking ? this.duckHeight : this.height;
    // Tighter hitbox for fair play
    return {
      x: this.x + 4,
      y: this.y + 4,
      width: (this.isDucking ? 52 : this.width) - 8,
      height: curH - 6
    };
  }
};

// Particles (Run dust & collision sparks)
function createDustParticles(x, y, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y - 2,
      vx: -(speed * 0.4) - Math.random() * 2,
      vy: -(Math.random() * 2 + 0.5),
      size: Math.random() * 3 + 1.5,
      alpha: 1,
      color: '#64748b'
    });
  }
}

function createHitParticles(x, y) {
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      size: Math.random() * 4 + 2,
      alpha: 1,
      color: ['#f43f5e', '#fbbf24', '#06b6d4'][Math.floor(Math.random() * 3)]
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.035;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.restore();
  });
}

// Background Atmosphere (Stars & Clouds)
function initEnvironment() {
  stars = [];
  clouds = [];
  for (let i = 0; i < 35; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * (GROUND_Y - 50),
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.6 + 0.2
    });
  }
  for (let i = 0; i < 4; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: 30 + Math.random() * 80,
      width: 50 + Math.random() * 40,
      speed: 0.4 + Math.random() * 0.5
    });
  }
}

function updateEnvironment() {
  clouds.forEach(c => {
    c.x -= c.speed;
    if (c.x + c.width < 0) {
      c.x = canvas.width + 40;
      c.y = 30 + Math.random() * 80;
    }
  });
}

function drawEnvironment() {
  // Stars
  stars.forEach(s => {
    ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha * (0.6 + Math.sin(frameCount * 0.05 + s.x) * 0.4)})`;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });

  // Cyber Clouds / Data strips
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  clouds.forEach(c => {
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.width, 14, 6);
    ctx.fill();
  });

  // Ground Line with Tech Hatch Marks
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(canvas.width, GROUND_Y);
  ctx.stroke();

  // Moving ground dashes
  const offset = (frameCount * speed) % 24;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -offset; x < canvas.width; x += 24) {
    ctx.moveTo(x, GROUND_Y + 5);
    ctx.lineTo(x + 10, GROUND_Y + 5);
  }
  ctx.stroke();
}

// Obstacles Factory & Classes
class Cactus {
  constructor(x, type) {
    this.x = x;
    this.type = type; // 0: single, 1: double, 2: tall
    this.y = GROUND_Y;
    if (type === 0) {
      this.width = 18;
      this.height = 36;
    } else if (type === 1) {
      this.width = 34;
      this.height = 38;
    } else {
      this.width = 24;
      this.height = 50;
    }
    this.y = GROUND_Y - this.height;
  }

  update() {
    this.x -= speed;
  }

  draw() {
    ctx.save();
    ctx.fillStyle = '#06b6d4'; // Cyan neon cactus
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 6;

    if (this.type === 0) {
      // Single cactus
      ctx.fillRect(this.x + 5, this.y, 8, this.height);
      ctx.fillRect(this.x, this.y + 10, 6, 14);
      ctx.fillRect(this.x + 12, this.y + 14, 6, 12);
    } else if (this.type === 1) {
      // Double cactus
      ctx.fillRect(this.x + 4, this.y + 4, 8, this.height - 4);
      ctx.fillRect(this.x, this.y + 12, 5, 12);
      ctx.fillRect(this.x + 20, this.y, 8, this.height);
      ctx.fillRect(this.x + 27, this.y + 10, 5, 12);
    } else {
      // Tall Cactus
      ctx.fillRect(this.x + 8, this.y, 9, this.height);
      ctx.fillRect(this.x, this.y + 14, 9, 14);
      ctx.fillRect(this.x + 16, this.y + 20, 8, 14);
    }

    ctx.restore();
  }

  getBounds() {
    return {
      x: this.x + 2,
      y: this.y + 2,
      width: this.width - 4,
      height: this.height - 2
    };
  }
}

class Pterodactyl {
  constructor(x, heightMode) {
    this.x = x;
    this.width = 40;
    this.height = 28;
    // heightMode 0: Low (must jump or duck), 1: High (must duck)
    this.y = heightMode === 0 ? GROUND_Y - 42 : GROUND_Y - 70;
    this.wingFrame = 0;
  }

  update() {
    this.x -= speed * 1.15; // slightly faster than ground speed
    if (frameCount % 10 === 0) {
      this.wingFrame = 1 - this.wingFrame;
    }
  }

  draw() {
    ctx.save();
    ctx.fillStyle = '#f43f5e'; // Rose/Red Cyber Bird
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 8;

    // Bird Body & Beak
    ctx.fillRect(this.x + 10, this.y + 8, 20, 10);
    ctx.fillRect(this.x, this.y + 6, 10, 6);

    // Eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(this.x + 6, this.y + 7, 2, 2);
    ctx.fillStyle = '#f43f5e';

    // Animated Wings
    if (this.wingFrame === 0) {
      // Wings Up
      ctx.fillRect(this.x + 14, this.y - 10, 8, 18);
    } else {
      // Wings Down
      ctx.fillRect(this.x + 14, this.y + 16, 8, 14);
    }

    ctx.restore();
  }

  getBounds() {
    return {
      x: this.x + 3,
      y: this.y + 2,
      width: this.width - 6,
      height: this.height - 4
    };
  }
}

class ShieldPowerup {
  constructor(x) {
    this.x = x;
    this.y = GROUND_Y - 60;
    this.width = 24;
    this.height = 24;
  }

  update() {
    this.x -= speed;
    this.floatY = Math.sin(frameCount * 0.1) * 6;
  }

  draw() {
    ctx.save();
    const curY = this.y + (this.floatY || 0);
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;

    // Diamond Shield Icon
    ctx.beginPath();
    ctx.moveTo(this.x + 12, curY);
    ctx.lineTo(this.x + 24, curY + 12);
    ctx.lineTo(this.x + 12, curY + 24);
    ctx.lineTo(this.x, curY + 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText('⚡', this.x + 6, curY + 16);
    ctx.restore();
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }
}

// Spawning Obstacles & Items
let nextSpawnDistance = 75;

function manageSpawns() {
  nextSpawnDistance--;
  if (nextSpawnDistance <= 0) {
    const minDistance = Math.max(50, 85 - Math.floor(speed * 2));
    nextSpawnDistance = minDistance + Math.floor(Math.random() * 45);

    const rand = Math.random();
    if (rand < 0.65) {
      // Cactus
      const type = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 1 : 2);
      obstacles.push(new Cactus(canvas.width + 20, type));
    } else if (rand < 0.90 && score > 200) {
      // Pterodactyl (appears after score 200)
      const heightMode = Math.random() < 0.5 ? 0 : 1;
      obstacles.push(new Pterodactyl(canvas.width + 20, heightMode));
    } else if (score > 100 && powerups.length === 0 && Math.random() < 0.25) {
      // Shield Powerup
      powerups.push(new ShieldPowerup(canvas.width + 20));
    }
  }
}

// Collision Detection Box-Box
function checkCollision(r1, r2) {
  return !(
    r1.x + r1.width < r2.x ||
    r1.x > r2.x + r2.width ||
    r1.y + r1.height < r2.y ||
    r1.y > r2.y + r2.height
  );
}

// Game Loop
function gameLoop() {
  frameCount++;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  drawEnvironment();

  if (gameState === 'RUNNING') {
    // Increase speed gradually
    speed = Math.min(MAX_SPEED, BASE_SPEED + (score / 400));
    speedValEl.textContent = (speed / BASE_SPEED).toFixed(1) + 'x';

    // Score accumulation
    if (frameCount % 4 === 0) {
      score++;
      currentScoreEl.textContent = String(score).padStart(5, '0');
      // Score milestone ding
      if (score > 0 && score % 100 === 0) {
        audio.scoreMilestone();
      }
    }

    updateEnvironment();
    dino.update();
    manageSpawns();

    // Update & check powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.update();
      if (checkCollision(dino.getBounds(), p.getBounds())) {
        dino.hasShield = true;
        dino.shieldTimer = 320; // ~5 seconds of shield
        audio.shield();
        powerups.splice(i, 1);
        continue;
      }
      if (p.x + p.width < -30) {
        powerups.splice(i, 1);
      }
    }

    // Update obstacles & check collisions
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.update();

      if (checkCollision(dino.getBounds(), obs.getBounds())) {
        if (dino.hasShield) {
          // Shield absorbs hit
          dino.hasShield = false;
          dino.shieldTimer = 0;
          createHitParticles(obs.x + 10, obs.y + 10);
          audio.hit();
          obstacles.splice(i, 1);
          continue;
        } else {
          // Game Over
          handleGameOver();
          break;
        }
      }

      if (obs.x + obs.width < -30) {
        obstacles.splice(i, 1);
      }
    }

    updateParticles();
  }

  // Draw entities
  dino.draw();
  obstacles.forEach(o => o.draw());
  powerups.forEach(p => p.draw());
  drawParticles();

  requestAnimationFrame(gameLoop);
}

function startGame() {
  audio.init();
  gameState = 'RUNNING';
  score = 0;
  speed = BASE_SPEED;
  obstacles = [];
  powerups = [];
  particles = [];
  nextSpawnDistance = 60;
  currentScoreEl.textContent = '00000';
  speedValEl.textContent = '1.0x';
  dino.reset();

  startScreen.classList.remove('active');
  startScreen.classList.add('hidden');
  gameOverScreen.classList.remove('active');
  gameOverScreen.classList.add('hidden');
}

function handleGameOver() {
  gameState = 'GAMEOVER';
  audio.hit();
  createHitParticles(dino.x + 20, dino.y + 20);

  finalScoreEl.textContent = score;

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('cyber_dino_hi_score', highScore);
    highScoreEl.textContent = String(highScore).padStart(5, '0');
    newRecordTag.classList.remove('hidden');
  } else {
    newRecordTag.classList.add('hidden');
  }

  gameOverScreen.classList.remove('hidden');
  setTimeout(() => {
    gameOverScreen.classList.add('active');
  }, 10);
}

// Event Listeners for Controls
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (gameState === 'RUNNING') {
      dino.jump();
    } else if (gameState === 'IDLE' || gameState === 'GAMEOVER') {
      startGame();
    }
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    if (gameState === 'RUNNING') {
      keys.duck = true;
    }
  } else if (e.code === 'KeyP') {
    if (gameState === 'RUNNING') gameState = 'PAUSED';
    else if (gameState === 'PAUSED') gameState = 'RUNNING';
  } else if (e.code === 'KeyM') {
    toggleSound();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown') {
    keys.duck = false;
  }
});

// UI Button Handlers
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function toggleSound() {
  audio.enabled = !audio.enabled;
  soundIcon.textContent = audio.enabled ? '🔊' : '🔇';
}
soundToggleBtn.addEventListener('click', toggleSound);

// Mobile / Onscreen Buttons
btnJump.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState === 'RUNNING') dino.jump();
  else if (gameState === 'IDLE' || gameState === 'GAMEOVER') startGame();
});
btnJump.addEventListener('mousedown', () => {
  if (gameState === 'RUNNING') dino.jump();
  else if (gameState === 'IDLE' || gameState === 'GAMEOVER') startGame();
});

btnDuck.addEventListener('touchstart', (e) => {
  e.preventDefault();
  keys.duck = true;
});
btnDuck.addEventListener('touchend', (e) => {
  e.preventDefault();
  keys.duck = false;
});
btnDuck.addEventListener('mousedown', () => { keys.duck = true; });
btnDuck.addEventListener('mouseup', () => { keys.duck = false; });
btnDuck.addEventListener('mouseleave', () => { keys.duck = false; });

// Canvas Tap / Click to jump or restart
canvas.addEventListener('pointerdown', (e) => {
  if (gameState === 'RUNNING') {
    dino.jump();
  } else if (gameState === 'IDLE' || gameState === 'GAMEOVER') {
    startGame();
  }
});

// Initialization
initEnvironment();
dino.reset();
requestAnimationFrame(gameLoop);
