import { ref, set, onValue, off, get, type DataSnapshot } from 'firebase/database';
import { db } from '../firebase';
import type { Tournament } from '../types/tournament';

// ─── Serialization ─────────────────────────────────────────────────────────
// Firebase cannot store JS Date objects, so we convert to/from ISO strings.

interface FirebasePayload {
  name: string;
  startTimeISO: string;
  numTeams: number;
  matchDurationMinutes: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teams: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matches: any;
  lastUpdated: number;
}

function serialize(name: string, t: Tournament): FirebasePayload {
  return {
    name,
    startTimeISO: t.startTime.toISOString(),
    numTeams: t.numTeams,
    matchDurationMinutes: t.matchDurationMinutes,
    teams: JSON.parse(JSON.stringify(t.teams)),
    matches: JSON.parse(JSON.stringify(t.matches)),
    lastUpdated: Date.now(),
  };
}

function deserialize(raw: FirebasePayload): { name: string; tournament: Tournament } {
  return {
    name: raw.name,
    tournament: {
      numTeams: raw.numTeams,
      matchDurationMinutes: raw.matchDurationMinutes,
      startTime: new Date(raw.startTimeISO),
      teams: raw.teams as Tournament['teams'],
      matches: raw.matches as Tournament['matches'],
    },
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Publish (or overwrite) a tournament to Firebase at tournaments/{slug}. */
export async function pushTournament(
  slug: string,
  name: string,
  tournament: Tournament,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  await set(ref(db, `tournaments/${slug}`), serialize(name, tournament));
}

/**
 * Subscribe to real-time updates for a slug.
 * Calls onData immediately with the current value, then on every change.
 * Returns an unsubscribe function.
 */
export function subscribeTournament(
  slug: string,
  onData: (data: { name: string; tournament: Tournament } | null) => void,
): () => void {
  if (!db) {
    onData(null);
    return () => {};
  }
  const r = ref(db, `tournaments/${slug}`);
  const handler = (snap: DataSnapshot) => {
    const val = snap.val() as FirebasePayload | null;
    if (!val) { onData(null); return; }
    try { onData(deserialize(val)); } catch { onData(null); }
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

/** Returns true if the slug already exists in Firebase. */
export async function isSlugTaken(slug: string): Promise<boolean> {
  if (!db) return false;
  const snap = await get(ref(db, `tournaments/${slug}`));
  return snap.exists();
}
