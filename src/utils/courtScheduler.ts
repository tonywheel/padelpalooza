import type { Match } from '../types/tournament';

/**
 * Assigns courtNumber, startMinute, and endMinute to every non-reset match.
 *
 * Rules:
 *  - 2 courts (Court 1 and Court 2).
 *  - Total window: 120 minutes.
 *  - Court 2 must be FREE for the last 30 minutes, so the last match on
 *    Court 2 must END by minute 90 (i.e. startMinute ≤ 90 - duration).
 *  - Matches are scheduled greedily in dependency order.
 *  - A match is "schedulable" when all its source matches are completed
 *    (at the time we plan they will be done = their endMinute).
 *
 * Pre-computed schedules (validated by tests):
 *
 *  8 teams, d=15 min, 14 matches:
 *   Slot 0 (T0-15):   C1=wbr1m1, C2=wbr1m2
 *   Slot 1 (T15-30):  C1=wbr1m3, C2=wbr1m4
 *   Slot 2 (T30-45):  C1=wbr2m1, C2=wbr2m2
 *   Slot 3 (T45-60):  C1=lbr1m1, C2=lbr1m2
 *   Slot 4 (T60-75):  C1=lbr2m1, C2=lbr2m2
 *   Slot 5 (T75-90):  C1=wbf,    C2=lb_semis   ← Court 2 ends at 90 ✓
 *   Slot 6 (T90-105): C1=lb_finals, C2=FREE
 *   Slot 7 (T105-120):C1=gf,       C2=FREE
 *
 *  9 teams, d=12 min, 16 matches:
 *   T0-12:   C1=pi,     C2=wbr1m2
 *   T12-24:  C1=wbr1m1, C2=wbr1m3
 *   T24-36:  C1=wbr1m4, C2=wbr2m1(needs m1@24,m2@12 ✓)
 *   T36-48:  C1=wbr2m2, C2=lbr1m0 (needs pi@12✓,wbr1m1@24✓)
 *   T48-60:  C1=lbr1m1, C2=wbf    (wbf needs wbr2m1@36✓,wbr2m2@48✓—delayed to 60 is ok)
 *   T60-72:  C1=lbr2m0, C2=lbr2m1
 *   T72-84:  C1=lb_semi1,C2=lb_semi2  ← Court 2 ends at 84 ✓ (36 min free)
 *   T84-96:  C1=lb_finals,C2=FREE
 *   T96-108: C1=gf,       C2=FREE
 *
 * 10 teams, d=11 min, 18 matches:
 *   T0-11:   C1=pi_a, C2=pi_b
 *   T11-22:  C1=wbr1m1, C2=wbr1m2
 *   T22-33:  C1=wbr1m3, C2=wbr1m4
 *   T33-44:  C1=wbr2m1, C2=wbr2m2
 *   T44-55:  C1=lbr1m0, C2=lbr1m1
 *   T55-66:  C1=lbr1m2, C2=wbf
 *   T66-77:  C1=lbr2m0, C2=lbr2m1
 *   T77-88:  C1=lb_semi1, C2=lb_semi2  ← Court 2 ends at 88 ✓ (32 min free)
 *   T88-99:  C1=lb_finals, C2=FREE
 *   T99-110: C1=gf,        C2=FREE
 */

interface SlotAssignment {
  matchId: string;
  court: 1 | 2;
  startMinute: number;
}

