import { describe, it, expect } from 'vitest';
import {
  formatTeamName,
  generateRandomTeams,
  pairPlayersIntoTeams,
  shuffle,
} from '../src/utils/playerPairing';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('playerPairing', () => {
  it('formatTeamName uses hyphen between players', () => {
    expect(formatTeamName('Alice', 'Bob')).toBe('Alice-Bob');
  });

  it('pairPlayersIntoTeams creates correct number of teams', () => {
    const players = Array.from({ length: 16 }, (_, i) => `P${i + 1}`);
    const pairs = pairPlayersIntoTeams(players);
    expect(pairs.length).toBe(8);
  });

  it('every player appears exactly once across pairs', () => {
    const players = ['Ann', 'Ben', 'Cal', 'Deb', 'Eve', 'Fin', 'Gus', 'Hal'];
    const pairs = pairPlayersIntoTeams(players, mulberry32(42));
    const flat = pairs.flatMap((p) => [p.player1, p.player2]).sort();
    expect(flat).toEqual([...players].sort());
  });

  it('generateRandomTeams returns PlayerOne-PlayerTwo names', () => {
    const teams = generateRandomTeams(['Alice', 'Bob', 'Cal', 'Deb'], mulberry32(1));
    expect(teams.length).toBe(2);
    for (const t of teams) {
      expect(t).toMatch(/^[^-]+-[^-]+$/);
    }
  });

  it('rejects odd player count', () => {
    expect(() => pairPlayersIntoTeams(['A', 'B', 'C'])).toThrow(/even/i);
  });

  it('rejects duplicate player names (case-insensitive)', () => {
    expect(() => pairPlayersIntoTeams(['Alice', 'Bob', 'alice', 'Cal'])).toThrow(/unique/i);
  });

  it('shuffle is deterministic with seeded rng', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6], mulberry32(99));
    const b = shuffle([1, 2, 3, 4, 5, 6], mulberry32(99));
    expect(a).toEqual(b);
  });

  it('different seeds usually produce different pairings', () => {
    const players = Array.from({ length: 16 }, (_, i) => `Player${i + 1}`);
    const t1 = generateRandomTeams(players, mulberry32(1)).join('|');
    const t2 = generateRandomTeams(players, mulberry32(2)).join('|');
    expect(t1).not.toBe(t2);
  });

  for (const [teams, players] of [
    [8, 16],
    [9, 18],
    [10, 20],
  ] as const) {
    it(`${teams} teams (${players} players): valid pairing`, () => {
      const names = Array.from({ length: players }, (_, i) => `P${i + 1}`);
      const result = generateRandomTeams(names, mulberry32(teams * 100));
      expect(result.length).toBe(teams);
      const used = new Set(result.flatMap((t) => t.split('-')));
      expect(used.size).toBe(players);
    });
  }
});
