import { eloToWinProb } from './calculations';
import { initialTeamsBySport } from '../config';

export const getInitialTeams = (sportKey) => {
  const baseTeams = initialTeamsBySport[sportKey] || {};
  return Object.fromEntries(
    Object.entries(baseTeams).map(([name, ratings]) => [name, { ...ratings }])
  );
};

// Regress off/def ratings toward 100 to prevent drift (10% per game)
// Only for high-volume sports (NBA/CBB) where ratings can inflate over many games
// Also applies tighter bounds for basketball (80-120 vs 70-130 for other sports)
export const regressRating = (val, sportKey) => {
  if (sportKey === 'nba' || sportKey === 'cbb') {
    const regressed = val * 0.925 + 100 * 0.075;
    return Math.round(Math.max(80, Math.min(120, regressed))); // Tighter bounds for basketball
  }
  return Math.round(val); // No regression for NFL/NHL/CFB
};

export const getGamesPlayedFromLog = (teamName, log) => {
  return log.filter(g => g.team1 === teamName || g.team2 === teamName).length;
};

export const getGamesPlayedByTeam = (log) => {
  const counts = {};
  log.forEach((game) => {
    if (game?.team1) counts[game.team1] = (counts[game.team1] || 0) + 1;
    if (game?.team2) counts[game.team2] = (counts[game.team2] || 0) + 1;
  });
  return counts;
};

// Dynamic K-factor: starts at 1.5x base, decays to 0.6x base over ~50 games
export const getDynamicK = (baseK, gamesPlayed) => {
  return baseK * Math.max(0.6, 1.5 - (gamesPlayed / 50));
};

// Confidence-weighted off/def scale: decreases as we have more data
export const getConfidenceScale = (gamesPlayed) => {
  return 0.3 / Math.sqrt(gamesPlayed / 5 + 1);
};

export const getHomeAdvantageForWinner = (winnerName, homeTeamName, config) => {
  return winnerName === homeTeamName ? config.homeAdvantage : -config.homeAdvantage;
};

export const getTeamEloChanges = (s1, s2, winnerEloChange, loserEloChange) => {
  if (s1 === s2) {
    return { t1EloChange: 0, t2EloChange: 0 };
  }
  return {
    t1EloChange: s1 > s2 ? winnerEloChange : -loserEloChange,
    t2EloChange: s2 > s1 ? winnerEloChange : -loserEloChange
  };
};

export const applyGameResult = ({
  currentTeams,
  sportKey,
  config,
  team1Name,
  team2Name,
  score1,
  score2,
  isOT = false,
  homeTeamName = team1Name,
  gamesPlayedByTeam = {},
  useDynamicK = true,
  useConfidenceScale = true,
}) => {
  const t1 = currentTeams[team1Name];
  const t2 = currentTeams[team2Name];
  if (!t1 || !t2) return null;

  const s1 = parseInt(score1, 10);
  const s2 = parseInt(score2, 10);
  if (Number.isNaN(s1) || Number.isNaN(s2)) return null;

  const isTie = s1 === s2;
  const t1Games = gamesPlayedByTeam[team1Name] || 0;
  const t2Games = gamesPlayedByTeam[team2Name] || 0;
  const avgGamesPlayed = (t1Games + t2Games) / 2;

  const winnerName = s1 > s2 ? team1Name : team2Name;
  const loserName = s1 > s2 ? team2Name : team1Name;
  const rawMov = Math.abs(s1 - s2);
  const mov = config.marginCap ? Math.min(rawMov, config.marginCap) : rawMov;
  const haForWinner = getHomeAdvantageForWinner(winnerName, homeTeamName, config);
  const expWin = eloToWinProb(currentTeams[winnerName].elo, currentTeams[loserName].elo, haForWinner);
  const kForGame = useDynamicK ? getDynamicK(config.kFactor, avgGamesPlayed) : config.kFactor;
  const rawBaseEloChange = Math.round(
    kForGame * Math.min(Math.log(mov * (config.marginMult || 1) + 1) * 0.8 + 1, 2.5) * (1 - expWin)
  );
  const baseEloChange = isTie ? 0 : rawBaseEloChange;

  let winnerEloChange = baseEloChange;
  let loserEloChange = baseEloChange;
  if (sportKey === 'nhl' && isOT) {
    winnerEloChange = Math.round(baseEloChange * 0.75);
    loserEloChange = Math.round(baseEloChange * 0.25);
  }

  const ri = config.ratingImpact || 1.0;
  const exp1 = config.avgScore * (1 + ((t1.off - 100) - (t2.def - 100)) * ri / 100);
  const exp2 = config.avgScore * (1 + ((t2.off - 100) - (t1.def - 100)) * ri / 100);
  const offScale1 = useConfidenceScale ? getConfidenceScale(t1Games) : 0.3;
  const offScale2 = useConfidenceScale ? getConfidenceScale(t2Games) : 0.3;
  const offDefMult = config.avgScore < 10 ? 10 / config.avgScore : 1;
  const t1OffDiff = Math.round((s1 - exp1) * offScale1 * offDefMult);
  const t2OffDiff = Math.round((s2 - exp2) * offScale2 * offDefMult);
  const t1DefDiff = Math.round((exp2 - s2) * offScale1 * offDefMult);
  const t2DefDiff = Math.round((exp1 - s1) * offScale2 * offDefMult);
  const { t1EloChange, t2EloChange } = getTeamEloChanges(s1, s2, winnerEloChange, loserEloChange);

  return {
    updatedTeams: {
      ...currentTeams,
      [team1Name]: {
        ...t1,
        elo: t1.elo + t1EloChange,
        off: regressRating(Math.max(70, Math.min(130, t1.off + t1OffDiff)), sportKey),
        def: regressRating(Math.max(70, Math.min(130, t1.def + t1DefDiff)), sportKey)
      },
      [team2Name]: {
        ...t2,
        elo: t2.elo + t2EloChange,
        off: regressRating(Math.max(70, Math.min(130, t2.off + t2OffDiff)), sportKey),
        def: regressRating(Math.max(70, Math.min(130, t2.def + t2DefDiff)), sportKey)
      }
    },
    gamesPlayedByTeam: {
      ...gamesPlayedByTeam,
      [team1Name]: t1Games + 1,
      [team2Name]: t2Games + 1
    },
    score1: s1,
    score2: s2,
    baseEloChange,
    winnerEloChange,
    loserEloChange,
    t1Changes: { elo: t1EloChange, off: t1OffDiff, def: t1DefDiff },
    t2Changes: { elo: t2EloChange, off: t2OffDiff, def: t2DefDiff }
  };
};
