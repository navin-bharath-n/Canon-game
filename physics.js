/**
 * PhysicsEngine — Ballistic simulation for cannonball flight
 */
const PhysicsEngine = (() => {
  const GRAVITY    = 16.0;  // m/s² (slightly boosted for game feel)
  const DRAG_COEFF = 0.018; // simplified air resistance

  class CannonballPhysics {
    constructor(position, velocity) {
      this.pos    = position.clone();
      this.vel    = velocity.clone();
      this.alive  = true;
      this.grounded = false;
      this.bounces  = 0;
      this.flightTime = 0;
    }

    update(dt, wind) {
      if (!this.alive) return;

      this.flightTime += dt;

      // --- Wind ---
      if (wind) {
        this.vel.x += wind.x * dt * 0.6;
        this.vel.z += wind.z * dt * 0.6;
      }

      // --- Air drag (proportional to speed²) ---
      const speed = this.vel.length();
      if (speed > 0.5) {
        const dragMag = DRAG_COEFF * speed * speed;
        this.vel.x -= (this.vel.x / speed) * dragMag * dt;
        this.vel.y -= (this.vel.y / speed) * dragMag * dt;
        this.vel.z -= (this.vel.z / speed) * dragMag * dt;
      }

      // --- Gravity ---
      this.vel.y -= GRAVITY * dt;

      // --- Integrate position ---
      this.pos.addScaledVector(this.vel, dt);

      // --- Ground collision ---
      if (this.pos.y <= 0.35) {
        this.pos.y = 0.35;
        if (Math.abs(this.vel.y) > 4 && this.bounces < 2) {
          this.vel.y  = -this.vel.y * 0.28;
          this.vel.x *= 0.55;
          this.vel.z *= 0.55;
          this.bounces++;
        } else {
          this.vel.set(0, 0, 0);
          this.alive   = false;
          this.grounded = true;
        }
      }

      // --- Out of bounds ---
      if (Math.abs(this.pos.x) > 220 || this.pos.z > 220 || this.pos.z < -80 || this.pos.y > 200) {
        this.alive = false;
      }
    }
  }

  /**
   * Predict trajectory arc as an array of THREE.Vector3 points.
   * Used to draw the aiming guide line.
   */
  function predictTrajectory(startPos, startVel, wind, steps = 90) {
    const points = [];
    const pos = startPos.clone();
    const vel = startVel.clone();
    const dt  = 0.045;

    for (let i = 0; i < steps; i++) {
      points.push(pos.clone());

      // Wind
      if (wind) {
        vel.x += wind.x * dt * 0.6;
        vel.z += wind.z * dt * 0.6;
      }
      // Drag
      const spd = vel.length();
      if (spd > 0.5) {
        const drag = DRAG_COEFF * spd * spd;
        vel.x -= (vel.x / spd) * drag * dt;
        vel.y -= (vel.y / spd) * drag * dt;
        vel.z -= (vel.z / spd) * drag * dt;
      }
      // Gravity
      vel.y -= GRAVITY * dt;
      pos.addScaledVector(vel, dt);

      if (pos.y <= 0.35) break;
    }

    return points;
  }

  return { CannonballPhysics, predictTrajectory };
})();
