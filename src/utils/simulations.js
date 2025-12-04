/**
 * Monte Carlo simulation utilities for matchup analysis
 * Generates paired scores using normal or lightly skewed distributions
 */

const randomNormal = (mean = 0, std = 1) => {
  const u = Math.random() || Number.EPSILON;
  const v = Math.random() || Number.EPSILON;
  const mag = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + std * mag;
};

const percentile = (arr, p) => {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

/**
 * Run score simulations for a matchup
 * @param {object} params
 * @param {number} params.predictedSpread - Model predicted spread (team1 perspective)
 * @param {number} params.predictedTotal - Model predicted total points/goals
 * @param {number} params.scoringVar - Sport-specific scoring variance
 * @param {number} [params.marginMult=1] - Sport-specific multiplier for margin volatility
 * @param {number} [params.simulations=5000] - Number of simulations to run
 * @param {number|null} [params.bookSpread=null] - Sportsbook spread for team1
 * @param {number|null} [params.bookTotal=null] - Sportsbook total line
 * @param {boolean} [params.includePercentiles=false] - Include percentile score outputs
 * @param {number} [params.skew=0.1] - Adds light positive skew to totals (0-1)
 * @returns {object} An object containing simulation summary statistics:
 *   @property {number} team1WinRate - Proportion of simulations where team 1 wins.
 *   @property {number} team2WinRate - Proportion of simulations where team 2 wins.
 *   @property {number} team1CoverRate - Proportion of simulations where team 1 covers the spread (if bookSpread provided).
 *   @property {number} team2CoverRate - Proportion of simulations where team 2 covers the spread (if bookSpread provided).
 *   @property {number} overRate - Proportion of simulations where total score is over the bookTotal (if bookTotal provided).
 *   @property {number} underRate - Proportion of simulations where total score is under the bookTotal (if bookTotal provided).
 *   @property {object} averages - Average scores and margins:
 *     @property {number} team1AvgScore - Average simulated score for team 1.
 *     @property {number} team2AvgScore - Average simulated score for team 2.
 *     @property {number} avgMargin - Average simulated margin (team 1 minus team 2).
 *     @property {number} avgTotal - Average simulated total score.
 *   @property {object} [percentiles] - Percentile statistics for scores and margins (if includePercentiles is true):
 *     @property {object} team1Score - Percentiles for team 1 score (keys: p5, p25, p50, p75, p95).
 *     @property {object} team2Score - Percentiles for team 2 score (keys: p5, p25, p50, p75, p95).
 *     @property {object} margin - Percentiles for margin (keys: p5, p25, p50, p75, p95).
 *     @property {object} total - Percentiles for total score (keys: p5, p25, p50, p75, p95).
 */
export const runScoreSimulations = ({
  predictedSpread,
  predictedTotal,
  scoringVar,
  marginMult = 1,
  simulations = 5000,
  bookSpread = null,
  bookTotal = null,
  includePercentiles = false,
  skew = 0.1
}) => {
  const marginMean = -predictedSpread;
  const totalMean = predictedTotal;

  let team1Wins = 0;
  let team2Wins = 0;
  let homeCover = 0;
  let awayCover = 0;
  let spreadPush = 0;
  let overCount = 0;
  let underCount = 0;
  let totalPush = 0;

  const team1Scores = [];
  const team2Scores = [];

  for (let i = 0; i < simulations; i++) {
    const marginNoise = randomNormal(0, scoringVar * marginMult * 0.6);
    const totalNoise = randomNormal(0, scoringVar * 0.9);
    const skewBump = Math.abs(randomNormal(0, scoringVar * 0.35)) * skew;

    const simulatedMargin = marginMean + marginNoise;
    const simulatedTotal = Math.max(0, totalMean + totalNoise + skewBump);

    const team1Score = Math.max(0, (simulatedTotal + simulatedMargin) / 2);
    const team2Score = Math.max(0, (simulatedTotal - simulatedMargin) / 2);

    team1Scores.push(team1Score);
    team2Scores.push(team2Score);

    if (team1Score > team2Score) team1Wins++;
    else if (team2Score > team1Score) team2Wins++;

    if (bookSpread !== null) {
      const spreadResult = (team1Score + bookSpread) - team2Score;
      if (Math.abs(spreadResult) < 0.01) spreadPush++;
      else if (spreadResult > 0) homeCover++;
      else awayCover++;
    }

    if (bookTotal !== null) {
      const totalResult = team1Score + team2Score - bookTotal;
      if (Math.abs(totalResult) < 0.01) totalPush++;
      else if (totalResult > 0) overCount++;
      else underCount++;
    }
  }

  const buildPercentiles = () => {
    if (!includePercentiles) return null;
    return {
      team1: {
        p10: percentile(team1Scores, 10),
        p50: percentile(team1Scores, 50),
        p90: percentile(team1Scores, 90)
      },
      team2: {
        p10: percentile(team2Scores, 10),
        p50: percentile(team2Scores, 50),
        p90: percentile(team2Scores, 90)
      }
    };
  };

  return {
    team1WinRate: team1Wins / simulations,
    team2WinRate: team2Wins / simulations,
    spread: bookSpread === null ? null : {
      homeCover: homeCover / simulations,
      awayCover: awayCover / simulations,
      push: spreadPush / simulations
    },
    totals: bookTotal === null ? null : {
      over: overCount / simulations,
      under: underCount / simulations,
      push: totalPush / simulations
    },
    averages: {
      team1: team1Scores.reduce((sum, s) => sum + s, 0) / simulations,
      team2: team2Scores.reduce((sum, s) => sum + s, 0) / simulations
    },
    percentiles: buildPercentiles()
  };
};
