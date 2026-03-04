# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Production build to dist/
npm run lint         # ESLint (uses flat config, eslint.config.js)
npm run test         # Vitest watch mode
npm run test:run     # Vitest single run (CI)
npx eslint src/      # Lint only src/ (avoids dist/ artifacts)
```

To run a single test file: `npx vitest run src/utils/calculations.test.js`

## Architecture

**Atmospheric Edge** is a client-side-only React app (no backend, no auth). All state persists in `localStorage` under the key `sportsBettingModel` via `src/utils/storage.js`.

### State Management

`AppContext` (`src/context/AppContext.jsx`) is the single source of truth. It owns:
- `sport` — active sport key (nfl/nba/nhl/cfb/cbb/d3mb/d3wb)
- `teams` — Elo ratings for the current sport only (the full per-sport map lives in `localStorage.teamsBySport`)
- `gameLog` — history of imported/entered results used for Elo updates
- `bets`, `bankroll`, `kellyFraction` — bet tracker state

Three custom hooks compose into `AppContext` via spread: `useBets`, `useAiInsights`, `useEspnImport`. Tab-level hooks (`useAnalyze`, `useInjuries`, `useModelAudit`) consume `useApp()` and are instantiated inside their respective tab components.

**Sport-switching race condition**: When `sport` changes, `teamsSportRef` tracks which sport the current `teams` state belongs to. The persistence effect checks `teamsSportRef.current !== sport` before writing, preventing cross-sport data corruption.

### Core Data Flow

1. **Prediction pipeline**: `src/utils/elo.js` `getInitialTeams()` → Elo stored in context → `useAnalyze` calls `eloToWinProb()` + `spreadCoverProb()` + `totalProb()` from `src/utils/calculations.js` → `calculateEV()` → `getConfidenceTier()` for star rating
2. **Elo updates**: `applyGameResult()` in `src/utils/elo.js` uses dynamic K-factor (`getDynamicK`) and confidence-weighted off/def scaling (`getConfidenceScale`). NBA/CBB off/def ratings regress toward 100 each game (`regressRating`).
3. **ESPN import**: `useEspnImport` fetches completed games from ESPN scoreboards and optionally odds from `sports.core.api.espn.com`. Team names from ESPN are fuzzy-matched to local names via `src/utils/teamMatcher.js`.
4. **Monte Carlo**: `src/utils/simulations.js` runs paired normal-distribution score simulations used in the Analyze tab when simulation mode is enabled.

### Config Files

- `src/config/sportConfig.js` — per-sport Elo parameters (`kFactor`, `homeAdvantage`, `scoringVar`, `spreadMultiplier`, `marginMult`, optional `marginCap`)
- `src/config/initialTeams.js` — default Elo/off/def ratings per sport, loaded on first visit or reset
- `src/config/espnConfig.js` — ESPN API endpoints, season start dates, team ID maps for injury API, odds config
- `src/config/conferenceTiers.js` — starting Elo by conference for auto-added CFB/CBB teams
- `src/config/injuryConfig.js` — injury impact weights by position and status

### Key sportConfig Parameters

| Field | Purpose |
|-------|---------|
| `homeAdvantage` | Elo points added to home team |
| `kFactor` | Base Elo update magnitude |
| `scoringVar` | Scoring variance for spread/total probability (normal CDF) |
| `spreadMultiplier` | Converts Elo diff to predicted point spread |
| `marginMult` | Scales margin-of-victory impact on Elo (NHL uses 4.5×) |
| `marginCap` | Caps margin for Elo purposes (CFB=21, CBB=15) |
| `ratingImpact` | Scales off/def rating contribution to spread prediction |

### External APIs (no auth except OpenRouter)

- **ESPN scoreboard**: `site.api.espn.com/apis/site/v2/sports/...` — game results, no key needed
- **ESPN odds**: `sports.core.api.espn.com/v2/sports/.../odds` — closing lines for betting audit
- **ESPN injuries**: `sports.core.api.espn.com/v2/sports/.../teams/{teamId}/injuries`
- **NCAA D3**: `ncaa-api.henrygd.me` — proxied via `/ncaa-api` in dev (see `vite.config.js`)
- **OpenRouter**: `openrouter.ai/api/v1/chat/completions` — AI insights, key stored in `localStorage('openRouterApiKey')`

### Testing

Tests use Vitest + jsdom + React Testing Library. Test files live next to source: `calculations.test.js`, `simulations.test.js`, `App.integration.test.jsx`. Setup file at `src/test/setup.js`.

### Linting

ESLint 9 flat config. Allows unused vars matching `^[A-Z_]`. Run `npx eslint src/` not `npm run lint` to avoid scanning `dist/`.

### Privacy Mode

When enabled, `bets` and `gameLog` are never written to localStorage — they exist only in React state for the session.
