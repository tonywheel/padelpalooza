import { describe, it, expect } from 'vitest';
import { generateBracket } from '../src/utils/bracketGenerator';
import { scheduleCourts, getScheduleOrder, getCourtQueues } from '../src/utils/courtScheduler';
import {
  completeMatchAndReschedule,
  getEarliestFinishMinute,
  getEffectiveEnd,
  isCourtQueueReady,
  recomputeSchedule,
} from '../src/utils/dynamicScheduler';
import type { Match, Team } from '../src/types/tournament';

function makeTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));
}

function buildTournament(n: number) {
  const teams = makeTeams(n);
  const duration = n <= 8 ? 15 : n === 9 ? 12 : 11;
  let matches = generateBracket(teams);
  matches = scheduleCourts(matches, n, duration);
  return { matches, numTeams: n, duration };
}

function cloneMatches(matches: Match[]): Match[] {
  return matches.map((m) => ({ ...m, slot1: { ...m.slot1 }, slot2: { ...m.slot2 } }));
}

function markComplete(
  matches: Match[],
  matchId: string,
  completedAtMinute: number,
  numTeams: number,
  duration: number,
) {
  const m = matches.find((x) => x.id === matchId)!;
  m.status = 'completed';
  m.winner = m.slot1.team;
  m.loser = m.slot2.team;
  const earliest = getEarliestFinishMinute(m, matches, numTeams);
  m.completedAtMinute = Math.max(completedAtMinute, earliest);
  m.endMinute = m.completedAtMinute;
  recomputeSchedule(matches, numTeams, duration);
}

function assertScheduleInvariants(matches: Match[], numTeams: number, duration: number) {
  const scheduled = matches.filter((m) => !m.isResetMatch || m.resetActive);
  const byId = new Map(matches.map((m) => [m.id, m]));
  const queues = getCourtQueues(numTeams);

  for (const m of scheduled) {
    if (m.status !== 'completed') {
      expect(m.endMinute - m.startMinute).toBe(duration);
    } else if (m.completedAtMinute != null) {
      expect(m.endMinute).toBe(m.completedAtMinute);
    }

    for (const slot of [m.slot1, m.slot2]) {
      if (!slot.sourceMatchId) continue;
      const src = byId.get(slot.sourceMatchId)!;
      expect(m.startMinute).toBeGreaterThanOrEqual(getEffectiveEnd(src));
    }
  }

  for (const [court, queue] of [
    [1, queues.court1],
    [2, queues.court2],
  ] as const) {
    for (let i = 1; i < queue.length; i++) {
      const prev = byId.get(queue[i - 1]!);
      const curr = byId.get(queue[i]!);
      if (!prev || !curr) continue;
      if (curr.courtNumber !== court) continue;
      expect(curr.startMinute).toBeGreaterThanOrEqual(getEffectiveEnd(prev));
    }
  }
}

// ─── User example: sequential court matches ─────────────────────────────────

describe('dynamic schedule — same-court chain', () => {
  it('9-team: first match ends early → second match on court 1 shifts earlier', () => {
    const { matches, numTeams, duration } = buildTournament(9);
    // Court 1 order: pi (0-12), wbr1m1 (12-24), ...
    const pi = matches.find((m) => m.id === 'pi')!;
    const wbr1m1 = matches.find((m) => m.id === 'wbr1m1')!;

    expect(pi.startMinute).toBe(0);
    expect(wbr1m1.startMinute).toBe(12);

    markComplete(matches, 'pi', 10, numTeams, duration);

    expect(pi.completedAtMinute).toBe(10);
    expect(wbr1m1.startMinute).toBe(10);
    expect(wbr1m1.endMinute).toBe(10 + duration);
  });

  it('9-team: first match ends late → second match on court 1 shifts later', () => {
    const { matches, numTeams, duration } = buildTournament(9);
    markComplete(matches, 'pi', 16, numTeams, duration);

    const wbr1m1 = matches.find((m) => m.id === 'wbr1m1')!;
    expect(wbr1m1.startMinute).toBe(16);
    expect(wbr1m1.endMinute).toBe(16 + duration);
  });

  it('8-team: parallel courts — court 2 unaffected when court 1 finishes early', () => {
    const { matches, numTeams, duration } = buildTournament(8);
    const wbr1m2 = matches.find((m) => m.id === 'wbr1m2')!;
    const originalC2Start = wbr1m2.startMinute;

    markComplete(matches, 'wbr1m1', 10, numTeams, duration);

    expect(wbr1m2.startMinute).toBe(originalC2Start);
  });
});

// ─── Dependency propagation ─────────────────────────────────────────────────

describe('dynamic schedule — cross-court dependencies', () => {
  it('downstream match waits for feeder even on another court', () => {
    const { matches, numTeams, duration } = buildTournament(8);
    const wbr2m1 = matches.find((m) => m.id === 'wbr2m1')!;

    markComplete(matches, 'wbr1m1', 10, numTeams, duration);
    markComplete(matches, 'wbr1m2', 10, numTeams, duration);

    expect(wbr2m1.startMinute).toBeGreaterThanOrEqual(10);
  });
});

// ─── completeMatchAndReschedule helper ──────────────────────────────────────

describe('completeMatchAndReschedule', () => {
  it('matches markComplete behavior', () => {
    const { matches, numTeams, duration } = buildTournament(9);
    const copy = cloneMatches(matches);
    completeMatchAndReschedule(copy, 'pi', numTeams, duration, 10);
    const wbr1m1 = copy.find((m) => m.id === 'wbr1m1')!;
    expect(wbr1m1.startMinute).toBe(10);
  });
});

