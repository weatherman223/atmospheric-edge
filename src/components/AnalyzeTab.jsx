import { useApp } from '../context/AppContext';
import { useAnalyze } from '../hooks/useAnalyze';
import { getLocalDateString } from '../utils/date';
import { inputStyle, labelStyle, cardStyle, sliderStyle } from './styles';
import { sportConfig, espnTeamIds } from '../config';

const AnalyzeTab = () => {
  const {
    sport,
    teams,
    aiInsights, setAiInsights,
    aiInsightsLoading,
    showAiInsights, setShowAiInsights,
    openRouterApiKey,
    aiModel,
    enableWebSearch,
    fetchAiInsights,
    setActiveTab,
  } = useApp();

  const {
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
    resetContextAdjustments,
    fetchTodaysGames,
    selectGameFromPicker,
    applyAiSuggestions,
    analysis,
    teamList,
    gameLog,
  } = useAnalyze();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className={cardStyle}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">📋 Game Setup</h2>
          <button
            onClick={() => { setShowGamePicker(true); setTodaysGamesError(''); fetchTodaysGames(gamePickerDate); }}
            className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-1"
          >
            📅 Today's Games
          </button>
        </div>

        {/* Game Picker Modal */}
        {showGamePicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div
              ref={gamePickerDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="todays-games-title"
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowGamePicker(false);
                  setTodaysGamesError('');
                }
              }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            >
              <div className="p-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
                <h3 id="todays-games-title" className="font-bold text-lg">📅 {sportConfig[sport].name} Games</h3>
                <button
                  aria-label="Close game picker"
                  onClick={() => {
                    setShowGamePicker(false);
                    setTodaysGamesError('');
                  }}
                  className="text-white hover:text-gray-200 text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-3 border-b bg-gray-50 flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    const [y, m, d] = gamePickerDate.split('-').map(Number);
                    const date = new Date(y, m - 1, d - 1);
                    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    setGamePickerDate(newDate);
                    fetchTodaysGames(newDate);
                  }}
                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
                >
                  ◀
                </button>
                <input
                  type="date"
                  value={gamePickerDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setGamePickerDate(newDate);
                    fetchTodaysGames(newDate);
                  }}
                  className="px-3 py-1 border rounded text-sm"
                />
                <button
                  onClick={() => {
                    const [y, m, d] = gamePickerDate.split('-').map(Number);
                    const date = new Date(y, m - 1, d + 1);
                    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    setGamePickerDate(newDate);
                    fetchTodaysGames(newDate);
                  }}
                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
                >
                  ▶
                </button>
                <button
                  onClick={() => {
                    const today = getLocalDateString();
                    setGamePickerDate(today);
                    fetchTodaysGames(today);
                  }}
                  className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-xs font-medium"
                >
                  Today
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[55vh]">
                {todaysGamesLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-2"></div>
                    <p>Loading games...</p>
                  </div>
                ) : todaysGamesError ? (
                  <div className="text-center py-8 text-red-600">
                    <p className="font-medium">{todaysGamesError}</p>
                    <button
                      onClick={() => fetchTodaysGames(gamePickerDate)}
                      className="mt-3 px-3 py-1.5 rounded bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium"
                    >
                      Retry
                    </button>
                  </div>
                ) : todaysGames.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-4xl mb-2">🏟️</p>
                    <p>No games scheduled for {(() => { const n = new Date(); return gamePickerDate === `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })() ? 'today' : gamePickerDate}</p>
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-700">⚡ Context Adjustments (Elo ±)</p>
                {espnTeamIds[sport] && (
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useAutoInjuries}
                      onChange={(e) => {
                        setUseAutoInjuries(e.target.checked);
                        if (e.target.checked) {
                          setTeam1Injury(team1InjuryAuto);
                          setTeam2Injury(team2InjuryAuto);
                        }
                      }}
                      className="rounded w-3.5 h-3.5"
                    />
                    <span className={useAutoInjuries ? 'text-blue-600 font-medium' : 'text-gray-500'}>Auto Injuries</span>
                    {injuriesLoading && <span className="text-blue-500 animate-pulse">...</span>}
                  </label>
                )}
              </div>

              {/* Injury Report Panel */}
              {espnTeamIds[sport] && (team1Injuries.length > 0 || team2Injuries.length > 0) && (() => {
                const isOutStatus = (s) => {
                  if (!s) return false;
                  if (!isNaN(s)) return true;
                  const status = s.toLowerCase();
                  return status.includes('out') || status.includes('ir') || status.includes('injured') || status.includes('ltir');
                };
                const isDoubtfulStatus = (s) => (s || '').toLowerCase().includes('doubtful');
                const displayStatus = (s) => {
                  if (!s) return 'Unknown';
                  if (s === '12' || s === 12) return 'LTIR';
                  if (!isNaN(s)) return 'IR';
                  return s;
                };
                const getStatusClasses = (s) => {
                  if (isOutStatus(s)) return { text: 'text-red-700', bg: 'bg-red-200' };
                  if (isDoubtfulStatus(s)) return { text: 'text-orange-700', bg: 'bg-orange-200' };
                  return { text: 'text-yellow-700', bg: 'bg-yellow-200' };
                };
                return (
                <div className="mb-3 space-y-2">
                  {team1Injuries.length > 0 && (
                    <details className="bg-red-50 border border-red-200 rounded-lg text-xs">
                      <summary className="px-2 py-1.5 cursor-pointer flex items-center justify-between">
                        <span className="font-medium text-red-800">{team1.split(' ').pop()} Injuries ({team1Injuries.filter(i => isOutStatus(i.status) || isDoubtfulStatus(i.status)).length} key)</span>
                        <span className="text-red-600 font-mono">{team1InjuryAuto} Elo</span>
                      </summary>
                      <div className="px-2 pb-2 space-y-1 max-h-32 overflow-y-auto">
                        {team1Injuries.map((inj) => {
                          const colors = getStatusClasses(inj.status);
                          return (
                          <div key={`${inj.player}-${inj.position}-${inj.status}-${inj.injury}`} className={`flex justify-between items-center py-0.5 ${colors.text}`}>
                            <span>{inj.player} <span className="text-gray-500">({inj.position})</span></span>
                            <span className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${colors.bg}`}>{displayStatus(inj.status)}</span>
                            </span>
                          </div>
                        );})}
                      </div>
                    </details>
                  )}
                  {team2Injuries.length > 0 && (
                    <details className="bg-red-50 border border-red-200 rounded-lg text-xs">
                      <summary className="px-2 py-1.5 cursor-pointer flex items-center justify-between">
                        <span className="font-medium text-red-800">{team2.split(' ').pop()} Injuries ({team2Injuries.filter(i => isOutStatus(i.status) || isDoubtfulStatus(i.status)).length} key)</span>
                        <span className="text-red-600 font-mono">{team2InjuryAuto} Elo</span>
                      </summary>
                      <div className="px-2 pb-2 space-y-1 max-h-32 overflow-y-auto">
                        {team2Injuries.map((inj) => {
                          const colors = getStatusClasses(inj.status);
                          return (
                          <div key={`${inj.player}-${inj.position}-${inj.status}-${inj.injury}`} className={`flex justify-between items-center py-0.5 ${colors.text}`}>
                            <span>{inj.player} <span className="text-gray-500">({inj.position})</span></span>
                            <span className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${colors.bg}`}>{displayStatus(inj.status)}</span>
                            </span>
                          </div>
                        );})}
                      </div>
                    </details>
                  )}
                </div>
              );})()}

              {injuriesError && <p className="text-xs text-orange-600 mb-2">{injuriesError}</p>}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-medium text-gray-600 mb-1">{team1.split(' ').pop()}</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="w-14">Injury:</span>
                      <input type="range" min="-100" max="0" value={team1Injury} onChange={(e) => { setTeam1Injury(parseInt(e.target.value)); if (useAutoInjuries) setUseAutoInjuries(false); }} className={`${sliderStyle} ${useAutoInjuries ? 'opacity-50' : ''}`} />
                      <span className="w-8 text-right text-red-500">{team1Injury}</span>
                    </div>
                    <div className="flex items-center gap-1"><span className="w-14">Rest:</span><input type="range" min="-30" max="30" value={team1Rest} onChange={(e) => setTeam1Rest(parseInt(e.target.value))} className={sliderStyle} /><span className="w-8 text-right">{team1Rest > 0 ? '+' : ''}{team1Rest}</span></div>
                    <div className="flex items-center gap-1"><span className="w-14">Motiv:</span><input type="range" min="-40" max="40" value={team1Motivation} onChange={(e) => setTeam1Motivation(parseInt(e.target.value))} className={sliderStyle} /><span className="w-8 text-right">{team1Motivation > 0 ? '+' : ''}{team1Motivation}</span></div>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-gray-600 mb-1">{team2.split(' ').pop()}</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="w-14">Injury:</span>
                      <input type="range" min="-100" max="0" value={team2Injury} onChange={(e) => { setTeam2Injury(parseInt(e.target.value)); if (useAutoInjuries) setUseAutoInjuries(false); }} className={`${sliderStyle} ${useAutoInjuries ? 'opacity-50' : ''}`} />
                      <span className="w-8 text-right text-red-500">{team2Injury}</span>
                    </div>
                    <div className="flex items-center gap-1"><span className="w-14">Rest:</span><input type="range" min="-30" max="30" value={team2Rest} onChange={(e) => setTeam2Rest(parseInt(e.target.value))} className={sliderStyle} /><span className="w-8 text-right">{team2Rest > 0 ? '+' : ''}{team2Rest}</span></div>
                    <div className="flex items-center gap-1"><span className="w-14">Motiv:</span><input type="range" min="-40" max="40" value={team2Motivation} onChange={(e) => setTeam2Motivation(parseInt(e.target.value))} className={sliderStyle} /><span className="w-8 text-right">{team2Motivation > 0 ? '+' : ''}{team2Motivation}</span></div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{useAutoInjuries && espnTeamIds[sport] ? 'Auto: Injury impact from ESPN data (uncheck to override)' : 'Injury: -30 minor, -60 key player, -100 star out'}</p>
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
                <p className="text-[11px] text-gray-500">
                  {analysis.spreadAnalysis
                    ? `Probabilities from ${analysis.spreadAnalysis.source === 'simulation' ? 'simulation output' : 'analytical model'}${analysis.spreadAnalysis.pushProb ? ` • Push: ${analysis.spreadAnalysis.pushProb.toFixed(1)}%` : ''}`
                    : 'Enter spread'}
                </p>
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
                <p className="text-[11px] text-gray-500">
                  {analysis.totalsAnalysis
                    ? `Probabilities from ${analysis.totalsAnalysis.source === 'simulation' ? 'simulation output' : 'analytical model'}${analysis.totalsAnalysis.pushProb ? ` • Push: ${analysis.totalsAnalysis.pushProb.toFixed(1)}%` : ''}`
                    : 'Enter total'}
                </p>
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
  );
};

export default AnalyzeTab;