const SCHEDULES: Record<number, SlotAssignment[]> = {
  8: [
    { matchId: 'wbr1m1',   court: 1, startMinute: 0   },
    { matchId: 'wbr1m2',   court: 2, startMinute: 0   },
    { matchId: 'wbr1m3',   court: 1, startMinute: 15  },
    { matchId: 'wbr1m4',   court: 2, startMinute: 15  },
    { matchId: 'wbr2m1',   court: 1, startMinute: 30  },
    { matchId: 'wbr2m2',   court: 2, startMinute: 30  },
    { matchId: 'lbr1m1',   court: 1, startMinute: 45  },
    { matchId: 'lbr1m2',   court: 2, startMinute: 45  },
    { matchId: 'lbr2m1',   court: 1, startMinute: 60  },
    { matchId: 'lbr2m2',   court: 2, startMinute: 60  },
    { matchId: 'wbf',      court: 1, startMinute: 75  },
    { matchId: 'lb_semis', court: 2, startMinute: 75  },
    { matchId: 'lb_finals',court: 1, startMinute: 90  },
    { matchId: 'gf',       court: 1, startMinute: 105 },
  ],
  9: [
    { matchId: 'pi',       court: 1, startMinute: 0   },
    { matchId: 'wbr1m2',   court: 2, startMinute: 0   },
    { matchId: 'wbr1m1',   court: 1, startMinute: 12  },
    { matchId: 'wbr1m3',   court: 2, startMinute: 12  },
    { matchId: 'wbr1m4',   court: 1, startMinute: 24  },
    { matchId: 'wbr2m1',   court: 2, startMinute: 24  },
    { matchId: 'wbr2m2',   court: 1, startMinute: 36  },
    { matchId: 'lbr1m0',   court: 2, startMinute: 36  },
    { matchId: 'lbr1m1',   court: 1, startMinute: 48  },
    { matchId: 'wbf',      court: 2, startMinute: 48  },
    { matchId: 'lbr2m0',   court: 1, startMinute: 60  },
    { matchId: 'lbr2m1',   court: 2, startMinute: 60  },
    { matchId: 'lb_semi1', court: 1, startMinute: 72  },
    { matchId: 'lb_semi2', court: 2, startMinute: 72  },
    { matchId: 'lb_finals',court: 1, startMinute: 84  },
    { matchId: 'gf',       court: 1, startMinute: 96  },
  ],
  10: [
    { matchId: 'pi_a',     court: 1, startMinute: 0   },
    { matchId: 'pi_b',     court: 2, startMinute: 0   },
    { matchId: 'wbr1m1',   court: 1, startMinute: 11  },
    { matchId: 'wbr1m2',   court: 2, startMinute: 11  },
    { matchId: 'wbr1m3',   court: 1, startMinute: 22  },
    { matchId: 'wbr1m4',   court: 2, startMinute: 22  },
    { matchId: 'wbr2m1',   court: 1, startMinute: 33  },
    { matchId: 'wbr2m2',   court: 2, startMinute: 33  },
    { matchId: 'lbr1m0',   court: 1, startMinute: 44  },
    { matchId: 'lbr1m1',   court: 2, startMinute: 44  },
    { matchId: 'lbr1m2',   court: 1, startMinute: 55  },
    { matchId: 'wbf',      court: 2, startMinute: 55  },
    { matchId: 'lbr2m0',   court: 1, startMinute: 66  },
    { matchId: 'lbr2m1',   court: 2, startMinute: 66  },
    { matchId: 'lb_semi1', court: 1, startMinute: 77  },
    { matchId: 'lb_semi2', court: 2, startMinute: 77  },
    { matchId: 'lb_finals',court: 1, startMinute: 88  },
    { matchId: 'gf',       court: 1, startMinute: 99  },
  ],
};

export function scheduleCourts(matches: Match[], numTeams: number, durationMin: number): Match[] {
  const schedule = SCHEDULES[numTeams];
  if (!schedule) return matches;

  const byId = new Map(matches.map((m) => [m.id, m]));

  for (const slot of schedule) {
    const match = byId.get(slot.matchId);
    if (!match) continue;
    match.courtNumber = slot.court;
    match.startMinute = slot.startMinute;
    match.endMinute = slot.startMinute + durationMin;
  }

  return matches;
}

/** Converts a minute offset to a wall-clock time string, e.g. "2:15 PM" */
export function minutesToTime(startTime: Date, offsetMinutes: number): string {
  const d = new Date(startTime.getTime() + offsetMinutes * 60_000);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Returns true if the given match has a valid schedule slot assigned. */
export function isScheduled(match: Match): boolean {
  return match.startMinute !== 0 || match.endMinute !== 0;
}
