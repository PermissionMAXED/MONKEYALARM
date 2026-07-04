import * as THREE from 'three';

const EPS = 1e-4;
const HORIZONTAL_AXES = ['x', 'z'];

// Scratch objects reused across calls (no per-call allocation).
const _box = new THREE.Box3();

function refreshBox(position, radius, height) {
  _box.min.set(position.x - radius, position.y, position.z - radius);
  _box.max.set(position.x + radius, position.y + height, position.z + radius);
}

/**
 * Moves a character box through static world colliders, sliding along blocked axes.
 * The character is an axis-aligned box whose position vector is the FEET center
 * (x,z = center, y = bottom of box). MUTATES position and velocity in place.
 *
 * Axes are resolved in order x, then z, then y. When a horizontal axis is
 * blocked while effectively grounded (velocity.y <= 0.01) and dims.stepHeight
 * is positive, an auto-step is attempted: the character is lifted by
 * stepHeight at the attempted horizontal position and kept there if
 * collision-free (gravity settles it over subsequent frames).
 *
 * @param {THREE.Vector3} position feet-center position
 * @param {THREE.Vector3} velocity units/sec; blocked components are zeroed
 * @param {number} dt seconds
 * @param {THREE.Box3[]} colliders static world-space AABBs
 * @param {{radius:number, height:number, stepHeight?:number}} dims
 * @returns {{ onGround: boolean }}
 */
export function moveWithCollisions(position, velocity, dt, colliders, dims) {
  const radius = dims.radius;
  const height = dims.height;
  const stepHeight = dims.stepHeight || 0;
  let onGround = false;

  for (let a = 0; a < HORIZONTAL_AXES.length; a++) {
    const axis = HORIZONTAL_AXES[a];
    const vel = velocity[axis];
    const attempted = position[axis] + vel * dt;
    position[axis] = attempted;
    refreshBox(position, radius, height);

    let blocked = false;
    for (let i = 0; i < colliders.length; i++) {
      const col = colliders[i];
      if (!_box.intersectsBox(col)) continue;
      blocked = true;
      if (vel > 0) {
        position[axis] = col.min[axis] - radius - EPS;
      } else {
        position[axis] = col.max[axis] + radius + EPS;
      }
      velocity[axis] = 0;
      refreshBox(position, radius, height);
    }

    if (blocked && stepHeight > 0 && velocity.y <= 0.01) {
      const resolved = position[axis];
      const baseY = position.y;
      position[axis] = attempted;
      position.y = baseY + stepHeight;
      refreshBox(position, radius, height);

      let clear = true;
      for (let i = 0; i < colliders.length; i++) {
        if (_box.intersectsBox(colliders[i])) {
          clear = false;
          break;
        }
      }
      if (clear) {
        velocity[axis] = vel;
      } else {
        position[axis] = resolved;
        position.y = baseY;
      }
    }
  }

  const velY = velocity.y;
  position.y += velY * dt;
  refreshBox(position, radius, height);
  for (let i = 0; i < colliders.length; i++) {
    const col = colliders[i];
    if (!_box.intersectsBox(col)) continue;
    if (velY > 0) {
      position.y = col.min.y - height - EPS;
    } else {
      position.y = col.max.y + EPS;
      onGround = true;
    }
    velocity.y = 0;
    refreshBox(position, radius, height);
  }

  return { onGround };
}
