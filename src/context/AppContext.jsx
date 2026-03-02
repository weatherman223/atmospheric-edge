import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { sportConfig } from '../config';
import { getInitialTeams } from '../utils/elo';
import { inferGameSport } from '../utils/teamMatcher';
import { loadAppState, saveAppState } from '../utils/storage';
import { useBets } from '../hooks/useBets';
import { useAiInsights } from '../hooks/useAiInsights';
import { useEspnImport } from '../hooks/useEspnImport';

const AppContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

export const AppProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState('analyze');
  const [sport, setSport] = useState('nfl');
  const [teams, setTeams] = useState({});
  const [gameLog, setGameLog] = useState([]);
  const [bankroll, setBankroll] = useState('1000');
  const [kellyFraction, setKellyFraction] = useState('0.25');
  const [privacyMode, setPrivacyMode] = useState(false);

  // Bet Tracker (custom hook)
  const betsHook = useBets(sport);
  const { bets, setBets } = betsHook;

  // AI Insights (custom hook)
  const aiHook = useAiInsights(sport);
  const { aiModel, setAiModel, enableWebSearch, setEnableWebSearch } = aiHook;

  // ESPN/NCAA Import & Ratings (custom hook)
  const espnHook = useEspnImport({ sport, teams, setTeams, gameLog, setGameLog });

  // Track sport transitions to prevent race conditions
  const lastSavedSportRef = useRef(sport);
  const isInitialMount = useRef(true);
  const teamsSportRef = useRef(sport);
  const suppressPersistRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    const data = loadAppState();
    if (data) {
      try {
        const persistedPrivacyMode = data.privacyMode === true;
        const savedSport = typeof data.sport === 'string' && sportConfig[data.sport] ? data.sport : 'nfl';
        const teamsBySport = (data.teamsBySport && typeof data.teamsBySport === 'object' && !Array.isArray(data.teamsBySport))
          ? data.teamsBySport
          : {};
        setPrivacyMode(persistedPrivacyMode);

        if (!persistedPrivacyMode && Array.isArray(data.bets)) setBets(data.bets);
        if (persistedPrivacyMode) {
          setBets([]);
          setGameLog([]);
        }
        if (!persistedPrivacyMode && Array.isArray(data.gameLog)) {
          let didBackfillSport = false;
          const normalizedGameLog = data.gameLog.map((gameEntry) => {
            if (!gameEntry || typeof gameEntry !== 'object') return gameEntry;
            const inferredSport = inferGameSport(gameEntry, teamsBySport);
            if (!gameEntry.sport && inferredSport) {
              didBackfillSport = true;
              return { ...gameEntry, sport: inferredSport };
            }
            return gameEntry;
          });
          setGameLog(normalizedGameLog);

          // Migrate legacy API key from main blob to its own localStorage key
          if (data.openRouterApiKey && !localStorage.getItem('openRouterApiKey')) {
            localStorage.setItem('openRouterApiKey', data.openRouterApiKey);
          }

          if (didBackfillSport) {
            const { openRouterApiKey: _legacyApiKey, ...persistableData } = data;
            saveAppState({
              ...persistableData,
              privacyMode: persistedPrivacyMode,
              teamsBySport,
              gameLog: normalizedGameLog
            });
          }
        }
        if (!persistedPrivacyMode && (typeof data.bankroll === 'string' || typeof data.bankroll === 'number')) {
          setBankroll(String(data.bankroll));
        }
        if (typeof data.kellyFraction === 'string' || typeof data.kellyFraction === 'number') setKellyFraction(String(data.kellyFraction));
        if (typeof data.aiModel === 'string') setAiModel(data.aiModel);
        if (typeof data.enableWebSearch === 'boolean') setEnableWebSearch(data.enableWebSearch);
        if (savedSport !== sport) {
          setSport(savedSport);
        }
        lastSavedSportRef.current = savedSport;
        teamsSportRef.current = savedSport;

        const savedTeams = teamsBySport[savedSport];
        if (savedTeams && typeof savedTeams === 'object' && !Array.isArray(savedTeams)) {
          setTeams(savedTeams);
          teamsSportRef.current = savedSport;
        } else {
          setTeams(getInitialTeams(savedSport));
          teamsSportRef.current = savedSport;
        }
      } catch {
        console.error('Failed to load saved data');
        setTeams(getInitialTeams(sport));
        teamsSportRef.current = sport;
      }
    } else {
      setTeams(getInitialTeams(sport));
      teamsSportRef.current = sport;
    }
    isInitialMount.current = false;
  // Mount-only effect that loads persisted state. Including setters would cause infinite loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to localStorage whenever key state changes
  useEffect(() => {
    if (suppressPersistRef.current) { suppressPersistRef.current = false; return; }
    if (isInitialMount.current) return;
    if (Object.keys(teams).length === 0) return;
    if (teamsSportRef.current !== sport) return;

    const existing = loadAppState();
    const existingTeamsBySport = existing?.teamsBySport || {};
    const teamsBySport = { ...existingTeamsBySport, [sport]: teams };
    saveAppState({
      teamsBySport,
      kellyFraction,
      aiModel,
      enableWebSearch,
      sport,
      privacyMode,
      ...(privacyMode ? { bets: [], gameLog: [] } : { bets, gameLog, bankroll })
    });
    lastSavedSportRef.current = sport;
  }, [teams, bets, gameLog, bankroll, kellyFraction, aiModel, enableWebSearch, sport, privacyMode]);

  // Load teams when sport changes
  useEffect(() => {
    if (isInitialMount.current) return;

    const saved = loadAppState();
    if (saved?.teamsBySport?.[sport]) {
      setTeams(saved.teamsBySport[sport]);
      teamsSportRef.current = sport;
      return;
    }
    setTeams(getInitialTeams(sport));
    teamsSportRef.current = sport;
  }, [sport]);

  // Atomically reset a sport's data without triggering the persistence useEffect race
  const resetSportData = ({ teams: newTeams, bets: newBets, gameLog: newGameLog }) => {
    suppressPersistRef.current = true;
    setTeams(newTeams);
    teamsSportRef.current = sport;
    setBets(newBets);
    setGameLog(newGameLog);

    const existing = loadAppState() || {};
    const existingTeamsBySport = existing?.teamsBySport || {};
    const teamsBySport = { ...existingTeamsBySport, [sport]: newTeams };
    saveAppState({
      ...existing,
      teamsBySport,
      kellyFraction,
      aiModel,
      enableWebSearch,
      sport,
      privacyMode,
      ...(privacyMode ? { bets: [], gameLog: [] } : { bets: newBets, gameLog: newGameLog, bankroll })
    });
  };

  const value = {
    activeTab, setActiveTab,
    sport, setSport,
    teams, setTeams,
    gameLog, setGameLog,
    bankroll, setBankroll,
    kellyFraction, setKellyFraction,
    privacyMode, setPrivacyMode,
    teamsSportRef,
    isInitialMount,
    resetSportData,
    // --- betsHook properties ---
    // bets, setBets, newBet, setNewBet, editingBet, setEditingBet,
    // addBetError, addBet, updateBetResult, deleteBet,
    // startEditBet, saveEditBet, cancelEditBet
    ...betsHook,
    // --- aiHook properties ---
    // aiInsights, setAiInsights, aiInsightsLoading,
    // showAiInsights, setShowAiInsights,
    // openRouterApiKey, setOpenRouterApiKey,
    // aiModel, setAiModel, enableWebSearch, setEnableWebSearch,
    // fetchAiInsights
    ...aiHook,
    // --- espnHook properties ---
    // importDate, setImportDate, espnGames, setEspnGames,
    // selectedGames, setSelectedGames, importLoading, importError,
    // seasonImportProgress, updateRatings, deleteGameFromLog,
    // fetchESPNScores, importSelectedGames, importFullSeason,
    // toggleSelectAll, selectAllIncludingDuplicates
    ...espnHook,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
