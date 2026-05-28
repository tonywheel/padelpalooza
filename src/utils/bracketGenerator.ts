import type { Match, Team, TeamSlot } from '../types/tournament';

// ─── Layout constants ────────────────────────────────────────────────────────
export const CARD_W = 148;
export const CARD_H = 60;
const H_GAP = 36; // horizontal gap between columns
const V_GAP = 12; // vertical gap between rows
const COL_W = CARD_W + H_GAP; // 184
const ROW_H = CARD_H + V_GAP; // 72
// Extra top padding so section labels (rendered at y≈4) never overlap match cards
const CANVAS_Y_PAD = 28;

/**
 * Returns match duration in minutes depending on team count.
 * Scaled so all required matches fit within the 2-hour window.
 *   8 teams → 14 scheduled matches → 15 min/match  (210 court-min ÷ 14 = 15)
 *   9 teams → 16 scheduled matches → 12 min/match  (16 matches fit with d=12)
 *  10 teams → 18 scheduled matches → 11 min/match  (18 matches fit with d=11)
 */
export function getMatchDuration(numTeams: number): number {
  if (numTeams <= 8) return 15;
  if (numTeams === 9) return 12;
  return 11;
}

// ─── Helper constructors ─────────────────────────────────────────────────────

function emptySlot(): TeamSlot {
  return { team: null, sourceMatchId: null, sourceOutcome: null };
}

function seededSlot(team: Team): TeamSlot {
  return { team, sourceMatchId: null, sourceOutcome: null };
}

function sourceSlot(matchId: string, outcome: 'winner' | 'loser'): TeamSlot {
  return { team: null, sourceMatchId: matchId, sourceOutcome: outcome };
}

function makeMatch(
  id: string,
  label: string,
  section: Match['section'],
  round: number,
  matchIndex: number,
  slot1: TeamSlot,
  slot2: TeamSlot,
  visualX: number,
  visualY: number,
): Match {
  const bothReady = slot1.team !== null && slot2.team !== null;
  return {
    id,
    label,
    section,
    round,
    matchIndex,
    slot1,
    slot2,
    winner: null,
    loser: null,
    status: bothReady ? 'ready' : 'pending',
    winnerTo: null,
    loserTo: null,
    visualX,
    visualY,
    courtNumber: 1,
    startMinute: 0,
    endMinute: 0,
    isResetMatch: false,
    resetActive: false,
  };
}

// ─── Position helpers ────────────────────────────────────────────────────────

/**
 * Y-center of a match in WB column 0 (WBR1) given its 0-based slot index.
 * Offset by CANVAS_Y_PAD so section labels rendered at y≈4 don't overlap.
 */
function wbR1Y(slot: number): number {
  return CANVAS_Y_PAD + slot * ROW_H;
}

/**
 * Centre Y of a WB match that combines two feeders at y1 and y2.
 * Places the card so its vertical centre aligns with the mid-point.
 */
function midY(y1: number, y2: number): number {
  return Math.round((y1 + y2) / 2);
}

// ─── Main generator ──────────────────────────────────────────────────────────

/**
 * Generates the full double-elimination bracket for 8, 9, or 10 teams.
 * Returns matches WITHOUT scheduling (court/time assignment).
 *
 * Structure per team count:
 *  8 teams: 0 play-ins → 8-team DE → 14 base matches
 *  9 teams: 1 play-in  → 8-team DE → 16 base matches
 * 10 teams: 2 play-ins → 8-team DE → 18 base matches
 */
export function generateBracket(teams: Team[]): Match[] {
  const n = teams.length;
  if (n < 8 || n > 10) throw new Error('Only 8–10 teams supported');

  if (n === 8) return generate8(teams);
  if (n === 9) return generate9(teams);
  return generate10(teams);
}

// ─── 8-Team bracket ──────────────────────────────────────────────────────────
// WB col x values (no play-in column):
//   WBR1 → col 0 (x=0)
//   WBR2 → col 1 (x=COL_W)
//   WBF  → col 2 (x=2*COL_W)
//   GF   → col 5 (x=5*COL_W)
//
// LB col x values (below WB):
//   LBR1 → col 1  (x=COL_W)      — parallel to WBR2
//   LBR2 → col 2  (x=2*COL_W)    — parallel to WBF
//   LBSemis  → col 3 (x=3*COL_W)
//   LBFinals → col 4 (x=4*COL_W)
//
// LB_Y0 = WBR1 total height + gap = 4*ROW_H + 40

