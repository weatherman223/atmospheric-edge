import { useState } from 'react';
import { useModelAudit } from '../hooks/useModelAudit';
import { useApp } from '../context/AppContext';
import { sportConfig, espnOddsConfig } from '../config';
import { generateAuditMarkdown, downloadMarkdown } from '../utils/auditExport';

const AuditTab = () => {
  const { sport } = useApp();
  const {
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
  } = useModelAudit();

  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(true);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  // Betting audit local state
  const [betSortField, setBetSortField] = useState('date');
  const [betSortAsc, setBetSortAsc] = useState(true);
  const [betFilterType, setBetFilterType] = useState('all');
  const [betFilterTier, setBetFilterTier] = useState('all');
  const [betFilterResult, setBetFilterResult] = useState('all');
  const [showBetLog, setShowBetLog] = useState(false);

  const config = sportConfig[sport];
  const hasOdds = !!espnOddsConfig[sport];
  const isNcaa = config?.useNcaaApi;
  const isRunning = auditStatus === 'running';
  const isComplete = auditStatus === 'complete';
  const progressPct = auditProgress.total > 0
    ? Math.round((auditProgress.current / auditProgress.total) * 100)
    : 0;

  const bettingIsRunning = bettingAuditStatus === 'running';
  const bettingIsComplete = bettingAuditStatus === 'complete';
  const bettingProgressPct = bettingAuditProgress.total > 0
    ? Math.round((bettingAuditProgress.current / bettingAuditProgress.total) * 100)
    : 0;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'date');
    }
  };

  const handleBetSort = (field) => {
    if (betSortField === field) {
      setBetSortAsc(!betSortAsc);
    } else {
      setBetSortField(field);
      setBetSortAsc(field === 'date');
    }
  };

  const sortedGameLog = auditResults?.gameLog
    ? [...auditResults.gameLog].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case 'date': cmp = a.date.localeCompare(b.date); break;
          case 'spreadError': cmp = a.spreadError - b.spreadError; break;
          case 'totalError': cmp = a.totalError - b.totalError; break;
          case 'home': cmp = a.home.localeCompare(b.home); break;
          default: cmp = 0;
        }
        return sortAsc ? cmp : -cmp;
      })
    : [];

  // Filter and sort betting recommendations
  const filteredBetRecs = bettingAuditResults?.recommendations
    ? bettingAuditResults.recommendations.filter(r => {
        if (betFilterType !== 'all' && r.betType !== betFilterType) return false;
        if (betFilterTier !== 'all') {
          const stars = (r.confidence.stars.match(/\u2605/g) || []).length;
          if (stars !== parseInt(betFilterTier)) return false;
        }
        if (betFilterResult === 'won' && !r.won) return false;
        if (betFilterResult === 'lost' && (r.won || r.push)) return false;
        if (betFilterResult === 'push' && !r.push) return false;
        return true;
      })
    : [];

  const sortedBetRecs = [...filteredBetRecs].sort((a, b) => {
    let cmp = 0;
    switch (betSortField) {
      case 'date': cmp = a.date.localeCompare(b.date); break;
      case 'ev': cmp = a.ev - b.ev; break;
      case 'payout': cmp = a.payout - b.payout; break;
      case 'odds': cmp = a.odds - b.odds; break;
      default: cmp = 0;
    }
    return betSortAsc ? cmp : -cmp;
  });

  const handleApply = () => {
    applyFinalRatings();
    setShowApplyConfirm(false);
  };

  const handleDownloadAudit = () => {
    const md = generateAuditMarkdown(
      isComplete ? auditResults : null,
      bettingIsComplete ? bettingAuditResults : null
    );
    const sportName = (config?.name || sport).replace(/\s+/g, '-').toLowerCase();
    downloadMarkdown(md, `audit-${sportName}-${new Date().toISOString().slice(0, 10)}.md`);
  };

  const canDownload = isComplete || bettingIsComplete;

  return (
    <div className="space-y-4">
      {/* Model Audit Controls */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Model Audit</h2>
            <p className="text-sm text-blue-200">
              Backtest your Elo model against the full {config?.name} season
            </p>
          </div>
          <div className="flex gap-2">
            {canDownload && (
              <button
                onClick={handleDownloadAudit}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all text-sm"
              >
                Download Audit
              </button>
            )}
            {!isRunning && (
              <button
                onClick={runAudit}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-all text-sm"
              >
                Run Audit
              </button>
            )}
            {isRunning && (
              <button
                onClick={cancelAudit}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-blue-200 mb-1">
              <span>{auditProgress.message}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {auditError && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {auditError}
          </div>
        )}
      </div>

      {/* Model Audit Results */}
      {isComplete && auditResults && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              label="Win Accuracy"
              value={`${auditResults.winRecord.correct}-${auditResults.winRecord.total - auditResults.winRecord.correct}`}
              sub={`${auditResults.winRecord.pct.toFixed(1)}%`}
              color="emerald"
            />
            <StatCard
              label="Spread MAE"
              value={auditResults.spreadMAE.toFixed(1)}
              sub="pts avg error"
              color="blue"
            />
            <StatCard
              label="Total MAE"
              value={auditResults.totalMAE.toFixed(1)}
              sub="pts avg error"
              color="purple"
            />
          </div>

          <div className="text-center text-xs text-blue-300">
            {auditResults.gamesProcessed} games processed
          </div>

          {/* Game Log Table */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
            <div className="p-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Game Log</h3>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-blue-200 bg-white/5 sticky top-0">
                  <tr>
                    <SortHeader field="date" current={sortField} asc={sortAsc} onClick={handleSort}>Date</SortHeader>
                    <SortHeader field="home" current={sortField} asc={sortAsc} onClick={handleSort}>Matchup</SortHeader>
                    <th className="px-2 py-2">Pred Winner</th>
                    <th className="px-2 py-2">Result</th>
                    <th className="px-2 py-2">Pred Spread</th>
                    <th className="px-2 py-2">Actual Margin</th>
                    <SortHeader field="spreadError" current={sortField} asc={sortAsc} onClick={handleSort}>Spread Err</SortHeader>
                    <th className="px-2 py-2">Pred Total</th>
                    <th className="px-2 py-2">Actual Total</th>
                    <SortHeader field="totalError" current={sortField} asc={sortAsc} onClick={handleSort}>Total Err</SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {sortedGameLog.map((g, i) => (
                    <tr
                      key={i}
                      className={`border-t border-white/5 ${
                        g.isTie ? 'bg-yellow-500/5' : g.winCorrect ? 'bg-emerald-500/10' : 'bg-red-500/10'
                      }`}
                    >
                      <td className="px-2 py-1.5 text-blue-100 whitespace-nowrap">{g.date}</td>
                      <td className="px-2 py-1.5 text-white whitespace-nowrap">
                        {g.away} @ {g.home}
                      </td>
                      <td className="px-2 py-1.5 text-blue-100 capitalize">{g.predictedWinner}</td>
                      <td className="px-2 py-1.5 text-white font-medium">
                        {g.actualAwayScore}-{g.actualHomeScore}
                        {g.isTie ? (
                          <span className="ml-1 text-yellow-400">T</span>
                        ) : g.winCorrect ? (
                          <span className="ml-1 text-emerald-400">&#10003;</span>
                        ) : (
                          <span className="ml-1 text-red-400">&#10007;</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-blue-100">{g.predictedSpread > 0 ? '+' : ''}{g.predictedSpread.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-blue-100">{g.actualMargin > 0 ? '+' : ''}{g.actualMargin}</td>
                      <td className={`px-2 py-1.5 font-medium ${g.spreadError > 15 ? 'text-red-300' : g.spreadError < 5 ? 'text-emerald-300' : 'text-blue-100'}`}>
                        {g.spreadError.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-blue-100">{g.predictedTotal.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-blue-100">{g.actualTotal}</td>
                      <td className={`px-2 py-1.5 font-medium ${g.totalError > 20 ? 'text-red-300' : g.totalError < 8 ? 'text-emerald-300' : 'text-blue-100'}`}>
                        {g.totalError.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Apply Final Ratings */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            {!showApplyConfirm ? (
              <button
                onClick={() => setShowApplyConfirm(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-all text-sm"
              >
                Apply Final Ratings
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-amber-200 text-sm">
                  This will replace your current {config?.name} ratings with the audit&apos;s end-of-season ratings. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleApply}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all text-sm"
                  >
                    Confirm Replace
                  </button>
                  <button
                    onClick={() => setShowApplyConfirm(false)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state for model audit */}
      {auditStatus === 'idle' && (
        <div className="text-center py-12 text-blue-200/60">
          <p className="text-lg mb-1">No audit results yet</p>
          <p className="text-sm">Click &quot;Run Audit&quot; to backtest your model against the full season</p>
        </div>
      )}

      {/* ============================================ */}
      {/* Betting Audit Section                        */}
      {/* ============================================ */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Betting Audit</h2>
            <p className="text-sm text-blue-200">
              {hasOdds && !isNcaa
                ? `Backtest betting recommendations against closing odds for ${config?.name}`
                : 'Not available for this sport (no ESPN odds data)'}
            </p>
            {hasOdds && !isNcaa && (
              <p className="text-xs text-blue-300/60 mt-1">
                Fetches closing odds from ESPN — takes ~1 min for a full season
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {bettingIsComplete && (
              <button
                onClick={handleDownloadAudit}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all text-sm"
              >
                Download Audit
              </button>
            )}
            {!bettingIsRunning && (
              <button
                onClick={runBettingAudit}
                disabled={!hasOdds || isNcaa}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  hasOdds && !isNcaa
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                }`}
              >
                Run Betting Audit
              </button>
            )}
            {bettingIsRunning && (
              <button
                onClick={cancelBettingAudit}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Three-phase progress */}
        {bettingIsRunning && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-blue-200 mb-1">
              <span>{bettingAuditProgress.message}</span>
              <span>{bettingProgressPct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5">
              <div
                className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${bettingProgressPct}%` }}
              />
            </div>
            <div className="flex gap-2 mt-2">
              {['fetching_games', 'fetching_odds', 'processing'].map((phase, idx) => {
                const phaseOrder = { fetching_games: 0, fetching_odds: 1, processing: 2, complete: 3 };
                const currentOrder = phaseOrder[bettingAuditProgress.phase] ?? -1;
                const isActive = bettingAuditProgress.phase === phase;
                const isDone = currentOrder > idx;
                return (
                  <span
                    key={phase}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-amber-500/30 text-amber-200'
                        : isDone
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/5 text-blue-300/40'
                    }`}
                  >
                    {phase === 'fetching_games' ? 'Games' : phase === 'fetching_odds' ? 'Odds' : 'Processing'}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {bettingAuditError && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {bettingAuditError}
          </div>
        )}
      </div>

      {/* Betting Audit Results */}
      {bettingIsComplete && bettingAuditResults && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Record"
              value={`${bettingAuditResults.record.wins}-${bettingAuditResults.record.losses}-${bettingAuditResults.record.pushes}`}
              sub={`${bettingAuditResults.totalRecommendations} recs`}
              color="emerald"
            />
            <StatCard
              label="ROI"
              value={`${bettingAuditResults.roi >= 0 ? '+' : ''}${bettingAuditResults.roi.toFixed(2)}%`}
              sub={`on $${bettingAuditResults.totalWagered.toLocaleString()}`}
              color={bettingAuditResults.roi >= 0 ? 'emerald' : 'red'}
            />
            <StatCard
              label="Profit"
              value={`${bettingAuditResults.totalProfit >= 0 ? '+' : ''}$${Math.round(bettingAuditResults.totalProfit).toLocaleString()}`}
              sub="on $100 units"
              color={bettingAuditResults.totalProfit >= 0 ? 'emerald' : 'red'}
            />
            <StatCard
              label="Games w/ Odds"
              value={`${bettingAuditResults.gamesWithOdds}`}
              sub={`of ${bettingAuditResults.gamesWithOdds + bettingAuditResults.gamesWithoutOdds}`}
              color="blue"
            />
          </div>

          {/* Tier Breakdown */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
            <div className="p-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Tier Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-blue-200 bg-white/5">
                  <tr>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2">Recs</th>
                    <th className="px-3 py-2">Record</th>
                    <th className="px-3 py-2">Win%</th>
                    <th className="px-3 py-2">Wagered</th>
                    <th className="px-3 py-2">Profit</th>
                    <th className="px-3 py-2">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const tier = bettingAuditResults.byTier[stars];
                    if (!tier || tier.count === 0) return null;
                    const winPct = tier.count > 0 ? ((tier.wins / (tier.wins + tier.losses)) * 100) : 0;
                    return (
                      <tr
                        key={stars}
                        className={`border-t border-white/5 ${tier.roi > 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}
                      >
                        <td className="px-3 py-2 text-yellow-400 whitespace-nowrap">
                          {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
                        </td>
                        <td className="px-3 py-2 text-white">{tier.count}</td>
                        <td className="px-3 py-2 text-white">{tier.wins}-{tier.losses}-{tier.pushes}</td>
                        <td className="px-3 py-2 text-blue-100">{winPct.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-blue-100">${tier.wagered.toLocaleString()}</td>
                        <td className={`px-3 py-2 font-medium ${tier.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tier.profit >= 0 ? '+' : ''}${Math.round(tier.profit).toLocaleString()}
                        </td>
                        <td className={`px-3 py-2 font-medium ${tier.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tier.roi >= 0 ? '+' : ''}{tier.roi.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bet Type Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['ml', 'spread', 'total'].map((type) => {
              const bt = bettingAuditResults.byType[type];
              if (!bt || bt.count === 0) return null;
              const winPct = bt.count > 0 ? ((bt.wins / (bt.wins + bt.losses)) * 100) : 0;
              return (
                <div key={type} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <p className="text-xs text-blue-200 mb-1 uppercase font-semibold">{type === 'ml' ? 'Moneyline' : type === 'spread' ? 'Spread' : 'Total'}</p>
                  <p className="text-lg font-bold text-white">{bt.wins}-{bt.losses}-{bt.pushes}</p>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-blue-300">Win: {winPct.toFixed(1)}%</span>
                    <span className={`text-xs font-medium ${bt.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ROI: {bt.roi >= 0 ? '+' : ''}{bt.roi.toFixed(1)}%
                    </span>
                  </div>
                  <p className={`text-sm font-medium mt-1 ${bt.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {bt.profit >= 0 ? '+' : ''}${Math.round(bt.profit).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* CLV Stats */}
          {bettingAuditResults.clvStats && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
              <div className="p-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white">Closing Line Value (CLV)</h3>
                <p className="text-xs text-blue-300/60">Positive CLV = model found real edges vs the market</p>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-blue-200">Avg CLV</p>
                    <p className={`text-lg font-bold ${bettingAuditResults.clvStats.avgCLV >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bettingAuditResults.clvStats.avgCLV >= 0 ? '+' : ''}{bettingAuditResults.clvStats.avgCLV.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-200">CLV+ Rate</p>
                    <p className={`text-lg font-bold ${bettingAuditResults.clvStats.clvPositiveRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bettingAuditResults.clvStats.clvPositiveRate.toFixed(1)}%
                    </p>
                  </div>
                  {['ml', 'spread', 'total'].map((type) => {
                    const ct = bettingAuditResults.clvStats.clvByType[type];
                    if (!ct || ct.count === 0) return null;
                    return (
                      <div key={type}>
                        <p className="text-xs text-blue-200 uppercase">{type} CLV</p>
                        <p className={`text-sm font-bold ${ct.avgCLV >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {ct.avgCLV >= 0 ? '+' : ''}{ct.avgCLV.toFixed(2)}%
                        </p>
                        <p className="text-xs text-blue-300/60">{ct.clvPositiveRate.toFixed(0)}% positive ({ct.count})</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Calibration Results (NBA only) */}
          {bettingAuditResults.calibrationResults && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
              <div className="p-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white">Calibration Parameters (Walk-Forward)</h3>
                <p className="text-xs text-blue-300/60">Learned from first 60% of games, saved to localStorage for live analysis</p>
              </div>
              <div className="p-3 grid grid-cols-3 gap-3 text-xs">
                {['ml', 'spread', 'total'].map((type) => {
                  const p = bettingAuditResults.calibrationResults.params[type];
                  const n = bettingAuditResults.calibrationResults.sampleSizes[type];
                  const isIdentity = p.a === 1 && p.b === 0;
                  return (
                    <div key={type} className="bg-white/5 rounded-lg p-2">
                      <p className="text-blue-200 uppercase font-semibold mb-1">{type}</p>
                      <p className="text-white">a = {p.a.toFixed(4)}</p>
                      <p className="text-white">b = {p.b.toFixed(4)}</p>
                      <p className="text-blue-300/60 mt-1">{n} games</p>
                      {isIdentity && <p className="text-amber-400 mt-1">Identity (not enough data)</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendation Log (expandable) */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
            <button
              onClick={() => setShowBetLog(!showBetLog)}
              className="w-full p-3 border-b border-white/10 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <h3 className="text-sm font-bold text-white">
                Recommendation Log ({bettingAuditResults.totalRecommendations})
              </h3>
              <span className="text-blue-300 text-sm">{showBetLog ? '\u25B2' : '\u25BC'}</span>
            </button>

            {showBetLog && (
              <>
                {/* Filters */}
                <div className="p-3 border-b border-white/10 flex flex-wrap gap-2">
                  <select
                    value={betFilterType}
                    onChange={(e) => setBetFilterType(e.target.value)}
                    className="bg-white/10 text-white text-xs rounded-lg px-2 py-1 border border-white/20"
                  >
                    <option value="all">All Types</option>
                    <option value="ml">Moneyline</option>
                    <option value="spread">Spread</option>
                    <option value="total">Total</option>
                  </select>
                  <select
                    value={betFilterTier}
                    onChange={(e) => setBetFilterTier(e.target.value)}
                    className="bg-white/10 text-white text-xs rounded-lg px-2 py-1 border border-white/20"
                  >
                    <option value="all">All Tiers</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                  </select>
                  <select
                    value={betFilterResult}
                    onChange={(e) => setBetFilterResult(e.target.value)}
                    className="bg-white/10 text-white text-xs rounded-lg px-2 py-1 border border-white/20"
                  >
                    <option value="all">All Results</option>
                    <option value="won">Wins</option>
                    <option value="lost">Losses</option>
                    <option value="push">Pushes</option>
                  </select>
                  <span className="text-xs text-blue-300/60 self-center ml-2">
                    {filteredBetRecs.length} recs shown
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-blue-200 bg-white/5 sticky top-0">
                      <tr>
                        <BetSortHeader field="date" current={betSortField} asc={betSortAsc} onClick={handleBetSort}>Date</BetSortHeader>
                        <th className="px-2 py-2">Matchup</th>
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Side</th>
                        <th className="px-2 py-2">Stars</th>
                        <BetSortHeader field="ev" current={betSortField} asc={betSortAsc} onClick={handleBetSort}>EV%</BetSortHeader>
                        <BetSortHeader field="odds" current={betSortField} asc={betSortAsc} onClick={handleBetSort}>Odds</BetSortHeader>
                        <th className="px-2 py-2">Line</th>
                        <th className="px-2 py-2">Result</th>
                        <BetSortHeader field="payout" current={betSortField} asc={betSortAsc} onClick={handleBetSort}>Payout</BetSortHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedBetRecs.map((r, i) => (
                        <tr
                          key={i}
                          className={`border-t border-white/5 ${
                            r.push ? 'bg-yellow-500/5' : r.won ? 'bg-emerald-500/10' : 'bg-red-500/10'
                          }`}
                        >
                          <td className="px-2 py-1.5 text-blue-100 whitespace-nowrap">{r.date}</td>
                          <td className="px-2 py-1.5 text-white whitespace-nowrap">{r.away} @ {r.home}</td>
                          <td className="px-2 py-1.5 text-blue-100 uppercase">{r.betType}</td>
                          <td className="px-2 py-1.5 text-blue-100 capitalize">{r.side}</td>
                          <td className="px-2 py-1.5 text-yellow-400">{r.confidence.stars}</td>
                          <td className="px-2 py-1.5 text-blue-100">{r.ev.toFixed(1)}%</td>
                          <td className="px-2 py-1.5 text-white">{r.odds > 0 ? '+' : ''}{r.odds}</td>
                          <td className="px-2 py-1.5 text-blue-100">
                            {r.line != null ? (r.line > 0 ? '+' : '') + r.line : '-'}
                          </td>
                          <td className="px-2 py-1.5 font-medium">
                            {r.push ? (
                              <span className="text-yellow-400">Push</span>
                            ) : r.won ? (
                              <span className="text-emerald-400">W</span>
                            ) : (
                              <span className="text-red-400">L</span>
                            )}
                          </td>
                          <td className={`px-2 py-1.5 font-medium ${r.payout > 0 ? 'text-emerald-400' : r.payout < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                            {r.payout >= 0 ? '+' : ''}${Math.round(r.payout)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// --- Sub-components ---

const StatCard = ({ label, value, sub, color }) => {
  const colors = {
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color] || colors.blue} backdrop-blur-sm rounded-xl p-4 border`}>
      <p className="text-xs text-blue-200 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-blue-300">{sub}</p>
    </div>
  );
};

const SortHeader = ({ field, current, asc, onClick, children }) => (
  <th
    className="px-2 py-2 cursor-pointer hover:text-white select-none"
    onClick={() => onClick(field)}
  >
    {children}
    {current === field && (
      <span className="ml-0.5">{asc ? '\u25B2' : '\u25BC'}</span>
    )}
  </th>
);

const BetSortHeader = ({ field, current, asc, onClick, children }) => (
  <th
    className="px-2 py-2 cursor-pointer hover:text-white select-none"
    onClick={() => onClick(field)}
  >
    {children}
    {current === field && (
      <span className="ml-0.5">{asc ? '\u25B2' : '\u25BC'}</span>
    )}
  </th>
);

export default AuditTab;
