export interface PlayerPair {
  player1: string;
  player2: string;
}

export type Gender = 'boy' | 'girl';

/** Formats a pair as "PlayerOne-PlayerTwo". */
export function formatTeamName(player1: string, player2: string): string {
  return `${player1.trim()}-${player2.trim()}`;
}

/** Fisher–Yates shuffle (mutates copy). Optional rng for tests: returns [0, 1). */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function normalize(names: string[]): string[] {
  return names.map((n) => n.trim()).filter(Boolean);
}

function assertUnique(all: string[]): void {
  if (new Set(all.map((p) => p.toLowerCase())).size !== all.length) {
    throw new Error('Player names must be unique');
  }
}

/**
 * Pairs boys and girls into teams, maximizing boy/girl teams.
 * Leftover players of one gender are paired together (requires even excess).
 */
export function pairPlayersByGender(
  boyNames: string[],
  girlNames: string[],
  rng: () => number = Math.random,
): PlayerPair[] {
  const boys = shuffle(normalize(boyNames), rng);
  const girls = shuffle(normalize(girlNames), rng);
  const all = [...boys, ...girls];

  if (all.length % 2 !== 0) {
    throw new Error('Total player count must be even');
  }
  assertUnique(all);

  const boysQueue = [...boys];
  const girlsQueue = [...girls];
  const pairs: PlayerPair[] = [];

  // Boy/girl teams first
  while (boysQueue.length > 0 && girlsQueue.length > 0) {
    pairs.push({
      player1: boysQueue.pop()!,
      player2: girlsQueue.pop()!,
    });
  }

  // Same-gender teams for the remainder (at most one gender has leftovers)
  const remainder = boysQueue.length > 0 ? boysQueue : girlsQueue;
  while (remainder.length >= 2) {
    pairs.push({
      player1: remainder.pop()!,
      player2: remainder.pop()!,
    });
  }

  if (remainder.length === 1) {
    throw new Error('Cannot pair remaining solo player');
  }

  return shuffle(pairs, rng);
}

/** Converts pairs to bracket team name strings. */
export function pairsToTeamNames(pairs: PlayerPair[]): string[] {
  return pairs.map((p) => formatTeamName(p.player1, p.player2));
}

/** Gender-aware pipeline: boys + girls → shuffled team names. */
export function generateGenderAwareTeams(
  boyNames: string[],
  girlNames: string[],
  rng: () => number = Math.random,
): string[] {
  return pairsToTeamNames(pairPlayersByGender(boyNames, girlNames, rng));
}

/**
 * @deprecated Use generateGenderAwareTeams. Kept for backwards compatibility in tests.
 */
export function pairPlayersIntoTeams(
  playerNames: string[],
  rng: () => number = Math.random,
): PlayerPair[] {
  const players = normalize(playerNames);
  if (players.length % 2 !== 0) {
    throw new Error('Player count must be even');
  }
  assertUnique(players);
  const shuffled = shuffle(players, rng);
  const pairs: PlayerPair[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push({ player1: shuffled[i]!, player2: shuffled[i + 1]! });
  }
  return pairs;
}

export function generateRandomTeams(
  playerNames: string[],
  rng: () => number = Math.random,
): string[] {
  return pairsToTeamNames(pairPlayersIntoTeams(playerNames, rng));
}

/** Classify pairs for tests. */
export function classifyPairs(
  pairs: PlayerPair[],
  boys: string[],
  girls: string[],
): { mixed: number; boyBoy: number; girlGirl: number } {
  const boySet = new Set(boys.map((b) => b.toLowerCase()));
  const girlSet = new Set(girls.map((g) => g.toLowerCase()));
  let mixed = 0;
  let boyBoy = 0;
  let girlGirl = 0;
  for (const { player1, player2 } of pairs) {
    const p1Boy = boySet.has(player1.toLowerCase());
    const p1Girl = girlSet.has(player1.toLowerCase());
    const p2Boy = boySet.has(player2.toLowerCase());
    const p2Girl = girlSet.has(player2.toLowerCase());
    if ((p1Boy && p2Girl) || (p1Girl && p2Boy)) mixed++;
    else if (p1Boy && p2Boy) boyBoy++;
    else girlGirl++;
  }
  return { mixed, boyBoy, girlGirl };
}

/** Expected mixed / same-gender split for a given boy/girl count. */
export function expectedPairSplit(boyCount: number, girlCount: number) {
  const mixed = Math.min(boyCount, girlCount);
  const excess = Math.abs(boyCount - girlCount);
  const sameGender = excess / 2;
  return { mixed, boyBoy: boyCount > girlCount ? sameGender : 0, girlGirl: girlCount > boyCount ? sameGender : 0 };
}