function generate8(teams: Team[]): Match[] {
  const s = (i: number) => teams[i]; // seed index (0-based)
  const LB_Y0 = CANVAS_Y_PAD + 4 * ROW_H + 40;
  const WBcol = (c: number) => c * COL_W;
  const LBcol = (c: number) => c * COL_W;

  // ── WB Round 1 ──
  // Seeding: 1v8, 4v5, 2v7, 3v6  (0-indexed: 0v7, 3v4, 1v6, 2v5)
  const wbr1m1 = makeMatch('wbr1m1', 'WB R1 · M1', 'winners', 0, 0,
    seededSlot(s(0)), seededSlot(s(7)), WBcol(0), wbR1Y(0));

  const wbr1m2 = makeMatch('wbr1m2', 'WB R1 · M2', 'winners', 0, 1,
    seededSlot(s(3)), seededSlot(s(4)), WBcol(0), wbR1Y(1));

  const wbr1m3 = makeMatch('wbr1m3', 'WB R1 · M3', 'winners', 0, 2,
    seededSlot(s(1)), seededSlot(s(6)), WBcol(0), wbR1Y(2));

  const wbr1m4 = makeMatch('wbr1m4', 'WB R1 · M4', 'winners', 0, 3,
    seededSlot(s(2)), seededSlot(s(5)), WBcol(0), wbR1Y(3));

  // ── WB Round 2 ──
  const wbr2m1 = makeMatch('wbr2m1', 'WB R2 · M1', 'winners', 1, 0,
    sourceSlot('wbr1m1', 'winner'), sourceSlot('wbr1m2', 'winner'),
    WBcol(1), midY(wbR1Y(0), wbR1Y(1)));

  const wbr2m2 = makeMatch('wbr2m2', 'WB R2 · M2', 'winners', 1, 1,
    sourceSlot('wbr1m3', 'winner'), sourceSlot('wbr1m4', 'winner'),
    WBcol(1), midY(wbR1Y(2), wbR1Y(3)));

  // ── WB Finals ──
  const wbf = makeMatch('wbf', 'WB Finals', 'winners', 2, 0,
    sourceSlot('wbr2m1', 'winner'), sourceSlot('wbr2m2', 'winner'),
    WBcol(2), midY(wbr2m1.visualY, wbr2m2.visualY));

  // ── LB Round 1 ──
  // Cross-bracket pairings to minimise rematches:
  //   LBR1·M1: L(WBR1·M1) vs L(WBR1·M4)
  //   LBR1·M2: L(WBR1·M2) vs L(WBR1·M3)
  const lbr1m1 = makeMatch('lbr1m1', 'LB R1 · M1', 'losers', 0, 0,
    sourceSlot('wbr1m1', 'loser'), sourceSlot('wbr1m4', 'loser'),
    LBcol(1), LB_Y0);

  const lbr1m2 = makeMatch('lbr1m2', 'LB R1 · M2', 'losers', 0, 1,
    sourceSlot('wbr1m2', 'loser'), sourceSlot('wbr1m3', 'loser'),
    LBcol(1), LB_Y0 + ROW_H);

  // ── LB Round 2 ──
  const lbr2m1 = makeMatch('lbr2m1', 'LB R2 · M1', 'losers', 1, 0,
    sourceSlot('lbr1m1', 'winner'), sourceSlot('wbr2m1', 'loser'),
    LBcol(2), LB_Y0);

  const lbr2m2 = makeMatch('lbr2m2', 'LB R2 · M2', 'losers', 1, 1,
    sourceSlot('lbr1m2', 'winner'), sourceSlot('wbr2m2', 'loser'),
    LBcol(2), LB_Y0 + ROW_H);

  // ── LB Semis ──
  const lbSemis = makeMatch('lb_semis', 'LB Semis', 'losers', 2, 0,
    sourceSlot('lbr2m1', 'winner'), sourceSlot('lbr2m2', 'winner'),
    LBcol(3), midY(LB_Y0, LB_Y0 + ROW_H));

  // ── LB Finals ──
  const lbFinals = makeMatch('lb_finals', 'LB Finals', 'losers', 3, 0,
    sourceSlot('lb_semis', 'winner'), sourceSlot('wbf', 'loser'),
    LBcol(4), midY(LB_Y0, LB_Y0 + ROW_H));

  // ── Grand Finals ──
  const gfY = midY(wbf.visualY, lbFinals.visualY);
  const gf = makeMatch('gf', 'Grand Final', 'grand_final', 0, 0,
    sourceSlot('wbf', 'winner'), sourceSlot('lb_finals', 'winner'),
    LBcol(5), gfY);

  // Bracket reset (activated by user if LB champ wins GF)
  const gfReset = makeMatch('gf_reset', 'Grand Final · Reset', 'grand_final', 1, 0,
    emptySlot(), emptySlot(),
    LBcol(5), gfY + ROW_H + 8);
  gfReset.status = 'pending';
  gfReset.isResetMatch = true;

  // ── Wire up destinations ──
  const matches: Match[] = [
    wbr1m1, wbr1m2, wbr1m3, wbr1m4,
    wbr2m1, wbr2m2,
    wbf,
    lbr1m1, lbr1m2,
    lbr2m1, lbr2m2,
    lbSemis,
    lbFinals,
    gf,
    gfReset,
  ];

  wireDestinations(matches);
  return matches;
}

