/* ============================================================
   0x4ea · procedural pixel hero scene
   Canvas-rendered day/night pixel landscape — no image assets.
   - light theme: blue sky + rotating-ray sun + drifting clouds
   - dark theme:  night sky + cratered moon + twinkling stars
                  + fireflies
   - procedural grass with wind sway
   - smooth day/night crossfade on theme toggle
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('heroCanvas');
  if (!canvas || !canvas.getContext) return;
  var hero = canvas.closest('.hero') || canvas.parentElement;
  var root = document.documentElement;

  var LOGICAL_W = 288;                    // logical pixel width (chunky pixels)
  var off = document.createElement('canvas');
  var octx = off.getContext('2d');
  var ctx = canvas.getContext('2d');

  var sceneW = 0, sceneH = 0;
  var stars = [], clouds = [], fireflies = [];

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme state ---------- */
  function isDark() { return root.getAttribute('data-theme') === 'dark'; }
  var night = isDark() ? 1 : 0;
  var nightTarget = night;

  /* ---------- helpers ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerp3(c1, c2, t) {
    return [
      Math.round(lerp(c1[0], c2[0], t)),
      Math.round(lerp(c1[1], c2[1], t)),
      Math.round(lerp(c1[2], c2[2], t))
    ];
  }
  function css(c, a) {
    return a == null
      ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'
      : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- palettes ---------- */
  var DAY = {
    skyTop: [158, 205, 242], skyMid: [207, 231, 247], skyBot: [247, 240, 221],
    grassBand: [143, 185, 94], grassBlade: [168, 204, 112], grassTip: [201, 231, 142],
    grassDark: [122, 165, 80], flower: [255, 214, 110]
  };
  var NIGHT = {
    skyTop: [7, 10, 24], skyMid: [18, 26, 54], skyBot: [35, 44, 74],
    grassBand: [36, 64, 58], grassBlade: [47, 80, 72], grassTip: [61, 99, 88],
    grassDark: [28, 52, 47], flower: [110, 140, 122]
  };

  /* ---------- pixel characters (procedural sprites, match reference) ---------- */
  // palette codes used inside the sprite maps ('.' = transparent)
  var CPAL = {
    H: [108, 148, 190],   // blue hair
    S: [250, 222, 190],   // skin
    E: [45, 45, 55],      // eye (dark)
    L: [250, 222, 190],   // leg (skin)
    K: [80, 80, 92],      // shoe / dark trim
    O: [238, 178, 112],   // cat orange
    C: [252, 248, 240],   // cream / white
    P: [246, 182, 196],   // pink
    R: [202, 206, 216],   // robot silver
    V: [58, 68, 88],      // robot visor
    G: [140, 220, 230],   // robot eye light
    A: [160, 160, 170]    // antenna
  };
  var CHAR_NIGHT = [26, 34, 60];
  var characters = [];

  // ---- sprite maps; top = head+body, leg rows swap for a 2-frame walk ----
  var GIRL_LONG = [
    "....HHHH....",
    "...HHHHHH...",
    "..HHHHHHHH..",
    "..HHSSSSHH..",
    "..HSSSSSSH..",
    "..HSESSESH..",
    "..HSSSSSSH..",
    ".HHSSSSSSHH.",
    ".HHSSSSSSHH.",
    ".HHHDDDDHHH.",
    ".HHDDDDDDHH.",
    "..DDDDDDDD..",
    "..DDDDDDDD..",
    "...DDDDDD..."
  ];
  var GIRL_SHORT = [
    "....HHHH....",
    "...HHHHHH...",
    "..HHHHHHHH..",
    "..HHSSSSHH..",
    "..HSSSSSSH..",
    "..HSESSESH..",
    "..HSSSSSSH..",
    "..HHSSSSHH..",
    "...SSSSSS...",
    "...DDDDDD...",
    "..DDDDDDDD..",
    "..DDDDDDDD..",
    "..DDDDDDDD..",
    "...DDDDDD..."
  ];
  var GIRL_BUN = [
    ".....HH.....",
    "....HHHH....",
    "...HHHHHH...",
    "..HHHHHHHH..",
    "..HHSSSSHH..",
    "..HSSSSSSH..",
    "..HSESSESH..",
    "..HSSSSSSH..",
    "...SSSSSS...",
    "...DDDDDD...",
    "..DDDDDDDD..",
    "..DDDDDDDD..",
    "..DDDDDDDD..",
    "...DDDDDD..."
  ];
  var LEGS_A = [
    "..LL....LL..",
    "..LL....LL..",
    "..LL....LL..",
    "..KK....KK..",
    "..KK....KK.."
  ];
  var LEGS_B = [
    "...LL..LL...",
    "...LL..LL...",
    "...LL..LL...",
    "...KK..KK...",
    "...KK..KK..."
  ];
  var CAT = [
    "..O......O..",
    "..OO....OO..",
    "..OOO..OOO..",
    "..OOOOOOOO..",
    "..OOEOOEOO..",
    "..OOOOOOOO..",
    "..OOOOOOOO..",
    ".OOOOOOOOOO.",
    ".OOOCCCCOOO.",
    ".OOCCCCCCOO.",
    ".OOOOOOOOOO.",
    "..OOOOOOOO.."
  ];
  var BUNNY_TOP = [
    "..C......C..",
    "..CC....CC..",
    "..CPC..CPC..",
    "..CPC..CPC..",
    "..CCCCCCCC..",
    "..CCCCCCCC..",
    "..CEECCEEC..",
    "..CCCCCCCC..",
    "...CCCCCC...",
    "..CCCPPPCC..",
    "..CCCPPPCC..",
    "..CCCCCCCC..",
    "...CCCCCC..."
  ];
  var BUNNY_SMALL = [
    "..C......C..",
    "..CC....CC..",
    "..CPC..CPC..",
    "..CCCCCCCC..",
    "..CEECCEEC..",
    "..CCCCCCCC..",
    "..CCCPPPCC..",
    "..CCCCCCCC..",
    "...CCCCCC..."
  ];
  var BLEGS_A = [
    "...CC..CC...",
    "...CC..CC...",
    "...CC..CC...",
    "..CCC..CCC.."
  ];
  var BLEGS_B = [
    "..CC....CC..",
    "..CC....CC..",
    "..CC....CC..",
    "..CCC..CCC.."
  ];
  var ROBOT_TOP = [
    ".....AA.....",
    ".....AA.....",
    "..RRRRRRRR..",
    "..RRRRRRRR..",
    "..RVVVVVVR..",
    "..RVVGGVVR..",
    "..RVVVVVVR..",
    "..RRRRRRRR..",
    "...RRRRRR...",
    "..RRRRRRRR..",
    "..RRR..RRR..",
    "..RRRRRRRR..",
    "...RRRRRR..."
  ];
  var RLEGS_A = [
    "...RR..RR...",
    "...RR..RR...",
    "..KKK..KKK.."
  ];
  var RLEGS_B = [
    "..RR....RR..",
    "..RR....RR..",
    "..KKK..KKK.."
  ];

  function buildFrames(top, legsA, legsB) {
    if (!legsA.length) return [top, top];
    return [top.concat(legsA), top.concat(legsB)];
  }

  function initCharacters() {
    // left-to-right lineup matching the reference image
    var defs = [
      { top: GIRL_LONG,   la: LEGS_A,  lb: LEGS_B,  dress: [188, 214, 236] },
      { top: GIRL_SHORT,  la: LEGS_A,  lb: LEGS_B,  dress: [120, 160, 200] },
      { top: GIRL_BUN,    la: LEGS_A,  lb: LEGS_B,  dress: [168, 186, 200] },
      { top: CAT,         la: [],      lb: [],      dress: null },
      { top: BUNNY_TOP,   la: BLEGS_A, lb: BLEGS_B, dress: null },
      { top: GIRL_LONG,   la: LEGS_A,  lb: LEGS_B,  dress: [240, 244, 248] },
      { top: BUNNY_SMALL, la: BLEGS_A, lb: BLEGS_B, dress: null },
      { top: BUNNY_TOP,   la: BLEGS_A, lb: BLEGS_B, dress: null },
      { top: ROBOT_TOP,   la: RLEGS_A, lb: RLEGS_B, dress: null },
      { top: ROBOT_TOP,   la: RLEGS_A, lb: RLEGS_B, dress: null }
    ];
    characters = [];
    var n = defs.length;
    var left = sceneW * 0.08, right = sceneW * 0.92;
    for (var i = 0; i < n; i++) {
      var d = defs[i];
      characters.push({
        cx: left + (right - left) * (n === 1 ? 0.5 : i / (n - 1)),
        frames: buildFrames(d.top, d.la, d.lb),
        dress: d.dress,
        phase: i * 0.7
      });
    }
  }

  function chCol(day) { return lerp3(day, CHAR_NIGHT, night * 0.82); }

  function drawCharacter(ch, t) {
    var bandH = Math.max(6, Math.round(sceneH * 0.13));
    var footY = (sceneH - bandH) - 1;                 // stand on grass surface
    // in-place stepping: small vertical bob synced to the leg swap
    var step = Math.floor(t * 3.2 + ch.phase) % 2;    // 0 / 1 frame toggle
    var bob = reduceMotion ? 0 : (step === 0 ? 0 : -1);
    var map = ch.frames[step];
    var y = footY - bob;

    // resolve colors (day/night crossfade)
    var pal = {};
    for (var k in CPAL) pal[k] = chCol(CPAL[k]);
    if (ch.dress) pal.D = chCol(ch.dress);

    var rows = map.length;
    var w = map[0].length;
    var x0 = Math.round(ch.cx - w / 2);
    var yTop = y - rows + 1;
    for (var r = 0; r < rows; r++) {
      var line = map[r];
      for (var c = 0; c < w; c++) {
        var code = line[c];
        if (code === '.') continue;
        var col = pal[code];
        if (!col) continue;
        octx.fillStyle = css(col);
        octx.fillRect(x0 + c, yTop + r, 1, 1);
      }
    }
  }

  function drawCharacters(t) {
    for (var i = 0; i < characters.length; i++) drawCharacter(characters[i], t);
  }

  /* ---------- entity init (on resize) ---------- */
  function initEntities() {
    stars = [];
    var starCount = Math.min(110, Math.round(sceneW * sceneH / 1100));
    for (var i = 0; i < starCount; i++) {
      stars.push({
        x: rand(0, sceneW),
        y: rand(0, sceneH * 0.6),
        size: Math.random() < 0.82 ? 1 : 2,
        phase: rand(0, Math.PI * 2),
        speed: rand(0.6, 2.2),
        base: rand(0.45, 1),
        cool: Math.random() < 0.3
      });
    }
    clouds = [];
    var cloudCount = Math.max(4, Math.round(sceneW / 58));
    for (var c = 0; c < cloudCount; c++) {
      var depth = rand(0.35, 1);              // smaller = farther away
      var w = rand(34, 60) * depth + 18;
      var puffs = [];
      var n = 4 + Math.floor(Math.random() * 3);
      for (var p = 0; p < n; p++) {
        puffs.push({
          dx: (n === 1 ? 0 : (p / (n - 1) - 0.5)) * w,
          dy: rand(-w * 0.1, w * 0.06),
          r: rand(w * 0.16, w * 0.26)
        });
      }
      clouds.push({
        x: rand(-w, sceneW + w),
        y: rand(sceneH * 0.06, sceneH * 0.38),
        w: w,
        depth: depth,
        speed: rand(1.5, 4.5) * depth,
        puffs: puffs
      });
    }
    fireflies = [];
    for (var f = 0; f < 9; f++) {
      fireflies.push({
        x: rand(0, sceneW),
        y: rand(sceneH * 0.55, sceneH * 0.82),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.4, 1.0),
        drift: rand(2, 6)
      });
    }
    initCharacters();
  }

  function resize() {
    var rect = hero.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    sceneW = LOGICAL_W;
    sceneH = Math.max(1, Math.round(LOGICAL_W * rect.height / Math.max(1, rect.width)));
    off.width = sceneW;
    off.height = sceneH;
    initEntities();
    if (reduceMotion) render(0);
  }

  /* ---------- layers ---------- */
  function drawSky() {
    var g = octx.createLinearGradient(0, 0, 0, sceneH);
    g.addColorStop(0, css(lerp3(DAY.skyTop, NIGHT.skyTop, night)));
    g.addColorStop(0.55, css(lerp3(DAY.skyMid, NIGHT.skyMid, night)));
    g.addColorStop(1, css(lerp3(DAY.skyBot, NIGHT.skyBot, night)));
    octx.fillStyle = g;
    octx.fillRect(0, 0, sceneW, sceneH);
  }

  function drawStars(t) {
    if (night <= 0.02) return;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = s.base * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));
      octx.fillStyle = s.cool
        ? css([207, 224, 255], night * tw)
        : css([253, 246, 227], night * tw);
      octx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    }
  }

  function drawMoon() {
    if (night <= 0.02) return;
    var cx = sceneW * 0.82, cy = sceneH * 0.17;
    var r = Math.max(9, sceneW * 0.055);
    octx.fillStyle = css([240, 230, 200], 0.14 * night);
    octx.beginPath(); octx.arc(cx, cy, r * 1.9, 0, Math.PI * 2); octx.fill();
    octx.fillStyle = css([246, 236, 210], 0.22 * night);
    octx.beginPath(); octx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); octx.fill();
    octx.fillStyle = css([246, 236, 210], night);
    octx.beginPath(); octx.arc(cx, cy, r, 0, Math.PI * 2); octx.fill();
    octx.fillStyle = css([220, 201, 160], night * 0.9);
    var craters = [[-0.3, -0.15, 0.22], [0.25, 0.2, 0.16], [-0.05, 0.38, 0.13], [0.38, -0.32, 0.12]];
    for (var i = 0; i < craters.length; i++) {
      var cr = craters[i];
      octx.beginPath();
      octx.arc(cx + cr[0] * r, cy + cr[1] * r, cr[2] * r, 0, Math.PI * 2);
      octx.fill();
    }
  }

  function drawSun(t) {
    var day = 1 - night;
    if (day <= 0.02) return;
    var cx = sceneW * 0.16, cy = sceneH * 0.18;
    var r = Math.max(10, sceneW * 0.06);
    octx.fillStyle = css([255, 214, 110], 0.2 * day);
    octx.beginPath(); octx.arc(cx, cy, r * 2.1, 0, Math.PI * 2); octx.fill();
    // rotating pixel rays
    octx.fillStyle = css([255, 200, 90], 0.85 * day);
    var spin = t * 0.25;
    for (var i = 0; i < 8; i++) {
      var a = spin + i * Math.PI / 4;
      for (var sIdx = 0; sIdx < 3; sIdx++) {
        var px = cx + Math.cos(a) * r * (1.35 + 0.4 * sIdx / 3);
        var py = cy + Math.sin(a) * r * (1.35 + 0.4 * sIdx / 3);
        octx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
      }
    }
    octx.fillStyle = css([255, 215, 110], day);
    octx.beginPath(); octx.arc(cx, cy, r, 0, Math.PI * 2); octx.fill();
    octx.fillStyle = css([255, 232, 152], day);
    octx.beginPath(); octx.arc(cx - r * 0.22, cy - r * 0.22, r * 0.55, 0, Math.PI * 2); octx.fill();
  }

  function drawClouds() {
    var day = 1 - night;
    if (day <= 0.02) return;
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var alpha = day * (0.55 + 0.4 * c.depth);
      var p, pf;
      // underside shade
      octx.fillStyle = css([214, 228, 240], alpha * 0.9);
      for (p = 0; p < c.puffs.length; p++) {
        pf = c.puffs[p];
        octx.beginPath(); octx.arc(c.x + pf.dx, c.y + pf.dy + 2.5, pf.r, 0, Math.PI * 2); octx.fill();
      }
      // body
      octx.fillStyle = css([255, 255, 255], alpha);
      for (p = 0; p < c.puffs.length; p++) {
        pf = c.puffs[p];
        octx.beginPath(); octx.arc(c.x + pf.dx, c.y + pf.dy, pf.r, 0, Math.PI * 2); octx.fill();
      }
      // flat pixel base
      octx.fillRect(
        Math.round(c.x - c.w * 0.42), Math.round(c.y + c.w * 0.05),
        Math.round(c.w * 0.84), Math.max(2, Math.round(c.w * 0.07))
      );
    }
  }

  function drawGrass(t) {
    var band = lerp3(DAY.grassBand, NIGHT.grassBand, night);
    var blade = lerp3(DAY.grassBlade, NIGHT.grassBlade, night);
    var tip = lerp3(DAY.grassTip, NIGHT.grassTip, night);
    var dark = lerp3(DAY.grassDark, NIGHT.grassDark, night);
    var bandH = Math.max(6, Math.round(sceneH * 0.13));
    var top = sceneH - bandH;
    octx.fillStyle = css(band);
    octx.fillRect(0, top, sceneW, bandH);
    // wind-swayed blade silhouette
    for (var x = 0; x < sceneW; x++) {
      var nse = Math.sin(x * 0.31) * 1.6 + Math.sin(x * 0.11 + 1.7) * 2.2;
      var h = 2 + Math.round(Math.abs(nse));
      var sway = Math.round(Math.sin(t * 1.4 + x * 0.09) * 1.2);
      octx.fillStyle = css(blade);
      octx.fillRect(x + sway, top - h, 1, h);
      if ((x * 7) % 5 === 0) {
        octx.fillStyle = css(tip);
        octx.fillRect(x + sway, top - h - 1, 1, 1);
      }
    }
    // ground scroll (moves backward so the characters read as walking)
    var goff = reduceMotion ? 0 : (t * 18) % sceneW;
    // inner texture speckles
    octx.fillStyle = css(dark, 0.8);
    var count = Math.round(sceneW * 0.6);
    for (var i = 0; i < count; i++) {
      var tx = Math.round((i * 37 - goff) % sceneW); if (tx < 0) tx += sceneW;
      var ty = top + 2 + ((i * 53) % Math.max(1, bandH - 3));
      octx.fillRect(tx, ty, 1, 1);
    }
    // tiny flowers (scroll with the ground)
    var flower = lerp3(DAY.flower, NIGHT.flower, night);
    for (var f = 0; f < 14; f++) {
      var fx = Math.round((f * 61 + 17 - goff) % sceneW); if (fx < 0) fx += sceneW;
      var fy = top - 2 - ((f * 29) % Math.max(1, Math.round(bandH * 0.3)));
      octx.fillStyle = css(flower, 0.55 + 0.45 * (1 - night));
      octx.fillRect(fx, fy, 1, 1);
    }
  }

  function drawFireflies(t) {
    if (night <= 0.05) return;
    for (var i = 0; i < fireflies.length; i++) {
      var f = fireflies[i];
      var x = f.x + Math.sin(t * f.speed + f.phase) * f.drift;
      var y = f.y + Math.cos(t * f.speed * 0.8 + f.phase * 1.3) * f.drift * 0.6;
      var a = night * (0.25 + 0.75 * Math.abs(Math.sin(t * 1.3 + f.phase)));
      octx.fillStyle = css([255, 224, 138], a * 0.35);
      octx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      octx.fillStyle = css([255, 236, 170], a);
      octx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  /* ---------- frame ---------- */
  function render(t) {
    octx.clearRect(0, 0, sceneW, sceneH);
    drawSky();
    drawStars(t);
    drawMoon();
    drawSun(t);
    drawClouds();
    drawFireflies(t);
    drawGrass(t);
    drawCharacters(t);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, sceneW, sceneH, 0, 0, canvas.width, canvas.height);
  }

  /* ---------- loop control ---------- */
  var last = 0, running = false, visible = true, rafId = null;

  function frame(ts) {
    rafId = null;
    var t = ts / 1000;
    var dt = last ? Math.min(0.1, t - last) : 0.016;
    last = t;
    if (night !== nightTarget) {
      var step = dt * 1.6;
      night = Math.abs(nightTarget - night) <= step
        ? nightTarget
        : night + (nightTarget > night ? step : -step);
    }
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.x += c.speed * dt;
      if (c.x - c.w > sceneW + 4) {
        c.x = -c.w - rand(0, 30);
        c.y = rand(sceneH * 0.06, sceneH * 0.38);
      }
    }
    render(t);
    if (running && visible && !reduceMotion) rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = 0;
    if (visible) rafId = requestAnimationFrame(frame);
  }

  /* ---------- events ---------- */
  new MutationObserver(function () {
    nightTarget = isDark() ? 1 : 0;
    if (reduceMotion) { night = nightTarget; render(0); }
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && running && !reduceMotion && !rafId) {
        last = 0;
        rafId = requestAnimationFrame(frame);
      }
    }, { threshold: 0.02 }).observe(hero);
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (running && visible && !reduceMotion) {
      last = 0;
      rafId = requestAnimationFrame(frame);
    }
  });

  resize();
  if (reduceMotion) { render(0); } else { start(); }
})();
