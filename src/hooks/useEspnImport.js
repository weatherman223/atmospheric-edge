import { useEffect, useRef, useState } from 'react';
import {
  sportConfig,
  ncaaApiBase,
  ncaaApiConfig,
  espnEndpoints,
  seasonStartDates,
  conferenceTiers,
} from '../config';
import { debugLog } from '../utils/debug';
import { getLocalDateString } from '../utils/date';
import { matchTeamName, normalizeGameDate, buildGameIdentity } from '../utils/teamMatcher';
import {
  getInitialTeams,
  getGamesPlayedFromLog,
  getGamesPlayedByTeam,
  applyGameResult,
} from '../utils/elo';

export const useEspnImport = ({ sport, teams, setTeams, gameLog, setGameLog }) => {
  const [importDate, setImportDate] = useState(getLocalDateString());
  const [espnGames, setEspnGames] = useState([]);
  const [selectedGames, setSelectedGames] = useState({});
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [seasonImportProgress, setSeasonImportProgress] = useState('');

  // Keep a ref in sync with gameLog so isDuplicateGame avoids stale closures during async imports
  const gameLogRef = useRef(gameLog);
  useEffect(() => { gameLogRef.current = gameLog; }, [gameLog]);

  const updateRatings = (resultTeam1, resultTeam2, score1, score2, isOTFlag) => {
    if (!resultTeam1 || !resultTeam2 || score1 === '' || score2 === '') return;
    const c = sportConfig[sport];
    const isOvertimeResult = sport === 'nhl' && isOTFlag;
    const result = applyGameResult({
      currentTeams: teams,
      sportKey: sport,
      config: c,
      team1Name: resultTeam1,
      team2Name: resultTeam2,
      score1,
      score2,
      isOT: isOvertimeResult,
      homeTeamName: resultTeam1,
      gamesPlayedByTeam: {
        [resultTeam1]: getGamesPlayedFromLog(resultTeam1, gameLog),
        [resultTeam2]: getGamesPlayedFromLog(resultTeam2, gameLog),
      },
      useDynamicK: true,
      useConfidenceScale: true,
    });

    if (!result) return;

    setTeams(result.updatedTeams);

    setGameLog(prev => [...prev, {
      date: new Date().toLocaleDateString(),
      sport,
      team1: resultTeam1,
      team2: resultTeam2,
      score: `${result.score1}-${result.score2}${isOvertimeResult ? ' (OT)' : ''}`,
      eloChange: result.baseEloChange,
      isOT: isOvertimeResult,
      t1Changes: result.t1Changes,
      t2Changes: result.t2Changes
    }]);
  };

  // Delete a game from log and recalculate ratings for the CURRENT sport only
  const deleteGameFromLog = (indexToDelete) => {
    if (!confirm(`Delete this game? ${sportConfig[sport].name} ratings will be recalculated from the beginning. Other sports will be unaffected.`)) return;

    const c = sportConfig[sport];

    // Get initial teams as base, but preserve any teams that were added/imported
    const initialTeams = getInitialTeams(sport);
    let recalcTeams = {};

    // Reset all current teams for THIS sport to baseline
    for (const teamName of Object.keys(teams)) {
      if (initialTeams[teamName]) {
        recalcTeams[teamName] = JSON.parse(JSON.stringify(initialTeams[teamName]));
      } else {
        // Team was added manually or imported - reset to baseline
        recalcTeams[teamName] = { elo: 1500, off: 100, def: 100 };
      }
    }

    const newLog = [];
    // Track games played during recalculation for dynamic K and confidence weights
    let gamesPlayedTracker = {};

    // Walk through the original log in order, skipping the deleted index
    for (let idx = 0; idx < gameLog.length; idx++) {
      if (idx === indexToDelete) continue;
      const game = gameLog[idx];

      // Is this game for the CURRENT sport? (both teams must exist in recalcTeams)
      const t1InSport = !!recalcTeams[game.team1];
      const t2InSport = !!recalcTeams[game.team2];

      // If not a game for this sport, keep it exactly as-is
      if (!t1InSport || !t2InSport) {
        newLog.push(game);
        continue;
      }

      // Parse score (handles "110-105" and "3-2 (OT)")
      const scoreMatch = game.score?.match(/(\d+)-(\d+)/);
      if (!scoreMatch) {
        // If we somehow can't parse, just keep the original entry
        newLog.push(game);
        continue;
      }

      const recalculated = applyGameResult({
        currentTeams: recalcTeams,
        sportKey: sport,
        config: c,
        team1Name: game.team1,
        team2Name: game.team2,
        score1: scoreMatch[1],
        score2: scoreMatch[2],
        isOT: sport === 'nhl' && Boolean(game.isOT),
        homeTeamName: game.team1,
        gamesPlayedByTeam: gamesPlayedTracker,
        useDynamicK: true,
        useConfidenceScale: true,
      });

      if (!recalculated) {
        newLog.push(game);
        continue;
      }

      recalcTeams = recalculated.updatedTeams;
      gamesPlayedTracker = recalculated.gamesPlayedByTeam;

      // Push updated game entry with recalculated changes
      newLog.push({
        ...game,
        sport: game.sport || sport,
        eloChange: recalculated.baseEloChange,
        t1Changes: recalculated.t1Changes,
        t2Changes: recalculated.t2Changes
      });
    }

    setTeams(recalcTeams);
    setGameLog(newLog);
  };

  // Get starting Elo based on conference ID or name
  const getConferenceElo = (conferenceId, sportKey) => {
    // D3 sports use conference NAME (string), not ID
    if (sportKey === 'd3mb' || sportKey === 'd3wb') {
      if (!conferenceId) return 1350; // Default D3 Elo
      const elo = conferenceTiers[sportKey]?.[conferenceId];
      if (elo) {
        debugLog(`D3 Conference ${conferenceId} -> Elo ${elo}`);
        return elo;
      }
      debugLog(`D3 Conference ${conferenceId} not in tier list, using 1350`);
      return 1350; // Default for unknown D3 conferences
    }

    // ESPN sports use conference ID (number)
    if (!conferenceId || !conferenceTiers[sportKey]) {
      debugLog(`No conference tier found for ${conferenceId} in ${sportKey}, using 1200 (D2/D3/NAIA)`);
      return 1200; // Very low - likely D2/D3/NAIA exhibition opponent
    }
    const elo = conferenceTiers[sportKey][conferenceId];
    if (elo) {
      debugLog(`Conference ${conferenceId} in ${sportKey} -> Elo ${elo}`);
      return elo;
    }
    // Known conferenceId but not in our list - likely FCS for CFB, mid-major for CBB
    const fallback = sportKey === 'cfb' ? 1300 : 1400;
    debugLog(`Conference ${conferenceId} not in tier list for ${sportKey}, using ${fallback}`);
    return fallback;
  };

  // Check if a game already exists in the gameLog (duplicate detection)
  const isDuplicateGame = (team1, team2, score1, score2, date = '', eventId = null) => {
    const normalizedDate = normalizeGameDate(date);
    return gameLogRef.current.some(g => {
      if (eventId && g.eventId && String(g.eventId) === String(eventId)) {
        return true;
      }

      // Parse the existing game's score
      const scoreMatch = g.score.match(/(\d+)-(\d+)/);
      if (!scoreMatch) return false;
      const existingS1 = parseInt(scoreMatch[1]);
      const existingS2 = parseInt(scoreMatch[2]);

      if (normalizedDate) {
        const existingDate = normalizeGameDate(g.date);
        if (existingDate && existingDate !== normalizedDate) {
          return false;
        }
      }

      // Check both team orderings (home/away could be swapped)
      const matchOrder1 = g.team1 === team1 && g.team2 === team2 && existingS1 === score1 && existingS2 === score2;
      const matchOrder2 = g.team1 === team2 && g.team2 === team1 && existingS1 === score2 && existingS2 === score1;

      return matchOrder1 || matchOrder2;
    });
  };

  // Fetch scores from NCAA API for D3 sports
  const fetchNCAAScores = async () => {
    setImportLoading(true);
    setImportError('');
    setEspnGames([]);
    setSelectedGames({});

    try {
      const ncaaConfig = ncaaApiConfig[sport];
      if (!ncaaConfig) {
        throw new Error('Sport not configured for NCAA API');
      }

      const dateStr = importDate.replace(/-/g, '');
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);

      // NCAA API uses date format: /scoreboard/basketball-men/d3/2024/01/15/all-conf
      const url = `${ncaaApiBase}/scoreboard/${ncaaConfig.sport}/${ncaaConfig.division}/${year}/${month}/${day}/all-conf`;

      debugLog('Fetching NCAA:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`NCAA API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.games || data.games.length === 0) {
        setImportError('No games found for this date');
        setImportLoading(false);
        return;
      }

      // First pass: collect all team names and find missing ones
      const teamsToAdd = {};

      data.games
        .filter(gameWrapper => gameWrapper.game?.gameState === 'final')
        .forEach(gameWrapper => {
          const game = gameWrapper.game;
          const homeName = game.home?.names?.full || game.home?.names?.short || 'Unknown';
          const awayName = game.away?.names?.full || game.away?.names?.short || 'Unknown';
          // Get conference from first conference listed (primary conference)
          const homeConf = game.home?.conferences?.[0]?.conferenceName || null;
          const awayConf = game.away?.conferences?.[0]?.conferenceName || null;

          if (!matchTeamName(homeName, teams) && homeName !== 'Unknown') {
            const startingElo = getConferenceElo(homeConf, sport);
            debugLog(`Adding ${homeName} with conf=${homeConf}, startingElo=${startingElo}`);
            teamsToAdd[homeName] = { elo: startingElo, off: 100, def: 100, conference: homeConf };
          }
          if (!matchTeamName(awayName, teams) && awayName !== 'Unknown') {
            const startingElo = getConferenceElo(awayConf, sport);
            debugLog(`Adding ${awayName} with conf=${awayConf}, startingElo=${startingElo}`);
            teamsToAdd[awayName] = { elo: startingElo, off: 100, def: 100, conference: awayConf };
          }
        });

      // Add missing teams if any
      const addedTeamNames = Object.keys(teamsToAdd);
      if (addedTeamNames.length > 0) {
        setTeams(prev => ({ ...prev, ...teamsToAdd }));
      }

      // Now map games
      const games = data.games
        .filter(gameWrapper => gameWrapper.game?.gameState === 'final')
        .map(gameWrapper => {
          const game = gameWrapper.game;
          const homeName = game.home?.names?.full || game.home?.names?.short || 'Unknown';
          const awayName = game.away?.names?.full || game.away?.names?.short || 'Unknown';
          const homeScore = parseInt(game.home?.score) || 0;
          const awayScore = parseInt(game.away?.score) || 0;

          const matchedHome = matchTeamName(homeName, teams) || (teamsToAdd[homeName] ? homeName : null);
          const matchedAway = matchTeamName(awayName, teams) || (teamsToAdd[awayName] ? awayName : null);

          const isDuplicate = matchedHome && matchedAway && isDuplicateGame(
            matchedHome,
            matchedAway,
            homeScore,
            awayScore,
            importDate,
            game.gameID
          );

          return {
            id: game.gameID || `${homeName}-${awayName}-${dateStr}`,
            espnHome: homeName,
            espnAway: awayName,
            homeScore,
            awayScore,
            matchedHome,
            matchedAway,
            canImport: matchedHome && matchedAway,
            isDuplicate,
            isOT: game.currentPeriod?.includes('OT') || false,
            newTeams: [
              teamsToAdd[homeName] ? homeName : null,
              teamsToAdd[awayName] ? awayName : null
            ].filter(Boolean)
          };
        });

      if (games.length === 0) {
        setImportError('No completed games found for this date');
      } else {
        setEspnGames(games);
        // Auto-select games that can be imported AND are not duplicates
        const autoSelected = {};
        games.forEach(g => {
          if (g.canImport && !g.isDuplicate) autoSelected[g.id] = true;
        });
        setSelectedGames(autoSelected);

        // Notify user about added teams and duplicates
        const duplicateCount = games.filter(g => g.isDuplicate).length;
        if (addedTeamNames.length > 0 || duplicateCount > 0) {
          let message = '';
          if (addedTeamNames.length > 0) {
            message = `Auto-added ${addedTeamNames.length} new team(s) with conference-based starting Elo: ${addedTeamNames.slice(0, 5).join(', ')}${addedTeamNames.length > 5 ? ` and ${addedTeamNames.length - 5} more` : ''}`;
          }
          if (duplicateCount > 0) {
            message += message ? ` • ${duplicateCount} duplicate(s) detected` : `${duplicateCount} duplicate game(s) already in log`;
          }
          setImportError(message);
        }
      }
    } catch (err) {
      setImportError(`Error: ${err.message}`);
    }

    setImportLoading(false);
  };

  // Import full season from NCAA API for D3 sports (date-by-date with rate limiting)
  const importNCAAFullSeason = async () => {
    const config = sportConfig[sport];
    if (!confirm(`This will import ALL ${config.name} games from the start of the season to today. This may take several minutes due to API rate limits (5 req/sec). Continue?`)) return;

    setImportLoading(true);
    setSeasonImportProgress('Starting NCAA season import...');
    setImportError('');

    const ncaaConfig = ncaaApiConfig[sport];
    if (!ncaaConfig) {
      setImportError('Sport not configured for NCAA API');
      setImportLoading(false);
      return;
    }

    try {
      const startDateStr = seasonStartDates[sport];
      const startDate = new Date(startDateStr.substring(0, 4), parseInt(startDateStr.substring(4, 6)) - 1, parseInt(startDateStr.substring(6, 8)));
      const today = new Date();

      // Generate list of dates to fetch
      const datesToFetch = [];
      let currentDate = new Date(startDate);
      while (currentDate <= today) {
        datesToFetch.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      let currentTeams = { ...teams };
      const newGameLog = [];
      const existingGameKeys = new Set(
        gameLog
          .map(g => {
            const scoreMatch = g.score?.match(/(\d+)-(\d+)/);
            if (!scoreMatch) return null;
            return buildGameIdentity({
              team1: g.team1,
              team2: g.team2,
              score1: parseInt(scoreMatch[1], 10),
              score2: parseInt(scoreMatch[2], 10),
              date: g.date,
              eventId: g.eventId
            });
          })
          .filter(Boolean)
      );
      let addedTeamsCount = 0;
      let importedCount = 0;
      let fetchedDates = 0;
      let seasonGamesPlayed = {};

      // Process dates in batches to respect rate limit
      for (const date of datesToFetch) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        setSeasonImportProgress(`Fetching ${month}/${day}/${year} (${fetchedDates + 1}/${datesToFetch.length})...`);

        try {
          const url = `${ncaaApiBase}/scoreboard/${ncaaConfig.sport}/${ncaaConfig.division}/${year}/${month}/${day}/all-conf`;
          const response = await fetch(url);

          if (response.ok) {
            const data = await response.json();

            if (data.games && data.games.length > 0) {
              const completedGames = data.games
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

              // Process each game
              for (const game of completedGames) {
                // Add missing teams
                if (!currentTeams[game.espnHome] && game.espnHome !== 'Unknown') {
                  const startingElo = getConferenceElo(game.homeConf, sport);
                  currentTeams[game.espnHome] = { elo: startingElo, off: 100, def: 100, conference: game.homeConf };
                  addedTeamsCount++;
                }
                if (!currentTeams[game.espnAway] && game.espnAway !== 'Unknown') {
                  const startingElo = getConferenceElo(game.awayConf, sport);
                  currentTeams[game.espnAway] = { elo: startingElo, off: 100, def: 100, conference: game.awayConf };
                  addedTeamsCount++;
                }

                const homeName = game.espnHome;
                const awayName = game.espnAway;

                if (!currentTeams[homeName] || !currentTeams[awayName]) continue;

                const s1 = game.homeScore;
                const s2 = game.awayScore;
                const gameKey = buildGameIdentity({
                  team1: homeName,
                  team2: awayName,
                  score1: s1,
                  score2: s2,
                  date: game.date
                });

                const isDupe = existingGameKeys.has(gameKey) || isDuplicateGame(homeName, awayName, s1, s2, game.date, game.id);
                if (isDupe) continue;
                existingGameKeys.add(gameKey);

                const applied = applyGameResult({
                  currentTeams,
                  sportKey: sport,
                  config,
                  team1Name: homeName,
                  team2Name: awayName,
                  score1: s1,
                  score2: s2,
                  isOT: Boolean(game.isOT),
                  homeTeamName: homeName,
                  gamesPlayedByTeam: seasonGamesPlayed,
                  useDynamicK: false,
                  useConfidenceScale: false,
                });
                if (!applied) continue;
                currentTeams = applied.updatedTeams;
                seasonGamesPlayed = applied.gamesPlayedByTeam;

                newGameLog.push({
                  eventId: game.id,
                  date: game.date,
                  sport,
                  team1: homeName,
                  team2: awayName,
                  score: `${applied.score1}-${applied.score2}${game.isOT ? ' OT' : ''}`,
                  eloChange: applied.winnerEloChange,
                  isOT: game.isOT,
                  t1Changes: applied.t1Changes,
                  t2Changes: applied.t2Changes
                });

                importedCount++;
              }
            }
          }
        } catch (err) {
          debugLog(`Error fetching ${month}/${day}/${year}:`, err.message);
          // Continue with next date
        }

        fetchedDates++;

        // Rate limiting: wait 200ms between requests to stay under 5/sec
        await new Promise(resolve => setTimeout(resolve, 200));

        // Progress update
        if (fetchedDates % 10 === 0) {
          setSeasonImportProgress(`Processed ${fetchedDates}/${datesToFetch.length} dates, ${importedCount} games imported...`);
        }
      }

      // Apply all updates at once
      setTeams(currentTeams);
      setGameLog(prev => [...prev, ...newGameLog]);

      setSeasonImportProgress('');
      alert(`NCAA Season import complete!\n\nImported: ${importedCount} games\nNew teams added: ${addedTeamsCount}`);

    } catch (err) {
      setImportError(`Error: ${err.message}`);
      setSeasonImportProgress('');
    }

    setImportLoading(false);
  };

  const fetchESPNScores = async () => {
    // Route D3 sports to NCAA API
    if (sportConfig[sport]?.useNcaaApi) {
      return fetchNCAAScores();
    }

    setImportLoading(true);
    setImportError('');
    setEspnGames([]);
    setSelectedGames({});

    try {
      const dateStr = importDate.replace(/-/g, '');
      // College sports need groups parameter to get all games, not just ranked teams
      // CFB: groups=80 for FBS, CBB: groups=50 for D1
      let extraParams = '';
      if (sport === 'cbb') extraParams = '&groups=50&limit=500';
      if (sport === 'cfb') extraParams = '&groups=80&limit=500';
      const url = `${espnEndpoints[sport]}?dates=${dateStr}${extraParams}`;

      debugLog('Fetching:', url); // Debug log

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ESPN returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.events || data.events.length === 0) {
        setImportError('No games found for this date');
        setImportLoading(false);
        return;
      }

      // First pass: collect all team names and find missing ones
      const teamsToAdd = {};

      // Debug: Log first event's team structure to see where conferenceId is
      if (data.events.length > 0) {
        const firstComp = data.events[0].competitions?.[0];
        const firstHome = firstComp?.competitors?.find(c => c.homeAway === 'home');
        debugLog('ESPN Team Structure Debug:', JSON.stringify(firstHome, null, 2));
        debugLog('Team object:', firstHome?.team);
        debugLog('conferenceId locations:', {
          'team.conferenceId': firstHome?.team?.conferenceId,
          'conferenceId': firstHome?.conferenceId,
          'team.conference': firstHome?.team?.conference,
        });
      }

      data.events
        .filter(event => event.competitions?.[0]?.status?.type?.completed === true)
        .forEach(event => {
          const competition = event.competitions[0];
          const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
          const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

          const homeName = homeTeam?.team?.displayName || homeTeam?.team?.name || 'Unknown';
          const awayName = awayTeam?.team?.displayName || awayTeam?.team?.name || 'Unknown';
          // Try multiple possible locations for conferenceId
          const homeConfId = homeTeam?.team?.conferenceId || homeTeam?.conferenceId || homeTeam?.team?.conference?.id;
          const awayConfId = awayTeam?.team?.conferenceId || awayTeam?.conferenceId || awayTeam?.team?.conference?.id;

          if (!matchTeamName(homeName, teams) && homeName !== 'Unknown') {
            const startingElo = getConferenceElo(homeConfId, sport);
            debugLog(`Adding ${homeName} with confId=${homeConfId}, startingElo=${startingElo}`);
            teamsToAdd[homeName] = { elo: startingElo, off: 100, def: 100, conferenceId: homeConfId };
          }
          if (!matchTeamName(awayName, teams) && awayName !== 'Unknown') {
            const startingElo = getConferenceElo(awayConfId, sport);
            debugLog(`Adding ${awayName} with confId=${awayConfId}, startingElo=${startingElo}`);
            teamsToAdd[awayName] = { elo: startingElo, off: 100, def: 100, conferenceId: awayConfId };
          }
        });

      // Add missing teams if any
      const addedTeamNames = Object.keys(teamsToAdd);
      if (addedTeamNames.length > 0) {
        setTeams(prev => ({ ...prev, ...teamsToAdd }));
      }

      // Now map games - all teams should match after adding missing ones
      const games = data.events
        .filter(event => {
          const competition = event.competitions?.[0];
          return competition?.status?.type?.completed === true;
        })
        .map(event => {
          const competition = event.competitions[0];
          const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
          const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

          const homeName = homeTeam?.team?.displayName || homeTeam?.team?.name || 'Unknown';
          const awayName = awayTeam?.team?.displayName || awayTeam?.team?.name || 'Unknown';
          const homeScore = parseInt(homeTeam?.score) || 0;
          const awayScore = parseInt(awayTeam?.score) || 0;

          // Detect overtime/shootout (NHL only - hockey has 3 periods, period 4+ is OT/SO)
          // Other sports have 4 quarters so period > 3 would incorrectly flag normal games
          const statusDetail = competition.status?.type?.detail || '';
          const period = competition.status?.period || 3;
          const isOT = sport === 'nhl' && (period > 3 || /OT|SO|Overtime|Shootout/i.test(statusDetail));

          // Check if we just added this team or it already existed
          const matchedHome = matchTeamName(homeName, teams) || (teamsToAdd[homeName] ? homeName : null);
          const matchedAway = matchTeamName(awayName, teams) || (teamsToAdd[awayName] ? awayName : null);

          // Check if this game is a duplicate (already in gameLog)
          const isDuplicate = matchedHome && matchedAway && isDuplicateGame(
            matchedHome,
            matchedAway,
            homeScore,
            awayScore,
            importDate,
            event.id
          );

          return {
            id: event.id,
            espnHome: homeName,
            espnAway: awayName,
            homeScore,
            awayScore,
            matchedHome,
            matchedAway,
            canImport: matchedHome && matchedAway,
            isDuplicate, // Track if game already exists in log
            isOT, // Track if game went to OT/SO
            newTeams: [
              teamsToAdd[homeName] ? homeName : null,
              teamsToAdd[awayName] ? awayName : null
            ].filter(Boolean)
          };
        });

      if (games.length === 0) {
        setImportError('No completed games found for this date');
      } else {
        setEspnGames(games);
        // Auto-select games that can be imported AND are not duplicates
        const autoSelected = {};
        games.forEach(g => {
          if (g.canImport && !g.isDuplicate) autoSelected[g.id] = true;
        });
        setSelectedGames(autoSelected);

        // Notify user about added teams and duplicates
        const duplicateCount = games.filter(g => g.isDuplicate).length;
        if (addedTeamNames.length > 0 || duplicateCount > 0) {
          let message = '';
          if (addedTeamNames.length > 0) {
            const tierNote = (sport === 'cbb' || sport === 'cfb') ? ' (with conference-based starting Elo)' : '';
            message = `Auto-added ${addedTeamNames.length} new team(s)${tierNote}: ${addedTeamNames.slice(0, 5).join(', ')}${addedTeamNames.length > 5 ? ` and ${addedTeamNames.length - 5} more` : ''}`;
          }
          if (duplicateCount > 0) {
            message += message ? ` • ${duplicateCount} duplicate(s) detected` : `${duplicateCount} duplicate game(s) already in log`;
          }
          setImportError(message);
        }
      }
    } catch (err) {
      setImportError(`Error: ${err.message}`);
    }

    setImportLoading(false);
  };

  const importSelectedGames = () => {
    const gamesToImport = espnGames.filter(g => selectedGames[g.id] && g.canImport);

    if (gamesToImport.length === 0) {
      alert('No valid games selected to import');
      return;
    }

    const c = sportConfig[sport];
    let currentTeams = { ...teams };
    let gamesPlayedByTeam = getGamesPlayedByTeam(gameLog);
    const newGameLogEntries = [];

    for (const game of gamesToImport) {
      const applied = applyGameResult({
        currentTeams,
        sportKey: sport,
        config: c,
        team1Name: game.matchedHome,
        team2Name: game.matchedAway,
        score1: game.homeScore,
        score2: game.awayScore,
        isOT: sport === 'nhl' && Boolean(game.isOT),
        homeTeamName: game.matchedHome,
        gamesPlayedByTeam,
        useDynamicK: true,
        useConfidenceScale: true,
      });
      if (!applied) continue;

      currentTeams = applied.updatedTeams;
      gamesPlayedByTeam = applied.gamesPlayedByTeam;

      newGameLogEntries.push({
        date: importDate,
        eventId: game.id,
        sport,
        team1: game.matchedHome,
        team2: game.matchedAway,
        score: `${applied.score1}-${applied.score2}${game.isOT ? ' OT' : ''}`,
        eloChange: applied.winnerEloChange,
        isOT: game.isOT,
        t1Changes: applied.t1Changes,
        t2Changes: applied.t2Changes
      });
    }

    if (newGameLogEntries.length === 0) {
      alert('No valid games selected to import');
      return;
    }

    setTeams(currentTeams);
    setGameLog(prev => [...prev, ...newGameLogEntries]);

    alert(`Successfully imported ${newGameLogEntries.length} game(s)!`);
    setEspnGames([]);
    setSelectedGames({});
  };

  const toggleSelectAll = () => {
    const importableGames = espnGames.filter(g => g.canImport);
    const allSelected = importableGames.every(g => selectedGames[g.id]);

    if (allSelected) {
      // Deselect all
      setSelectedGames({});
    } else {
      // Select all importable games
      const newSelection = {};
      importableGames.forEach(g => {
        newSelection[g.id] = true;
      });
      setSelectedGames(newSelection);
    }
  };

  const selectAllIncludingDuplicates = () => {
    const allGamesSelected = espnGames.every(g => selectedGames[g.id]);

    if (allGamesSelected) {
      // Deselect all
      setSelectedGames({});
    } else {
      // Select ALL games including duplicates
      const newSelection = {};
      espnGames.forEach(g => {
        newSelection[g.id] = true;
      });
      setSelectedGames(newSelection);
    }
  };

  // Import full season - fetches all games from season start to today
  const importFullSeason = async () => {
    // Route D3 sports to NCAA API
    if (sportConfig[sport]?.useNcaaApi) {
      return importNCAAFullSeason();
    }

    const sportName = sportConfig[sport]?.name || sport.toUpperCase();
    if (!confirm(`This will import ALL ${sportName} games from the start of the season to today. This may take a minute and will update all team ratings. Continue?`)) return;

    setImportLoading(true);
    setSeasonImportProgress('Starting season import...');
    setImportError('');

    const startDate = seasonStartDates[sport];
    const today = getLocalDateString().replace(/-/g, '');

    try {
      // Fetch the entire date range at once
      // College sports need groups parameter: CFB: groups=80 for FBS, CBB: groups=50 for D1
      let extraParams = '';
      if (sport === 'cbb') extraParams = '&groups=50';
      if (sport === 'cfb') extraParams = '&groups=80';
      const url = `${espnEndpoints[sport]}?dates=${startDate}-${today}&limit=1000${extraParams}`;
      setSeasonImportProgress(`Fetching games from ${startDate} to ${today}...`);

      debugLog('Fetching season:', url); // Debug log

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ESPN returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.events || data.events.length === 0) {
        setImportError('No games found for this season');
        setImportLoading(false);
        setSeasonImportProgress('');
        return;
      }

      // Filter to completed games only
      const completedGames = data.events
        .filter(event => event.competitions?.[0]?.status?.type?.completed === true)
        .map(event => {
          const competition = event.competitions[0];
          const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
          const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

          // Detect overtime/shootout (NHL only - hockey has 3 periods, period 4+ is OT/SO)
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
            // Try multiple locations for conferenceId
            homeConfId: homeTeam?.team?.conferenceId || homeTeam?.conferenceId || homeTeam?.team?.conference?.id,
            awayConfId: awayTeam?.team?.conferenceId || awayTeam?.conferenceId || awayTeam?.team?.conference?.id,
            isOT, // Track if game went to OT/SO
          };
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort chronologically

      // Debug: Log first game's conference info
      if (completedGames.length > 0) {
        debugLog('Season Import - First game conference IDs:', {
          home: completedGames[0].espnHome,
          homeConfId: completedGames[0].homeConfId,
          away: completedGames[0].espnAway,
          awayConfId: completedGames[0].awayConfId,
        });
      }

      setSeasonImportProgress(`Found ${completedGames.length} completed games. Processing...`);

      // Process games in order, updating ratings as we go
      let importedCount = 0;
      let addedTeamsCount = 0;
      let currentTeams = { ...teams };
      const newGameLog = [];
      const existingGameKeys = new Set(
        gameLog
          .map(g => {
            const scoreMatch = g.score?.match(/(\d+)-(\d+)/);
            if (!scoreMatch) return null;
            return buildGameIdentity({
              team1: g.team1,
              team2: g.team2,
              score1: parseInt(scoreMatch[1], 10),
              score2: parseInt(scoreMatch[2], 10),
              date: g.date
            });
          })
          .filter(Boolean)
      );
      const c = sportConfig[sport];
      let seasonGamesPlayed = getGamesPlayedByTeam(gameLog);

      // First pass: collect all unique teams and add missing ones with conference-based Elo
      const teamsToAdd = {};
      for (const game of completedGames) {
        const matchedHome = matchTeamName(game.espnHome, teams);
        const matchedAway = matchTeamName(game.espnAway, teams);

        if (!matchedHome && game.espnHome !== 'Unknown' && !currentTeams[game.espnHome] && !teamsToAdd[game.espnHome]) {
          const startingElo = getConferenceElo(game.homeConfId, sport);
          teamsToAdd[game.espnHome] = { elo: startingElo, off: 100, def: 100 };
        }
        if (!matchedAway && game.espnAway !== 'Unknown' && !currentTeams[game.espnAway] && !teamsToAdd[game.espnAway]) {
          const startingElo = getConferenceElo(game.awayConfId, sport);
          teamsToAdd[game.espnAway] = { elo: startingElo, off: 100, def: 100 };
        }
      }

      // Add missing teams to currentTeams
      addedTeamsCount = Object.keys(teamsToAdd).length;
      if (addedTeamsCount > 0) {
        currentTeams = { ...currentTeams, ...teamsToAdd };
        setSeasonImportProgress(`Added ${addedTeamsCount} new teams. Processing games...`);
      }

      // Second pass: process all games
      for (const game of completedGames) {
        // Try to match, or use ESPN name directly if we added the team
        const matchedHome = matchTeamName(game.espnHome, teams) || (currentTeams[game.espnHome] ? game.espnHome : null);
        const matchedAway = matchTeamName(game.espnAway, teams) || (currentTeams[game.espnAway] ? game.espnAway : null);

        if (!matchedHome || !matchedAway) {
          continue; // Shouldn't happen anymore, but just in case
        }

        const s1 = game.homeScore;
        const s2 = game.awayScore;
        const gameKey = buildGameIdentity({
          team1: matchedHome,
          team2: matchedAway,
          score1: s1,
          score2: s2,
          date: game.date
        });

        const isDupe = existingGameKeys.has(gameKey) || isDuplicateGame(matchedHome, matchedAway, s1, s2, game.date, game.id);
        if (isDupe) {
          continue;
        }
        existingGameKeys.add(gameKey);

        const applied = applyGameResult({
          currentTeams,
          sportKey: sport,
          config: c,
          team1Name: matchedHome,
          team2Name: matchedAway,
          score1: s1,
          score2: s2,
          isOT: sport === 'nhl' && Boolean(game.isOT),
          homeTeamName: matchedHome,
          gamesPlayedByTeam: seasonGamesPlayed,
          useDynamicK: false,
          useConfidenceScale: false,
        });
        if (!applied) {
          continue;
        }

        currentTeams = applied.updatedTeams;
        seasonGamesPlayed = applied.gamesPlayedByTeam;

        // Add to game log
        newGameLog.push({
          eventId: game.id,
          date: game.date,
          sport,
          team1: matchedHome,
          team2: matchedAway,
          score: `${applied.score1}-${applied.score2}${game.isOT ? ' OT' : ''}`,
          eloChange: applied.winnerEloChange,
          isOT: game.isOT,
          t1Changes: applied.t1Changes,
          t2Changes: applied.t2Changes
        });

        importedCount++;

        if (importedCount % 50 === 0) {
          setSeasonImportProgress(`Processed ${importedCount}/${completedGames.length} games...`);
        }
      }

      // Apply all updates at once
      setTeams(currentTeams);
      setGameLog(prev => [...prev, ...newGameLog]);

      setSeasonImportProgress('');
      alert(`Season import complete!\n\nImported: ${importedCount} games\nNew teams added: ${addedTeamsCount}`);

    } catch (err) {
      setImportError(`Error: ${err.message}`);
      setSeasonImportProgress('');
    }

    setImportLoading(false);
  };

  return {
    importDate, setImportDate,
    espnGames, setEspnGames,
    selectedGames, setSelectedGames,
    importLoading,
    importError,
    seasonImportProgress,
    updateRatings,
    deleteGameFromLog,
    fetchESPNScores,
    importSelectedGames,
    importFullSeason,
    toggleSelectAll,
    selectAllIncludingDuplicates,
  };
};
