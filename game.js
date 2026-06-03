/**
 * game.js — Main Three.js scene, game loop, difficulty system,
 *            cannon movement, sensitivity, fort-based 5-level campaign
 *
 * Controls:
 *   Arrow Keys  → Aim cannon (azimuth + elevation)
 *   W / S       → Move cannon forward / backward
 *   A / D       → Strafe cannon left / right
 *   SPACE       → Hold to charge power, release to fire
 *   R           → Restart after game over
 *   ESC         → Return to menu
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────
  //  FORT BUILDER UTILITY
  //  Each character = one block column at that grid position
  //  '#' = wall (wallH)   'T' = tower (towerH)
  //  'K' = keep  (keepH)  '.' = empty
  // ─────────────────────────────────────────
  const BLOCK = 2.15;

  function fort(cx, cz, map, wallH, towerH, keepH) {
    const rows = map.length;
    const cols  = Math.max(...map.map(r => r.length));
    const result = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < map[row].length; col++) {
        const ch = map[row][col];
        if (ch === ' ' || ch === '.') continue;
        const wx = cx + (col - (cols  - 1) / 2) * BLOCK;
        const wz = cz + (row - (rows - 1) / 2) * BLOCK;
        const h  = ch === 'T' ? towerH : ch === 'K' ? keepH : wallH;
        result.push({ x: wx, z: wz, w: 1, d: 1, h });
      }
    }
    return result;
  }

  // ─────────────────────────────────────────
  //  DIFFICULTY CONFIGS  (game modifiers)
  // ─────────────────────────────────────────
  const DIFF = {
    EASY: {
      label:     'EASY',
      color:     '#3DFF7A',
      hitRadius: 2.4,
      scoreMult: 0.8,
      reloadDur: 1.8,
      extraWind: 0.3,
    },
    MEDIUM: {
      label:     'MEDIUM',
      color:     '#FFB833',
      hitRadius: 1.8,
      scoreMult: 1.0,
      reloadDur: 2.6,
      extraWind: 0.9,
    },
    HARD: {
      label:     'HARD',
      color:     '#FF4433',
      hitRadius: 1.35,
      scoreMult: 2.5,
      reloadDur: 3.6,
      extraWind: 2.0,
    }
  };

  // ─────────────────────────────────────────
  //  LEVEL SETS  (one set per difficulty)
  //  Each level: { name, wind:{x,z}, ammo, towers[] }
  // ─────────────────────────────────────────
  const LEVEL_SETS = {

    /* ══════════════════════════════════════
       EASY — Small open forts, few blocks
       ══════════════════════════════════════ */
    EASY: [
      {
        name: 'Sentinel Towers',
        wind: { x: 0, z: 0 },
        ammo: 18,
        towers: [
          ...fort(0, 38, [
            'T...T',
            '.....',
            '.....',
            'T...T'
          ], 1, 3, 4)
        ]
      },
      {
        name: 'Frontier Outpost',
        wind: { x: 0.6, z: 0 },
        ammo: 16,
        towers: [
          ...fort(0, 42, [
            'T#####T',
            '#.....#',
            '#.....#',
            'T#####T'
          ], 2, 4, 5)
        ]
      },
      {
        name: 'Twin Watch Posts',
        wind: { x: 1.0, z: 0.2 },
        ammo: 16,
        towers: [
          ...fort(-14, 42, [
            'T###T',
            '#...#',
            'T###T'
          ], 2, 4, 5),
          ...fort(14, 42, [
            'T###T',
            '#...#',
            'T###T'
          ], 2, 4, 5)
        ]
      },
      {
        name: 'Border Fort',
        wind: { x: 1.3, z: 0.4 },
        ammo: 15,
        towers: [
          ...fort(0, 44, [
            'T########T',
            '#........#',
            '#...KK...#',
            '#........#',
            'T########T'
          ], 2, 5, 4)
        ]
      },
      {
        name: 'Garrison Stronghold',
        wind: { x: 1.6, z: 0.5 },
        ammo: 15,
        towers: [
          // Main fort
          ...fort(0, 47, [
            'T###########T',
            '#...........#',
            '#...#####...#',
            '#...#...#...#',
            '#...#####...#',
            '#...........#',
            'T###########T'
          ], 2, 5, 4),
          // Flanking watchtowers
          ...fort(-20, 43, ['TT', 'TT'], 1, 5, 6),
          ...fort( 20, 43, ['TT', 'TT'], 1, 5, 6)
        ]
      }
    ],

    /* ══════════════════════════════════════
       MEDIUM — Proper castles & citadels
       ══════════════════════════════════════ */
    MEDIUM: [
      {
        name: 'Stone Castle',
        wind: { x: 1.8, z: 0.4 },
        ammo: 14,
        towers: [
          ...fort(0, 44, [
            'TT######TT',
            'T........T',
            '#........#',
            '#...KK...#',
            '#...KK...#',
            'T........T',
            'TT######TT'
          ], 3, 6, 5)
        ]
      },
      {
        name: 'Divided Kingdom',
        wind: { x: 2.1, z: 0.6 },
        ammo: 16,
        towers: [
          ...fort(-17, 44, [
            'TT######TT',
            'T........T',
            '#...KK...#',
            '#...KK...#',
            'T........T',
            'TT######TT'
          ], 3, 6, 5),
          ...fort(17, 44, [
            'TT######TT',
            'T........T',
            '#...KK...#',
            '#...KK...#',
            'T........T',
            'TT######TT'
          ], 3, 6, 5)
        ]
      },
      {
        name: 'Grand Keep',
        wind: { x: 2.3, z: 0.9 },
        ammo: 16,
        towers: [
          ...fort(0, 50, [
            'TTT##########TTT',
            'T..............T',
            '##............##',
            '##....KKKK....##',
            '##....KKKK....##',
            '##....KKKK....##',
            '##............##',
            'T..............T',
            'TTT##########TTT'
          ], 3, 7, 6)
        ]
      },
      {
        name: 'Concentric Walls',
        wind: { x: 2.5, z: -1.0 },
        ammo: 18,
        towers: [
          // Outer curtain wall
          ...fort(0, 50, [
            'TT##########TT',
            'T............T',
            '##..........##',
            '##..........##',
            '##..........##',
            'T............T',
            'TT##########TT'
          ], 3, 7, 6),
          // Inner castle
          ...fort(0, 50, [
            'T######T',
            '#......#',
            '#.KKKK.#',
            '#.KKKK.#',
            '#......#',
            'T######T'
          ], 4, 6, 5)
        ]
      },
      {
        name: 'Imperial Fortress',
        wind: { x: 2.8, z: -1.6 },
        ammo: 18,
        towers: [
          // Main castle
          ...fort(0, 53, [
            'TT##########TT',
            'T............T',
            '##....KKK....##',
            '##....KKK....##',
            '##....KKK....##',
            'T............T',
            'TT##########TT'
          ], 3, 7, 6),
          // Flanking towers
          ...fort(-22, 50, ['TTT', 'TTT', 'TTT'], 1, 7, 8),
          ...fort( 22, 50, ['TTT', 'TTT', 'TTT'], 1, 7, 8),
          // Forward barbican gate
          ...fort(0, 42, [
            'T####T',
            '######',
            'T####T'
          ], 4, 7, 8)
        ]
      }
    ],

    /* ══════════════════════════════════════
       HARD — Massive fortresses, nearly
              impossible to fully destroy
       ══════════════════════════════════════ */
    HARD: [
      {
        name: 'Iron Bastion',
        wind: { x: 3.0, z: 1.5 },
        ammo: 12,
        towers: [
          ...fort(0, 44, [
            'TTTT########TTTT',
            'TT............TT',
            '##............##',
            '##....KKKK....##',
            '##....KKKK....##',
            '##............##',
            'TT............TT',
            'TTTT########TTTT'
          ], 5, 8, 7)
        ]
      },
      {
        name: 'Twin Iron Forts',
        wind: { x: 3.2, z: -1.4 },
        ammo: 14,
        towers: [
          ...fort(-18, 44, [
            'TTT######TTT',
            'T..........T',
            '##...KK...##',
            '##...KK...##',
            '##...KK...##',
            'T..........T',
            'TTT######TTT'
          ], 5, 8, 7),
          ...fort(18, 44, [
            'TTT######TTT',
            'T..........T',
            '##...KK...##',
            '##...KK...##',
            '##...KK...##',
            'T..........T',
            'TTT######TTT'
          ], 5, 8, 7)
        ]
      },
      {
        name: 'Concentric Citadel',
        wind: { x: 3.5, z: 2.0 },
        ammo: 14,
        towers: [
          // Outer wall
          ...fort(0, 50, [
            'TTT############TTT',
            'T................T',
            '##..............##',
            '##..............##',
            '##..............##',
            '##..............##',
            'T................T',
            'TTT############TTT'
          ], 4, 8, 9),
          // Inner castle
          ...fort(0, 50, [
            'TT########TT',
            'T..........T',
            '#...KKKK...#',
            '#...KKKK...#',
            '#...KKKK...#',
            'T..........T',
            'TT########TT'
          ], 5, 7, 8)
        ]
      },
      {
        name: 'Fortress Chain',
        wind: { x: -3.8, z: 1.8 },
        ammo: 15,
        towers: [
          // Far flanking mega-towers
          ...fort(-24, 42, ['TTTT', 'TTTT', 'TTTT', 'TTTT'], 1, 9, 10),
          ...fort( 24, 42, ['TTTT', 'TTTT', 'TTTT', 'TTTT'], 1, 9, 10),
          // Mid fortresses
          ...fort(-12, 48, [
            'TTT####TTT',
            'T........T',
            '#..KKKK..#',
            'T........T',
            'TTT####TTT'
          ], 5, 8, 7),
          ...fort(12, 48, [
            'TTT####TTT',
            'T........T',
            '#..KKKK..#',
            'T........T',
            'TTT####TTT'
          ], 5, 8, 7),
          // Central command keep
          ...fort(0, 54, [
            'TTT###TTT',
            'T.......T',
            '#.KKKKK.#',
            '#.KKKKK.#',
            '#.KKKKK.#',
            'T.......T',
            'TTT###TTT'
          ], 5, 9, 8)
        ]
      },
      {
        name: 'The Unconquerable',
        wind: { x: 4.2, z: 2.5 },
        ammo: 18,
        towers: [
          // Outer perimeter (huge)
          ...fort(0, 52, [
            'TTTT############TTTT',
            'TT................TT',
            '##................##',
            '##................##',
            '##................##',
            '##................##',
            'TT................TT',
            'TTTT############TTTT'
          ], 5, 9, 10),
          // Inner castle
          ...fort(0, 52, [
            'TTT########TTT',
            'T............T',
            '##..........##',
            '##...KKKK...##',
            '##...KKKK...##',
            '##...KKKK...##',
            '##..........##',
            'T............T',
            'TTT########TTT'
          ], 5, 8, 9),
          // Flanking mega-towers
          ...fort(-26, 48, ['TTTT', 'TTTT', 'TTTT'], 1, 10, 11),
          ...fort( 26, 48, ['TTTT', 'TTTT', 'TTTT'], 1, 10, 11),
          // Forward gate fortress
          ...fort(0, 40, [
            'TT####TT',
            '########',
            '########',
            'TT####TT'
          ], 5, 9, 10)
        ]
      }
    ]
  };

  // ─────────────────────────────────────────
  //  GAME STATE
  // ─────────────────────────────────────────
  const GS = {
    MENU:'MENU', PLAYING:'PLAYING', CHARGING:'CHARGING',
    FIRING:'FIRING', RELOADING:'RELOADING',
    LEVEL_CLEAR:'LEVEL_CLEAR', GAME_OVER:'GAME_OVER'
  };

  const MIN_POWER   = 22;
  const MAX_POWER   = 78;
  const CHARGE_RATE = 40;
  const MOVE_SPEED  = 10;

  const BOUNDS = { minX: -28, maxX: 28, minZ: -14, maxZ: 22 };

  let renderer, scene, camera, clock;
  let state        = GS.MENU;
  let currentLevel = 0;
  let score        = 0;
  let ammo         = 18;
  let shotsFired   = 0;
  let shotsHit     = 0;
  let combo        = 0;
  let power        = MIN_POWER;
  let reloadTime   = 0;
  let reloadDur    = 2.6;

  let cannonX = 0, cannonZ = 0;
  let windVector  = new THREE.Vector3();
  let ballMesh    = null;
  let ballPhysics = null;

  let camPos    = new THREE.Vector3(0, 8, -22);
  let camTarget = new THREE.Vector3(0, 3, 20);
  let camMode   = 'cannon';
  let cloudGroup = null;

  let currentDifficulty = 'MEDIUM';
  let sensitivity       = 1.0;
  let muted             = false;

  const keys    = {};
  const moveInp = { forward: false, back: false, left: false, right: false };

  // ─────────────────────────────────────────
  //  INIT
  // ─────────────────────────────────────────
  function init() {
    const canvas = document.getElementById('game-canvas');
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                  || (navigator.maxTouchPoints > 1);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // On mobile, ensure controls overlay is visible
    const mobileCtrl = document.getElementById('mobile-controls');
    if (mobileCtrl && isMobile) mobileCtrl.style.display = 'flex';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x92C8F0);
    scene.fog        = new THREE.Fog(0xB8D8F8, 90, 220);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    clock = new THREE.Clock();

    AudioEngine.init();
    UIManager.init();
    EffectsManager.init(scene);
    TargetSystem.init(scene);
    CannonController.init(scene);

    // Build lighting immediately (cheap)
    buildLighting();

    UIManager.showMenu();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    window.addEventListener('resize',  onResize);

    document.getElementById('btn-play').addEventListener('click',   startGame);
    document.getElementById('btn-mute').addEventListener('click',   toggleMute);
    document.getElementById('btn-howto').addEventListener('click',  toggleHowTo);

    ['EASY', 'MEDIUM', 'HARD'].forEach(d => {
      const btn = document.getElementById('diff-' + d.toLowerCase());
      if (btn) btn.addEventListener('click', () => setDifficulty(d));
    });

    const slider = document.getElementById('sensitivity-slider');
    const label  = document.getElementById('sensitivity-label');
    if (slider) {
      slider.addEventListener('input', () => {
        sensitivity = parseFloat(slider.value);
        if (label) label.textContent = sensitivity.toFixed(1) + 'x';
      });
    }

    setupMobileControls();
    animate();

    // Defer heavy world-building so the menu paints first (improves INP)
    setTimeout(() => {
      buildTerrain();
      buildBackground();
    }, 0);
  }

  // ─────────────────────────────────────────
  //  WORLD BUILDING
  // ─────────────────────────────────────────
  function buildLighting() {
    scene.add(new THREE.HemisphereLight(0x9BBCE8, 0x4A7A30, 0.52));
    scene.add(new THREE.AmbientLight(0x506080, 0.35));

    const sun = new THREE.DirectionalLight(0xFFE4A0, 1.6);
    sun.position.set(55, 90, -40);
    sun.castShadow = true;
    const isMob = renderer.shadowMap.type === THREE.BasicShadowMap;
    sun.shadow.mapSize.set(isMob ? 1024 : 2048, isMob ? 1024 : 2048);
    sun.shadow.camera.near   = 0.5;
    sun.shadow.camera.far    = 280;
    sun.shadow.camera.left   = -90;
    sun.shadow.camera.right  =  90;
    sun.shadow.camera.top    =  90;
    sun.shadow.camera.bottom = -90;
    sun.shadow.bias          = -0.0008;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x5577CC, 0.35);
    fill.position.set(-40, 25, 60);
    scene.add(fill);
  }

  function buildTerrain() {
    const groundGeo = new THREE.PlaneGeometry(320, 320, 64, 64);
    const posArr = groundGeo.attributes.position.array;
    for (let i = 0; i < posArr.length; i += 3) {
      const x = posArr[i], z = posArr[i + 2];
      if (Math.sqrt(x * x + z * z) > 18)
        posArr[i + 1] = Math.sin(x * 0.048) * 0.6 + Math.cos(z * 0.065) * 0.6
                      + Math.sin((x + z) * 0.028) * 1.1;
    }
    groundGeo.computeVertexNormals();

    const tex = buildGrassTexture();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(22, 22);

    const ground = new THREE.Mesh(groundGeo,
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Stone firing platform
    const plat = new THREE.Mesh(new THREE.BoxGeometry(9, 0.38, 11),
      new THREE.MeshStandardMaterial({ color: 0x888278, roughness: 0.88 }));
    plat.position.set(0, 0.19, 0.4);
    plat.castShadow = plat.receiveShadow = true;
    scene.add(plat);

    // Battlements
    const mMat = new THREE.MeshStandardMaterial({ color: 0x787068, roughness: 0.9 });
    for (let i = -3; i <= 3; i += 2) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 0.48), mMat);
      m.position.set(i * 1.1, 0.86, -5.0);
      m.castShadow = true;
      scene.add(m);
    }

    // Dirt road toward battlefield
    const road = new THREE.Mesh(new THREE.BoxGeometry(6, 0.02, 90),
      new THREE.MeshStandardMaterial({ color: 0xC8A870, roughness: 1.0 }));
    road.position.set(0, 0.01, 45);
    road.receiveShadow = true;
    scene.add(road);

    // Subtle movement grid
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x3DFF7A, transparent: true, opacity: 0.05, wireframe: true
    });
    const gridGeo = new THREE.PlaneGeometry(56, 36, 7, 4);
    const grid    = new THREE.Mesh(gridGeo, gridMat);
    grid.rotation.x = -Math.PI / 2;
    grid.position.set(0, 0.05, 4);
    scene.add(grid);
  }

  function buildGrassTexture() {
    const c   = document.createElement('canvas');
    c.width   = 512;
    c.height  = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4E7A32';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 3000; i++) {
      const b = Math.random() > 0.5 ? 18 : -14;
      ctx.fillStyle = `rgb(${78 + b},${122 + b},${50 + b})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    return new THREE.CanvasTexture(c);
  }

  function buildBackground() {
    const bg = new THREE.Group();
    cloudGroup = new THREE.Group();

    const mMat = new THREE.MeshStandardMaterial({ color: 0x5E7B68, roughness: 1 });
    const sMat = new THREE.MeshStandardMaterial({ color: 0xEEEEEE, roughness: 0.7 });
    [[-65,125,14,30],[-35,132,12,22],[0,128,15,28],[32,132,11,20],[62,122,13,26],
     [-85,105,10,18],[85,108,11,20]].forEach(([x,z,r,h]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mMat);
      cone.position.set(x, h / 2 - 2, z);
      bg.add(cone);
      if (h > 22) {
        const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, h * 0.22, 7), sMat);
        snow.position.set(x, h - 2, z);
        bg.add(snow);
      }
    });

    const tMat = new THREE.MeshStandardMaterial({ color: 0x2D5A1C, roughness: 1 });
    const bMat = new THREE.MeshStandardMaterial({ color: 0x5A3215, roughness: 1 });
    for (let i = 0; i < 42; i++) {
      const x = (Math.random() - 0.5) * 140, z = 55 + Math.random() * 50;
      if (Math.abs(x) < 22 && z < 80) continue;
      const h = 3.5 + Math.random() * 5.5;
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.3, h, 7), tMat);
      t.position.set(x, h / 2, z);
      bg.add(t);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.1, 6), bMat);
      tr.position.set(x, 0.55, z);
      bg.add(tr);
    }

    const cMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF, transparent: true, opacity: 0.72,
      side: THREE.DoubleSide, depthWrite: false
    });
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(
        new THREE.PlaneGeometry(24 + Math.random() * 28, 8 + Math.random() * 9),
        cMat.clone()
      );
      c.position.set((Math.random() - 0.5) * 220, 26 + Math.random() * 22, -60 + Math.random() * 220);
      c.userData.drift = 0.6 + Math.random() * 0.6;
      cloudGroup.add(c);
    }

    scene.add(bg);
    scene.add(cloudGroup);
  }

  // ─────────────────────────────────────────
  //  DIFFICULTY
  // ─────────────────────────────────────────
  function setDifficulty(d) {
    currentDifficulty = d;
    ['EASY', 'MEDIUM', 'HARD'].forEach(key => {
      const btn = document.getElementById('diff-' + key.toLowerCase());
      if (btn) btn.classList.toggle('diff-active', key === d);
    });
  }

  // ─────────────────────────────────────────
  //  GAME FLOW
  // ─────────────────────────────────────────
  function startGame() {
    currentLevel = 0;
    score = 0; shotsFired = 0; shotsHit = 0; combo = 0;
    cannonX = 0; cannonZ = 0;
    CannonController.setWorldPosition(0, 0);
    UIManager.hideMenu();
    AudioEngine.resume();
    loadLevel(0);
  }

  function loadLevel(idx) {
    const lvl     = LEVEL_SETS[currentDifficulty][idx];
    const diffCfg = DIFF[currentDifficulty];

    cleanupBall();
    EffectsManager.disposeAll();
    TargetSystem.disposeAll();

    ammo = lvl.ammo;
    reloadDur = diffCfg.reloadDur;

    windVector.set(
      lvl.wind.x + (Math.random() - 0.5) * diffCfg.extraWind,
      0,
      lvl.wind.z + (Math.random() - 0.5) * diffCfg.extraWind
    );

    UIManager.updateScore(score, ammo);
    UIManager.updateWind(windVector);
    UIManager.updateLevel(idx + 1);
    UIManager.updateDifficulty(currentDifficulty, diffCfg.color);
    UIManager.showStatus(`⚔ LEVEL ${idx + 1}: ${lvl.name}  [${currentDifficulty}]`, 3000);
    UIManager.showReloadBar(false);
    UIManager.updatePower(0);
    CannonController.setTrajectoryVisible(false);

    camMode = 'cannon';
    power   = MIN_POWER;
    state   = GS.RELOADING; // hold in reloading until towers are spawned
    reloadTime = reloadDur;  // skip reload bar countdown

    // Defer tower creation so the button click response paints first (fixes INP)
    setTimeout(() => {
      TargetSystem.loadLevel(lvl, diffCfg.hitRadius);
      UIManager.updateHitCounter(0, TargetSystem.getTotalBlocks());
      CannonController.setTrajectoryVisible(true);
      power = MIN_POWER;
      state = GS.PLAYING;
    }, 0);
  }

  function fire() {
    if (state !== GS.PLAYING && state !== GS.CHARGING) return;
    if (ammo <= 0) return;

    ammo--;
    shotsFired++;
    state = GS.FIRING;

    const startPos = CannonController.getMuzzleWorldPosition();
    const dir      = CannonController.getFireDirection();
    const vel      = dir.clone().multiplyScalar(power);

    const ballGeo = new THREE.SphereGeometry(0.42, 12, 8);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.55, metalness: 0.9 });
    ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    ballMesh.position.copy(startPos);
    scene.add(ballMesh);

    ballPhysics = new PhysicsEngine.CannonballPhysics(startPos, vel);

    AudioEngine.playCannonFire();
    EffectsManager.createMuzzleFlash(startPos.clone());
    EffectsManager.createSmokeTrail();
    CannonController.triggerRecoil();
    CannonController.setTrajectoryVisible(false);

    camMode = 'follow';
  }

  function afterShot() {
    UIManager.updatePower(0);
    UIManager.updateScore(score, ammo);

    if (TargetSystem.allDestroyed()) { handleVictory(); return; }

    if (ammo <= 0) {
      state = GS.GAME_OVER;
      UIManager.showStatus('💀 OUT OF AMMO!  Press R to restart.', 999999);
      return;
    }

    reloadTime = 0;
    UIManager.showReloadBar(true);
    UIManager.updateReloadProgress(0);
    state = GS.RELOADING;
  }

  function handleVictory() {
    const accuracy   = shotsFired > 0 ? Math.round(shotsHit / shotsFired * 100) : 0;
    const diffMult   = DIFF[currentDifficulty].scoreMult;
    const accBonus   = Math.round(accuracy * 15 * diffMult);
    const ammoBonus  = Math.round(ammo * 60 * diffMult);
    score += accBonus + ammoBonus;

    AudioEngine.playVictory();
    UIManager.updateScore(score, ammo);

    if (currentLevel < LEVEL_SETS[currentDifficulty].length - 1) {
      UIManager.showStatus(`🏆 LEVEL CLEAR!  +${accBonus} accuracy  +${ammoBonus} ammo bonus`, 3500);
      state = GS.LEVEL_CLEAR;
      setTimeout(() => { currentLevel++; loadLevel(currentLevel); }, 3800);
    } else {
      state = GS.GAME_OVER;
      UIManager.showStatus(
        `🎖 CAMPAIGN COMPLETE!  Final Score: ${score.toLocaleString()}   Press R to play again`, 999999);
    }
  }

  function cleanupBall() {
    if (ballMesh) { scene.remove(ballMesh); ballMesh = null; }
    ballPhysics = null;
    EffectsManager.disposeSmokeTrail();
  }

  // ─────────────────────────────────────────
  //  MAIN LOOP
  // ─────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    EffectsManager.update(dt);
    TargetSystem.update(dt);
    driftClouds(dt);

    switch (state) {
      case GS.PLAYING:
        updateMovement(dt);
        CannonController.update(dt, windVector, 38, sensitivity);
        updateCamera(dt);
        refreshHUDAngles();
        break;

      case GS.CHARGING:
        updateMovement(dt);
        CannonController.update(dt, windVector, power, sensitivity);
        power = Math.min(MAX_POWER, power + CHARGE_RATE * dt);
        UIManager.updatePower((power - MIN_POWER) / (MAX_POWER - MIN_POWER));
        updateCamera(dt);
        refreshHUDAngles();
        break;

      case GS.FIRING:
        updateFiring(dt);
        updateCamera(dt);
        break;

      case GS.RELOADING:
        reloadTime += dt;
        UIManager.updateReloadProgress(reloadTime / reloadDur);
        if (reloadTime >= reloadDur) {
          AudioEngine.playReload();
          UIManager.showReloadBar(false);
          CannonController.setTrajectoryVisible(true);
          camMode = 'cannon';
          power   = MIN_POWER;
          state   = GS.PLAYING;
        }
        updateCamera(dt);
        break;
    }

    renderer.render(scene, camera);
  }

  // ─────────────────────────────────────────
  //  MOVEMENT  (WASD — relative to facing)
  // ─────────────────────────────────────────
  function updateMovement(dt) {
    if (!moveInp.forward && !moveInp.back && !moveInp.left && !moveInp.right) return;

    const az    = CannonController.getAzimuth();
    const sinAz = Math.sin(az);
    const cosAz = Math.cos(az);
    const spd   = MOVE_SPEED * dt;
    let dx = 0, dz = 0;

    if (moveInp.forward) { dx += sinAz * spd; dz += cosAz * spd; }
    if (moveInp.back)    { dx -= sinAz * spd; dz -= cosAz * spd; }
    if (moveInp.left)    { dx -= cosAz * spd; dz += sinAz * spd; }
    if (moveInp.right)   { dx += cosAz * spd; dz -= sinAz * spd; }

    cannonX = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, cannonX + dx));
    cannonZ = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, cannonZ + dz));

    CannonController.setWorldPosition(cannonX, cannonZ);
    UIManager.updatePosition(cannonX, cannonZ);
  }

  // ─────────────────────────────────────────
  //  FIRING UPDATE
  // ─────────────────────────────────────────
  function updateFiring(dt) {
    if (!ballPhysics || !ballMesh) return;

    ballPhysics.update(dt, windVector);
    ballMesh.position.copy(ballPhysics.pos);
    ballMesh.rotation.x += 5 * dt;
    ballMesh.rotation.z += 3 * dt;

    EffectsManager.emitSmoke(ballMesh.position.clone());

    const hitCount = TargetSystem.checkCannonballHit(ballMesh.position, ballPhysics.vel);
    if (hitCount > 0) {
      shotsHit++;
      combo++;
      const diffMult = DIFF[currentDifficulty].scoreMult;
      score += Math.round(hitCount * 120 * combo * diffMult);

      EffectsManager.createExplosion(ballMesh.position.clone(), 0.9 + hitCount * 0.3);
      EffectsManager.createDustCloud(ballMesh.position.clone());
      AudioEngine.playExplosion(0.5 + hitCount * 0.25);
      UIManager.screenShake(Math.min(hitCount, 3) * 0.55);
      UIManager.showCombo(combo);
      UIManager.updateHitCounter(TargetSystem.getDestroyedBlocks(), TargetSystem.getTotalBlocks());

      cleanupBall();
      afterShot();
      return;
    }

    if (!ballPhysics.alive) {
      combo = 0;
      UIManager.showStatus('MISS!', 1100);
      EffectsManager.createDustCloud(ballPhysics.pos.clone());
      AudioEngine.playImpact();
      cleanupBall();
      afterShot();
    }
  }

  // ─────────────────────────────────────────
  //  CAMERA
  // ─────────────────────────────────────────
  function updateCamera(dt) {
    let targetPos, targetLook;

    if (camMode === 'follow' && ballMesh) {
      const bp = ballMesh.position;
      const az = CannonController.getAzimuth();
      targetPos  = new THREE.Vector3(
        bp.x - Math.sin(az) * 7, Math.max(4, bp.y + 3.5), bp.z - Math.cos(az) * 7
      );
      targetLook = bp.clone().add(new THREE.Vector3(0, 0, 4));
    } else {
      const az   = CannonController.getAzimuth();
      targetPos  = new THREE.Vector3(
        cannonX - Math.sin(az) * 18, cannonZ * 0.1 + 9, cannonZ - Math.cos(az) * 18
      );
      targetLook = new THREE.Vector3(
        cannonX + Math.sin(az) * 20, 3, cannonZ + Math.cos(az) * 20
      );
    }

    camPos.lerp(targetPos, dt * 5);
    camTarget.lerp(targetLook, dt * 5);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  function refreshHUDAngles() {
    UIManager.updateAngles(CannonController.getElevationDeg(), CannonController.getAzimuthDeg());
  }

  function driftClouds(dt) {
    if (!cloudGroup) return;
    cloudGroup.children.forEach(c => {
      c.position.x += (c.userData.drift || 0.8) * dt * 2;
      if (c.position.x > 130) c.position.x = -130;
    });
  }

  // ─────────────────────────────────────────
  //  INPUT
  // ─────────────────────────────────────────
  function onKeyDown(e) {
    if (keys[e.key]) return;
    keys[e.key] = true;
    AudioEngine.resume();

    CannonController.handleKey(e.key, true);

    switch (e.key) {
      case 'w': case 'W': moveInp.forward = true; break;
      case 's': case 'S': moveInp.back    = true; break;
      case 'a': case 'A': moveInp.right   = true; break;
      case 'd': case 'D': moveInp.left    = true; break;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (state === GS.PLAYING) { state = GS.CHARGING; power = MIN_POWER; }
    }

    if ((e.key === 'r' || e.key === 'R') &&
        (state === GS.GAME_OVER || state === GS.LEVEL_CLEAR)) {
      startGame();
    }

    if (e.key === 'Escape' && state !== GS.MENU) {
      state = GS.MENU;
      UIManager.showMenu();
    }
  }

  function onKeyUp(e) {
    keys[e.key] = false;
    CannonController.handleKey(e.key, false);

    switch (e.key) {
      case 'w': case 'W': moveInp.forward = false; break;
      case 's': case 'S': moveInp.back    = false; break;
      case 'a': case 'A': moveInp.right   = false; break;
      case 'd': case 'D': moveInp.left    = false; break;
    }

    if (e.key === ' ' && state === GS.CHARGING) fire();
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ─────────────────────────────────────────
  //  MOBILE CONTROLS
  // ─────────────────────────────────────────
  function setupMobileControls() {
    const aimMap = [
      ['ctrl-aim-left',  'ArrowLeft'],
      ['ctrl-aim-right', 'ArrowRight'],
      ['ctrl-aim-up',    'ArrowUp'],
      ['ctrl-aim-down',  'ArrowDown'],
    ];
    aimMap.forEach(([id, key]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('touchstart', e => { e.preventDefault(); AudioEngine.resume(); CannonController.handleKey(key, true); }, { passive: false });
      btn.addEventListener('touchend',   e => { e.preventDefault(); CannonController.handleKey(key, false); }, { passive: false });
      btn.addEventListener('mousedown',  () => { AudioEngine.resume(); CannonController.handleKey(key, true); });
      btn.addEventListener('mouseup',    () => CannonController.handleKey(key, false));
      btn.addEventListener('mouseleave', () => CannonController.handleKey(key, false));
    });

    const moveMap = [
      ['ctrl-fwd',  'forward'],
      ['ctrl-bwd',  'back'],
      ['ctrl-slft', 'left'],
      ['ctrl-srgt', 'right'],
    ];
    moveMap.forEach(([id, dir]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('touchstart', e => { e.preventDefault(); AudioEngine.resume(); moveInp[dir] = true; }, { passive: false });
      btn.addEventListener('touchend',   e => { e.preventDefault(); moveInp[dir] = false; }, { passive: false });
      btn.addEventListener('mousedown',  () => { AudioEngine.resume(); moveInp[dir] = true; });
      btn.addEventListener('mouseup',    () => moveInp[dir] = false);
      btn.addEventListener('mouseleave', () => moveInp[dir] = false);
    });

    const fireBtn = document.getElementById('ctrl-fire');
    if (fireBtn) {
      fireBtn.addEventListener('touchstart', e => {
        e.preventDefault(); AudioEngine.resume();
        if (state === GS.PLAYING) { state = GS.CHARGING; power = MIN_POWER; }
      }, { passive: false });
      fireBtn.addEventListener('touchend', e => {
        e.preventDefault();
        if (state === GS.CHARGING) fire();
      }, { passive: false });
      fireBtn.addEventListener('mousedown', () => {
        AudioEngine.resume();
        if (state === GS.PLAYING) { state = GS.CHARGING; power = MIN_POWER; }
      });
      fireBtn.addEventListener('mouseup', () => { if (state === GS.CHARGING) fire(); });
    }
  }

  // ─────────────────────────────────────────
  //  MENU HELPERS
  // ─────────────────────────────────────────
  function toggleMute() {
    muted = !muted;
    AudioEngine.setMuted(muted);
    const btn = document.getElementById('btn-mute');
    if (btn) btn.innerHTML = muted ? '<span>🔇 UNMUTE</span>' : '<span>🔊 SOUND</span>';
  }

  function toggleHowTo() {
    const p = document.getElementById('howto-panel');
    if (p) p.style.display = p.style.display === 'block' ? 'none' : 'block';
  }

  window.addEventListener('load', init);
})();
