# Code Review: Atmospheric Edge

**Date**: 2026-02-24
**Reviewer**: Claude Code (5 parallel review agents)
**Baseline**: 59 tests passing, 9 ESLint errors + 1 warning
**Dimensions**: Math/Logic, React Patterns, Security, Bugs/Edge Cases, Code Quality

---

## CRITICAL (Fix Immediately)

### 1. D3 Full Season Import Is Completely Broken

**Location**: `App.jsx:1507`
**Confidence**: 100%
**Category**: Bug
**Status**: ✅ Fixed in current batch (`src/App.jsx`: removed dynamic import and used in-scope `regressRating`)

`importNCAAFullSeason` dynamically imports `regressRating` from `calculations.js`, but that function is **not exported** from there — it's defined locally in `App.jsx` at line 744. The destructure yields `undefined`, and calling `undefined(...)` throws a TypeError. D3 basketball full-season import will always crash.

```js
// App.jsx line 1507 — regressRating does not exist in calculations.js
const { regressRating } = await import('./utils/calculations');
```

**Fix**: Remove the dynamic import entirely (the local `regressRating` is already in scope), or export it from `calculations.js` and use a static import.

---

### 2. Elo Updates Omit Home Advantage from Win Probability

**Location**: `App.jsx:800, 928, 1878, 2122`
**Confidence**: 95%
**Category**: Math/Logic
**Status**: ✅ Fixed in current batch (`src/App.jsx`: all Elo update paths now pass winner-relative home advantage to `eloToWinProb`)

All four Elo update paths call `eloToWinProb(winner.elo, loser.elo)` without passing the home advantage parameter. This makes home team wins appear more surprising than they are, systematically inflating home Elo and deflating away Elo across every imported game.

```js
// App.jsx line 800 — WRONG: no home advantage
const exp = eloToWinProb(teams[winner].elo, teams[loser].elo);

// CORRECT: pass home advantage relative to the winner
const isWinnerHome = winner === resultTeam1;
const haForWinner = isWinnerHome ? c.homeAdvantage : -c.homeAdvantage;
const exp = eloToWinProb(teams[winner].elo, teams[loser].elo, haForWinner);
```

This same bug exists in all four Elo update locations:
- `updateRatings()` (line 800)
- `deleteGameFromLog()` recalc (line 928)
- `importSelectedGames()` (line 1878)
- `importFullSeason()` (line 2122)

---

### 3. `importSelectedGames` Uses Stale State for Batch Elo Calculations

**Location**: `App.jsx:1858-1944`
**Confidence**: 98%
**Category**: React/Bug
**Status**: ✅ Fixed in current batch (`src/App.jsx`: batch import now uses local `currentTeams` and commits once at end)

The `forEach` loop reads `teams[winner].elo` from the pre-loop React state snapshot for every game. Games 2+ in a batch compute expected win probability from stale ratings. `importFullSeason` handles this correctly with a local mutable `currentTeams` object; `importSelectedGames` does not.

```js
// Line 1878 — reads stale snapshot for ALL games in batch
const exp = eloToWinProb(teams[winner].elo, teams[loser].elo);
```

**Fix**: Mirror the `importFullSeason` pattern — use a local mutable `currentTeams` object throughout the loop, call `setTeams(currentTeams)` once at the end, and call `setGameLog(prev => [...prev, ...newEntries])` once at the end.

---

### 4. `americanToDecimal(0)` Returns Infinity — Propagates to EV/Kelly

**Location**: `calculations.js:69-72`
**Confidence**: 90%
**Category**: Math/Logic
**Status**: ✅ Fixed in current batch (`src/utils/calculations.js`: added `x === 0` guards in both `americanToDecimal` and `americanToImpliedProb`)

When odds input is `0` (the default from `safeParseFloat` for empty inputs), `americanToDecimal` divides by zero, returning `Infinity`. This cascades into `calculateEV` and `kellyStake`, producing `NaN`/`Infinity` in the UI.

```js
// When x = 0: 100 / Math.abs(0) + 1 = Infinity
return x > 0 ? x / 100 + 1 : 100 / Math.abs(x) + 1;
```

**Fix**: Guard `x === 0` explicitly:

```js
export const americanToDecimal = (o) => {
  const x = safeParseFloat(o);
  if (x === 0) return 2.0; // Even money
  return x > 0 ? x / 100 + 1 : 100 / Math.abs(x) + 1;
};
```

