/**
 * EffectsManager — All particle systems: muzzle flash, smoke trail, explosions, dust
 */
const EffectsManager = (() => {
  let scene = null;
  const activeEffects = [];

  function init(sceneRef) {
    scene = sceneRef;
  }

  // ─────────────────────────────────────────
  //  MUZZLE FLASH
  // ─────────────────────────────────────────
  class MuzzleFlash {
    constructor(position) {
      this.life    = 0;
      this.maxLife = 0.18;

      // Point-light burst
      this.light = new THREE.PointLight(0xFF9900, 10, 18);
      this.light.position.copy(position);
      scene.add(this.light);

      // Particle burst
      const count = 50;
      this.count  = count;
      const positions = new Float32Array(count * 3);
      this.velocities = [];

      for (let i = 0; i < count; i++) {
        positions[i * 3]     = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;

        const theta = Math.random() * Math.PI * 2;
        const phi   = (Math.random() - 0.5) * Math.PI;
        const spd   = 8 + Math.random() * 22;
        this.velocities.push(new THREE.Vector3(
          Math.cos(phi) * Math.cos(theta) * spd,
          Math.cos(phi) * Math.sin(theta) * spd,
          Math.sin(phi) * spd
        ));
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.positions = positions;

      const mat = new THREE.PointsMaterial({
        color: 0xFFCC44, size: 0.5,
        transparent: true, opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });

      this.points = new THREE.Points(geo, mat);
      this.points.frustumCulled = false;
      scene.add(this.points);
    }

    update(dt) {
      this.life += dt;
      const t = this.life / this.maxLife;

      for (let i = 0; i < this.count; i++) {
        this.positions[i * 3]     += this.velocities[i].x * dt;
        this.positions[i * 3 + 1] += this.velocities[i].y * dt;
        this.positions[i * 3 + 2] += this.velocities[i].z * dt;
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.material.opacity = Math.max(0, 1 - t * 1.4);
      this.light.intensity = Math.max(0, 10 * (1 - t * 2));

      return this.life >= this.maxLife;
    }

    dispose() {
      scene.remove(this.points);
      scene.remove(this.light);
      this.points.geometry.dispose();
      this.points.material.dispose();
    }
  }

  // ─────────────────────────────────────────
  //  SMOKE TRAIL (continuous emission)
  // ─────────────────────────────────────────
  class SmokeTrail {
    constructor() {
      this.particles = [];
      this.emitTimer = 0;
      this.emitInterval = 0.032;
    }

    emit(position) {
      this.emitTimer += 0.032;
      if (this.emitTimer < this.emitInterval) return;
      this.emitTimer = 0;

      const geo = new THREE.SphereGeometry(0.12 + Math.random() * 0.1, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.7 + Math.random() * 0.2, 0.7 + Math.random() * 0.2, 0.7 + Math.random() * 0.2),
        transparent: true, opacity: 0.45, depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.25;
      mesh.position.y += (Math.random() - 0.5) * 0.25;
      mesh.position.z += (Math.random() - 0.5) * 0.25;
      scene.add(mesh);

      this.particles.push({
        mesh,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.35,
        rise: 0.6 + Math.random() * 0.8,
        drift: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)
      });
    }

    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life += dt;
        const t = p.life / p.maxLife;

        p.mesh.position.y += p.rise * dt;
        p.mesh.position.addScaledVector(p.drift, dt);
        p.mesh.scale.setScalar(1 + t * 3.5);
        p.mesh.material.opacity = Math.max(0, 0.45 * (1 - t));

        if (p.life >= p.maxLife) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          this.particles.splice(i, 1);
        }
      }
    }

    dispose() {
      this.particles.forEach(p => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      });
      this.particles.length = 0;
    }
  }

  // ─────────────────────────────────────────
  //  EXPLOSION
  // ─────────────────────────────────────────
  class Explosion {
    constructor(position, scale = 1.0) {
      this.life    = 0;
      this.maxLife = 1.4;
      this.scale   = scale;

      // Flash light
      this.light = new THREE.PointLight(0xFF5500, 14 * scale, 35 * scale);
      this.light.position.copy(position);
      scene.add(this.light);

      // Core fireball
      const fbGeo = new THREE.SphereGeometry(1.8 * scale, 10, 8);
      const fbMat = new THREE.MeshBasicMaterial({
        color: 0xFF6600,
        transparent: true, opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.fireball = new THREE.Mesh(fbGeo, fbMat);
      this.fireball.position.copy(position);
      scene.add(this.fireball);

      // Inner hot core
      const coreGeo = new THREE.SphereGeometry(0.8 * scale, 8, 6);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xFFFFAA,
        transparent: true, opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.core = new THREE.Mesh(coreGeo, coreMat);
      this.core.position.copy(position);
      scene.add(this.core);

      // Shockwave ring
      const swGeo = new THREE.RingGeometry(0.1, 0.6, 32);
      const swMat = new THREE.MeshBasicMaterial({
        color: 0xFF8800,
        transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false
      });
      this.shockwave = new THREE.Mesh(swGeo, swMat);
      this.shockwave.position.copy(position);
      this.shockwave.position.y += 0.05;
      this.shockwave.rotation.x = -Math.PI / 2;
      scene.add(this.shockwave);

      // Debris particle cloud
      const debrisCount = Math.floor(40 * scale);
      this.debrisCount  = debrisCount;
      const positions   = new Float32Array(debrisCount * 3);
      this.debrisVel    = [];

      for (let i = 0; i < debrisCount; i++) {
        positions[i * 3]     = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;

        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.random() * Math.PI * 0.7;
        const spd   = (4 + Math.random() * 9) * scale;
        this.debrisVel.push(new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * spd,
          Math.cos(phi) * spd * 0.6 + 3 * scale,
          Math.sin(phi) * Math.sin(theta) * spd
        ));
      }

      const debrisGeo = new THREE.BufferGeometry();
      debrisGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.debrisPositions = positions;

      const debrisMat = new THREE.PointsMaterial({
        color: 0x887766, size: 0.28 * scale,
        transparent: true, opacity: 1.0,
        depthWrite: false, sizeAttenuation: true
      });
      this.debris = new THREE.Points(debrisGeo, debrisMat);
      this.debris.frustumCulled = false;
      scene.add(this.debris);
    }

    update(dt) {
      this.life += dt;
      const t = this.life / this.maxLife;

      // Fireball
      this.fireball.scale.setScalar(1 + t * 5 * this.scale);
      this.fireball.material.opacity = Math.max(0, 0.92 * (1 - t * 1.3));

      // Core (faster fade)
      this.core.scale.setScalar(1 + t * 3 * this.scale);
      this.core.material.opacity = Math.max(0, 1.0 * (1 - t * 3));

      // Shockwave (expands fast)
      const swScale = 1 + t * 25 * this.scale;
      this.shockwave.scale.setScalar(swScale);
      this.shockwave.material.opacity = Math.max(0, 0.85 * (1 - t * 2.5));

      // Light fades
      this.light.intensity = Math.max(0, 14 * this.scale * (1 - t * 1.8));

      // Debris with gravity
      for (let i = 0; i < this.debrisCount; i++) {
        this.debrisPositions[i * 3]     += this.debrisVel[i].x * dt;
        this.debrisPositions[i * 3 + 1] += this.debrisVel[i].y * dt;
        this.debrisPositions[i * 3 + 2] += this.debrisVel[i].z * dt;
        this.debrisVel[i].y -= 16 * dt;
      }
      this.debris.geometry.attributes.position.needsUpdate = true;
      this.debris.material.opacity = Math.max(0, 1 - t * 0.9);

      return this.life >= this.maxLife;
    }

    dispose() {
      scene.remove(this.light);
      scene.remove(this.fireball);
      scene.remove(this.core);
      scene.remove(this.shockwave);
      scene.remove(this.debris);
      this.fireball.geometry.dispose();
      this.fireball.material.dispose();
      this.core.geometry.dispose();
      this.core.material.dispose();
      this.shockwave.geometry.dispose();
      this.shockwave.material.dispose();
      this.debris.geometry.dispose();
      this.debris.material.dispose();
    }
  }

  // ─────────────────────────────────────────
  //  DUST CLOUD (impact on ground)
  // ─────────────────────────────────────────
  class DustCloud {
    constructor(position) {
      this.life    = 0;
      this.maxLife = 2.2;
      this.puffs   = [];

      const count = 18;
      for (let i = 0; i < count; i++) {
        const geo = new THREE.SphereGeometry(0.28 + Math.random() * 0.45, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.58 + Math.random() * 0.1, 0.52 + Math.random() * 0.1, 0.38 + Math.random() * 0.1),
          transparent: true, opacity: 0.55, depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        mesh.position.x += (Math.random() - 0.5) * 3.5;
        mesh.position.z += (Math.random() - 0.5) * 3.5;
        mesh.position.y += Math.random() * 0.8;
        scene.add(mesh);

        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 3.5,
          1.5 + Math.random() * 2.5,
          (Math.random() - 0.5) * 3.5
        );
        this.puffs.push({ mesh, vel });
      }
    }

    update(dt) {
      this.life += dt;
      const t = this.life / this.maxLife;

      this.puffs.forEach(p => {
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.y -= 1.5 * dt;
        p.mesh.scale.setScalar(1 + t * 2.8);
        p.mesh.material.opacity = Math.max(0, 0.55 * (1 - t));
      });

      return this.life >= this.maxLife;
    }

    dispose() {
      this.puffs.forEach(p => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      });
    }
  }

  // ─────────────────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────────────────
  let smokeTrail = null;

  function createMuzzleFlash(pos) {
    const fx = new MuzzleFlash(pos);
    activeEffects.push(fx);
  }

  function createExplosion(pos, scale = 1.0) {
    const fx = new Explosion(pos, scale);
    activeEffects.push(fx);
  }

  function createDustCloud(pos) {
    const fx = new DustCloud(pos);
    activeEffects.push(fx);
  }

  function createSmokeTrail() {
    smokeTrail = new SmokeTrail();
  }

  function emitSmoke(pos) {
    if (smokeTrail) smokeTrail.emit(pos);
  }

  function disposeSmokeTrail() {
    if (smokeTrail) { smokeTrail.dispose(); smokeTrail = null; }
  }

  function update(dt) {
    if (smokeTrail) smokeTrail.update(dt);

    for (let i = activeEffects.length - 1; i >= 0; i--) {
      const done = activeEffects[i].update(dt);
      if (done) {
        activeEffects[i].dispose();
        activeEffects.splice(i, 1);
      }
    }
  }

  function disposeAll() {
    activeEffects.forEach(fx => fx.dispose());
    activeEffects.length = 0;
    disposeSmokeTrail();
  }

  return {
    init, update, disposeAll,
    createMuzzleFlash, createExplosion, createDustCloud,
    createSmokeTrail, emitSmoke, disposeSmokeTrail
  };
})();
