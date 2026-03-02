import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getInitialTeams, getGamesPlayedFromLog } from '../utils/elo';
import { inferGameSport } from '../utils/teamMatcher';
import { loadAppState } from '../utils/storage';
import { sportConfig } from '../config';
import { inputStyle, labelStyle, cardStyle } from './styles';

const RatingsTab = () => {
  const {
    sport, teams, setTeams,
    gameLog, setGameLog,
    bets,
    privacyMode,
    teamsSportRef,
    resetSportData,
  } = useApp();

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamElo, setNewTeamElo] = useState('1500');
  const [newTeamOff, setNewTeamOff] = useState('100');
  const [newTeamDef, setNewTeamDef] = useState('100');
  const [expandedTeam, setExpandedTeam] = useState(null);

  const config = sportConfig[sport];
  const teamList = Object.keys(teams).sort((a, b) => teams[b].elo - teams[a].elo);

  const adjustRating = (name, field, delta) => setTeams(prev => ({ ...prev, [name]: { ...prev[name], [field]: prev[name][field] + delta } }));

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

  const resetToBaseline = () => {
    const isCollege = sport === 'cbb' || sport === 'cfb';
    const message = isCollege
      ? 'For college sports: This will DELETE all teams so they can be re-imported with conference-based starting Elo.\n\nAfter clicking OK, use "Import Full Season" to rebuild ratings.\n\nContinue?'
      : 'Reset ALL teams to 1500 Elo, 100 Off, 100 Def? This will wipe your custom ratings but keep your team list.';

    if (!confirm(message)) return;

    if (isCollege) {
      setTeams({});
      teamsSportRef.current = sport;
    } else {
      setTeams(prev => {
        const reset = {};
        Object.keys(prev).forEach(name => {
          reset[name] = { elo: 1500, off: 100, def: 100 };
        });
        return reset;
      });
    }
    setGameLog([]);
  };

  const resetAllData = () => {
    const sportName = sportConfig[sport]?.name || sport.toUpperCase();
    if (confirm(`Reset all ${sportName} data including bets, ratings, and game log?\n\nThis will only affect ${sportName} - other sports will be preserved.`)) {
      const existingData = loadAppState() || {};
      const teamsBySportSource = (existingData.teamsBySport && typeof existingData.teamsBySport === 'object' && !Array.isArray(existingData.teamsBySport))
        ? existingData.teamsBySport
        : {};

      const existingBets = privacyMode ? bets : (Array.isArray(existingData.bets) ? existingData.bets : []);
      const existingGameLog = privacyMode ? gameLog : (Array.isArray(existingData.gameLog) ? existingData.gameLog : []);
      const filteredBets = existingBets.filter(bet => bet.sport !== sport);
      const filteredGameLog = existingGameLog.filter(game => inferGameSport(game, teamsBySportSource) !== sport);

      resetSportData({
        teams: getInitialTeams(sport),
        bets: filteredBets,
        gameLog: filteredGameLog,
      });
    }
  };

  return (
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
            <button
              onClick={() => {
                const gamesPlayedData = teamList.map(name => {
                  const gp = getGamesPlayedFromLog(name, gameLog);
                  return `${name}: ${gp} games`;
                }).sort((a, b) => {
                  const gpA = parseInt(a.split(': ')[1]);
                  const gpB = parseInt(b.split(': ')[1]);
                  return gpB - gpA;
                }).join('\n');
                navigator.clipboard.writeText(gamesPlayedData);
                alert('Games played copied to clipboard!');
              }}
              className="text-xs text-purple-500 hover:text-purple-700"
            >
              🎮 Copy GP
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
  );
};

export default RatingsTab;
