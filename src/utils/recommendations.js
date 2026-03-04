import { calculateEV, spreadCoverProb, totalProb, getConfidenceTier, americanToDecimal, americanToImpliedProb, applyShrinkage } from './calculations';
import { calibrateProb } from './calibration';
import { sportConfig } from '../config';

/**
 * Filter correlated bets — if ML home + spread home both exist, keep higher-EV one
 * Same for away side. Prevents doubling up on the same side of a game.
 */
const filterCorrelatedBets = (recs) => {
  const toRemove = new Set();

  const mlHome = recs.find(r => r.betType === 'ml' && r.side === 'home');
  const spreadHome = recs.find(r => r.betType === 'spread' && r.side === 'home');
  if (mlHome && spreadHome) {
    toRemove.add(mlHome.ev >= spreadHome.ev ? spreadHome : mlHome);
  }

  const mlAway = recs.find(r => r.betType === 'ml' && r.side === 'away');
  const spreadAway = recs.find(r => r.betType === 'spread' && r.side === 'away');
  if (mlAway && spreadAway) {
    toRemove.add(mlAway.ev >= spreadAway.ev ? spreadAway : mlAway);
  }

  return recs.filter(r => !toRemove.has(r));
};

/**
 * Generate all positive-EV recommendations for a game given model predictions + book odds
 * @param {object} prediction - { homeWinProb, predictedSpread, predictedTotal }
 * @param {object} odds - { homeML, awayML, spread, spreadOdds, spreadOdds2, total, overOdds, underOdds }
 * @param {string} sportKey - Sport key (nfl, nba, nhl, cfb, cbb)
 * @param {object} options - { minEV, calibrationParams }
 * @returns {Array} Array of { betType, side, ev, confidence, odds, prob, line? }
 */
