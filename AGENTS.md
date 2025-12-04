# CLAUDE.md - AI Assistant Guide

## Project Overview

**Atmospheric Edge** (package name: `sports-betting-model`) is a React-based sports betting analytics application that uses Elo rating systems to evaluate matchups and calculate expected value (EV) for betting opportunities.

### Purpose
This application helps users:
- Analyze sports matchups using Elo ratings and offensive/defensive metrics
- Calculate betting edges and Kelly Criterion stake sizes
- Track betting performance and manage bankroll
- Import game results from ESPN APIs
- Get AI-powered insights for upcoming games
- Manage team ratings across multiple sports

## Technology Stack

- **Frontend Framework**: React 19.2.0 (using hooks and functional components)
- **Build Tool**: Vite 7.2.4
- **Styling**: Tailwind CSS 4.1.17 (latest v4 using @tailwindcss/postcss)
- **Linting**: ESLint 9.39.1 with flat config format
- **Language**: JavaScript (ES2020+, ES Modules)
- **State Management**: React useState/useEffect hooks
- **Data Persistence**: localStorage

## Project Structure

```
atmospheric-edge/
├── src/
│   ├── App.jsx          # Main application (2915 lines, single component)
│   ├── App.css          # Component-specific styles
│   ├── main.jsx         # React entry point
│   ├── index.css        # Global styles (Tailwind imports)
│   └── assets/          # Static assets (SVGs, images)
├── public/              # Public static files
├── index.html           # HTML entry point
├── vite.config.js       # Vite configuration
├── eslint.config.js     # ESLint flat config
├── tailwind.config.js   # Tailwind configuration
├── postcss.config.js    # PostCSS with Tailwind plugin
├── package.json         # Dependencies and scripts
└── .gitignore          # Git ignore rules
```

## Core Application Features

### 1. Analyze Tab
- **Matchup Analysis**: Compare two teams using Elo ratings
- **Context Adjustments**: Factor in injuries, rest days, motivation
- **Betting Odds**: Compare model predictions vs sportsbook lines
- **Expected Value**: Calculate EV for ML, spread, and totals
- **Kelly Criterion**: Recommended bet sizing based on bankroll
- **AI Insights**: Optional AI analysis using OpenRouter API (with web search)
- **Today's Games Picker**: Auto-populate from ESPN's live games

### 2. Tracker Tab
- **Bet Logging**: Record bets with date, sport, game, type, odds, stake
- **Results Tracking**: Mark bets as win/loss/push
- **Performance Stats**: Win rate, ROI, total P&L, average odds
- **Export Data**: CSV export functionality

### 3. Ratings Tab
- **Team Database**: View/edit Elo ratings and offensive/defensive metrics
- **Add Teams**: Manually add new teams with custom ratings
- **Multi-Sport Support**: Separate ratings for NFL, NBA, NHL, CFB, CBB
- **Expandable Details**: Click to view full team statistics

### 4. Results Tab
- **Manual Entry**: Record game results to update Elo ratings
- **ESPN Import**: Bulk import completed games by date
- **Full Season Import**: Import entire season's results (NFL/NBA/NHL)
- **Game Selection**: Cherry-pick specific games to import
- **Automatic Updates**: Elo ratings recalculate based on results

### 5. Bankroll Tab
- **Performance Visualization**: Charts and graphs (implementation varies)
- **Bet History**: Chronological list of all bets
- **Statistics Dashboard**: Aggregate performance metrics

## Sport-Specific Configuration

Each sport has unique parameters in `sportConfig`:

```javascript
{
  nfl: { homeAdvantage: 48, kFactor: 20, avgScore: 23, avgTotal: 46, ... },
  nba: { homeAdvantage: 30, kFactor: 20, avgScore: 118, avgTotal: 236, ... },
  nhl: { homeAdvantage: 22, kFactor: 22, avgScore: 3.1, avgTotal: 6.2, ... },
  cfb: { homeAdvantage: 55, kFactor: 18, avgScore: 28, avgTotal: 56, marginCap: 21, ... },
  cbb: { homeAdvantage: 35, kFactor: 20, avgScore: 72, avgTotal: 144, marginCap: 15, ... }
}
```

