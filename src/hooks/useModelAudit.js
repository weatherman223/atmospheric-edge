import { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { predictGame } from '../utils/predictions';
import { applyGameResult } from '../utils/elo';
import { matchTeamName } from '../utils/teamMatcher';
import { getLocalDateString } from '../utils/date';
import { generateRecommendations, gradeRecommendation } from '../utils/recommendations';
import { americanToImpliedProb, spreadCoverProb, totalProb, applyShrinkage } from '../utils/calculations';
import { learnCalibrationWalkForward, saveCalibrationParams } from '../utils/calibration';
import {
  sportConfig,
  espnEndpoints,
  espnOddsConfig,
  seasonStartDates,
  conferenceTiers,
  ncaaApiBase,
  ncaaApiConfig,
} from '../config';

// Get starting Elo based on conference (mirrors useEspnImport logic)
const getConferenceElo = (conferenceId, sportKey) => {
  if (sportKey === 'd3mb' || sportKey === 'd3wb') {
    if (!conferenceId) return 1350;
    return conferenceTiers[sportKey]?.[conferenceId] || 1350;
  }
  if (!conferenceId || !conferenceTiers[sportKey]) return 1200;
  const elo = conferenceTiers[sportKey][conferenceId];
  if (elo) return elo;
  return sportKey === 'cfb' ? 1300 : 1400;
};

export const useModelAudit = () => {
  const { sport, teams, setTeams } = useApp();

  const [auditStatus, setAuditStatus] = useState('idle'); // idle | running | complete | error
  const [auditProgress, setAuditProgress] = useState({ current: 0, total: 0, message: '' });
  const [auditResults, setAuditResults] = useState(null);
  const [auditError, setAuditError] = useState('');
  const abortRef = useRef(false);

  // Betting audit state
  const [bettingAuditStatus, setBettingAuditStatus] = useState('idle');
  const [bettingAuditProgress, setBettingAuditProgress] = useState({ current: 0, total: 0, message: '', phase: '' });
  const [bettingAuditResults, setBettingAuditResults] = useState(null);
  const [bettingAuditError, setBettingAuditError] = useState('');
  const bettingAbortRef = useRef(false);

  const cancelAudit = useCallback(() => {
    abortRef.current = true;
  }, []);

  const runAudit = useCallback(async () => {
    abortRef.current = false;
    setAuditStatus('running');
    setAuditError('');
    setAuditResults(null);
    setAuditProgress({ current: 0, total: 0, message: 'Fetching season games...' });

    try {
      const config = sportConfig[sport];
      const isNcaa = config?.useNcaaApi;

      // --- Fetch all completed games for the season ---
      let completedGames;
      if (isNcaa) {
        completedGames = await fetchNCAASeason(sport);
      } else {
        completedGames = await fetchESPNSeason(sport);
      }

      if (abortRef.current) { setAuditStatus('idle'); return; }

      if (!completedGames || completedGames.length === 0) {
        setAuditError('No completed games found for this season.');
        setAuditStatus('error');
        return;
      }

      setAuditProgress({ current: 0, total: completedGames.length, message: `Processing ${completedGames.length} games...` });

      // --- Snapshot teams (deep clone) ---
      let sandboxTeams = JSON.parse(JSON.stringify(teams));
      const gamesPlayedTracker = {};

      // --- First pass: add missing teams ---
      for (const game of completedGames) {
        if (!sandboxTeams[game.espnHome] && game.espnHome !== 'Unknown') {
          const startingElo = getConferenceElo(isNcaa ? game.homeConf : game.homeConfId, sport);
          sandboxTeams[game.espnHome] = { elo: startingElo, off: 100, def: 100 };
        }
        if (!sandboxTeams[game.espnAway] && game.espnAway !== 'Unknown') {
          const startingElo = getConferenceElo(isNcaa ? game.awayConf : game.awayConfId, sport);
          sandboxTeams[game.espnAway] = { elo: startingElo, off: 100, def: 100 };
        }
      }

      // --- Second pass: predict then update, game by game ---
      const gameLog = [];
      let winCorrectCount = 0;
      let spreadErrorSum = 0;
      let totalErrorSum = 0;

      for (let i = 0; i < completedGames.length; i++) {
        if (abortRef.current) { setAuditStatus('idle'); return; }

        const game = completedGames[i];
        const homeName = matchTeamName(game.espnHome, sandboxTeams) || game.espnHome;
        const awayName = matchTeamName(game.espnAway, sandboxTeams) || game.espnAway;

        const homeTeam = sandboxTeams[homeName];
        const awayTeam = sandboxTeams[awayName];
        if (!homeTeam || !awayTeam) continue;

        // Predict
        const prediction = predictGame(homeTeam, awayTeam, sport);

        // Actual results
        const s1 = game.homeScore;
        const s2 = game.awayScore;
        const actualMargin = s1 - s2; // positive = home won
        const actualTotal = s1 + s2;
        const actualWinner = s1 > s2 ? 'home' : (s2 > s1 ? 'away' : 'tie');
        const winCorrect = actualWinner !== 'tie' && prediction.predictedWinner === actualWinner;
        const spreadError = Math.abs((-prediction.predictedSpread) - actualMargin); // predicted margin vs actual margin
        const totalError = Math.abs(prediction.predictedTotal - actualTotal);

        if (actualWinner !== 'tie') {
          if (winCorrect) winCorrectCount++;
        }
        spreadErrorSum += spreadError;
        totalErrorSum += totalError;

        gameLog.push({
          date: game.date,
          home: homeName,
          away: awayName,
          predictedWinner: prediction.predictedWinner,
          homeWinProb: prediction.homeWinProb,
          predictedSpread: prediction.predictedSpread,
          predictedTotal: prediction.predictedTotal,
          actualHomeScore: s1,
          actualAwayScore: s2,
          actualMargin,
          actualTotal,
          winCorrect,
          isTie: actualWinner === 'tie',
          spreadError,
          totalError,
        });

        // Apply Elo update with sandboxed teams
        const applied = applyGameResult({
          currentTeams: sandboxTeams,
          sportKey: sport,
          config,
          team1Name: homeName,
          team2Name: awayName,
          score1: s1,
          score2: s2,
          isOT: sport === 'nhl' && Boolean(game.isOT),
          homeTeamName: homeName,
          gamesPlayedByTeam: gamesPlayedTracker,
          useDynamicK: true,
          useConfidenceScale: true,
        });

        if (applied) {
          sandboxTeams = applied.updatedTeams;
          Object.assign(gamesPlayedTracker, applied.gamesPlayedByTeam);
        }

        // Update progress every 25 games
        if (i % 25 === 0 || i === completedGames.length - 1) {
          setAuditProgress({
            current: i + 1,
            total: completedGames.length,
            message: `Processed ${i + 1} / ${completedGames.length} games...`,
          });
          // Yield to UI
          await new Promise(r => setTimeout(r, 0));
        }
      }

      // --- Compute aggregates ---
      const nonTieGames = gameLog.filter(g => !g.isTie);
      const results = {
        sport,
        gamesProcessed: gameLog.length,
        winRecord: {
          correct: winCorrectCount,
          total: nonTieGames.length,
          pct: nonTieGames.length > 0 ? (winCorrectCount / nonTieGames.length * 100) : 0,
        },
        spreadMAE: gameLog.length > 0 ? spreadErrorSum / gameLog.length : 0,
        totalMAE: gameLog.length > 0 ? totalErrorSum / gameLog.length : 0,
        finalTeams: sandboxTeams,
        gameLog,
      };

      setAuditResults(results);
      setAuditStatus('complete');
      setAuditProgress({ current: gameLog.length, total: gameLog.length, message: 'Audit complete!' });

    } catch (err) {
      console.error('Audit error:', err);
      setAuditError(`Audit failed: ${err.message}`);
      setAuditStatus('error');
    }
  }, [sport, teams]);

  const applyFinalRatings = useCallback(() => {
    if (!auditResults?.finalTeams) return;
    setTeams(auditResults.finalTeams);
  }, [auditResults, setTeams]);

  const cancelBettingAudit = useCallback(() => {
    bettingAbortRef.current = true;
  }, []);

  const runBettingAudit = useCallback(async () => {
    bettingAbortRef.current = false;
    setBettingAuditStatus('running');
    setBettingAuditError('');
    setBettingAuditResults(null);
    setBettingAuditProgress({ current: 0, total: 0, message: 'Fetching season games...', phase: 'fetching_games' });

    try {
      const config = sportConfig[sport];
      const isNcaa = config?.useNcaaApi;

      if (isNcaa || !espnOddsConfig[sport]) {
        setBettingAuditError('Betting audit is not available for this sport (no odds data).');
        setBettingAuditStatus('error');
        return;
      }

      // --- Phase 1: Fetch games ---
      let completedGames;
      if (isNcaa) {
        completedGames = await fetchNCAASeason(sport);
      } else {
        completedGames = await fetchESPNSeason(sport);
      }

      if (bettingAbortRef.current) { setBettingAuditStatus('idle'); return; }

      if (!completedGames || completedGames.length === 0) {
        setBettingAuditError('No completed games found for this season.');
        setBettingAuditStatus('error');
        return;
      }

      // --- Phase 2: Fetch odds ---
      const eventIds = completedGames.filter(g => g.id).map(g => g.id);
      setBettingAuditProgress({ current: 0, total: eventIds.length, message: `Fetching odds: 0/${eventIds.length}...`, phase: 'fetching_odds' });

      const oddsMap = await fetchOddsForEvents(eventIds, sport, (fetched, found, failed) => {
        if (bettingAbortRef.current) return;
        setBettingAuditProgress({
          current: fetched,
          total: eventIds.length,
          message: `Fetching odds: ${fetched}/${eventIds.length} (${found} found${failed ? `, ${failed} failed` : ''})...`,
          phase: 'fetching_odds',
        });
      });

      if (bettingAbortRef.current) { setBettingAuditStatus('idle'); return; }

      // --- Phase 3: Process games ---
      setBettingAuditProgress({ current: 0, total: completedGames.length, message: 'Processing games...', phase: 'processing' });

      let sandboxTeams = JSON.parse(JSON.stringify(teams));
      const gamesPlayedTracker = {};

      // Add missing teams
      for (const game of completedGames) {
        if (!sandboxTeams[game.espnHome] && game.espnHome !== 'Unknown') {
          const startingElo = getConferenceElo(game.homeConfId, sport);
          sandboxTeams[game.espnHome] = { elo: startingElo, off: 100, def: 100 };
        }
        if (!sandboxTeams[game.espnAway] && game.espnAway !== 'Unknown') {
          const startingElo = getConferenceElo(game.awayConfId, sport);
          sandboxTeams[game.espnAway] = { elo: startingElo, off: 100, def: 100 };
        }
      }

      const allRecs = [];
      let gamesWithOdds = 0;
      let gamesWithoutOdds = 0;

      // Calibration data collection (NBA only, ALL games with odds — not just recommended)
      const isNba = sport === 'nba';
      const mlCalData = [];
      const spreadCalData = [];
      const totalCalData = [];

      for (let i = 0; i < completedGames.length; i++) {
        if (bettingAbortRef.current) { setBettingAuditStatus('idle'); return; }

        const game = completedGames[i];
        const homeName = matchTeamName(game.espnHome, sandboxTeams) || game.espnHome;
        const awayName = matchTeamName(game.espnAway, sandboxTeams) || game.espnAway;

        const homeTeam = sandboxTeams[homeName];
        const awayTeam = sandboxTeams[awayName];
        if (!homeTeam || !awayTeam) continue;

        // Predict
        const prediction = predictGame(homeTeam, awayTeam, sport);

        // Check for odds
        const odds = game.id ? oddsMap.get(String(game.id)) : null;

        if (odds) {
          gamesWithOdds++;

          // Collect calibration data for ALL games with odds (avoids selection bias)
          if (isNba) {
            const homeWon = game.homeScore > game.awayScore;
            const actualMargin = game.homeScore - game.awayScore;
            const actualTotal = game.homeScore + game.awayScore;

            // Apply shrinkage to get the adjusted values (same pipeline as recommendations)
            let adjWinProb = prediction.homeWinProb;
            let adjSpread = prediction.predictedSpread;
            let adjTotal = prediction.predictedTotal;

            if (config.useShrinkage) {
              if (odds.homeML != null) {
                adjWinProb = applyShrinkage(adjWinProb, americanToImpliedProb(odds.homeML), config.shrinkageML);
              }
              if (odds.spread != null) {
                adjSpread = applyShrinkage(adjSpread, odds.spread, config.shrinkageSpread);
              }
              if (odds.total != null) {
                adjTotal = applyShrinkage(adjTotal, odds.total, config.shrinkageTotal);
              }
            }

            // ML calibration data
            if (game.homeScore !== game.awayScore) {
              mlCalData.push({ prob: adjWinProb, outcome: homeWon ? 1 : 0 });
            }
            // Spread calibration data
            if (odds.spread != null) {
              const coverProb = spreadCoverProb(adjSpread, odds.spread, config);
              const homeCovered = actualMargin + odds.spread > 0;
              spreadCalData.push({ prob: coverProb, outcome: homeCovered ? 1 : 0 });
            }
            // Total calibration data
            if (odds.total != null) {
              const overProb = totalProb(adjTotal, odds.total, true, config);
              const wentOver = actualTotal > odds.total;
              totalCalData.push({ prob: overProb, outcome: wentOver ? 1 : 0 });
            }
          }

          // Generate recommendations
          const recs = generateRecommendations(prediction, odds, sport);
          for (const rec of recs) {
            const result = gradeRecommendation(rec, game.homeScore, game.awayScore);

            // CLV: model implied prob vs book implied prob (positive = model on right side)
            let clv = null;
            if (rec.betType === 'ml') {
              const bookImplied = americanToImpliedProb(rec.odds);
              clv = rec.prob - bookImplied;
            } else if (rec.betType === 'spread') {
              // For spreads, CLV is the edge over the implied 50% from -110 odds
              const bookImplied = americanToImpliedProb(rec.odds);
              clv = rec.prob - bookImplied;
            } else if (rec.betType === 'total') {
              const bookImplied = americanToImpliedProb(rec.odds);
              clv = rec.prob - bookImplied;
            }

            allRecs.push({
              date: game.date,
              home: homeName,
              away: awayName,
              eventId: game.id,
              betType: rec.betType,
              side: rec.side,
              ev: rec.ev,
              confidence: rec.confidence,
              odds: rec.odds,
              line: rec.line ?? null,
              prob: rec.prob,
              won: result.won,
              push: result.push,
              payout: result.payout,
              clv,
            });
          }
        } else {
          gamesWithoutOdds++;
        }

        // Apply Elo update
        const applied = applyGameResult({
          currentTeams: sandboxTeams,
          sportKey: sport,
          config,
          team1Name: homeName,
          team2Name: awayName,
          score1: game.homeScore,
          score2: game.awayScore,
          isOT: sport === 'nhl' && Boolean(game.isOT),
          homeTeamName: homeName,
          gamesPlayedByTeam: gamesPlayedTracker,
          useDynamicK: true,
          useConfidenceScale: true,
        });

        if (applied) {
          sandboxTeams = applied.updatedTeams;
          Object.assign(gamesPlayedTracker, applied.gamesPlayedByTeam);
        }

        if (i % 25 === 0 || i === completedGames.length - 1) {
          setBettingAuditProgress({
            current: i + 1,
            total: completedGames.length,
            message: `Processing games: ${i + 1}/${completedGames.length}...`,
            phase: 'processing',
          });
          await new Promise(r => setTimeout(r, 0));
        }
      }

      // --- Walk-forward calibration learning (NBA only) ---
      let calibrationResults = null;
      if (isNba) {
        const calParams = {
          ml: learnCalibrationWalkForward(mlCalData),
          spread: learnCalibrationWalkForward(spreadCalData),
          total: learnCalibrationWalkForward(totalCalData),
        };
        saveCalibrationParams(calParams);
        calibrationResults = {
          params: calParams,
          sampleSizes: {
            ml: mlCalData.length,
            spread: spreadCalData.length,
            total: totalCalData.length,
          },
        };
      }

      // --- Phase 4: Compute aggregates ---
      const record = { wins: 0, losses: 0, pushes: 0 };
      const byTier = {};
      const byType = { ml: { count: 0, wins: 0, losses: 0, pushes: 0, wagered: 0, profit: 0 }, spread: { count: 0, wins: 0, losses: 0, pushes: 0, wagered: 0, profit: 0 }, total: { count: 0, wins: 0, losses: 0, pushes: 0, wagered: 0, profit: 0 } };

      // CLV accumulators
      let clvSum = 0;
      let clvPositiveCount = 0;
      let clvCount = 0;
      const clvByType = { ml: { sum: 0, positive: 0, count: 0 }, spread: { sum: 0, positive: 0, count: 0 }, total: { sum: 0, positive: 0, count: 0 } };

      for (const rec of allRecs) {
        const UNIT = 100;
        // Overall record
        if (rec.push) record.pushes++;
        else if (rec.won) record.wins++;
        else record.losses++;

        // CLV tracking
        if (rec.clv !== null) {
          clvSum += rec.clv;
          clvCount++;
          if (rec.clv > 0) clvPositiveCount++;
          const ct = clvByType[rec.betType];
          if (ct) {
            ct.sum += rec.clv;
            ct.count++;
            if (rec.clv > 0) ct.positive++;
          }
        }

        // By star tier
        const starCount = (rec.confidence.stars.match(/★/g) || []).length;
        if (!byTier[starCount]) {
          byTier[starCount] = { count: 0, wins: 0, losses: 0, pushes: 0, wagered: 0, profit: 0 };
        }
        const tier = byTier[starCount];
        tier.count++;
        if (rec.push) tier.pushes++;
        else if (rec.won) tier.wins++;
        else tier.losses++;
        tier.wagered += UNIT;
        tier.profit += rec.payout;

        // By bet type
        const bt = byType[rec.betType];
        bt.count++;
        if (rec.push) bt.pushes++;
        else if (rec.won) bt.wins++;
        else bt.losses++;
        bt.wagered += UNIT;
        bt.profit += rec.payout;
      }

      // Add ROI to each tier/type
      for (const t of Object.values(byTier)) {
        t.roi = t.wagered > 0 ? (t.profit / t.wagered) * 100 : 0;
      }
      for (const t of Object.values(byType)) {
        t.roi = t.wagered > 0 ? (t.profit / t.wagered) * 100 : 0;
      }

      // Compute CLV stats
      const clvStats = {
        avgCLV: clvCount > 0 ? (clvSum / clvCount) * 100 : 0, // as percentage points
        clvPositiveRate: clvCount > 0 ? (clvPositiveCount / clvCount) * 100 : 0,
        clvByType: {},
      };
      for (const [type, ct] of Object.entries(clvByType)) {
        clvStats.clvByType[type] = {
          avgCLV: ct.count > 0 ? (ct.sum / ct.count) * 100 : 0,
          clvPositiveRate: ct.count > 0 ? (ct.positive / ct.count) * 100 : 0,
          count: ct.count,
        };
      }

      const totalWagered = allRecs.length * 100;
      const totalProfit = allRecs.reduce((sum, r) => sum + r.payout, 0);

      const results = {
        sport,
        gamesWithOdds,
        gamesWithoutOdds,
        totalRecommendations: allRecs.length,
        record,
        totalWagered,
        totalProfit,
        roi: totalWagered > 0 ? (totalProfit / totalWagered) * 100 : 0,
        byTier,
        byType,
        recommendations: allRecs,
        clvStats,
        calibrationResults,
      };

      setBettingAuditResults(results);
      setBettingAuditStatus('complete');
      setBettingAuditProgress({ current: completedGames.length, total: completedGames.length, message: 'Betting audit complete!', phase: 'complete' });

    } catch (err) {
      console.error('Betting audit error:', err);
      setBettingAuditError(`Betting audit failed: ${err.message}`);
      setBettingAuditStatus('error');
    }
  }, [sport, teams]);

  return {
    auditStatus,
    auditProgress,
    auditResults,
    auditError,
    runAudit,
    cancelAudit,
    applyFinalRatings,
    bettingAuditStatus,
    bettingAuditProgress,
    bettingAuditResults,
    bettingAuditError,
    runBettingAudit,
    cancelBettingAudit,
  };
};

// --- ESPN fetch helpers ---

async function fetchESPNSeason(sport) {
  const startDate = seasonStartDates[sport];
  const today = getLocalDateString().replace(/-/g, '');

  let extraParams = '';
  if (sport === 'cbb') extraParams = '&groups=50';
  if (sport === 'cfb') extraParams = '&groups=80';
  const url = `${espnEndpoints[sport]}?dates=${startDate}-${today}&limit=1000${extraParams}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`ESPN returned ${response.status}`);

  const data = await response.json();
  if (!data.events || data.events.length === 0) return [];

  return data.events
    .filter(event => event.competitions?.[0]?.status?.type?.completed === true)
    .map(event => {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

      const statusDetail = competition.status?.type?.detail || '';
      const period = competition.status?.period || 3;
      const isOT = sport === 'nhl' && (period > 3 || /OT|SO|Overtime|Shootout/i.test(statusDetail));

      return {
        id: event.id,
        date: event.date?.split('T')[0] || '',
        espnHome: homeTeam?.team?.displayName || 'Unknown',
        espnAway: awayTeam?.team?.displayName || 'Unknown',
        homeScore: parseInt(homeTeam?.score) || 0,
        awayScore: parseInt(awayTeam?.score) || 0,
        homeConfId: homeTeam?.team?.conferenceId || homeTeam?.conferenceId || homeTeam?.team?.conference?.id,
        awayConfId: awayTeam?.team?.conferenceId || awayTeam?.conferenceId || awayTeam?.team?.conference?.id,
        isOT,
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function fetchNCAASeason(sport) {
  const ncaaConfig = ncaaApiConfig[sport];
  if (!ncaaConfig) throw new Error('Sport not configured for NCAA API');

  const startDateStr = seasonStartDates[sport];
  const startDate = new Date(
    startDateStr.substring(0, 4),
    parseInt(startDateStr.substring(4, 6)) - 1,
    parseInt(startDateStr.substring(6, 8))
  );
  const today = new Date();
  const allGames = [];

  let currentDate = new Date(startDate);
  while (currentDate <= today) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');

    try {
      const url = `${ncaaApiBase}/scoreboard/${ncaaConfig.sport}/${ncaaConfig.division}/${year}/${month}/${day}/all-conf`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.games) {
          const completed = data.games
            .filter(gw => gw.game?.gameState === 'final')
            .map(gw => {
              const game = gw.game;
              return {
                id: game.gameID,
                date: `${year}-${month}-${day}`,
                espnHome: game.home?.names?.full || game.home?.names?.short || 'Unknown',
                espnAway: game.away?.names?.full || game.away?.names?.short || 'Unknown',
                homeScore: parseInt(game.home?.score) || 0,
                awayScore: parseInt(game.away?.score) || 0,
                homeConf: game.home?.conferences?.[0]?.conferenceName || null,
                awayConf: game.away?.conferences?.[0]?.conferenceName || null,
                isOT: game.currentPeriod?.includes('OT') || false,
              };
            });
          allGames.push(...completed);
        }
      }
    } catch {
      // Continue with next date
    }

    currentDate.setDate(currentDate.getDate() + 1);
    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  return allGames;
}

// --- Odds fetch helper ---

async function fetchOddsForEvents(eventIds, sportKey, onProgress) {
  const oddsConfig = espnOddsConfig[sportKey];
  if (!oddsConfig) return new Map();

  const oddsMap = new Map();
  const BATCH_SIZE = 3;
  const BATCH_DELAY = 500;
  let fetched = 0;
  let failures = 0;

  for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
    const batch = eventIds.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (eventId) => {
      try {
        const url = `https://sports.core.api.espn.com/v2/sports/${oddsConfig.sport}/leagues/${oddsConfig.league}/events/${eventId}/competitions/${eventId}/odds`;
        const response = await fetch(url);
        if (!response.ok) {
          failures++;
          return;
        }

        const data = await response.json();
        const item = data.items?.[0];
        if (!item) return;

        const odds = {
          homeML: item.homeTeamOdds?.moneyLine ?? null,
          awayML: item.awayTeamOdds?.moneyLine ?? null,
          spread: item.spread ?? null,
          spreadOdds: item.homeTeamOdds?.spreadOdds ?? null,
          spreadOdds2: item.awayTeamOdds?.spreadOdds ?? null,
          total: item.overUnder ?? null,
          overOdds: item.overOdds ?? null,
          underOdds: item.underOdds ?? null,
        };

        // Only store if we have at least one usable odds field
        if (odds.homeML != null || odds.spread != null || odds.total != null) {
          oddsMap.set(String(eventId), odds);
        }
      } catch {
        failures++;
      }
    });

    await Promise.all(promises);
    fetched += batch.length;
    onProgress?.(Math.min(fetched, eventIds.length), oddsMap.size, failures);

    // Rate limit delay between batches
    if (i + BATCH_SIZE < eventIds.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  return oddsMap;
}
