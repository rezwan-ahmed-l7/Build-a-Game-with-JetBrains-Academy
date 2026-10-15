export const PLAYER_COLLISION_RADIUS = 18;
export const ENEMY_COLLISION_RADIUS = 14;

const _sep = { x: 0, y: 0 };

export function isColliding(posA, radiusA, posB, radiusB) {
  const dx = posA.x - posB.x;
  const dy = posA.y - posB.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < radiusA + radiusB;
}

// Reusable buffer: callers must read .x/.y before re-invoking.
export function getSeparationVector(posA, posB, radiusA, radiusB) {
  const dx = posA.x - posB.x;
  const dy = posA.y - posB.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const overlap = (radiusA + radiusB) - dist;

  if (overlap <= 0) {
    _sep.x = 0;
    _sep.y = 0;
    return _sep;
  }

  // Coincident centers have no natural separation direction. Pick a stable
  // direction so collision resolution can still move one object out.
  if (dist < 0.0001) {
    _sep.x = overlap;
    _sep.y = 0;
    return _sep;
  }

  _sep.x = (dx / dist) * overlap;
  _sep.y = (dy / dist) * overlap;
  return _sep;
}

export function resolveEnemyVsEnemy(enemies) {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i];
      const b = enemies[j];
      const sep = getSeparationVector(
        a.group.position,
        b.group.position,
        ENEMY_COLLISION_RADIUS,
        ENEMY_COLLISION_RADIUS
      );

      if (sep.x !== 0 || sep.y !== 0) {
        const bounce = 0.5;
        a.group.position.x += sep.x * bounce;
        a.group.position.y += sep.y * bounce;
        b.group.position.x -= sep.x * bounce;
        b.group.position.y -= sep.y * bounce;
      }
    }
  }
}

export function resolveEnemyVsPlayer(enemies, playerPos) {
  for (const enemy of enemies) {
    if (enemy.isSpawning) continue;

    const sep = getSeparationVector(
      enemy.group.position,
      playerPos,
      ENEMY_COLLISION_RADIUS,
      PLAYER_COLLISION_RADIUS
    );

    if (sep.x !== 0 || sep.y !== 0) {
      enemy.group.position.x += sep.x;
      enemy.group.position.y += sep.y;
    }
  }
}

export function resolveEnemyVsObstacles(enemies, obstacles) {
  for (const enemy of enemies) {
    if (enemy.isSpawning) continue;
    for (const ob of obstacles) {
      const sep = getSeparationVector(
        enemy.group.position,
        ob.position,
        ENEMY_COLLISION_RADIUS,
        ob.radius
      );
      if (sep.x !== 0 || sep.y !== 0) {
        enemy.group.position.x += sep.x;
        enemy.group.position.y += sep.y;
      }
    }
  }
}

export function resolvePlayerVsObstacles(playerPos, obstacles) {
  // The player model is large relative to thin tree trunks, so use a smaller
  // effective radius when checking against obstacles — otherwise the player
  // can't fit through gaps that look visually navigable.
  const playerEffective = Math.max(4, PLAYER_COLLISION_RADIUS * 0.5);
  let pushed = false;
  for (const ob of obstacles) {
    const sep = getSeparationVector(playerPos, ob.position, playerEffective, ob.radius);
    if (sep.x !== 0 || sep.y !== 0) {
      playerPos.x += sep.x;
      playerPos.y += sep.y;
      pushed = true;
    }
  }
  return pushed;
}

export function canPlayerMoveTo(newPos, enemies, obstacles) {
  const playerEffective = Math.max(4, PLAYER_COLLISION_RADIUS * 0.5);
  for (const enemy of enemies) {
    if (enemy.isSpawning) continue;
    if (isColliding(newPos, PLAYER_COLLISION_RADIUS, enemy.group.position, ENEMY_COLLISION_RADIUS)) {
      return false;
    }
  }
  if (obstacles) {
    for (const ob of obstacles) {
      if (isColliding(newPos, playerEffective, ob.position, ob.radius)) {
        return false;
      }
    }
  }
  return true;
}