**Special Handling**:
- **NHL**: OT/SO losses only lose 25% Elo (due to standings point)
- **College Sports**: Margin caps prevent blowouts from inflating Elo excessively

## Key Technical Details

### Component Architecture
- **Single Component Design**: App.jsx contains entire application (2915 lines)
- **Tab-Based Navigation**: 5 main tabs render conditionally based on `activeTab` state
- **Heavy State Management**: ~50+ useState hooks managing all application state
- **No Routing**: Client-side tab switching only (no React Router)

### Data Flow
1. **Initial Load**: Teams loaded from `getInitialTeams()` with default Elo ratings
2. **localStorage Sync**: useEffect hooks persist state changes automatically
3. **ESPN Integration**: Fetch API calls to ESPN endpoints for scores/odds
4. **AI Integration**: OpenRouter API for game insights (optional)
5. **Elo Updates**: Manual or automatic based on game results

### Key Functions
- `calculateEV()`: Expected value calculation for bets
- `updateRatings()`: Recalculate Elo after game results
- `fetchESPNScores()`: Import completed games from ESPN
- `fetchTodaysGames()`: Get current day's matchups
- `fetchAiInsights()`: Get AI analysis of matchups
- `importFullSeason()`: Bulk import historical results

### Styling Approach
- **Tailwind v4**: Uses new `@import "tailwindcss"` syntax
- **Modern PostCSS**: `@tailwindcss/postcss` plugin
- **Utility-First**: Inline Tailwind classes throughout JSX
- **Dark Theme**: Gradient backgrounds, glassmorphism effects
- **Responsive Design**: Mobile-first with responsive breakpoints

## Development Workflows

