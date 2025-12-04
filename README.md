# Atmospheric Edge (Sports Betting Model Pro)

A single-page React application for modeling betting edges across multiple sports. The app blends Elo-based projections, Monte Carlo simulations, AI-generated scouting notes, and a built-in bet tracker to help you evaluate wagers end to end.

## Key Features
- **Tab-driven workflow** – Switch between Analyze, Tracker, Ratings, Results, and Bankroll views without routing. Each tab shares saved state via localStorage so you can pick up where you left off.【F:src/App.jsx†L2611-L2660】【F:src/App.jsx†L236-L299】
- **Multi-sport support** – Preloaded configurations for NFL, NBA, NHL, CFB, CBB, and D3 men’s/women’s basketball with tuned home-field advantages, scoring variance, and margin caps.【F:src/App.jsx†L98-L119】【F:src/App.jsx†L2605-L2609】
- **Matchup analysis** – Combine Elo adjustments for injuries, rest, motivation, and neutrality with spread/total predictions, fair moneyline odds, and Kelly sizing. Optional Monte Carlo simulations validate edges and expose percentile scoring ranges.【F:src/App.jsx†L2147-L2219】【F:src/App.jsx†L2620-L2834】
- **Live game picker & odds** – Pull today’s schedule and lines directly from ESPN, then auto-populate the analyzer and odds inputs.【F:src/App.jsx†L2632-L2753】【F:src/App.jsx†L2688-L2699】
- **AI insights (optional)** – Generate matchup breakdowns using OpenRouter models, with optional web search for fresh injury/news context. Suggestions include numeric Elo adjustments you can apply instantly.【F:src/App.jsx†L1951-L2060】【F:src/App.jsx†L2022-L2053】
- **Bet tracker with ROI stats** – Log wagers, mark results (win/loss/push), and view ROI, win rate, pending count, and bankroll-adjusted units. Tracker results also feed live bankroll calculations inside the analyzer.【F:src/App.jsx†L2094-L2145】
- **Ratings management** – Review and edit team Elo/offense/defense ratings, add custom teams, and expand cards for detailed metrics per sport.【F:src/App.jsx†L120-L188】【F:src/App.jsx†L3380-L3388】
- **Results ingestion** – Import completed games from ESPN or the NCAA API (for D3 sports), select the games to apply, and automatically recalc Elo/off/def deltas with duplicate detection. Full-season imports are supported.【F:src/App.jsx†L3399-L3520】
- **Persistence-first UX** – All key state (teams per sport, bankroll, bets, API preferences, and game logs) is auto-saved to `localStorage` and reloaded on startup.【F:src/App.jsx†L236-L324】

## Project Structure
- `src/App.jsx` – Entire UI and business logic (tab navigation, modeling, imports, AI insights, bet tracker).
- `src/utils/calculations.js` – Elo, odds, EV, Kelly, spread/total helpers.
- `src/utils/simulations.js` – Monte Carlo score simulations.
- `src/main.jsx` – React entry that mounts the app.
- `src/index.css` & `src/App.css` – Tailwind (v4) base styles and component styling.
- `public/` & `index.html` – Static assets and HTML shell.
- Build and tooling configs: `vite.config.js`, `postcss.config.js`, `tailwind.config.js`, `eslint.config.js`, `vitest.config.js`.

## Getting Started
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Run the dev server**
   ```bash
   npm run dev
   ```
   The app uses Vite with a dev-time proxy for the NCAA API (`/ncaa-api` → `https://ncaa-api.henrygd.me`).【F:vite.config.js†L1-L16】
3. **Run checks**
   ```bash
   npm run lint   # ESLint flat config
   npm test       # Vitest (jsdom)
   npm run build  # Production bundle
   npm run preview# Preview built assets
   ```
   Available scripts are defined in `package.json`.【F:package.json†L6-L38】

## Configuration & Integrations
- **OpenRouter API key (optional)** – Add your key in the Bankroll settings panel inside the app to enable AI insights. Web search can be toggled per request; when enabled, the model suffix `:online` is used and a web plugin is attached. No environment variables are required.【F:src/App.jsx†L1951-L2060】
- **ESPN data** – Today’s games, odds, and completed game imports are fetched directly from ESPN’s public endpoints—no credentials needed. You can import single-day slates or full seasons, with duplicate detection to avoid reapplying results.【F:src/App.jsx†L2632-L2753】【F:src/App.jsx†L3399-L3520】
- **NCAA API** – D3 sports use `https://ncaa-api.henrygd.me`; Vite proxies requests during local development. Rate limits are noted in-app.【F:vite.config.js†L6-L16】【F:src/App.jsx†L3399-L3446】
- **Local persistence** – State is stored in `localStorage` under `sportsBettingModel`; clearing storage resets the app to seeded ratings. Auto-save occurs whenever teams, bets, bankroll, AI preferences, or logs change.【F:src/App.jsx†L236-L324】

## Usage Tips
- Set the sport first, then pick teams or use **Today’s Games** to auto-fill the matchup and odds. Adjust injuries/rest/motivation sliders to tweak Elo inputs before running simulations.【F:src/App.jsx†L2620-L2782】
- Enable **Run Simulations** to stress-test the analytical edge and view percentile score ranges; simulation settings (count, percentiles) are configurable per matchup.【F:src/App.jsx†L2754-L2782】【F:src/App.jsx†L2800-L2834】
- Use **AI Insights** to get quick scouting notes plus suggested numeric adjustments that can be applied to the model inputs.【F:src/App.jsx†L1951-L2059】
- Track wagers in the **Tracker** tab—results flow into live bankroll and ROI metrics used by the analyzer. Pending stakes are deducted from available bankroll for sizing.【F:src/App.jsx†L2094-L2145】
- Import completed games via the **Results** tab to keep ratings fresh; you can select specific games, import full seasons, and inspect Elo/off/def deltas for each entry.【F:src/App.jsx†L3399-L3520】

## Testing & Quality
- **Unit tests**: Vitest + Testing Library (jsdom) are configured. Use `npm test` for watch mode or `npm run test:run` for CI-style runs.【F:package.json†L11-L13】
- **Linting**: `npm run lint` applies the ESLint flat config with React hooks and refresh plugins.【F:package.json†L6-L10】

## Notes & Limitations
- All data and API keys live in the browser—there is no backend. Do not expose sensitive keys in production builds.
- ESPN/NCAA endpoints are unofficial and may change without notice; imports include basic error handling and duplicate checks but expect occasional failures.【F:src/App.jsx†L3399-L3520】
- Heavy computations (simulations, full-season imports) can take a few seconds; the UI surfaces progress and loading states to keep you informed.【F:src/App.jsx†L2754-L2782】【F:src/App.jsx†L3457-L3466】

Happy modeling and good luck finding edges!
