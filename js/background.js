'use strict';

/**
 * `background.js` creates a new cyberpunk theme background of a city where it is always raining.
 * a few objects are randomly generated on page load to create some variety, but the animation is deterministic and will be the same on every load.
 * the scene is rendered on a canvas element, and the clock and date are updated in sync with the animation frames for smoothness.
 * the rain is rendered as individual line segments with varying lengths, speeds, and opacities to create a natural look.
 * the buildings are rendered in three layers (far, mid, near) with different colors and details to create depth.
 * the mid layer has randomly lit windows and occasional neon signs that pulse in brightness.
 * the near layer has taller buildings with fewer details and some with neon signs as well.
 * the sky has a gradient and a purple nebula for visual interest, and there are twinkling stars scattered throughout.
 * the ground has a wet look with reflections of the neon signs.
 */


(function () {
  const canvas = document.getElementById('city-canvas');
  const ctx    = canvas.getContext('2d');

  let W = 0, H = 0, GY = 0; // GY = ground Y

  /* Deterministic PRNG (xorshift32) */
  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s ^= s << 13; s ^= s >> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }

  /* Scene objects */
  let farBuildings  = [];
  let midBuildings  = [];
  let nearBuildings = [];
  let stars         = [];
  let drops         = [];

  /* Build scene (called on init + resize) */
  function buildScene() {
    W  = canvas.width  = window.innerWidth;
    H  = canvas.height = window.innerHeight;
    GY = Math.round(H * 0.70);

    const rng = makeRng(0xC0FFEE42);

    /* Stars */
    stars = [];
    const starCount = Math.round(W * GY / 4500);
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x:     rng() * W,
        y:     rng() * GY * 0.72,
        r:     rng() * 1.1 + 0.2,
        base:  rng() * 0.5 + 0.3,
        spd:   rng() * 0.014 + 0.003,
        phase: rng() * Math.PI * 2,
      });
    }

    /* Far buildings: dense, short */
    farBuildings = [];
    for (let x = 0; x < W + 70;) {
      const w = rng() * 55 + 22;
      const h = rng() * 130 + 55;
      farBuildings.push({ x, w, h, y: GY - h });
      x += w - rng() * 4;
    }

    /* Mid buildings: taller, windows, signs, antennas */
    midBuildings = [];
    for (let x = -35; x < W + 70;) {
      const w  = rng() * 95 + 35;
      const h  = rng() * 230 + 100;
      const bx = x, by = GY - h;

      /* Window grid */
      const wins = [];
      const cols = Math.max(1, Math.floor((w - 10) / 14));
      const rows = Math.max(1, Math.floor((h - 14) / 18));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() < 0.58) {
            const cv = rng();
            wins.push({
              x:     bx + 7 + c * 14,
              y:     by + 10 + r * 18,
              w:     7,
              h:     9,
              color: cv < 0.44 ? 0 : cv < 0.74 ? 1 : cv < 0.91 ? 2 : 3,
              spd:   rng() * 0.00055 + 0.00008,
              phase: rng() * Math.PI * 2,
            });
          }
        }
      }

      /* Antenna */
      const antenna = rng() > 0.52 ? {
        x: bx + w * 0.4 + rng() * w * 0.2,
        h: rng() * 35 + 10,
      } : null;

      /* Neon sign */
      const sign = rng() > 0.65 ? {
        x:     bx + w * 0.10,
        y:     by + h * (0.12 + rng() * 0.22),
        w:     w * 0.80,
        h:     3 + rng() * 4,
        color: rng() < 0.5 ? 0 : 1,
        spd:   rng() * 0.00075 + 0.00025,
        phase: rng() * Math.PI * 2,
      } : null;

      midBuildings.push({ x: bx, y: by, w, h, wins, antenna, sign });
      x += w + rng() * 14;
    }

    /* Near buildings: tallest, very dark, sparse */
    nearBuildings = [];
    for (let x = -45; x < W + 70;) {
      const w = rng() * 130 + 55;
      const h = rng() * 310 + 160;
      const sign = rng() > 0.52 ? {
        x:     x + w * 0.10,
        y:     (GY - h) + h * (0.08 + rng() * 0.28),
        w:     w * 0.80,
        h:     4 + rng() * 5,
        color: rng() < 0.5 ? 0 : 1,
        spd:   rng() * 0.0006 + 0.0002,
        phase: rng() * Math.PI * 2,
      } : null;
      nearBuildings.push({ x, y: GY - h, w, h, sign });
      x += w + rng() * (W * 0.10) + 20;
    }

    /* Rain drops */
    drops = [];
    for (let i = 0; i < 220; i++) {
      drops.push(newDrop(true));
    }
  }

  function newDrop(scattered) {
    return {
      x:   Math.random() * (W + 40),
      y:   scattered ? Math.random() * H : -20,
      len: Math.random() * 14 + 7,
      spd: Math.random() * 9 + 5,
      op:  Math.random() * 0.28 + 0.06,
    };
  }

  /* Color palettes */
  const WIN_COLORS = [
    (a) => `rgba(34,211,238,${a})`,    // cyan
    (a) => `rgba(192,132,252,${a})`,   // purple
    (a) => `rgba(250,190,40,${a})`,    // amber
    (a) => `rgba(215,235,255,${a})`,   // cold white
  ];
  const SIGN_COLORS = [
    (a) => `rgba(34,211,238,${a})`,    // cyan
    (a) => `rgba(240,72,152,${a})`,    // hot pink
  ];

  /* Draw: sky + atmosphere */
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0,    '#040115');
    g.addColorStop(0.25, '#0b0528');
    g.addColorStop(0.55, '#0e0e3a');
    g.addColorStop(0.82, '#190c32');
    g.addColorStop(1,    '#0d1828');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 2);

    // Purple nebula: upper right
    const ng = ctx.createRadialGradient(W * 0.78, H * 0.10, 0, W * 0.78, H * 0.10, W * 0.32);
    ng.addColorStop(0,   'rgba(140,50,230,0.13)');
    ng.addColorStop(0.5, 'rgba(80,15,180,0.04)');
    ng.addColorStop(1,   'transparent');
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, W, GY);

    // Cyan horizon glow
    const hg = ctx.createLinearGradient(0, GY - H * 0.20, 0, GY);
    hg.addColorStop(0, 'transparent');
    hg.addColorStop(1, 'rgba(34,211,238,0.08)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, GY - H * 0.20, W, H * 0.20);
  }

  /* Draw: stars */
  function drawStars(t) {
    stars.forEach(s => {
      const tw = 0.5 + 0.5 * Math.sin(t * s.spd + s.phase);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210,225,255,${s.base * (0.45 + 0.55 * tw)})`;
      ctx.fill();
    });
  }

  /* Draw: solid building silhouette layers */
  function drawLayer(buildings, fill) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = fill;
    buildings.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
  }

  /* Draw: mid building details */
  function drawMidDetails(t) {
    midBuildings.forEach(b => {

      /* Windows */
      b.wins.forEach(w => {
        const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * w.spd + w.phase));
        const cfn   = WIN_COLORS[w.color];
        ctx.shadowColor = cfn(0.9);
        ctx.shadowBlur  = 6;
        ctx.fillStyle   = cfn(pulse * 0.88);
        ctx.fillRect(w.x, w.y, w.w, w.h);
      });

      /* Rooftop antenna */
      if (b.antenna) {
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = '#1a2040';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.antenna.x, b.y);
        ctx.lineTo(b.antenna.x, b.y - b.antenna.h);
        ctx.stroke();
        // Blinking red tip
        const blink = Math.sin(t * 0.0014) > 0.55 ? 1 : 0;
        ctx.shadowColor = 'rgba(255,70,70,0.9)';
        ctx.shadowBlur  = blink ? 10 : 0;
        ctx.fillStyle   = `rgba(255,70,70,${blink * 0.95})`;
        ctx.beginPath();
        ctx.arc(b.antenna.x, b.y - b.antenna.h, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      /* Neon sign */
      if (b.sign) drawSign(b.sign, t);
    });

    ctx.shadowBlur = 0;
  }

  /* Draw: neon horizontal sign strip */
  function drawSign(s, t) {
    const pulse = 0.68 + 0.32 * (0.5 + 0.5 * Math.sin(t * s.spd + s.phase));
    const cfn   = SIGN_COLORS[s.color];
    ctx.shadowColor = cfn(1);
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = cfn(pulse);
    ctx.fillRect(s.x, s.y, s.w, s.h);
    // Faint reflection strip below
    ctx.shadowBlur  = 4;
    ctx.fillStyle   = cfn(pulse * 0.25);
    ctx.fillRect(s.x, s.y + s.h + 2, s.w, s.h * 0.5);
    ctx.shadowBlur  = 0;
  }

  /* Draw: near building signs */
  function drawNearSigns(t) {
    nearBuildings.forEach(b => {
      if (b.sign) drawSign(b.sign, t);
    });
  }

  /* Draw: ground + wet-road reflections */
  function drawGround() {
    const g = ctx.createLinearGradient(0, GY, 0, H);
    g.addColorStop(0, '#05091a');
    g.addColorStop(1, '#020408');
    ctx.fillStyle = g;
    ctx.fillRect(0, GY, W, H - GY);

    // Neon puddle streaks
    [
      { x: W * 0.08, w: W * 0.22, col: 'rgba(34,211,238,0.07)' },
      { x: W * 0.38, w: W * 0.22, col: 'rgba(192,132,252,0.05)' },
      { x: W * 0.66, w: W * 0.28, col: 'rgba(240,72,152,0.05)' },
    ].forEach(s => {
      const sg = ctx.createLinearGradient(0, GY, 0, GY + H * 0.09);
      sg.addColorStop(0, s.col);
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.fillRect(s.x, GY, s.w, H * 0.09);
    });
  }

  /* Draw: rain */
  function drawRain() {
    ctx.save();
    ctx.strokeStyle = 'rgba(140,200,255,1)';
    ctx.lineWidth   = 0.6;
    drops.forEach(d => {
      ctx.globalAlpha = d.op;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.13, d.y + d.len);
      ctx.stroke();
      d.x -= d.spd * 0.13;
      d.y += d.spd;
      if (d.y > H + 20 || d.x < -30) Object.assign(d, newDrop(false));
    });
    ctx.restore();
  }

  /* Render loop */
  function render(t) {
    ctx.clearRect(0, 0, W, H);

    drawSky();
    drawStars(t);

    drawLayer(farBuildings,  '#0d1733');
    drawLayer(midBuildings,  '#081020');
    drawMidDetails(t);
    drawLayer(nearBuildings, '#03060e');
    drawNearSigns(t);

    drawGround();
    drawRain();

    requestAnimationFrame(render);
  }

  /* Bootstrap */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildScene, 150);
  });

  buildScene();
  requestAnimationFrame(render);
})();