### Setup & Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
- Runs on default Vite port (usually http://localhost:5173)
- Hot Module Replacement (HMR) enabled
- React Fast Refresh for instant updates

### Linting
```bash
npm run lint
```
- ESLint with recommended rules for React Hooks
- Custom rule: Allow unused vars matching `^[A-Z_]` pattern
- Automatically checks `.js` and `.jsx` files

### Build for Production
```bash
npm run build
```
- Output to `dist/` directory
- Optimized and minified

### Preview Production Build
```bash
npm run preview
```

## Code Conventions for AI Assistants

### React Patterns
1. **Functional Components**: Always use function components with hooks
2. **Hook Usage**: Prefer `useState` and `useEffect` for state/effects
3. **Event Handlers**: Define inline or as const functions within component
4. **Conditional Rendering**: Use `&&` or ternary operators for conditional JSX
5. **Props Destructuring**: Not heavily used in this codebase (single component)

### JavaScript Style
1. **ES Modules**: Use `import`/`export` (type: "module" in package.json)
2. **Arrow Functions**: Preferred for function expressions
3. **Template Literals**: Use backticks for string interpolation
4. **Optional Chaining**: Available and encouraged (`?.`)
5. **Nullish Coalescing**: Available and encouraged (`??`)
6. **Async/Await**: Use for API calls and promises

### Naming Conventions
1. **Components**: PascalCase (e.g., `SportsBettingModelPro`)
2. **Variables/Functions**: camelCase (e.g., `fetchESPNScores`)
3. **State Variables**: Descriptive names with `set` prefix for setters
4. **Constants**: camelCase for config objects, UPPER_CASE for true constants
5. **Event Handlers**: Prefix with `handle` or describe action (e.g., `updateRatings`)

### State Management Guidelines
1. **Initialize with Defaults**: Provide sensible default values
2. **localStorage Integration**: Persist important state (teams, bets, bankroll)
3. **Derived State**: Calculate values in render, don't store redundantly
4. **State Updates**: Use functional updates when depending on previous state
5. **Array/Object State**: Use spread operators for immutable updates

### API Integration Patterns
1. **ESPN APIs**: No authentication required, use fetch directly
2. **OpenRouter API**: Requires API key, stored in localStorage
3. **Error Handling**: Try-catch blocks with user-friendly error messages
4. **Loading States**: Boolean flags for async operations
5. **CORS**: ESPN APIs have CORS enabled, fetch directly from frontend

### ESLint Configuration
- **Flat Config**: Uses new ESLint 9 flat config format
- **Ignored Patterns**: `dist/` directory excluded
- **React Plugins**: `react-hooks` and `react-refresh` for Vite
- **Custom Rules**: Allows unused vars matching `^[A-Z_]` pattern
- **ECMAScript Version**: 2020 with JSX support

### Tailwind Usage
1. **Version 4 Syntax**: Uses `@import "tailwindcss"` in CSS
2. **JIT Mode**: Always on in v4 (no configuration needed)
3. **Utility Classes**: Prefer utilities over custom CSS
4. **Responsive**: Use breakpoint prefixes (`sm:`, `md:`, `lg:`)
5. **Dark Mode**: Not explicitly configured (consider adding if needed)
6. **Custom Colors**: Use Tailwind's default palette (emerald, blue, red, etc.)

### Testing Approach
- **Current State**: No testing framework configured
- **If Adding Tests**: Consider Vitest (Vite-native) or Jest with React Testing Library
- **Component Testing**: Focus on calculation functions (EV, Elo updates)
- **Integration Testing**: API mocking for ESPN/OpenRouter calls

## Common Tasks & Patterns

### Adding a New Sport
1. Add sport config to `sportConfig` object with all required parameters
2. Add initial teams to `getInitialTeams()` function
3. Update sport selector dropdowns in JSX
4. Test Elo calculations with sport-specific parameters

### Modifying Elo Algorithm
1. Locate `updateRatings()` function (around line 391)
2. Consider sport-specific `kFactor`, `homeAdvantage`, `marginMult`
3. Test with known results to verify accuracy
4. Update comments explaining algorithm changes

### Adding New Bet Type
1. Add to `betType` options in Tracker tab
2. Update `calculateEV()` if EV calculation differs
3. Add corresponding odds inputs in Analyze tab
4. Update bet statistics calculations

### Integrating New API
1. Create async function with try-catch error handling
2. Add loading state (e.g., `const [loading, setLoading] = useState(false)`)
3. Add error state (e.g., `const [error, setError] = useState('')`)
4. Display loading indicator and errors in UI
5. Parse response and update relevant state

### Refactoring Considerations
This application could benefit from:
1. **Component Splitting**: Break App.jsx into smaller, focused components
2. **Custom Hooks**: Extract repeated logic (localStorage sync, API calls)
3. **Context API**: Reduce prop drilling if components are separated
4. **Type Safety**: Consider migrating to TypeScript
5. **State Management Library**: Consider Zustand or Jotai for complex state
6. **Routing**: Add React Router if multi-page navigation is needed

## Performance Considerations

1. **Large Component**: 2915-line component may cause slower re-renders
2. **State Updates**: Many useState hooks may trigger multiple re-renders
3. **localStorage**: Sync operations are synchronous (consider debouncing)
4. **API Calls**: No caching implemented, consider React Query
5. **Optimization Opportunities**:
   - Memoization with `useMemo` for expensive calculations
   - `useCallback` for event handlers passed to child components
   - Code splitting with `React.lazy()` for tabs
   - Virtual scrolling for long team/bet lists

## External Dependencies & APIs

### ESPN APIs (No Auth Required)
- **Scoreboard**: `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`
- **Full Season**: Append `?dates={YYYYMMDD-YYYYMMDD}`
- **Odds**: `https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/events/{eventId}/competitions/{eventId}/odds`
- **Rate Limits**: Unknown, use responsibly

### OpenRouter API (Auth Required)
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Authentication**: Bearer token (user-provided API key)
- **Cost**: Free models available, web search costs $0.02/request
- **Models**: Default is `google/gemma-3-12b-it:free`

## Security & Best Practices

### Current Implementation
- ⚠️ API keys are currently stored in localStorage (frontend only) — **this is insecure and not recommended for production. Any XSS or third-party script can access localStorage and steal API keys.**
- ✅ No backend/database (all data client-side)
- ✅ No authentication/authorization needed
- ✅ HTTPS required for production (Vite handles dev)

### Recommendations for Production
1. **Environment Variables**: Use `.env` for API keys during build (never expose sensitive keys to the frontend)
2. **API Key Management**: Do **not** store API keys in localStorage. Use a backend proxy to handle OpenRouter API requests and store keys server-side. If strictly client-side, prompt users to enter their API key per session (do not persist in localStorage or sessionStorage).
3. **Data Backup**: localStorage can be cleared, implement export/import
4. **Input Validation**: Validate all user inputs (odds, scores, stakes)
5. **Error Boundaries**: Add React Error Boundaries for graceful failures
6. **CSP Headers**: Configure Content Security Policy for production

## Git Workflow

### Branch Strategy
- **Main Branch**: Production-ready code
- **Feature Branches**: Named `claude/claude-md-{session-id}-{random-id}`
- **Commits**: Clear, descriptive messages
- **Push**: Always use `-u origin <branch-name>` for first push

### Commit Message Style
Based on git log, use conventional format:
- `initial commit` (project setup)
- Future commits should be descriptive (e.g., "Add NBA team ratings", "Fix Elo calculation for NHL OT")

## Troubleshooting

### Common Issues

**"Module not found" errors**
- Run `npm install` to ensure all dependencies are installed
- Check `package.json` for correct dependency versions

**Tailwind styles not applying**
- Verify `index.css` imports: `@import "tailwindcss"`
- Check `tailwind.config.js` content paths include all JSX files
- Restart dev server after config changes

**ESLint errors**
- Run `npm run lint` to see all errors
- Check `eslint.config.js` for rule configuration
- Unused vars starting with capital letters are allowed

**localStorage data corruption**
- Clear browser localStorage: `localStorage.clear()`
- Refresh page to reload default teams
- Re-enter any custom data

**ESPN API failures**
- Check network tab for CORS errors (should not occur)
- Verify date format for imports (YYYYMMDD)
- ESPN may change API structure without notice

**OpenRouter API errors**
- Verify API key is valid and has credits
- Check model name is correct
- Enable web search only if needed (costs extra)

## Future Enhancements

Potential improvements for AI assistants to consider:

1. **TypeScript Migration**: Add type safety across the application
2. **Component Decomposition**: Split App.jsx into manageable pieces
3. **Backend Integration**: Add database for persistent storage
4. **User Authentication**: Multi-user support with accounts
5. **Real-Time Odds**: Live odds from sportsbooks APIs
6. **Advanced Charts**: Add visualization library (Recharts, Chart.js)
7. **Mobile App**: React Native version for iOS/Android
8. **Bet Tracking**: Integrate with sportsbook accounts
9. **Advanced Analytics**: Monte Carlo simulations, CLV tracking
10. **Social Features**: Share picks, compare performance

## Resources

- **Vite Docs**: https://vite.dev/
- **React Docs**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/
- **ESLint**: https://eslint.org/
- **ESPN API**: Unofficial, reverse-engineered endpoints
- **OpenRouter**: https://openrouter.ai/docs

## Contact & Support

For questions or issues with this codebase:
1. Review this CLAUDE.md file
2. Check inline comments in code
3. Test changes in development environment
4. Use ESLint to catch common errors

---

**Last Updated**: 2025-12-03
**Project Version**: 0.0.0 (pre-release)
**Maintained By**: AI-assisted development workflow
