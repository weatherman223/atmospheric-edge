import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { normalizeGameDate } from '../utils/teamMatcher';
import { sportConfig } from '../config';
import { inputStyle, labelStyle, cardStyle } from './styles';

const ResultsTab = () => {
  const {
    sport, teams, gameLog,
    updateRatings, deleteGameFromLog,
    fetchESPNScores, importSelectedGames, importFullSeason,
    toggleSelectAll, selectAllIncludingDuplicates,
    importDate, setImportDate,
    espnGames, selectedGames, setSelectedGames,
    importLoading, importError, seasonImportProgress,
  } = useApp();

  const [resultTeam1, setResultTeam1] = useState('');
  const [resultTeam2, setResultTeam2] = useState('');
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isOT, setIsOT] = useState(false);
  const [gameLogDisplayCount, setGameLogDisplayCount] = useState(200);

  const config = sportConfig[sport];
  const teamList = Object.keys(teams).sort((a, b) => teams[b].elo - teams[a].elo);
  const reversedGameLog = useMemo(() => [...gameLog].reverse(), [gameLog]);
  const visibleGameLog = useMemo(
    () => reversedGameLog.slice(0, gameLogDisplayCount),
    [reversedGameLog, gameLogDisplayCount]
  );
  const hasMoreGameLog = reversedGameLog.length > gameLogDisplayCount;

  const handleUpdateRatings = () => {
    if (!resultTeam1 || !resultTeam2 || score1 === '' || score2 === '') return;
    updateRatings(resultTeam1, resultTeam2, score1, score2, isOT);
    setResultTeam1(''); setResultTeam2(''); setScore1(''); setScore2(''); setIsOT(false);
  };

  return (
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
        <button onClick={handleUpdateRatings} disabled={!resultTeam1 || !resultTeam2 || score1 === '' || score2 === ''} className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50">Update Ratings</button>
      </div>
        <div className={cardStyle}>
          <h2 className="text-lg font-bold mb-3">📜 Game Log</h2>
          {gameLog.length > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>
                Showing {Math.min(gameLogDisplayCount, gameLog.length)} of {gameLog.length} games
              </span>
              {hasMoreGameLog && (
                <button
                  onClick={() => setGameLogDisplayCount((prev) => Math.min(prev + 200, gameLog.length))}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Load older entries
                </button>
              )}
            </div>
          )}
          {gameLog.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {visibleGameLog.map((g, i) => {
                const actualIndex = gameLog.length - 1 - i;
                const gameKey = g.eventId
                  ? `event-${g.eventId}`
                  : `game-${g.sport || 'unknown'}-${normalizeGameDate(g.date)}-${g.team1}-${g.team2}-${g.score}`;
                return (
                  <div key={gameKey} className="p-3 bg-gray-50 rounded text-xs">
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
                );
              })}
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
  );
};

export default ResultsTab;
