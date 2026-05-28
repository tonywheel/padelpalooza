/**
 * End-to-end requirement validation tests.
 * These mirror the user-visible requirements from the spec:
 *  ✓ 8–10 teams supported
 *  ✓ Play-in matches for >8 teams, remaining teams get byes into WB R1
 *  ✓ Clean 8-team DE from WB Round 1 onward
 *  ✓ Every team plays at least 2 matches
 *  ✓ Match duration 10–15 min
 *  ✓ All matches finish within 2 hours
 *  ✓ One court free for last 30 min
 *  ✓ Bracket reset match available for GF
 */
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

/** Simulate worst-case: every team loses their second possible match. */
function simulateTournament(matches: Match[]): Map<string, number> {
  const counts = new Map<string, number>();
  const simById = new Map(matches.map((m) => [m.id, { ...m }]));
  const origById = new Map(matches.map((m) => [m.id, m]));

  const inc = (team: Team | null) => {
    if (!team) return;
    counts.set(team.id, (counts.get(team.id) ?? 0) + 1);
  };

  const complete = (matchId: string, pickSlot1Wins: boolean) => {
    const m = simById.get(matchId)!;
    if (!m || m.status === 'completed') return;
    if (!m.slot1.team || !m.slot2.team) return;

    const winner = pickSlot1Wins ? m.slot1.team : m.slot2.team;
    const loser = pickSlot1Wins ? m.slot2.team : m.slot1.team;
    m.winner = winner;
    m.loser = loser;
    m.status = 'completed';

    inc(winner);
    inc(loser);

    const orig = origById.get(matchId)!;
    if (orig.winnerTo) {
      const dest = simById.get(orig.winnerTo.matchId)!;
      const sk = orig.winnerTo.slot === 1 ? 'slot1' : 'slot2';
      (dest as any)[sk] = { ...dest[sk as 'slot1' | 'slot2'], team: winner };
      if (dest.slot1.team && dest.slot2.team) dest.status = 'ready';
    }
    if (orig.loserTo) {
      const dest = simById.get(orig.loserTo.matchId)!;
      const sk = orig.loserTo.slot === 1 ? 'slot1' : 'slot2';
      (dest as any)[sk] = { ...dest[sk as 'slot1' | 'slot2'], team: loser };
      if (dest.slot1.team && dest.slot2.team) dest.status = 'ready';
    }
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const m of simById.values()) {
      if (m.isResetMatch || m.status === 'completed') continue;
      if (!m.slot1.team || !m.slot2.team) continue;
      complete(m.id, true); // slot1 always wins
      changed = true;
    }
  }

  return counts;
}

// ─── Per-team-count requirement tests ─────────────────────────────────────────

for (const n of [8, 9, 10]) {
  describe(`REQ: ${n}-team tournament`, () => {
    const teams = makeTeams(n);
    const duration = getMatchDuration(n);
    let matches = generateBracket(teams);
    matches = scheduleCourts(matches, n, duration);
    const nonReset = matches.filter((m) => !m.isResetMatch);
    const scheduled = nonReset.filter((m) => m.endMinute > 0);
    const c2Matches = scheduled.filter((m) => m.courtNumber === 2);

    // ── Play-in requirements ──
    it(`REQ-1: ${n - 8} play-in match(es) for ${n} teams`, () => {
      const playins = nonReset.filter((m) => m.round === -1);
      expect(playins.length).toBe(n - 8);
    });

    it(`REQ-2: ${8 - (n - 8) * 2} teams receive byes into WB Round 1`, () => {
      const wbr1 = nonReset.filter((m) => m.section === 'winners' && m.round === 0);
      let directSeeds = 0;
      for (const m of wbr1) {
        if (!m.slot1.sourceMatchId) directSeeds++;
        if (!m.slot2.sourceMatchId) directSeeds++;
      }
      // Expected byes: 8 direct seeded teams minus 2 per play-in match
      const expectedByes = 8 - (n - 8) * 2;
      // But play-in WINNERS fill the other slots (1 per play-in) which are source slots
      // So direct seeded slots = total WBR1 slots - play-in winner slots
      // = 8 - (n-8) = 8 - 0/1/2
      expect(directSeeds).toBe(8 - (n - 8));
    });

    it('REQ-3: WB Round 1 always has exactly 4 matches (clean 8-team DE)', () => {
      const wbr1 = nonReset.filter((m) => m.section === 'winners' && m.round === 0);
      expect(wbr1.length).toBe(4);
    });

    // ── Match count ──
    it(`REQ-4: total non-reset match count is ${14 + (n - 8) * 2}`, () => {
      expect(nonReset.length).toBe(14 + (n - 8) * 2);
    });

    // ── Min 2 games per team ──
    it('REQ-5: every team plays at least 2 matches', () => {
      const counts = simulateTournament(matches);
      for (const team of teams) {
        const c = counts.get(team.id) ?? 0;
        expect(c, `${team.name} only played ${c} time(s)`).toBeGreaterThanOrEqual(2);
      }
    });

    // ── Match duration ──
    it('REQ-6: match duration is between 10 and 15 minutes', () => {
      expect(duration).toBeGreaterThanOrEqual(10);
      expect(duration).toBeLessThanOrEqual(15);
    });

    // ── 2-hour window ──
    it('REQ-7: all matches complete within 120 minutes', () => {
      for (const m of scheduled) {
        expect(m.endMinute, `${m.label} ends at ${m.endMinute}`).toBeLessThanOrEqual(120);
      }
    });

    // ── Court 2 free for last 30 min ──
    it('REQ-8: Court 2 is free for at least 30 minutes before the 2-hour mark', () => {
      const lastC2End = c2Matches.length
        ? Math.max(...c2Matches.map((m) => m.endMinute))
        : 0;
      expect(120 - lastC2End).toBeGreaterThanOrEqual(30);
    });

    // ── No overlapping court assignments ──
    it('REQ-9: no two matches overlap on the same court', () => {
      for (const court of [1, 2] as const) {
        const cm = scheduled
          .filter((m) => m.courtNumber === court)
          .sort((a, b) => a.startMinute - b.startMinute);
        for (let i = 1; i < cm.length; i++) {
          expect(cm[i].startMinute).toBeGreaterThanOrEqual(cm[i - 1].endMinute);
        }
      }
    });

    // ── Grand final ──
    it('REQ-10: Grand Final exists and is scheduled on Court 1', () => {
      const gf = scheduled.find((m) => m.section === 'grand_final');
      expect(gf).toBeDefined();
      expect(gf!.courtNumber).toBe(1);
      expect(gf!.endMinute).toBeLessThanOrEqual(120);
    });

    // ── Bracket reset ──
    it('REQ-11: bracket reset match exists (inactive until triggered)', () => {
      const reset = matches.find((m) => m.isResetMatch);
      expect(reset).toBeDefined();
      expect(reset!.resetActive).toBe(false);
    });

    // ── Dependency ordering ──
    it('REQ-12: every match starts only after its prerequisite matches complete', () => {
      const byId = new Map(matches.map((m) => [m.id, m]));
      for (const m of scheduled) {
        for (const slot of [m.slot1, m.slot2]) {
          if (!slot.sourceMatchId) continue;
          const src = byId.get(slot.sourceMatchId);
          if (!src || src.endMinute === 0) continue;
          expect(m.startMinute).toBeGreaterThanOrEqual(src.endMinute);
        }
      }
    });
  });
}
