export interface PlayerPair {
  player1: string;
  player2: string;
}

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

/**
 * Randomly pairs players into teams of 2.
 * Requires an even count of non-empty unique names.
 */
export function pairPlayersIntoTeams(
  playerNames: string[],
  rng: () => number = Math.random,
): PlayerPair[] {
  const players = playerNames.map((n) => n.trim()).filter(Boolean);
  if (players.length % 2 !== 0) {
    throw new Error('Player count must be even');
  }
  if (new Set(players.map((p) => p.toLowerCase())).size !== players.length) {
    throw new Error('Player names must be unique');
  }

  const shuffled = shuffle(players, rng);
  const pairs: PlayerPair[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push({ player1: shuffled[i]!, player2: shuffled[i + 1]! });
  }
  return pairs;
}

/** Converts pairs to bracket team name strings. */
export function pairsToTeamNames(pairs: PlayerPair[]): string[] {
  return pairs.map((p) => formatTeamName(p.player1, p.player2));
}

/** Full pipeline: shuffle players → team names. */
export function generateRandomTeams(
  playerNames: string[],
  rng: () => number = Math.random,
): string[] {
  return pairsToTeamNames(pairPlayersIntoTeams(playerNames, rng));
}
