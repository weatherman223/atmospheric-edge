import { sportConfig } from '../config';

/**
 * Generates a Markdown report from model audit and/or betting audit results.
 * Designed to be pasted into an AI chat for analysis.
 */
export function generateAuditMarkdown(auditResults, bettingAuditResults) {
  const sport = auditResults?.sport || bettingAuditResults?.sport || 'unknown';
  const sportName = sportConfig[sport]?.name || sport.toUpperCase();
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const lines = [];

  lines.push(`# Atmospheric Edge — Audit Report: ${sportName}`);
  lines.push(`**Generated:** ${now}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Model Audit ──────────────────────────────────────────────────────────
  if (auditResults) {
    lines.push('## Model Audit');
    lines.push('');
    lines.push('### Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Games Processed | ${auditResults.gamesProcessed} |`);
    lines.push(`| Win Accuracy | ${auditResults.winRecord.correct}/${auditResults.winRecord.total} (${auditResults.winRecord.pct.toFixed(1)}%) |`);
    lines.push(`| Spread MAE | ${auditResults.spreadMAE.toFixed(2)} pts |`);
    lines.push(`| Total MAE | ${auditResults.totalMAE.toFixed(2)} pts |`);
    lines.push('');

    if (auditResults.gameLog?.length > 0) {
      lines.push('### Game Log');
      lines.push('');
      lines.push('| Date | Matchup | Pred Winner | Win Prob | Result | Pred Spread | Actual Margin | Spread Err | Pred Total | Actual Total | Total Err |');
      lines.push('|------|---------|-------------|----------|--------|-------------|---------------|------------|------------|--------------|-----------|');

      for (const g of auditResults.gameLog) {
        const matchup = `${g.away} @ ${g.home}`;
        const result = g.isTie
          ? `${g.actualAwayScore}-${g.actualHomeScore} T`
          : `${g.actualAwayScore}-${g.actualHomeScore} ${g.winCorrect ? '✓' : '✗'}`;
        const predSpread = (g.predictedSpread > 0 ? '+' : '') + g.predictedSpread.toFixed(1);
        const actualMargin = (g.actualMargin > 0 ? '+' : '') + g.actualMargin;
        const winProb = g.homeWinProb != null ? `${(g.homeWinProb * 100).toFixed(0)}%` : '-';

        lines.push(
          `| ${g.date} | ${matchup} | ${g.predictedWinner} | ${winProb} | ${result} | ${predSpread} | ${actualMargin} | ${g.spreadError.toFixed(1)} | ${g.predictedTotal.toFixed(1)} | ${g.actualTotal} | ${g.totalError.toFixed(1)} |`
        );
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // ── Betting Audit ─────────────────────────────────────────────────────────
  if (bettingAuditResults) {
    lines.push('## Betting Audit');
    lines.push('');
    lines.push('### Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Games with Odds | ${bettingAuditResults.gamesWithOdds} |`);
    lines.push(`| Games without Odds | ${bettingAuditResults.gamesWithoutOdds} |`);
    lines.push(`| Total Recommendations | ${bettingAuditResults.totalRecommendations} |`);
    lines.push(`| Record | ${bettingAuditResults.record.wins}-${bettingAuditResults.record.losses}-${bettingAuditResults.record.pushes} |`);
    lines.push(`| Total Wagered | $${bettingAuditResults.totalWagered.toLocaleString()} |`);
    lines.push(`| Total Profit | ${bettingAuditResults.totalProfit >= 0 ? '+' : ''}$${Math.round(bettingAuditResults.totalProfit).toLocaleString()} |`);
    lines.push(`| ROI | ${bettingAuditResults.roi >= 0 ? '+' : ''}${bettingAuditResults.roi.toFixed(2)}% |`);
    lines.push('');

    // Tier breakdown
    const tierRows = [5, 4, 3, 2, 1]
      .map(stars => ({ stars, tier: bettingAuditResults.byTier[stars] }))
      .filter(({ tier }) => tier && tier.count > 0);

    if (tierRows.length > 0) {
      lines.push('### Tier Breakdown');
      lines.push('');
      lines.push('| Tier | Recs | Record | Win% | Wagered | Profit | ROI |');
      lines.push('|------|------|--------|------|---------|--------|-----|');

      for (const { stars, tier } of tierRows) {
        const winPct = (tier.wins + tier.losses) > 0
          ? ((tier.wins / (tier.wins + tier.losses)) * 100).toFixed(1)
          : '0.0';
        const profit = `${tier.profit >= 0 ? '+' : ''}$${Math.round(tier.profit).toLocaleString()}`;
        const roi = `${tier.roi >= 0 ? '+' : ''}${tier.roi.toFixed(1)}%`;
        lines.push(`| ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} | ${tier.count} | ${tier.wins}-${tier.losses}-${tier.pushes} | ${winPct}% | $${tier.wagered.toLocaleString()} | ${profit} | ${roi} |`);
      }
      lines.push('');
    }

    // Bet type breakdown
    const typeLabels = { ml: 'Moneyline', spread: 'Spread', total: 'Total' };
    const typeRows = ['ml', 'spread', 'total']
      .map(t => ({ key: t, bt: bettingAuditResults.byType[t] }))
      .filter(({ bt }) => bt && bt.count > 0);

    if (typeRows.length > 0) {
      lines.push('### Bet Type Breakdown');
      lines.push('');
      lines.push('| Type | Recs | Record | Win% | Wagered | Profit | ROI |');
      lines.push('|------|------|--------|------|---------|--------|-----|');

      for (const { key, bt } of typeRows) {
        const winPct = (bt.wins + bt.losses) > 0
          ? ((bt.wins / (bt.wins + bt.losses)) * 100).toFixed(1)
          : '0.0';
        const profit = `${bt.profit >= 0 ? '+' : ''}$${Math.round(bt.profit).toLocaleString()}`;
        const roi = `${bt.roi >= 0 ? '+' : ''}${bt.roi.toFixed(1)}%`;
        lines.push(`| ${typeLabels[key]} | ${bt.count} | ${bt.wins}-${bt.losses}-${bt.pushes} | ${winPct}% | $${bt.wagered.toLocaleString()} | ${profit} | ${roi} |`);
      }
      lines.push('');
    }

    // CLV stats
    if (bettingAuditResults.clvStats) {
      const clv = bettingAuditResults.clvStats;
      lines.push('### Closing Line Value (CLV)');
      lines.push('');
      lines.push('Positive CLV = model found real edges vs the market.');
      lines.push('');
      lines.push(`| Metric | Value |`);
      lines.push(`|--------|-------|`);
      lines.push(`| Avg CLV | ${clv.avgCLV >= 0 ? '+' : ''}${clv.avgCLV.toFixed(2)}% |`);
      lines.push(`| CLV+ Rate | ${clv.clvPositiveRate.toFixed(1)}% |`);

      for (const [type, ct] of Object.entries(clv.clvByType)) {
        if (ct.count > 0) {
          lines.push(`| ${type.toUpperCase()} Avg CLV | ${ct.avgCLV >= 0 ? '+' : ''}${ct.avgCLV.toFixed(2)}% (${ct.clvPositiveRate.toFixed(0)}% positive, ${ct.count} recs) |`);
        }
      }
      lines.push('');
    }

    // Calibration results
    if (bettingAuditResults.calibrationResults) {
      const cal = bettingAuditResults.calibrationResults;
      lines.push('### Calibration Parameters (Walk-Forward)');
      lines.push('');
      lines.push('Learned from first 60% of games, saved to localStorage for live analysis.');
      lines.push('');
      lines.push('| Type | a | b | Games |');
      lines.push('|------|---|---|-------|');

      for (const type of ['ml', 'spread', 'total']) {
        const p = cal.params[type];
        const n = cal.sampleSizes[type];
        const identity = p.a === 1 && p.b === 0 ? ' (identity)' : '';
        lines.push(`| ${type.toUpperCase()} | ${p.a.toFixed(4)} | ${p.b.toFixed(4)} | ${n}${identity} |`);
      }
      lines.push('');
    }

    // Recommendation log
    if (bettingAuditResults.recommendations?.length > 0) {
      lines.push('### Recommendation Log');
      lines.push('');
      lines.push('| Date | Matchup | Type | Side | Stars | EV% | Odds | Line | Result | Payout |');
      lines.push('|------|---------|------|------|-------|-----|------|------|--------|--------|');

      for (const r of bettingAuditResults.recommendations) {
        const matchup = `${r.away} @ ${r.home}`;
        const typeLabel = r.betType === 'ml' ? 'ML' : r.betType === 'spread' ? 'Spread' : 'Total';
        const stars = r.confidence?.stars || '';
        const odds = (r.odds > 0 ? '+' : '') + r.odds;
        const line = r.line != null ? ((r.line > 0 ? '+' : '') + r.line) : '-';
        const resultStr = r.push ? 'Push' : r.won ? 'W' : 'L';
        const payout = `${r.payout >= 0 ? '+' : ''}$${Math.round(r.payout)}`;

        lines.push(
          `| ${r.date} | ${matchup} | ${typeLabel} | ${r.side} | ${stars} | ${r.ev.toFixed(1)}% | ${odds} | ${line} | ${resultStr} | ${payout} |`
        );
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Triggers a browser download of the given text content as a .md file.
 */
export function downloadMarkdown(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