Also apply a similar guard in `americanToImpliedProb` where `x === 0` returns `0.0` (wrong — should be `0.5`).

---

### 5. Tied Games Cause Both Teams to Lose Elo

**Location**: `App.jsx:829-830` (and 3 other locations)
**Confidence**: 95%
**Category**: Math/Logic
**Status**: ✅ Fixed in current batch (`src/App.jsx`: shared tie-aware Elo delta helper now returns zero Elo changes on ties)

When `s1 === s2`, neither `s1 > s2` nor `s2 > s1` is true, so both `t1EloChange` and `t2EloChange` evaluate to `-loserEloChange`. Both teams lose Elo, violating the zero-sum property.

```js
const t1EloChange = s1 > s2 ? winnerEloChange : -loserEloChange;
const t2EloChange = s2 > s1 ? winnerEloChange : -loserEloChange;
// When s1 === s2: both are -loserEloChange
```

Affects all 4 Elo update paths (lines 829-830, 960-961, 1914/1920, 2149/2155).

**Fix**: Handle ties explicitly:

```js
if (s1 === s2) {
  t1EloChange = 0;
  t2EloChange = 0;
} else {
  t1EloChange = s1 > s2 ? winnerEloChange : -loserEloChange;
  t2EloChange = s2 > s1 ? winnerEloChange : -loserEloChange;
}
```

---

### 6. Team Name Mismatches Break Injury Lookups and Imports

**Location**: `App.jsx:153/263, 166/301`
**Confidence**: 100%
**Category**: Bug/Config
**Status**: ✅ Fixed in current batch (`src/App.jsx`: normalized key names + explicit alias canonicalization in `matchTeamName`)

Two team name mismatches between `espnTeamIds` and `getInitialTeams`:

| Sport | `espnTeamIds` key | `getInitialTeams` key |
|-------|-------------------|-----------------------|
| NBA | `'LA Clippers'` | `'Los Angeles Clippers'` |
| NHL | `'Utah Hockey Club'` | `'Utah Mammoth'` |

Injury data never loads for these teams. ESPN imports may create duplicate team entries with generic 1500 Elo instead of using the existing team's rating.

**Steps to reproduce**:
1. Select NHL > Utah Mammoth in Analyze tab
2. Observe "Team not found in ESPN database" error in injury panel

**Fix**: Reconcile names to match. Prefer the `getInitialTeams` names and update `espnTeamIds`:

```js
'Los Angeles Clippers': 12,  // was 'LA Clippers'
'Utah Mammoth': 37,          // was 'Utah Hockey Club'
```

---

## HIGH (Fix Soon)

### 7. Game Log Entries Have No `sport` Field

**Location**: `App.jsx:849-858, 1927-1944, 2162-2171`
**Confidence**: 100%
**Category**: Bug
**Status**: ✅ Fixed in current batch (`src/App.jsx`: all new log entries include `sport`; legacy entries are backfilled/inferred during load and reset filtering)

`resetAllData` on line 435 filters by `game.sport`:

```js
const filteredGameLog = (existingData.gameLog || []).filter(game => game.sport !== sport);
```

But **none** of the `setGameLog` calls include a `sport` field in the game log entry. `game.sport` is always `undefined`, so the filter keeps everything. `resetAllData` never actually clears the current sport's game log.

**Fix**: Add `sport` to every game log entry in all locations (`updateRatings`, `importSelectedGames`, `importFullSeason`, `importNCAAFullSeason`).

---

### 8. `importFullSeason` Has No Deduplication

**Location**: `App.jsx:2100-2182`
**Confidence**: 100%
**Category**: Bug
**Status**: ✅ Fixed in current batch (`src/App.jsx`: date-aware dedupe keys + duplicate checks before applying game updates)

Unlike daily import, `importFullSeason` never checks `isDuplicateGame`. Running it twice doubles every game in the log and applies Elo changes twice, corrupting all ratings.

**Steps to reproduce**:
1. Import full season for NBA
2. Import full season for NBA again
3. All games are now in the log twice; team Elo ratings are wildly incorrect

**Fix**: Before appending `newGameLog`, filter out entries that already appear in the existing game log.

---

### 9. `importFullSeason` References `config` Variable Fragily

