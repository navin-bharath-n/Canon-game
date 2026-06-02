/**
 * CannonController — 3D cannon mesh + aiming + world movement
 *
 * Controls:
 *   Arrow keys / WASD  →  Aim (azimuth + elevation)
 *   W A S D            →  Move cannon on ground (if movement mode enabled)
 *   NOTE: movement uses separate key set (handled by game.js)
 *
 * Coordinate convention:
 *   cannon facing +Z; azimuth = Y-axis rotation; elevation = X-axis tilt
 */
const CannonController = (() => {
  let scene = null;

  // Cannon orientation
  let azimuth   = 0.0;
  let elevation = 0.32;

  const BASE_AZ_SPEED = 1.6;
  const BASE_EL_SPEED = 1.1;
  const MIN_ELEV = 0.05;
  const MAX_ELEV = Math.PI / 2 - 0.08;

  // Three.js objects
  let group       = null;
  let barrelPivot = null;
  let barrelMesh  = null;

  // Barrel geometry constants
  const BP_Y       = 1.12;
  const BP_Z       = 0.85;
  const BARREL_LEN = 3.2;

  // Recoil
  let recoilT = 0;

  // Trajectory
  let trajPoints = null;
  let trajGeo    = null;
  const TRAJ_MAX = 90;

  // Aim input (arrow keys only — WASD is reserved for movement in game.js)
  const inp = { left: false, right: false, up: false, down: false };

  // ─────────────────────────────────────────
  //  INIT + BUILD
  // ─────────────────────────────────────────
  function init(sceneRef) {
    scene = sceneRef;
    buildModel();
    buildTrajectoryDots();
  }

  function buildModel() {
    group = new THREE.Group();
    group.position.set(0, 0, 0);

    const wood     = m(0x6B3520, 0.85, 0.0);
    const darkWood = m(0x4A2510, 0.9,  0.0);
    const iron     = m(0x252525, 0.65, 0.45);
    const darkIron = m(0x151515, 0.55, 0.6);

    // Platform
    mesh(group, new THREE.BoxGeometry(3.8, 0.28, 5.4), wood, v3(0, 0.14, 0.2));
    for (let i = -2; i <= 2; i++)
      mesh(group, new THREE.BoxGeometry(3.5, 0.06, 0.38), darkWood, v3(0, 0.31, i * 0.95 + 0.2));

    // Wheels
    [-1, 1].forEach(side => {
      const wx = side * 1.92, wy = 0.88, wz = 0.6;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.11, 8, 20), darkIron);
      rim.rotation.y = Math.PI / 2;
      rim.position.set(wx, wy, wz);
      rim.castShadow = true;
      group.add(rim);

      mesh(group, new THREE.CylinderGeometry(0.16, 0.16, 0.28, 10), iron,
           v3(wx, wy, wz), new THREE.Euler(0, 0, Math.PI / 2));

      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.84, 5), wood);
        spoke.position.set(wx, wy + Math.cos(a) * 0.42, wz + Math.sin(a) * 0.42);
        spoke.rotation.set(a, Math.PI / 2, 0);
        group.add(spoke);
      }
    });

    // Carriage beams + cross brace
    [-0.92, 0.92].forEach(x =>
      mesh(group, new THREE.BoxGeometry(0.22, 0.22, 3.8), wood, v3(x, 0.54, 0.5)));
    mesh(group, new THREE.BoxGeometry(2.3, 0.18, 0.18), wood, v3(0, 0.62, 0.0));

    // Trunnion
    mesh(group, new THREE.CylinderGeometry(0.19, 0.19, 2.5, 10), iron,
         v3(0, BP_Y, BP_Z), new THREE.Euler(0, 0, Math.PI / 2));

    // Barrel pivot
    barrelPivot = new THREE.Group();
    barrelPivot.position.set(0, BP_Y, BP_Z);
    group.add(barrelPivot);

    barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, BARREL_LEN, 16), iron);
    barrelMesh.rotation.x = Math.PI / 2;
    barrelMesh.position.set(0, 0, BARREL_LEN / 2);
    barrelMesh.castShadow = true;
    barrelPivot.add(barrelMesh);

    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.055, 8, 16), darkIron);
    muzzle.position.set(0, 0, BARREL_LEN);
    barrelPivot.add(muzzle);

    const breech = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 12), darkIron);
    breech.rotation.x = Math.PI / 2;
    breech.position.set(0, 0, -0.22);
    barrelPivot.add(breech);

    [0.55, 1.35, 2.15].forEach(z => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.042, 8, 14), darkIron);
      ring.position.set(0, 0, z);
      barrelPivot.add(ring);
    });

    barrelPivot.rotation.x = -elevation;
    scene.add(group);
  }

  function m(color, roughness, metalness) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }
  function v3(x, y, z) { return new THREE.Vector3(x, y, z); }
  function mesh(parent, geo, mat, pos, rot) {
    const o = new THREE.Mesh(geo, mat);
    if (pos) o.position.copy(pos);
    if (rot) o.rotation.copy(rot);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }

  // ─────────────────────────────────────────
  //  TRAJECTORY DOTS
  // ─────────────────────────────────────────
  function buildTrajectoryDots() {
    trajGeo = new THREE.BufferGeometry();
    trajGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAJ_MAX * 3), 3));
    trajGeo.setDrawRange(0, 0);
    trajPoints = new THREE.Points(trajGeo, new THREE.PointsMaterial({
      color: 0x44FFAA, size: 0.18,
      transparent: true, opacity: 0.5,
      depthWrite: false, sizeAttenuation: true
    }));
    trajPoints.frustumCulled = false;
    scene.add(trajPoints);
  }

  function refreshTrajectory(wind, previewPower) {
    const pts = PhysicsEngine.predictTrajectory(getMuzzleWorldPosition(), getFireDirection().multiplyScalar(previewPower), wind, TRAJ_MAX);
    const arr = trajGeo.attributes.position.array;
    for (let i = 0; i < pts.length; i++) {
      arr[i * 3]     = pts[i].x;
      arr[i * 3 + 1] = pts[i].y;
      arr[i * 3 + 2] = pts[i].z;
    }
    trajGeo.attributes.position.needsUpdate = true;
    trajGeo.setDrawRange(0, pts.length);
  }

  function setTrajectoryVisible(v) { if (trajPoints) trajPoints.visible = v; }

  // ─────────────────────────────────────────
  //  MATH HELPERS
  // ─────────────────────────────────────────
  function getMuzzleWorldPosition() {
    const cosAz = Math.cos(azimuth), sinAz = Math.sin(azimuth);
    const cosEl = Math.cos(elevation), sinEl = Math.sin(elevation);
    const radial = BP_Z + BARREL_LEN * cosEl;
    const gp = group.position;
    return new THREE.Vector3(gp.x + sinAz * radial, BP_Y + BARREL_LEN * sinEl, gp.z + cosAz * radial);
  }

  function getFireDirection() {
    return new THREE.Vector3(
      Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.cos(azimuth) * Math.cos(elevation)
    );
  }

  // ─────────────────────────────────────────
  //  INPUT  (Arrow keys = aim only)
  // ─────────────────────────────────────────
  function handleKey(key, down) {
    switch (key) {
      case 'ArrowLeft':  inp.left  = down; break;
      case 'ArrowRight': inp.right = down; break;
      case 'ArrowUp':    inp.up    = down; break;
      case 'ArrowDown':  inp.down  = down; break;
    }
  }

  // ─────────────────────────────────────────
  //  UPDATE
  // ─────────────────────────────────────────
  function update(dt, wind, previewPower, sensitivity) {
    const sens = sensitivity || 1.0;
    const azSpd = BASE_AZ_SPEED * sens;
    const elSpd = BASE_EL_SPEED * sens;

    if (inp.left)  azimuth   += azSpd * dt;
    if (inp.right) azimuth   -= azSpd * dt;
    if (inp.up)    elevation  = Math.min(MAX_ELEV, elevation + elSpd * dt);
    if (inp.down)  elevation  = Math.max(MIN_ELEV, elevation - elSpd * dt);

    group.rotation.y       = azimuth;
    barrelPivot.rotation.x = -elevation;

    // Recoil
    if (recoilT > 0) {
      recoilT -= dt * 4.5;
      barrelMesh.position.z = BARREL_LEN / 2 - Math.sin(Math.max(0, recoilT) * Math.PI) * 0.45;
    } else {
      barrelMesh.position.z = BARREL_LEN / 2;
    }

    refreshTrajectory(wind, previewPower || 38);
  }

  /** Move the cannon group on the XZ ground plane */
  function setWorldPosition(x, z) {
    group.position.set(x, 0, z);
  }

  function getWorldPosition() {
    return { x: group.position.x, z: group.position.z };
  }

  function triggerRecoil() { recoilT = 1.0; }

  function getAzimuthDeg()   { return (azimuth * 180 / Math.PI) % 360; }
  function getElevationDeg() { return elevation * 180 / Math.PI; }
  function getAzimuth()      { return azimuth; }

  return {
    init, update, handleKey, triggerRecoil,
    getMuzzleWorldPosition, getFireDirection,
    getAzimuthDeg, getElevationDeg, getAzimuth,
    setWorldPosition, getWorldPosition,
    setTrajectoryVisible
  };
})();
