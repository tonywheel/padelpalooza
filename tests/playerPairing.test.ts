import { describe, it, expect } from 'vitest';
import {
  classifyPairs,
  expectedPairSplit,
  formatTeamName,
  generateGenderAwareTeams,
  generateRandomTeams,
  pairPlayersByGender,
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

  describe('gender-aware pairing', () => {
    it('8 boys + 8 girls → all mixed teams', () => {
      const boys = Array.from({ length: 8 }, (_, i) => `B${i + 1}`);
      const girls = Array.from({ length: 8 }, (_, i) => `G${i + 1}`);
      const pairs = pairPlayersByGender(boys, girls, mulberry32(1));
      expect(pairs.length).toBe(8);
      const split = classifyPairs(pairs, boys, girls);
      expect(split).toEqual({ mixed: 8, boyBoy: 0, girlGirl: 0 });
    });

    it('10 boys + 6 girls → 6 mixed + 2 boy/boy', () => {
      const boys = Array.from({ length: 10 }, (_, i) => `B${i + 1}`);
      const girls = Array.from({ length: 6 }, (_, i) => `G${i + 1}`);
      const pairs = pairPlayersByGender(boys, girls, mulberry32(2));
      expect(pairs.length).toBe(8);
      const split = classifyPairs(pairs, boys, girls);
      expect(split).toEqual(expectedPairSplit(10, 6));
    });

    it('6 boys + 10 girls → 6 mixed + 2 girl/girl', () => {
      const boys = Array.from({ length: 6 }, (_, i) => `B${i + 1}`);
      const girls = Array.from({ length: 10 }, (_, i) => `G${i + 1}`);
      const pairs = pairPlayersByGender(boys, girls, mulberry32(3));
      expect(pairs.length).toBe(8);
      const split = classifyPairs(pairs, boys, girls);
      expect(split).toEqual(expectedPairSplit(6, 10));
    });

    it('every player appears exactly once', () => {
      const boys = ['Ben', 'Cal', 'Dan', 'Eli', 'Fin', 'Gus'];
      const girls = ['Ann', 'Bea', 'Cia', 'Deb', 'Eve', 'Fay', 'Gia', 'Hal'];
      const pairs = pairPlayersByGender(boys, girls, mulberry32(42));
      const flat = pairs.flatMap((p) => [p.player1, p.player2]).sort();
      expect(flat).toEqual([...boys, ...girls].sort());
    });

    it('rejects duplicate names across boys and girls', () => {
      expect(() => pairPlayersByGender(['Sam'], ['Sam'])).toThrow(/unique/i);
    });

    it('generateGenderAwareTeams returns Name-Name format', () => {
      const teams = generateGenderAwareTeams(
        ['Bob', 'Cal'],
        ['Ann', 'Deb'],
        mulberry32(1),
      );
      expect(teams.length).toBe(2);
      for (const t of teams) {
        expect(t).toMatch(/^[^-]+-[^-]+$/);
      }
    });

    it('different seeds produce different pairings', () => {
      const boys = Array.from({ length: 8 }, (_, i) => `B${i + 1}`);
      const girls = Array.from({ length: 8 }, (_, i) => `G${i + 1}`);
      const t1 = generateGenderAwareTeams(boys, girls, mulberry32(1)).join('|');
      const t2 = generateGenderAwareTeams(boys, girls, mulberry32(99)).join('|');
      expect(t1).not.toBe(t2);
    });

    for (const [teams, boys, girls] of [
      [8, 8, 8],
      [8, 10, 6],
      [8, 6, 10],
      [9, 9, 9],
      [9, 11, 7],
      [10, 10, 10],
      [10, 12, 8],
    ] as const) {
      it(`${teams} teams (${boys}B+${girls}G): maximizes mixed pairs`, () => {
        const boyNames = Array.from({ length: boys }, (_, i) => `B${i + 1}`);
        const girlNames = Array.from({ length: girls }, (_, i) => `G${i + 1}`);
        const pairs = pairPlayersByGender(boyNames, girlNames, mulberry32(teams * 50));
        expect(pairs.length).toBe(teams);
        const split = classifyPairs(pairs, boyNames, girlNames);
        expect(split).toEqual(expectedPairSplit(boys, girls));
      });
    }

    it('fuzz: random boy/girl splits always satisfy max-mixed invariant', () => {
      for (let seed = 0; seed < 100; seed++) {
        const rng = mulberry32(seed);
        const total = 16 + Math.floor(rng() * 3) * 2; // 16, 18, or 20
        const boys = Math.floor(rng() * (total + 1));
        const girls = total - boys;
        if (boys === 0 || girls === 0) continue;

        const boyNames = Array.from({ length: boys }, (_, i) => `B${seed}_${i}`);
        const girlNames = Array.from({ length: girls }, (_, i) => `G${seed}_${i}`);
        const pairs = pairPlayersByGender(boyNames, girlNames, rng);
        expect(pairs.length).toBe(total / 2);
        expect(classifyPairs(pairs, boyNames, girlNames)).toEqual(
          expectedPairSplit(boys, girls),
        );
      }
    });
  });

  describe('legacy random pairing', () => {
    it('pairPlayersIntoTeams creates correct number of teams', () => {
      const players = Array.from({ length: 16 }, (_, i) => `P${i + 1}`);
      const pairs = pairPlayersIntoTeams(players);
      expect(pairs.length).toBe(8);
    });

    it('rejects odd player count', () => {
      expect(() => pairPlayersIntoTeams(['A', 'B', 'C'])).toThrow(/even/i);
    });

    it('shuffle is deterministic with seeded rng', () => {
      const a = shuffle([1, 2, 3, 4, 5, 6], mulberry32(99));
      const b = shuffle([1, 2, 3, 4, 5, 6], mulberry32(99));
      expect(a).toEqual(b);
    });

    it('generateRandomTeams works for flat player list', () => {
      const names = Array.from({ length: 16 }, (_, i) => `P${i + 1}`);
      const result = generateRandomTeams(names, mulberry32(100));
      expect(result.length).toBe(8);
    });
  });
});
