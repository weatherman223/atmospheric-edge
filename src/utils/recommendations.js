import { calculateEV, spreadCoverProb, totalProb, getConfidenceTier, americanToDecimal } from './calculations';
import { sportConfig } from '../config';

/**
 * Generate all positive-EV recommendations for a game given model predictions + book odds
 * @param {object} prediction - { homeWinProb, predictedSpread, predictedTotal }
 * @param {object} odds - { homeML, awayML, spread, spreadOdds, spreadOdds2, total, overOdds, underOdds }
 * @param {string} sportKey - Sport key (nfl, nba, nhl, cfb, cbb)
 * @returns {Array} Array of { betType, side, ev, confidence, odds, prob, line? }
 */
export const generateRecommendations = (prediction, odds, sportKey, { minEV = 3 } = {}) => {
  const config = sportConfig[sportKey];
  const recs = [];
  const { homeWinProb, predictedSpread, predictedTotal } = prediction;
  const awayWinProb = 1 - homeWinProb;

  // ML recommendations
  if (odds.homeML != null) {
    const ev = calculateEV(homeWinProb, odds.homeML) * 100;
    if (ev >= minEV) {
      recs.push({ betType: 'ml', side: 'home', ev, confidence: getConfidenceTier(ev), odds: odds.homeML, prob: homeWinProb });
    }
  }
  if (odds.awayML != null) {
    const ev = calculateEV(awayWinProb, odds.awayML) * 100;
    if (ev >= minEV) {
      recs.push({ betType: 'ml', side: 'away', ev, confidence: getConfidenceTier(ev), odds: odds.awayML, prob: awayWinProb });
    }
  }

  // Spread recommendations
  if (odds.spread != null) {
    const homeCoverProb = spreadCoverProb(predictedSpread, odds.spread, config);
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
    const overProb = totalProb(predictedTotal, odds.total, true, config);
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
