// @ts-nocheck
// ??$$$ - Custom Physics Simulation Engine

// Basic 3D Vector Math Helpers
const vecAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vecSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vecScale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const vecDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vecLen = (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
const vecNormalize = (v) => {
  const len = vecLen(v);
  return len > 0.0001 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 1, 0];
};

/**
 * Updates the physics simulation for one time step (dt)
 * @param {Array} objects - The list of 3D objects with physical properties
 * @param {Object} config - Physics settings like gravity, wind, airResistance
 * @param {number} dt - Elapsed time in seconds
 */
export function stepPhysics(objects, config = {}, dt = 0.016) {
  const gravity = config.gravity !== undefined ? config.gravity : -9.81;
  const airResistance = config.airResistance !== undefined ? config.airResistance : 0.05;
  const wind = config.wind || [0, 0, 0];
  
  // Cap dt to avoid huge steps that cause objects to pass through each other
  const cappedDt = Math.min(dt, 0.03);

  // ??$$$ - Sanitize all object parameters to be finite numbers and prevent NaN propagation
  for (let obj of objects) {
    if (!obj.position || !Array.isArray(obj.position) || obj.position.length < 3) {
      obj.position = [0, 0, 0];
    } else {
      obj.position = obj.position.map(v => (typeof v === 'number' && Number.isFinite(v)) ? v : 0.0);
    }

    if (!obj.velocity || !Array.isArray(obj.velocity) || obj.velocity.length < 3) {
      obj.velocity = [0, 0, 0];
    } else {
      obj.velocity = obj.velocity.map(v => (typeof v === 'number' && Number.isFinite(v)) ? v : 0.0);
    }

    if (!obj.rotation || !Array.isArray(obj.rotation) || obj.rotation.length < 3) {
      obj.rotation = [0, 0, 0];
    } else {
      obj.rotation = obj.rotation.map(v => (typeof v === 'number' && Number.isFinite(v)) ? v : 0.0);
    }

    const defaultDims = obj.type === 'sphere' ? [0.5] : (obj.type === 'box' ? [1, 1, 1] : [0.5, 1]);
    if (!obj.dimensions || !Array.isArray(obj.dimensions)) {
      obj.dimensions = defaultDims;
    } else {
      obj.dimensions = obj.dimensions.map((d, idx) => {
        const val = parseFloat(d);
        return (Number.isFinite(val) && val > 0) ? val : (defaultDims[idx] || 0.5);
      });
      while (obj.dimensions.length < defaultDims.length) {
        obj.dimensions.push(defaultDims[obj.dimensions.length]);
      }
    }
  }

  // 1. Apply Forces and Integrate Positions
  for (let obj of objects) {
    if (obj.physics?.isStatic) {
      obj.velocity = [0, 0, 0];
      continue;
    }

    // /* Old velocity/position basic checks commented out
    // if (!obj.velocity) obj.velocity = [0, 0, 0];
    // if (!obj.position) obj.position = [0, 0, 0];
    // */

    const mass = obj.physics?.mass || 1.0;

    // Apply gravity
    obj.velocity[1] += gravity * cappedDt;

    // Apply wind (force = wind, acceleration = wind / mass)
    obj.velocity[0] += (wind[0] / mass) * cappedDt;
    obj.velocity[1] += (wind[1] / mass) * cappedDt;
    obj.velocity[2] += (wind[2] / mass) * cappedDt;

    // Apply air resistance (drag)
    obj.velocity = vecScale(obj.velocity, 1 - airResistance * cappedDt);

    // Update positions
    obj.position = vecAdd(obj.position, vecScale(obj.velocity, cappedDt));
  }

  // 2. Resolve Floor Collisions
  // The floor is assumed to be the box with position Y ~ 0 (its upper face is at Y = 0 if centered at Y = -0.25 with height 0.5)
  // Let's look for a static floor or assume a floor plane at Y = 0
  const FLOOR_Y = 0;

  for (let obj of objects) {
    if (obj.physics?.isStatic) continue;

    let heightOffset = 0;
    if (obj.type === 'sphere') {
      heightOffset = obj.dimensions[0]; // radius
    } else if (obj.type === 'box') {
      heightOffset = obj.dimensions[1] / 2; // half height
    } else if (obj.type === 'cylinder' || obj.type === 'cone') {
      heightOffset = obj.dimensions[1] / 2;
    } else {
      heightOffset = 0.5; // fallback
    }

    if (obj.position[1] - heightOffset < FLOOR_Y) {
      // Collision! Push object above floor
      obj.position[1] = FLOOR_Y + heightOffset;
      
      // Invert Y velocity with restitution
      const e = obj.physics?.restitution !== undefined ? obj.physics.restitution : 0.6;
      obj.velocity[1] = -obj.velocity[1] * e;

      // Friction on contact
      const friction = 0.2;
      obj.velocity[0] *= (1 - friction);
      obj.velocity[2] *= (1 - friction);

      // If velocity is extremely low, zero it out to prevent jitter
      if (Math.abs(obj.velocity[1]) < 0.1) {
        obj.velocity[1] = 0;
      }
    }
  }

  // 3. Resolve Object-to-Object Collisions (Broad/Narrow phase)
  // To keep it robust, we iterate through pairs of objects
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const objA = objects[i];
      const objB = objects[j];

      // Ignore static-static collisions
      if (objA.physics?.isStatic && objB.physics?.isStatic) continue;

      resolveCollisionPair(objA, objB);
    }
  }
}

