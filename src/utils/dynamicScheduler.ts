import type { Match } from '../types/tournament';
import { getCourtQueues, getScheduleOrder } from './courtScheduler';

/** Effective end time used for dependency and court chaining. */
export function getEffectiveEnd(match: Match): number {
  if (match.completedAtMinute != null) {
    return match.completedAtMinute;
  }
  return match.endMinute;
}

function getDependencyEnd(match: Match, byId: Map<string, Match>): number {
  let max = 0;
  for (const slot of [match.slot1, match.slot2]) {
    if (!slot.sourceMatchId) continue;
    const src = byId.get(slot.sourceMatchId);
    if (src) max = Math.max(max, getEffectiveEnd(src));
  }
  return max;
}

function getCourtPreviousEnd(
  match: Match,
  courtQueues: { court1: string[]; court2: string[] },
  byId: Map<string, Match>,
): number {
  const queue = match.courtNumber === 1 ? courtQueues.court1 : courtQueues.court2;
  const idx = queue.indexOf(match.id);
  if (idx <= 0) return 0;
  const prev = byId.get(queue[idx - 1]!);
  return prev ? getEffectiveEnd(prev) : 0;
}

/**
 * Recomputes startMinute/endMinute for all incomplete, scheduled matches
 * based on actual completion times and bracket dependencies.
 * Completed matches are left unchanged (except completedAtMinute/endMinute set at completion).
 */
export function recomputeSchedule(
  matches: Match[],
  numTeams: number,
  durationMin: number,
): Match[] {
  const order = getScheduleOrder(numTeams);
  if (!order.length) return matches;

  const courtQueues = getCourtQueues(numTeams);
  const byId = new Map(matches.map((m) => [m.id, m]));

  for (const matchId of order) {
    const match = byId.get(matchId);
    if (!match || match.isResetMatch) continue;
    if (match.status === 'completed') continue;

    const start = Math.max(
      getCourtPreviousEnd(match, courtQueues, byId),
      getDependencyEnd(match, byId),
    );
    match.startMinute = start;
    match.endMinute = start + durationMin;
  }

  // Bracket-reset grand final (not in static schedule table)
  for (const match of matches) {
    if (!match.isResetMatch || !match.resetActive || match.status === 'completed') continue;
    match.courtNumber = 1;
    const court1End = courtQueues.court1.reduce((max, id) => {
      const m = byId.get(id);
      return m ? Math.max(max, getEffectiveEnd(m)) : max;
    }, 0);
    const start = Math.max(court1End, getDependencyEnd(match, byId));
    match.startMinute = start;
    match.endMinute = start + durationMin;
  }

  return matches;
}

/** True if every prior match on this court has finished. */
export function isCourtQueueReady(match: Match, matches: Match[], numTeams: number): boolean {
  const courtQueues = getCourtQueues(numTeams);
  const queue = match.courtNumber === 1 ? courtQueues.court1 : courtQueues.court2;
  const idx = queue.indexOf(match.id);
  if (idx <= 0) return true;
  const byId = new Map(matches.map((m) => [m.id, m]));
  for (let i = 0; i < idx; i++) {
    const prev = byId.get(queue[i]!);
    if (prev && prev.status !== 'completed') return false;
  }
  return true;
}

/** Earliest minute this match could realistically finish (started + deps + court queue). */
export function getEarliestFinishMinute(
  match: Match,
  matches: Match[],
  numTeams: number,
): number {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const courtQueues = getCourtQueues(numTeams);
  const courtPrev = getCourtPreviousEnd(match, courtQueues, byId);
  const dep = getDependencyEnd(match, byId);
  return Math.max(match.startMinute, courtPrev, dep);
}

/**
 * Marks a match complete at the given minute and reschedules all remaining matches.
 * @param completedAtMinute minutes from tournament start (wall-clock when recorded live)
 */
export function completeMatchAndReschedule(
  matches: Match[],
  matchId: string,
  numTeams: number,
  durationMin: number,
  completedAtMinute: number,
): Match[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const match = byId.get(matchId);
  if (!match || match.status === 'completed') return matches;

  const earliest = getEarliestFinishMinute(match, matches, numTeams);
  match.status = 'completed';
  match.completedAtMinute = Math.max(completedAtMinute, earliest);
  match.endMinute = match.completedAtMinute;

  return recomputeSchedule(matches, numTeams, durationMin);
}
