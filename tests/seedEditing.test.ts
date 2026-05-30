import { describe, it, expect } from 'vitest';
import { generateBracket } from '../src/utils/bracketGenerator';
import { scheduleCourts } from '../src/utils/courtScheduler';
import type { Match, Team } from '../src/types/tournament';
import {
  canSwapSlots,
  getPlacedTeams,
  getSwappableSlots,
  getTbdSlots,
  isSwappableSlot,
  swapSeedSlots,
  type SeedSlotRef,
} from '../src/utils/seedEditing';

function makeTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));
}

function buildMatches(n: number): Match[] {
  const teams = makeTeams(n);
  let matches = generateBracket(teams);
  return scheduleCourts(matches, n, n <= 8 ? 15 : n === 9 ? 12 : 11);
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('seedEditing', () => {
  it('8 teams: 8 swappable slots, no TBD', () => {
    const matches = buildMatches(8);
    expect(getSwappableSlots(matches).length).toBe(8);
    expect(getTbdSlots(matches).length).toBe(0);
  });

  it('9 teams: 9 swappable + 1 TBD play-in winner slot', () => {
    const matches = buildMatches(9);
    expect(getSwappableSlots(matches).length).toBe(9);
    expect(getTbdSlots(matches).length).toBe(1);
  });

  it('10 teams: 10 swappable + 2 TBD slots', () => {
    const matches = buildMatches(10);
    expect(getSwappableSlots(matches).length).toBe(10);
    expect(getTbdSlots(matches).length).toBe(2);
  });

  it('swaps two WBR1 teams on 8-team bracket', () => {
    const matches = buildMatches(8);
    const from: SeedSlotRef = { matchId: 'wbr1m1', slot: 1 };
    const to: SeedSlotRef = { matchId: 'wbr1m2', slot: 1 };

    const beforeA = matches.find((m) => m.id === 'wbr1m1')!.slot1.team!.name;
    const beforeB = matches.find((m) => m.id === 'wbr1m2')!.slot1.team!.name;

    const next = swapSeedSlots(matches, from, to);

    expect(next.find((m) => m.id === 'wbr1m1')!.slot1.team!.name).toBe(beforeB);
    expect(next.find((m) => m.id === 'wbr1m2')!.slot1.team!.name).toBe(beforeA);
  });

  it('swaps play-in team with WBR1 direct slot (9-team)', () => {
    const matches = buildMatches(9);
    const from: SeedSlotRef = { matchId: 'pi', slot: 1 };
    const to: SeedSlotRef = { matchId: 'wbr1m4', slot: 2 };

    const piTeam = matches.find((m) => m.id === 'pi')!.slot1.team!.name;
    const wbrTeam = matches.find((m) => m.id === 'wbr1m4')!.slot2.team!.name;

    const next = swapSeedSlots(matches, from, to);

    expect(next.find((m) => m.id === 'pi')!.slot1.team!.name).toBe(wbrTeam);
    expect(next.find((m) => m.id === 'wbr1m4')!.slot2.team!.name).toBe(piTeam);
  });

  it('cannot swap into TBD source slots', () => {
    const matches = buildMatches(9);
    const tbd = getTbdSlots(matches)[0]!;
    const swappable = getSwappableSlots(matches)[0]!;

    expect(isSwappableSlot(tbd.match, tbd.slot)).toBe(false);
    expect(
      canSwapSlots(
        matches,
        swappable,
        { matchId: tbd.match.id, slot: tbd.slot },
        false,
      ),
    ).toBe(false);
  });

  it('preserves every team exactly once across swappable slots after random swaps', () => {
    for (const n of [8, 9, 10]) {
      let matches = buildMatches(n);
      const rng = mulberry32(n * 77);
      const slots = getSwappableSlots(matches);

      for (let i = 0; i < 30; i++) {
        const a = slots[Math.floor(rng() * slots.length)]!;
        const b = slots[Math.floor(rng() * slots.length)]!;
        if (a.matchId === b.matchId && a.slot === b.slot) continue;
        matches = swapSeedSlots(matches, a, b);
      }

      const placed = getPlacedTeams(matches);
      const names = placed.map((t) => t.name).sort();
      expect(placed.length).toBe(n);
      expect(new Set(names).size).toBe(n);
      expect(names).toEqual(makeTeams(n).map((t) => t.name).sort());
    }
  });

  it('fuzz: 100 random swaps on 10-team bracket never lose a team', () => {
    let matches = buildMatches(10);
    const rng = mulberry32(999);
    const slots = getSwappableSlots(matches);

    for (let i = 0; i < 100; i++) {
      const a = slots[Math.floor(rng() * slots.length)]!;
      const b = slots[Math.floor(rng() * slots.length)]!;
      if (a.matchId === b.matchId && a.slot === b.slot) continue;
      matches = swapSeedSlots(matches, a, b);
    }

    expect(getPlacedTeams(matches).length).toBe(10);
  });

  it('match stays ready after swapping two ready WBR1 slots', () => {
    const matches = buildMatches(8);
    const next = swapSeedSlots(
      matches,
      { matchId: 'wbr1m1', slot: 1 },
      { matchId: 'wbr1m2', slot: 2 },
    );
    expect(next.find((x) => x.id === 'wbr1m1')!.status).toBe('ready');
    expect(next.find((x) => x.id === 'wbr1m2')!.status).toBe('ready');
  });
});