// ─── Fuzz: random completion times & orders ───────────────────────────────────

function getReadyMatches(matches: Match[]): Match[] {
  return matches.filter(
    (m) =>
      !m.isResetMatch &&
      m.status !== 'completed' &&
      m.slot1.team &&
      m.slot2.team &&
      (m.status === 'ready' || m.status === 'pending'),
  );
}

function propagateTeams(matches: Match[], matchId: string) {
  const m = matches.find((x) => x.id === matchId)!;
  const winner = m.slot1.team!;
  const loser = m.slot2.team!;
  if (m.winnerTo) {
    const dest = matches.find((x) => x.id === m.winnerTo!.matchId)!;
    const sk = m.winnerTo.slot === 1 ? 'slot1' : 'slot2';
    dest[sk] = { ...dest[sk], team: winner };
    if (dest.slot1.team && dest.slot2.team) dest.status = 'ready';
  }
  if (m.loserTo) {
    const dest = matches.find((x) => x.id === m.loserTo!.matchId)!;
    const sk = m.loserTo.slot === 1 ? 'slot1' : 'slot2';
    dest[sk] = { ...dest[sk], team: loser };
    if (dest.slot1.team && dest.slot2.team) dest.status = 'ready';
  }
}

function simulateFullTournament(
  n: number,
  pickCompletionMinute: (m: Match) => number,
  completionOrder?: string[],
) {
  const { matches, numTeams, duration } = buildTournament(n);
  const order = completionOrder ?? getScheduleOrder(n);

  for (const id of order) {
    const m = matches.find((x) => x.id === id);
    if (!m || m.isResetMatch) continue;
    if (!m.slot1.team || !m.slot2.team) continue;

    const at = pickCompletionMinute(m);
    m.status = 'completed';
    m.winner = m.slot1.team;
    m.loser = m.slot2.team;
    const earliest = getEarliestFinishMinute(m, matches, numTeams);
    m.completedAtMinute = Math.max(at, earliest);
    m.endMinute = m.completedAtMinute;
    propagateTeams(matches, id);
    recomputeSchedule(matches, numTeams, duration);
    assertScheduleInvariants(matches, numTeams, duration);
  }

  return matches;
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

describe('fuzz — dynamic scheduling', () => {
  for (const n of [8, 9, 10] as const) {
    it(`${n} teams: early finishes (50–100% of slot) never break invariants`, () => {
      const { duration } = buildTournament(n);
      const rng = mulberry32(1000 + n);
      simulateFullTournament(n, (m) => {
        const slack = Math.floor(rng() * duration * 0.5);
        return m.startMinute + Math.floor(duration * 0.5) - slack;
      });
      expect(duration).toBeGreaterThan(0);
    });

    it(`${n} teams: late finishes (100–150% of slot) never break invariants`, () => {
      const d = durationFor(n);
      const rng = mulberry32(2000 + n);
      simulateFullTournament(n, (m) => {
        const extra = Math.floor(rng() * d * 0.5);
        return m.startMinute + d + extra;
      });
    });

    it(`${n} teams: random completion order (ready-only) never breaks invariants`, () => {
      const { matches, numTeams, duration } = buildTournament(n);
      const rng = mulberry32(3000 + n);
      let safety = 200;

      while (safety-- > 0) {
        const ready = getReadyMatches(matches).filter(
          (m) =>
            m.slot1.team &&
            m.slot2.team &&
            isCourtQueueReady(m, matches, numTeams),
        );
        if (ready.length === 0) break;

        const pick = ready[Math.floor(rng() * ready.length)]!;
        const late = rng() > 0.5;
        const completedAt =
          pick.startMinute +
          (late ? duration + Math.floor(rng() * 5) : Math.floor(rng() * duration));

        pick.status = 'completed';
        pick.winner = pick.slot1.team;
        pick.loser = pick.slot2.team;
        const earliest = getEarliestFinishMinute(pick, matches, numTeams);
        pick.completedAtMinute = Math.max(completedAt, earliest);
        pick.endMinute = pick.completedAtMinute;
        propagateTeams(matches, pick.id);
        recomputeSchedule(matches, numTeams, duration);
        assertScheduleInvariants(matches, numTeams, duration);
      }

      const remaining = matches.filter(
        (m) => !m.isResetMatch && m.status !== 'completed',
      );
      expect(remaining.length).toBeLessThanOrEqual(1); // at most gf_reset inactive
    });
  }

  it('100 seeded fuzz runs for 9-team early/late mix', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = mulberry32(seed);
      simulateFullTournament(9, (m) => {
        const factor = 0.5 + rng();
        return Math.round(m.startMinute + durationFor(9) * factor);
      });
    }
  });
});

function durationFor(n: number) {
  return n <= 8 ? 15 : n === 9 ? 12 : 11;
}

// ─── Initial schedule unchanged before any completions ──────────────────────

describe('dynamic schedule — baseline', () => {
  it('recompute with no completions preserves static schedule', () => {
    for (const n of [8, 9, 10]) {
      const { matches, numTeams, duration } = buildTournament(n);
      const before = matches
        .filter((m) => !m.isResetMatch)
        .map((m) => ({ id: m.id, s: m.startMinute, e: m.endMinute }));
      recomputeSchedule(cloneMatches(matches), numTeams, duration);
      const after = matches
        .filter((m) => !m.isResetMatch)
        .map((m) => ({ id: m.id, s: m.startMinute, e: m.endMinute }));
      expect(after).toEqual(before);
    }
  });
});
