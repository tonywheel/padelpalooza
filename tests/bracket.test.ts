import { describe, it, expect } from 'vitest';
import { generateBracket, getMatchDuration } from '../src/utils/bracketGenerator';
import type { Match, Team } from '../src/types/tournament';

function makeTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));
}

// ─── Helper: simulate completing a tournament to verify every team plays ≥2 ─

/**
 * Walks through all matches in dependency order and tracks
 * how many times each team plays (wins + losses).
 * Returns a map: teamId → matchCount.
 */
function countGamesPerTeam(matches: Match[], teams: Team[]): Map<string, number> {
  const counts = new Map<string, number>(teams.map((t) => [t.id, 0]));
  const byId = new Map(matches.map((m) => [m.id, m]));

  // Clone matches so we can simulate results
  const sim = matches.map((m) => ({ ...m, winner: null as Team | null, loser: null as Team | null }));
  const simById = new Map(sim.map((m) => [m.id, m]));

  // Helper: propagate a result through the bracket
  function complete(matchId: string, winnerId: string) {
    const m = simById.get(matchId);
    if (!m || m.status === 'completed') return;

    const w = m.slot1.team?.id === winnerId ? m.slot1.team : m.slot2.team;
    const l = m.slot1.team?.id === winnerId ? m.slot2.team : m.slot1.team;
    if (!w || !l) return;

    m.winner = w;
    m.loser = l;
    m.status = 'completed';

    counts.set(w.id, (counts.get(w.id) ?? 0) + 1);
    counts.set(l.id, (counts.get(l.id) ?? 0) + 1);

    const orig = byId.get(matchId);
    if (orig?.winnerTo) {
      const dest = simById.get(orig.winnerTo.matchId);
      if (dest) {
        const sk = orig.winnerTo.slot === 1 ? 'slot1' : 'slot2';
        (dest as any)[sk] = { ...dest[sk as 'slot1' | 'slot2'], team: w };
        if (dest.slot1.team && dest.slot2.team) dest.status = 'ready';
      }
    }
    if (orig?.loserTo) {
      const dest = simById.get(orig.loserTo.matchId);
      if (dest) {
        const sk = orig.loserTo.slot === 1 ? 'slot1' : 'slot2';
        (dest as any)[sk] = { ...dest[sk as 'slot1' | 'slot2'], team: l };
        if (dest.slot1.team && dest.slot2.team) dest.status = 'ready';
      }
    }
  }

  // Simulate each team losing as early as possible (worst-case: play minimum matches)
  // We repeatedly pass over the list until all non-reset matches are completed
  let progress = true;
  let iterations = 0;
  while (progress && iterations < 200) {
    progress = false;
    iterations++;
    for (const m of sim) {
      if (m.isResetMatch) continue;
      if (m.status === 'completed') continue;
      if (!m.slot1.team || !m.slot2.team) continue;
      // Always pick team1 as winner
      complete(m.id, m.slot1.team.id);
      progress = true;
    }
  }

  return counts;
}

// ─── 8-team tests ────────────────────────────────────────────────────────────

