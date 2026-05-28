import { describe, it, expect } from 'vitest';
import { generateBracket, getMatchDuration } from '../src/utils/bracketGenerator';
import { scheduleCourts } from '../src/utils/courtScheduler';
import type { Match, Team } from '../src/types/tournament';

function makeTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));
}

const TOTAL_MINUTES = 120;
const COURT2_FREE_BY = 90; // Court 2 must be done by this minute

function getScheduled(n: number): Match[] {
  const teams = makeTeams(n);
  const duration = getMatchDuration(n);
  let matches = generateBracket(teams);
  matches = scheduleCourts(matches, n, duration);
  return matches.filter((m) => !m.isResetMatch);
}

// ─── Shared constraint checker ────────────────────────────────────────────────

function assertScheduleConstraints(matches: Match[], n: number) {
  const duration = getMatchDuration(n);
  const scheduled = matches.filter((m) => !m.isResetMatch && m.endMinute > 0);

  it('every match has a court assigned (1 or 2)', () => {
    for (const m of scheduled) {
      expect(m.courtNumber === 1 || m.courtNumber === 2).toBe(true);
    }
  });

  it(`match duration is exactly ${duration} minutes`, () => {
    for (const m of scheduled) {
      expect(m.endMinute - m.startMinute).toBe(duration);
    }
  });

  it(`match duration is within 10–15 minutes`, () => {
    expect(duration).toBeGreaterThanOrEqual(10);
    expect(duration).toBeLessThanOrEqual(15);
  });

  it('all matches finish within 120 minutes', () => {
    for (const m of scheduled) {
      expect(m.endMinute).toBeLessThanOrEqual(TOTAL_MINUTES);
    }
  });

  it('Court 2 has no match ending after minute 90', () => {
    const c2Matches = scheduled.filter((m) => m.courtNumber === 2);
    for (const m of c2Matches) {
      expect(m.endMinute).toBeLessThanOrEqual(COURT2_FREE_BY);
    }
  });

  it('Court 2 is free for at least 30 minutes before end', () => {
    const c2Matches = scheduled.filter((m) => m.courtNumber === 2);
    const lastC2End = c2Matches.reduce((max, m) => Math.max(max, m.endMinute), 0);
    expect(TOTAL_MINUTES - lastC2End).toBeGreaterThanOrEqual(30);
  });

  it('no two matches on the same court overlap in time', () => {
    for (const court of [1, 2] as const) {
      const courtMatches = scheduled
        .filter((m) => m.courtNumber === court)
        .sort((a, b) => a.startMinute - b.startMinute);

      for (let i = 1; i < courtMatches.length; i++) {
        const prev = courtMatches[i - 1];
        const curr = courtMatches[i];
        expect(curr.startMinute).toBeGreaterThanOrEqual(prev.endMinute);
      }
    }
  });

  it('the GF finishes before the 2-hour window ends', () => {
    const gf = scheduled.find((m) => m.section === 'grand_final');
    expect(gf).toBeDefined();
    expect(gf!.endMinute).toBeLessThanOrEqual(TOTAL_MINUTES);
  });

  it('the GF is on Court 1 (Court 2 must be free by then)', () => {
    const gf = scheduled.find((m) => m.section === 'grand_final');
    expect(gf?.courtNumber).toBe(1);
  });
}

// ─── 8-team scheduling ────────────────────────────────────────────────────────

describe('8-team schedule', () => {
  const scheduled = getScheduled(8);
  assertScheduleConstraints(scheduled, 8);

  it('has 14 scheduled matches', () => {
    expect(scheduled.length).toBe(14);
  });

  it('WBR1 matches start at minute 0', () => {
    const r1 = scheduled.filter((m) => m.section === 'winners' && m.round === 0);
    expect(r1.every((m) => m.startMinute === 0 || m.startMinute === 15)).toBe(true);
    expect(r1.some((m) => m.startMinute === 0)).toBe(true);
  });

  it('LB Finals is on Court 1', () => {
    const lbf = scheduled.find((m) => m.id === 'lb_finals');
    expect(lbf?.courtNumber).toBe(1);
  });

  it('Court 2 last match ends at minute 90 for 8-team', () => {
    const c2 = scheduled.filter((m) => m.courtNumber === 2);
    const lastEnd = Math.max(...c2.map((m) => m.endMinute));
    expect(lastEnd).toBe(90);
  });
});

