// ============================================================
// CyberStack — Arcade Tower Stack Game
// Pure HTML5 Canvas, no external libraries
// ============================================================

(function () {
  "use strict";

  // ---- Arne16 Color Palette ----
  const C = {
    BLACK:      "#000000",
    GRAY:       "#9D9D9D",
    WHITE:      "#FFFFFF",
    RED:        "#BE2633",
    PINK:       "#E06F8B",
    DBROWN:     "#493C2B",
    BROWN:      "#A46422",
    ORANGE:     "#EB8931",
    YELLOW:     "#F7E26B",
    DTEAL:      "#2F484E",
    GREEN:      "#44891A",
    LIME:       "#A3CE27",
    NAVY:       "#1B2632",
    BLUE:       "#005784",
    LIGHTBLUE:  "#31A2F2",
    CYAN:       "#B2DCFF",
  };

  // Block colors cycle (neon-ish palette subset)
  const BLOCK_COLORS = [
    C.LIGHTBLUE, C.CYAN, C.LIME, C.ORANGE, C.PINK, C.YELLOW,
    C.BLUE, C.GREEN, C.RED, C.GRAY,
  ];

  // ---- Game Constants ----
  const BLOCK_HEIGHT_RATIO = 0.035;   // block height as fraction of reference scale S
  const INITIAL_WIDTH_RATIO = 0.55;    // starting block width fraction of S
  const BASE_SPEED = 3.36;              // base horizontal speed at 720p
  const SPEED_INCREMENT = 0.12;        // speed increase per block
  const MAX_SPEED = 9;
  const SCROLL_THRESHOLD = 12;         // start scrolling camera after this many blocks
  const PARTICLE_COUNT = 18;           // particles per slice
  const PERFECT_THRESHOLD = 0.015;     // tolerance fraction of S for "perfect" stack
  const GLOW_PULSE_MIN = 0.6;
  const GLOW_PULSE_MAX = 1.0;

  // ---- Game States ----
  const STATE = { TITLE: 0, PLAYING: 1, GAME_OVER: 2 };

  // ---- Game State ----
  let state = STATE.TITLE;
  let blocks = [];          // stacked blocks: {x, y, w, h, normW, normOffset, color, glow}
  let activeBlock = null;   // the currently moving block
  let particles = [];       // {x, y, vx, vy, life, color, size}
  let score = 0;
  let highScore = parseInt(localStorage.getItem("cyberstack_high") || "0", 10);
  let combo = 0;            // consecutive "perfect" stacks
  let cameraY = 0;          // vertical camera offset
  let shakeAmount = 0;      // screen shake
  let perfectFlash = 0;     // perfect stack flash timer
  let titlePulse = 0;       // title animation timer
  let gameOverTimer = 0;    // time since game over for animation
  let fallingBlock = null;  // the block that fell (for game-over anim)
  let lastTimestamp = 0;

  // ---- Canvas & Viewport Setup ----
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  let W = 0;                // logical viewport width
  let H = 0;                // logical viewport height
  let S = 0;                // reference scale factor: min(W, H)
  let DPR = Math.min(window.devicePixelRatio || 1, 2);

  // ---- Utility ----
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

  // ---- Responsive Dimensions & Play Corridor ----
  function blockH() { return S * BLOCK_HEIGHT_RATIO; }
  function initialW() { return S * INITIAL_WIDTH_RATIO; }
  function getBaseY(h = H, s = S) {
    return h - s * BLOCK_HEIGHT_RATIO - s * 0.08;
  }
  function playLeft() { return (W - S) / 2; }
  function playRight() { return (W + S) / 2; }
  function currentSpeed() {
    return clamp(BASE_SPEED + score * SPEED_INCREMENT, BASE_SPEED, MAX_SPEED) * (S / 720);
  }

  function resize() {
    const oldW = W;
    const oldH = H;
    const oldS = S;
    const oldDPR = DPR;

    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    S = Math.min(W, H);

    if (oldS > 0 && W === oldW && H === oldH && DPR === oldDPR) {
      return;
    }

    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    if (oldS > 0) {
      const scale = S / oldS;
      const oldBaseY = getBaseY(oldH, oldS);
      const newBaseY = getBaseY(H, S);
      const bh = blockH();

      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.normW === undefined) {
          b.normW = b.w / oldS;
          b.normOffset = ((b.x + b.w / 2) - oldW / 2) / oldS;
        }
        b.w = b.normW * S;
        b.h = bh;
        b.x = W / 2 + b.normOffset * S - b.w / 2;
        b.y = newBaseY - i * bh;
      }

      cameraY = Math.max(0, (blocks.length - SCROLL_THRESHOLD) * bh);

      if (activeBlock) {
        if (activeBlock.normW === undefined) {
          activeBlock.normW = activeBlock.w / oldS;
          activeBlock.normOffset = ((activeBlock.x + activeBlock.w / 2) - oldW / 2) / oldS;
        }
        activeBlock.w = activeBlock.normW * S;
        activeBlock.h = bh;
        activeBlock.y = newBaseY - blocks.length * bh;
        activeBlock.x = W / 2 + activeBlock.normOffset * S - activeBlock.w / 2;
        activeBlock.speed = currentSpeed();

        const pastEdge = activeBlock.w * 0.3;
        if (activeBlock.x < playLeft() - activeBlock.w - pastEdge ||
            activeBlock.x > playRight() + pastEdge) {
          activeBlock.x = clamp(activeBlock.x, playLeft() - activeBlock.w, playRight());
        }
        activeBlock.normOffset = ((activeBlock.x + activeBlock.w / 2) - W / 2) / S;
      }

      if (fallingBlock) {
        fallingBlock.x = W / 2 + (fallingBlock.x - oldW / 2) * scale;
        fallingBlock.y = newBaseY + (fallingBlock.y - oldBaseY) * scale;
        fallingBlock.w *= scale;
        fallingBlock.h = bh;
        fallingBlock.vy *= scale;
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x = W / 2 + (p.x - oldW / 2) * scale;
        p.y = newBaseY + (p.y - oldBaseY) * scale;
        p.vx *= scale;
        p.vy *= scale;
        p.size *= scale;
      }
    }

    render();
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }
  resize();

  // ---- Particle System ----
  function spawnParticles(x, y, w, h, color, dir) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: x + rand(-w * 0.1, w * 1.1),
        y: y + rand(0, h),
        vx: dir > 0 ? rand(1, 5) : rand(-5, -1),
        vy: rand(-3, -0.5),
        life: 1,
        decay: rand(0.015, 0.04),
        color: color,
        size: rand(2, 6),
      });
    }
    // Sparkle particles
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: x + rand(0, w),
        y: y + rand(0, h),
        vx: rand(-3, 3),
        vy: rand(-4, -1),
        life: 1,
        decay: rand(0.02, 0.05),
        color: C.WHITE,
        size: rand(1, 3),
      });
    }
  }

  function updateParticles(dt) {
    const gravScale = S / 720;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += 0.12 * gravScale * dt * 60; // gravity
      p.life -= p.decay * dt * 60;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ---- Input Handling ----
  let inputPressed = false;

  function handleInput() {
    if (state === STATE.TITLE) {
      startGame();
    } else if (state === STATE.PLAYING) {
      dropBlock();
    } else if (state === STATE.GAME_OVER && gameOverTimer > 0.8) {
      startGame();
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (!inputPressed) {
        inputPressed = true;
        handleInput();
      }
    }
  });
  document.addEventListener("keyup", function (e) {
    if (e.code === "Space" || e.code === "Enter") {
      inputPressed = false;
    }
  });

  canvas.addEventListener("mousedown", function (e) {
    e.preventDefault();
    handleInput();
  });
  canvas.addEventListener("touchstart", function (e) {
    e.preventDefault();
    handleInput();
  }, { passive: false });

  // ---- Game Start / Reset ----
  function startGame() {
    state = STATE.PLAYING;
    blocks = [];
    particles = [];
    score = 0;
    combo = 0;
    cameraY = 0;
    shakeAmount = 0;
    perfectFlash = 0;
    gameOverTimer = 0;
    fallingBlock = null;

    // Place the base block centered at the bottom
    const bh = blockH();
    const bw = initialW();
    const baseY = getBaseY();

    blocks.push({
      x: (W - bw) / 2,
      y: baseY,
      w: bw,
      h: bh,
      normW: INITIAL_WIDTH_RATIO,
      normOffset: 0,
      color: BLOCK_COLORS[0],
      glow: 0.8,
    });

    // Create the first moving block
    spawnActiveBlock(1);
  }

  function spawnActiveBlock(index) {
    const bh = blockH();
    const prev = blocks[blocks.length - 1];
    activeBlock = {
      x: 0,
      y: prev.y - bh,
      w: prev.w,
      h: bh,
      normW: prev.normW,
      normOffset: 0,
      color: BLOCK_COLORS[index % BLOCK_COLORS.length],
      dir: index % 2 === 1 ? 1 : -1,  // alternate direction
      speed: currentSpeed(),
    };
    // Start from the edge of the centered play corridor based on direction
    activeBlock.x = activeBlock.dir > 0 ? playLeft() - activeBlock.w : playRight();
    activeBlock.normOffset = ((activeBlock.x + activeBlock.w / 2) - W / 2) / S;
  }

  // ---- Drop Block Logic ----
  function dropBlock() {
    if (!activeBlock) return;

    const ab = activeBlock;
    const prev = blocks[blocks.length - 1];

    // Calculate overlap
    const overlapLeft  = Math.max(ab.x, prev.x);
    const overlapRight = Math.min(ab.x + ab.w, prev.x + prev.w);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      // Missed! Game over.
      fallingBlock = {
        x: ab.x, y: ab.y, w: ab.w, h: ab.h,
        color: ab.color, vy: 0, rot: 0,
      };
      activeBlock = null;
      state = STATE.GAME_OVER;
      gameOverTimer = 0;
      shakeAmount = 8;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("cyberstack_high", highScore);
      }
      return;
    }

    // Check for "perfect" stack (very close alignment)
    const misalign = Math.min(
      Math.abs(ab.x - prev.x),
      Math.abs((ab.x + ab.w) - (prev.x + prev.w))
    );
    const isPerfect = misalign < PERFECT_THRESHOLD * S;

    // Create the placed block from the overlap region
    const placed = {
      x: overlapLeft,
      y: ab.y,
      w: overlapWidth,
      h: ab.h,
      normW: 0,
      normOffset: 0,
      color: ab.color,
      glow: isPerfect ? 1.2 : 0.8,
    };
    blocks.push(placed);
    score++;
    if (isPerfect) {
      combo++;
      perfectFlash = 1;
      // Restore width on perfect stack!
      placed.w = prev.w;
      placed.x = prev.x;
      shakeAmount = 2;
    } else {
      combo = 0;
      shakeAmount = 3;
    }
    placed.normW = placed.w / S;
    placed.normOffset = ((placed.x + placed.w / 2) - W / 2) / S;

    // Spawn particles from the sliced-off portion
    if (ab.x < prev.x) {
      // Left slice
      spawnParticles(ab.x, ab.y, prev.x - ab.x, ab.h, ab.color, -1);
    }
    if (ab.x + ab.w > prev.x + prev.w) {
      // Right slice
      const sliceX = prev.x + prev.w;
      spawnParticles(sliceX, ab.y, (ab.x + ab.w) - sliceX, ab.h, ab.color, 1);
    }

    // Perfect bonus particles
    if (isPerfect) {
      for (let i = 0; i < 20; i++) {
        particles.push({
          x: placed.x + rand(0, placed.w),
          y: placed.y + rand(0, placed.h),
          vx: rand(-4, 4),
          vy: rand(-5, -1),
          life: 1,
          decay: rand(0.01, 0.03),
          color: C.YELLOW,
          size: rand(2, 5),
        });
      }
    }

    // Scroll camera: fixed after 12 blocks, then one block height per new block
    cameraY = Math.max(0, (blocks.length - SCROLL_THRESHOLD) * blockH());

    // Spawn next active block
    spawnActiveBlock(blocks.length);
  }

  // ---- Update ----
  function update(dt) {
    titlePulse += dt * 3;
    shakeAmount *= Math.pow(0.01, dt);
    if (shakeAmount < 0.1) shakeAmount = 0;

    if (state === STATE.PLAYING && activeBlock) {
      activeBlock.x += activeBlock.dir * activeBlock.speed * dt * 60;

      // Bounce off play corridor edges (go past a bit for visual effect)
      const pastEdge = activeBlock.w * 0.3;
      if (activeBlock.dir > 0 && activeBlock.x > playRight() + pastEdge) {
        activeBlock.dir = -1;
      } else if (activeBlock.dir < 0 && activeBlock.x + activeBlock.w < playLeft() - pastEdge) {
        activeBlock.dir = 1;
      }
      activeBlock.normOffset = ((activeBlock.x + activeBlock.w / 2) - W / 2) / S;
    }

    if (state === STATE.GAME_OVER) {
      gameOverTimer += dt;
      if (fallingBlock) {
        fallingBlock.vy += 0.4 * (S / 720) * dt * 60;
        fallingBlock.y += fallingBlock.vy * dt * 60;
        fallingBlock.rot += 0.03 * dt * 60;
      }
    }

    if (perfectFlash > 0) {
      perfectFlash -= dt * 2;
      if (perfectFlash < 0) perfectFlash = 0;
    }

    updateParticles(dt);
  }

  // ---- Drawing Helpers ----
  function drawRect(x, y, w, h, fill, stroke, glowColor, glowSize) {
    if (w <= 0 || h <= 0) return;
    ctx.save();
    if (glowColor && glowSize) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = glowSize;
    }
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (stroke) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
    // Inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x + 2, y + 2, w - 4, h * 0.35);
    ctx.restore();
  }

  function drawGrid() {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = C.LIGHTBLUE;
    ctx.lineWidth = 1;
    const gridSize = S * 0.04;
    const offsetY = cameraY % gridSize;
    for (let y = -gridSize + offsetY; y < H + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    const offsetX = (W / 2) % gridSize;
    for (let x = offsetX; x < W + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawScanlines() {
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = C.BLACK;
    for (let y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1);
    }
    ctx.restore();
  }

  function drawVignette() {
    ctx.save();
    const grad = ctx.createRadialGradient(
      W / 2, H / 2, S * 0.25,
      W / 2, H / 2, Math.max(W, H) * 0.75
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  function drawScore() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Score number
    ctx.fillStyle = C.WHITE;
    ctx.shadowColor = C.CYAN;
    ctx.shadowBlur = 10;
    ctx.font = `bold ${S * 0.06}px 'Courier New', monospace`;
    ctx.fillText(score, W / 2, H * 0.02);

    // Combo indicator
    if (combo > 1) {
      ctx.shadowColor = C.YELLOW;
      ctx.shadowBlur = 15;
      ctx.fillStyle = C.YELLOW;
      ctx.font = `bold ${S * 0.03}px 'Courier New', monospace`;
      ctx.fillText(`PERFECT x${combo}`, W / 2, H * 0.02 + S * 0.07);
    }

    // High score
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.GRAY;
    ctx.font = `${S * 0.025}px 'Courier New', monospace`;
    ctx.textAlign = "right";
    ctx.fillText("HI " + highScore, W - S * 0.03, H * 0.02);

    ctx.restore();
  }

  // ---- Title Screen ----
  function drawTitle() {
    const pulse = Math.sin(titlePulse) * 0.5 + 0.5;
    const lineSpan = Math.min(W * 0.8, S * 0.9);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Decorative lines
    ctx.strokeStyle = C.LIGHTBLUE;
    ctx.globalAlpha = 0.3 + pulse * 0.2;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = H * 0.15 + i * H * 0.03;
      ctx.beginPath();
      ctx.moveTo(W / 2 - lineSpan / 2, y);
      ctx.lineTo(W / 2 + lineSpan / 2, y);
      ctx.stroke();
    }

    // Title
    ctx.globalAlpha = 1;
    ctx.shadowColor = C.CYAN;
    ctx.shadowBlur = 20 + pulse * 15;
    ctx.fillStyle = C.WHITE;
    ctx.font = `bold ${S * 0.12}px 'Courier New', monospace`;
    ctx.fillText("CYBER", W / 2, H * 0.35);
    ctx.fillStyle = C.CYAN;
    ctx.shadowColor = C.LIGHTBLUE;
    ctx.fillText("STACK", W / 2, H * 0.47);

    // Subtitle
    ctx.shadowBlur = 8;
    ctx.shadowColor = C.LIGHTBLUE;
    ctx.fillStyle = C.LIGHTBLUE;
    ctx.font = `${S * 0.03}px 'Courier New', monospace`;
    ctx.fillText("/// BUILD THE TOWER ///", W / 2, H * 0.58);

    // Prompt
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillStyle = C.WHITE;
    ctx.font = `${S * 0.035}px 'Courier New', monospace`;
    ctx.fillText("[ PRESS SPACE / TAP TO START ]", W / 2, H * 0.72);

    // High score on title
    if (highScore > 0) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = C.GRAY;
      ctx.font = `${S * 0.025}px 'Courier New', monospace`;
      ctx.fillText("HIGH SCORE: " + highScore, W / 2, H * 0.82);
    }

    // Controls hint
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = C.GRAY;
    ctx.font = `${S * 0.02}px 'Courier New', monospace`;
    ctx.fillText("SPACE / ENTER / TAP to drop blocks", W / 2, H * 0.90);

    ctx.restore();
  }

  // ---- Game Over Screen ----
  function drawGameOver() {
    const fadeIn = clamp(gameOverTimer, 0, 1);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Dim overlay
    ctx.globalAlpha = fadeIn * 0.5;
    ctx.fillStyle = C.NAVY;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = fadeIn;

    // GAME OVER text
    ctx.shadowColor = C.RED;
    ctx.shadowBlur = 25;
    ctx.fillStyle = C.RED;
    ctx.font = `bold ${S * 0.1}px 'Courier New', monospace`;
    ctx.fillText("GAME OVER", W / 2, H * 0.3);

    // Score
    ctx.shadowColor = C.CYAN;
    ctx.shadowBlur = 12;
    ctx.fillStyle = C.WHITE;
    ctx.font = `bold ${S * 0.06}px 'Courier New', monospace`;
    ctx.fillText("SCORE: " + score, W / 2, H * 0.45);

    // High score
    ctx.shadowColor = C.YELLOW;
    ctx.shadowBlur = score >= highScore ? 20 : 8;
    ctx.fillStyle = score >= highScore ? C.YELLOW : C.GRAY;
    ctx.font = `${S * 0.035}px 'Courier New', monospace`;
    if (score >= highScore && score > 0) {
      ctx.fillText("★ NEW HIGH SCORE ★", W / 2, H * 0.55);
    }
    ctx.fillText("HIGH SCORE: " + highScore, W / 2, H * 0.62);

    // New game prompt
    if (gameOverTimer > 0.8) {
      const pulse = Math.sin(titlePulse * 2) * 0.5 + 0.5;
      ctx.globalAlpha = fadeIn * (0.4 + pulse * 0.6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = C.WHITE;
      ctx.font = `${S * 0.03}px 'Courier New', monospace`;
      ctx.fillText("[ PRESS TO PLAY AGAIN ]", W / 2, H * 0.78);
    }

    ctx.restore();
  }

  // ---- Main Render ----
  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = C.NAVY;
    ctx.fillRect(0, 0, W, H);

    drawGrid();

    ctx.save();
    // Screen shake
    if (shakeAmount > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shakeAmount * 2,
        (Math.random() - 0.5) * shakeAmount * 2
      );
    }

    // Camera transform
    ctx.save();
    ctx.translate(0, cameraY);

    // Draw stacked blocks
    const time = performance.now() / 1000;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const glow = b.glow * (0.7 + Math.sin(time * 2 + i * 0.5) * 0.3) * S * 0.005;
      drawRect(b.x, b.y, b.w, b.h, b.color, C.WHITE, b.color, clamp(glow, 4, 20));

      // Edge glow line
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = C.CYAN;
      ctx.lineWidth = 1;
      ctx.shadowColor = C.CYAN;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.stroke();
      ctx.restore();
    }

    // Draw active block
    if (activeBlock) {
      const ab = activeBlock;
      const glowPulse = (GLOW_PULSE_MIN + Math.sin(time * 4) * (GLOW_PULSE_MAX - GLOW_PULSE_MIN));
      drawRect(
        ab.x, ab.y, ab.w, ab.h,
        ab.color, C.WHITE, ab.color,
        glowPulse * S * 0.006
      );

      // Direction indicator arrows
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = C.CYAN;
      const arrowY = ab.y - S * 0.02;
      const arrowSize = S * 0.015;
      for (let i = 0; i < 3; i++) {
        const ax = ab.x + ab.w / 2 + (i - 1) * arrowSize * 3;
        ctx.beginPath();
        if (ab.dir > 0) {
          ctx.moveTo(ax, arrowY);
          ctx.lineTo(ax + arrowSize, arrowY + arrowSize / 2);
          ctx.lineTo(ax, arrowY + arrowSize);
        } else {
          ctx.moveTo(ax + arrowSize, arrowY);
          ctx.lineTo(ax, arrowY + arrowSize / 2);
          ctx.lineTo(ax + arrowSize, arrowY + arrowSize);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Falling block (game over animation)
    if (fallingBlock) {
      ctx.save();
      const fb = fallingBlock;
      ctx.translate(fb.x + fb.w / 2, fb.y + fb.h / 2);
      ctx.rotate(fb.rot);
      ctx.globalAlpha = clamp(1 - gameOverTimer * 0.5, 0, 1);
      drawRect(-fb.w / 2, -fb.h / 2, fb.w, fb.h, fb.color, C.RED, C.RED, 15);
      ctx.restore();
    }

    // Particles (in camera space)
    drawParticles();

    ctx.restore(); // end camera transform

    // Perfect flash overlay (full viewport regardless of cameraY)
    if (perfectFlash > 0) {
      ctx.save();
      ctx.globalAlpha = perfectFlash * 0.15;
      ctx.fillStyle = C.YELLOW;
      ctx.fillRect(-50, -50, W + 100, H + 100);
      ctx.restore();
    }

    // Border decoration (cyberpunk frame)
    ctx.strokeStyle = C.LIGHTBLUE;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 2;
    const margin = S * 0.01;
    const cornerLen = S * 0.04;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(margin, margin + cornerLen);
    ctx.lineTo(margin, margin);
    ctx.lineTo(margin + cornerLen, margin);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(W - margin - cornerLen, margin);
    ctx.lineTo(W - margin, margin);
    ctx.lineTo(W - margin, margin + cornerLen);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(margin, H - margin - cornerLen);
    ctx.lineTo(margin, H - margin);
    ctx.lineTo(margin + cornerLen, H - margin);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(W - margin - cornerLen, H - margin);
    ctx.lineTo(W - margin, H - margin);
    ctx.lineTo(W - margin, H - margin - cornerLen);
    ctx.stroke();

    ctx.restore(); // end shake transform

    drawVignette();
    drawScanlines();

    // UI overlays (no camera, no shake)
    if (state === STATE.TITLE) {
      drawTitle();
    } else if (state === STATE.PLAYING) {
      drawScore();
    } else if (state === STATE.GAME_OVER) {
      drawScore();
      drawGameOver();
    }
  }

  // ---- Game Loop ----
  function gameLoop(timestamp) {
    const dt = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, 0.05) : 1 / 60;
    lastTimestamp = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

})();
