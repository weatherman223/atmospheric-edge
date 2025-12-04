import React, { useEffect, useRef, useState } from 'react';
import {
  safeParseFloat,
  eloToWinProb,
  americanToImpliedProb,
  probToAmerican,
  americanToDecimal,
  calculateEV,
  kellyStake,
  kellyStakeCapped,
  spreadCoverProb,
  totalProb,
  getConfidenceTier
} from './utils/calculations';
import { runScoreSimulations } from './utils/simulations';

const SportsBettingModelPro = () => {
  const [activeTab, setActiveTab] = useState('analyze');
  const [sport, setSport] = useState('nfl');
  
  const [teams, setTeams] = useState({});
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
  const [bookSpreadOdds2, setBookSpreadOdds2] = useState('-110'); // Away team spread odds
  const [bookTotal, setBookTotal] = useState('');
  const [bookOverOdds, setBookOverOdds] = useState('-110');
  const [bookUnderOdds, setBookUnderOdds] = useState('-110');
  const [useSimulation, setUseSimulation] = useState(false);
  const [simulationRuns, setSimulationRuns] = useState(3500);
  const [showSimPercentiles, setShowSimPercentiles] = useState(true);
  const simulationCacheRef = useRef({});
  
  const [bankroll, setBankroll] = useState('1000');
  const [kellyFraction, setKellyFraction] = useState('0.25');
  
  const [resultTeam1, setResultTeam1] = useState('');
  const [resultTeam2, setResultTeam2] = useState('');
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isOT, setIsOT] = useState(false); // NHL overtime/shootout flag for manual entry
  const [gameLog, setGameLog] = useState([]);
  
  // Bet Tracker State
  const [bets, setBets] = useState([]);
  const [newBet, setNewBet] = useState({
    date: new Date().toISOString().split('T')[0],
    sport: 'nfl',
    game: '',
    betType: 'ML',
    pick: '',
    odds: '',
    stake: '',
    result: 'pending',
    payout: 0
  });

  // Add Team State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamElo, setNewTeamElo] = useState('1500');
  const [newTeamOff, setNewTeamOff] = useState('100');
  const [newTeamDef, setNewTeamDef] = useState('100');
  const [expandedTeam, setExpandedTeam] = useState(null);

  // ESPN Import State
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [espnGames, setEspnGames] = useState([]);
  const [selectedGames, setSelectedGames] = useState({});
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  // Today's Games Picker State (for Analyze tab)
  const [todaysGames, setTodaysGames] = useState([]);
  const [todaysGamesLoading, setTodaysGamesLoading] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);

  // AI Insights State
  const [aiInsights, setAiInsights] = useState(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [showAiInsights, setShowAiInsights] = useState(true);
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [aiModel, setAiModel] = useState('google/gemma-3-12b-it:free');
  const [enableWebSearch, setEnableWebSearch] = useState(false); // $0.02/request for live injury data

  // Sport-specific settings
  // NHL note: OT/SO games handled specially - loser loses only 25% Elo (they get standings point), winner gains 75%
  // College sports: marginCap limits blowout impact (beating cupcakes by 40 shouldn't boost Elo too much)
  // D3 sports: Use NCAA API instead of ESPN, lower home advantage due to smaller gyms
  const sportConfig = {
    nfl: { name: 'NFL 2025', homeAdvantage: 48, kFactor: 20, avgScore: 23, avgTotal: 46, spreadMultiplier: 0.04, scoringVar: 14, ratingImpact: 1.0, marginMult: 1 },
    nba: { name: 'NBA 2025-26', homeAdvantage: 30, kFactor: 20, avgScore: 118, avgTotal: 236, spreadMultiplier: 0.03, scoringVar: 12, ratingImpact: 0.6, marginMult: 1 },
    nhl: { name: 'NHL 2025-26', homeAdvantage: 22, kFactor: 22, avgScore: 3.1, avgTotal: 6.2, spreadMultiplier: 0.015, scoringVar: 1.5, ratingImpact: 0.8, marginMult: 4.5 },
    cfb: { name: 'CFB 2025', homeAdvantage: 55, kFactor: 18, avgScore: 28, avgTotal: 56, spreadMultiplier: 0.035, scoringVar: 16, ratingImpact: 1.0, marginMult: 1, marginCap: 21 },
    cbb: { name: 'CBB 2025-26', homeAdvantage: 35, kFactor: 20, avgScore: 72, avgTotal: 144, spreadMultiplier: 0.035, scoringVar: 10, ratingImpact: 0.6, marginMult: 1, marginCap: 15 },
    d3mb: { name: 'D3 Men\'s BBall', homeAdvantage: 28, kFactor: 22, avgScore: 70, avgTotal: 140, spreadMultiplier: 0.035, scoringVar: 11, ratingImpact: 0.6, marginMult: 1, marginCap: 18, useNcaaApi: true },
    d3wb: { name: 'D3 Women\'s BBall', homeAdvantage: 28, kFactor: 22, avgScore: 62, avgTotal: 124, spreadMultiplier: 0.035, scoringVar: 10, ratingImpact: 0.6, marginMult: 1, marginCap: 18, useNcaaApi: true },
  };

  // NCAA API configuration for D3 sports
  // Use Vite proxy in development to bypass CORS, direct URL in production
  const ncaaApiBase = import.meta.env.DEV ? '/ncaa-api' : 'https://ncaa-api.henrygd.me';
  const ncaaApiConfig = {
    d3mb: { sport: 'basketball-men', division: 'd3' },
    d3wb: { sport: 'basketball-women', division: 'd3' },
  };

  // Initial team data
  const getInitialTeams = (sportKey) => {
    const allTeams = {
      nfl: {
        'New England Patriots': { elo: 1680, off: 108, def: 88 },
        'Denver Broncos': { elo: 1660, off: 95, def: 84 },
        'Los Angeles Rams': { elo: 1660, off: 115, def: 92 },
        'Philadelphia Eagles': { elo: 1620, off: 105, def: 88 },
        'Chicago Bears': { elo: 1615, off: 102, def: 90 },
        'Seattle Seahawks': { elo: 1610, off: 108, def: 94 },
        'Indianapolis Colts': { elo: 1605, off: 105, def: 92 },
        'Green Bay Packers': { elo: 1585, off: 106, def: 94 },
        'San Francisco 49ers': { elo: 1575, off: 108, def: 92 },
        'Detroit Lions': { elo: 1570, off: 112, def: 96 },
        'Los Angeles Chargers': { elo: 1565, off: 100, def: 90 },
        'Jacksonville Jaguars': { elo: 1560, off: 98, def: 92 },
        'Buffalo Bills': { elo: 1555, off: 106, def: 96 },
        'Pittsburgh Steelers': { elo: 1530, off: 95, def: 90 },
        'Baltimore Ravens': { elo: 1525, off: 102, def: 102 },
        'Tampa Bay Buccaneers': { elo: 1520, off: 104, def: 100 },
        'Houston Texans': { elo: 1515, off: 95, def: 98 },
        'Kansas City Chiefs': { elo: 1510, off: 100, def: 98 },
        'Carolina Panthers': { elo: 1505, off: 96, def: 96 },
        'Dallas Cowboys': { elo: 1490, off: 100, def: 102 },
        'Minnesota Vikings': { elo: 1460, off: 100, def: 104 },
        'Atlanta Falcons': { elo: 1455, off: 96, def: 104 },
        'Arizona Cardinals': { elo: 1430, off: 98, def: 108 },
        'Washington Commanders': { elo: 1425, off: 94, def: 108 },
        'Cincinnati Bengals': { elo: 1480, off: 108, def: 106 },
        'Miami Dolphins': { elo: 1450, off: 102, def: 108 },
        'New Orleans Saints': { elo: 1400, off: 88, def: 110 },
        'New York Jets': { elo: 1390, off: 85, def: 108 },
        'Las Vegas Raiders': { elo: 1385, off: 86, def: 110 },
        'Cleveland Browns': { elo: 1380, off: 82, def: 108 },
        'New York Giants': { elo: 1370, off: 78, def: 112 },
        'Tennessee Titans': { elo: 1350, off: 80, def: 114 },
      },
      nba: {
        'Oklahoma City Thunder': { elo: 1720, off: 115, def: 92 },
        'Detroit Pistons': { elo: 1680, off: 110, def: 94 },
        'Denver Nuggets': { elo: 1620, off: 112, def: 98 },
        'Los Angeles Lakers': { elo: 1615, off: 110, def: 100 },
        'Toronto Raptors': { elo: 1610, off: 106, def: 94 },
        'Miami Heat': { elo: 1595, off: 104, def: 94 },
        'Houston Rockets': { elo: 1590, off: 108, def: 98 },
        'Cleveland Cavaliers': { elo: 1580, off: 108, def: 96 },
        'San Antonio Spurs': { elo: 1580, off: 106, def: 98 },
        'New York Knicks': { elo: 1565, off: 104, def: 96 },
        'Phoenix Suns': { elo: 1565, off: 110, def: 102 },
        'Orlando Magic': { elo: 1550, off: 100, def: 94 },
        'Minnesota Timberwolves': { elo: 1550, off: 102, def: 96 },
        'Atlanta Hawks': { elo: 1545, off: 108, def: 104 },
        'Boston Celtics': { elo: 1540, off: 110, def: 106 },
        'Golden State Warriors': { elo: 1540, off: 106, def: 104 },
        'Chicago Bulls': { elo: 1530, off: 102, def: 104 },
        'Philadelphia 76ers': { elo: 1525, off: 104, def: 106 },
        'Milwaukee Bucks': { elo: 1510, off: 106, def: 108 },
        'Portland Trail Blazers': { elo: 1500, off: 100, def: 106 },
        'Memphis Grizzlies': { elo: 1460, off: 102, def: 110 },
        'Utah Jazz': { elo: 1440, off: 98, def: 108 },
        'Los Angeles Clippers': { elo: 1430, off: 96, def: 110 },
        'Charlotte Hornets': { elo: 1420, off: 94, def: 110 },
        'Dallas Mavericks': { elo: 1420, off: 104, def: 112 },
        'Sacramento Kings': { elo: 1420, off: 102, def: 110 },
        'New Orleans Pelicans': { elo: 1400, off: 98, def: 112 },
        'Brooklyn Nets': { elo: 1400, off: 96, def: 112 },
        'Indiana Pacers': { elo: 1380, off: 100, def: 114 },
        'Washington Wizards': { elo: 1375, off: 96, def: 116 },
      },
      nhl: {
        'Colorado Avalanche': { elo: 1680, off: 115, def: 90 },
        'Carolina Hurricanes': { elo: 1620, off: 108, def: 90 },
        'New Jersey Devils': { elo: 1600, off: 110, def: 94 },
        'Tampa Bay Lightning': { elo: 1590, off: 108, def: 94 },
        'Winnipeg Jets': { elo: 1580, off: 108, def: 94 },
        'Dallas Stars': { elo: 1570, off: 104, def: 92 },
        'Florida Panthers': { elo: 1565, off: 106, def: 96 },
        'New York Islanders': { elo: 1555, off: 96, def: 94 },
        'Boston Bruins': { elo: 1550, off: 102, def: 94 },
        'Vegas Golden Knights': { elo: 1545, off: 106, def: 98 },
        'Detroit Red Wings': { elo: 1540, off: 100, def: 96 },
        'Minnesota Wild': { elo: 1535, off: 100, def: 96 },
        'Los Angeles Kings': { elo: 1530, off: 102, def: 98 },
        'Philadelphia Flyers': { elo: 1528, off: 100, def: 96 },
        'Montreal Canadiens': { elo: 1525, off: 102, def: 98 },
        'Pittsburgh Penguins': { elo: 1520, off: 104, def: 100 },
        'Seattle Kraken': { elo: 1520, off: 98, def: 94 },
        'New York Rangers': { elo: 1515, off: 100, def: 100 },
        'Ottawa Senators': { elo: 1510, off: 102, def: 102 },
        'Anaheim Ducks': { elo: 1505, off: 100, def: 100 },
        'Edmonton Oilers': { elo: 1495, off: 106, def: 108 },
        'Washington Capitals': { elo: 1490, off: 100, def: 104 },
        'Buffalo Sabres': { elo: 1480, off: 98, def: 104 },
        'St. Louis Blues': { elo: 1475, off: 98, def: 106 },
        'Vancouver Canucks': { elo: 1470, off: 96, def: 108 },
        'Toronto Maple Leafs': { elo: 1465, off: 108, def: 114 },
        'Columbus Blue Jackets': { elo: 1450, off: 94, def: 108 },
        'Nashville Predators': { elo: 1445, off: 92, def: 106 },
        'Utah Mammoth': { elo: 1440, off: 92, def: 106 },
        'Chicago Blackhawks': { elo: 1420, off: 90, def: 110 },
        'Calgary Flames': { elo: 1410, off: 84, def: 100 },
        'San Jose Sharks': { elo: 1400, off: 88, def: 112 },
      },
      cfb: {
      },
      cbb: {
      },
    };
    return allTeams[sportKey] || {};
  };

  // Track the last saved sport to prevent race conditions
  const lastSavedSportRef = React.useRef(sport);
  const isInitialMount = React.useRef(true);
  const teamsSportRef = React.useRef(sport); // Track which sport the current teams belong to

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sportsBettingModel');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.bets) setBets(data.bets);
        if (data.gameLog) setGameLog(data.gameLog);
        if (data.bankroll) setBankroll(data.bankroll);
        if (data.kellyFraction) setKellyFraction(data.kellyFraction);
        if (data.openRouterApiKey) setOpenRouterApiKey(data.openRouterApiKey);
        if (data.aiModel) setAiModel(data.aiModel);
        if (data.enableWebSearch !== undefined) setEnableWebSearch(data.enableWebSearch);
        if (data.sport) {
          setSport(data.sport);
          lastSavedSportRef.current = data.sport;
          teamsSportRef.current = data.sport;
        }
        // Load teams for the saved sport
        const savedSport = data.sport || 'nfl';
        if (data.teamsBySport && data.teamsBySport[savedSport]) {
          setTeams(data.teamsBySport[savedSport]);
          teamsSportRef.current = savedSport;
        } else {
          setTeams(getInitialTeams(savedSport));
          teamsSportRef.current = savedSport;
        }
      } catch (e) {
        console.error('Failed to load saved data');
        setTeams(getInitialTeams(sport));
        teamsSportRef.current = sport;
      }
    } else {
      setTeams(getInitialTeams(sport));
      teamsSportRef.current = sport;
    }
    isInitialMount.current = false;
  }, []);

  // Save to localStorage whenever key state changes
  useEffect(() => {
    // Skip saving on initial mount and during sport transitions
    if (isInitialMount.current) return;
    if (Object.keys(teams).length === 0) return;
    
    // Only save if the teams belong to the current sport (prevents saving wrong teams during transitions)
    if (teamsSportRef.current !== sport) {
      return; // Teams don't match current sport, skip save
    }
    
    const saved = localStorage.getItem('sportsBettingModel');
    let existingTeamsBySport = {};
    if (saved) {
      try {
        const data = JSON.parse(saved);
        existingTeamsBySport = data.teamsBySport || {};
      } catch (e) {}
    }
    // Update teams for current sport only
    const teamsBySport = { ...existingTeamsBySport, [sport]: teams };
    const data = { teamsBySport, bets, gameLog, bankroll, kellyFraction, openRouterApiKey, aiModel, enableWebSearch, sport };
    localStorage.setItem('sportsBettingModel', JSON.stringify(data));
    lastSavedSportRef.current = sport;
  }, [teams, bets, gameLog, bankroll, kellyFraction, openRouterApiKey, aiModel, enableWebSearch, sport]);

  // Load teams when sport changes
  useEffect(() => {
    if (isInitialMount.current) return; // Skip on mount, handled by first useEffect
    
    const saved = localStorage.getItem('sportsBettingModel');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.teamsBySport && data.teamsBySport[sport]) {
          setTeams(data.teamsBySport[sport]);
          teamsSportRef.current = sport; // Mark teams as belonging to this sport
          setTeam1('');
          setTeam2('');
          resetContextAdjustments();
          return;
        }
      } catch (e) {}
    }
    setTeams(getInitialTeams(sport));
    teamsSportRef.current = sport; // Mark teams as belonging to this sport
    setTeam1('');
    setTeam2('');
    resetContextAdjustments();
  }, [sport]);

  const resetContextAdjustments = () => {
    setTeam1Injury(0); setTeam2Injury(0);
    setTeam1Rest(0); setTeam2Rest(0);
    setTeam1Motivation(0); setTeam2Motivation(0);
  };

  const resetAllData = () => {
    const sportName = sportConfig[sport]?.name || sport.toUpperCase();
    if (confirm(`Reset all ${sportName} data including bets, ratings, and game log?\n\nThis will only affect ${sportName} - other sports will be preserved.`)) {
      // Load existing data
      const saved = localStorage.getItem('sportsBettingModel');
      let existingData = {};
      if (saved) {
        try {
          existingData = JSON.parse(saved);
        } catch {
          // Failed to parse saved data, use empty object
        }
      }

      // Only reset teams for current sport, preserve other sports
      const teamsBySport = { ...existingData.teamsBySport };
      teamsBySport[sport] = getInitialTeams(sport);

      // Filter out bets and game log entries for current sport
      const filteredBets = (existingData.bets || []).filter(bet => bet.sport !== sport);
      const filteredGameLog = (existingData.gameLog || []).filter(game => game.sport !== sport);

      // Save updated data
      const updatedData = {
        ...existingData,
        teamsBySport,
        bets: filteredBets,
        gameLog: filteredGameLog,
        sport
      };
      localStorage.setItem('sportsBettingModel', JSON.stringify(updatedData));

      // Update current state
      setTeams(getInitialTeams(sport));
      teamsSportRef.current = sport;
      setBets(filteredBets);
      setGameLog(filteredGameLog);
      setTeam1('');
      setTeam2('');
      resetContextAdjustments();
    }
  };

  // === CORE FUNCTIONS ===
  // Calculation utilities imported from ./utils/calculations.js
  
  const getAdjustedElo = (baseElo, injury, rest, motivation) => baseElo + injury + rest + motivation;
  
  // Regress off/def ratings toward 100 to prevent drift (10% per game)
  // Only for high-volume sports (NBA/CBB) where ratings can inflate over many games
  // Also applies tighter bounds for basketball (80-120 vs 70-130 for other sports)
  const regressRating = (val, sp) => {
    if (sp === 'nba' || sp === 'cbb') {
      const regressed = val * 0.925 + 100 * 0.075;
      return Math.round(Math.max(80, Math.min(120, regressed))); // Tighter bounds for basketball
    }
    return Math.round(val); // No regression for NFL/NHL/CFB
  };

  const predictSpread = (t1Elo, t2Elo, ha) => -((t1Elo + ha - t2Elo) * sportConfig[sport].spreadMultiplier);
  const predictTotal = (t1, t2) => {
    const c = sportConfig[sport];
    const ri = c.ratingImpact || 1.0;
    // High offense = score more, High opponent defense = score less
    const t1Scores = c.avgScore * (1 + ((t1.off - 100) - (t2.def - 100)) * ri / 100);
    const t2Scores = c.avgScore * (1 + ((t2.off - 100) - (t1.def - 100)) * ri / 100);
    return t1Scores + t2Scores;
  };

  const updateRatings = () => {
    if (!resultTeam1 || !resultTeam2 || score1 === '' || score2 === '') return;
    const c = sportConfig[sport]; 
    const s1 = parseInt(score1); 
    const s2 = parseInt(score2);
    const t1 = teams[resultTeam1];
    const t2 = teams[resultTeam2];
    
    // Elo change based on win/loss
    const winner = s1 > s2 ? resultTeam1 : resultTeam2; 
    const loser = s1 > s2 ? resultTeam2 : resultTeam1;
    const rawMov = Math.abs(s1-s2);
    const mov = c.marginCap ? Math.min(rawMov, c.marginCap) : rawMov; // Cap blowouts for college sports
    const exp = eloToWinProb(teams[winner].elo, teams[loser].elo);
    const baseEloChange = Math.round(c.kFactor * Math.min(Math.log(mov * (c.marginMult || 1) + 1)*0.8+1, 2.5) * (1-exp));
    
    // NHL OT/SO adjustment: winner gets 75%, loser loses only 25% (they got a point)
    let winnerEloChange = baseEloChange;
    let loserEloChange = baseEloChange;
    if (sport === 'nhl' && isOT) {
      winnerEloChange = Math.round(baseEloChange * 0.75);
      loserEloChange = Math.round(baseEloChange * 0.25);
    }
    
    // Expected scores based on current ratings
    const ri = c.ratingImpact || 1.0;
    const exp1 = c.avgScore * (1 + ((t1.off - 100) - (t2.def - 100)) * ri / 100);
    const exp2 = c.avgScore * (1 + ((t2.off - 100) - (t1.def - 100)) * ri / 100);
    
    // Offense/Defense adjustments based on actual vs expected
    const offScale = 0.3; // How much to adjust off/def ratings
    const t1OffDiff = Math.round((s1 - exp1) * offScale);
    const t2OffDiff = Math.round((s2 - exp2) * offScale);
    const t1DefDiff = Math.round((exp2 - s2) * offScale); // Good defense = opponent scores LESS than expected → def goes UP
    const t2DefDiff = Math.round((exp1 - s1) * offScale);
    
    // Determine which team is winner/loser for Elo application
    const t1EloChange = s1 > s2 ? winnerEloChange : -loserEloChange;
    const t2EloChange = s2 > s1 ? winnerEloChange : -loserEloChange;
    
    // Apply all changes
    setTeams(prev => ({ 
      ...prev, 
      [resultTeam1]: {
        ...prev[resultTeam1], 
        elo: prev[resultTeam1].elo + t1EloChange,
        off: regressRating(Math.max(70, Math.min(130, prev[resultTeam1].off + t1OffDiff)), sport),
        def: regressRating(Math.max(70, Math.min(130, prev[resultTeam1].def + t1DefDiff)), sport)
      }, 
      [resultTeam2]: {
        ...prev[resultTeam2], 
        elo: prev[resultTeam2].elo + t2EloChange,
        off: regressRating(Math.max(70, Math.min(130, prev[resultTeam2].off + t2OffDiff)), sport),
        def: regressRating(Math.max(70, Math.min(130, prev[resultTeam2].def + t2DefDiff)), sport)
      } 
    }));
    
    setGameLog(prev => [...prev, { 
      date: new Date().toLocaleDateString(), 
      team1: resultTeam1, 
      team2: resultTeam2, 
      score: `${s1}-${s2}${sport === 'nhl' && isOT ? ' (OT)' : ''}`, 
      eloChange: baseEloChange,
      isOT: sport === 'nhl' && isOT,
      t1Changes: { elo: t1EloChange, off: t1OffDiff, def: t1DefDiff },
      t2Changes: { elo: t2EloChange, off: t2OffDiff, def: t2DefDiff }
    }]);
    setResultTeam1(''); setResultTeam2(''); setScore1(''); setScore2(''); setIsOT(false);
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

      // --- Recalculate this game's impact on ratings for the current sport ---

      // Parse score (handles "110-105" and "3-2 (OT)")
      const scoreMatch = game.score.match(/(\d+)-(\d+)/);
      if (!scoreMatch) {
        // If we somehow can't parse, just keep the original entry
        newLog.push(game);
        continue;
      }

      const s1 = parseInt(scoreMatch[1], 10);
      const s2 = parseInt(scoreMatch[2], 10);

      const t1 = recalcTeams[game.team1];
      const t2 = recalcTeams[game.team2];

      // Elo change
      const winnerName = s1 > s2 ? game.team1 : game.team2;
      const loserName = s1 > s2 ? game.team2 : game.team1;
      const rawMov = Math.abs(s1 - s2);
      const mov = c.marginCap ? Math.min(rawMov, c.marginCap) : rawMov;

      const exp = eloToWinProb(recalcTeams[winnerName].elo, recalcTeams[loserName].elo);
      const baseEloChange = Math.round(c.kFactor * Math.min(Math.log(mov * (c.marginMult || 1) + 1) * 0.8 + 1, 2.5) * (1 - exp));

      // NHL OT/SO adjustment
      let winnerEloChange = baseEloChange;
      let loserEloChange = baseEloChange;
      if (sport === 'nhl' && game.isOT) {
        winnerEloChange = Math.round(baseEloChange * 0.75);
        loserEloChange = Math.round(baseEloChange * 0.25);
      }

      // Expected scores based on current ratings
      const ri = c.ratingImpact || 1.0;
      const exp1 = c.avgScore * (1 + ((t1.off - 100) - (t2.def - 100)) * ri / 100);
      const exp2 = c.avgScore * (1 + ((t2.off - 100) - (t1.def - 100)) * ri / 100);

      // Offense/Defense adjustments
      const offScale = 0.3;
      const t1OffDiff = Math.round((s1 - exp1) * offScale);
      const t2OffDiff = Math.round((s2 - exp2) * offScale);
      const t1DefDiff = Math.round((exp2 - s2) * offScale);
      const t2DefDiff = Math.round((exp1 - s1) * offScale);

      // Apply Elo changes for this game
      const t1EloChange = s1 > s2 ? winnerEloChange : -loserEloChange;
      const t2EloChange = s2 > s1 ? winnerEloChange : -loserEloChange;

      recalcTeams[game.team1] = {
        ...recalcTeams[game.team1],
        elo: recalcTeams[game.team1].elo + t1EloChange,
        off: regressRating(Math.max(70, Math.min(130, recalcTeams[game.team1].off + t1OffDiff)), sport),
        def: regressRating(Math.max(70, Math.min(130, recalcTeams[game.team1].def + t1DefDiff)), sport)
      };
      recalcTeams[game.team2] = {
        ...recalcTeams[game.team2],
        elo: recalcTeams[game.team2].elo + t2EloChange,
        off: regressRating(Math.max(70, Math.min(130, recalcTeams[game.team2].off + t2OffDiff)), sport),
        def: regressRating(Math.max(70, Math.min(130, recalcTeams[game.team2].def + t2DefDiff)), sport)
      };

      // Push updated game entry with recalculated changes
      newLog.push({
        ...game,
        eloChange: baseEloChange,
        t1Changes: { elo: t1EloChange, off: t1OffDiff, def: t1DefDiff },
        t2Changes: { elo: t2EloChange, off: t2OffDiff, def: t2DefDiff }
      });
    }

    setTeams(recalcTeams);
    setGameLog(newLog);
  };

  const adjustRating = (name, field, delta) => setTeams(prev => ({ ...prev, [name]: { ...prev[name], [field]: prev[name][field] + delta } }));

  // Add/Delete Team Functions
  const addTeam = () => {
    if (!newTeamName.trim()) return;
    if (teams[newTeamName.trim()]) {
      alert('Team already exists!');
      return;
    }
    setTeams(prev => ({
      ...prev,
      [newTeamName.trim()]: {
        elo: parseInt(newTeamElo) || 1500,
        off: parseInt(newTeamOff) || 100,
        def: parseInt(newTeamDef) || 100
      }
    }));
    setNewTeamName('');
    setNewTeamElo('1500');
    setNewTeamOff('100');
    setNewTeamDef('100');
  };

  const deleteTeam = (name) => {
    if (confirm(`Delete ${name}? This cannot be undone.`)) {
      setTeams(prev => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  // Reset all teams to baseline ratings
  const resetToBaseline = () => {
    const isCollege = sport === 'cbb' || sport === 'cfb';
    const message = isCollege 
      ? 'For college sports: This will DELETE all teams so they can be re-imported with conference-based starting Elo.\n\nAfter clicking OK, use "Import Full Season" to rebuild ratings.\n\nContinue?'
      : 'Reset ALL teams to 1500 Elo, 100 Off, 100 Def? This will wipe your custom ratings but keep your team list.';
    
    if (!confirm(message)) return;
    
    if (isCollege) {
      // For college sports, clear teams so they can be reimported with conference-based Elo
      setTeams({});
      teamsSportRef.current = sport; // Keep tracking this sport
    } else {
      // For pro sports, just reset to 1500
      setTeams(prev => {
        const reset = {};
        Object.keys(prev).forEach(name => {
          reset[name] = { elo: 1500, off: 100, def: 100 };
        });
        return reset;
      });
    }
    setGameLog([]); // Clear game log since ratings are reset
  };

  // ESPN Import Functions
  const espnEndpoints = {
    nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    cfb: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
    cbb: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  };

  // Season start dates for each sport (approximate)
  const seasonStartDates = {
    nfl: '20250904',   // NFL 2025 season start
    nba: '20251021',   // NBA 2025-26 season start
    nhl: '20251007',   // NHL 2025-26 season start
    cfb: '20250823',   // CFB 2025 season start
    cbb: '20251103',   // CBB 2025-26 season start
    d3mb: '20251108',  // D3 Men's Basketball 2025-26 season start
    d3wb: '20251108',  // D3 Women's Basketball 2025-26 season start
  };

  // Conference tier mappings for starting Elo (conferenceId -> tier)
  // Tiers: Elite=1600, High=1450, Mid=1400, Low=1300, Unknown=1200
  // WIDER GAPS to properly differentiate strength of schedule
  // CBB Conference IDs from ESPN API: /apis/site/v2/sports/basketball/mens-college-basketball/groups
  const conferenceTiers = {
    cbb: {
      // Elite (Power 5) - 1600
      '2': 1600,   // ACC
      '4': 1600,   // Big East
      '7': 1600,   // Big Ten  
      '8': 1600,   // Big 12
      '23': 1600,  // SEC
      // High Major - 1450 (good but not elite)
      '3': 1450,   // Atlantic 10
      '21': 1450,  // Pac-12
      '29': 1450,  // WCC (West Coast)
      '44': 1450,  // Mountain West
      '62': 1450,  // AAC (American)
      // Mid Major - 1400
      '1': 1400,   // America East
      '5': 1400,   // Big Sky
      '6': 1400,   // Big South
      '9': 1400,   // Big West
      '10': 1400,  // CAA (Coastal Athletic)
      '11': 1400,  // Conference USA
      '12': 1400,  // Ivy League
      '13': 1400,  // MAAC (Metro Atlantic)
      '14': 1400,  // MAC (Mid-American)
      '18': 1400,  // MVC (Missouri Valley)
      '20': 1400,  // OVC (Ohio Valley)
      '22': 1400,  // Patriot League
      '24': 1400,  // Southern Conference
      '25': 1400,  // Southland
      '27': 1400,  // Sun Belt
      '30': 1400,  // WAC
      '43': 1400,  // D1 Independents
      '45': 1400,  // Horizon League
      '46': 1400,  // ASUN
      '49': 1400,  // Summit League
      // Low Major - 1300
      '16': 1300,  // MEAC
      '19': 1300,  // NEC (Northeast)
      '26': 1300,  // SWAC
    },
    cfb: {
      // Elite (Power 4 + Notre Dame) - 1600
      '1': 1600,   // ACC
      '4': 1600,   // Big 12
      '5': 1600,   // Big Ten
      '8': 1600,   // SEC
      '18': 1600,  // FBS Independents (Notre Dame, UConn, UMass)
      // High (Group of 5) - 1500
      '9': 1500,   // Pac-12 (Washington State, Oregon State)
      '12': 1500,  // Conference USA
      '15': 1500,  // MAC (Mid-American)
      '17': 1500,  // Mountain West
      '37': 1500,  // Sun Belt
      '151': 1500, // AAC (American)
      // FCS Conferences - 1300
      '20': 1300,  // Big Sky
      '21': 1300,  // Missouri Valley Football (MVFC)
      '24': 1300,  // MEAC
      '25': 1300,  // NEC (Northeast)
      '27': 1300,  // Patriot League
      '29': 1300,  // Southern Conference
      '30': 1300,  // Southland
      '31': 1300,  // SWAC
      '32': 1300,  // FCS Independents
      '48': 1300,  // CAA Football
      '177': 1300, // United Athletic Conference
      '179': 1300, // OVC-Big South Football Association
    },
    // D3 Basketball Conference Tiers
    // Based on historical tournament success and competitiveness
    // Top conferences get 1500, mid-tier 1420, others 1350
    d3mb: {
      // Elite D3 conferences - regularly produce tournament teams
      'UAA': 1500,        // University Athletic Association (Chicago, NYU, Emory, etc.)
      'NESCAC': 1500,     // New England Small College Athletic Conference
      'ODAC': 1480,       // Old Dominion Athletic Conference
      'CCIW': 1480,       // College Conference of Illinois and Wisconsin
      'SCIAC': 1470,      // Southern California Intercollegiate Athletic
      'NEWMAC': 1470,     // New England Women's and Men's Athletic Conference
      'Centennial': 1460, // Centennial Conference
      'Liberty': 1460,    // Liberty League
      'SAA': 1450,        // Southern Athletic Association
      'WIAC': 1450,       // Wisconsin Intercollegiate Athletic Conference
      // Mid-tier conferences
      'MIAA': 1420,       // Michigan Intercollegiate Athletic Association
      'NACC': 1420,       // Northern Athletics Collegiate Conference
      'OAC': 1420,        // Ohio Athletic Conference
      'PAC': 1420,        // Presidents\' Athletic Conference
      'SLIAC': 1420,      // St. Louis Intercollegiate Athletic
      'USA South': 1420,  // USA South Athletic Conference
      'CCC': 1400,        // Commonwealth Coast Conference
      'ASC': 1400,        // American Southwest Conference
      'SCAC': 1400,       // Southern Collegiate Athletic Conference
      'NC3': 1400,        // North Coast Athletic Conference
    },
    d3wb: {
      // Same structure for women's basketball (similar competitive landscape)
      'UAA': 1500,
      'NESCAC': 1500,
      'ODAC': 1480,
      'CCIW': 1480,
      'SCIAC': 1470,
      'NEWMAC': 1470,
      'Centennial': 1460,
      'Liberty': 1460,
      'SAA': 1450,
      'WIAC': 1450,
      'MIAA': 1420,
      'NACC': 1420,
      'OAC': 1420,
      'PAC': 1420,
      'SLIAC': 1420,
      'USA South': 1420,
      'CCC': 1400,
      'ASC': 1400,
      'SCAC': 1400,
      'NC3': 1400,
    }
  };

  // Get starting Elo based on conference ID or name
  const getConferenceElo = (conferenceId, sportKey) => {
    // D3 sports use conference NAME (string), not ID
    if (sportKey === 'd3mb' || sportKey === 'd3wb') {
      if (!conferenceId) return 1350; // Default D3 Elo
      const elo = conferenceTiers[sportKey]?.[conferenceId];
      if (elo) {
        console.log(`D3 Conference ${conferenceId} -> Elo ${elo}`);
        return elo;
      }
      console.log(`D3 Conference ${conferenceId} not in tier list, using 1350`);
      return 1350; // Default for unknown D3 conferences
    }

    // ESPN sports use conference ID (number)
    if (!conferenceId || !conferenceTiers[sportKey]) {
      console.log(`No conference tier found for ${conferenceId} in ${sportKey}, using 1200 (D2/D3/NAIA)`);
      return 1200; // Very low - likely D2/D3/NAIA exhibition opponent
    }
    const elo = conferenceTiers[sportKey][conferenceId];
    if (elo) {
      console.log(`Conference ${conferenceId} in ${sportKey} -> Elo ${elo}`);
      return elo;
    }
    // Known conferenceId but not in our list - likely FCS for CFB, mid-major for CBB
    const fallback = sportKey === 'cfb' ? 1300 : 1400;
    console.log(`Conference ${conferenceId} not in tier list for ${sportKey}, using ${fallback}`);
    return fallback;
  };

  const matchTeamName = (espnName) => {
    // Try exact match first
    if (teams[espnName]) return espnName;

    // Normalize function - handle common abbreviations and variations
    const normalize = (name) => {
      return name
        .toLowerCase()
        .replace(/\bst\.?\b/gi, 'state')  // St. or St -> state
        .replace(/\bconn\.?\b/gi, 'connecticut')  // Conn. -> connecticut
        .replace(/\buniv\.?\b/gi, 'university')  // Univ. or Univ -> university
        .replace(/[()]/g, '')  // Remove parentheses
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .trim();
    };

    const espnNorm = normalize(espnName);
    const teamNames = Object.keys(teams);

    // Try normalized exact match
    for (const teamName of teamNames) {
      if (normalize(teamName) === espnNorm) {
        return teamName;
      }
    }

    // Try matching without common suffixes (mascots)
    const cleanName = espnName.replace(/ (Buckeyes|Wolverines|Crimson Tide|Tigers|Bulldogs|Sooners|Longhorns|Wildcats|Bears|Cardinals|Bruins|Trojans|Ducks|Beavers|Cougars|Huskies|Sun Devils|Golden Bears|Utes|Buffaloes|Aztecs|Spartans|Nittany Lions|Hawkeyes|Cornhuskers|Badgers|Gophers|Fighting Irish|Hoosiers|Boilermakers|Illini|Mountaineers|Panthers|Seminoles|Hurricanes|Cavaliers|Hokies|Yellow Jackets|Demon Deacons|Blue Devils|Tar Heels|Wolfpack|Orange|Red Raiders|Horned Frogs|Cyclones|Jayhawks|Aggies|Razorbacks|Rebels|Commodores|Volunteers|Gamecocks|Gators|Dawgs)$/i, '').trim();
    if (teams[cleanName]) return cleanName;

    // Also try normalized version without suffix
    const cleanNorm = normalize(cleanName);
    for (const teamName of teamNames) {
      if (normalize(teamName) === cleanNorm) {
        return teamName;
      }
    }

    // VERY STRICT matching from this point
    // Only match if we have strong confidence to avoid false positives
    // like "Central Conn. St." -> "Central Penn"

    // Word-based matching - require at least 2 significant matching words
    // This prevents single-word matches like "Central" from matching everything
    for (const teamName of teamNames) {
      const espnWords = espnNorm.split(' ').filter(w => w.length > 2);
      const teamWords = normalize(teamName).split(' ').filter(w => w.length > 2);

      // Need at least 2 words in both to attempt matching
      if (espnWords.length < 2 || teamWords.length < 2) continue;

      // Determine which is shorter and which is longer
      const [shorterWords, longerWords] = espnWords.length <= teamWords.length
        ? [espnWords, teamWords]
        : [teamWords, espnWords];

      // All words from the shorter name must appear in the longer name
      const allWordsMatch = shorterWords.every(word => longerWords.includes(word));

      // STRICT: Require at least 2 words to match to prevent false positives
      if (allWordsMatch && shorterWords.length >= 2) {
        return teamName;
      }
    }

    return null; // No match found - better to ask user to add manually than false match
  };

  // Check if a game already exists in the gameLog (duplicate detection)
  const isDuplicateGame = (team1, team2, score1, score2) => {
    return gameLog.some(g => {
      // Parse the existing game's score
      const scoreMatch = g.score.match(/(\d+)-(\d+)/);
      if (!scoreMatch) return false;
      const existingS1 = parseInt(scoreMatch[1]);
      const existingS2 = parseInt(scoreMatch[2]);
      
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

      console.log('Fetching NCAA:', url);

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

          if (!matchTeamName(homeName) && homeName !== 'Unknown') {
            const startingElo = getConferenceElo(homeConf, sport);
            console.log(`Adding ${homeName} with conf=${homeConf}, startingElo=${startingElo}`);
            teamsToAdd[homeName] = { elo: startingElo, off: 100, def: 100, conference: homeConf };
          }
          if (!matchTeamName(awayName) && awayName !== 'Unknown') {
            const startingElo = getConferenceElo(awayConf, sport);
            console.log(`Adding ${awayName} with conf=${awayConf}, startingElo=${startingElo}`);
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

          const matchedHome = matchTeamName(homeName) || (teamsToAdd[homeName] ? homeName : null);
          const matchedAway = matchTeamName(awayName) || (teamsToAdd[awayName] ? awayName : null);

          const isDuplicate = matchedHome && matchedAway && isDuplicateGame(matchedHome, matchedAway, homeScore, awayScore);

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
      let addedTeamsCount = 0;
      let importedCount = 0;
      let fetchedDates = 0;

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

              // Process each game using regressRating from utils
              const { regressRating } = await import('./utils/calculations');
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

                // Check for duplicate
                const isDupe = newGameLog.some(g =>
                  (g.team1 === homeName && g.team2 === awayName) ||
                  (g.team1 === awayName && g.team2 === homeName)
                ) || isDuplicateGame(homeName, awayName, game.homeScore, game.awayScore);

                if (isDupe) continue;

                // Calculate ratings changes
                const c = config;
                const t1 = currentTeams[homeName];
                const t2 = currentTeams[awayName];
                const s1 = game.homeScore;
                const s2 = game.awayScore;

                const winner = s1 > s2 ? homeName : awayName;
                const loser = s1 > s2 ? awayName : homeName;
                const rawMov = Math.abs(s1 - s2);
                const mov = c.marginCap ? Math.min(rawMov, c.marginCap) : rawMov;
                const exp = eloToWinProb(currentTeams[winner].elo, currentTeams[loser].elo);
                const eloChange = Math.round(c.kFactor * Math.min(Math.log(mov * (c.marginMult || 1) + 1) * 0.8 + 1, 2.5) * (1 - exp));

                // Off/Def calculations
                const ri = c.ratingImpact || 1.0;
                const exp1 = c.avgScore * (1 + ((t1.off - 100) - (t2.def - 100)) * ri / 100);
                const exp2 = c.avgScore * (1 + ((t2.off - 100) - (t1.def - 100)) * ri / 100);
                const offScale = 0.3;
                const t1OffDiff = Math.round((s1 - exp1) * offScale);
                const t2OffDiff = Math.round((s2 - exp2) * offScale);
                const t1DefDiff = Math.round((exp2 - s2) * offScale);
                const t2DefDiff = Math.round((exp1 - s1) * offScale);

                // Apply changes
                currentTeams[homeName] = {
                  ...currentTeams[homeName],
                  elo: currentTeams[homeName].elo + (s1 > s2 ? eloChange : -eloChange),
                  off: regressRating(Math.max(70, Math.min(130, currentTeams[homeName].off + t1OffDiff)), sport),
                  def: regressRating(Math.max(70, Math.min(130, currentTeams[homeName].def + t1DefDiff)), sport),
                };
                currentTeams[awayName] = {
                  ...currentTeams[awayName],
                  elo: currentTeams[awayName].elo + (s2 > s1 ? eloChange : -eloChange),
                  off: regressRating(Math.max(70, Math.min(130, currentTeams[awayName].off + t2OffDiff)), sport),
                  def: regressRating(Math.max(70, Math.min(130, currentTeams[awayName].def + t2DefDiff)), sport),
                };

                newGameLog.push({
                  date: game.date,
                  team1: homeName,
                  team2: awayName,
                  score: `${s1}-${s2}${game.isOT ? ' OT' : ''}`,
                  eloChange,
                  isOT: game.isOT,
                  t1Changes: { elo: s1 > s2 ? eloChange : -eloChange, off: t1OffDiff, def: t1DefDiff },
                  t2Changes: { elo: s2 > s1 ? eloChange : -eloChange, off: t2OffDiff, def: t2DefDiff }
                });

                importedCount++;
              }
            }
          }
        } catch (err) {
          console.log(`Error fetching ${month}/${day}/${year}:`, err.message);
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

  // Fetch Today's Games from NCAA API for D3 sports
  const fetchNCAATodaysGames = async () => {
    setTodaysGamesLoading(true);
    setTodaysGames([]);

    try {
      const ncaaConfig = ncaaApiConfig[sport];
      if (!ncaaConfig) {
        setTodaysGamesLoading(false);
        return;
      }

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      const url = `${ncaaApiBase}/scoreboard/${ncaaConfig.sport}/${ncaaConfig.division}/${year}/${month}/${day}/all-conf`;

      const response = await fetch(url);
      if (!response.ok) {
        setTodaysGamesLoading(false);
        return;
      }

      const data = await response.json();

      if (!data.games || data.games.length === 0) {
        setTodaysGamesLoading(false);
        return;
      }

      // Get all games (not just completed)
      const games = data.games
        .filter(gw => gw.game?.gameState !== 'final') // Upcoming/in-progress
        .map(gw => {
          const game = gw.game;
          const homeName = game.home?.names?.full || game.home?.names?.short || 'Unknown';
          const awayName = game.away?.names?.full || game.away?.names?.short || 'Unknown';

          const matchedHome = matchTeamName(homeName) || homeName;
          const matchedAway = matchTeamName(awayName) || awayName;

          return {
            id: game.gameID || `${homeName}-${awayName}`,
            homeTeam: matchedHome,
            awayTeam: matchedAway,
            espnHomeName: homeName,
            espnAwayName: awayName,
            time: game.startTime || 'TBD',
            status: game.gameState === 'live' ? game.currentPeriod || 'Live' : 'Scheduled',
            // NCAA API doesn't provide odds
            homeML: null,
            awayML: null,
            spread: null,
            total: null,
            bookmaker: null,
          };
        });

      setTodaysGames(games);

    } catch (err) {
      console.error('Failed to fetch NCAA today\'s games:', err);
    }

    setTodaysGamesLoading(false);
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
      
      console.log('Fetching:', url); // Debug log
      
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
        console.log('ESPN Team Structure Debug:', JSON.stringify(firstHome, null, 2));
        console.log('Team object:', firstHome?.team);
        console.log('conferenceId locations:', {
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
          
          if (!matchTeamName(homeName) && homeName !== 'Unknown') {
            const startingElo = getConferenceElo(homeConfId, sport);
            console.log(`Adding ${homeName} with confId=${homeConfId}, startingElo=${startingElo}`);
            teamsToAdd[homeName] = { elo: startingElo, off: 100, def: 100, conferenceId: homeConfId };
          }
          if (!matchTeamName(awayName) && awayName !== 'Unknown') {
            const startingElo = getConferenceElo(awayConfId, sport);
            console.log(`Adding ${awayName} with confId=${awayConfId}, startingElo=${startingElo}`);
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
          const matchedHome = matchTeamName(homeName) || (teamsToAdd[homeName] ? homeName : null);
          const matchedAway = matchTeamName(awayName) || (teamsToAdd[awayName] ? awayName : null);
          
          // Check if this game is a duplicate (already in gameLog)
          const isDuplicate = matchedHome && matchedAway && isDuplicateGame(matchedHome, matchedAway, homeScore, awayScore);
          
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
    
    gamesToImport.forEach(game => {
      // Set the result fields and trigger update
      const t1 = teams[game.matchedHome];
      const t2 = teams[game.matchedAway];
      const s1 = game.homeScore;
      const s2 = game.awayScore;
      const c = sportConfig[sport];
      
      // Calculate Elo change
      const winner = s1 > s2 ? game.matchedHome : game.matchedAway;
      const loser = s1 > s2 ? game.matchedAway : game.matchedHome;
      const rawMov = Math.abs(s1 - s2);
      const mov = c.marginCap ? Math.min(rawMov, c.marginCap) : rawMov; // Cap blowouts for college sports
      const exp = eloToWinProb(teams[winner].elo, teams[loser].elo);
      let eloChange = Math.round(c.kFactor * Math.min(Math.log(mov * (c.marginMult || 1) + 1) * 0.8 + 1, 2.5) * (1 - exp));
      
      // NHL OT adjustment: OT losses get reduced Elo penalty (they still earn a standings point)
      // OT wins also get slightly reduced gain (it was essentially a tie that got broken)
      const isNHLOT = sport === 'nhl' && game.isOT;
      const otLossFactor = 0.25;  // OT loser only loses 25% of normal Elo
      const otWinFactor = 0.75;   // OT winner only gains 75% of normal Elo
      
      // Calculate off/def changes (must be before setTeams since we need t1, t2 values)
      const ri = c.ratingImpact || 1.0;
      const exp1 = c.avgScore * (1 + ((t1.off - 100) - (t2.def - 100)) * ri / 100);
      const exp2 = c.avgScore * (1 + ((t2.off - 100) - (t1.def - 100)) * ri / 100);
      const offScale = 0.3;
      const t1OffDiff = Math.round((s1 - exp1) * offScale);
      const t2OffDiff = Math.round((s2 - exp2) * offScale);
      const t1DefDiff = Math.round((exp2 - s2) * offScale);
      const t2DefDiff = Math.round((exp1 - s1) * offScale);
      
      // Calculate actual Elo changes for this game
      const winnerEloChange = isNHLOT ? Math.round(eloChange * otWinFactor) : eloChange;
      const loserEloChange = isNHLOT ? Math.round(eloChange * otLossFactor) : eloChange;
      
      // Update teams
      setTeams(prev => ({
        ...prev,
        [game.matchedHome]: {
          ...prev[game.matchedHome],
          elo: prev[game.matchedHome].elo + (s1 > s2 ? winnerEloChange : -loserEloChange),
          off: regressRating(Math.max(70, Math.min(130, prev[game.matchedHome].off + t1OffDiff)), sport),
          def: regressRating(Math.max(70, Math.min(130, prev[game.matchedHome].def + t1DefDiff)), sport)
        },
        [game.matchedAway]: {
          ...prev[game.matchedAway],
          elo: prev[game.matchedAway].elo + (s2 > s1 ? winnerEloChange : -loserEloChange),
          off: regressRating(Math.max(70, Math.min(130, prev[game.matchedAway].off + t2OffDiff)), sport),
          def: regressRating(Math.max(70, Math.min(130, prev[game.matchedAway].def + t2DefDiff)), sport)
        }
      }));
      
      // Add to game log
      setGameLog(prev => [...prev, {
        date: importDate,
        team1: game.matchedHome,
        team2: game.matchedAway,
        score: `${s1}-${s2}${game.isOT ? ' OT' : ''}`,
        eloChange: winnerEloChange,
        isOT: game.isOT,
        t1Changes: { 
          elo: s1 > s2 ? winnerEloChange : -loserEloChange, 
          off: t1OffDiff, 
          def: t1DefDiff 
        },
        t2Changes: { 
          elo: s2 > s1 ? winnerEloChange : -loserEloChange, 
          off: t2OffDiff, 
          def: t2DefDiff 
        }
      }]);
    });
    
    alert(`Successfully imported ${gamesToImport.length} game(s)!`);
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
  const [seasonImportProgress, setSeasonImportProgress] = useState('');
  
  const importFullSeason = async () => {
    // Route D3 sports to NCAA API
    if (sportConfig[sport]?.useNcaaApi) {
      return importNCAAFullSeason();
    }

    if (!confirm(`This will import ALL ${config.name} games from the start of the season to today. This may take a minute and will update all team ratings. Continue?`)) return;
    
    setImportLoading(true);
    setSeasonImportProgress('Starting season import...');
    setImportError('');
    
    const startDate = seasonStartDates[sport];
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    try {
      // Fetch the entire date range at once
      // College sports need groups parameter: CFB: groups=80 for FBS, CBB: groups=50 for D1
      let extraParams = '';
      if (sport === 'cbb') extraParams = '&groups=50';
      if (sport === 'cfb') extraParams = '&groups=80';
      const url = `${espnEndpoints[sport]}?dates=${startDate}-${today}&limit=1000${extraParams}`;
      setSeasonImportProgress(`Fetching games from ${startDate} to ${today}...`);
      
      console.log('Fetching season:', url); // Debug log
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ESPN returned ${response.status}: ${response.statusText}`);
      }
      if (!response.ok) throw new Error('Failed to fetch from ESPN');
      
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
        console.log('Season Import - First game conference IDs:', {
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
      const c = sportConfig[sport];
      const ri = c.ratingImpact || 1.0;
      
      // First pass: collect all unique teams and add missing ones with conference-based Elo
      const teamsToAdd = {};
      for (const game of completedGames) {
        const matchedHome = matchTeamName(game.espnHome);
        const matchedAway = matchTeamName(game.espnAway);
        
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
        const matchedHome = matchTeamName(game.espnHome) || (currentTeams[game.espnHome] ? game.espnHome : null);
        const matchedAway = matchTeamName(game.espnAway) || (currentTeams[game.espnAway] ? game.espnAway : null);
        
        if (!matchedHome || !matchedAway) {
          continue; // Shouldn't happen anymore, but just in case
        }
        
        const t1 = currentTeams[matchedHome];
        const t2 = currentTeams[matchedAway];
        const s1 = game.homeScore;
        const s2 = game.awayScore;
        
        // Calculate Elo change
        const winner = s1 > s2 ? matchedHome : matchedAway;
        const loser = s1 > s2 ? matchedAway : matchedHome;
        const rawMov = Math.abs(s1 - s2);
        const mov = c.marginCap ? Math.min(rawMov, c.marginCap) : rawMov; // Cap blowouts for college sports
        const winnerElo = currentTeams[winner].elo;
        const loserElo = currentTeams[loser].elo;
        const exp = 1 / (1 + Math.pow(10, -(winnerElo - loserElo) / 400));
        const baseEloChange = Math.round(c.kFactor * Math.min(Math.log(mov * (c.marginMult || 1) + 1) * 0.8 + 1, 2.5) * (1 - exp));
        
        // NHL OT adjustment: OT losses get reduced Elo penalty (they still earn a standings point)
        // OT wins also get slightly reduced gain (it was essentially a tie that got broken)
        const isNHLOT = sport === 'nhl' && game.isOT;
        const otLossFactor = 0.25;  // OT loser only loses 25% of normal Elo
        const otWinFactor = 0.75;   // OT winner only gains 75% of normal Elo
        const winnerEloChange = isNHLOT ? Math.round(baseEloChange * otWinFactor) : baseEloChange;
        const loserEloChange = isNHLOT ? Math.round(baseEloChange * otLossFactor) : baseEloChange;
        
        // Calculate off/def changes
        const exp1 = c.avgScore * (1 + ((t1.off - 100) - (t2.def - 100)) * ri / 100);
        const exp2 = c.avgScore * (1 + ((t2.off - 100) - (t1.def - 100)) * ri / 100);
        const offScale = 0.3;
        const t1OffDiff = Math.round((s1 - exp1) * offScale);
        const t2OffDiff = Math.round((s2 - exp2) * offScale);
        const t1DefDiff = Math.round((exp2 - s2) * offScale);
        const t2DefDiff = Math.round((exp1 - s1) * offScale);
        
        // Update current teams object
        currentTeams = {
          ...currentTeams,
          [matchedHome]: {
            ...currentTeams[matchedHome],
            elo: currentTeams[matchedHome].elo + (s1 > s2 ? winnerEloChange : -loserEloChange),
            off: regressRating(Math.max(70, Math.min(130, currentTeams[matchedHome].off + t1OffDiff)), sport),
            def: regressRating(Math.max(70, Math.min(130, currentTeams[matchedHome].def + t1DefDiff)), sport)
          },
          [matchedAway]: {
            ...currentTeams[matchedAway],
            elo: currentTeams[matchedAway].elo + (s2 > s1 ? winnerEloChange : -loserEloChange),
            off: regressRating(Math.max(70, Math.min(130, currentTeams[matchedAway].off + t2OffDiff)), sport),
            def: regressRating(Math.max(70, Math.min(130, currentTeams[matchedAway].def + t2DefDiff)), sport)
          }
        };
        
        // Add to game log
        newGameLog.push({
          date: game.date,
          team1: matchedHome,
          team2: matchedAway,
          score: `${s1}-${s2}${game.isOT ? ' OT' : ''}`,
          eloChange: winnerEloChange,
          isOT: game.isOT,
          t1Changes: { elo: s1 > s2 ? winnerEloChange : -loserEloChange, off: t1OffDiff, def: t1DefDiff },
          t2Changes: { elo: s2 > s1 ? winnerEloChange : -loserEloChange, off: t2OffDiff, def: t2DefDiff }
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

  // Fetch Today's Games for Analyze Tab Game Picker
  // ESPN sport/league mapping for odds endpoint
  const espnOddsConfig = {
    nfl: { sport: 'football', league: 'nfl' },
    nba: { sport: 'basketball', league: 'nba' },
    nhl: { sport: 'hockey', league: 'nhl' },
    cfb: { sport: 'football', league: 'college-football' },
    cbb: { sport: 'basketball', league: 'mens-college-basketball' },
  };
  
  // Fetch odds for a single game from ESPN
  const fetchESPNOdds = async (eventId) => {
    try {
      const config = espnOddsConfig[sport];
      if (!config) return null;
      
      const url = `https://sports.core.api.espn.com/v2/sports/${config.sport}/leagues/${config.league}/events/${eventId}/competitions/${eventId}/odds`;
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      if (!data.items || data.items.length === 0) return null;
      
      // Get first available bookmaker's odds
      const oddsItem = data.items[0];
      const provider = oddsItem.provider?.name || 'ESPN';
      
      // Extract moneylines
      const homeML = oddsItem.homeTeamOdds?.moneyLine;
      const awayML = oddsItem.awayTeamOdds?.moneyLine;
      
      // Extract spread (home team perspective)
      const spread = oddsItem.spread;
      const spreadOdds = oddsItem.homeTeamOdds?.spreadOdds;
      const spreadOdds2 = oddsItem.awayTeamOdds?.spreadOdds;
      
      // Extract totals
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
      console.error('Failed to fetch ESPN odds for event', eventId, err);
      return null;
    }
  };
  
  const fetchTodaysGames = async () => {
    // Route D3 sports to NCAA API
    if (sportConfig[sport]?.useNcaaApi) {
      return fetchNCAATodaysGames();
    }

    setTodaysGamesLoading(true);
    setTodaysGames([]);

    try {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      let extraParams = '';
      if (sport === 'cbb') extraParams = '&groups=50&limit=500';
      if (sport === 'cfb') extraParams = '&groups=80&limit=500';
      const url = `${espnEndpoints[sport]}?dates=${today}${extraParams}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch games');
      
      const data = await response.json();
      
      if (!data.events || data.events.length === 0) {
        setTodaysGamesLoading(false);
        return;
      }
      
      // Get upcoming/in-progress games (not completed)
      const upcomingEvents = data.events.filter(event => !event.competitions?.[0]?.status?.type?.completed);
      
      // Build initial games list
      const games = upcomingEvents.map(event => {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
        
        const homeName = homeTeam?.team?.displayName || homeTeam?.team?.name || 'Unknown';
        const awayName = awayTeam?.team?.displayName || awayTeam?.team?.name || 'Unknown';
        
        // Match to our team names
        const matchedHome = matchTeamName(homeName) || homeName;
        const matchedAway = matchTeamName(awayName) || awayName;
        
        // Parse game time
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
          // Placeholders for odds
          homeML: null,
          awayML: null,
          spread: null,
          spreadOdds: null,
          spreadOdds2: null,
          total: null,
          overOdds: null,
          underOdds: null,
          bookmaker: null,
        };
      }).sort((a, b) => a.time.localeCompare(b.time));
      
      // Set games immediately so UI shows loading state
      setTodaysGames(games);
      
      // Fetch odds for each game from ESPN (in parallel, limited to first 15 to avoid too many requests)
      const gamesToFetchOdds = games.slice(0, 15);
      const oddsPromises = gamesToFetchOdds.map(game => fetchESPNOdds(game.id));
      const oddsResults = await Promise.all(oddsPromises);
      
      // Merge odds into games
      const gamesWithOdds = games.map((game, index) => {
        if (index < oddsResults.length && oddsResults[index]) {
          return { ...game, ...oddsResults[index] };
        }
        return game;
      });
      
      setTodaysGames(gamesWithOdds);
      
    } catch (err) {
      console.error('Failed to fetch today\'s games:', err);
    }
    
    setTodaysGamesLoading(false);
  };
  
  // Select a game from the picker and fill in the analyze form
  const selectGameFromPicker = (game) => {
    // Set teams
    setTeam1(game.homeTeam);
    setTeam2(game.awayTeam);
    
    // Set odds if available
    if (game.homeML) setBookML1(String(game.homeML));
    if (game.awayML) setBookML2(String(game.awayML));
    if (game.spread) {
      setBookSpread(String(game.spread));
      if (game.spreadOdds) setBookSpreadOdds(String(game.spreadOdds));
      if (game.spreadOdds2) setBookSpreadOdds2(String(game.spreadOdds2));
    }
    if (game.total) {
      setBookTotal(String(game.total));
      if (game.overOdds) setBookOverOdds(String(game.overOdds));
      if (game.underOdds) setBookUnderOdds(String(game.underOdds));
    }
    
    // Reset context adjustments
    resetContextAdjustments();
    setIsNeutral(false);
    
    // Close picker
    setShowGamePicker(false);
    
    // Clear previous AI insights (user can manually generate)
    setAiInsights(null);
  };
  
  // Fetch AI Insights using OpenRouter API (free models available)
  const fetchAiInsights = async (awayTeam, homeTeam, gameTime) => {
    if (!openRouterApiKey) {
      setAiInsights({ 
        text: 'Please add your OpenRouter API key in the Bankroll Settings tab to enable AI Insights. Get a free key at openrouter.ai', 
        error: true,
        needsApiKey: true,
        generatedAt: new Date().toLocaleTimeString(),
      });
      return;
    }
    
    setAiInsightsLoading(true);
    setAiInsights(null);
    
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const sportName = sportConfig[sport]?.name || sport.toUpperCase();
    
    const prompt = `You are a sports betting analyst providing insights for a ${sportName} game. Today is ${today}.

MATCHUP: ${awayTeam} @ ${homeTeam} (${gameTime || 'Today'})

Please provide a concise analysis with the following sections. Be specific and actionable:

1. **🏥 INJURY REPORT** (2-3 sentences max)
List any significant injuries or player availability issues for both teams. If you're unsure of current injuries, mention key players to watch and suggest the user verify injury status.

2. **📊 RECENT FORM** (2-3 sentences max)  
Brief assessment of each team's recent performance, momentum, and any notable trends.

3. **⚡ SUGGESTED ADJUSTMENTS** (provide specific numbers)
Based on any known factors, suggest Elo adjustments for the betting model:
- ${homeTeam} Injury: [0 to -100, where -30=minor, -60=key player, -100=star out]
- ${homeTeam} Rest: [-30 to +30, positive=extra rest, negative=tired/back-to-back]
- ${homeTeam} Motivation: [-40 to +40, rivalry/playoffs=positive, nothing to play for=negative]
- ${awayTeam} Injury: [0 to -100]
- ${awayTeam} Rest: [-30 to +30]
- ${awayTeam} Motivation: [-40 to +40]

4. **🎯 KEY FACTORS** (3-4 bullet points)
What specific factors could swing this game? Consider:
- Matchup advantages/disadvantages
- Pace of play / style clashes
- Home court/ice/field advantage significance
- Historical head-to-head trends
- Weather (if outdoor sport)

5. **💡 BETTING ANGLE** (1-2 sentences)
One specific insight that might not be captured by the Elo model - something the market might be over/undervaluing.

Keep the entire response under 400 words. Be direct and insightful, not generic.`;

    try {
      // Add :online suffix for web search (fetches real-time injury data)
      const modelWithSearch = enableWebSearch ? `${aiModel}:online` : aiModel;
      
      const requestBody = {
        model: modelWithSearch,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      };
      
      // Configure web search plugin if enabled
      if (enableWebSearch) {
        requestBody.plugins = [{
          id: "web",
          max_results: 5,
          search_prompt: `Web search results for ${sportName} game ${awayTeam} @ ${homeTeam} (injuries, news, recent form):`
        }];
      }
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterApiKey}`,
          "HTTP-Referer": window.location.href,
          "X-Title": "Sports Betting Model"
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      const insightText = data.choices?.[0]?.message?.content || 'Unable to generate insights.';
      const modelUsed = data.model || aiModel;
      
      // Parse the suggested adjustments from the response
      const parseAdjustment = (text, team, type) => {
        const patterns = [
          new RegExp(`${team}.*?${type}[:\\s]*([+-]?\\d+)`, 'i'),
          new RegExp(`${type}[:\\s]*([+-]?\\d+).*?${team}`, 'i'),
        ];
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) return parseInt(match[1]);
        }
        return 0;
      };
      
      setAiInsights({
        text: insightText,
        model: modelUsed,
        webSearchUsed: enableWebSearch,
        suggestions: {
          team1Injury: parseAdjustment(insightText, homeTeam.split(' ').pop(), 'Injury'),
          team1Rest: parseAdjustment(insightText, homeTeam.split(' ').pop(), 'Rest'),
          team1Motivation: parseAdjustment(insightText, homeTeam.split(' ').pop(), 'Motivation'),
          team2Injury: parseAdjustment(insightText, awayTeam.split(' ').pop(), 'Injury'),
          team2Rest: parseAdjustment(insightText, awayTeam.split(' ').pop(), 'Rest'),
          team2Motivation: parseAdjustment(insightText, awayTeam.split(' ').pop(), 'Motivation'),
        },
        generatedAt: new Date().toLocaleTimeString(),
      });
      
    } catch (err) {
      console.error('Failed to fetch AI insights:', err);
      setAiInsights({ 
        text: `Error: ${err.message}. Check your API key and try again.`, 
        error: true,
        generatedAt: new Date().toLocaleTimeString(),
      });
    }
    
    setAiInsightsLoading(false);
  };
  
  // Apply AI suggested adjustments to the sliders
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

  // Bet Tracker Functions
  const addBet = () => {
    if (!newBet.game || !newBet.pick || !newBet.odds || !newBet.stake) return;
    const bet = { ...newBet, id: Date.now(), stake: parseFloat(newBet.stake), odds: newBet.odds };
    setBets(prev => [...prev, bet]);
    setNewBet({ date: new Date().toISOString().split('T')[0], sport: sport, game: '', betType: 'ML', pick: '', odds: '', stake: '', result: 'pending', payout: 0 });
  };

  const updateBetResult = (id, result) => {
    setBets(prev => prev.map(bet => {
      if (bet.id !== id) return bet;
      let payout = 0;
      if (result === 'win') {
        const decimal = americanToDecimal(bet.odds);
        payout = bet.stake * (decimal - 1);
      } else if (result === 'loss') {
        payout = -bet.stake;
      } else if (result === 'push') {
        payout = 0;
      }
      return { ...bet, result, payout };
    }));
  };

  const deleteBet = (id) => setBets(prev => prev.filter(b => b.id !== id));

  const calculateStats = () => {
    const settled = bets.filter(b => b.result !== 'pending');
    const wins = settled.filter(b => b.result === 'win').length;
    const losses = settled.filter(b => b.result === 'loss').length;
    const pushes = settled.filter(b => b.result === 'push').length;
    const totalStaked = settled.reduce((sum, b) => sum + b.stake, 0);
    const totalProfit = settled.reduce((sum, b) => sum + b.payout, 0);
    const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
    const units = totalProfit / (parseFloat(bankroll) * 0.01);
    return { wins, losses, pushes, totalStaked, totalProfit, roi, winRate, units, pending: bets.filter(b => b.result === 'pending').length };
  };

  const analyzeMatchup = () => {
    if (!team1 || !team2 || !teams[team1] || !teams[team2]) return null;
    const c = sportConfig[sport]; const ha = isNeutral ? 0 : c.homeAdvantage;
    const t1 = teams[team1]; const t2 = teams[team2];
    const ri = c.ratingImpact || 1.0;
    
    // Calculate live bankroll from starting bankroll + bet tracker results
    const settledBets = bets.filter(b => b.result !== 'pending');
    const totalProfit = settledBets.reduce((sum, b) => sum + b.payout, 0);
    const pendingStaked = bets.filter(b => b.result === 'pending').reduce((sum, b) => sum + b.stake, 0);
    // Available bankroll = starting + settled P/L - pending stakes (money already at risk)
    const liveBankroll = safeParseFloat(bankroll) + totalProfit - pendingStaked;
    const maxBet = liveBankroll * 0.05; // 5% max bet cap
    
    // Apply context adjustments to Elo
    const t1AdjElo = getAdjustedElo(t1.elo, team1Injury, team1Rest, team1Motivation);
    const t2AdjElo = getAdjustedElo(t2.elo, team2Injury, team2Rest, team2Motivation);
    
    // Apply context adjustments to Off/Def for totals prediction
    // -100 Elo (star out) → roughly -5 off/def rating impact
    const contextToOffDef = (eloAdj) => eloAdj * 0.05;
    const t1OffAdj = t1.off + contextToOffDef(team1Injury + team1Motivation);
    const t2OffAdj = t2.off + contextToOffDef(team2Injury + team2Motivation);
    const t1DefAdj = t1.def + contextToOffDef(team1Injury); // Injuries hurt both offense and defense
    const t2DefAdj = t2.def + contextToOffDef(team2Injury);
    
    const p1 = eloToWinProb(t1AdjElo, t2AdjElo, ha); const p2 = 1 - p1;
    const spread = predictSpread(t1AdjElo, t2AdjElo, ha);
    
    // Calculate total from off/def ratings
    const offDefTotal = c.avgScore * (1 + ((t1OffAdj - 100) - (t2DefAdj - 100)) * ri / 100) + 
                        c.avgScore * (1 + ((t2OffAdj - 100) - (t1DefAdj - 100)) * ri / 100);
    const total = offDefTotal;
    
    // Calculate both score prediction methods for all sports
    // 1. Elo-based: derived from spread + total (margin matches spread exactly)
    const margin = -spread;
    const eloSc1 = (total + margin) / 2; // home team score
    const eloSc2 = (total - margin) / 2; // away team score
    
    // 2. Off/Def-based: from team offensive/defensive ratings
    const offDefSc1 = c.avgScore * (1 + ((t1OffAdj - 100) - (t2DefAdj - 100)) * ri / 100);
    const offDefSc2 = c.avgScore * (1 + ((t2OffAdj - 100) - (t1DefAdj - 100)) * ri / 100);
    
    // Primary display uses Elo-based (aligns with spread)
    const sc1 = eloSc1;
    const sc2 = eloSc2;

    const bookSpreadVal = bookSpread ? safeParseFloat(bookSpread) : null;
    const bookTotalVal = bookTotal ? safeParseFloat(bookTotal) : null;
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
        simulationCacheRef.current[simKey] = simulation;
      }
    }

    const probSource = useSimulation && simulation ? 'simulation' : 'analytical';
    const activeWinProbHome = probSource === 'simulation' ? simulation.team1WinRate : p1;
    const activeWinProbAway = probSource === 'simulation' ? simulation.team2WinRate : p2;
    const coverProbHome = probSource === 'simulation' && simulation?.spread ? simulation.spread.homeCover : analyticalCoverProb;
    const coverProbAway = probSource === 'simulation' && simulation?.spread ? simulation.spread.awayCover : (analyticalCoverProb !== null ? 1 - analyticalCoverProb : null);
    const coverPushProb = probSource === 'simulation' && simulation?.spread ? simulation.spread.push : 0;
    const overProbActive = probSource === 'simulation' && simulation?.totals ? simulation.totals.over : analyticalOverProb;
    const underProbActive = probSource === 'simulation' && simulation?.totals ? simulation.totals.under : (analyticalOverProb !== null ? 1 - analyticalOverProb : null);
    const totalPushProb = probSource === 'simulation' && simulation?.totals ? simulation.totals.push : 0;

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
      // Home team (team1) spread analysis
      const ev1 = calculateEV(coverProbHome, bookSpreadOdds) * 100;
      // Away team (team2) gets opposite spread
      const awaySpread = -bookSpreadVal;
      const cp2 = coverProbAway !== null ? coverProbAway : 1 - coverProbHome; // Away cover prob is inverse (no push on half-points)
      const ev2 = calculateEV(cp2, bookSpreadOdds2) * 100;
      const homeKellyData = kellyStakeCapped(coverProbHome, bookSpreadOdds, liveBankroll, safeParseFloat(kellyFraction), maxBet);
      const awayKellyData = kellyStakeCapped(cp2, bookSpreadOdds2, liveBankroll, safeParseFloat(kellyFraction), maxBet);
      spreadA = {
        predictedSpread: spread,
        source: probSource,
        modelCoverProb: analyticalCoverProb !== null ? analyticalCoverProb * 100 : null,
        simCoverProb: simulation?.spread?.homeCover ? simulation.spread.homeCover * 100 : null,
        // Home team (team1) - the spread as entered
        homeCoverProb: coverProbHome * 100,
        homeEV: ev1,
        homeKelly: homeKellyData.amount,
        homeKellyCapped: homeKellyData.wasCapped,
        homeKellyRaw: homeKellyData.rawAmount,
        homeSpread: bookSpreadVal,
        isHomePositive: ev1 > 0,
        homeConfidence: getConfidenceTier(ev1),
        // Away team (team2) - opposite spread
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
    
    // Calculate margins from both methods
    const eloMargin = sc1 - sc2; // Positive = home favored
    const offDefMargin = offDefSc1 - offDefSc2;
    
    // For total divergence: compare Off/Def total to LEAGUE AVERAGE (not Elo-derived)
    // This lets us detect when a matchup projects higher/lower than typical
    const leagueAvgTotal = c.avgScore * 2;  // League average game total
    const offDefTotalCalc = offDefSc1 + offDefSc2;
    
    // Sport-specific thresholds
    const thresholds = {
      nfl: { bigFav: 7, closeLine: 3, totalDiff: 4 },
      nba: { bigFav: 8, closeLine: 4, totalDiff: 6 },
      nhl: { bigFav: 1.0, closeLine: 0.3, totalDiff: 0.25 },  // Tighter thresholds for low-scoring NHL
      cfb: { bigFav: 10, closeLine: 4, totalDiff: 5 },
      cbb: { bigFav: 8, closeLine: 4, totalDiff: 5 },
    };
    const th = thresholds[sport] || thresholds.nba;
    
    const marginDiff = Math.abs(eloMargin - offDefMargin);
    const totalDiff = offDefTotalCalc - leagueAvgTotal;  // Now compares to league avg!
    
    // Get team short names
    const t1Short = team1.split(' ').pop();
    const t2Short = team2.split(' ').pop();
    
    // --- SPREAD/MARGIN DIVERGENCES ---
    
    // 1. Elo big favorite but Off/Def shows close game
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
    
    // 2. Elo shows close game but Off/Def shows blowout
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
    
    // 3. Models disagree on WHO is favored
    if ((eloMargin > th.closeLine && offDefMargin < -th.closeLine) || 
        (eloMargin < -th.closeLine && offDefMargin > th.closeLine)) {
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
    
    // 4. Large margin disagreement (same direction but different magnitude)
    // Use 0.7x threshold so disagreements like "Elo by 10 vs Off/Def by 3" still get flagged
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
    
    // 5. Off/Def total significantly higher than league average (Over lean)
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
    
    // 6. Off/Def total significantly lower than league average (Under lean)
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
    
    // 7. Elite offense vs weak defense (high Off/Def score for one team)
    const t1ExpectedPts = offDefSc1;
    const t2ExpectedPts = offDefSc2;
    const avgPts = c.avgScore;
    
    // NHL uses tighter thresholds due to lower scoring variance
    const shootoutMult = sport === 'nhl' ? 1.04 : 1.15;   // NHL: ~3.2+ goals each
    const defensiveMult = sport === 'nhl' ? 0.96 : 0.85;  // NHL: ~3.0- goals each
    
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
    
    // 8. Both teams projected below average (defensive slugfest)
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
    
    // 9. One elite offense vs one elite defense (clash of styles)
    // NHL uses lower threshold (105) due to tighter rating clustering
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
    
    // 10. Lopsided matchup (one team much better at everything)
    // NHL uses tighter thresholds (104/96) due to compressed rating range
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

    
    // 11. High variance game (big spread but close Off/Def)
    // Only show if no spread insight already fired (avoids duplicate with #1)
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
    
    // 12. Model confidence alignment (both agree strongly)
    // NHL uses scaled threshold for Off/Def since margins are compressed by ratingImpact=0.6
    const offDefBigFav = sport === 'nhl' ? th.closeLine : th.bigFav;  // NHL: 0.5 goals, others: bigFav
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
      probabilitySource: probSource
    };
  };

  const analysis = analyzeMatchup();
  const teamList = Object.keys(teams).sort((a, b) => teams[b].elo - teams[a].elo);
  const config = sportConfig[sport];
  const stats = calculateStats();
  const inputStyle = "w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm";
  const labelStyle = "block text-xs font-medium text-gray-600 mb-1";
  const cardStyle = "bg-white rounded-xl shadow-md p-4";
  const sliderStyle = "w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-3">
      <div className="max-w-7xl mx-auto space-y-3">
        <div className="text-center py-3">
          <h1 className="text-2xl font-bold text-white mb-1">🎯 Sports Betting Model Pro</h1>
          <p className="text-blue-200 text-sm">2025-26 Season • Verified Ratings • Bet Tracker • Auto-Save</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {Object.entries(sportConfig).map(([key, cfg]) => (
            <button key={key} onClick={() => setSport(key)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${sport === key ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}>{cfg.name}</button>
          ))}
        </div>

        <div className="flex gap-1 justify-center flex-wrap">
          {['analyze', 'tracker', 'ratings', 'results', 'bankroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {tab === 'analyze' && '🎯 Analyze'}{tab === 'tracker' && '📈 Tracker'}{tab === 'ratings' && '📊 Ratings'}{tab === 'results' && '📝 Results'}{tab === 'bankroll' && '💰 Bankroll'}
            </button>
          ))}
        </div>

        {activeTab === 'analyze' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cardStyle}>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold">📋 Game Setup</h2>
                <button 
                  onClick={() => { setShowGamePicker(true); fetchTodaysGames(); }}
                  className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                >
                  📅 Today's Games
                </button>
              </div>
              
              {/* Game Picker Modal */}
              {showGamePicker && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                    <div className="p-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg">📅 Today's {sportConfig[sport].name} Games</h3>
                      <button onClick={() => setShowGamePicker(false)} className="text-white hover:text-gray-200 text-xl">✕</button>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[60vh]">
                      {todaysGamesLoading ? (
                        <div className="text-center py-8 text-gray-500">
                          <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-2"></div>
                          <p>Loading games...</p>
                        </div>
                      ) : todaysGames.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <p className="text-4xl mb-2">🏟️</p>
                          <p>No games scheduled for today</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {todaysGames.map(game => (
                            <div 
                              key={game.id}
                              onClick={() => selectGameFromPicker(game)}
                              className="p-3 border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition-colors"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{game.awayTeam}</span>
                                    <span className="text-gray-400">@</span>
                                    <span className="text-sm font-medium">{game.homeTeam}</span>
                                  </div>
                                  <p className="text-xs text-gray-500">{game.time} • {game.status}</p>
                                </div>
                                {game.homeML && (
                                  <div className="text-right text-xs space-y-1">
                                    <div className="flex gap-3">
                                      <span className="text-gray-500">ML:</span>
                                      <span>{game.awayML > 0 ? '+' : ''}{game.awayML}</span>
                                      <span>/</span>
                                      <span>{game.homeML > 0 ? '+' : ''}{game.homeML}</span>
                                    </div>
                                    {game.spread && (
                                      <div className="flex gap-3">
                                        <span className="text-gray-500">Spread:</span>
                                        <span>{game.spread > 0 ? '+' : ''}{game.spread}</span>
                                      </div>
                                    )}
                                    {game.total && (
                                      <div className="flex gap-3">
                                        <span className="text-gray-500">Total:</span>
                                        <span>{game.total}</span>
                                      </div>
                                    )}
                                    <p className="text-emerald-600 text-[10px] font-medium">via {game.bookmaker || 'ESPN'}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 flex items-center gap-2">
                      <span className="text-emerald-600">📡 Live odds from ESPN</span>
                      <span className="text-gray-400">•</span>
                      <span>No API key required</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <div><label className={labelStyle}>Away Team</label><select value={team2} onChange={(e) => { setTeam2(e.target.value); resetContextAdjustments(); setAiInsights(null); }} className={inputStyle}><option value="">Select...</option>{teamList.map(t => <option key={t} value={t}>{t} ({teams[t].elo})</option>)}</select></div>
                <div><label className={labelStyle}>Home Team</label><select value={team1} onChange={(e) => { setTeam1(e.target.value); resetContextAdjustments(); setAiInsights(null); }} className={inputStyle}><option value="">Select...</option>{teamList.map(t => <option key={t} value={t}>{t} ({teams[t].elo})</option>)}</select></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isNeutral} onChange={(e) => setIsNeutral(e.target.checked)} className="rounded" /> Neutral Site</label>
                
                {/* Context Adjustments */}
                {team1 && team2 && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs font-bold text-gray-700 mb-2">⚡ Context Adjustments (Elo ±)</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-medium text-gray-600 mb-1">{team1.split(' ').pop()}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1"><span className="w-14">Injury:</span><input type="range" min="-100" max="0" value={team1Injury} onChange={(e) => setTeam1Injury(parseInt(e.target.value))} className={sliderStyle} /><span className="w-8 text-right text-red-500">{team1Injury}</span></div>
                          <div className="flex items-center gap-1"><span className="w-14">Rest:</span><input type="range" min="-30" max="30" value={team1Rest} onChange={(e) => setTeam1Rest(parseInt(e.target.value))} className={sliderStyle} /><span className="w-8 text-right">{team1Rest > 0 ? '+' : ''}{team1Rest}</span></div>
                          <div className="flex items-center gap-1"><span className="w-14">Motiv:</span><input type="range" min="-40" max="40" value={team1Motivation} onChange={(e) => setTeam1Motivation(parseInt(e.target.value))} className={sliderStyle} /><span className="w-8 text-right">{team1Motivation > 0 ? '+' : ''}{team1Motivation}</span></div>
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-600 mb-1">{team2.split(' ').pop()}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1"><span className="w-14">Injury:</span><input type="range" min="-100" max="0" value={team2Injury} onChange={(e) => setTeam2Injury(parseInt(e.target.value))} className={sliderStyle} /><span className="w-8 text-right text-red-500">{team2Injury}</span></div>
                          <div className="flex items-center gap-1"><span className="w-14">Rest:</span><input type="range" min="-30" max="30" value={team2Rest} onChange={(e) => setTeam2Rest(parseInt(e.target.value))} className={sliderStyle} /><span className="w-8 text-right">{team2Rest > 0 ? '+' : ''}{team2Rest}</span></div>
                          <div className="flex items-center gap-1"><span className="w-14">Motiv:</span><input type="range" min="-40" max="40" value={team2Motivation} onChange={(e) => setTeam2Motivation(parseInt(e.target.value))} className={sliderStyle} /><span className="w-8 text-right">{team2Motivation > 0 ? '+' : ''}{team2Motivation}</span></div>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Injury: -30 minor, -60 key player, -100 star out</p>
                  </div>
                )}
                
                <hr />
                <p className="text-xs font-medium text-gray-600">Book Lines (American)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelStyle}>{team1 ? team1.split(' ').pop() : 'Home'} ML</label><input type="text" value={bookML1} onChange={(e) => setBookML1(e.target.value)} placeholder="-150" className={inputStyle} /></div>
                  <div><label className={labelStyle}>{team2 ? team2.split(' ').pop() : 'Away'} ML</label><input type="text" value={bookML2} onChange={(e) => setBookML2(e.target.value)} placeholder="+130" className={inputStyle} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={labelStyle}>{team1 ? team1.split(' ').pop() : 'Home'} Spread</label><input type="text" value={bookSpread} onChange={(e) => setBookSpread(e.target.value)} placeholder="-3.5" className={inputStyle} /></div>
                  <div><label className={labelStyle}>{team1 ? team1.split(' ').pop() : 'Home'} Odds</label><input type="text" value={bookSpreadOdds} onChange={(e) => setBookSpreadOdds(e.target.value)} placeholder="-110" className={inputStyle} /></div>
                  <div><label className={labelStyle}>{team2 ? team2.split(' ').pop() : 'Away'} Odds</label><input type="text" value={bookSpreadOdds2} onChange={(e) => setBookSpreadOdds2(e.target.value)} placeholder="-110" className={inputStyle} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={labelStyle}>Total</label><input type="text" value={bookTotal} onChange={(e) => setBookTotal(e.target.value)} placeholder="45.5" className={inputStyle} /></div>
                  <div><label className={labelStyle}>Over</label><input type="text" value={bookOverOdds} onChange={(e) => setBookOverOdds(e.target.value)} placeholder="-110" className={inputStyle} /></div>
                  <div><label className={labelStyle}>Under</label><input type="text" value={bookUnderOdds} onChange={(e) => setBookUnderOdds(e.target.value)} placeholder="-110" className={inputStyle} /></div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between gap-3 mt-2">
                  <div>
                    <p className="text-sm font-semibold text-indigo-800">🎲 Run Simulations</p>
                    <p className="text-xs text-indigo-700">Monte Carlo with sport variance to validate model edges</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-sm text-indigo-800">
                      <input type="checkbox" checked={useSimulation} onChange={(e) => setUseSimulation(e.target.checked)} className="rounded" />
                      Enable
                    </label>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-indigo-700">Sims</span>
                      <input
                        type="number"
                        min="500"
                        max="15000"
                        step="500"
                        value={simulationRuns}
                        onChange={(e) => setSimulationRuns(Math.max(500, Math.min(15000, parseInt(e.target.value) || 0)))}
                        className="w-20 p-1 border border-indigo-200 rounded"
                        disabled={!useSimulation}
                      />
                    </div>
                    <label className="flex items-center gap-1 text-xs text-indigo-700">
                      <input type="checkbox" checked={showSimPercentiles} onChange={(e) => setShowSimPercentiles(e.target.checked)} className="rounded" disabled={!useSimulation} />
                      Percentiles
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {analysis ? (
                <>
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 text-white">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold">Model Prediction</h3>
                      <span className="text-[10px] px-2 py-1 rounded-full border border-slate-600 text-slate-200">Using {analysis.probabilitySource === 'simulation' ? 'simulation + EV' : 'analytical model'}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div><p className="text-slate-400 text-xs">{team1.split(' ').pop()} Win %</p><p className="text-2xl font-bold text-blue-400">{analysis.team1WinProb.toFixed(1)}%</p><p className="text-xs text-slate-500">Fair: {analysis.team1FairOdds}</p><p className="text-xs text-slate-600">Adj Elo: {analysis.t1AdjElo}</p></div>
                      <div><p className="text-slate-400 text-xs">{team2.split(' ').pop()} Win %</p><p className="text-2xl font-bold text-blue-400">{analysis.team2WinProb.toFixed(1)}%</p><p className="text-xs text-slate-500">Fair: {analysis.team2FairOdds}</p><p className="text-xs text-slate-600">Adj Elo: {analysis.t2AdjElo}</p></div>
                      <div><p className="text-slate-400 text-xs">Predicted Spread</p><p className="text-2xl font-bold">{team1.split(' ').pop()} {analysis.predSpread > 0 ? '+' : ''}{analysis.predSpread.toFixed(1)}</p></div>
                      <div><p className="text-slate-400 text-xs">Predicted Total</p><p className="text-2xl font-bold">{analysis.predTotal.toFixed(1)}</p></div>
                    </div>
                    {analysis.probabilityBreakdown?.simulation && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                          <div className="flex justify-between items-center mb-2">
                            <p className="font-semibold text-slate-100">Analytical</p>
                            <span className="text-[10px] text-slate-400">Model</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between"><span>Win {team1.split(' ').pop()}</span><span>{analysis.probabilityBreakdown.analytical.winHome?.toFixed(1) ?? '--'}%</span></div>
                            <div className="flex justify-between"><span>Win {team2.split(' ').pop()}</span><span>{analysis.probabilityBreakdown.analytical.winAway?.toFixed(1) ?? '--'}%</span></div>
                            <div className="flex justify-between"><span>Cover {team1.split(' ').pop()}</span><span>{analysis.probabilityBreakdown.analytical.coverHome?.toFixed(1) ?? '--'}%</span></div>
                            <div className="flex justify-between"><span>Over</span><span>{analysis.probabilityBreakdown.analytical.over?.toFixed(1) ?? '--'}%</span></div>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                          <div className="flex justify-between items-center mb-2">
                            <p className="font-semibold">Simulation</p>
                            <span className="text-[10px] text-amber-600">{simulationRuns.toLocaleString()} sims</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between"><span>Win {team1.split(' ').pop()}</span><span>{analysis.probabilityBreakdown.simulation.winHome?.toFixed(1) ?? '--'}%</span></div>
                            <div className="flex justify-between"><span>Win {team2.split(' ').pop()}</span><span>{analysis.probabilityBreakdown.simulation.winAway?.toFixed(1) ?? '--'}%</span></div>
                            <div className="flex justify-between"><span>Cover {team1.split(' ').pop()}</span><span>{analysis.probabilityBreakdown.simulation.coverHome?.toFixed(1) ?? '--'}%</span></div>
                            <div className="flex justify-between"><span>Over</span><span>{analysis.probabilityBreakdown.simulation.over?.toFixed(1) ?? '--'}%</span></div>
                            {analysis.probabilityBreakdown.simulation.pushSpread !== null && <div className="flex justify-between text-[11px]"><span>Spread Push</span><span>{analysis.probabilityBreakdown.simulation.pushSpread?.toFixed(1)}%</span></div>}
                            {analysis.probabilityBreakdown.simulation.pushTotal !== null && <div className="flex justify-between text-[11px]"><span>Total Push</span><span>{analysis.probabilityBreakdown.simulation.pushTotal?.toFixed(1)}%</span></div>}
                          </div>
                          {analysis.probabilityBreakdown.simulation.percentiles && (
                            <div className="mt-2 text-[11px]">
                              <p className="font-semibold text-amber-700">Score percentiles</p>
                              <p>{team2.split(' ').pop()}: {analysis.probabilityBreakdown.simulation.percentiles.team2.p10.toFixed(1)} / {analysis.probabilityBreakdown.simulation.percentiles.team2.p50.toFixed(1)} / {analysis.probabilityBreakdown.simulation.percentiles.team2.p90.toFixed(1)}</p>
                              <p>{team1.split(' ').pop()}: {analysis.probabilityBreakdown.simulation.percentiles.team1.p10.toFixed(1)} / {analysis.probabilityBreakdown.simulation.percentiles.team1.p50.toFixed(1)} / {analysis.probabilityBreakdown.simulation.percentiles.team1.p90.toFixed(1)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Predicted Score Display */}
                    <div className="mt-3 pt-3 border-t border-slate-700 text-center">
                      <p className="text-slate-400 text-xs mb-1">Predicted Score (Elo-based)</p>
                      <p className="text-lg font-bold">
                        <span className="text-blue-300">{team2.split(' ').pop()}</span>
                        <span className="text-white mx-2">
                          {sport === 'nhl'
                            ? `${analysis.team2PredScore.toFixed(1)} - ${analysis.team1PredScore.toFixed(1)}`
                            : `${Math.round(analysis.team2PredScore)} - ${Math.round(analysis.team1PredScore)}`
                          }
                        </span>
                        <span className="text-blue-300">{team1.split(' ').pop()}</span>
                      </p>
                      {analysis.team1OffDefScore && (
                        <div className="mt-2">
                          <p className="text-slate-500 text-xs mb-1">Off/Def Tendency</p>
                          <p className="text-sm text-slate-300">
                            <span>{team2.split(' ').pop()}</span>
                            <span className="mx-2">
                              {sport === 'nhl'
                                ? `${analysis.team2OffDefScore.toFixed(1)} - ${analysis.team1OffDefScore.toFixed(1)}`
                                : `${Math.round(analysis.team2OffDefScore)} - ${Math.round(analysis.team1OffDefScore)}`
                              }
                            </span>
                            <span>{team1.split(' ').pop()}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Model Insights - Divergence Alerts */}
                  {analysis.insights && analysis.insights.length > 0 && (
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                        <span className="text-lg">🧠</span> Model Insights
                        <span className="text-xs font-normal text-slate-400">(Elo vs Off/Def divergence)</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {analysis.insights.map((insight, idx) => (
                          <div key={idx} className={`p-3 rounded-lg border ${insight.bg}`}>
                            <div className="flex items-start gap-2">
                              <span className="text-lg">{insight.icon}</span>
                              <div className="flex-1">
                                <p className={`font-bold text-sm ${insight.color}`}>{insight.title}</p>
                                <p className="text-xs text-gray-600 mt-1">{insight.message}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={cardStyle}>
                      <h3 className="font-bold text-sm mb-2">💰 Moneyline</h3>
                      <p className="text-[11px] text-gray-500 mb-2">Probabilities from {analysis.ml1Analysis?.probSource === 'simulation' || analysis.ml2Analysis?.probSource === 'simulation' ? 'simulation output' : 'analytical model'}</p>
                      {analysis.ml1Analysis ? (
                        <div className={`p-2 rounded mb-2 border ${analysis.ml1Analysis.isPositive ? analysis.ml1Analysis.confidence.bg : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex justify-between items-center"><p className="font-medium text-sm">{team1.split(' ').pop()}</p>{analysis.ml1Analysis.isPositive && <span className={`text-xs ${analysis.ml1Analysis.confidence.color}`}>{analysis.ml1Analysis.confidence.stars}</span>}</div>
                          <div className="flex justify-between text-xs"><span>Edge:</span><span className={analysis.ml1Analysis.edge > 0 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{analysis.ml1Analysis.edge > 0 ? '+' : ''}{analysis.ml1Analysis.edge.toFixed(1)}%</span></div>
                          <div className="flex justify-between text-xs"><span>EV:</span><span className={analysis.ml1Analysis.ev > 0 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{analysis.ml1Analysis.ev > 0 ? '+' : ''}{analysis.ml1Analysis.ev.toFixed(1)}%</span></div>
                          {analysis.ml1Analysis.isPositive && <p className="text-xs text-emerald-700 mt-1 font-medium">Kelly: ${analysis.ml1Analysis.kelly.toFixed(0)}{analysis.ml1Analysis.kellyCapped && <span className="text-amber-600"> (max)</span>} • {analysis.ml1Analysis.confidence.label}</p>}
                        </div>
                      ) : <p className="text-xs text-gray-400 mb-2">Enter ML odds</p>}
                      {analysis.ml2Analysis && (
                        <div className={`p-2 rounded border ${analysis.ml2Analysis.isPositive ? analysis.ml2Analysis.confidence.bg : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex justify-between items-center"><p className="font-medium text-sm">{team2.split(' ').pop()}</p>{analysis.ml2Analysis.isPositive && <span className={`text-xs ${analysis.ml2Analysis.confidence.color}`}>{analysis.ml2Analysis.confidence.stars}</span>}</div>
                          <div className="flex justify-between text-xs"><span>Edge:</span><span className={analysis.ml2Analysis.edge > 0 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{analysis.ml2Analysis.edge > 0 ? '+' : ''}{analysis.ml2Analysis.edge.toFixed(1)}%</span></div>
                          <div className="flex justify-between text-xs"><span>EV:</span><span className={analysis.ml2Analysis.ev > 0 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{analysis.ml2Analysis.ev > 0 ? '+' : ''}{analysis.ml2Analysis.ev.toFixed(1)}%</span></div>
                          {analysis.ml2Analysis.isPositive && <p className="text-xs text-emerald-700 mt-1 font-medium">Kelly: ${analysis.ml2Analysis.kelly.toFixed(0)}{analysis.ml2Analysis.kellyCapped && <span className="text-amber-600"> (max)</span>} • {analysis.ml2Analysis.confidence.label}</p>}
                        </div>
                      )}
                    </div>

                    <div className={cardStyle}>
                      <h3 className="font-bold text-sm mb-2">📊 Spread</h3>
                      <p className="text-[11px] text-gray-500">Probabilities from {analysis.spreadAnalysis.source === 'simulation' ? 'simulation output' : 'analytical model'}{analysis.spreadAnalysis.pushProb ? ` • Push: ${analysis.spreadAnalysis.pushProb.toFixed(1)}%` : ''}</p>
                      {analysis.spreadAnalysis ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm"><span>Model:</span><span className="font-bold">{team1.split(' ').pop()} {analysis.spreadAnalysis.predictedSpread > 0 ? '+' : ''}{analysis.spreadAnalysis.predictedSpread.toFixed(1)}</span></div>
                          <div className="flex justify-between text-[11px] text-gray-500"><span>Analytical cover:</span><span>{analysis.spreadAnalysis.modelCoverProb !== null && analysis.spreadAnalysis.modelCoverProb !== undefined ? `${analysis.spreadAnalysis.modelCoverProb.toFixed(1)}%` : '--'}</span></div>
                          <div className="flex justify-between text-[11px] text-gray-500"><span>Sim cover:</span><span>{analysis.spreadAnalysis.simCoverProb !== null && analysis.spreadAnalysis.simCoverProb !== undefined ? `${analysis.spreadAnalysis.simCoverProb.toFixed(1)}%` : '--'}</span></div>
                          <div className={`p-2 rounded border ${analysis.spreadAnalysis.isHomePositive ? analysis.spreadAnalysis.homeConfidence.bg : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex justify-between text-xs"><span className="font-medium">{team1.split(' ').pop()} {analysis.spreadAnalysis.homeSpread > 0 ? '+' : ''}{analysis.spreadAnalysis.homeSpread}</span>{analysis.spreadAnalysis.isHomePositive && <span className={analysis.spreadAnalysis.homeConfidence.color}>{analysis.spreadAnalysis.homeConfidence.stars}</span>}</div>
                            <div className="flex justify-between text-xs"><span>Cover:</span><span>{analysis.spreadAnalysis.homeCoverProb.toFixed(1)}%</span></div>
                            <div className="flex justify-between text-xs"><span>EV:</span><span className={analysis.spreadAnalysis.homeEV > 0 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{analysis.spreadAnalysis.homeEV > 0 ? '+' : ''}{analysis.spreadAnalysis.homeEV.toFixed(1)}%</span></div>
                            {analysis.spreadAnalysis.isHomePositive && <p className="text-xs text-emerald-700 mt-1 font-medium">Kelly: ${analysis.spreadAnalysis.homeKelly.toFixed(0)}{analysis.spreadAnalysis.homeKellyCapped && <span className="text-amber-600"> (max)</span>}</p>}
                          </div>
                          <div className={`p-2 rounded border ${analysis.spreadAnalysis.isAwayPositive ? analysis.spreadAnalysis.awayConfidence.bg : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex justify-between text-xs"><span className="font-medium">{team2.split(' ').pop()} {analysis.spreadAnalysis.awaySpread > 0 ? '+' : ''}{analysis.spreadAnalysis.awaySpread}</span>{analysis.spreadAnalysis.isAwayPositive && <span className={analysis.spreadAnalysis.awayConfidence.color}>{analysis.spreadAnalysis.awayConfidence.stars}</span>}</div>
                            <div className="flex justify-between text-xs"><span>Cover:</span><span>{analysis.spreadAnalysis.awayCoverProb.toFixed(1)}%</span></div>
                            <div className="flex justify-between text-xs"><span>EV:</span><span className={analysis.spreadAnalysis.awayEV > 0 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{analysis.spreadAnalysis.awayEV > 0 ? '+' : ''}{analysis.spreadAnalysis.awayEV.toFixed(1)}%</span></div>
                            {analysis.spreadAnalysis.isAwayPositive && <p className="text-xs text-emerald-700 mt-1 font-medium">Kelly: ${analysis.spreadAnalysis.awayKelly.toFixed(0)}{analysis.spreadAnalysis.awayKellyCapped && <span className="text-amber-600"> (max)</span>}</p>}
                          </div>
                        </div>
                      ) : <p className="text-xs text-gray-400">Enter spread</p>}
                    </div>

                    <div className={cardStyle}>
                      <h3 className="font-bold text-sm mb-2">🎯 Total</h3>
                      <p className="text-[11px] text-gray-500">Probabilities from {analysis.totalsAnalysis.source === 'simulation' ? 'simulation output' : 'analytical model'}{analysis.totalsAnalysis.pushProb ? ` • Push: ${analysis.totalsAnalysis.pushProb.toFixed(1)}%` : ''}</p>
                      {analysis.totalsAnalysis ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm"><span>Model:</span><span className="font-bold">{analysis.totalsAnalysis.predictedTotal.toFixed(1)}</span></div>
                          <div className="flex justify-between text-[11px] text-gray-500"><span>Analytical over:</span><span>{analysis.totalsAnalysis.modelOverProb !== null && analysis.totalsAnalysis.modelOverProb !== undefined ? `${analysis.totalsAnalysis.modelOverProb.toFixed(1)}%` : '--'}</span></div>
                          <div className="flex justify-between text-[11px] text-gray-500"><span>Sim over:</span><span>{analysis.totalsAnalysis.simOverProb !== null && analysis.totalsAnalysis.simOverProb !== undefined ? `${analysis.totalsAnalysis.simOverProb.toFixed(1)}%` : '--'}</span></div>
                          <div className={`p-2 rounded border ${analysis.totalsAnalysis.isOverPositive ? analysis.totalsAnalysis.overConfidence.bg : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex justify-between text-xs"><span className="font-medium">OVER {bookTotal}</span>{analysis.totalsAnalysis.isOverPositive && <span className={analysis.totalsAnalysis.overConfidence.color}>{analysis.totalsAnalysis.overConfidence.stars}</span>}</div>
                            <div className="flex justify-between text-xs"><span>Prob:</span><span>{analysis.totalsAnalysis.overProb.toFixed(1)}%</span></div>
                            <div className="flex justify-between text-xs"><span>EV:</span><span className={analysis.totalsAnalysis.overEV > 0 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{analysis.totalsAnalysis.overEV > 0 ? '+' : ''}{analysis.totalsAnalysis.overEV.toFixed(1)}%</span></div>
                          </div>
                          <div className={`p-2 rounded border ${analysis.totalsAnalysis.isUnderPositive ? analysis.totalsAnalysis.underConfidence.bg : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex justify-between text-xs"><span className="font-medium">UNDER {bookTotal}</span>{analysis.totalsAnalysis.isUnderPositive && <span className={analysis.totalsAnalysis.underConfidence.color}>{analysis.totalsAnalysis.underConfidence.stars}</span>}</div>
                            <div className="flex justify-between text-xs"><span>Prob:</span><span>{analysis.totalsAnalysis.underProb.toFixed(1)}%</span></div>
                            <div className="flex justify-between text-xs"><span>EV:</span><span className={analysis.totalsAnalysis.underEV > 0 ? 'text-emerald-600 font-bold' : 'text-red-500'}>{analysis.totalsAnalysis.underEV > 0 ? '+' : ''}{analysis.totalsAnalysis.underEV.toFixed(1)}%</span></div>
                          </div>
                        </div>
                      ) : <p className="text-xs text-gray-400">Enter total</p>}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-4 text-white">
                    <h3 className="font-bold mb-2">✅ +EV Bets (Ranked by Confidence)</h3>
                    <div className="space-y-1 text-sm">
                      {[
                        analysis.ml1Analysis?.isPositive && { type: `${team1.split(' ').pop()} ML @ ${bookML1}`, kelly: analysis.ml1Analysis.kelly, capped: analysis.ml1Analysis.kellyCapped, ev: analysis.ml1Analysis.ev, conf: analysis.ml1Analysis.confidence },
                        analysis.ml2Analysis?.isPositive && { type: `${team2.split(' ').pop()} ML @ ${bookML2}`, kelly: analysis.ml2Analysis.kelly, capped: analysis.ml2Analysis.kellyCapped, ev: analysis.ml2Analysis.ev, conf: analysis.ml2Analysis.confidence },
                        analysis.spreadAnalysis?.isHomePositive && { type: `${team1.split(' ').pop()} ${analysis.spreadAnalysis.homeSpread > 0 ? '+' : ''}${analysis.spreadAnalysis.homeSpread} @ ${bookSpreadOdds}`, kelly: analysis.spreadAnalysis.homeKelly, capped: analysis.spreadAnalysis.homeKellyCapped, ev: analysis.spreadAnalysis.homeEV, conf: analysis.spreadAnalysis.homeConfidence },
                        analysis.spreadAnalysis?.isAwayPositive && { type: `${team2.split(' ').pop()} ${analysis.spreadAnalysis.awaySpread > 0 ? '+' : ''}${analysis.spreadAnalysis.awaySpread} @ ${bookSpreadOdds2}`, kelly: analysis.spreadAnalysis.awayKelly, capped: analysis.spreadAnalysis.awayKellyCapped, ev: analysis.spreadAnalysis.awayEV, conf: analysis.spreadAnalysis.awayConfidence },
                        analysis.totalsAnalysis?.isOverPositive && { type: `OVER ${bookTotal} @ ${bookOverOdds}`, kelly: analysis.totalsAnalysis.overKelly, capped: analysis.totalsAnalysis.overKellyCapped, ev: analysis.totalsAnalysis.overEV, conf: analysis.totalsAnalysis.overConfidence },
                        analysis.totalsAnalysis?.isUnderPositive && { type: `UNDER ${bookTotal} @ ${bookUnderOdds}`, kelly: analysis.totalsAnalysis.underKelly, capped: analysis.totalsAnalysis.underKellyCapped, ev: analysis.totalsAnalysis.underEV, conf: analysis.totalsAnalysis.underConfidence },
                      ].filter(Boolean).sort((a, b) => b.ev - a.ev).map((bet, i) => (
                        <p key={i} className="flex items-center gap-2">
                          <span className="text-yellow-300">{bet.conf.stars}</span>
                          <span>{bet.type} → ${bet.kelly.toFixed(0)}{bet.capped && <span className="text-amber-300"> (max)</span>} (EV: +{bet.ev.toFixed(1)}%) - {bet.conf.label}</span>
                        </p>
                      ))}
                      {!analysis.ml1Analysis?.isPositive && !analysis.ml2Analysis?.isPositive && !analysis.spreadAnalysis?.isHomePositive && !analysis.spreadAnalysis?.isAwayPositive && !analysis.totalsAnalysis?.isOverPositive && !analysis.totalsAnalysis?.isUnderPositive && <p className="text-emerald-100">No +EV bets found with current lines</p>}
                    </div>
                  </div>

                  {/* H2H History */}
                  {(() => {
                    const h2hGames = gameLog.filter(g => 
                      (g.team1 === team1 && g.team2 === team2) || (g.team1 === team2 && g.team2 === team1)
                    ).slice(-5).reverse();
                    if (h2hGames.length === 0) return null;
                    const team1Wins = h2hGames.filter(g => 
                      (g.team1 === team1 && parseInt(g.score.split('-')[0]) > parseInt(g.score.split('-')[1])) ||
                      (g.team2 === team1 && parseInt(g.score.split('-')[1]) > parseInt(g.score.split('-')[0]))
                    ).length;
                    return (
                      <div className={cardStyle}>
                        <h3 className="font-bold mb-2 text-slate-300">🔄 Head-to-Head (Last {h2hGames.length})</h3>
                        <p className="text-xs text-slate-400 mb-2">{team1.split(' ').pop()}: {team1Wins}W | {team2.split(' ').pop()}: {h2hGames.length - team1Wins}W</p>
                        <div className="space-y-1">
                          {h2hGames.map((g, i) => {
                            const [s1, s2] = g.score.split('-').map(s => parseInt(s));
                            const t1Won = (g.team1 === team1 && s1 > s2) || (g.team2 === team1 && s2 > s1);
                            return (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-slate-500">{g.date}</span>
                                <span className={t1Won ? 'text-emerald-400' : 'text-red-400'}>
                                  {g.team1.split(' ').pop()} {g.score} {g.team2.split(' ').pop()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : <div className={`${cardStyle} text-center py-12`}><p className="text-gray-500">Select two teams to analyze</p></div>}
            </div>
            
            {/* AI Insights Panel */}
            {team1 && team2 && (
              <div className="lg:col-span-3 mt-4">
                <div className={cardStyle}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">🤖 AI Insights</h3>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        {openRouterApiKey ? `via ${aiModel.split('/').pop().split(':')[0]}` : 'OpenRouter'}
                      </span>
                      {enableWebSearch && openRouterApiKey && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">🔍 Live</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!aiInsightsLoading && !aiInsights && (
                        <button
                          onClick={() => fetchAiInsights(team2, team1, '')}
                          className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                        >
                          {enableWebSearch ? '🔍 Generate with Live Data' : 'Generate Insights'}
                        </button>
                      )}
                      {aiInsights && !aiInsights.error && (
                        <button
                          onClick={() => fetchAiInsights(team2, team1, '')}
                          className="px-2 py-1 text-indigo-600 text-xs hover:bg-indigo-50 rounded"
                        >
                          🔄 Refresh
                        </button>
                      )}
                      <button
                        onClick={() => setShowAiInsights(!showAiInsights)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {showAiInsights ? '▼' : '▶'}
                      </button>
                    </div>
                  </div>
                  
                  {showAiInsights && (
                    <>
                      {aiInsightsLoading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-3"></div>
                          <p className="text-gray-500">Analyzing {team2} @ {team1}...</p>
                          <p className="text-xs text-gray-400 mt-1">Researching injuries, form, and key factors</p>
                        </div>
                      ) : aiInsights ? (
                        <div>
                          {aiInsights.error ? (
                            <div className="text-center py-6">
                              {aiInsights.needsApiKey ? (
                                <>
                                  <p className="text-4xl mb-3">🔑</p>
                                  <p className="text-gray-700 font-medium">API Key Required</p>
                                  <p className="text-sm text-gray-500 mt-1 mb-4">Add your free OpenRouter API key in Bankroll Settings</p>
                                  <a 
                                    href="https://openrouter.ai/keys" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 mr-2"
                                  >
                                    Get Free Key →
                                  </a>
                                  <button
                                    onClick={() => setActiveTab('bankroll')}
                                    className="px-4 py-2 border border-indigo-600 text-indigo-600 text-sm rounded-lg hover:bg-indigo-50"
                                  >
                                    Go to Settings
                                  </button>
                                </>
                              ) : (
                                <>
                                  <p className="text-gray-500">😕 {aiInsights.text}</p>
                                  <button
                                    onClick={() => fetchAiInsights(team2, team1, '')}
                                    className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                                  >
                                    Try Again
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <>
                              {/* Apply Suggestions Button */}
                              {aiInsights.suggestions && Object.values(aiInsights.suggestions).some(v => v !== 0) && (
                                <div className="mb-3 p-2 bg-indigo-50 rounded-lg flex justify-between items-center">
                                  <span className="text-sm text-indigo-800">
                                    <strong>💡 AI Suggested Adjustments:</strong>
                                    {aiInsights.suggestions.team1Injury !== 0 && ` ${team1.split(' ').pop()} Inj: ${aiInsights.suggestions.team1Injury}`}
                                    {aiInsights.suggestions.team2Injury !== 0 && ` ${team2.split(' ').pop()} Inj: ${aiInsights.suggestions.team2Injury}`}
                                    {aiInsights.suggestions.team1Rest !== 0 && ` ${team1.split(' ').pop()} Rest: ${aiInsights.suggestions.team1Rest > 0 ? '+' : ''}${aiInsights.suggestions.team1Rest}`}
                                    {aiInsights.suggestions.team2Rest !== 0 && ` ${team2.split(' ').pop()} Rest: ${aiInsights.suggestions.team2Rest > 0 ? '+' : ''}${aiInsights.suggestions.team2Rest}`}
                                  </span>
                                  <button
                                    onClick={applyAiSuggestions}
                                    className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                                  >
                                    Apply to Sliders
                                  </button>
                                </div>
                              )}
                              
                              {/* Insights Text */}
                              <div className="prose prose-sm max-w-none text-gray-700 space-y-2">
                                {aiInsights.text.split('\n').map((line, i) => {
                                  if (line.startsWith('**') || line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('4.') || line.startsWith('5.')) {
                                    return <p key={i} className="font-semibold text-gray-800 mt-3 first:mt-0">{line.replace(/\*\*/g, '')}</p>;
                                  }
                                  if (line.startsWith('-') || line.startsWith('•')) {
                                    return <p key={i} className="ml-4 text-sm">{line}</p>;
                                  }
                                  if (line.trim()) {
                                    return <p key={i} className="text-sm">{line}</p>;
                                  }
                                  return null;
                                })}
                              </div>
                              
                              {/* Footer */}
                              <div className="mt-4 pt-3 border-t text-xs text-gray-400 flex justify-between">
                                <span>
                                  Generated at {aiInsights.generatedAt} 
                                  {aiInsights.model && ` • ${aiInsights.model.split('/').pop().split(':')[0]}`}
                                  {aiInsights.webSearchUsed && ' • 🔍 Live data'}
                                </span>
                                <span>⚠️ {aiInsights.webSearchUsed ? 'Verify critical info' : 'AI analysis is supplementary - always verify injury reports'}</span>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          {!openRouterApiKey ? (
                            <>
                              <p className="text-4xl mb-2">🔑</p>
                              <p className="font-medium text-gray-700">API Key Required</p>
                              <p className="text-xs text-gray-400 mt-1 mb-3">Add your free OpenRouter API key in Bankroll Settings</p>
                              <button
                                onClick={() => setActiveTab('bankroll')}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                              >
                                Go to Settings
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-4xl mb-2">🤖</p>
                              <p className="font-medium text-gray-700 mb-1">Ready to analyze {team2} @ {team1}</p>
                              <p className="text-xs text-gray-400 mb-4">Get injury reports, recent form, and betting angles</p>
                              <button
                                onClick={() => fetchAiInsights(team2, team1, '')}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                              >
                                {enableWebSearch ? '🔍 Generate with Live Data' : '✨ Generate AI Insights'}
                              </button>
                              {enableWebSearch && (
                                <p className="text-xs text-amber-600 mt-2">Web search enabled (+$0.02)</p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tracker' && (
          <div className="space-y-4">
            {/* P/L Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Record</p><p className="font-bold text-lg">{stats.wins}-{stats.losses}-{stats.pushes}</p></div>
              <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Win Rate</p><p className="font-bold text-lg">{stats.winRate.toFixed(1)}%</p></div>
              <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Total Staked</p><p className="font-bold text-lg">${stats.totalStaked.toFixed(0)}</p></div>
              <div className={`rounded-lg p-3 text-center ${stats.totalProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}><p className="text-xs text-gray-500">Profit/Loss</p><p className={`font-bold text-lg ${stats.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(2)}</p></div>
              <div className={`rounded-lg p-3 text-center ${stats.roi >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}><p className="text-xs text-gray-500">ROI</p><p className={`font-bold text-lg ${stats.roi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%</p></div>
              <div className={`rounded-lg p-3 text-center ${stats.units >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}><p className="text-xs text-gray-500">Units</p><p className={`font-bold text-lg ${stats.units >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{stats.units >= 0 ? '+' : ''}{stats.units.toFixed(1)}u</p></div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Pending</p><p className="font-bold text-lg text-yellow-600">{stats.pending}</p></div>
              <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Bankroll</p><p className="font-bold text-lg text-blue-600">${(parseFloat(bankroll) + stats.totalProfit - bets.filter(b => b.result === 'pending').reduce((sum, b) => sum + b.stake, 0)).toFixed(0)}</p></div>
            </div>

            {/* Add New Bet */}
            <div className={cardStyle}>
              <h2 className="text-lg font-bold mb-3">➕ Log New Bet</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                <div><label className={labelStyle}>Date</label><input type="date" value={newBet.date} onChange={(e) => setNewBet({...newBet, date: e.target.value})} className={inputStyle} /></div>
                <div><label className={labelStyle}>Sport</label><select value={newBet.sport} onChange={(e) => setNewBet({...newBet, sport: e.target.value})} className={inputStyle}>{Object.keys(sportConfig).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}</select></div>
                <div><label className={labelStyle}>Game</label><input type="text" value={newBet.game} onChange={(e) => setNewBet({...newBet, game: e.target.value})} placeholder="NE vs DEN" className={inputStyle} /></div>
                <div><label className={labelStyle}>Type</label><select value={newBet.betType} onChange={(e) => setNewBet({...newBet, betType: e.target.value})} className={inputStyle}><option>ML</option><option>Spread</option><option>Over</option><option>Under</option></select></div>
                <div><label className={labelStyle}>Pick</label><input type="text" value={newBet.pick} onChange={(e) => setNewBet({...newBet, pick: e.target.value})} placeholder="Patriots -3" className={inputStyle} /></div>
                <div><label className={labelStyle}>Odds</label><input type="text" value={newBet.odds} onChange={(e) => setNewBet({...newBet, odds: e.target.value})} placeholder="-110" className={inputStyle} /></div>
                <div><label className={labelStyle}>Stake ($)</label><input type="number" value={newBet.stake} onChange={(e) => setNewBet({...newBet, stake: e.target.value})} placeholder="25" className={inputStyle} /></div>
                <div><label className={labelStyle}>&nbsp;</label><button onClick={addBet} className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600">Add</button></div>
              </div>
            </div>

            {/* Bet History */}
            <div className={cardStyle}>
              <h2 className="text-lg font-bold mb-3">📋 Bet History</h2>
              {bets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-xs text-gray-500"><th className="p-2">Date</th><th className="p-2">Sport</th><th className="p-2">Game</th><th className="p-2">Pick</th><th className="p-2">Odds</th><th className="p-2">Stake</th><th className="p-2">Result</th><th className="p-2">P/L</th><th className="p-2">Actions</th></tr></thead>
                    <tbody>
                      {bets.slice().reverse().map(bet => (
                        <tr key={bet.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{bet.date}</td>
                          <td className="p-2 uppercase">{bet.sport}</td>
                          <td className="p-2">{bet.game}</td>
                          <td className="p-2 font-medium">{bet.pick}</td>
                          <td className="p-2">{bet.odds}</td>
                          <td className="p-2">${bet.stake}</td>
                          <td className="p-2">
                            <select value={bet.result} onChange={(e) => updateBetResult(bet.id, e.target.value)} className={`text-xs p-1 rounded ${bet.result === 'win' ? 'bg-emerald-100 text-emerald-700' : bet.result === 'loss' ? 'bg-red-100 text-red-700' : bet.result === 'push' ? 'bg-gray-100' : 'bg-yellow-100 text-yellow-700'}`}>
                              <option value="pending">Pending</option>
                              <option value="win">Win</option>
                              <option value="loss">Loss</option>
                              <option value="push">Push</option>
                            </select>
                          </td>
                          <td className={`p-2 font-bold ${bet.payout > 0 ? 'text-emerald-600' : bet.payout < 0 ? 'text-red-600' : ''}`}>{bet.result !== 'pending' ? (bet.payout >= 0 ? '+' : '') + '$' + bet.payout.toFixed(2) : '-'}</td>
                          <td className="p-2"><button onClick={() => deleteBet(bet.id)} className="text-red-500 hover:text-red-700 text-xs">🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-gray-400 text-center py-8">No bets logged yet. Add your first bet above!</p>}
            </div>
          </div>
        )}

        {activeTab === 'ratings' && (
          <div className="space-y-4">
            {/* Add New Team */}
            <div className={cardStyle}>
              <h2 className="text-lg font-bold mb-3">➕ Add New Team to {config.name}</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className="md:col-span-2"><label className={labelStyle}>Team Name</label><input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g. Kansas Jayhawks" className={inputStyle} /></div>
                <div><label className={labelStyle}>Elo Rating</label><input type="number" value={newTeamElo} onChange={(e) => setNewTeamElo(e.target.value)} placeholder="1500" className={inputStyle} /></div>
                <div><label className={labelStyle}>Offense</label><input type="number" value={newTeamOff} onChange={(e) => setNewTeamOff(e.target.value)} placeholder="100" className={inputStyle} /></div>
                <div><label className={labelStyle}>Defense</label><input type="number" value={newTeamDef} onChange={(e) => setNewTeamDef(e.target.value)} placeholder="100" className={inputStyle} /></div>
              </div>
              <button onClick={addTeam} disabled={!newTeamName.trim()} className="mt-3 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50">Add Team</button>
              <p className="text-xs text-gray-400 mt-2">Elo: 1650+=Elite, 1550=Playoff, 1450=Average, &lt;1400=Weak | Off/Def: 100=average, higher=better</p>
            </div>

            {/* Team Ratings List */}
            <div className={cardStyle}>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold">📊 {config.name} Power Ratings ({teamList.length} teams)</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const data = teamList.map(name => `${name}: Elo ${teams[name].elo}, Off ${teams[name].off}, Def ${teams[name].def}`).join('\n');
                      navigator.clipboard.writeText(data);
                      alert('Ratings copied to clipboard!');
                    }} 
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    📋 Copy All
                  </button>
                  <button onClick={resetToBaseline} className="text-xs text-orange-500 hover:text-orange-700">
                    {(sport === 'cbb' || sport === 'cfb') ? 'Clear & Reimport' : 'Reset to 1500'}
                  </button>
                  <button onClick={resetAllData} className="text-xs text-red-500 hover:text-red-700">Reset {config.name}</button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-3">Click a team to expand and adjust Off/Def ratings</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[500px] overflow-y-auto">
                {teamList.map((name, idx) => (
                  <div key={name} className={`p-2 bg-gray-50 rounded text-sm ${expandedTeam === name ? 'ring-2 ring-blue-400' : ''}`}>
                    <div 
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setExpandedTeam(expandedTeam === name ? null : name)}
                    >
                      <span className="text-xs text-gray-400 w-5">{idx + 1}</span>
                      <span className="font-medium flex-1 truncate text-xs">{name}</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => adjustRating(name, 'elo', -10)} className="w-5 h-5 bg-red-100 rounded text-red-600 text-xs">-</button>
                        <span className="w-12 text-center font-bold text-blue-600 text-xs">{teams[name].elo}</span>
                        <button onClick={() => adjustRating(name, 'elo', 10)} className="w-5 h-5 bg-green-100 rounded text-green-600 text-xs">+</button>
                        <button onClick={() => deleteTeam(name)} className="w-5 h-5 ml-1 text-red-400 hover:text-red-600 text-xs" title="Delete team">🗑️</button>
                      </div>
                    </div>
                    {expandedTeam === name && (
                      <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Offense</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => adjustRating(name, 'off', -2)} className="w-5 h-5 bg-red-100 rounded text-red-600 text-xs">-</button>
                            <span className={`w-10 text-center font-bold text-xs ${teams[name].off > 100 ? 'text-emerald-600' : teams[name].off < 100 ? 'text-red-600' : 'text-gray-600'}`}>{teams[name].off}</span>
                            <button onClick={() => adjustRating(name, 'off', 2)} className="w-5 h-5 bg-green-100 rounded text-green-600 text-xs">+</button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Defense</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => adjustRating(name, 'def', -2)} className="w-5 h-5 bg-green-100 rounded text-green-600 text-xs">-</button>
                            <span className={`w-10 text-center font-bold text-xs ${teams[name].def > 100 ? 'text-emerald-600' : teams[name].def < 100 ? 'text-red-600' : 'text-gray-600'}`}>{teams[name].def}</span>
                            <button onClick={() => adjustRating(name, 'def', 2)} className="w-5 h-5 bg-red-100 rounded text-red-600 text-xs">+</button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">Off: higher=more scoring | Def: higher=better</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={cardStyle}>
              <h2 className="text-lg font-bold mb-3">📝 Record Result</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div><label className={labelStyle}>Team 1</label><select value={resultTeam1} onChange={(e) => setResultTeam1(e.target.value)} className={inputStyle}><option value="">Select...</option>{teamList.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className={labelStyle}>Score</label><input type="number" value={score1} onChange={(e) => setScore1(e.target.value)} className={inputStyle} /></div>
                <div><label className={labelStyle}>Team 2</label><select value={resultTeam2} onChange={(e) => setResultTeam2(e.target.value)} className={inputStyle}><option value="">Select...</option>{teamList.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className={labelStyle}>Score</label><input type="number" value={score2} onChange={(e) => setScore2(e.target.value)} className={inputStyle} /></div>
              </div>
              {sport === 'nhl' && (
                <label className="flex items-center gap-2 text-sm mb-3">
                  <input type="checkbox" checked={isOT} onChange={(e) => setIsOT(e.target.checked)} className="rounded" />
                  Overtime/Shootout (loser gets 75% Elo protection)
                </label>
              )}
              <button onClick={updateRatings} disabled={!resultTeam1 || !resultTeam2 || score1 === '' || score2 === ''} className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50">Update Ratings</button>
            </div>
            <div className={cardStyle}>
              <h2 className="text-lg font-bold mb-3">📜 Game Log</h2>
              {gameLog.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {gameLog.slice().reverse().map((g, i) => {
                    const actualIndex = gameLog.length - 1 - i; // Convert reversed index to actual
                    return (
                    <div key={i} className="p-3 bg-gray-50 rounded text-xs">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{g.team1} vs {g.team2}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{g.score}</span>
                          <button 
                            onClick={() => deleteGameFromLog(actualIndex)} 
                            className="text-red-400 hover:text-red-600" 
                            title="Delete game and recalculate ratings"
                          >🗑️</button>
                        </div>
                      </div>
                      {g.t1Changes && g.t2Changes ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white p-2 rounded">
                            <p className="font-medium text-gray-600 mb-1">{g.team1}</p>
                            <div className="flex gap-2">
                              <span className={g.t1Changes.elo >= 0 ? 'text-emerald-600' : 'text-red-600'}>Elo: {g.t1Changes.elo >= 0 ? '+' : ''}{g.t1Changes.elo}</span>
                              <span className={g.t1Changes.off >= 0 ? 'text-emerald-600' : 'text-red-600'}>Off: {g.t1Changes.off >= 0 ? '+' : ''}{g.t1Changes.off}</span>
                              <span className={g.t1Changes.def >= 0 ? 'text-emerald-600' : 'text-red-600'}>Def: {g.t1Changes.def >= 0 ? '+' : ''}{g.t1Changes.def}</span>
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded">
                            <p className="font-medium text-gray-600 mb-1">{g.team2}</p>
                            <div className="flex gap-2">
                              <span className={g.t2Changes.elo >= 0 ? 'text-emerald-600' : 'text-red-600'}>Elo: {g.t2Changes.elo >= 0 ? '+' : ''}{g.t2Changes.elo}</span>
                              <span className={g.t2Changes.off >= 0 ? 'text-emerald-600' : 'text-red-600'}>Off: {g.t2Changes.off >= 0 ? '+' : ''}{g.t2Changes.off}</span>
                              <span className={g.t2Changes.def >= 0 ? 'text-emerald-600' : 'text-red-600'}>Def: {g.t2Changes.def >= 0 ? '+' : ''}{g.t2Changes.def}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-emerald-600">±{g.eloChange}</span>
                      )}
                    </div>
                  )})}
                </div>
              ) : <p className="text-gray-400 text-sm">No games recorded</p>}
            </div>
            
            {/* ESPN/NCAA Import */}
            <div className={`${cardStyle} lg:col-span-2`}>
              <h2 className="text-lg font-bold mb-3">📡 Import from {sportConfig[sport]?.useNcaaApi ? 'NCAA' : 'ESPN'}</h2>
              {sportConfig[sport]?.useNcaaApi && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs">
                  ⚡ D3 data via <a href="https://ncaa-api.henrygd.me" target="_blank" rel="noopener noreferrer" className="underline font-medium">ncaa-api.henrygd.me</a> • Rate limited to 5 req/sec • Full season import may take several minutes
                </div>
              )}
              <div className="flex flex-wrap gap-3 items-end mb-4">
                <div>
                  <label className={labelStyle}>Date</label>
                  <input 
                    type="date" 
                    value={importDate} 
                    onChange={(e) => setImportDate(e.target.value)} 
                    className={inputStyle}
                  />
                </div>
                <button 
                  onClick={fetchESPNScores} 
                  disabled={importLoading}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 disabled:opacity-50"
                >
                  {importLoading && !seasonImportProgress ? 'Loading...' : `Fetch ${config.name} Scores`}
                </button>
                <button 
                  onClick={importFullSeason} 
                  disabled={importLoading}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50"
                >
                  🚀 Import Full Season
                </button>
                {espnGames.length > 0 && (
                  <>
                    <button
                      onClick={toggleSelectAll}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
                    >
                      {espnGames.filter(g => g.canImport).every(g => selectedGames[g.id]) ? 'Deselect All' : 'Select All'}
                    </button>
                    {espnGames.some(g => g.isDuplicate) && (
                      <button
                        onClick={selectAllIncludingDuplicates}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600"
                      >
                        {espnGames.every(g => selectedGames[g.id]) ? 'Deselect All' : 'Select All (incl. duplicates)'}
                      </button>
                    )}
                    <button
                      onClick={importSelectedGames}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600"
                    >
                      Import Selected ({Object.values(selectedGames).filter(Boolean).length})
                    </button>
                  </>
                )}
              </div>
              
              {seasonImportProgress && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    {seasonImportProgress}
                  </div>
                </div>
              )}
              
              {importError && (
                <div className={`p-3 rounded-lg text-sm mb-4 ${
                  importError.startsWith('Auto-added') || importError.includes('duplicate')
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {(importError.startsWith('Auto-added') || importError.includes('duplicate')) ? '✨ ' : ''}{importError}
                </div>
              )}
              
              {espnGames.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {espnGames.map(game => (
                    <div 
                      key={game.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        game.isDuplicate
                          ? 'bg-red-50 border-red-300'
                          : game.canImport 
                            ? 'bg-emerald-50 border-emerald-200' 
                            : 'bg-gray-50 border-gray-200 opacity-60'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedGames[game.id] || false}
                        onChange={(e) => setSelectedGames(prev => ({ ...prev, [game.id]: e.target.checked }))}
                        disabled={!game.canImport}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">
                            {game.espnAway} @ {game.espnHome}
                          </span>
                          <span className="font-bold">{game.awayScore} - {game.homeScore}</span>
                        </div>
                        {game.isDuplicate ? (
                          <p className="text-xs text-red-600 font-medium">
                            ⚠️ Duplicate detected - already in game log
                          </p>
                        ) : game.canImport ? (
                          <p className="text-xs text-emerald-600">
                            ✓ Matched: {game.matchedAway} @ {game.matchedHome}
                            {game.newTeams && game.newTeams.length > 0 && (
                              <span className="ml-2 text-purple-600 font-medium">
                                (NEW: {game.newTeams.join(', ')})
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-red-500">
                            ✗ Could not match: {!game.matchedAway && game.espnAway} {!game.matchedAway && !game.matchedHome && '&'} {!game.matchedHome && game.espnHome}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {espnGames.length === 0 && !importLoading && !importError && (
                <p className="text-gray-400 text-sm">Select a date and click "Fetch" to import scores from ESPN. Only completed games will appear.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bankroll' && (() => {
          const pendingStaked = bets.filter(b => b.result === 'pending').reduce((sum, b) => sum + b.stake, 0);
          const settledBankroll = parseFloat(bankroll) + stats.totalProfit;
          const availableBankroll = settledBankroll - pendingStaked;
          return (
          <div className={cardStyle}>
            <h2 className="text-lg font-bold mb-4">💰 Bankroll Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><label className={labelStyle}>Starting Bankroll ($)</label><input type="number" value={bankroll} onChange={(e) => setBankroll(e.target.value)} className={inputStyle} /></div>
              <div>
                <label className={labelStyle}>Settled P/L</label>
                <div className={`p-2 border rounded-lg text-center ${stats.totalProfit >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
                  <p className={`font-bold text-lg ${stats.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${settledBankroll.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">{stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(0)} from bets</p>
                </div>
              </div>
              <div>
                <label className={labelStyle}>At Risk</label>
                <div className={`p-2 border rounded-lg text-center ${pendingStaked > 0 ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                  <p className={`font-bold text-lg ${pendingStaked > 0 ? 'text-amber-600' : 'text-gray-400'}`}>${pendingStaked.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">{stats.pending} pending bet{stats.pending !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div>
                <label className={labelStyle}>Available (for Kelly)</label>
                <div className={`p-2 border rounded-lg text-center ${availableBankroll >= parseFloat(bankroll) ? 'bg-emerald-50 border-emerald-300' : 'bg-blue-50 border-blue-300'}`}>
                  <p className={`font-bold text-lg ${availableBankroll >= parseFloat(bankroll) ? 'text-emerald-600' : 'text-blue-600'}`}>${availableBankroll.toFixed(0)}</p>
                  <p className="text-xs text-gray-500">for new bets</p>
                </div>
              </div>
            </div>
            <div className="mt-4"><label className={labelStyle}>Kelly Fraction</label><select value={kellyFraction} onChange={(e) => setKellyFraction(e.target.value)} className={inputStyle}><option value="1">Full Kelly (risky)</option><option value="0.5">Half Kelly</option><option value="0.25">Quarter Kelly ✓</option><option value="0.1">Tenth Kelly (safe)</option></select></div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-emerald-50 p-3 rounded border border-emerald-200"><p className="text-xs text-gray-500">Max Bet (5%)</p><p className="font-bold text-emerald-700">${(availableBankroll*0.05).toFixed(0)}</p></div>
              <div className="bg-gray-50 p-3 rounded"><p className="text-xs text-gray-500">Standard (1%)</p><p className="font-bold">${(availableBankroll*0.01).toFixed(0)}</p></div>
              <div className="bg-gray-50 p-3 rounded"><p className="text-xs text-gray-500">Daily Limit (10%)</p><p className="font-bold">${(availableBankroll*0.1).toFixed(0)}</p></div>
              <div className="bg-gray-50 p-3 rounded"><p className="text-xs text-gray-500">Weekly (25%)</p><p className="font-bold">${(availableBankroll*0.25).toFixed(0)}</p></div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800"><strong>💾 Auto-Sync:</strong> Kelly uses your <em>available</em> bankroll (settled - pending). Limits update as bets settle.</p>
            </div>
            <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-800"><strong>📡 Live Odds:</strong> Today's Games picker fetches odds directly from ESPN — no API key required!</p>
            </div>
            
            {/* AI Insights API Settings */}
            <div className="mt-4 p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50">
              <h3 className="font-bold text-sm mb-2">🤖 AI Insights (OpenRouter)</h3>
              <p className="text-xs text-gray-600 mb-3">
                Get a free API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-medium">openrouter.ai/keys</a> — 
                Free models: OLMo 32B, Gemma 3, Qwen3, Llama 3.2, Nova Lite
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelStyle}>API Key</label>
                  <input 
                    type="password" 
                    value={openRouterApiKey} 
                    onChange={(e) => setOpenRouterApiKey(e.target.value)} 
                    placeholder="sk-or-v1-..." 
                    className={`${inputStyle} font-mono text-sm`}
                  />
                </div>
                <div>
                  <label className={labelStyle}>AI Model</label>
                  <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className={inputStyle}>
                    <optgroup label="🆓 Free Models (Best for Sports)">
                      <option value="allenai/olmo-3-32b-think:free">OLMo 3 32B Think (Best reasoning)</option>
                      <option value="google/gemma-3-12b-it:free">Gemma 3 12B (Fast + Smart)</option>
                      <option value="amazon/nova-lite-v1:free">Amazon Nova 2 Lite (1M context)</option>
                    </optgroup>
                    <optgroup label="🆓 Free Models (Smaller/Faster)">
                      <option value="qwen/qwen3-4b:free">Qwen3 4B (Dual-mode reasoning)</option>
                      <option value="meta-llama/llama-3.2-3b-instruct:free">Llama 3.2 3B (Multilingual)</option>
                      <option value="google/gemma-3-4b-it:free">Gemma 3 4B (Multimodal)</option>
                      <option value="google/gemma-3n-e4b-it:free">Gemma 3n 4B (Mobile-optimized)</option>
                      <option value="google/gemma-3n-e2b-it:free">Gemma 3n 2B (Ultra-lightweight)</option>
                    </optgroup>
                    <optgroup label="🔍 With Built-in Search (Paid)">
                      <option value="perplexity/sonar">Perplexity Sonar (Live search)</option>
                      <option value="perplexity/sonar-pro">Perplexity Sonar Pro (Better)</option>
                      <option value="perplexity/sonar-reasoning">Perplexity Reasoning (Multi-step)</option>
                    </optgroup>
                    <optgroup label="🏆 Flagship Models (Best Quality)">
                      <option value="anthropic/claude-opus-4.5">Claude Opus 4.5 (Best coding/agents)</option>
                      <option value="anthropic/claude-sonnet-4.5">Claude Sonnet 4.5 (Fast + smart)</option>
                      <option value="openai/gpt-5.1">GPT-5.1 (Adaptive reasoning)</option>
                      <option value="google/gemini-3-pro">Gemini 3 Pro (Best multimodal)</option>
                    </optgroup>
                    <optgroup label="💰 Paid Models (Good quality)">
                      <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
                      <option value="openai/gpt-4o">GPT-4o</option>
                      <option value="google/gemini-2.5-flash-preview">Gemini 2.5 Flash</option>
                    </optgroup>
                  </select>
                </div>
              </div>
              
              {/* Web Search Toggle */}
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={enableWebSearch} 
                    onChange={(e) => setEnableWebSearch(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <div>
                    <span className="font-medium text-amber-800">🔍 Enable Web Search (+$0.02/request)</span>
                    <p className="text-xs text-amber-600">Fetches real-time injury reports & news via Exa.ai</p>
                  </div>
                </label>
              </div>
              
              {openRouterApiKey && (
                <p className="text-xs text-emerald-600 mt-2">
                  ✓ API key saved • Using {aiModel.split('/').pop().split(':')[0]}
                  {enableWebSearch && ' + Web Search'}
                </p>
              )}
            </div>
          </div>
        );})()}
        
        <div className="text-center text-xs text-blue-200 py-2">Data auto-saves to browser • Ratings from Nov 28, 2025 • Bet responsibly • Made with ❤️ by Zachary Miller</div>
      </div>
    </div>
  );
};

export default SportsBettingModelPro;