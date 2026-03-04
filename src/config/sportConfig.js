// Sport-specific settings
// NHL note: OT/SO games handled specially - loser loses only 25% Elo (they get standings point), winner gains 75%
// College sports: marginCap limits blowout impact (beating cupcakes by 40 shouldn't boost Elo too much)
// D3 sports: Use NCAA API instead of ESPN, lower home advantage due to smaller gyms
export const sportConfig = {
  nfl: { name: 'NFL 2025', homeAdvantage: 48, kFactor: 20, avgScore: 23, avgTotal: 46, spreadMultiplier: 0.04, scoringVar: 14, ratingImpact: 1.0, marginMult: 1 },
  nba: {
    name: 'NBA 2025-26', homeAdvantage: 40, kFactor: 20, avgScore: 115, avgTotal: 230,
    spreadMultiplier: 0.035, scoringVar: 15, ratingImpact: 0.6, marginMult: 1,
    // Shrinkage: blend model predictions toward book lines (NBA only)
    useShrinkage: true,
    shrinkageML: 0.35,
    shrinkageSpread: 0.30,
    shrinkageTotal: 0.45,
    // Volume controls
    minEV: 8,
    minEVTotal: 12,  // totals need higher bar (15.8 pt MAE, -8.6% ROI in backtest)
    maxBetsPerGame: 1,
    blockCorrelatedBets: true,
  },
  nhl: { name: 'NHL 2025-26', homeAdvantage: 22, kFactor: 22, avgScore: 3.1, avgTotal: 6.2, spreadMultiplier: 0.015, scoringVar: 1.5, ratingImpact: 0.8, marginMult: 4.5 },
  cfb: { name: 'CFB 2025', homeAdvantage: 55, kFactor: 18, avgScore: 28, avgTotal: 56, spreadMultiplier: 0.035, scoringVar: 16, ratingImpact: 1.0, marginMult: 1, marginCap: 21 },
  cbb: { name: 'CBB 2025-26', homeAdvantage: 35, kFactor: 20, avgScore: 72, avgTotal: 144, spreadMultiplier: 0.035, scoringVar: 10, ratingImpact: 0.6, marginMult: 1, marginCap: 15 },
  d3mb: { name: 'D3 Men\'s BBall', homeAdvantage: 28, kFactor: 22, avgScore: 70, avgTotal: 140, spreadMultiplier: 0.035, scoringVar: 11, ratingImpact: 0.6, marginMult: 1, marginCap: 18, useNcaaApi: true },
  d3wb: { name: 'D3 Women\'s BBall', homeAdvantage: 28, kFactor: 22, avgScore: 62, avgTotal: 124, spreadMultiplier: 0.035, scoringVar: 10, ratingImpact: 0.6, marginMult: 1, marginCap: 18, useNcaaApi: true },
};

// NCAA API configuration for D3 sports
// Use Vite proxy in development to bypass CORS, direct URL in production
export const ncaaApiBase = import.meta.env.DEV ? '/ncaa-api' : 'https://ncaa-api.henrygd.me';
export const ncaaApiConfig = {
  d3mb: { sport: 'basketball-men', division: 'd3' },
  d3wb: { sport: 'basketball-women', division: 'd3' },
};