/**
 * Resolves collision between two physical objects
 */
function resolveCollisionPair(objA, objB) {
  // Let's implement Sphere-Sphere, Sphere-Box, and Box-Box collisions
  
  if (objA.type === 'sphere' && objB.type === 'sphere') {
    resolveSphereSphere(objA, objB);
  } else if (objA.type === 'sphere' && objB.type === 'box') {
    resolveSphereBox(objA, objB);
  } else if (objA.type === 'box' && objB.type === 'sphere') {
    resolveSphereBox(objB, objA); // swap order
  } else if (objA.type === 'box' && objB.type === 'box') {
    resolveBoxBox(objA, objB);
  }
}

function resolveSphereSphere(sA, sB) {
  const rA = sA.dimensions[0];
  const rB = sB.dimensions[0];
  const dir = vecSub(sB.position, sA.position);
  const dist = vecLen(dir);
  const minDist = rA + rB;

  if (dist < minDist) {
    // Collision detected
    const normal = dist > 0.001 ? vecScale(dir, 1 / dist) : [0, 1, 0];
    const overlap = minDist - dist;

    // Resolve penetration (push apart)
    const massA = sA.physics?.mass || 1;
    const massB = sB.physics?.mass || 1;
    const staticA = sA.physics?.isStatic;
    const staticB = sB.physics?.isStatic;

    if (!staticA && !staticB) {
      const totalMass = massA + massB;
      sA.position = vecSub(sA.position, vecScale(normal, overlap * (massB / totalMass)));
      sB.position = vecAdd(sB.position, vecScale(normal, overlap * (massA / totalMass)));
    } else if (!staticA) {
      sA.position = vecSub(sA.position, vecScale(normal, overlap));
    } else if (!staticB) {
      sB.position = vecAdd(sB.position, vecScale(normal, overlap));
    }

    // Resolve velocities (elastic collision response)
    const rv = vecSub(sB.velocity, sA.velocity);
    const velAlongNormal = vecDot(rv, normal);

    // Only resolve if they are moving towards each other
    if (velAlongNormal < 0) {
      const e = Math.min(sA.physics?.restitution ?? 0.6, sB.physics?.restitution ?? 0.6);
      const invMassA = staticA ? 0 : 1 / massA;
      const invMassB = staticB ? 0 : 1 / massB;

      const impulseScalar = -(1 + e) * velAlongNormal / (invMassA + invMassB);
      const impulse = vecScale(normal, impulseScalar);

      if (!staticA) sA.velocity = vecSub(sA.velocity, vecScale(impulse, invMassA));
      if (!staticB) sB.velocity = vecAdd(sB.velocity, vecScale(impulse, invMassB));
    }
  }
}