// ─── 9-Team bracket ──────────────────────────────────────────────────────────
// Play-in: S8 vs S9 → winner becomes WB seed 8, loser enters LBR1
//
// WB col x values (play-in at col 0):
//   PI   → col 0 (x=0)
//   WBR1 → col 1 (x=COL_W)
//   WBR2 → col 2 (x=2*COL_W)
//   WBF  → col 3 (x=3*COL_W)
//   GF   → col 6 (x=6*COL_W)
//
// LB col x values:
//   LBR1 → col 2 (x=2*COL_W)
//   LBR2 → col 3 (x=3*COL_W)
//   LBSemis  → col 4 (x=4*COL_W)
//   LBFinals → col 5 (x=5*COL_W)
//
// LBR1 has 5 teams (4 WBR1 losers + play-in loser):
//   lbr1m0: L(PI) vs L(WBR1·M1)  [play-in loser vs loser of match involving PI winner]
//   lbr1m1: L(WBR1·M2) vs L(WBR1·M3)
//   L(WBR1·M4): BYE → enters LBSemis directly
//
// LBR2 has 5 teams (W_lbr1m0, W_lbr1m1, L(WBR1·M4) bye + L_WBR2·M1, L_WBR2·M2):
//   lbr2m0: W(lbr1m0) vs L(WBR2·M1)
//   lbr2m1: W(lbr1m1) vs L(WBR2·M2)
//   L(WBR1·M4): BYE carries to LBSemis
//
// LBSemis (4 teams): W_lbr2m0, W_lbr2m1, L(WBR1·M4) bye, L(WBF)
//   lbsemi1: W(lbr2m0) vs L(WBR1·M4) [bye team gets match here]
//   lbsemi2: W(lbr2m1) vs L(WBF)
//
// LBFinals: W(lbsemi1) vs W(lbsemi2)

