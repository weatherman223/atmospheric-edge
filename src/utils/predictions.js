// Pure prediction functions — no React dependencies
import { eloToWinProb } from './calculations';
import { sportConfig } from '../config';

export const predictSpread = (t1Elo, t2Elo, ha, spreadMultiplier) => {
  return -((t1Elo + ha - t2Elo) * spreadMultiplier);
};

export const predictTotal = (t1Off, t1Def, t2Off, t2Def, avgScore, ratingImpact) => {
  const exp1 = avgScore * (1 + ((t1Off - 100) - (t2Def - 100)) * ratingImpact / 100);
  const exp2 = avgScore * (1 + ((t2Off - 100) - (t1Def - 100)) * ratingImpact / 100);
  return exp1 + exp2;
};

export const predictGame = (homeTeam, awayTeam, sportKey) => {
  const c = sportConfig[sportKey];
  const ha = c.homeAdvantage;
  const ri = c.ratingImpact || 1.0;
  const winProb = eloToWinProb(homeTeam.elo, awayTeam.elo, ha);
  const spread = predictSpread(homeTeam.elo, awayTeam.elo, ha, c.spreadMultiplier);
  const rawTotal = predictTotal(homeTeam.off, homeTeam.def, awayTeam.off, awayTeam.def, c.avgScore, ri);
  const total = rawTotal + (c.totalCorrection || 0);
  return {
    homeWinProb: winProb,
    predictedWinner: winProb >= 0.5 ? 'home' : 'away',
    predictedSpread: spread,
    predictedTotal: total,
  };
};