function resolveSphereBox(sphere, box) {
  const radius = sphere.dimensions[0];
  const bPos = box.position;
  const bDim = box.dimensions;
  
  const halfW = bDim[0] / 2;
  const halfH = bDim[1] / 2;
  const halfD = bDim[2] / 2;

  // Closest point on AABB to sphere center
  const closestX = Math.max(bPos[0] - halfW, Math.min(sphere.position[0], bPos[0] + halfW));
  const closestY = Math.max(bPos[1] - halfH, Math.min(sphere.position[1], bPos[1] + halfH));
  const closestZ = Math.max(bPos[2] - halfD, Math.min(sphere.position[2], bPos[2] + halfD));

  const diff = vecSub(sphere.position, [closestX, closestY, closestZ]);
  const dist = vecLen(diff);

  if (dist < radius) {
    // Collision detected
    let normal;
    let overlap;

    if (dist > 0.001) {
      normal = vecScale(diff, 1 / dist);
      overlap = radius - dist;
    } else {
      // Sphere center is inside the box, push it outwards on minimum penetration axis
      const distX = radius + halfW - Math.abs(sphere.position[0] - bPos[0]);
      const distY = radius + halfH - Math.abs(sphere.position[1] - bPos[1]);
      const distZ = radius + halfD - Math.abs(sphere.position[2] - bPos[2]);

      const minDist = Math.min(distX, distY, distZ);
      overlap = minDist;

      if (minDist === distX) {
        normal = [sphere.position[0] > bPos[0] ? 1 : -1, 0, 0];
      } else if (minDist === distY) {
        normal = [0, sphere.position[1] > bPos[1] ? 1 : -1, 0];
      } else {
        normal = [0, 0, sphere.position[2] > bPos[2] ? 1 : -1];
      }
    }

    const massS = sphere.physics?.mass || 1;
    const massB = box.physics?.mass || 1;
    const staticS = sphere.physics?.isStatic;
    const staticB = box.physics?.isStatic;

    if (!staticS && !staticB) {
      const totalMass = massS + massB;
      sphere.position = vecAdd(sphere.position, vecScale(normal, overlap * (massB / totalMass)));
      box.position = vecSub(box.position, vecScale(normal, overlap * (massS / totalMass)));
    } else if (!staticS) {
      sphere.position = vecAdd(sphere.position, vecScale(normal, overlap));
    } else if (!staticB) {
      box.position = vecSub(box.position, vecScale(normal, overlap));
    }

    // Bounce velocities
    const rv = vecSub(box.velocity, sphere.velocity);
    const velAlongNormal = vecDot(rv, normal);

    if (velAlongNormal < 0) {
      const e = Math.min(sphere.physics?.restitution ?? 0.6, box.physics?.restitution ?? 0.6);
      const invMassS = staticS ? 0 : 1 / massS;
      const invMassB = staticB ? 0 : 1 / massB;

      const impulseScalar = -(1 + e) * velAlongNormal / (invMassS + invMassB);
      const impulse = vecScale(normal, impulseScalar);

      if (!staticS) sphere.velocity = vecAdd(sphere.velocity, vecScale(impulse, invMassS));
      if (!staticB) box.velocity = vecSub(box.velocity, vecScale(impulse, invMassB));
    }
  }
}

function resolveBoxBox(bA, bB) {
  const posA = bA.position;
  const dimA = bA.dimensions;
  const posB = bB.position;
  const dimB = bB.dimensions;

  const halfWA = dimA[0] / 2;
  const halfHA = dimA[1] / 2;
  const halfDA = dimA[2] / 2;

  const halfWB = dimB[0] / 2;
  const halfHB = dimB[1] / 2;
  const halfDB = dimB[2] / 2;

  // Check overlap on X, Y, Z
  const overlapX = (halfWA + halfWB) - Math.abs(posA[0] - posB[0]);
  const overlapY = (halfHA + halfHB) - Math.abs(posA[1] - posB[1]);
  const overlapZ = (halfDA + halfDB) - Math.abs(posA[2] - posB[2]);

  if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
    // Collision detected! Find minimum penetration axis
    let normal;
    let overlap;

    if (overlapX < overlapY && overlapX < overlapZ) {
      normal = [posB[0] > posA[0] ? 1 : -1, 0, 0];
      overlap = overlapX;
    } else if (overlapY < overlapX && overlapY < overlapZ) {
      normal = [0, posB[1] > posA[1] ? 1 : -1, 0];
      overlap = overlapY;
    } else {
      normal = [0, 0, posB[2] > posA[2] ? 1 : -1];
      overlap = overlapZ;
    }

    const massA = bA.physics?.mass || 1;
    const massB = bB.physics?.mass || 1;
    const staticA = bA.physics?.isStatic;
    const staticB = bB.physics?.isStatic;

    if (!staticA && !staticB) {
      const totalMass = massA + massB;
      bA.position = vecSub(bA.position, vecScale(normal, overlap * (massB / totalMass)));
      bB.position = vecAdd(bB.position, vecScale(normal, overlap * (massA / totalMass)));
    } else if (!staticA) {
      bA.position = vecSub(bA.position, vecScale(normal, overlap));
    } else if (!staticB) {
      bB.position = vecAdd(bB.position, vecScale(normal, overlap));
    }

    // Velocity response
    const rv = vecSub(bB.velocity, bA.velocity);
    const velAlongNormal = vecDot(rv, normal);

    if (velAlongNormal < 0) {
      const e = Math.min(bA.physics?.restitution ?? 0.6, bB.physics?.restitution ?? 0.6);
      const invMassA = staticA ? 0 : 1 / massA;
      const invMassB = staticB ? 0 : 1 / massB;

      const impulseScalar = -(1 + e) * velAlongNormal / (invMassA + invMassB);
      const impulse = vecScale(normal, impulseScalar);

      if (!staticA) bA.velocity = vecSub(bA.velocity, vecScale(impulse, invMassA));
      if (!staticB) bB.velocity = vecAdd(bB.velocity, vecScale(impulse, invMassB));
    }
  }
}