function generate9(teams: Team[]): Match[] {
  const s = (i: number) => teams[i];
  const LB_Y0 = CANVAS_Y_PAD + 4 * ROW_H + 40;
  const WBcol = (c: number) => c * COL_W;
  const LBcol = (c: number) => c * COL_W;

  // ── Play-in ──
  const pi = makeMatch('pi', 'Play-In', 'winners', -1, 0,
    seededSlot(s(7)), seededSlot(s(8)),
    WBcol(0), wbR1Y(0));
  pi.status = 'ready';

  // ── WB Round 1 (8 teams: seeds 1-7 + PI winner as seed 8) ──
  const wbr1m1 = makeMatch('wbr1m1', 'WB R1 · M1', 'winners', 0, 0,
    seededSlot(s(0)), sourceSlot('pi', 'winner'),
    WBcol(1), wbR1Y(0));

  const wbr1m2 = makeMatch('wbr1m2', 'WB R1 · M2', 'winners', 0, 1,
    seededSlot(s(3)), seededSlot(s(4)),
    WBcol(1), wbR1Y(1));

  const wbr1m3 = makeMatch('wbr1m3', 'WB R1 · M3', 'winners', 0, 2,
    seededSlot(s(1)), seededSlot(s(6)),
    WBcol(1), wbR1Y(2));

  const wbr1m4 = makeMatch('wbr1m4', 'WB R1 · M4', 'winners', 0, 3,
    seededSlot(s(2)), seededSlot(s(5)),
    WBcol(1), wbR1Y(3));

  // ── WB Round 2 ──
  const wbr2m1 = makeMatch('wbr2m1', 'WB R2 · M1', 'winners', 1, 0,
    sourceSlot('wbr1m1', 'winner'), sourceSlot('wbr1m2', 'winner'),
    WBcol(2), midY(wbR1Y(0), wbR1Y(1)));

  const wbr2m2 = makeMatch('wbr2m2', 'WB R2 · M2', 'winners', 1, 1,
    sourceSlot('wbr1m3', 'winner'), sourceSlot('wbr1m4', 'winner'),
    WBcol(2), midY(wbR1Y(2), wbR1Y(3)));

  // ── WB Finals ──
  const wbf = makeMatch('wbf', 'WB Finals', 'winners', 2, 0,
    sourceSlot('wbr2m1', 'winner'), sourceSlot('wbr2m2', 'winner'),
    WBcol(3), midY(wbr2m1.visualY, wbr2m2.visualY));

  // ── LB Round 1 (5 teams) ──
  const lbr1m0 = makeMatch('lbr1m0', 'LB R1 · M1', 'losers', 0, 0,
    sourceSlot('pi', 'loser'), sourceSlot('wbr1m1', 'loser'),
    LBcol(2), LB_Y0);

  const lbr1m1 = makeMatch('lbr1m1', 'LB R1 · M2', 'losers', 0, 1,
    sourceSlot('wbr1m2', 'loser'), sourceSlot('wbr1m3', 'loser'),
    LBcol(2), LB_Y0 + ROW_H);

  // L(wbr1m4) gets a BYE through LBR1 and LBR2, entering LBSemis.

  // ── LB Round 2 (5 teams) ──
  const lbr2m0 = makeMatch('lbr2m0', 'LB R2 · M1', 'losers', 1, 0,
    sourceSlot('lbr1m0', 'winner'), sourceSlot('wbr2m1', 'loser'),
    LBcol(3), LB_Y0);

  const lbr2m1 = makeMatch('lbr2m1', 'LB R2 · M2', 'losers', 1, 1,
    sourceSlot('lbr1m1', 'winner'), sourceSlot('wbr2m2', 'loser'),
    LBcol(3), LB_Y0 + ROW_H);

  // ── LB Semis (4 teams) ──
  // lbsemi1: W(lbr2m0) vs L(wbr1m4) [the bye team finally plays]
  const lbSemi1 = makeMatch('lb_semi1', 'LB Semis · M1', 'losers', 2, 0,
    sourceSlot('lbr2m0', 'winner'), sourceSlot('wbr1m4', 'loser'),
    LBcol(4), LB_Y0);

  // lbsemi2: W(lbr2m1) vs L(wbf)
  const lbSemi2 = makeMatch('lb_semi2', 'LB Semis · M2', 'losers', 2, 1,
    sourceSlot('lbr2m1', 'winner'), sourceSlot('wbf', 'loser'),
    LBcol(4), LB_Y0 + ROW_H);

  // ── LB Finals ──
  const lbFinals = makeMatch('lb_finals', 'LB Finals', 'losers', 3, 0,
    sourceSlot('lb_semi1', 'winner'), sourceSlot('lb_semi2', 'winner'),
    LBcol(5), midY(LB_Y0, LB_Y0 + ROW_H));

  // ── Grand Finals ──
  const gfY = midY(wbf.visualY, lbFinals.visualY);
  const gf = makeMatch('gf', 'Grand Final', 'grand_final', 0, 0,
    sourceSlot('wbf', 'winner'), sourceSlot('lb_finals', 'winner'),
    LBcol(6), gfY);

  const gfReset = makeMatch('gf_reset', 'Grand Final · Reset', 'grand_final', 1, 0,
    emptySlot(), emptySlot(),
    LBcol(6), gfY + ROW_H + 8);
  gfReset.isResetMatch = true;

  const matches: Match[] = [
    pi,
    wbr1m1, wbr1m2, wbr1m3, wbr1m4,
    wbr2m1, wbr2m2,
    wbf,
    lbr1m0, lbr1m1,
    lbr2m0, lbr2m1,
    lbSemi1, lbSemi2,
    lbFinals,
    gf,
    gfReset,
  ];

  wireDestinations(matches);
  return matches;
}

