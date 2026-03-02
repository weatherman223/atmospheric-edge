import { calculateCLV } from './calculations';

export const calculateStats = (bets, bankroll) => {
  const settled = bets.filter(b => b.result !== 'pending');
  const wins = settled.filter(b => b.result === 'win').length;
  const losses = settled.filter(b => b.result === 'loss').length;
  const pushes = settled.filter(b => b.result === 'push').length;
  const totalStaked = settled.reduce((sum, b) => sum + b.stake, 0);
  const totalProfit = settled.reduce((sum, b) => sum + b.payout, 0);
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
  const units = totalProfit / (parseFloat(bankroll) * 0.01);

  // CLV (Closing Line Value) statistics
  const betsWithCLV = settled.filter(b => b.closingOdds && b.closingOdds !== '');
  const clvValues = betsWithCLV.map(b => calculateCLV(b.odds, b.closingOdds)).filter(c => c !== null);
  const avgCLV = clvValues.length > 0
    ? clvValues.reduce((sum, c) => sum + c, 0) / clvValues.length
    : null;
  const positiveCLV = clvValues.filter(c => c > 0).length;
  const negativeCLV = clvValues.filter(c => c < 0).length;
  const clvWinRate = clvValues.length > 0 ? (positiveCLV / clvValues.length) * 100 : null;

  return {
    wins, losses, pushes, totalStaked, totalProfit, roi, winRate, units,
    pending: bets.filter(b => b.result === 'pending').length,
    // CLV stats
    avgCLV,
    clvCount: clvValues.length,
    positiveCLV,
    negativeCLV,
    clvWinRate
  };
};