describe('8-team bracket', () => {
  const teams = makeTeams(8);
  const matches = generateBracket(teams);

  it('produces no play-in matches', () => {
    const playins = matches.filter((m) => m.label.toLowerCase().includes('play-in'));
    expect(playins.length).toBe(0);
  });

  it('has 4 WB Round-1 matches', () => {
    const r1 = matches.filter((m) => m.section === 'winners' && m.round === 0);
    expect(r1.length).toBe(4);
  });

  it('has 2 WB Round-2 matches', () => {
    const r2 = matches.filter((m) => m.section === 'winners' && m.round === 1);
    expect(r2.length).toBe(2);
  });

  it('has 1 WB Finals match', () => {
    const f = matches.filter((m) => m.section === 'winners' && m.round === 2);
    expect(f.length).toBe(1);
  });

  it('has 2 LB Round-1 matches', () => {
    const r = matches.filter((m) => m.section === 'losers' && m.round === 0);
    expect(r.length).toBe(2);
  });

  it('has 2 LB Round-2 matches', () => {
    const r = matches.filter((m) => m.section === 'losers' && m.round === 1);
    expect(r.length).toBe(2);
  });

  it('has 1 LB Semis match', () => {
    const r = matches.filter((m) => m.section === 'losers' && m.round === 2);
    expect(r.length).toBe(1);
  });

  it('has 1 LB Finals match', () => {
    const r = matches.filter((m) => m.section === 'losers' && m.round === 3);
    expect(r.length).toBe(1);
  });

  it('has 1 Grand Final match (plus 1 reset)', () => {
    const gf = matches.filter((m) => m.section === 'grand_final');
    expect(gf.length).toBe(2); // GF + optional reset
    expect(gf.filter((m) => !m.isResetMatch).length).toBe(1);
    expect(gf.filter((m) => m.isResetMatch).length).toBe(1);
  });

  it('has 14 schedulable (non-reset) matches', () => {
    const scheduled = matches.filter((m) => !m.isResetMatch);
    expect(scheduled.length).toBe(14);
  });

  it('match duration is 15 minutes', () => {
    expect(getMatchDuration(8)).toBe(15);
  });

  it('all WB Round-1 matches are immediately ready (all teams seeded)', () => {
    const r1 = matches.filter((m) => m.section === 'winners' && m.round === 0);
    r1.forEach((m) => expect(m.status).toBe('ready'));
  });

  it('every team plays at least 2 matches (min-path simulation)', () => {
    const counts = countGamesPerTeam(matches, teams);
    for (const [, count] of counts) {
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it('WBR1 M1 seeds are S1 vs S8', () => {
    const m = matches.find((x) => x.id === 'wbr1m1')!;
    expect(m.slot1.team?.seed).toBe(1);
    expect(m.slot2.team?.seed).toBe(8);
  });

  it('winner and loser destinations are wired for WBR1 M1', () => {
    const m = matches.find((x) => x.id === 'wbr1m1')!;
    expect(m.winnerTo?.matchId).toBe('wbr2m1');
    expect(m.loserTo).not.toBeNull();
  });

  it('GF reset match exists but is not active', () => {
    const reset = matches.find((m) => m.isResetMatch)!;
    expect(reset).toBeDefined();
    expect(reset.resetActive).toBe(false);
    expect(reset.status).toBe('pending');
  });
});

// ─── 9-team tests ────────────────────────────────────────────────────────────

describe('9-team bracket', () => {
  const teams = makeTeams(9);
  const matches = generateBracket(teams);
  const nonReset = matches.filter((m) => !m.isResetMatch);

  it('has exactly 1 play-in match', () => {
    const playins = nonReset.filter((m) => m.round === -1);
    expect(playins.length).toBe(1);
  });

  it('play-in involves seeds 8 and 9', () => {
    const pi = matches.find((m) => m.round === -1)!;
    const seeds = [pi.slot1.team?.seed, pi.slot2.team?.seed].sort();
    expect(seeds).toEqual([8, 9]);
  });

  it('has 7 teams with byes into WB Round 1 (seeds 1-7 directly seeded)', () => {
    const wbr1 = nonReset.filter((m) => m.section === 'winners' && m.round === 0);
    expect(wbr1.length).toBe(4); // 8-team WBR1

    // Count directly seeded slots (no sourceMatchId)
    let directSeeds = 0;
    for (const m of wbr1) {
      if (!m.slot1.sourceMatchId) directSeeds++;
      if (!m.slot2.sourceMatchId) directSeeds++;
    }
    // 7 direct seeds + 1 slot from play-in winner = 8 total slots, 7 direct
    expect(directSeeds).toBe(7);
  });

  it('WB Round 1 has 4 matches (clean 8-team structure)', () => {
    const r1 = nonReset.filter((m) => m.section === 'winners' && m.round === 0);
    expect(r1.length).toBe(4);
  });

  it('has 16 schedulable matches', () => {
    expect(nonReset.length).toBe(16);
  });

  it('match duration is 12 minutes', () => {
    expect(getMatchDuration(9)).toBe(12);
  });

  it('every team plays at least 2 matches (min-path simulation)', () => {
    const counts = countGamesPerTeam(matches, teams);
    for (const [teamId, count] of counts) {
      expect(count, `${teamId} played ${count} times`).toBeGreaterThanOrEqual(2);
    }
  });

  it('LBR1 has 2 matches (5 teams → 2 matches + 1 bye)', () => {
    const r = nonReset.filter((m) => m.section === 'losers' && m.round === 0);
    expect(r.length).toBe(2);
  });

  it('play-in loser enters LBR1', () => {
    const lbr1 = nonReset.filter((m) => m.section === 'losers' && m.round === 0);
    const piLoserRef = lbr1.some(
      (m) =>
        m.slot1.sourceMatchId === 'pi' ||
        m.slot2.sourceMatchId === 'pi',
    );
    expect(piLoserRef).toBe(true);
  });

  it('GF reset exists but inactive', () => {
    const reset = matches.find((m) => m.isResetMatch)!;
    expect(reset.resetActive).toBe(false);
  });
});

// ─── 10-team tests ───────────────────────────────────────────────────────────

describe('10-team bracket', () => {
  const teams = makeTeams(10);
  const matches = generateBracket(teams);
  const nonReset = matches.filter((m) => !m.isResetMatch);

  it('has exactly 2 play-in matches', () => {
    const playins = nonReset.filter((m) => m.round === -1);
    expect(playins.length).toBe(2);
  });

  it('play-in A involves seeds 9 and 10', () => {
    const piA = matches.find((m) => m.id === 'pi_a')!;
    const seeds = [piA.slot1.team?.seed, piA.slot2.team?.seed].sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(seeds).toEqual([9, 10]);
  });

  it('play-in B involves seeds 7 and 8', () => {
    const piB = matches.find((m) => m.id === 'pi_b')!;
    const seeds = [piB.slot1.team?.seed, piB.slot2.team?.seed].sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(seeds).toEqual([7, 8]);
  });

  it('has 6 teams with byes into WB Round 1 (seeds 1-6 directly seeded)', () => {
    const wbr1 = nonReset.filter((m) => m.section === 'winners' && m.round === 0);
    let directSeeds = 0;
    for (const m of wbr1) {
      if (!m.slot1.sourceMatchId) directSeeds++;
      if (!m.slot2.sourceMatchId) directSeeds++;
    }
    expect(directSeeds).toBe(6);
  });

  it('WB Round 1 has 4 matches (clean 8-team structure)', () => {
    const r1 = nonReset.filter((m) => m.section === 'winners' && m.round === 0);
    expect(r1.length).toBe(4);
  });

  it('has 18 schedulable matches', () => {
    expect(nonReset.length).toBe(18);
  });

  it('match duration is 11 minutes', () => {
    expect(getMatchDuration(10)).toBe(11);
  });

  it('every team plays at least 2 matches (min-path simulation)', () => {
    const counts = countGamesPerTeam(matches, teams);
    for (const [teamId, count] of counts) {
      expect(count, `${teamId} played ${count} times`).toBeGreaterThanOrEqual(2);
    }
  });

  it('LBR1 has 3 matches (6 teams → 3 matches)', () => {
    const r = nonReset.filter((m) => m.section === 'losers' && m.round === 0);
    expect(r.length).toBe(3);
  });

  it('both play-in losers enter LBR1', () => {
    const lbr1 = nonReset.filter((m) => m.section === 'losers' && m.round === 0);
    const piARef = lbr1.some((m) =>
      m.slot1.sourceMatchId === 'pi_a' || m.slot2.sourceMatchId === 'pi_a'
    );
    const piBRef = lbr1.some((m) =>
      m.slot1.sourceMatchId === 'pi_b' || m.slot2.sourceMatchId === 'pi_b'
    );
    expect(piARef).toBe(true);
    expect(piBRef).toBe(true);
  });
});

// ─── Bracket structure invariants ────────────────────────────────────────────

describe('bracket structural invariants', () => {
  for (const n of [8, 9, 10]) {
    describe(`${n} teams`, () => {
      const teams = makeTeams(n);
      const matches = generateBracket(teams);
      const nonReset = matches.filter((m) => !m.isResetMatch);

      it('every non-reset match has a unique id', () => {
        const ids = nonReset.map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('every source reference points to a real match', () => {
        const byId = new Set(matches.map((m) => m.id));
        for (const m of matches) {
          if (m.slot1.sourceMatchId) expect(byId.has(m.slot1.sourceMatchId)).toBe(true);
          if (m.slot2.sourceMatchId) expect(byId.has(m.slot2.sourceMatchId)).toBe(true);
        }
      });

      it('every winnerTo/loserTo destination points to a real match', () => {
        const byId = new Set(matches.map((m) => m.id));
        for (const m of matches) {
          if (m.winnerTo) expect(byId.has(m.winnerTo.matchId)).toBe(true);
          if (m.loserTo) expect(byId.has(m.loserTo.matchId)).toBe(true);
        }
      });

      it('Grand Final exists exactly once (not counting reset)', () => {
        const gf = nonReset.filter((m) => m.section === 'grand_final');
        expect(gf.length).toBe(1);
      });
    });
  }
});