// ─── 10-Team bracket ─────────────────────────────────────────────────────────
// 2 play-in matches:
//   PI_A: S9 vs S10 → winner becomes WB seed 7
//   PI_B: S7 vs S8  → winner becomes WB seed 8
//
// WB col x values:
//   PI   → col 0 (x=0)
//   WBR1 → col 1 (x=COL_W)
//   WBR2 → col 2 (x=2*COL_W)
//   WBF  → col 3 (x=3*COL_W)
//   GF   → col 6 (x=6*COL_W)
//
// LB col x values (same as 9-team):
//   LBR1 → col 2, LBR2 → col 3, Semis → col 4, Finals → col 5
//
// LBR1 has 6 teams (4 WBR1 losers + L_PI_A + L_PI_B):
//   lbr1m0: L(PI_A) vs L(WBR1·M3)  [PI_A winner was in WBR1·M3]
//   lbr1m1: L(PI_B) vs L(WBR1·M1)  [PI_B winner was in WBR1·M1]
//   lbr1m2: L(WBR1·M2) vs L(WBR1·M4)
//
// LBR2 has 5 teams (3 LBR1 winners + 2 WBR2 losers):
//   lbr2m0: W(lbr1m0) vs L(WBR2·M1)
//   lbr2m1: W(lbr1m1) vs L(WBR2·M2)
//   W(lbr1m2): BYE → enters LBSemis
//
// LBSemis (4 teams):
//   lbsemi1: W(lbr2m0) vs W(lbr1m2) [bye team]
//   lbsemi2: W(lbr2m1) vs L(WBF)
//
// LBFinals: W(lbsemi1) vs W(lbsemi2)