**Location**: `App.jsx:1994`
**Confidence**: 97%
**Category**: Bug/Maintainability
**Status**: ✅ Fixed in current batch (`src/App.jsx`: uses local `sportName` from `sportConfig[sport]?.name`)

Uses `config.name` where `config` is declared ~1000 lines later in render scope (line 3071). Works at runtime by closure capture but will break on any refactoring that moves the function outside the component.

**Fix**: Replace `config.name` with `sportConfig[sport]?.name` (matches how `importNCAAFullSeason` handles it).

---

### 10. ~300 Lines of Constants Recreated Every Render

**Location**: `App.jsx:119-201, 1049-1190, 2197-2203`
**Confidence**: 95%
**Category**: Performance

`sportConfig`, `espnTeamIds`, `conferenceTiers` (hundreds of entries), `positionWeights`, `statusMultipliers`, `baseMaxImpact`, `espnEndpoints`, `seasonStartDates`, `espnOddsConfig`, and `getInitialTeams` are all declared inside the component body. Every state change garbage collects and recreates all of them.

**Fix**: Move all of these outside the component as module-level constants. None depend on React state or props.

---

### 11. `analyzeMatchup()` Runs Monte Carlo Simulations on Every Render

**Location**: `App.jsx:3063`
**Confidence**: 92%
**Category**: Performance
**Status**: ✅ Fixed in current batch (`src/App.jsx`: `analysis` and `stats` are now memoized with targeted dependencies)

Called unconditionally in the render body. With 50+ useState hooks, even typing in an odds field or dragging a context adjustment slider triggers a full re-render with potential simulation re-runs (up to 15,000 Monte Carlo iterations). Not wrapped in `useMemo`. Same issue with `calculateStats()` on line 3072.

**Fix**: Wrap both in `useMemo` with appropriate dependency arrays.

---

### 12. Elo Update Logic Duplicated Across 4 Functions (~250 lines each)

**Location**: `App.jsx:782-860, 920-983, 1858-1944, 2101-2178`
**Confidence**: 95%
**Category**: Architecture

The core Elo update block (winner/loser determination, margin-of-victory multiplier, K-factor, off/def adjustments, NHL OT branching, `regressRating` clamping) is copy-pasted across four functions:

| Function | Lines |
|----------|-------|
| `updateRatings` (manual entry) | ~782-860 |
| `deleteGameFromLog` (recalculation) | ~920-983 |
| `importSelectedGames` (batch ESPN) | ~1858-1944 |
| `importFullSeason` (full season ESPN) | ~2101-2178 |

