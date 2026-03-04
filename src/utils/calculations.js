/**
 * Calculation utilities for sports betting model
 * Pure functions with no dependencies on React state
 */

/**
 * Safe parsing with special value handling (EVEN, pk, PK)
 * @param {string|number} val - Value to parse
 * @param {number} fallback - Fallback value if parsing fails
 * @returns {number} Parsed number or fallback
 */
export const safeParseFloat = (val, fallback = 0) => {
  if (typeof val === 'string') {
    const upper = val.toUpperCase().trim();
    if (upper === 'EVEN' || upper === 'EV') return 100; // EVEN odds = +100
    if (upper === 'PK' || upper === 'PICK') return 0; // Pick'em spread = 0
  }
  const parsed = parseFloat(val);
  return isNaN(parsed) ? fallback : parsed;
};

const erfApprox = (x) => {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  return sign * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX));
};

const normalCdf = (z) => 0.5 * (1 + erfApprox(z));

/**
 * Convert Elo ratings to win probability
 * @param {number} r1 - Team 1 Elo rating
 * @param {number} r2 - Team 2 Elo rating
 * @param {number} ha - Home advantage in Elo points (default 0)
 * @returns {number} Win probability for team 1 (0-1)
 */
export const eloToWinProb = (r1, r2, ha = 0) => {
  return 1 / (1 + Math.pow(10, -(r1 - r2 + ha) / 400));
};

/**
 * Convert American odds to implied probability
 * @param {string|number} o - American odds (e.g., -110, +150)
 * @returns {number} Implied probability (0-1)
 */
export const americanToImpliedProb = (o) => {
  const x = safeParseFloat(o);
  if (x === 0) return 0.5; // Pick'em/even market
  return x > 0 ? 100 / (x + 100) : Math.abs(x) / (Math.abs(x) + 100);
};

/**
 * Convert probability to American odds
 * @param {number} p - Probability (0-1)
 * @returns {string} American odds (e.g., "-110", "+150")
 */
export const probToAmerican = (p) => {
  const EPSILON = 1e-4;
  const bounded = Math.min(Math.max(p, EPSILON), 1 - EPSILON);
  const isEvenMoney = Math.abs(bounded - 0.5) < 1e-9;

  if (isEvenMoney) return '+100';

  if (bounded >= 0.5) {
    const favoriteOdds = Math.round(-100 * bounded / (1 - bounded));
    return `${favoriteOdds}`;
  }

  const underdogOdds = Math.round(100 * (1 - bounded) / bounded);
  return `+${underdogOdds}`;
};

/**
 * Convert American odds to decimal odds
 * @param {string|number} o - American odds
 * @returns {number} Decimal odds
 */
export const americanToDecimal = (o) => {
  const x = safeParseFloat(o);
  if (x === 0) return 2.0; // Pick'em/even market
  return x > 0 ? x / 100 + 1 : 100 / Math.abs(x) + 1;
};

/**
 * Calculate expected value (EV) of a bet
 * @param {number} p - True win probability (0-1)
 * @param {string|number} o - American odds
 * @returns {number} Expected value as decimal (e.g., 0.05 = 5% EV)
 */
export const calculateEV = (p, o) => {
  return (p * (americanToDecimal(o) - 1)) - (1 - p);
};

/**
 * Calculate Kelly Criterion stake
 * @param {number} p - Win probability (0-1)
 * @param {string|number} o - American odds
 * @param {number} b - Bankroll
 * @param {number} f - Kelly fraction (e.g., 0.25 for quarter Kelly)
 * @returns {number} Recommended stake amount
 */
export const kellyStake = (p, o, b, f) => {
  const d = americanToDecimal(o);
  const rawKellyFraction = ((d - 1) * p - (1 - p)) / (d - 1);
  const cappedFraction = Math.min(Math.max(rawKellyFraction, 0), 1);
  return cappedFraction * f * b;
};

/**
 * Kelly with max bet cap - returns detailed stake info
 * @param {number} p - Win probability (0-1)
 * @param {string|number} o - American odds
 * @param {number} b - Bankroll
 * @param {number} f - Kelly fraction
 * @param {number} maxBet - Maximum bet cap
 * @returns {{amount: number, wasCapped: boolean, rawAmount: number}}
 */
export const kellyStakeCapped = (p, o, b, f, maxBet) => {
  const raw = kellyStake(p, o, b, f);
  const capped = Math.min(raw, maxBet);
  return {
    amount: capped,
    wasCapped: raw > maxBet && capped > 0,
    rawAmount: raw
  };
};

/**
 * Calculate probability of covering spread using normal distribution
 * @param {number} pred - Predicted spread
 * @param {string|number} book - Bookmaker spread
 * @param {object} sportConfig - Sport configuration with scoringVar
 * @returns {number} Probability of covering (0-1)
 */
export const spreadCoverProb = (pred, book, sportConfig) => {
  const diff = safeParseFloat(book) - pred;
  const z = diff / (sportConfig.scoringVar * Math.sqrt(2));
  return normalCdf(z);
};

/**
 * Calculate probability for totals (over/under) using normal distribution
 * @param {number} pred - Predicted total
 * @param {string|number} book - Bookmaker total
 * @param {boolean} isOver - True for over, false for under
 * @param {object} sportConfig - Sport configuration with scoringVar
 * @returns {number} Probability (0-1)
 */
export const totalProb = (pred, book, isOver, sportConfig) => {
  const diff = pred - safeParseFloat(book);
  const z = diff / (sportConfig.scoringVar * Math.sqrt(2) * 1.2);
  const over = normalCdf(z);
  return isOver ? over : 1 - over;
};

/**
 * Calculate Closing Line Value (CLV)
 * Positive CLV = you beat the closing line (the market moved toward your position)
 * Negative CLV = the market moved against you
 * @param {string|number} openingOdds - Odds when bet was placed
 * @param {string|number} closingOdds - Odds at game start
 * @returns {number|null} CLV in percentage points, or null if closingOdds not provided
 */
export const calculateCLV = (openingOdds, closingOdds) => {
  if (!closingOdds || closingOdds === '') return null;
  const openProb = americanToImpliedProb(openingOdds);
  const closeProb = americanToImpliedProb(closingOdds);
  // CLV in percentage points
  // Positive = closing line implies higher probability (you got value)
  return (closeProb - openProb) * 100;
};

/**
 * Get confidence tier based on expected value
 * @param {number} ev - Expected value as percentage (e.g., 5 for 5%)
 * @returns {{stars: string, label: string, color: string, bg: string}}
 */
export const getConfidenceTier = (ev) => {
  if (ev >= 10) return {
    stars: '★★★★★',
    label: 'ELITE',
    color: 'text-yellow-500',
    bg: 'bg-yellow-50 border-yellow-400'
  };
  if (ev >= 6) return {
    stars: '★★★★☆',
    label: 'STRONG',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-400'
  };
  if (ev >= 3) return {
    stars: '★★★☆☆',
    label: 'GOOD',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-400'
  };
  if (ev >= 1) return {
    stars: '★★☆☆☆',
    label: 'LEAN',
    color: 'text-gray-600',
    bg: 'bg-gray-50 border-gray-300'
  };
  return {
    stars: '★☆☆☆☆',
    label: 'MARGINAL',
    color: 'text-gray-400',
    bg: 'bg-gray-50 border-gray-200'
  };
};
