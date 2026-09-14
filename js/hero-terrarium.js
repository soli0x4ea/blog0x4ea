/* ============================================================
   0x4ea · pixel chameleon terrarium (hero)
   ------------------------------------------------------------
   A low-resolution WebGL diorama rendered with three.js, upscaled
   with `image-rendering: pixelated` so it keeps the chunky pixel
   look of the previous 2D canvas scene.

   - light theme -> day:  bright sun, warm room, lamp off
   - dark  theme -> night: stars, glowing heat lamp, chameleon asleep
   - the sky gradient always ends in the page background colour,
     so the diorama blends into the hero instead of sitting in a box

   Interactions:
     - 🦗 投喂 / Feed  button  -> drops a cricket in
     - 🎨 变色 / Color button  -> cycles the chameleon's colour
     - drag to orbit and click the substrate to feed (pointer
       devices only; the buttons work everywhere, touch included)

   Crickets only ever appear because the visitor asked for one —
   there is no ambient / timed spawner, so the tank starts empty
   and stays empty until someone feeds it.

   three.js is vendored locally under js/vendor/ — the site stays
   offline-first and never calls a third-party CDN.
   ============================================================ */
import * as THREE from 'three';

(function () {
  'use strict';

  var canvas = document.getElementById('heroCanvas');
  if (!canvas || !canvas.getContext) return;
  var hero = canvas.closest('.hero') || canvas.parentElement;
  var root = document.documentElement;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- renderer (bail out quietly when WebGL is missing) ---------- */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: false, alpha: false, powerPreference: 'high-performance'
    });
  } catch (e) { return; }
  if (!renderer || !renderer.getContext()) return;

  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;   // hard-edged shadows read as pixels

  var PIXEL_SCALE = 2.5;          // one logical pixel ≈ 2.5 CSS pixels
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.5, 260);

  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

  /* ============================================================
     procedural pixel textures
     ============================================================ */
  function pxTex(size, draw, rx, ry) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    var t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  var soilTex = pxTex(16, function (g, s) {
    g.fillStyle = '#4b3728'; g.fillRect(0, 0, s, s);
    var cols = ['#3a2a1d', '#5d452f', '#6d5136', '#2e2117', '#54402c'];
    for (var i = 0; i < 90; i++) {
      g.fillStyle = pick(cols);
      g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 1, 1);
    }
  }, 7, 5);

  var woodTex = pxTex(16, function (g, s) {
    g.fillStyle = '#8a5a34'; g.fillRect(0, 0, s, s);
    for (var i = 0; i < 46; i++) {
      g.fillStyle = pick(['#7d4f2c', '#96643c', '#6f4526', '#a06e42']);
      g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 2 + ((Math.random() * 3) | 0), 1);
    }
    g.fillStyle = '#5e3a20'; g.fillRect(0, 0, s, 1); g.fillRect(0, 8, s, 1);
  }, 3, 2);

  var barkTex = pxTex(16, function (g, s) {
    g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, s, s);
    for (var i = 0; i < 40; i++) {
      g.fillStyle = pick(['#5a3d24', '#7c5836', '#4a3220']);
      g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 1, 3 + ((Math.random() * 5) | 0));
    }
  }, 3, 3);

  var rockTex = pxTex(16, function (g, s) {
    g.fillStyle = '#6b7078'; g.fillRect(0, 0, s, s);
    for (var i = 0; i < 70; i++) {
      g.fillStyle = pick(['#5b6067', '#7b818a', '#4d5259', '#868c95']);
      g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 2, 2);
    }
  }, 2, 2);

  /* ============================================================
     sky — one dome, gradient redrawn as the theme cross-fades
     ============================================================ */
  var SKY = {
    day:   { top: [0x8f, 0xc6, 0xef], mid: [0xd6, 0xea, 0xf8], bot: [0xf7, 0xf5, 0xec] },
    night: { top: [0x05, 0x07, 0x16], mid: [0x12, 0x1a, 0x38], bot: [0x0b, 0x10, 0x26] }
  };
  var skyCv = document.createElement('canvas');
  skyCv.width = 4; skyCv.height = 64;
  var skyCtx = skyCv.getContext('2d');
  var skyTex = new THREE.CanvasTexture(skyCv);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyTex.magFilter = THREE.NearestFilter;
  skyTex.minFilter = THREE.NearestFilter;

  var skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(120, 16, 12),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false })
  );
  scene.add(skyDome);

  var lastSkyNight = -1;
  function paintSky(night) {
    if (Math.abs(night - lastSkyNight) < 0.004) return;
    lastSkyNight = night;
    var g = skyCtx.createLinearGradient(0, 0, 0, 64);
    var stops = [[0, 'top'], [0.55, 'mid'], [1, 'bot']];
    for (var i = 0; i < stops.length; i++) {
      var d = SKY.day[stops[i][1]], n = SKY.night[stops[i][1]];
      g.addColorStop(stops[i][0], 'rgb(' +
        Math.round(d[0] + (n[0] - d[0]) * night) + ',' +
        Math.round(d[1] + (n[1] - d[1]) * night) + ',' +
        Math.round(d[2] + (n[2] - d[2]) * night) + ')');
    }
    skyCtx.fillStyle = g;
    skyCtx.fillRect(0, 0, 4, 64);
    skyTex.needsUpdate = true;
  }
  paintSky(0);

  /* ---------- stars ---------- */
  var starGeo = new THREE.BufferGeometry();
  (function () {
    var N = 200, pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var th = Math.random() * Math.PI * 2, ph = Math.random() * 0.6, r = 105;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) + 8;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  })();
  var starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 2, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false
  });
  var stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ============================================================
     lights
     ============================================================ */
  var DAY = { hemi: 1.0, sun: 1.5, lamp: 0.0, amb: 0.30 };
  var NIGHT = { hemi: 0.42, sun: 0.14, lamp: 15.0, amb: 0.22 };

  var hemi = new THREE.HemisphereLight(0xd6ecff, 0x4a3a2a, DAY.hemi);
  scene.add(hemi);
  var amb = new THREE.AmbientLight(0xffffff, DAY.amb);
  scene.add(amb);

  var sun = new THREE.DirectionalLight(0xffe9c4, DAY.sun);
  sun.position.set(7, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -4;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 46;
  sun.shadow.bias = -0.0016;
  scene.add(sun);

  var lampLight = new THREE.PointLight(0xffb45a, DAY.lamp, 18, 2);
  lampLight.position.set(0, 6.0, 0);
  scene.add(lampLight);

  /* ============================================================
     cabinet + tank
     ============================================================ */
  var woodDark = new THREE.MeshLambertMaterial({ map: woodTex, color: 0x8a6a48 });

  // soft contact shadow so the cabinet does not look like it floats
  var blobTex = (function () {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(32, 32, 1, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.20)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  var blobMat = new THREE.MeshBasicMaterial({
    map: blobTex, transparent: true, opacity: 0.5, depthWrite: false
  });
  var blob = new THREE.Mesh(new THREE.PlaneGeometry(15, 9), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -1.94;
  scene.add(blob);

  var cabinet = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.9, 5.8), woodDark);
  cabinet.position.set(0, -0.95, 0);
  cabinet.castShadow = true;
  scene.add(cabinet);

  var slab = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.26, 6.2),
    new THREE.MeshLambertMaterial({ map: woodTex, color: 0xb08a5e }));
  slab.position.set(0, -0.07, 0);
  slab.castShadow = true;
  scene.add(slab);

  for (var hi = 0; hi < 2; hi++) {
    var handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x5a4a3a }));
    handle.position.set(3.5, -0.95, hi ? 1.45 : -1.45);
    scene.add(handle);
  }

  var TANK = { w: 7.2, h: 4.7, d: 5.3 };
  var tank = new THREE.Group();
  scene.add(tank);

  var glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6f2ff, transparent: true, opacity: 0.12, roughness: 0.06,
    metalness: 0.0, depthWrite: false, side: THREE.DoubleSide
  });
  var frameMat = new THREE.MeshLambertMaterial({ color: 0x39434e, flatShading: true });

  function glassPanel(w, h, x, y, z, ry) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    m.position.set(x, y, z);
    m.rotation.y = ry || 0;
    tank.add(m);
  }
  glassPanel(TANK.w, TANK.h, 0, TANK.h / 2, TANK.d / 2, 0);
  glassPanel(TANK.w, TANK.h, 0, TANK.h / 2, -TANK.d / 2, 0);
  glassPanel(TANK.d, TANK.h, -TANK.w / 2, TANK.h / 2, 0, Math.PI / 2);
  glassPanel(TANK.d, TANK.h, TANK.w / 2, TANK.h / 2, 0, Math.PI / 2);

  function bar(w, h, d, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    tank.add(m);
    return m;
  }
  var FT = 0.16;
  var sx, sz;
  for (sx = -1; sx <= 1; sx += 2) for (sz = -1; sz <= 1; sz += 2) {
    bar(FT, TANK.h, FT, sx * TANK.w / 2, TANK.h / 2, sz * TANK.d / 2);
    bar(TANK.w + FT, FT, FT, 0, TANK.h, sz * TANK.d / 2);
    bar(TANK.w + FT, FT, FT, 0, 0.08, sz * TANK.d / 2);
  }
  for (sx = -1; sx <= 1; sx += 2) {
    bar(FT, FT, TANK.d + FT, sx * TANK.w / 2, TANK.h, 0);
    bar(FT, FT, TANK.d + FT, sx * TANK.w / 2, 0.08, 0);
  }
  bar(TANK.w + 0.3, 0.16, TANK.d + 0.3, 0, 0.02, 0);

  /* ---------- substrate ---------- */
  var GROUND_Y = 0.62;
  var soil = new THREE.Mesh(
    new THREE.BoxGeometry(TANK.w - 0.22, GROUND_Y, TANK.d - 0.22),
    new THREE.MeshLambertMaterial({ map: soilTex, color: 0x9a8163 })
  );
  soil.position.y = GROUND_Y / 2;
  soil.receiveShadow = true;
  tank.add(soil);

  var rockWall = new THREE.Mesh(
    new THREE.BoxGeometry(TANK.w - 0.3, 1.62, 0.42),
    new THREE.MeshLambertMaterial({ map: rockTex, color: 0x8b8377, flatShading: true })
  );
  rockWall.position.set(0, GROUND_Y + 0.81, -TANK.d / 2 + 0.35);
  rockWall.castShadow = true;
  rockWall.receiveShadow = true;
  tank.add(rockWall);

  /* ---------- rocks ---------- */
  var rockMatA = new THREE.MeshLambertMaterial({ map: rockTex, color: 0x8e9099, flatShading: true });
  var rockMatB = new THREE.MeshLambertMaterial({ map: rockTex, color: 0x77786f, flatShading: true });
  var ROCKS = [];
  function addRock(x, z, s, mat) {
    var g = new THREE.Group(), i;
    var n = 2 + ((Math.random() * 2) | 0);
    for (i = 0; i < n; i++) {
      var m = new THREE.Mesh(new THREE.IcosahedronGeometry(rnd(0.28, 0.5) * s, 0), mat);
      m.position.set(rnd(-0.3, 0.3) * s, rnd(0, 0.22) * s, rnd(-0.3, 0.3) * s);
      m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
      m.scale.y = rnd(0.6, 0.95);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    g.position.set(x, GROUND_Y - 0.12, z);
    tank.add(g);
    ROCKS.push(g);
    return g;
  }
  addRock(-2.45, 0.85, 1.0, rockMatA);
  addRock(2.75, -1.35, 0.85, rockMatB);
  addRock(0.35, -1.75, 0.7, rockMatA);
  addRock(-1.35, -1.5, 0.6, rockMatB);

  /* ---------- branches ---------- */
  var barkMat = new THREE.MeshLambertMaterial({ map: barkTex, color: 0x9a7048, flatShading: true });
  var BRANCHES = [];
  function branch(x1, y1, z1, x2, y2, z2, r) {
    var a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    var len = a.distanceTo(b);
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, len, 6, 1), barkMat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.castShadow = true; m.receiveShadow = true;
    tank.add(m);
    BRANCHES.push(m);
    return m;
  }
  branch(-2.85, GROUND_Y - 0.1, -1.45, 0.25, GROUND_Y + 1.85, -1.15, 0.23);
  branch(0.25, GROUND_Y + 1.85, -1.15, 3.35, GROUND_Y + 1.23, -1.95, 0.16);
  branch(0.25, GROUND_Y + 1.85, -1.15, -2.95, GROUND_Y + 2.13, -2.15, 0.14);
  branch(-1.05, GROUND_Y - 0.12, 1.55, 2.3, GROUND_Y - 0.18, 1.95, 0.16);
  branch(-2.6, GROUND_Y - 0.15, 0.55, -1.6, GROUND_Y + 0.55, 0.9, 0.13);

  /* ---------- plants ---------- */
  var leafMats = [0x3f8c3a, 0x4fa544, 0x63bb4e, 0x2f6e2f, 0x7ecb5a].map(function (c) {
    return new THREE.MeshLambertMaterial({ color: c, flatShading: true, side: THREE.DoubleSide });
  });
  function plant(x, z, scale, big) {
    var g = new THREE.Group(), i;
    var n = big ? 7 : 5;
    for (i = 0; i < n; i++) {
      var len = rnd(0.55, 1.0) * scale * (big ? 1.5 : 1);
      var leaf = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, len * rnd(0.34, 0.5)), pick(leafMats));
      var a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
      var tilt = rnd(0.5, 1.05);
      leaf.position.set(Math.cos(a) * len * 0.45, rnd(0.05, 0.16) * scale + len * 0.28, Math.sin(a) * len * 0.45);
      leaf.rotation.set(-Math.sin(a) * tilt, -a, Math.cos(a) * tilt);
      leaf.castShadow = true;
      g.add(leaf);
    }
    if (big) {
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.3 * scale, 5), barkMat);
      stem.position.y = 0.65 * scale;
      stem.castShadow = true;
      g.add(stem);
    }
    g.position.set(x, GROUND_Y - 0.05, z);
    tank.add(g);
  }
  plant(-3.0, 1.5, 0.85, true);
  plant(3.05, 1.55, 0.75, true);
  plant(-3.1, -0.4, 0.7, false);
  plant(0.9, -1.9, 0.6, false);
  plant(2.1, 1.9, 0.55, false);

  function grass(x, z) {
    var g = new THREE.Group(), i;
    for (i = 0; i < 7; i++) {
      var h = rnd(0.25, 0.6);
      var b = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.05), pick(leafMats));
      b.position.set(rnd(-0.18, 0.18), h / 2, rnd(-0.18, 0.18));
      b.rotation.z = rnd(-0.35, 0.35); b.rotation.x = rnd(-0.35, 0.35);
      b.castShadow = true;
      g.add(b);
    }
    g.position.set(x, GROUND_Y - 0.03, z);
    tank.add(g);
  }
  grass(-1.9, 1.85); grass(1.6, -0.4); grass(-0.4, 1.5);

  /* ---------- hanging vines ---------- */
  var vineMat = new THREE.MeshLambertMaterial({ color: 0x4e7a3a, flatShading: true });
  function vine(x, z, len) {
    var g = new THREE.Group();
    var y = 0;
    while (y < len) {
      var seg = rnd(0.3, 0.5);
      var s = new THREE.Mesh(new THREE.BoxGeometry(0.05, seg, 0.05), vineMat);
      s.position.set(rnd(-0.06, 0.06), -y - seg / 2, rnd(-0.06, 0.06));
      g.add(s);
      if (Math.random() < 0.85) {
        var lf = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.16), pick(leafMats));
        lf.position.set(rnd(-0.16, 0.16), -y - seg / 2, rnd(-0.16, 0.16));
        lf.rotation.set(rnd(-0.6, 0.6), rnd(0, 3), rnd(-0.6, 0.6));
        lf.castShadow = true;
        g.add(lf);
      }
      y += seg;
    }
    g.position.set(x, TANK.h - 0.1, z);
    tank.add(g);
  }
  vine(-1.5, -2.0, 1.75);
  vine(1.9, -1.9, 1.35);

  /* ---------- water bowl ---------- */
  (function () {
    var bowl = new THREE.Group();
    var outer = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.26, 10),
      new THREE.MeshLambertMaterial({ color: 0xb8a68c, flatShading: true }));
    outer.position.y = 0.13; outer.castShadow = true; outer.receiveShadow = true;
    bowl.add(outer);
    var inner = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 10),
      new THREE.MeshLambertMaterial({ color: 0x3f8fc4, flatShading: true }));
    inner.position.y = 0.22;
    bowl.add(inner);
    bowl.position.set(2.35, GROUND_Y, 1.55);
    tank.add(bowl);
  })();

  /* ---------- hide ---------- */
  (function () {
    var cave = new THREE.Group();
    var cm = new THREE.MeshLambertMaterial({ map: rockTex, color: 0x8f8577, flatShading: true });
    for (var i = 0; i < 5; i++) {
      var a = Math.PI * (i / 4);
      var s = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.7), cm);
      s.position.set(Math.cos(a) * 0.62, 0.32 + Math.sin(a) * 0.55, 0);
      s.rotation.z = a - Math.PI / 2;
      s.castShadow = true;
      cave.add(s);
    }
    var dark = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x140f0c }));
    dark.position.set(0, 0.32, -0.05);
    cave.add(dark);
    cave.position.set(-2.35, GROUND_Y, -1.2);
    cave.rotation.y = 0.5;
    tank.add(cave);
  })();

  /* ---------- mushrooms ---------- */
  function mushroom(x, z, s) {
    var g = new THREE.Group();
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.09 * s, 0.3 * s, 6),
      new THREE.MeshLambertMaterial({ color: 0xf2e6cf, flatShading: true }));
    stem.position.y = 0.15 * s; stem.castShadow = true;
    var cap = new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 0.24 * s, 8),
      new THREE.MeshLambertMaterial({ color: 0xe0533f, flatShading: true }));
    cap.position.y = 0.36 * s; cap.castShadow = true;
    g.add(stem); g.add(cap);
    g.position.set(x, GROUND_Y, z);
    tank.add(g);
  }
  mushroom(-1.75, -1.85, 1.0); mushroom(-1.45, -1.95, 0.72); mushroom(1.15, 1.95, 0.85);

  /* ---------- heat lamp ---------- */
  var bulbMat = new THREE.MeshBasicMaterial({ color: 0xb08a5a });
  (function () {
    var metal = new THREE.MeshLambertMaterial({ color: 0x4b5560, flatShading: true });
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 8.5, 6), metal);
    pole.position.set(3.3, 2.55, -3.2); pole.castShadow = true;
    var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6), metal);
    arm.position.set(3.3, 6.8, -1.6); arm.rotation.x = Math.PI / 2; arm.castShadow = true;
    var arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.3, 6), metal);
    arm2.position.set(1.65, 6.8, 0.1); arm2.rotation.z = Math.PI / 2; arm2.castShadow = true;
    var shade = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.9, 10, 1, true),
      new THREE.MeshLambertMaterial({ color: 0x59636e, flatShading: true, side: THREE.DoubleSide }));
    shade.position.set(0, 6.45, 0); shade.castShadow = true;
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), bulbMat);
    bulb.position.set(0, 6.1, 0);
    scene.add(pole); scene.add(arm); scene.add(arm2); scene.add(shade); scene.add(bulb);
  })();

  /* ============================================================
     chameleon
     ============================================================ */
  // id 对应 i18n 里的 hero.colorName.<id>
  var PALETTE = [
    { id: 'jade',  body: 0x6fd44a, dark: 0x3f9c34, belly: 0xd7f0a8 },   // 翡翠
    { id: 'ocean', body: 0x4fc3f7, dark: 0x1f7bb0, belly: 0xc9ecff },   // 海蓝
    { id: 'lemon', body: 0xf2d34a, dark: 0xbe941c, belly: 0xfff3bd },   // 柠檬
    { id: 'coral', body: 0xff6b5b, dark: 0xbf3a3a, belly: 0xffd3b8 },   // 珊瑚
    { id: 'grape', body: 0xa87bf5, dark: 0x6b3fc0, belly: 0xe4d4ff }    // 葡萄
  ];
  var paletteIdx = 0;

  var matBody = new THREE.MeshLambertMaterial({ color: PALETTE[0].body, flatShading: true });
  var matDark = new THREE.MeshLambertMaterial({ color: PALETTE[0].dark, flatShading: true });
  var matBelly = new THREE.MeshLambertMaterial({ color: PALETTE[0].belly, flatShading: true });
  var matEye = new THREE.MeshLambertMaterial({ color: 0xfff4d6, flatShading: true });
  var matPupil = new THREE.MeshBasicMaterial({ color: 0x140f14 });
  var matTongue = new THREE.MeshLambertMaterial({ color: 0xff6f9c, flatShading: true });

  var cham = new THREE.Group();
  scene.add(cham);

  var torso = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.74, 0.5), matBody);
  torso.position.set(0, 0.68, 0);
  torso.castShadow = true;
  cham.add(torso);

  var dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.52), matDark);
  dorsal.position.set(0, 0.99, 0);
  cham.add(dorsal);

  var si;
  for (si = 0; si < 3; si++) {
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.52), matDark);
    stripe.position.set(-0.24 + si * 0.24, 0.52, 0);
    stripe.castShadow = true;
    cham.add(stripe);
  }
  for (si = 0; si < 6; si++) {
    var crest = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.24, 4), matDark);
    crest.position.set(-0.3 + si * 0.14, 1.07, 0);
    crest.castShadow = true;
    cham.add(crest);
  }
  var belly = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.42), matBelly);
  belly.position.set(0.02, 0.37, 0);
  cham.add(belly);

  var head = new THREE.Group();
  head.position.set(0.56, 0.78, 0);
  cham.add(head);

  var skull = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.46), matBody);
  skull.position.set(0.16, 0.02, 0);
  skull.castShadow = true;
  head.add(skull);

  var casque = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 4), matDark);
  casque.position.set(0.06, 0.28, 0);
  casque.rotation.z = -0.42;
  casque.castShadow = true;
  head.add(casque);

  var snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.3), matBody);
  snout.position.set(0.42, -0.03, 0);
  snout.castShadow = true;
  head.add(snout);

  var mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.28), matPupil);
  mouth.position.set(0.53, -0.1, 0);
  head.add(mouth);

  var tonguePivot = new THREE.Group();
  tonguePivot.position.set(0.5, -0.08, 0);
  head.add(tonguePivot);
  var tongueGeo = new THREE.CylinderGeometry(0.045, 0.035, 1, 5);
  tongueGeo.rotateZ(-Math.PI / 2);
  tongueGeo.translate(0.5, 0, 0);
  var tongue = new THREE.Mesh(tongueGeo, matTongue);
  tongue.scale.x = 0.001;
  tonguePivot.add(tongue);
  var tongueTip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), matTongue);
  tongueTip.visible = false;
  tonguePivot.add(tongueTip);

  var eyes = [];
  var szi;
  for (szi = -1; szi <= 1; szi += 2) {
    var eg = new THREE.Group();
    eg.position.set(0.24, 0.1, szi * 0.22);
    head.add(eg);
    var turret = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.1, 8), matDark);
    turret.rotation.x = Math.PI / 2;
    turret.position.z = szi * 0.02;
    eg.add(turret);
    var ball = new THREE.Group();
    ball.position.z = szi * 0.07;
    eg.add(ball);
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), matEye));
    var pupil = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.06), matPupil);
    pupil.position.z = szi * 0.1;
    ball.add(pupil);
    eyes.push({ group: eg, ball: ball, sz: szi, yaw: 0, pitch: 0 });
  }

  function makeLeg(x, z, front) {
    var g = new THREE.Group();
    g.position.set(x, 0.42, z);
    var upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.13), matBody);
    upper.position.y = -0.22;
    upper.castShadow = true;
    g.add(upper);
    var foot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.19), matDark);
    foot.position.set(0.03, -0.44, 0);
    foot.castShadow = true;
    g.add(foot);
    for (var i = 0; i < 3; i++) {
      var toe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.07), matDark);
      toe.position.set(0.15, -0.44, -0.07 + i * 0.07);
      g.add(toe);
    }
    g.rotation.x = (z > 0 ? 1 : -1) * 0.22;
    g.rotation.z = front ? 0.12 : -0.12;
    cham.add(g);
    return { g: g, baseZ: g.rotation.z, front: front };
  }
  var legs = [
    makeLeg(0.34, 0.24, true), makeLeg(0.34, -0.24, true),
    makeLeg(-0.32, 0.24, false), makeLeg(-0.32, -0.24, false)
  ];

  var tailSegs = [];
  (function () {
    var parent = cham;
    for (var i = 0; i < 13; i++) {
      var g = new THREE.Group();
      g.position.set(i === 0 ? -0.46 : -0.135, i === 0 ? 0.76 : 0, 0);
      if (i === 0) g.rotation.z = -0.22;
      var t = 1 - i / 13;
      var seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.145, 0.21 * t + 0.055, 0.21 * t + 0.055),
        i % 2 ? matBody : matDark
      );
      seg.position.x = -0.068;
      seg.castShadow = true;
      g.add(seg);
      parent.add(g);
      tailSegs.push(g);
      parent = g;
    }
  })();

  /* ============================================================
     crickets + particles
     ============================================================ */
  var cricketMatA = new THREE.MeshLambertMaterial({ color: 0x8a5a24, flatShading: true });
  var cricketMatB = new THREE.MeshLambertMaterial({ color: 0x5e3c17, flatShading: true });
  var insects = [];
  var BOUND = { x: 2.75, z: 1.85 };

  function spawnInsect(x, z, fromSky) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.17), cricketMatA);
    body.castShadow = true;
    g.add(body);
    var headm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.13), cricketMatB);
    headm.position.x = 0.19;
    g.add(headm);
    for (var s = -1; s <= 1; s += 2) {
      var ant = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.02), cricketMatB);
      ant.position.set(0.3, 0.06, s * 0.05);
      ant.rotation.y = s * 0.4;
      g.add(ant);
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), cricketMatB);
      leg.position.set(-0.06, -0.1, s * 0.08);
      g.add(leg);
    }
    g.position.set(x, fromSky ? TANK.h + 0.6 : GROUND_Y + 0.12, z);
    scene.add(g);
    var obj = {
      g: g, alive: true, hopT: rnd(0.2, 1.0), hopA: 0,
      y0: GROUND_Y + 0.12, drop: !!fromSky, vx: 0, vz: 0, caught: false
    };
    insects.push(obj);
    if (insects.length > 4) scene.remove(insects.shift().g);
    return obj;
  }

  var pool = [];
  function getParticle(color, size) {
    var i;
    for (i = 0; i < pool.length; i++) {
      if (!pool[i].mesh.visible) {
        pool[i].mesh.material.color.setHex(color);
        pool[i].mesh.scale.setScalar(size / 0.12);
        return pool[i];
      }
    }
    if (pool.length > 120) return null;
    var m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshLambertMaterial({ color: color, flatShading: true }));
    m.visible = false;
    scene.add(m);
    var p = { mesh: m, vel: new THREE.Vector3(), life: 0, grav: 9, spin: 0 };
    pool.push(p);
    return p;
  }
  function burst(pos, count, color, speed, grav, size, up) {
    for (var i = 0; i < count; i++) {
      var p = getParticle(color, size || 0.12);
      if (!p) return;
      p.mesh.position.copy(pos);
      p.vel.set(rnd(-speed, speed), rnd(0.2, speed * (up || 1)), rnd(-speed, speed));
      p.life = rnd(0.4, 0.9);
      p.grav = grav || 9;
      p.spin = rnd(-8, 8);
      p.mesh.visible = true;
    }
  }
  function updateParticles(dt) {
    for (var i = 0; i < pool.length; i++) {
      var p = pool[i];
      if (!p.mesh.visible) continue;
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.z += p.spin * 0.7 * dt;
      p.life -= dt;
      if (p.life <= 0 || p.mesh.position.y < GROUND_Y - 0.2) p.mesh.visible = false;
    }
  }

  /* ============================================================
     state
     ============================================================ */
  var night = root.getAttribute('data-theme') === 'dark' ? 1 : 0;
  var nightTarget = night;

  var st = {
    mode: 'idle', timer: 0, walkT: 0, target: new THREE.Vector3(),
    yaw: 0, tyaw: 0, cooldown: 0, t: 0,
    blink: 0, blinkT: rnd(2, 5), lookOut: 0, lookT: rnd(3, 7),
    shoot: null
  };
  var mouthWorld = new THREE.Vector3();

  function setTarget() {
    st.target.set(rnd(-BOUND.x, BOUND.x), GROUND_Y, rnd(-BOUND.z, BOUND.z));
    st.walkT = rnd(1.8, 4.2);
  }
  setTarget();

  function nearestInsect() {
    var best = null, bd = 99;
    for (var i = 0; i < insects.length; i++) {
      var it = insects[i];
      if (!it.alive || it.caught) continue;
      var d = it.g.position.distanceTo(cham.position);
      if (d < bd) { bd = d; best = it; }
    }
    return { it: best, d: bd };
  }

  /* ============================================================
     camera framing — subject sits right of centre on wide screens,
     centred and low on narrow ones
     ============================================================ */
  var CONTENT = { w: 8.3, h: 8.9, d: 6.2, cy: 2.5 };
  var BASE_YAW = 0.30;
  var BASE_PITCH = 0.26;
  var view = { yaw: BASE_YAW, pitch: BASE_PITCH, dist: 20, dragYaw: 0, dragPitch: 0 };
  var heroW = 1200, heroH = 700;

  // 内容包围盒的 8 个角点，用于把整组缸精确塞进取景框
  var CORNERS = [];
  (function () {
    for (var a = -1; a <= 1; a += 2) {
      for (var b = -1; b <= 1; b += 2) {
        for (var c = -1; c <= 1; c += 2) {
          CORNERS.push(new THREE.Vector3(a * CONTENT.w / 2, CONTENT.cy + b * CONTENT.h / 2, c * CONTENT.d / 2));
        }
      }
    }
  })();

  var _v = new THREE.Vector3();
  var _pivot = new THREE.Vector3();
  var _dir = new THREE.Vector3();
  var _right = new THREE.Vector3();
  var _up = new THREE.Vector3();
  var _fwd = new THREE.Vector3();
  var WORLD_UP = new THREE.Vector3(0, 1, 0);

  /* 断点与 css/styles.css 中的 hero 布局保持一致：
       >= 901px  两栏，文字在左、缸在右
       641-900   居中，缸在下半部
       < 641     居中，缸在下半部（文字区更高）
     目标 ndc 为缸的视觉中心，avail 为允许占用的半屏比例。 */
  function frameSubject() {
    var aspect = camera.aspect;
    var tanV = Math.tan(camera.fov * Math.PI / 360);
    var ndcX, ndcY, availW, availH;

    if (heroW >= 901) {
      ndcX = 0.42; ndcY = -0.05; availW = 0.50; availH = 0.86;
    } else if (heroW >= 641) {
      ndcX = 0.0; ndcY = -0.42; availW = 0.94; availH = 0.54;
    } else {
      ndcX = 0.0; ndcY = -0.44; availW = 0.96; availH = 0.52;
    }

    var yaw = view.yaw, pitch = view.pitch;
    _dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    _fwd.copy(_dir).negate();
    _right.crossVectors(_fwd, WORLD_UP).normalize();
    _up.crossVectors(_right, _fwd).normalize();

    var dist = view.dist;
    _pivot.set(0, CONTENT.cy, 0);

    // 迭代求解：先用距离把内容缩放到恰好占满可用区，再平移取景中心
    for (var it = 0; it < 5; it++) {
      var camX = _pivot.x + _dir.x * dist;
      var camY = _pivot.y + _dir.y * dist;
      var camZ = _pivot.z + _dir.z * dist;
      var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (var i = 0; i < 8; i++) {
        _v.set(CORNERS[i].x - camX, CORNERS[i].y - camY, CORNERS[i].z - camZ);
        var depth = -(_v.x * _dir.x + _v.y * _dir.y + _v.z * _dir.z);
        if (depth < 0.2) depth = 0.2;
        var nx = (_v.x * _right.x + _v.y * _right.y + _v.z * _right.z) / (depth * tanV * aspect);
        var ny = (_v.x * _up.x + _v.y * _up.y + _v.z * _up.z) / (depth * tanV);
        if (nx < minX) minX = nx; if (nx > maxX) maxX = nx;
        if (ny < minY) minY = ny; if (ny > maxY) maxY = ny;
      }
      var scale = Math.max((maxX - minX) / (2 * availW), (maxY - minY) / (2 * availH));
      if (scale > 0.0001) dist = clamp(dist * scale, 4, 90);
      var halfVisW = dist * tanV * aspect, halfVisH = dist * tanV;
      _pivot.addScaledVector(_right, -(ndcX - (minX + maxX) / 2) * halfVisW);
      _pivot.addScaledVector(_up, -(ndcY - (minY + maxY) / 2) * halfVisH);
    }

    view.dist = dist;
    camera.position.copy(_pivot).addScaledVector(_dir, dist);
    camera.lookAt(_pivot);
    camera.updateMatrixWorld(true);
  }

  /* ============================================================
     pointer interaction (hover devices only — never traps a scroll)
     ============================================================ */
  var canDrag = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var dragging = false, dragMoved = 0, lastX = 0, lastY = 0;
  var idleSince = 0;
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();

  function localPoint(ev) {
    var r = canvas.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  }

  if (canDrag) {
    canvas.addEventListener('pointerdown', function (ev) {
      dragging = true; dragMoved = 0;
      lastX = ev.clientX; lastY = ev.clientY;
      idleSince = st.t;
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(ev.pointerId); } catch (e) {} }
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var dx = ev.clientX - lastX, dy = ev.clientY - lastY;
      lastX = ev.clientX; lastY = ev.clientY;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      view.dragYaw = clamp(view.dragYaw - dx * 0.0045, -0.62, 0.62);
      view.dragPitch = clamp(view.dragPitch + dy * 0.0030, -0.16, 0.26);
      idleSince = st.t;
    });
    canvas.addEventListener('pointerup', function (ev) {
      var wasDrag = dragMoved > 7;
      dragging = false;
      if (wasDrag) return;
      // a clean click feeds the chameleon
      localPoint(ev);
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects([soil, rockWall].concat(BRANCHES, ROCKS), true);
      if (hits.length) {
        var p = hits[0].point;
        if (Math.abs(p.x) < TANK.w / 2 - 0.4 && Math.abs(p.z) < TANK.d / 2 - 0.4) {
          spawnInsect(clamp(p.x, -BOUND.x, BOUND.x), clamp(p.z, -BOUND.z, BOUND.z), true);
          st.cooldown = 0;
        }
      }
    });
    canvas.addEventListener('pointercancel', function () { dragging = false; });
  }

  /* ============================================================
     theme sync
     ============================================================ */
  var themeObs = new MutationObserver(function () {
    nightTarget = root.getAttribute('data-theme') === 'dark' ? 1 : 0;
    if (reduceMotion) { night = nightTarget; render(0); }
  });
  themeObs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* ============================================================
     chameleon behaviour
     ============================================================ */
  function updateChameleon(dt) {
    var t = st.t;
    var asleep = night > 0.55;

    if (asleep) {
      st.mode = 'sleep';
    } else if (st.mode === 'sleep') {
      st.mode = 'idle';
      st.timer = 0.4;
    }

    if (st.mode !== 'shoot') {
      var near = nearestInsect();
      if (st.cooldown <= 0 && near.it && near.d < 3.4) {
        st.shoot = { phase: 'aim', t: 0, insect: near.it };
        st.mode = 'shoot';
      }
    }

    if (st.mode === 'idle' || st.mode === 'walk') {
      st.timer -= dt;
      st.walkT -= dt;
      var speed = night > 0.55 ? 0 : (night > 0.2 ? 0.55 : 1.05);
      var d = Math.hypot(st.target.x - cham.position.x, st.target.z - cham.position.z);
      if (d > 0.25 && st.walkT > 0) {
        st.mode = 'walk';
        var dir = new THREE.Vector3(
          st.target.x - cham.position.x, 0, st.target.z - cham.position.z).normalize();
        cham.position.addScaledVector(dir, speed * dt);
        st.tyaw = Math.atan2(-dir.z, dir.x);
        var ph = t * 9;
        for (var i = 0; i < legs.length; i++) {
          var off = (i === 0 || i === 3) ? 0 : Math.PI;
          legs[i].g.rotation.z = legs[i].baseZ + Math.sin(ph + off) * 0.45;
        }
        cham.position.y = GROUND_Y + Math.abs(Math.sin(ph)) * 0.045;
        for (var j = 0; j < tailSegs.length; j++) {
          var wt = 0.13 + Math.sin(t * 7 - j * 0.5) * 0.05;
          tailSegs[j].rotation.z += (wt - tailSegs[j].rotation.z) * Math.min(1, dt * 8);
        }
      } else {
        st.mode = 'idle';
        if (st.timer <= 0) { setTarget(); st.timer = rnd(1.2, 3.2); }
        var b = Math.sin(t * 2.1) * 0.5 + 0.5;
        torso.scale.set(1 + b * 0.035, 1 + b * 0.045, 1 + b * 0.035);
        belly.scale.set(1 + b * 0.05, 1, 1 + b * 0.05);
        for (var k = 0; k < legs.length; k++) {
          legs[k].g.rotation.z += (legs[k].baseZ - legs[k].g.rotation.z) * Math.min(1, dt * 6);
        }
        cham.position.y += (GROUND_Y - cham.position.y) * Math.min(1, dt * 6);
        for (var m = 0; m < tailSegs.length; m++) {
          var it2 = 0.34 + Math.sin(t * 1.6 - m * 0.35) * 0.05;
          tailSegs[m].rotation.z += (it2 - tailSegs[m].rotation.z) * Math.min(1, dt * 3.5);
        }
      }
      var dyaw = st.tyaw - st.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      st.yaw += dyaw * Math.min(1, dt * 4);
    } else if (st.mode === 'sleep') {
      var sb = Math.sin(t * 1.1) * 0.5 + 0.5;
      torso.scale.set(1 + sb * 0.05, 1 + sb * 0.055, 1 + sb * 0.05);
      for (var n = 0; n < legs.length; n++) {
        var lg = legs[n];
        lg.g.rotation.z += ((lg.baseZ + (lg.front ? -0.22 : 0.22)) - lg.g.rotation.z) * Math.min(1, dt * 3);
      }
      cham.position.y += ((GROUND_Y - 0.06) - cham.position.y) * Math.min(1, dt * 3);
      for (var q = 0; q < tailSegs.length; q++) {
        var stt = 0.42 + Math.sin(t * 0.9 - q * 0.3) * 0.03;
        tailSegs[q].rotation.z += (stt - tailSegs[q].rotation.z) * Math.min(1, dt * 2.5);
      }
    }

    /* ---- tongue strike ---- */
    if (st.mode === 'shoot' && st.shoot) {
      var sh = st.shoot;
      sh.t += dt;
      var ins = sh.insect;
      if (!ins || !ins.alive) { st.mode = 'idle'; st.shoot = null; }
      else {
        var d2 = new THREE.Vector3().subVectors(ins.g.position, cham.position);
        st.tyaw = Math.atan2(-d2.z, d2.x);
        var dy = st.tyaw - st.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        st.yaw += dy * Math.min(1, dt * 9);
        cham.rotation.y = st.yaw;

        mouthWorld.setFromMatrixPosition(tonguePivot.matrixWorld);
        var local = tonguePivot.parent.worldToLocal(ins.g.position.clone());
        var flat = Math.hypot(local.x, local.z);
        tonguePivot.rotation.y = Math.atan2(-local.z, local.x);
        tonguePivot.rotation.z = Math.atan2(local.y, flat);
        var dist = Math.hypot(local.x, local.y, local.z);

        if (sh.phase === 'aim') {
          tongue.scale.x += (0.001 - tongue.scale.x) * Math.min(1, dt * 12);
          tongueTip.visible = false;
          head.rotation.z += (0.16 - head.rotation.z) * Math.min(1, dt * 8);
          if (sh.t > 0.18) { sh.phase = 'out'; sh.t = 0; }
        } else if (sh.phase === 'out') {
          tongue.scale.x += (dist - tongue.scale.x) * Math.min(1, dt * 26);
          tongueTip.visible = true;
          tongueTip.position.x = tongue.scale.x;
          if (sh.t > 0.14) { sh.phase = 'in'; sh.t = 0; }
        } else {
          tongue.scale.x += (0.001 - tongue.scale.x) * Math.min(1, dt * 22);
          tongueTip.position.x = tongue.scale.x;
          if (sh.t > 0.06) {
            ins.caught = true; ins.alive = false;
            scene.remove(ins.g);
            var idx = insects.indexOf(ins);
            if (idx >= 0) insects.splice(idx, 1);
            burst(cham.position.clone().setY(cham.position.y + 0.9), 10, 0xfff0a0, 1.2, 5, 0.09, 1.4);
          }
          if (sh.t > 0.2) {
            tongueTip.visible = false;
            st.shoot = null;
            st.mode = 'idle';
            st.cooldown = 1.1;
            st.timer = 0.4;
          }
        }
      }
    } else {
      head.rotation.z += (0 - head.rotation.z) * Math.min(1, dt * 5);
      tongue.scale.x += (0.001 - tongue.scale.x) * Math.min(1, dt * 14);
      if (tongue.scale.x < 0.02) tongueTip.visible = false;
    }

    /* ---- eyes ---- */
    st.blinkT -= dt;
    if (st.blinkT <= 0) { st.blink = 0.14; st.blinkT = rnd(2.2, 6.0); }
    if (st.blink > 0) st.blink -= dt;
    st.lookT -= dt;
    if (st.lookT <= 0) { st.lookOut = 0.9; st.lookT = rnd(4, 9); }
    if (st.lookOut > 0) st.lookOut -= dt;

    var nearEye = nearestInsect();
    for (var e = 0; e < eyes.length; e++) {
      var eye = eyes[e];
      var closed = asleep || st.blink > 0;
      eye.ball.scale.y += ((closed ? 0.14 : 1) - eye.ball.scale.y) * Math.min(1, dt * (closed ? 16 : 12));
      var ty, tp;
      if (asleep) {
        ty = 0; tp = 0;
      } else if (st.lookOut > 0) {
        var camLocal = head.worldToLocal(camera.position.clone());
        ty = Math.atan2(camLocal.z, camLocal.x) * eye.sz * 0.55;
        tp = -Math.atan2(camLocal.y, Math.hypot(camLocal.x, camLocal.z)) * 0.7;
      } else if (nearEye.it && nearEye.d < 4) {
        var pl = head.worldToLocal(nearEye.it.g.position.clone());
        ty = Math.atan2(pl.z, pl.x) * eye.sz * 0.9;
        tp = -Math.atan2(pl.y, Math.hypot(pl.x, pl.z)) * 0.9;
      } else {
        ty = Math.sin(t * 0.9 + eye.sz) * 0.7;
        tp = Math.sin(t * 1.3 + eye.sz * 2) * 0.25;
      }
      eye.yaw += (ty - eye.yaw) * Math.min(1, dt * 6);
      eye.pitch += (tp - eye.pitch) * Math.min(1, dt * 6);
      eye.group.rotation.y = eye.yaw;
      eye.group.rotation.x = eye.pitch;
    }

    var hy = Math.sin(t * 0.7) * 0.12 + (st.lookOut > 0 ? 0.1 : 0);
    head.rotation.y += (hy - head.rotation.y) * Math.min(1, dt * 2);
    cham.rotation.y = st.yaw;
  }

  function updateInsects(dt) {
    for (var i = 0; i < insects.length; i++) {
      var it = insects[i], g = it.g;
      if (it.drop) {
        g.position.y -= dt * 6;
        if (g.position.y <= it.y0) {
          g.position.y = it.y0; it.drop = false;
          burst(g.position.clone(), 3, 0x6b4a2e, 0.5, 6, 0.06, 1);
        }
        continue;
      }
      it.hopT -= dt;
      if (it.hopT <= 0) {
        it.hopT = rnd(0.5, 1.3);
        it.hopA = 0.32;
        it.vx = rnd(-1.1, 1.1);
        it.vz = rnd(-1.1, 1.1);
      }
      if (it.hopA > 0) it.hopA -= dt * 3.2;
      g.position.x = clamp(g.position.x + it.vx * dt, -BOUND.x, BOUND.x);
      g.position.z = clamp(g.position.z + it.vz * dt, -BOUND.z, BOUND.z);
      g.position.y = it.y0 + Math.max(0, Math.sin(Math.max(0, it.hopA) * Math.PI / 0.32) * 0.22);
      g.rotation.y = Math.atan2(-it.vz, it.vx);
    }
  }

  /* ============================================================
     render
     ============================================================ */
  function applyNight(dt) {
    var k = dt * 1.5;
    hemi.intensity += ((DAY.hemi + (NIGHT.hemi - DAY.hemi) * night) - hemi.intensity) * k;
    sun.intensity += ((DAY.sun + (NIGHT.sun - DAY.sun) * night) - sun.intensity) * k;
    amb.intensity += ((DAY.amb + (NIGHT.amb - DAY.amb) * night) - amb.intensity) * k;
    lampLight.intensity += ((DAY.lamp + (NIGHT.lamp - DAY.lamp) * night) - lampLight.intensity) * k;
    starMat.opacity += ((night > 0.5 ? 0.95 : 0) - starMat.opacity) * Math.min(1, dt * 1.4);
    bulbMat.color.setHex(night > 0.5 ? 0xfff0c0 : 0xb08a5a);
    blobMat.opacity = 0.5 - night * 0.14;
    paintSky(night);
    renderer.setClearColor(new THREE.Color(
      SKY.day.bot[0] + (SKY.night.bot[0] - SKY.day.bot[0]) * night,
      SKY.day.bot[1] + (SKY.night.bot[1] - SKY.day.bot[1]) * night,
      SKY.day.bot[2] + (SKY.night.bot[2] - SKY.day.bot[2]) * night
    ));
  }

  function render(dt) {
    var P = PALETTE[paletteIdx];
    matBody.color.lerp(new THREE.Color(P.body), Math.min(1, dt * 3));
    matDark.color.lerp(new THREE.Color(P.dark), Math.min(1, dt * 3));
    matBelly.color.lerp(new THREE.Color(P.belly), Math.min(1, dt * 3));
    renderer.render(scene, camera);
  }

  /* ============================================================
     loop
     ============================================================ */
  var last = 0, running = false, visible = true, rafId = null;

  function step(dt) {
    st.t += dt;
    st.cooldown = Math.max(0, st.cooldown - dt);

    // ease the day/night crossfade, matching the 0.6s CSS theme transition
    if (night !== nightTarget) {
      var s = dt * 1.7;
      night = Math.abs(nightTarget - night) <= s ? nightTarget : night + (nightTarget > night ? s : -s);
    }

    // idle sway (never while the visitor is dragging, and it eases back in)
    var idleFor = st.t - idleSince;
    var sway = (!dragging && idleFor > 1.2) ? Math.sin(st.t * 0.22) * 0.055 : 0;
    view.yaw += ((BASE_YAW + view.dragYaw + sway) - view.yaw) * Math.min(1, dt * 1.6);
    view.pitch += ((BASE_PITCH + view.dragPitch) - view.pitch) * Math.min(1, dt * 1.6);
    frameSubject();

    updateChameleon(dt);
    updateInsects(dt);
    updateParticles(dt);
    applyNight(dt);
    render(dt);
  }

  function loop(ts) {
    rafId = null;
    var t = ts / 1000;
    var dt = last ? Math.min(0.05, t - last) : 0.016;
    last = t;
    step(dt);
    if (running && visible && !reduceMotion) rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = 0;
    if (visible) rafId = requestAnimationFrame(loop);
  }
  function pause() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* ============================================================
     sizing
     ============================================================ */
  function resize() {
    var rect = hero.getBoundingClientRect();
    var w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    var aspect = w / h;
    heroW = w; heroH = h;

    var rw = clamp(Math.round(w / PIXEL_SCALE), 200, 760);
    var rh = Math.max(120, Math.round(rw / aspect));
    renderer.setSize(rw, rh, false);

    var small = w < 760;
    renderer.shadowMap.enabled = !small;
    sun.shadow.mapSize.set(small ? 512 : 1024, small ? 512 : 1024);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }

    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    frameSubject();

    if (reduceMotion) step(0.016);
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 140);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && running && !reduceMotion && !rafId) { last = 0; rafId = requestAnimationFrame(loop); }
      else if (!visible) pause();
    }, { threshold: 0.02 }).observe(hero);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
    else if (running && visible && !reduceMotion) { last = 0; rafId = requestAnimationFrame(loop); }
  });

  /* ============================================================
     controls — feed + recolour
     The markup ships in index.html so the site's i18n pass can
     paint it; it stays `hidden` until the scene is actually up,
     so a WebGL failure never leaves dead buttons behind.
     ============================================================ */
  var playRow = document.getElementById('heroPlay');
  var feedBtn = document.getElementById('heroFeed');
  var colorBtn = document.getElementById('heroColor');
  var colorSwatch = document.getElementById('heroColorSwatch');

  function cssHex(hex) { return '#' + ('000000' + hex.toString(16)).slice(-6); }

  function t(key) {
    return window.i18nCore ? window.i18nCore.t(window.i18nCore.get(), key) : null;
  }

  function paintColorButton() {
    if (colorSwatch) colorSwatch.style.background = cssHex(PALETTE[paletteIdx].body);
    if (!colorBtn) return;
    var tmpl = t('hero.colorTitle') || '变色 · 当前：{c}';
    var name = t('hero.colorName.' + PALETTE[paletteIdx].id) || PALETTE[paletteIdx].id;
    colorBtn.setAttribute('title', tmpl.replace('{c}', name));
  }

  // with prefers-reduced-motion the render loop is parked, so advance one
  // frame by hand to make the change show up immediately
  function repaint() { if (reduceMotion) step(0.016); }

  function dropCricket() {
    spawnInsect(rnd(-BOUND.x, BOUND.x), rnd(-BOUND.z, BOUND.z), true);
    st.cooldown = 0;          // let the chameleon go for it right away
    repaint();
  }

  function cycleColor() {
    paletteIdx = (paletteIdx + 1) % PALETTE.length;
    paintColorButton();
    repaint();
  }

  if (playRow && feedBtn && colorBtn) {
    feedBtn.addEventListener('click', dropCricket);
    colorBtn.addEventListener('click', cycleColor);
    // the tooltip carries the colour name, so it has to follow the language
    document.addEventListener('0x4ea:langchange', paintColorButton);

    paintColorButton();
    playRow.hidden = false;
    if (playRow.classList.contains('reveal')) {
      void playRow.offsetWidth;               // let the fade-in actually run
      playRow.classList.add('is-visible');
    }
  }

  /* ============================================================
     boot
     ============================================================ */
  cham.position.set(-0.5, GROUND_Y, 0.3);
  st.yaw = st.tyaw = 0.9;
  cham.rotation.y = st.yaw;
  // 缸里不自动掉虫子：只在你按「投喂」或点击底砂时才有蟋蟀
  paintSky(night);
  applyNight(1);
  resize();
  if (reduceMotion) { step(0.016); } else { start(); }
})();
