// Position importance weights for injury impact calculation
export const positionWeights = {
  nfl: {
    'QB': 1.00, 'RB': 0.45, 'WR': 0.35, 'TE': 0.25, 'OL': 0.20, 'LT': 0.25, 'RT': 0.20,
    'LG': 0.15, 'RG': 0.15, 'C': 0.18, 'EDGE': 0.40, 'DE': 0.35, 'DT': 0.25, 'LB': 0.30,
    'CB': 0.40, 'S': 0.30, 'FS': 0.28, 'SS': 0.28, 'K': 0.15, 'P': 0.08, 'default': 0.20
  },
  nba: {
    'PG': 0.85, 'SG': 0.65, 'SF': 0.70, 'PF': 0.60, 'C': 0.55, 'G': 0.75, 'F': 0.65, 'default': 0.50
  },
  nhl: {
    'G': 0.90, 'C': 0.50, 'LW': 0.40, 'RW': 0.40, 'D': 0.45, 'F': 0.45, 'default': 0.35
  }
};

// Base max Elo impact per sport (star player out)
export const baseMaxImpact = { nfl: -100, nba: -80, nhl: -70, cfb: -90, cbb: -75 };

export const INJURY_CACHE_KEY = 'injuryCache';
export const CACHE_DURATION_MS = 30 * 60 * 1000;
