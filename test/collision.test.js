import {
  isColliding,
  getSeparationVector,
  canPlayerMoveTo,
  resolvePlayerVsObstacles,
  PLAYER_COLLISION_RADIUS,
  ENEMY_COLLISION_RADIUS
} from '../game/src/components/Collision.js';

describe('collision helpers', () => {
  test('detects overlapping circles', () => {
    expect(isColliding({ x: 0, y: 0 }, 10, { x: 15, y: 0 }, 10)).toBe(true);
  });

  test('does not detect circles that only touch at their boundaries', () => {
    expect(isColliding({ x: 0, y: 0 }, 10, { x: 20, y: 0 }, 10)).toBe(false);
  });

  test('returns zero separation when circles do not overlap', () => {
    const separation = getSeparationVector(
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      10,
      10
    );

    expect(separation.x).toBe(0);
    expect(separation.y).toBe(0);
  });

  test('returns a separation vector for overlapping circles', () => {
    const separation = getSeparationVector(
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      10,
      10
    );

    expect(separation.x).toBeCloseTo(-5);
    expect(separation.y).toBeCloseTo(0);
  });

  test('blocks movement into a non-spawning enemy', () => {
    const destination = { x: 0, y: 0 };
    const enemies = [{
      isSpawning: false,
      group: { position: { x: 20, y: 0 } }
    }];

    expect(canPlayerMoveTo(destination, enemies, [])).toBe(false);
  });

  test('does not block movement because of an enemy that is spawning', () => {
    const destination = { x: 0, y: 0 };
    const enemies = [{
      isSpawning: true,
      group: { position: { x: 0, y: 0 } }
    }];

    expect(canPlayerMoveTo(destination, enemies, [])).toBe(true);
  });

  test('blocks movement into an obstacle', () => {
    const destination = { x: 0, y: 0 };
    const obstacle = { position: { x: 10, y: 0 }, radius: 5 };

    expect(canPlayerMoveTo(destination, [], [obstacle])).toBe(false);
  });

  test('pushes the player out of an overlapping obstacle', () => {
    const player = { x: 0, y: 0 };
    const obstacle = { position: { x: 0, y: 0 }, radius: 5 };

    expect(resolvePlayerVsObstacles(player, [obstacle])).toBe(true);
    expect(Math.hypot(player.x, player.y)).toBeGreaterThan(0);
  });

  test('exports the expected collision radii', () => {
    expect(PLAYER_COLLISION_RADIUS).toBeGreaterThan(0);
    expect(ENEMY_COLLISION_RADIUS).toBeGreaterThan(0);
  });
});