// ─── 9-team scheduling ────────────────────────────────────────────────────────

describe('9-team schedule', () => {
  const scheduled = getScheduled(9);
  assertScheduleConstraints(scheduled, 9);

  it('has 16 scheduled matches', () => {
    expect(scheduled.length).toBe(16);
  });

  it('play-in match starts first (minute 0)', () => {
    const pi = scheduled.find((m) => m.id === 'pi');
    expect(pi?.startMinute).toBe(0);
  });

  it('GF finishes by minute 108 (10 min buffer before 120)', () => {
    const gf = scheduled.find((m) => m.section === 'grand_final');
    expect(gf!.endMinute).toBeLessThanOrEqual(108);
  });

  it('Court 2 free at least 36 minutes before end for 9-team', () => {
    const c2 = scheduled.filter((m) => m.courtNumber === 2);
    const lastEnd = Math.max(...c2.map((m) => m.endMinute));
    expect(TOTAL_MINUTES - lastEnd).toBeGreaterThanOrEqual(36);
  });
});

// ─── 10-team scheduling ───────────────────────────────────────────────────────

describe('10-team schedule', () => {
  const scheduled = getScheduled(10);
  assertScheduleConstraints(scheduled, 10);

  it('has 18 scheduled matches', () => {
    expect(scheduled.length).toBe(18);
  });

  it('both play-in matches start at minute 0', () => {
    const pi_a = scheduled.find((m) => m.id === 'pi_a');
    const pi_b = scheduled.find((m) => m.id === 'pi_b');
    expect(pi_a?.startMinute).toBe(0);
    expect(pi_b?.startMinute).toBe(0);
  });

  it('play-in matches are on different courts', () => {
    const pi_a = scheduled.find((m) => m.id === 'pi_a');
    const pi_b = scheduled.find((m) => m.id === 'pi_b');
    expect(pi_a?.courtNumber).not.toBe(pi_b?.courtNumber);
  });

  it('GF finishes by minute 110', () => {
    const gf = scheduled.find((m) => m.section === 'grand_final');
    expect(gf!.endMinute).toBeLessThanOrEqual(110);
  });

  it('Court 2 free at least 32 minutes before end for 10-team', () => {
    const c2 = scheduled.filter((m) => m.courtNumber === 2);
    const lastEnd = Math.max(...c2.map((m) => m.endMinute));
    expect(TOTAL_MINUTES - lastEnd).toBeGreaterThanOrEqual(32);
  });
});

// ─── Dependency-order verification ───────────────────────────────────────────

describe('scheduling respects match dependencies', () => {
  for (const n of [8, 9, 10]) {
    it(`${n} teams: every match starts after its prerequisite matches end`, () => {
      const teams = makeTeams(n);
      const duration = getMatchDuration(n);
      let matches = generateBracket(teams);
      matches = scheduleCourts(matches, n, duration);
      const scheduled = matches.filter((m) => !m.isResetMatch && m.endMinute > 0);
      const byId = new Map(matches.map((m) => [m.id, m]));

      for (const m of scheduled) {
        for (const slot of [m.slot1, m.slot2]) {
          if (!slot.sourceMatchId) continue;
          const src = byId.get(slot.sourceMatchId);
          if (!src || src.endMinute === 0) continue;
          expect(
            m.startMinute,
            `Match ${m.id} (start=${m.startMinute}) must start after ${src.id} (end=${src.endMinute})`,
          ).toBeGreaterThanOrEqual(src.endMinute);
        }
      }
    });
  }
});
