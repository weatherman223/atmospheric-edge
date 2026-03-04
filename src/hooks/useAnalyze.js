import { useEffect, useMemo, useRef, useState } from 'react';
import {
  safeParseFloat,
  eloToWinProb,
  americanToImpliedProb,
  probToAmerican,
  calculateEV,
  kellyStakeCapped,
  spreadCoverProb,
  totalProb,
  getConfidenceTier,
  applyShrinkage,
} from '../utils/calculations';
import { calibrateProb, loadCalibrationParams } from '../utils/calibration';
import { predictSpread as predictSpreadPure } from '../utils/predictions';
import { runScoreSimulations } from '../utils/simulations';
import { getLocalDateString } from '../utils/date';
import { matchTeamName } from '../utils/teamMatcher';
import { useInjuries } from './useInjuries';
import { useApp } from '../context/AppContext';
import {
  sportConfig,
  ncaaApiBase,
  ncaaApiConfig,
  espnEndpoints,
  espnOddsConfig,
} from '../config';

export const useAnalyze = () => {
  const {
    sport,
    teams,
    gameLog,
    bankroll,
    kellyFraction,
    bets,
    aiInsights, setAiInsights,
  } = useApp();

  // Local component state (Analyze tab specific)
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [isNeutral, setIsNeutral] = useState(false);

  // Context adjustments (Elo modifiers)
  const [team1Injury, setTeam1Injury] = useState(0);
  const [team2Injury, setTeam2Injury] = useState(0);
  const [team1Rest, setTeam1Rest] = useState(0);
  const [team2Rest, setTeam2Rest] = useState(0);
  const [team1Motivation, setTeam1Motivation] = useState(0);
  const [team2Motivation, setTeam2Motivation] = useState(0);

  const [bookML1, setBookML1] = useState('');
  const [bookML2, setBookML2] = useState('');
  const [bookSpread, setBookSpread] = useState('');
  const [bookSpreadOdds, setBookSpreadOdds] = useState('-110');
  const [bookSpreadOdds2, setBookSpreadOdds2] = useState('-110');
  const [bookTotal, setBookTotal] = useState('');
  const [bookOverOdds, setBookOverOdds] = useState('-110');
  const [bookUnderOdds, setBookUnderOdds] = useState('-110');
  const [useSimulation, setUseSimulation] = useState(false);
  const [simulationRuns, setSimulationRuns] = useState(3500);
  const [showSimPercentiles, setShowSimPercentiles] = useState(true);
  const simulationCacheRef = useRef({});

  // Today's Games Picker State (for Analyze tab)
  const [todaysGames, setTodaysGames] = useState([]);
  const [todaysGamesLoading, setTodaysGamesLoading] = useState(false);
  const [todaysGamesError, setTodaysGamesError] = useState('');
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [gamePickerDate, setGamePickerDate] = useState(getLocalDateString);
  const gamePickerDialogRef = useRef(null);
  const todaysGamesAbortControllerRef = useRef(null);

  // Automated Injury Data (custom hook)
  const [useAutoInjuries, setUseAutoInjuries] = useState(true);
  const {
    team1Injuries, team2Injuries,
    team1InjuryAuto, team2InjuryAuto,
    injuriesLoading, injuriesError,
    injuriesAbortControllerRef,
  } = useInjuries({ team1, team2, sport, useAutoInjuries, setTeam1Injury, setTeam2Injury });

  // Reset team selections and simulation cache when sport changes
  useEffect(() => {
    setTeam1('');
    setTeam2('');
    resetContextAdjustments();
    simulationCacheRef.current = {};
  }, [sport]);

  const resetContextAdjustments = () => {
    setTeam1Injury(0); setTeam2Injury(0);
    setTeam1Rest(0); setTeam2Rest(0);
    setTeam1Motivation(0); setTeam2Motivation(0);
  };

  useEffect(() => {
    if (showGamePicker && gamePickerDialogRef.current) {
      gamePickerDialogRef.current.focus();
    }
  }, [showGamePicker]);

  useEffect(() => {
    const todaysGamesController = todaysGamesAbortControllerRef;
    const injuriesController = injuriesAbortControllerRef;
    return () => {
      todaysGamesController.current?.abort();
      injuriesController.current?.abort();
    };
  }, [injuriesAbortControllerRef]);

  // === CORE FUNCTIONS ===
  const getAdjustedElo = (baseElo, injury, rest, motivation) => baseElo + injury + rest + motivation;

  const predictSpread = (t1Elo, t2Elo, ha) => predictSpreadPure(t1Elo, t2Elo, ha, sportConfig[sport].spreadMultiplier);

  // Fetch Today's Games from NCAA API for D3 sports
  const fetchNCAATodaysGames = async (dateOverride = gamePickerDate) => {
    todaysGamesAbortControllerRef.current?.abort();
    const controller = new AbortController();
    todaysGamesAbortControllerRef.current = controller;
    const { signal } = controller;

    setTodaysGamesLoading(true);
    setTodaysGames([]);
    setTodaysGamesError('');

    try {
      const ncaaConfig = ncaaApiConfig[sport];
      if (!ncaaConfig) {
        setTodaysGamesError('Today\'s games are not configured for this sport.');
        return;
      }

      const [year, month, day] = dateOverride.split('-').map(Number);
      const monthStr = String(month).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');

      const url = `${ncaaApiBase}/scoreboard/${ncaaConfig.sport}/${ncaaConfig.division}/${year}/${monthStr}/${dayStr}/all-conf`;

      const response = await fetch(url, { signal });
      if (!response.ok) {
        setTodaysGamesError('Failed to load today\'s games from NCAA. Please try again.');
        return;
      }

      const data = await response.json();
      if (signal.aborted) return;

      if (!data.games || data.games.length === 0) {
        return;
      }

      const games = data.games
        .filter(gw => gw.game?.gameState !== 'final')
        .map(gw => {
          const game = gw.game;
          const homeName = game.home?.names?.full || game.home?.names?.short || 'Unknown';
          const awayName = game.away?.names?.full || game.away?.names?.short || 'Unknown';

          const matchedHome = matchTeamName(homeName, teams) || homeName;
          const matchedAway = matchTeamName(awayName, teams) || awayName;

          return {
            id: game.gameID || `${homeName}-${awayName}`,
            homeTeam: matchedHome,
            awayTeam: matchedAway,
            espnHomeName: homeName,
            espnAwayName: awayName,
            time: game.startTime || 'TBD',
            status: game.gameState === 'live' ? game.currentPeriod || 'Live' : 'Scheduled',
            homeML: null,
            awayML: null,
            spread: null,
            total: null,
            bookmaker: null,
          };
        });

      setTodaysGames(games);

    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Failed to fetch NCAA today\'s games:', err);
      setTodaysGamesError('Failed to load today\'s games. Please try again.');
    } finally {
      if (todaysGamesAbortControllerRef.current === controller) {
        todaysGamesAbortControllerRef.current = null;
        setTodaysGamesLoading(false);
      }
    }
  };

  // Fetch odds for a single game from ESPN
  const fetchESPNOdds = async (eventId, signal) => {
    try {
      const config = espnOddsConfig[sport];
      if (!config) return null;

      const url = `https://sports.core.api.espn.com/v2/sports/${config.sport}/leagues/${config.league}/events/${eventId}/competitions/${eventId}/odds`;
      const response = await fetch(url, { signal });
      if (!response.ok) return null;

      const data = await response.json();
      if (!data.items || data.items.length === 0) return null;

      const oddsItem = data.items[0];
      const provider = oddsItem.provider?.name || 'ESPN';

      const homeML = oddsItem.homeTeamOdds?.moneyLine;
      const awayML = oddsItem.awayTeamOdds?.moneyLine;
      const spread = oddsItem.spread;
      const spreadOdds = oddsItem.homeTeamOdds?.spreadOdds;
      const spreadOdds2 = oddsItem.awayTeamOdds?.spreadOdds;
      const total = oddsItem.overUnder;
      const overOdds = oddsItem.overOdds;
      const underOdds = oddsItem.underOdds;

      return {
        homeML: homeML || null,
        awayML: awayML || null,
        spread: spread || null,
        spreadOdds: spreadOdds || -110,
        spreadOdds2: spreadOdds2 || -110,
        total: total || null,
        overOdds: overOdds || -110,
        underOdds: underOdds || -110,
        bookmaker: provider,
      };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.error('Failed to fetch ESPN odds for event', eventId, err);
      return null;
    }
  };

  const fetchTodaysGames = async (dateOverride = gamePickerDate) => {
    if (sportConfig[sport]?.useNcaaApi) {
      return fetchNCAATodaysGames(dateOverride);
    }

    todaysGamesAbortControllerRef.current?.abort();
    const controller = new AbortController();
    todaysGamesAbortControllerRef.current = controller;
    const { signal } = controller;

    setTodaysGamesLoading(true);
    setTodaysGames([]);
    setTodaysGamesError('');

    try {
      const dateStr = dateOverride.replace(/-/g, '');
      let extraParams = '';
      if (sport === 'cbb') extraParams = '&groups=50&limit=500';
      if (sport === 'cfb') extraParams = '&groups=80&limit=500';
      const url = `${espnEndpoints[sport]}?dates=${dateStr}${extraParams}`;

      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error('Failed to fetch games');

      const data = await response.json();
      if (signal.aborted) return;

      if (!data.events || data.events.length === 0) {
        return;
      }

      const upcomingEvents = data.events.filter(event => !event.competitions?.[0]?.status?.type?.completed);

      const games = upcomingEvents.map(event => {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        const homeName = homeTeam?.team?.displayName || homeTeam?.team?.name || 'Unknown';
        const awayName = awayTeam?.team?.displayName || awayTeam?.team?.name || 'Unknown';

        const matchedHome = matchTeamName(homeName, teams) || homeName;
        const matchedAway = matchTeamName(awayName, teams) || awayName;

        const gameDate = new Date(event.date);
        const timeStr = gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        return {
          id: event.id,
          homeTeam: matchedHome,
          awayTeam: matchedAway,
          espnHomeName: homeName,
          espnAwayName: awayName,
          time: timeStr,
          status: competition.status?.type?.shortDetail || 'Scheduled',
          homeML: null,
          awayML: null,
          spread: null,
          spreadOdds: null,
          spreadOdds2: null,
          total: null,
          overOdds: null,
          underOdds: null,
          bookmaker: null,
          sortTime: gameDate.getTime(),
        };
      }).sort((a, b) => (a.sortTime || 0) - (b.sortTime || 0));

      setTodaysGames(games);

      const gamesToFetchOdds = games.slice(0, 15);
      const oddsPromises = gamesToFetchOdds.map(game => fetchESPNOdds(game.id, signal));
      const oddsResults = await Promise.allSettled(oddsPromises);
      if (signal.aborted) return;

      const gamesWithOdds = games.map((game, index) => {
        const oddsResult = oddsResults[index];
        if (oddsResult?.status === 'fulfilled' && oddsResult.value) {
          return { ...game, ...oddsResult.value };
        }
        return game;
      });

      setTodaysGames(gamesWithOdds);

    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Failed to fetch today\'s games:', err);
      setTodaysGamesError('Failed to load today\'s games. Please try again.');
    } finally {
      if (todaysGamesAbortControllerRef.current === controller) {
        todaysGamesAbortControllerRef.current = null;
        setTodaysGamesLoading(false);
      }
    }
  };

  const selectGameFromPicker = (game) => {
    setTeam1(game.homeTeam);
    setTeam2(game.awayTeam);

    setBookML1('');
    setBookML2('');
    setBookSpread('');
    setBookSpreadOdds('-110');
    setBookSpreadOdds2('-110');
    setBookTotal('');
    setBookOverOdds('-110');
    setBookUnderOdds('-110');

    if (game.homeML !== null && game.homeML !== undefined) setBookML1(String(game.homeML));
    if (game.awayML !== null && game.awayML !== undefined) setBookML2(String(game.awayML));
    if (game.spread !== null && game.spread !== undefined) {
      setBookSpread(String(game.spread));
      if (game.spreadOdds !== null && game.spreadOdds !== undefined) setBookSpreadOdds(String(game.spreadOdds));
      if (game.spreadOdds2 !== null && game.spreadOdds2 !== undefined) setBookSpreadOdds2(String(game.spreadOdds2));
    }
    if (game.total !== null && game.total !== undefined) {
      setBookTotal(String(game.total));
      if (game.overOdds !== null && game.overOdds !== undefined) setBookOverOdds(String(game.overOdds));
      if (game.underOdds !== null && game.underOdds !== undefined) setBookUnderOdds(String(game.underOdds));
    }

    resetContextAdjustments();
    setIsNeutral(false);

    setShowGamePicker(false);
    setTodaysGamesError('');

    setAiInsights(null);
  };

  const applyAiSuggestions = () => {
    if (!aiInsights?.suggestions) return;
    const s = aiInsights.suggestions;
    if (s.team1Injury) setTeam1Injury(Math.max(-100, Math.min(0, s.team1Injury)));
    if (s.team1Rest) setTeam1Rest(Math.max(-30, Math.min(30, s.team1Rest)));
    if (s.team1Motivation) setTeam1Motivation(Math.max(-40, Math.min(40, s.team1Motivation)));
    if (s.team2Injury) setTeam2Injury(Math.max(-100, Math.min(0, s.team2Injury)));
    if (s.team2Rest) setTeam2Rest(Math.max(-30, Math.min(30, s.team2Rest)));
    if (s.team2Motivation) setTeam2Motivation(Math.max(-40, Math.min(40, s.team2Motivation)));
  };

  const analyzeMatchup = () => {
    if (!team1 || !team2 || !teams[team1] || !teams[team2]) return null;
    const c = sportConfig[sport]; const ha = isNeutral ? 0 : c.homeAdvantage;
    const t1 = teams[team1]; const t2 = teams[team2];
    const ri = c.ratingImpact || 1.0;

    const settledBets = bets.filter(b => b.result !== 'pending');
    const totalProfit = settledBets.reduce((sum, b) => sum + b.payout, 0);
    const pendingStaked = bets.filter(b => b.result === 'pending').reduce((sum, b) => sum + b.stake, 0);
    const liveBankroll = safeParseFloat(bankroll) + totalProfit - pendingStaked;
    const maxBet = liveBankroll * 0.05;

    const t1AdjElo = getAdjustedElo(t1.elo, team1Injury, team1Rest, team1Motivation);
    const t2AdjElo = getAdjustedElo(t2.elo, team2Injury, team2Rest, team2Motivation);

    const contextToOffDef = (eloAdj) => eloAdj * 0.05;
    const t1OffAdj = t1.off + contextToOffDef(team1Injury + team1Motivation);
    const t2OffAdj = t2.off + contextToOffDef(team2Injury + team2Motivation);
    const t1DefAdj = t1.def + contextToOffDef(team1Injury);
    const t2DefAdj = t2.def + contextToOffDef(team2Injury);

    const p1 = eloToWinProb(t1AdjElo, t2AdjElo, ha); const p2 = 1 - p1;
    const spread = predictSpread(t1AdjElo, t2AdjElo, ha);

    const offDefTotal = c.avgScore * (1 + ((t1OffAdj - 100) - (t2DefAdj - 100)) * ri / 100) +
                        c.avgScore * (1 + ((t2OffAdj - 100) - (t1DefAdj - 100)) * ri / 100);
    const total = offDefTotal;

    const margin = -spread;
    const eloSc1 = (total + margin) / 2;
    const eloSc2 = (total - margin) / 2;

    const offDefSc1 = c.avgScore * (1 + ((t1OffAdj - 100) - (t2DefAdj - 100)) * ri / 100);
    const offDefSc2 = c.avgScore * (1 + ((t2OffAdj - 100) - (t1DefAdj - 100)) * ri / 100);

    const sc1 = eloSc1;
    const sc2 = eloSc2;

    const bookSpreadVal = bookSpread?.trim() === '' ? null : safeParseFloat(bookSpread, null);
    const bookTotalVal = bookTotal?.trim() === '' ? null : safeParseFloat(bookTotal, null);
    const analyticalCoverProb = bookSpreadVal !== null ? spreadCoverProb(spread, bookSpreadVal, sportConfig[sport]) : null;
    const analyticalOverProb = bookTotalVal !== null ? totalProb(total, bookTotalVal, true, sportConfig[sport]) : null;

    let simulation = null;
    const simKey = JSON.stringify({
      sport,
      team1,
      team2,
      spread,
      total,
      bookSpreadVal,
      bookTotalVal,
      simulationRuns,
      t1AdjElo,
      t2AdjElo,
      team1Injury,
      team2Injury,
      team1Rest,
      team2Rest,
      team1Motivation,
      team2Motivation,
      isNeutral,
      showSimPercentiles
    });

    if (useSimulation) {
      simulation = simulationCacheRef.current[simKey];
      if (!simulation) {
        simulation = runScoreSimulations({
          predictedSpread: spread,
          predictedTotal: total,
          scoringVar: c.scoringVar,
          marginMult: c.marginMult || 1,
          simulations: simulationRuns,
          bookSpread: bookSpreadVal,
          bookTotal: bookTotalVal,
          includePercentiles: showSimPercentiles,
          skew: c.ratingImpact < 0.7 ? 0.05 : 0.12
        });
        if (Object.keys(simulationCacheRef.current).length > 100) {
          simulationCacheRef.current = {};
        }
        simulationCacheRef.current[simKey] = simulation;
      }
    }

    const probSource = useSimulation && simulation ? 'simulation' : 'analytical';
    let activeWinProbHome = probSource === 'simulation' ? simulation.team1WinRate : p1;
    let activeWinProbAway = probSource === 'simulation' ? simulation.team2WinRate : p2;
    let coverProbHome = probSource === 'simulation' && simulation?.spread ? simulation.spread.homeCover : analyticalCoverProb;
    let coverProbAway = probSource === 'simulation' && simulation?.spread ? simulation.spread.awayCover : (analyticalCoverProb !== null ? 1 - analyticalCoverProb : null);
    const coverPushProb = probSource === 'simulation' && simulation?.spread ? simulation.spread.push : 0;
    let overProbActive = probSource === 'simulation' && simulation?.totals ? simulation.totals.over : analyticalOverProb;
    let underProbActive = probSource === 'simulation' && simulation?.totals ? simulation.totals.under : (analyticalOverProb !== null ? 1 - analyticalOverProb : null);
    const totalPushProb = probSource === 'simulation' && simulation?.totals ? simulation.totals.push : 0;

    // Store raw model values before adjustments
    const rawWinProb = activeWinProbHome;
    const rawPredSpread = spread;
    const rawPredTotal = total;
    let adjustedSpread = spread;
    let adjustedTotal = total;

    // Apply shrinkage (NBA only) — blend model toward book lines
    const usingShrinkage = c.useShrinkage;
    if (usingShrinkage) {
      if (bookML1) {
        const bookImplied = americanToImpliedProb(bookML1);
        activeWinProbHome = applyShrinkage(activeWinProbHome, bookImplied, c.shrinkageML);
        activeWinProbAway = 1 - activeWinProbHome;
      }
      if (bookSpreadVal !== null) {
        adjustedSpread = applyShrinkage(spread, bookSpreadVal, c.shrinkageSpread);
        coverProbHome = spreadCoverProb(adjustedSpread, bookSpreadVal, sportConfig[sport]);
        coverProbAway = 1 - coverProbHome;
      }
      if (bookTotalVal !== null) {
        adjustedTotal = applyShrinkage(total, bookTotalVal, c.shrinkageTotal);
        overProbActive = totalProb(adjustedTotal, bookTotalVal, true, sportConfig[sport]);
        underProbActive = 1 - overProbActive;
      }
    }

    // Apply calibration (NBA only)
    const cal = sport === 'nba' ? loadCalibrationParams() : null;
    if (cal) {
      if (cal.ml) {
        activeWinProbHome = calibrateProb(activeWinProbHome, cal.ml);
        activeWinProbAway = 1 - activeWinProbHome;
      }
      if (cal.spread && coverProbHome !== null) {
        coverProbHome = calibrateProb(coverProbHome, cal.spread);
        coverProbAway = 1 - coverProbHome;
      }
      if (cal.total && overProbActive !== null) {
        overProbActive = calibrateProb(overProbActive, cal.total);
        underProbActive = 1 - overProbActive;
      }
    }

    let ml1 = null, ml2 = null;
    if (bookML1) {
      const imp = americanToImpliedProb(bookML1);
      const ev = calculateEV(activeWinProbHome,bookML1)*100;
      const kellyData = kellyStakeCapped(activeWinProbHome, bookML1, liveBankroll, safeParseFloat(kellyFraction), maxBet);
      ml1 = { edge: (activeWinProbHome-imp)*100, ev, kelly: kellyData.amount, kellyCapped: kellyData.wasCapped, kellyRaw: kellyData.rawAmount, isPositive: ev > 0, confidence: getConfidenceTier(ev), probSource };
    }
    if (bookML2) {
      const imp = americanToImpliedProb(bookML2);
      const ev = calculateEV(activeWinProbAway,bookML2)*100;
      const kellyData = kellyStakeCapped(activeWinProbAway, bookML2, liveBankroll, safeParseFloat(kellyFraction), maxBet);
      ml2 = { edge: (activeWinProbAway-imp)*100, ev, kelly: kellyData.amount, kellyCapped: kellyData.wasCapped, kellyRaw: kellyData.rawAmount, isPositive: ev > 0, confidence: getConfidenceTier(ev), probSource };
    }

    let spreadA = null;
    if (bookSpreadVal !== null && coverProbHome !== null) {
      const ev1 = calculateEV(coverProbHome, bookSpreadOdds) * 100;
      const awaySpread = -bookSpreadVal;
      const cp2 = coverProbAway !== null ? coverProbAway : 1 - coverProbHome;
      const ev2 = calculateEV(cp2, bookSpreadOdds2) * 100;
      const homeKellyData = kellyStakeCapped(coverProbHome, bookSpreadOdds, liveBankroll, safeParseFloat(kellyFraction), maxBet);
      const awayKellyData = kellyStakeCapped(cp2, bookSpreadOdds2, liveBankroll, safeParseFloat(kellyFraction), maxBet);
      spreadA = {
        predictedSpread: spread,
        adjustedSpread: usingShrinkage ? adjustedSpread : null,
        source: probSource,
        modelCoverProb: analyticalCoverProb !== null ? analyticalCoverProb * 100 : null,
        simCoverProb: simulation?.spread?.homeCover !== undefined && simulation?.spread?.homeCover !== null ? simulation.spread.homeCover * 100 : null,
        homeCoverProb: coverProbHome * 100,
        homeEV: ev1,
        homeKelly: homeKellyData.amount,
        homeKellyCapped: homeKellyData.wasCapped,
        homeKellyRaw: homeKellyData.rawAmount,
        homeSpread: bookSpreadVal,
        isHomePositive: ev1 > 0,
        homeConfidence: getConfidenceTier(ev1),
        awayCoverProb: cp2 * 100,
        awayEV: ev2,
        awayKelly: awayKellyData.amount,
        awayKellyCapped: awayKellyData.wasCapped,
        awayKellyRaw: awayKellyData.rawAmount,
        awaySpread: awaySpread,
        isAwayPositive: ev2 > 0,
        awayConfidence: getConfidenceTier(ev2),
        pushProb: coverPushProb * 100,
        value: spread - bookSpreadVal
      };
    }

    let totalA = null;
    if (bookTotalVal !== null && overProbActive !== null) {
      const overEV = calculateEV(overProbActive,bookOverOdds)*100;
      const underEV = calculateEV(underProbActive,bookUnderOdds)*100;
      const overKellyData = kellyStakeCapped(overProbActive, bookOverOdds, liveBankroll, safeParseFloat(kellyFraction), maxBet);
      const underKellyData = kellyStakeCapped(underProbActive, bookUnderOdds, liveBankroll, safeParseFloat(kellyFraction), maxBet);
      totalA = {
        predictedTotal: total,
        adjustedTotal: usingShrinkage ? adjustedTotal : null,
        source: probSource,
        modelOverProb: analyticalOverProb !== null ? analyticalOverProb * 100 : null,
        simOverProb: simulation?.totals?.over !== undefined && simulation?.totals?.over !== null ? simulation.totals.over * 100 : null,
        overProb: overProbActive*100,
        underProb: underProbActive*100,
        overEV,
        underEV,
        overKelly: overKellyData.amount,
        overKellyCapped: overKellyData.wasCapped,
        overKellyRaw: overKellyData.rawAmount,
        underKelly: underKellyData.amount,
        underKellyCapped: underKellyData.wasCapped,
        underKellyRaw: underKellyData.rawAmount,
        pushProb: totalPushProb * 100,
        value: total-bookTotalVal,
        isOverPositive: overEV>0,
        isUnderPositive: underEV>0,
        overConfidence: getConfidenceTier(overEV),
        underConfidence: getConfidenceTier(underEV)
      };
    }

    // === DIVERGENCE ANALYSIS: Compare Elo-based vs Off/Def-based predictions ===
    const insights = [];

    const eloMargin = sc1 - sc2;
    const offDefMargin = offDefSc1 - offDefSc2;

    const leagueAvgTotal = c.avgScore * 2;
    const offDefTotalCalc = offDefSc1 + offDefSc2;

    const thresholds = {
      nfl: { bigFav: 7, closeLine: 3, totalDiff: 4 },
      nba: { bigFav: 8, closeLine: 4, totalDiff: 6 },
      nhl: { bigFav: 1.0, closeLine: 0.3, totalDiff: 0.25 },
      cfb: { bigFav: 10, closeLine: 4, totalDiff: 5 },
      cbb: { bigFav: 8, closeLine: 4, totalDiff: 5 },
    };
    const th = thresholds[sport] || thresholds.nba;

    const marginDiff = Math.abs(eloMargin - offDefMargin);
    const totalDiff = offDefTotalCalc - leagueAvgTotal;

    const t1Short = team1.split(' ').pop();
    const t2Short = team2.split(' ').pop();

    // --- SPREAD/MARGIN DIVERGENCES ---
    if (Math.abs(eloMargin) > th.bigFav && Math.abs(offDefMargin) < th.closeLine) {
      const favored = eloMargin > 0 ? t1Short : t2Short;
      insights.push({
        type: 'spread',
        icon: '⚠️',
        color: 'text-amber-600',
        bg: 'bg-amber-50 border-amber-200',
        title: 'Spread May Be Too Wide',
        message: `Elo shows ${favored} as big favorite, but Off/Def suggests a close game. Consider the underdog or fade the spread.`
      });
    }

    if (Math.abs(eloMargin) < th.closeLine && Math.abs(offDefMargin) > th.bigFav) {
      const offDefFav = offDefMargin > 0 ? t1Short : t2Short;
      insights.push({
        type: 'spread',
        icon: '🎯',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-200',
        title: 'Potential Spread Value',
        message: `Elo shows a toss-up, but Off/Def suggests ${offDefFav} dominates. Spread might be too tight—consider the favorite.`
      });
    }

    const oppositeWinners = (eloMargin >= 0 && offDefMargin < 0) || (eloMargin <= 0 && offDefMargin > 0);
    const eitherMeaningful = Math.abs(eloMargin) > th.closeLine / 2 || Math.abs(offDefMargin) > th.closeLine / 2;
    if (oppositeWinners && eitherMeaningful) {
      const eloFav = eloMargin > 0 ? t1Short : t2Short;
      const offDefFav = offDefMargin > 0 ? t1Short : t2Short;
      insights.push({
        type: 'spread',
        icon: '🔀',
        color: 'text-purple-600',
        bg: 'bg-purple-50 border-purple-200',
        title: 'Conflicting Signals',
        message: `Elo favors ${eloFav}, but Off/Def favors ${offDefFav}. High uncertainty—consider smaller bets or pass.`
      });
    }

    if (marginDiff > th.bigFav * 0.7 && !insights.some(i => i.type === 'spread')) {
      const biggerModel = Math.abs(eloMargin) > Math.abs(offDefMargin) ? 'Elo' : 'Off/Def';
      const unit = sport === 'nhl' ? 'goal' : 'pt';
      insights.push({
        type: 'spread',
        icon: '📊',
        color: 'text-blue-600',
        bg: 'bg-blue-50 border-blue-200',
        title: 'Margin Disagreement',
        message: `${biggerModel} predicts a larger margin (${marginDiff.toFixed(1)} ${unit} difference). Models agree on winner but not dominance.`
      });
    }

    // --- TOTAL DIVERGENCES ---
    if (totalDiff > th.totalDiff) {
      insights.push({
        type: 'total',
        icon: '🔥',
        color: 'text-orange-600',
        bg: 'bg-orange-50 border-orange-200',
        title: 'Over Lean',
        message: `Matchup projects ${Math.abs(totalDiff).toFixed(1)} pts above league average (${leagueAvgTotal.toFixed(0)}). Check if book total reflects this—Over-friendly script.`
      });
    }

    if (totalDiff < -th.totalDiff) {
      insights.push({
        type: 'total',
        icon: '🧊',
        color: 'text-cyan-600',
        bg: 'bg-cyan-50 border-cyan-200',
        title: 'Under Lean',
        message: `Matchup projects ${Math.abs(totalDiff).toFixed(1)} pts below league average (${leagueAvgTotal.toFixed(0)}). Check if book total is inflated—Under-friendly script.`
      });
    }

    // --- MATCHUP-SPECIFIC INSIGHTS ---
    const t1ExpectedPts = offDefSc1;
    const t2ExpectedPts = offDefSc2;
    const avgPts = c.avgScore;

    const shootoutMult = sport === 'nhl' ? 1.04 : 1.15;
    const defensiveMult = sport === 'nhl' ? 0.96 : 0.85;

    if (t1ExpectedPts > avgPts * shootoutMult && t2ExpectedPts > avgPts * shootoutMult) {
      insights.push({
        type: 'total',
        icon: '💥',
        color: 'text-red-600',
        bg: 'bg-red-50 border-red-200',
        title: 'Shootout Alert',
        message: `Both teams projected well above average scoring. High-variance game—Over-friendly if book total is low.`
      });
    }

    if (t1ExpectedPts < avgPts * defensiveMult && t2ExpectedPts < avgPts * defensiveMult) {
      insights.push({
        type: 'total',
        icon: '🛡️',
        color: 'text-slate-600',
        bg: 'bg-slate-100 border-slate-300',
        title: 'Defensive Battle',
        message: `Both teams projected below average scoring. Low-variance grind—Under-friendly if book total is high.`
      });
    }

    const eliteThreshold = sport === 'nhl' ? 105 : 108;
    if ((t1OffAdj > eliteThreshold && t2DefAdj > eliteThreshold) || (t2OffAdj > eliteThreshold && t1DefAdj > eliteThreshold)) {
      const offTeam = t1OffAdj > t2OffAdj ? t1Short : t2Short;
      const defTeam = t1DefAdj > t2DefAdj ? t1Short : t2Short;
      if (offTeam !== defTeam) {
        insights.push({
          type: 'matchup',
          icon: '⚔️',
          color: 'text-indigo-600',
          bg: 'bg-indigo-50 border-indigo-200',
          title: 'Strength vs Strength',
          message: `${offTeam}'s elite offense meets ${defTeam}'s elite defense. Key matchup—watch for game script changes.`
        });
      }
    }

    const dominantHigh = sport === 'nhl' ? 104 : 105;
    const dominantLow = sport === 'nhl' ? 96 : 95;
    if (t1OffAdj >= dominantHigh && t1DefAdj >= dominantHigh && t2OffAdj <= dominantLow && t2DefAdj <= dominantLow) {
      insights.push({
        type: 'spread',
        icon: '🏆',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-200',
        title: 'Dominant Matchup',
        message: `${t1Short} superior in both offense AND defense. Strong favorite—consider ML or team total.`
      });
    } else if (t2OffAdj >= dominantHigh && t2DefAdj >= dominantHigh && t1OffAdj <= dominantLow && t1DefAdj <= dominantLow) {
      insights.push({
        type: 'spread',
        icon: '🏆',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-200',
        title: 'Dominant Matchup',
        message: `${t2Short} superior in both offense AND defense. Strong favorite—consider ML or team total.`
      });
    }

    if (Math.abs(spread) > th.bigFav && Math.abs(offDefMargin) < th.closeLine &&
        !insights.some(i => i.type === 'spread')) {
      insights.push({
        type: 'variance',
        icon: '🎲',
        color: 'text-pink-600',
        bg: 'bg-pink-50 border-pink-200',
        title: 'High Variance',
        message: `Large Elo gap but similar scoring tendencies. Upset potential exists—underdog ML might have value.`
      });
    }

    const offDefBigFav = sport === 'nhl' ? th.closeLine : th.bigFav;
    if (Math.abs(eloMargin) > th.bigFav && Math.abs(offDefMargin) > offDefBigFav &&
        Math.sign(eloMargin) === Math.sign(offDefMargin) && marginDiff < th.bigFav) {
      const favored = eloMargin > 0 ? t1Short : t2Short;
      insights.push({
        type: 'confidence',
        icon: '✅',
        color: 'text-green-600',
        bg: 'bg-green-50 border-green-200',
        title: 'High Confidence',
        message: `Both Elo and Off/Def strongly agree: ${favored} should dominate. Models aligned—higher conviction bet.`
      });
    }

    const probabilityBreakdown = {
      analytical: {
        winHome: p1 * 100,
        winAway: p2 * 100,
        coverHome: analyticalCoverProb !== null ? analyticalCoverProb * 100 : null,
        coverAway: analyticalCoverProb !== null ? (1 - analyticalCoverProb) * 100 : null,
        over: analyticalOverProb !== null ? analyticalOverProb * 100 : null,
        under: analyticalOverProb !== null ? (1 - analyticalOverProb) * 100 : null
      },
      simulation: simulation ? {
        winHome: simulation.team1WinRate * 100,
        winAway: simulation.team2WinRate * 100,
        coverHome: simulation.spread ? simulation.spread.homeCover * 100 : null,
        coverAway: simulation.spread ? simulation.spread.awayCover * 100 : null,
        pushSpread: simulation.spread ? simulation.spread.push * 100 : null,
        over: simulation.totals ? simulation.totals.over * 100 : null,
        under: simulation.totals ? simulation.totals.under * 100 : null,
        pushTotal: simulation.totals ? simulation.totals.push * 100 : null,
        averages: simulation.averages,
        percentiles: simulation.percentiles
      } : null,
      active: probSource
    };

    return {
      team1WinProb: activeWinProbHome*100,
      team2WinProb: activeWinProbAway*100,
      team1FairOdds: probToAmerican(activeWinProbHome),
      team2FairOdds: probToAmerican(activeWinProbAway),
      predSpread: spread,
      predTotal: total,
      team1PredScore: sc1,
      team2PredScore: sc2,
      team1OffDefScore: offDefSc1,
      team2OffDefScore: offDefSc2,
      ml1Analysis: ml1,
      ml2Analysis: ml2,
      spreadAnalysis: spreadA,
      totalsAnalysis: totalA,
      t1AdjElo,
      t2AdjElo,
      insights,
      liveBankroll,
      maxBet,
      probabilityBreakdown,
      simulationSummary: simulation,
      probabilitySource: probSource,
      // Shrinkage info (NBA only)
      shrinkageApplied: usingShrinkage,
      rawWinProb: rawWinProb * 100,
      rawPredSpread: rawPredSpread,
      rawPredTotal: rawPredTotal,
      adjustedPredSpread: usingShrinkage ? adjustedSpread : null,
      adjustedPredTotal: usingShrinkage ? adjustedTotal : null,
      calibrationApplied: !!cal,
    };
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  const analysis = useMemo(
    () => analyzeMatchup(),
    [
      team1,
      team2,
      teams,
      sport,
      isNeutral,
      team1Injury,
      team2Injury,
      team1Rest,
      team2Rest,
      team1Motivation,
      team2Motivation,
      bets,
      bankroll,
      kellyFraction,
      bookML1,
      bookML2,
      bookSpread,
      bookSpreadOdds,
      bookSpreadOdds2,
      bookTotal,
      bookOverOdds,
      bookUnderOdds,
      useSimulation,
      simulationRuns,
      showSimPercentiles
    ]
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const teamList = Object.keys(teams).sort((a, b) => teams[b].elo - teams[a].elo);

  return {
    // State
    team1, setTeam1,
    team2, setTeam2,
    isNeutral, setIsNeutral,
    team1Injury, setTeam1Injury,
    team2Injury, setTeam2Injury,
    team1Rest, setTeam1Rest,
    team2Rest, setTeam2Rest,
    team1Motivation, setTeam1Motivation,
    team2Motivation, setTeam2Motivation,
    bookML1, setBookML1,
    bookML2, setBookML2,
    bookSpread, setBookSpread,
    bookSpreadOdds, setBookSpreadOdds,
    bookSpreadOdds2, setBookSpreadOdds2,
    bookTotal, setBookTotal,
    bookOverOdds, setBookOverOdds,
    bookUnderOdds, setBookUnderOdds,
    useSimulation, setUseSimulation,
    simulationRuns, setSimulationRuns,
    showSimPercentiles, setShowSimPercentiles,
    todaysGames,
    todaysGamesLoading,
    todaysGamesError, setTodaysGamesError,
    showGamePicker, setShowGamePicker,
    gamePickerDate, setGamePickerDate,
    gamePickerDialogRef,
    useAutoInjuries, setUseAutoInjuries,
    team1Injuries, team2Injuries,
    team1InjuryAuto, team2InjuryAuto,
    injuriesLoading, injuriesError,
    // Functions
    resetContextAdjustments,
    fetchTodaysGames,
    selectGameFromPicker,
    applyAiSuggestions,
    // Computed
    analysis,
    teamList,
    gameLog,
  };
};