export const generateRecommendations = (prediction, odds, sportKey, { minEV: minEVOverride, calibrationParams } = {}) => {
  const config = sportConfig[sportKey];
  const minEV = minEVOverride ?? config.minEV ?? 3;
  let recs = [];
  let { homeWinProb, predictedSpread, predictedTotal } = prediction;
  let awayWinProb = 1 - homeWinProb;

  // Apply shrinkage if enabled for this sport
  if (config.useShrinkage) {
    // ML: shrink win prob toward book implied prob
    if (odds.homeML != null) {
      const bookImplied = americanToImpliedProb(odds.homeML);
      homeWinProb = applyShrinkage(homeWinProb, bookImplied, config.shrinkageML);
      awayWinProb = 1 - homeWinProb;
    }
    // Spread: shrink predicted spread toward book spread
    if (odds.spread != null) {
      predictedSpread = applyShrinkage(predictedSpread, odds.spread, config.shrinkageSpread);
    }
    // Total: shrink predicted total toward book total
    if (odds.total != null) {
      predictedTotal = applyShrinkage(predictedTotal, odds.total, config.shrinkageTotal);
    }
  }

  // Apply calibration if provided (Platt scaling)
  const cal = calibrationParams;

  // ML recommendations
  if (odds.homeML != null) {
    let prob = homeWinProb;
    if (cal?.ml) prob = calibrateProb(prob, cal.ml);
    const ev = calculateEV(prob, odds.homeML) * 100;
    if (ev >= minEV) {
      recs.push({ betType: 'ml', side: 'home', ev, confidence: getConfidenceTier(ev), odds: odds.homeML, prob });
    }
  }
  if (odds.awayML != null) {
    let prob = awayWinProb;
    if (cal?.ml) prob = 1 - calibrateProb(homeWinProb, cal.ml);
    const ev = calculateEV(prob, odds.awayML) * 100;
    if (ev >= minEV) {
      recs.push({ betType: 'ml', side: 'away', ev, confidence: getConfidenceTier(ev), odds: odds.awayML, prob });
    }
  }

  // Spread recommendations
  if (odds.spread != null) {
    let homeCoverProb = spreadCoverProb(predictedSpread, odds.spread, config);
    if (cal?.spread) homeCoverProb = calibrateProb(homeCoverProb, cal.spread);
    const awayCoverProb = 1 - homeCoverProb;
    const homeSpreadOdds = odds.spreadOdds ?? -110;
    const awaySpreadOdds = odds.spreadOdds2 ?? -110;

    const homeSpreadEV = calculateEV(homeCoverProb, homeSpreadOdds) * 100;
    if (homeSpreadEV >= minEV) {
      recs.push({ betType: 'spread', side: 'home', ev: homeSpreadEV, confidence: getConfidenceTier(homeSpreadEV), odds: homeSpreadOdds, prob: homeCoverProb, line: odds.spread });
    }
    const awaySpreadEV = calculateEV(awayCoverProb, awaySpreadOdds) * 100;
    if (awaySpreadEV >= minEV) {
      recs.push({ betType: 'spread', side: 'away', ev: awaySpreadEV, confidence: getConfidenceTier(awaySpreadEV), odds: awaySpreadOdds, prob: awayCoverProb, line: -odds.spread });
    }
  }

  // Total recommendations
  if (odds.total != null) {
    let overProb = totalProb(predictedTotal, odds.total, true, config);
    if (cal?.total) overProb = calibrateProb(overProb, cal.total);
    const underProb = 1 - overProb;
    const overOdds = odds.overOdds ?? -110;
    const underOdds = odds.underOdds ?? -110;

    const overEV = calculateEV(overProb, overOdds) * 100;
    if (overEV >= minEV) {
      recs.push({ betType: 'total', side: 'over', ev: overEV, confidence: getConfidenceTier(overEV), odds: overOdds, prob: overProb, line: odds.total });
    }
    const underEV = calculateEV(underProb, underOdds) * 100;
    if (underEV >= minEV) {
      recs.push({ betType: 'total', side: 'under', ev: underEV, confidence: getConfidenceTier(underEV), odds: underOdds, prob: underProb, line: odds.total });
    }
  }

  // Volume controls
  if (config.blockCorrelatedBets) {
    recs = filterCorrelatedBets(recs);
  }

  // Sort by EV descending, then limit per game
  recs.sort((a, b) => b.ev - a.ev);
  if (config.maxBetsPerGame && recs.length > config.maxBetsPerGame) {
    recs = recs.slice(0, config.maxBetsPerGame);
  }

  return recs;
};

/**
 * Grade a recommendation against actual game result
 * @param {object} rec - Recommendation object from generateRecommendations
 * @param {number} homeScore - Actual home score
 * @param {number} awayScore - Actual away score
 * @returns {{ won: boolean, push: boolean, payout: number }} Net profit/loss on $100 unit
 */
export const gradeRecommendation = (rec, homeScore, awayScore) => {
  const UNIT = 100;
  const decimal = americanToDecimal(rec.odds);
  const margin = homeScore - awayScore;
  const actualTotal = homeScore + awayScore;

  let won = false;
  let push = false;

  switch (rec.betType) {
    case 'ml':
      if (homeScore === awayScore) push = true;
      else won = rec.side === 'home' ? homeScore > awayScore : awayScore > homeScore;
      break;
    case 'spread': {
      // rec.line is from the bet side's perspective
      // Home: line is the book spread (e.g., -3.5). Home covers if margin + line > 0
      // Away: line is negated book spread. Away covers if -margin + line > 0
      const adjustedMargin = rec.side === 'home' ? margin + rec.line : -margin + rec.line;
      if (adjustedMargin === 0) push = true;
      else won = adjustedMargin > 0;
      break;
    }
    case 'total':
      if (actualTotal === rec.line) push = true;
      else won = rec.side === 'over' ? actualTotal > rec.line : actualTotal < rec.line;
      break;
  }

  if (push) return { won: false, push: true, payout: 0 };
  return { won, push: false, payout: won ? UNIT * (decimal - 1) : -UNIT };
};