function generate10(teams: Team[]): Match[] {
  const s = (i: number) => teams[i];
  const LB_Y0 = CANVAS_Y_PAD + 4 * ROW_H + 40;
  const WBcol = (c: number) => c * COL_W;
  const LBcol = (c: number) => c * COL_W;

  // ── Play-ins ──
  const piA = makeMatch('pi_a', 'Play-In A', 'winners', -1, 0,
    seededSlot(s(8)), seededSlot(s(9)),
    WBcol(0), wbR1Y(0));
  piA.status = 'ready';

  const piB = makeMatch('pi_b', 'Play-In B', 'winners', -1, 1,
    seededSlot(s(6)), seededSlot(s(7)),
    WBcol(0), wbR1Y(1));
  piB.status = 'ready';

  // ── WB Round 1 ──
  // WB seed positions: S1(0), S2(1), S3(2), S4(3), S5(4), S6(5), W(PI_A)=7, W(PI_B)=8
  const wbr1m1 = makeMatch('wbr1m1', 'WB R1 · M1', 'winners', 0, 0,
    seededSlot(s(0)), sourceSlot('pi_b', 'winner'),
    WBcol(1), wbR1Y(0));

  const wbr1m2 = makeMatch('wbr1m2', 'WB R1 · M2', 'winners', 0, 1,
    seededSlot(s(3)), seededSlot(s(4)),
    WBcol(1), wbR1Y(1));

  const wbr1m3 = makeMatch('wbr1m3', 'WB R1 · M3', 'winners', 0, 2,
    seededSlot(s(1)), sourceSlot('pi_a', 'winner'),
    WBcol(1), wbR1Y(2));

  const wbr1m4 = makeMatch('wbr1m4', 'WB R1 · M4', 'winners', 0, 3,
    seededSlot(s(2)), seededSlot(s(5)),
    WBcol(1), wbR1Y(3));

  // ── WB Round 2 ──
  const wbr2m1 = makeMatch('wbr2m1', 'WB R2 · M1', 'winners', 1, 0,
    sourceSlot('wbr1m1', 'winner'), sourceSlot('wbr1m2', 'winner'),
    WBcol(2), midY(wbR1Y(0), wbR1Y(1)));

  const wbr2m2 = makeMatch('wbr2m2', 'WB R2 · M2', 'winners', 1, 1,
    sourceSlot('wbr1m3', 'winner'), sourceSlot('wbr1m4', 'winner'),
    WBcol(2), midY(wbR1Y(2), wbR1Y(3)));

  // ── WB Finals ──
  const wbf = makeMatch('wbf', 'WB Finals', 'winners', 2, 0,
    sourceSlot('wbr2m1', 'winner'), sourceSlot('wbr2m2', 'winner'),
    WBcol(3), midY(wbr2m1.visualY, wbr2m2.visualY));

  // ── LB Round 1 (6 teams) ──
  const lbr1m0 = makeMatch('lbr1m0', 'LB R1 · M1', 'losers', 0, 0,
    sourceSlot('pi_a', 'loser'), sourceSlot('wbr1m3', 'loser'),
    LBcol(2), LB_Y0);

  const lbr1m1 = makeMatch('lbr1m1', 'LB R1 · M2', 'losers', 0, 1,
    sourceSlot('pi_b', 'loser'), sourceSlot('wbr1m1', 'loser'),
    LBcol(2), LB_Y0 + ROW_H);

  const lbr1m2 = makeMatch('lbr1m2', 'LB R1 · M3', 'losers', 0, 2,
    sourceSlot('wbr1m2', 'loser'), sourceSlot('wbr1m4', 'loser'),
    LBcol(2), LB_Y0 + 2 * ROW_H);

  // ── LB Round 2 (5 teams, W_lbr1m2 gets bye to LBSemis) ──
  const lbr2m0 = makeMatch('lbr2m0', 'LB R2 · M1', 'losers', 1, 0,
    sourceSlot('lbr1m0', 'winner'), sourceSlot('wbr2m1', 'loser'),
    LBcol(3), LB_Y0);

  const lbr2m1 = makeMatch('lbr2m1', 'LB R2 · M2', 'losers', 1, 1,
    sourceSlot('lbr1m1', 'winner'), sourceSlot('wbr2m2', 'loser'),
    LBcol(3), LB_Y0 + ROW_H);

  // W(lbr1m2) bye → LBSemis·M1

  // ── LB Semis (4 teams) ──
  const lbSemi1 = makeMatch('lb_semi1', 'LB Semis · M1', 'losers', 2, 0,
    sourceSlot('lbr2m0', 'winner'), sourceSlot('lbr1m2', 'winner'),
    LBcol(4), LB_Y0);

  const lbSemi2 = makeMatch('lb_semi2', 'LB Semis · M2', 'losers', 2, 1,
    sourceSlot('lbr2m1', 'winner'), sourceSlot('wbf', 'loser'),
    LBcol(4), LB_Y0 + ROW_H);

  // ── LB Finals ──
  const lbFinals = makeMatch('lb_finals', 'LB Finals', 'losers', 3, 0,
    sourceSlot('lb_semi1', 'winner'), sourceSlot('lb_semi2', 'winner'),
    LBcol(5), midY(LB_Y0, LB_Y0 + 2 * ROW_H));

  // ── Grand Finals ──
  const gfY = midY(wbf.visualY, lbFinals.visualY);
  const gf = makeMatch('gf', 'Grand Final', 'grand_final', 0, 0,
    sourceSlot('wbf', 'winner'), sourceSlot('lb_finals', 'winner'),
    LBcol(6), gfY);

  const gfReset = makeMatch('gf_reset', 'Grand Final · Reset', 'grand_final', 1, 0,
    emptySlot(), emptySlot(),
    LBcol(6), gfY + ROW_H + 8);
  gfReset.isResetMatch = true;

  const matches: Match[] = [
    piA, piB,
    wbr1m1, wbr1m2, wbr1m3, wbr1m4,
    wbr2m1, wbr2m2,
    wbf,
    lbr1m0, lbr1m1, lbr1m2,
    lbr2m0, lbr2m1,
    lbSemi1, lbSemi2,
    lbFinals,
    gf,
    gfReset,
  ];

  wireDestinations(matches);
  return matches;
}

// ─── Wire destinations ───────────────────────────────────────────────────────

/**
 * Fills in `winnerTo` and `loserTo` on every match by scanning all matches'
 * slot sources. Must be called after all matches are created.
 */
function wireDestinations(matches: Match[]): void {
  const byId = new Map(matches.map((m) => [m.id, m]));

  for (const match of matches) {
    for (const slotKey of ['slot1', 'slot2'] as const) {
      const slot = match[slotKey];
      const slotNum: 1 | 2 = slotKey === 'slot1' ? 1 : 2;
      if (!slot.sourceMatchId) continue;

      const source = byId.get(slot.sourceMatchId);
      if (!source) continue;

      if (slot.sourceOutcome === 'winner') {
        source.winnerTo = { matchId: match.id, slot: slotNum };
      } else {
        source.loserTo = { matchId: match.id, slot: slotNum };
      }
    }
  }
}

// ─── Canvas dimension calculator ─────────────────────────────────────────────

export function getCanvasDimensions(matches: Match[]): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const m of matches) {
    if (m.isResetMatch && !m.resetActive) continue;
    maxX = Math.max(maxX, m.visualX + CARD_W);
    maxY = Math.max(maxY, m.visualY + CARD_H);
  }
  return { width: maxX + 24, height: maxY + 24 };
}
