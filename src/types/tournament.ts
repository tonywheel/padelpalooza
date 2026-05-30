export type BracketSection = 'winners' | 'losers' | 'grand_final';
export type MatchStatus = 'pending' | 'ready' | 'completed' | 'bye';
export type AppPhase = 'setup' | 'tournament' | 'complete';
export type ActiveTab = 'bracket' | 'schedule' | 'seeding';

export interface Team {
  id: string;
  name: string;
  seed: number;
}

export interface TeamSlot {
  team: Team | null;
  /** ID of the match that produces this team, null = direct seeding */
  sourceMatchId: string | null;
  sourceOutcome: 'winner' | 'loser' | null;
}

export interface Match {
  id: string;
  /** Human-readable label, e.g. "WB R1 · M1" */
  label: string;
  section: BracketSection;
  /** 0-based round index within the section */
  round: number;
  /** 0-based position within the round */
  matchIndex: number;

  slot1: TeamSlot;
  slot2: TeamSlot;
  winner: Team | null;
  loser: Team | null;
  status: MatchStatus;

  /** Where winner advances to */
  winnerTo: { matchId: string; slot: 1 | 2 } | null;
  /** Where loser drops to (null = eliminated) */
  loserTo: { matchId: string; slot: 1 | 2 } | null;

  /** Pixel position for bracket canvas */
  visualX: number;
  visualY: number;

  /** Court scheduling */
  courtNumber: 1 | 2;
  /** Minutes from tournament start (updated dynamically) */
  startMinute: number;
  endMinute: number;
  /** Actual finish time when completed (drives rescheduling of later matches) */
  completedAtMinute?: number;

  /** Grand-final bracket-reset flag */
  isResetMatch: boolean;
  /** Whether reset match has been activated by the user */
  resetActive: boolean;
}

export interface Tournament {
  numTeams: number;
  teams: Team[];
  matches: Match[];
  matchDurationMinutes: number;
  startTime: Date;
}

export interface CanvasDimensions {
  width: number;
  height: number;
}
