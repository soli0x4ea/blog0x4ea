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
  var t3 = 0;                             // current time, shared by the sprite pass

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
    H: [122, 162, 214],   // hair (default blue)
    S: [252, 226, 200],   // skin
    E: [58, 62, 78],      // eye (dark)
    P: [248, 172, 188],   // blush / pink
    M: [208, 126, 138],   // mouth / nose
    D: [188, 214, 236],   // dress (default)
    L: [252, 226, 200],   // leg (skin)
    W: [252, 250, 244],   // sock / sparkle
    K: [92, 94, 112],     // shoe
    O: [242, 172, 112],   // cat orange
    C: [252, 250, 244],   // cream / fur
    R: [198, 204, 216],   // robot silver
    V: [64, 74, 96],      // robot visor
    G: [138, 222, 232],   // robot eye light
    A: [170, 172, 184]    // antenna
  };
  var CHAR_NIGHT = [26, 34, 60];
  var characters = [];

  // ---- sprite maps; top = head+body, leg rows swap for a 2-frame walk ----
  var GIRL_LONG = [
    "....HHHH....",
    "...HHHHHH...",
    "..HHHHHHHH..",
    "..HHSSSSHH..",
    ".HSSSSSSSSH.",
    ".SSEESSEESS.",
    ".SPSSSSSSPS.",
    ".SSSSMMSSSS.",
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
    ".HSSSSSSSSH.",
    ".SSEESSEESS.",
    ".SPSSSSSSPS.",
    ".SSSSMMSSSS.",
    "..SSSSSSSS..",
    "...DDDDDD...",
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
    ".HSSSSSSSSH.",
    ".SSEESSEESS.",
    ".SPSSSSSSPS.",
    ".SSSSMMSSSS.",
    "..SSSSSSSS..",
    "...DDDDDD...",
    "..DDDDDDDD..",
    "..DDDDDDDD..",
    "...DDDDDD..."
  ];
  // legs: bare calf -> white sock -> small dark shoe (reads as a real step)
  var LEGS_A = [
    "..LL....LL..",
    "..LL....LL..",
    "..WW....WW..",
    "..KK....KK.."
  ];
  var LEGS_B = [
    "...LL..LL...",
    "...LL..LL...",
    "...WW..WW...",
    "...KK..KK..."
  ];
  var CAT = [
    "..O......O..",
    "..OO....OO..",
    "..OPO..OPO..",
    "..OOOOOOOO..",
    "..OEEOOEEO..",
    "..POOMMOOP..",
    "..OOOOOOOO..",
    ".OOOOOOOOOO.",
    ".OOOCCCCOOO.",
    ".OOCCCCCCOO.",
    ".OOOOOOOOOO.",
    "..OOOOOOOO.."
  ];
  // cat paws: soft pink toe beans
  var CLEGS_A = [
    "...OO..OO...",
    "...PP..PP..."
  ];
  var CLEGS_B = [
    "..OO....OO..",
    "..PP....PP.."
  ];
  var BUNNY_TOP = [
    "..C......C..",
    "..CC....CC..",
    "..CPC..CPC..",
    "..CPC..CPC..",
    "..CCCCCCCC..",
    "..CEECCEEC..",
    "..CPCCCCPC..",
    "..CCCMMCCC..",
    "..CCCCCCCC..",
    "...CCCCCC...",
    "..CCCCCCCC..",
    "..CCCCCCCC..",
    "...CCCCCC..."
  ];
  var BUNNY_SMALL = [
    "..C......C..",
    "..CC....CC..",
    "..CPC..CPC..",
    "..CCCCCCCC..",
    "..CEECCEEC..",
    "..CPCCCCPC..",
    "..CCCMMCCC..",
    "..CCCCCCCC..",
    "...CCCCCC..."
  ];
  // bunny feet: soft pink toe beans instead of shoes
  var BLEGS_A = [
    "..CC....CC..",
    "..CC....CC..",
    "..PP....PP..",
    "..PP....PP.."
  ];
  var BLEGS_B = [
    "...CC..CC...",
    "...CC..CC...",
    "...PP..PP...",
    "...PP..PP..."
  ];
  var ROBOT_TOP = [
    ".....GG.....",
    ".....AA.....",
    "..RRRRRRRR..",
    "..RRVVVVRR..",
    "..RVVGGVVR..",
    "..RVVVVVVR..",
    "..RRPRRPRR..",
    "..RRRRRRRR..",
    "...RRRRRR...",
    "..RRRRRRRR..",
    "..RRR..RRR..",
    "..RRRRRRRR..",
    "...RRRRRR..."
  ];
  var RLEGS_A = [
    "..RR....RR..",
    "..RR....RR..",
    ".KKK....KKK."
  ];
  var RLEGS_B = [
    "...RR..RR...",
    "...RR..RR...",
    "..KKK..KKK.."
  ];

  // ---- emotes that pop above a character's head ----
  var HEART = [
    ".P.P.",
    "PPPPP",
    ".PPP.",
    "..P.."
  ];
  var SPARKLE = [
    ".W.",
    "WWW",
    ".W."
  ];

  function buildFrames(top, legsA, legsB) {
    if (!legsA.length) return [top, top];
    return [top.concat(legsA), top.concat(legsB)];
  }

  function initCharacters() {
    // left-to-right lineup; each character gets its own hair / outfit tint
    var defs = [
      { top: GIRL_LONG,   la: LEGS_A,  lb: LEGS_B,  tint: { H: [122, 162, 214], D: [188, 214, 236] } },
      { top: GIRL_SHORT,  la: LEGS_A,  lb: LEGS_B,  tint: { H: [206, 146, 112], D: [238, 186, 146] } },
      { top: GIRL_BUN,    la: LEGS_A,  lb: LEGS_B,  tint: { H: [176, 142, 198], D: [216, 192, 236] } },
      { top: CAT,         la: CLEGS_A, lb: CLEGS_B, tint: null },
      { top: BUNNY_TOP,   la: BLEGS_A, lb: BLEGS_B, tint: null },
      { top: GIRL_LONG,   la: LEGS_A,  lb: LEGS_B,  tint: { H: [226, 182, 126], D: [246, 244, 238] } },
      { top: BUNNY_SMALL, la: BLEGS_A, lb: BLEGS_B, tint: null },
      { top: BUNNY_TOP,   la: BLEGS_A, lb: BLEGS_B, tint: { C: [234, 228, 246] } },
      { top: ROBOT_TOP,   la: RLEGS_A, lb: RLEGS_B, tint: null },
      { top: ROBOT_TOP,   la: RLEGS_A, lb: RLEGS_B, tint: { R: [208, 184, 202], V: [72, 62, 92] } }
    ];
    characters = [];
    var n = defs.length;
    var left = sceneW * 0.08, right = sceneW * 0.92;
    for (var i = 0; i < n; i++) {
      var d = defs[i];
      characters.push({
        cx: left + (right - left) * (n === 1 ? 0.5 : i / (n - 1)),
        frames: buildFrames(d.top, d.la, d.lb),
        tint: d.tint,
        phase: i * 0.7,
        // emote: idle countdown, then a short heart / sparkle float
        eNext: rand(1.5, 7),
        eLife: 0,
        eKind: 0
      });
    }
  }

  function chCol(day) { return lerp3(day, CHAR_NIGHT, night * 0.7); }

  function charFootY() {
    var bandH = Math.max(6, Math.round(sceneH * 0.13));
    return (sceneH - bandH) - 1;                    // grass surface line
  }

  function drawCharacter(ch) {
    var footY = charFootY();
    var step = Math.floor(t3 * 2.9 + ch.phase) % 2;   // 0 / 1 walk frame
    var bob = reduceMotion ? 0 : (step === 0 ? 0 : -1);
    var map = ch.frames[step];
    var y = footY - bob;

    // resolve colors (day/night crossfade + per-character tint)
    var pal = {};
    for (var k in CPAL) pal[k] = chCol(CPAL[k]);
    if (ch.tint) for (var tk in ch.tint) pal[tk] = chCol(ch.tint[tk]);

    var rows = map.length;
    var w = map[0].length;
    var x0 = Math.round(ch.cx - w / 2);
    var yTop = y - rows + 1;

    // soft contact shadow, narrower while the body bobs up
    var sw = w - (bob ? 5 : 3);
    octx.fillStyle = css([0, 0, 0], 0.12 * (1 - night * 0.5));
    octx.fillRect(Math.round(ch.cx - sw / 2), footY + 1, sw, 1);

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

  function updateEmotes(dt) {
    for (var i = 0; i < characters.length; i++) {
      var ch = characters[i];
      if (ch.eLife > 0) {
        ch.eLife += dt;
        if (ch.eLife > 1.7) { ch.eLife = 0; ch.eNext = rand(4, 13); }
      } else {
        ch.eNext -= dt;
        if (ch.eNext <= 0) {
          ch.eLife = 0.001;
          ch.eKind = Math.random() < 0.58 ? 0 : 1;   // heart / sparkle
        }
      }
    }
  }

  function drawEmotes(ch) {
    if (reduceMotion || ch.eLife <= 0) return;
    var p = ch.eLife / 1.7;                          // 0 -> 1
    var a = p < 0.16 ? p / 0.16 : 1 - (p - 0.16) / 0.84;
    if (a <= 0) return;
    var map = ch.eKind === 0 ? HEART : SPARKLE;
    var rows = ch.frames[0].length;
    var limb = ch.eKind === 0 ? [248, 162, 182] : [255, 240, 190];
    var oy = charFootY() - rows + 1 - 4 - Math.round(p * 11);
    var ox = Math.round(ch.cx) + (ch.eKind === 0 ? 5 : -7);
    octx.fillStyle = css(chCol(limb), Math.min(1, a) * (1 - night * 0.35));
    for (var r = 0; r < map.length; r++) {
      for (var c = 0; c < map[r].length; c++) {
        if (map[r][c] !== '.') octx.fillRect(ox + c, oy + r, 1, 1);
      }
    }
  }

  function drawCharacters() {
    for (var i = 0; i < characters.length; i++) {
      drawCharacter(characters[i]);
      drawEmotes(characters[i]);
    }
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
    drawCharacters();
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
    t3 = t;
    updateEmotes(dt);
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
