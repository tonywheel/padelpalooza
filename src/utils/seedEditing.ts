import type { Match, Team, TeamSlot, Tournament } from '../types/tournament';

export interface SeedSlotRef {
  matchId: string;
  slot: 1 | 2;
}

function slotKey(ref: SeedSlotRef): string {
  return `${ref.matchId}:${ref.slot}`;
}

function getSlot(match: Match, slot: 1 | 2): TeamSlot {
  return slot === 1 ? match.slot1 : match.slot2;
}

function setSlot(match: Match, slot: 1 | 2, value: TeamSlot): void {
  if (slot === 1) match.slot1 = value;
  else match.slot2 = value;
}

/** True when seeding edits are disallowed. */
export function isSeedingLocked(tournament: Tournament | null, isLive: boolean): boolean {
  if (!tournament) return true;
  if (isLive) return true;
  return tournament.matches.some((m) => m.status === 'completed');
}

/** Direct-seed slots in winners Play-In (round -1) and WB R1 (round 0). */
export function isSwappableSlot(match: Match, slot: 1 | 2): boolean {
  if (match.section !== 'winners') return false;
  if (match.round > 0) return false;
  if (match.status === 'completed') return false;
  const s = getSlot(match, slot);
  return s.sourceMatchId === null && s.team !== null;
}

export function getSwappableSlots(matches: Match[]): SeedSlotRef[] {
  const refs: SeedSlotRef[] = [];
  for (const m of matches) {
    if (m.section !== 'winners' || m.round > 0) continue;
    for (const slot of [1, 2] as const) {
      if (isSwappableSlot(m, slot)) refs.push({ matchId: m.id, slot });
    }
  }
  return refs;
}

/** Non-swappable TBD slots in WB R1 (play-in winner placeholders). */
export function getTbdSlots(matches: Match[]): { match: Match; slot: 1 | 2 }[] {
  const out: { match: Match; slot: 1 | 2 }[] = [];
  for (const m of matches) {
    if (m.section !== 'winners' || m.round !== 0) continue;
    for (const slot of [1, 2] as const) {
      const s = getSlot(m, slot);
      if (s.sourceMatchId !== null) out.push({ match: m, slot });
    }
  }
  return out;
}

export function getSlotLabel(match: Match, slot: 1 | 2): string {
  const pos = slot === 1 ? 'Top' : 'Bottom';
  if (match.round === -1) return `${match.label} · ${pos}`;
  return `${match.label} · ${pos}`;
}

function recomputeMatchStatus(match: Match): void {
  if (match.status === 'completed') return;
  const hasBoth =
    getSlot(match, 1).team !== null &&
    (getSlot(match, 2).team !== null || getSlot(match, 2).sourceMatchId !== null);
  const bothTeams =
    getSlot(match, 1).team !== null && getSlot(match, 2).team !== null;
  if (bothTeams) match.status = 'ready';
  else if (!hasBoth) match.status = 'pending';
}

export function canSwapSlots(
  matches: Match[],
  from: SeedSlotRef,
  to: SeedSlotRef,
  seedingLocked: boolean,
): boolean {
  if (seedingLocked) return false;
  if (slotKey(from) === slotKey(to)) return false;

  const byId = new Map(matches.map((m) => [m.id, m]));
  const fromMatch = byId.get(from.matchId);
  const toMatch = byId.get(to.matchId);
  if (!fromMatch || !toMatch) return false;

  return isSwappableSlot(fromMatch, from.slot) && isSwappableSlot(toMatch, to.slot);
}

/** Swap teams between two direct-seed slots; returns new matches array. */
export function swapSeedSlots(
  matches: Match[],
  from: SeedSlotRef,
  to: SeedSlotRef,
): Match[] {
  const next = matches.map((m) => ({
    ...m,
    slot1: { ...m.slot1 },
    slot2: { ...m.slot2 },
  }));
  const byId = new Map(next.map((m) => [m.id, m]));

  const fromMatch = byId.get(from.matchId)!;
  const toMatch = byId.get(to.matchId)!;

  const fromTeam = getSlot(fromMatch, from.slot).team;
  const toTeam = getSlot(toMatch, to.slot).team;

  setSlot(fromMatch, from.slot, { ...getSlot(fromMatch, from.slot), team: toTeam });
  setSlot(toMatch, to.slot, { ...getSlot(toMatch, to.slot), team: fromTeam });

  recomputeMatchStatus(fromMatch);
  recomputeMatchStatus(toMatch);

  return next;
}

/** All teams currently placed in swappable slots. */
export function getPlacedTeams(matches: Match[]): Team[] {
  return getSwappableSlots(matches)
    .map((ref) => {
      const m = matches.find((x) => x.id === ref.matchId)!;
      return getSlot(m, ref.slot).team!;
    });
}
