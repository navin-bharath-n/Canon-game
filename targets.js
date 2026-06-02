/**
 * TargetSystem — Destructible stone tower generation and hit detection
 */
const TargetSystem = (() => {
  let scene = null;
  const towers = [];

  // Reusable block geometry
  const BLOCK_GEO = new THREE.BoxGeometry(2, 2, 2);

  // Stone material palette
  function makeStoneMat(base) {
    const v = (Math.random() - 0.5) * 18;
    const c = new THREE.Color(
      (base[0] + v) / 255,
      (base[1] + v) / 255,
      (base[2] + v) / 255
    );
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, metalness: 0.05 });
  }

  // ─────────────────────────────────────────
  //  TOWER BLOCK (single stone brick)
  // ─────────────────────────────────────────
  class TowerBlock {
    constructor(x, y, z, totalH) {
      // Colour darkens toward base, lightens at top
      const t   = totalH > 1 ? (y / ((totalH - 1) * 2.12)) : 0.5;
      const base = [118 - Math.round(t * 22), 115 - Math.round(t * 20), 108 - Math.round(t * 18)];
      this.mat  = makeStoneMat(base);
      this.mesh = new THREE.Mesh(BLOCK_GEO, this.mat);
      this.mesh.position.set(x, y, z);
      this.mesh.castShadow    = true;
      this.mesh.receiveShadow = true;

      this.destroyed = false;
      this.falling   = false;
      this.vel       = new THREE.Vector3();
      this.angVel    = new THREE.Vector3();
      this.grounded  = false;

      scene.add(this.mesh);
    }

    hit(impactVel) {
      if (this.destroyed) return;
      this.destroyed = true;
      this.falling   = true;

      const lateral = impactVel ? impactVel.length() * 0.25 : 3;
      this.vel.set(
        (impactVel ? impactVel.x * 0.25 : 0) + (Math.random() - 0.5) * lateral,
        3.5 + Math.random() * 5.5,
        (impactVel ? impactVel.z * 0.25 : 0) + (Math.random() - 0.5) * lateral
      );
      this.angVel.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 4
      );
    }

    update(dt) {
      if (!this.falling || this.grounded) return;

      this.vel.y -= 16 * dt;
      this.vel.multiplyScalar(Math.pow(0.985, dt * 60));

      this.mesh.position.addScaledVector(this.vel, dt);
      this.mesh.rotation.x += this.angVel.x * dt;
      this.mesh.rotation.y += this.angVel.y * dt;
      this.mesh.rotation.z += this.angVel.z * dt;

      if (this.mesh.position.y <= 1.0) {
        this.mesh.position.y = 1.0;
        this.vel.y = 0;
        this.vel.multiplyScalar(0.4);
        this.angVel.multiplyScalar(0.45);
        if (this.vel.length() < 0.3) this.grounded = true;
      }
    }

    dispose() {
      scene.remove(this.mesh);
      this.mat.dispose();
    }
  }

  // ─────────────────────────────────────────
  //  TOWER (grid of blocks)
  // ─────────────────────────────────────────
  class Tower {
    constructor(cx, cz, config) {
      const { w = 1, d = 1, h = 3 } = config;
      this.blocks     = [];
      this.blockCount = 0;

      // Optional decorative merlon cap
      const capMat = makeStoneMat([95, 92, 85]);

      for (let bx = 0; bx < w; bx++) {
        for (let bz = 0; bz < d; bz++) {
          for (let by = 0; by < h; by++) {
            const block = new TowerBlock(
              cx + (bx - (w - 1) / 2) * 2.15,
              by * 2.12 + 1.06,
              cz + (bz - (d - 1) / 2) * 2.15,
              h
            );
            this.blocks.push(block);
          }
        }
      }

      // Merlon caps on top layer
      for (let bx = 0; bx < w; bx++) {
        for (let bz = 0; bz < d; bz++) {
          if ((bx + bz) % 2 === 0) {
            const capGeo = new THREE.BoxGeometry(1.6, 1.0, 1.6);
            const cap    = new THREE.Mesh(capGeo, capMat);
            cap.position.set(
              cx + (bx - (w - 1) / 2) * 2.15,
              h * 2.12 + 1.06 + 0.6,
              cz + (bz - (d - 1) / 2) * 2.15
            );
            cap.castShadow = true;
            scene.add(cap);
            this._caps = this._caps || [];
            this._caps.push(cap);
          }
        }
      }

      this.blockCount = this.blocks.length;
    }

    /**
     * Returns array of blocks close enough to cannonball position.
     */
    checkHit(ballPos, radius = 1.8) {
      const hits = [];
      for (const block of this.blocks) {
        if (block.destroyed) continue;
        if (ballPos.distanceTo(block.mesh.position) < radius + 1.05) {
          hits.push(block);
        }
      }
      return hits;
    }

    get isFullyDestroyed() {
      return this.blocks.every(b => b.destroyed);
    }

    get remainingBlocks() {
      return this.blocks.filter(b => !b.destroyed).length;
    }

    update(dt) {
      this.blocks.forEach(b => b.update(dt));
    }

    dispose() {
      this.blocks.forEach(b => b.dispose());
      (this._caps || []).forEach(cap => {
        scene.remove(cap);
        cap.geometry.dispose();
        cap.material.dispose();
      });
    }
  }

  // ─────────────────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────────────────
  let _hitRadius = 1.8; // set per difficulty

  function init(sceneRef) {
    scene = sceneRef;
  }

  function loadLevel(levelConfig, hitRadius) {
    _hitRadius = hitRadius || 1.8;
    disposeAll();
    levelConfig.towers.forEach(cfg => {
      towers.push(new Tower(cfg.x, cfg.z, { w: cfg.w, d: cfg.d, h: cfg.h }));
    });
  }

  /**
   * Returns number of blocks newly hit this call.
   */
  function checkCannonballHit(ballPos, ballVel) {
    let hitCount = 0;
    for (const tower of towers) {
      const hits = tower.checkHit(ballPos, _hitRadius);
      hits.forEach(block => {
        block.hit(ballVel);
        hitCount++;
      });
    }
    return hitCount;
  }

  function update(dt) {
    towers.forEach(t => t.update(dt));
  }

  function getTotalBlocks()     { return towers.reduce((s, t) => s + t.blockCount, 0); }
  function getDestroyedBlocks() { return towers.reduce((s, t) => s + (t.blockCount - t.remainingBlocks), 0); }
  function allDestroyed()       { return towers.length > 0 && towers.every(t => t.isFullyDestroyed); }

  function disposeAll() {
    towers.forEach(t => t.dispose());
    towers.length = 0;
  }

  return { init, loadLevel, checkCannonballHit, update, getTotalBlocks, getDestroyedBlocks, allDestroyed, disposeAll };
})();