Every bug fix (like issues #2 and #5) must be applied in all 4 places.

**Fix**: Extract a pure `applyGameResult(currentTeams, gameEntry, sportConfig, sport)` function that returns updated teams + a game log entry. All four callers become thin wrappers.

---

### 13. No `AbortController` on Any Fetch — Race Conditions

**Location**: `App.jsx:491-583, 1619-1684, 2253-2343`
**Confidence**: 90%
**Category**: React/Bug
**Status**: ✅ Fixed in current batch (`src/App.jsx`: added AbortController refs + signal propagation/cleanup for injuries and today’s games fetch paths)

Rapidly switching teams triggers concurrent injury fetches. The slower first fetch can resolve after the faster second fetch, overwriting the correct current matchup's injury data with stale data. Same issue with `fetchTodaysGames` and `fetchNCAATodaysGames`.

**Fix**: Use `AbortController` and pass `signal` to all `fetch` calls, aborting previous requests in effect cleanup.

---

### 14. Dead Vite Template CSS in `App.css`

**Location**: `App.css` (entire file)
**Confidence**: 100%
**Category**: Dead Code
**Status**: ✅ Fixed in current batch (`src/App.css` removed; file was unused scaffold CSS)

Entire file is the unmodified Vite scaffold (`.logo`, `.card`, `.read-the-docs`). None of these classes are used anywhere in `App.jsx`. The `#root { text-align: center }` rule may interfere with Tailwind layout.

**Fix**: Delete `App.css` entirely and remove the `import './App.css'` from `App.jsx`.

---

### 15. Duplicated `erf` Function in `calculations.js`

**Location**: `calculations.js:130-138, 155-163`
**Confidence**: 100%
**Category**: Duplication
**Status**: ✅ Fixed in current batch (`src/utils/calculations.js`: shared module-level `erfApprox`/`normalCdf` helper)

Identical 8-line error function approximation copy-pasted inside both `spreadCoverProb` and `totalProb`.

**Fix**: Extract to a single module-level helper function.

---

### 16. Inlined Elo Formula in `importFullSeason`

**Location**: `App.jsx:2122`
**Confidence**: 90%
**Category**: Duplication
**Status**: ✅ Fixed in current batch (`src/App.jsx`: switched to `eloToWinProb(winnerElo, loserElo)`)

Only place in the codebase that uses a raw `1 / (1 + Math.pow(10, ...))` instead of the imported `eloToWinProb` utility function. Will diverge if the utility is ever updated.

**Fix**: Replace with `eloToWinProb(currentTeams[winner].elo, currentTeams[loser].elo)`.

---

## MEDIUM

### 17. `selectGameFromPicker` Doesn't Clear Old Book Lines

**Location**: `App.jsx:2346-2374`
**Confidence**: 85%
**Category**: Bug
**Status**: ✅ Fixed in current batch (`src/App.jsx`: clears all book lines before repopulating selected game odds)

Only sets odds if available (`if (game.homeML) ...`). If the previous matchup had lines entered and the new game has no ESPN odds, old lines remain, causing wrong EV/Kelly calculations for the new matchup.

**Fix**: Clear all book line inputs unconditionally at the start of the function before selectively populating.

---

### 18. `isDuplicateGame` Has No Date Check — False Positives

**Location**: `App.jsx:1291-1305`
**Confidence**: 90%
**Category**: Bug
**Status**: ✅ Fixed in current batch (`src/App.jsx`: duplicate detection now checks normalized date and optional eventId)

Only checks team names and scores, not dates. Same teams can play twice in a season with the same final score (especially NHL 3-2 games). The second game would be incorrectly marked as a duplicate.

**Fix**: Add date comparison to the duplicate check, or use ESPN event ID as the deduplication key.

---

### 19. `todaysGames` Sorted by Locale-Formatted Time String

**Location**: `App.jsx:2296-2318`
**Confidence**: 85%
**Category**: Bug
**Status**: ✅ Fixed in current batch (`src/App.jsx`: added `sortTime` and numeric timestamp sort)

Games are sorted by `a.time.localeCompare(b.time)` where `time` is a formatted string like `"7:30 PM"`. Lexicographic sort puts "12:00 PM" before "7:30 PM" (because `"1" < "7"`).

**Fix**: Store the raw ISO 8601 `event.date` for sorting; use formatted time only for display.

---

### 20. Array Index Keys on Mutable Lists

**Location**: `App.jsx:3302, 3322, 4104`
**Confidence**: 82%
**Category**: React
**Status**: ✅ Fixed in current batch (`src/App.jsx`: injuries/game log now use composite stable keys instead of array indexes)

Injury lists and game log use `key={i}` (array index). When items are deleted or reordered, React reuses DOM nodes incorrectly.

**Fix**: Use stable keys like `inj.player` for injuries and a composite `${g.team1}-${g.team2}-${g.date}` for game log.

---

### 21. Debug `console.log` Calls in Production

**Location**: `App.jsx:1706, 1728-1734, 2012, 1358, 1363, 1752, 1757`
**Confidence**: 82%
**Category**: Code Quality / Security
**Status**: ✅ Fixed in current batch (`src/App.jsx`: replaced `console.log` with DEV-gated `debugLog`)

24 `console.*` calls including several explicitly labeled "Debug log". Logs full ESPN API response structures, team names with conference IDs, and constructed API URLs. Some log `JSON.stringify(firstHome, null, 2)` which dumps entire API response objects.

**Fix**: Remove all debug `console.log` statements. Keep `console.error` and `console.warn` for genuine error conditions.

---

### 22. No localStorage Schema Validation on Load

**Location**: `App.jsx:319-356`
**Confidence**: 81%
**Category**: Security/Robustness
**Status**: ✅ Fixed in current batch (`src/App.jsx`: added type guards for persisted arrays/strings/booleans and safer `teamsBySport` shape checks)

Parsed localStorage data is passed directly to setters with no type validation. Corrupted data (non-array `bets`, non-numeric `elo`, etc.) would silently propagate `NaN` through all calculations.

**Fix**: Add lightweight type guards:

```js
if (Array.isArray(data.bets)) setBets(data.bets);
if (Array.isArray(data.gameLog)) setGameLog(data.gameLog);
```

---

### 23. `@testing-library/jest-dom` Installed But Not Configured

**Location**: `src/test/setup.js`, `package.json`
**Confidence**: 85%
**Category**: Testing/Config
**Status**: ✅ Fixed in current batch (`src/test/setup.js`: added `@testing-library/jest-dom/vitest` import)

The package is in `devDependencies` but the setup file never imports the matchers. Any component test using `toBeInTheDocument()` etc. would fail.

**Fix**: Add `import '@testing-library/jest-dom';` to `src/test/setup.js`.

---

### 24. `calculateCLV` Has No Test Coverage

**Location**: `calculations.test.js`
**Confidence**: 90%
**Category**: Testing
**Status**: ✅ Fixed in current batch (`src/utils/calculations.test.js`: added CLV coverage for positive/negative/zero/null)

Exported from `calculations.js` and used in `calculateStats`, but not imported or tested in the test file.

**Fix**: Add test cases for positive CLV, negative CLV, null return for empty closing odds, and same-odds returning 0.

---

### 25. No Content Security Policy in `index.html`

**Location**: `index.html`
**Confidence**: 82%
**Category**: Security
**Status**: ✅ Fixed in current batch (`index.html`: added CSP meta with restricted `script-src` and API-specific `connect-src`)

No CSP meta tag. The app fetches from 4 external origins (ESPN x2, OpenRouter, NCAA API) and stores an API key in localStorage. Without CSP, any injected script has unrestricted access.

**Fix**: Add a CSP meta tag restricting `connect-src` to known API hosts and `script-src` to `'self'`.

---

### 26. `importDate` and `importFullSeason` Use UTC Date (Timezone Off-by-One)

**Location**: `App.jsx:83, 2001`
**Confidence**: 90%
**Category**: Bug
**Status**: ✅ Fixed in current batch (`src/App.jsx`: both `importDate` and `importFullSeason` now use local-date helper)

Both use `new Date().toISOString().split('T')[0]` which returns UTC date. Users west of UTC at night get tomorrow's date. The `gamePickerDate` init (line 93-96) was already fixed to use local date parts, but `importDate` and `importFullSeason` were not.

**Fix**: Use local date construction:

```js
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
```

---

### 27. ESLint `varsIgnorePattern` Too Broad

**Location**: `eslint.config.js:26`
**Confidence**: 82%
**Category**: Config
**Status**: ✅ Fixed in current batch (`eslint.config.js`: now `varsIgnorePattern: '^_'` + `argsIgnorePattern: '^_'`)

```js
'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
```

Exempts **any** variable starting with an uppercase letter, masking real unused-var bugs (unused components, constants, classes).

**Fix**: Change to `varsIgnorePattern: '^_'` and `argsIgnorePattern: '^_'`.

---

### 28. `seasonImportProgress` useState Declared Mid-Component

**Location**: `App.jsx:1986`
**Confidence**: 80%
**Category**: Architecture
**Status**: ✅ Fixed in current batch (`src/App.jsx`: moved `seasonImportProgress` hook into top state block)

All other `useState` declarations are at lines 19-113. This one is buried 1986 lines down. Maintenance hazard for hook ordering rules.

**Fix**: Move to the state declaration block at the top of the component.

---

### 29. Unvalidated `$ref` URLs from ESPN API Followed Blindly

**Location**: `App.jsx:507, 513, 520`
**Confidence**: 95%
**Category**: Security
**Status**: ✅ Fixed in current batch (`src/App.jsx`: added ESPN HTTPS host allowlist validation before following `$ref` links)

Injury fetching code follows `item.$ref`, `detail.athlete.$ref`, `athleteInfo.statistics.$ref` URLs from ESPN's response body without validating the target host. A compromised or misconfigured ESPN response could redirect fetches to arbitrary URLs.

**Fix**: Validate that every `$ref` URL hostname is in a known ESPN allowlist before fetching.

---

### 30. `secure: false` in Vite Proxy Disables TLS Verification

**Location**: `vite.config.js:13`
**Confidence**: 90%
**Category**: Security (dev)
**Status**: ✅ Fixed in current batch (`vite.config.js`: removed `secure: false` from NCAA proxy)

Disables TLS certificate verification for the NCAA API proxy in development. A network MITM could inject malicious game data that persists to localStorage.

**Fix**: Remove `secure: false` — the target (`ncaa-api.henrygd.me`) has a valid certificate.

---

## Second-Pass Addendum (Additional Findings)

### 31. OpenRouter API Key and Betting History Stored in Plaintext localStorage

**Location**: `App.jsx:329, 379-380`
**Confidence**: 100%
**Category**: Security/Privacy
**Status**: ◐ Partially fixed in current batch (`src/App.jsx`: OpenRouter API key is no longer persisted; bankroll/bets/game history are still persisted)

Bankroll, bets, and game history are still persisted directly in `localStorage`. Any script that executes in origin context (XSS, compromised dependency, browser extension) can read and exfiltrate this data. API key exposure risk is reduced because the key is now session-only and no longer written to localStorage.

**Fix**: Do not persist API keys client-side. Keep the key in-memory per session or move AI requests behind a backend proxy. Add a privacy mode for users who do not want betting history persisted.

---

### 32. `fetchTodaysGames` Odds Fetch Uses Fail-Fast `Promise.all`

**Location**: `App.jsx:2323-2334`
**Confidence**: 92%
**Category**: Reliability
**Status**: ✅ Fixed in current batch (`src/App.jsx`: switched to `Promise.allSettled` with per-result merge)

Odds requests are batched with `Promise.all`. One failed odds call rejects the whole batch and prevents partial successful odds from rendering.

**Fix**: Use `Promise.allSettled` and merge successful results while safely skipping failed requests.

---

### 33. Game Picker Fetch Errors Are Mostly Console-Only (Weak User Feedback)

**Location**: `App.jsx:1679-1680, 2338-2340`
**Confidence**: 90%
**Category**: UX/Robustness
**Status**: ✅ Fixed in current batch (`src/App.jsx`: added `todaysGamesError` state + modal error/retry UI)

NCAA/ESPN fetch failures for today's games are logged to console, but users are not given a clear in-UI error state explaining what failed.

**Fix**: Add explicit `todaysGamesError` state and render it in the modal alongside loading/empty states.

---

### 34. Bet Form Validation Fails Silently

**Location**: `App.jsx:2521, 3870-3877`
**Confidence**: 95%
**Category**: UX
**Status**: ✅ Fixed in current batch (`src/App.jsx`: explicit validation messages with inline alert)

`addBet` exits early if required fields are missing, but the form provides no visible validation feedback.

**Fix**: Track invalid fields in state, render inline errors, and disable the Add button until required inputs are valid.

---

### 35. Today’s Games Modal Lacks Dialog Accessibility Semantics

**Location**: `App.jsx:3114-3120`
**Confidence**: 90%
**Category**: Accessibility
**Status**: ✅ Fixed in current batch (`src/App.jsx`: `role="dialog"`, `aria-modal`, label, focus-on-open, Escape close)

The modal overlay is a plain `div` without `role="dialog"`, `aria-modal`, focus management, or Escape-key handling. Keyboard and assistive-tech navigation are degraded.

**Fix**: Add proper dialog semantics, focus trap/restore, Escape close handler, and accessible labeling for controls.

---

### 36. App-Level Workflow Coverage Is Missing From Tests

**Location**: `src/utils/calculations.test.js`, `src/utils/simulations.test.js`
**Confidence**: 95%
**Category**: Testing

Current tests are utility-focused. Critical App workflows (imports, Elo state transitions, form flows, reset behavior) are not covered by integration tests, so regression risk remains high in stateful paths.

**Fix**: Add targeted integration tests (React Testing Library + Vitest) for import/reset/update flows and key user interactions.

---

## Factual Correction

- **Item #14 update**: `src/App.css` has now been removed; there was no active `App.jsx` import to remove.

---

## Existing Lint Issues

✅ `npm run lint` now passes with no ESLint errors/warnings in source.  
Remaining message is informational only:
- baseline dataset staleness notice from `baseline-browser-mapping` dependency.

## Recommended Fix Order

1. **Security/privacy completion (#31 partial)** — add privacy mode or backend proxy to avoid persisting betting history client-side
2. **High architecture/perf (#10, #12)** — move static constants out of component and de-duplicate Elo update logic
3. **Testing depth (#36)** — add App-level integration tests for import/reset/update workflows
4. **Dependency hygiene** — optional: update `baseline-browser-mapping` to remove staleness notice
