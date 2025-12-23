# Atmospheric Edge - Sports Betting Model Review

**Reviewed by:** Claude (AI Sports Betting Model Expert)
**Date:** December 23, 2025

---

## Executive Summary

Atmospheric Edge is a well-designed sports betting analytics application that uses Elo ratings and offensive/defensive metrics to evaluate matchups and calculate expected value (EV) for betting opportunities. The model demonstrates sophisticated understanding of sports betting fundamentals while maintaining usability.

---

## What the Model Does Well

### 1. Dual Prediction System (Elo + Off/Def)

The model intelligently uses two complementary approaches:
- **Elo ratings** for overall team strength and spread prediction
- **Offensive/Defensive ratings** for totals prediction

This dual system (`src/App.jsx:2319-2406`) generates sophisticated divergence analysis that identifies when the two models disagree, providing actionable insights like:
- "Spread May Be Too Wide"
- "Conflicting Signals"
- "High Confidence" (when models align)

**Strength:** This catches scenarios where Elo says one thing but the matchup dynamics say another—a common source of betting value.

### 2. Sport-Specific Configurations

The `sportConfig` object (`src/App.jsx:103-111`) is well-designed with sport-appropriate parameters:

| Sport | Unique Handling |
|-------|-----------------|
| **NHL** | OT/SO losers only lose 25% Elo (they get a standings point) |
| **College** | `marginCap` limits blowout impact (beating cupcakes by 40 shouldn't boost Elo too much) |
| **NBA/CBB** | Lower `ratingImpact` (0.6) reflects higher game-to-game variance |
| **NFL** | Higher `spreadMultiplier` (0.04) for accurate point spread conversion |

### 3. Monte Carlo Simulations

The simulation engine (`src/utils/simulations.js`) is well-implemented:
- Uses proper **Box-Muller transform** for normal distribution
- Includes **light positive skew** for totals (realistic for scoring distributions)
- **Caches simulation results** to avoid redundant computation
- Calculates **spread push and total push probabilities**
- Supports **percentile outputs** (10th, 50th, 90th) for confidence intervals

### 4. Conference-Based Starting Elo for College Sports

The `conferenceTiers` mapping (`src/App.jsx:664-785`) intelligently assigns starting Elo based on conference strength:

| Conference Tier | Starting Elo | Examples |
|-----------------|--------------|----------|
| Power 5 (Elite) | 1600 | Big Ten, SEC, ACC |
| High Major | 1450 | Mountain West, AAC |
| Mid Major | 1400 | MAC, A-10, MVC |
| Low Major | 1300 | MEAC, SWAC |
| Unknown | 1200 | D2/D3/NAIA |

**Strength:** This is critical for college sports where team quality varies dramatically. A first-time team from the SEC shouldn't start at the same Elo as a SWAC team.

### 5. Live Bankroll Calculation

At `src/App.jsx:2141-2146`, the model correctly calculates available bankroll:

```javascript
const liveBankroll = safeParseFloat(bankroll) + totalProfit - pendingStaked;
const maxBet = liveBankroll * 0.05; // 5% max bet cap
```

This accounts for:
- Starting bankroll
- Settled P/L
- Pending stakes as **money already at risk**

**Strength:** Many models ignore pending bets, leading to over-betting. This is a sophisticated bankroll management approach.

### 6. Kelly Criterion with Caps

The `kellyStakeCapped` function (`src/utils/calculations.js:108-116`) properly:
- Applies **fractional Kelly** (default 25% to reduce variance)
- Caps maximum bet at **5% of live bankroll** (prevents ruin scenarios)
- Returns both **capped and raw amounts** for transparency
- Ensures non-negative stakes (no shorting)

### 7. Robust Duplicate Detection

The `isDuplicateGame` function (`src/App.jsx:886-900`) handles:
- Both team orderings (home/away can be swapped)
- Exact score matching
- Prevents double-importing games from ESPN

### 8. Comprehensive Divergence Analysis

The model generates 12 different insight types (`src/App.jsx:2348-2538`):

| Insight | Condition | Recommendation |
|---------|-----------|----------------|
| Spread May Be Too Wide | Elo big favorite, Off/Def close | Fade spread/take underdog |
| Potential Spread Value | Elo close, Off/Def blowout | Take favorite |
| Conflicting Signals | Models disagree on winner | Smaller bets or pass |
| Over Lean | Off/Def total > league avg | Check if book reflects |
| Under Lean | Off/Def total < league avg | Check if book is inflated |
| Shootout Alert | Both teams above avg scoring | Over-friendly |
| Defensive Battle | Both teams below avg scoring | Under-friendly |
| Strength vs Strength | Elite offense vs elite defense | Watch game script |
| Dominant Matchup | One team superior in both | Consider ML |
| High Variance | Large Elo gap, similar tendencies | Underdog ML value |
| High Confidence | Both models strongly agree | Higher conviction bet |
| Margin Disagreement | Same winner, different magnitude | Adjust expectations |

---

## Areas for Logic Improvement

### 1. Elo K-Factor Is Static

**Current:** Fixed `kFactor` per sport (e.g., 20 for NFL/NBA)

**Issue:** Early-season games should have higher K-factor when ratings are less reliable, and late-season games should have lower K-factor when ratings have stabilized.

**Recommendation:** Implement dynamic K-factor that decreases based on games played:
```javascript
const getDynamicK = (baseK, gamesPlayed) => {
  // Higher K early season, lower as confidence builds
  return baseK * Math.max(0.6, 1.5 - (gamesPlayed / 50));
};
```

### 2. Margin of Victory Scaling Could Be More Sport-Specific

**Current** (`src/App.jsx:416`):
```javascript
Math.min(Math.log(mov * (c.marginMult || 1) + 1) * 0.8 + 1, 2.5)
```

**Issue:**
- The 2.5x cap is arbitrary
- Logarithmic scaling may not be optimal for all sports
- NHL goals have much higher variance impact than NBA points
- Key NFL numbers (3, 7, 10) have special significance

**Recommendation:** Sport-specific MOV functions with empirically-derived parameters.

### 3. Off/Def Rating Updates Are Linear

**Current** (`src/App.jsx:432-436`): Uses fixed `offScale = 0.3`

**Issue:** A team scoring 10 points above expected once doesn't tell us much, but consistently scoring 10 above average is significant. Single-game outliers can distort ratings.

**Recommendation:** Consider exponential moving average or confidence-weighted updates:
```javascript
const offScale = 0.3 / Math.sqrt(gamesPlayed + 1); // Decreases with more data
```

### 4. Regression to Mean Only for Basketball

**Current** (`src/App.jsx:384-389`): `regressRating()` only applies to NBA/CBB

**Issue:** NFL and NHL also suffer from rating drift over a season. Without regression, ratings can drift toward extremes after streaky periods.

**Recommendation:** Apply sport-appropriate regression for all sports with different rates:
- NBA/CBB: 7.5% (current, high volume)
- NHL: 5% (medium volume)
- NFL: 3% (low volume, each game matters more)

### 5. Home Advantage Is Static

**Current:** Fixed home advantage per sport (e.g., 48 Elo points for NFL)

**Issue:** Home advantage varies significantly by:
- **Team:** Some teams have notoriously tough home environments (Seahawks, Saints)
- **Altitude:** Denver teams have measurable advantages
- **Travel distance:** Cross-country trips affect performance
- **Time zones:** West Coast teams playing early East Coast games struggle
- **Rest differential:** Short week vs long week affects fatigue

**Recommendation:** Team-specific home advantage modifiers or travel-distance adjustments.

### 6. No Recency Weighting

**Current:** All games in the season have equal weight

**Issue:** Games from week 1 have the same weight as games from last week. Recent performance is often more predictive than early-season games, especially after:
- Roster changes
- Injuries
- Scheme adjustments
- Coaching changes

**Recommendation:** Time-decay on Elo changes or separate "hot streak" indicators.

### 7. Spread Probability Assumes Normal Distribution

**Current** (`src/utils/calculations.js:125-140`): Uses normal CDF via error function approximation

**Issue:**
- Real sports margins have **fatter tails** than normal distribution (more blowouts and close games than expected)
- **Key numbers** (3, 7, 10 in NFL; 1, 2 in NHL) are not accounted for
- Normal distribution underestimates push probability on common numbers

**Recommendation:** Use mixture distributions or empirically-derived CDF for each sport.

### 8. Context Adjustments Are Manual

**Current:** Users manually input injury/rest/motivation via sliders

**Issue:** This introduces human bias and requires users to have knowledge the model should provide.

**Recommendation:** Integrate injury APIs (ESPN Injury Reports, RotoBaller, etc.) to auto-populate injury adjustments. The AI Insights feature starts this, but full automation would improve consistency.

---

## Complete Feature List

### Core Analysis Features

| Feature | Description | Location |
|---------|-------------|----------|
| **Matchup Analysis** | Elo-based win probability, spread, and total predictions | `analyzeMatchup()` |
| **Context Adjustments** | Injury, rest, and motivation sliders modify Elo | State hooks |
| **EV Calculation** | Expected value for ML, spread, and totals | `calculateEV()` |
| **Kelly Criterion** | Stake sizing with fractional Kelly and caps | `kellyStakeCapped()` |
| **Monte Carlo Simulation** | Optional simulation-based probabilities | `runScoreSimulations()` |
| **Divergence Analysis** | 12 insight types comparing Elo vs Off/Def | `analyzeMatchup()` |
| **Confidence Tiers** | 5-star rating system for bet quality | `getConfidenceTier()` |

### Data Integration

| Feature | Description |
|---------|-------------|
| **AI Insights** | OpenRouter API integration for injury reports and analysis |
| **Web Search** | Optional live data fetching ($0.02/request) |
| **Today's Games Picker** | ESPN API integration for quick game selection |
| **ESPN Import** | Bulk import completed games by date |
| **Full Season Import** | Import entire season's results |
| **NCAA API** | D3 sports integration |

### Tracking & Management

| Feature | Description |
|---------|-------------|
| **Bet Tracker** | Log bets with outcome tracking |
| **Performance Stats** | Win rate, ROI, units, P&L dashboard |
| **Team Management** | Add, edit, delete teams; reset to baseline |
| **Game Log** | Full history with rating changes |
| **CSV Export** | Export bet history |
| **localStorage Persistence** | All data saved locally |

### Multi-Sport Support

| Sport | Unique Features |
|-------|-----------------|
| **NFL** | 2025 season, 32 teams |
| **NBA** | 2025-26 season, 30 teams, lower ratingImpact |
| **NHL** | OT/SO handling, marginMult for goals |
| **CFB** | Conference tiering, marginCap for blowouts |
| **CBB** | Conference tiering, 50-game import groups |
| **D3 Basketball** | NCAA API, lower home advantage |

---

## P1 Feature Recommendation: Closing Line Value (CLV) Tracking

### Why This Is P1

**Closing Line Value is the single most important metric for measuring long-term betting edge.**

Research consistently shows that:
- **Beating the closing line is more predictive of success than win rate**
- Professional bettors with 48% win rate but positive CLV are profitable
- Recreational bettors with 55% win rate but negative CLV will eventually lose

The model already has:
- Opening odds input (current book odds)
- Bet tracker with outcome tracking

What's missing is **capturing the closing line and calculating CLV**.

### What CLV Tells You

| Scenario | CLV | Outcome | Interpretation |
|----------|-----|---------|----------------|
| Model finds +EV | Positive | Won | Model works, confirmed by market |
| Model finds +EV | Positive | Lost | Model works, variance happened |
| Model finds +EV | Negative | Won | Got lucky, market disagreed |
| Model finds +EV | Negative | Lost | Model was wrong, market was right |

### Implementation Details

1. **Add `closingOdds` field to bet tracker** (`src/App.jsx:60-70`):
```javascript
const [newBet, setNewBet] = useState({
  date: new Date().toISOString().split('T')[0],
  sport: 'nfl',
  game: '',
  betType: 'ML',
  pick: '',
  odds: '',        // Opening odds (when bet was placed)
  closingOdds: '', // NEW: Closing odds (at game start)
  stake: '',
  result: 'pending',
  payout: 0
});
```

2. **Calculate CLV for each bet**:
```javascript
const calculateCLV = (openingOdds, closingOdds) => {
  if (!closingOdds) return null;
  const openProb = americanToImpliedProb(openingOdds);
  const closeProb = americanToImpliedProb(closingOdds);
  return (closeProb - openProb) * 100; // CLV in percentage points
};
```

3. **Add CLV stats to dashboard**:
   - Average CLV per bet type (ML, spread, total)
   - CLV by sport
   - CLV distribution histogram
   - Correlation between model EV and actual CLV

4. **CLV validation alerts**:
   - Flag bets where model showed +EV but CLV was negative
   - Highlight bets with strong CLV confirmation

### Why CLV Matters for This Model

- **Model Validation**: CLV tells you if Atmospheric Edge is actually finding value, not just getting lucky
- **Refinement Guidance**:
  - Positive CLV + negative results = variance (stay the course)
  - Negative CLV = model needs calibration
- **Confidence Indicator**: Bets with high model EV but negative CLV are red flags
- **Market Efficiency Gauge**: Track how quickly lines move toward your model's prediction

### Implementation Complexity

**Low-Medium**:
- Adding one field to the bet object
- One new calculation function
- UI additions to bet entry form
- Stats dashboard updates
- No changes to core Elo/prediction logic

### Expected User Workflow

1. Place bet, enter opening odds as usual
2. Before game starts, return to bet entry and add closing odds
3. After result, view CLV analysis alongside outcome
4. Review aggregate CLV stats to validate model performance

This feature transforms the bet tracker from a simple record-keeper into a **model validation tool** that helps users understand if they're actually beating the market.

---

## Implementation Details for Each Improvement

### 1. Dynamic K-Factor

**Difficulty: Easy** ⭐

**Current Code** (`src/App.jsx:416`):
```javascript
const baseEloChange = Math.round(c.kFactor * Math.min(Math.log(mov * (c.marginMult || 1) + 1)*0.8+1, 2.5) * (1-exp));
```

**Required Changes:**

1. Add `gamesPlayed` to team object in initial teams (`src/App.jsx:122-230`):
```javascript
'New England Patriots': { elo: 1680, off: 108, def: 88, gamesPlayed: 0 },
```

2. Create dynamic K function (add to `src/utils/calculations.js`):
```javascript
export const getDynamicK = (baseK, gamesPlayed) => {
  // K starts at 1.5x base, decays to 0.6x base over ~50 games
  return baseK * Math.max(0.6, 1.5 - (gamesPlayed / 50));
};
```

3. Update `updateRatings()` and `importSelectedGames()` to use dynamic K:
```javascript
const avgGamesPlayed = (t1.gamesPlayed + t2.gamesPlayed) / 2;
const dynamicK = getDynamicK(c.kFactor, avgGamesPlayed);
const baseEloChange = Math.round(dynamicK * Math.min(...));
```

4. Increment `gamesPlayed` when updating teams:
```javascript
[resultTeam1]: {
  ...prev[resultTeam1],
  elo: prev[resultTeam1].elo + t1EloChange,
  gamesPlayed: (prev[resultTeam1].gamesPlayed || 0) + 1,
  // ...
}
```

**Files Changed:** 2 (`App.jsx`, `calculations.js`)
**Lines Changed:** ~20

---

### 2. Margin of Victory Sport-Specific Scaling

**Difficulty: Medium** ⭐⭐

**Current Code** (`src/App.jsx:416`):
```javascript
Math.min(Math.log(mov * (c.marginMult || 1) + 1) * 0.8 + 1, 2.5)
```

**Required Changes:**

1. Add MOV function to `sportConfig` (`src/App.jsx:103-111`):
```javascript
nfl: {
  // ... existing config
  movScale: (mov) => {
    // NFL: Key numbers at 3, 7, 10 - winning by 3 is more common than 4
    if (mov <= 3) return 1.0;
    if (mov <= 7) return 1.0 + (mov - 3) * 0.15;
    if (mov <= 14) return 1.6 + (mov - 7) * 0.1;
    return Math.min(2.3, 2.3 + (mov - 14) * 0.02);
  }
},
nhl: {
  movScale: (mov) => {
    // NHL: Each goal is huge, but cap at 4 goals
    return Math.min(2.5, 1.0 + mov * 0.5);
  }
}
```

2. Update Elo calculation:
```javascript
const movMultiplier = c.movScale ? c.movScale(mov) : Math.min(Math.log(mov * (c.marginMult || 1) + 1) * 0.8 + 1, 2.5);
const baseEloChange = Math.round(c.kFactor * movMultiplier * (1 - exp));
```

**Files Changed:** 1 (`App.jsx`)
**Lines Changed:** ~30

---

### 3. Confidence-Weighted Off/Def Updates

**Difficulty: Easy** ⭐

**Current Code** (`src/App.jsx:432`):
```javascript
const offScale = 0.3;
```

**Required Changes:**

1. Calculate dynamic scale based on games played:
```javascript
const t1Games = t1.gamesPlayed || 0;
const t2Games = t2.gamesPlayed || 0;
// Scale decreases as we have more data (more confident in current ratings)
const offScale1 = 0.3 / Math.sqrt(t1Games / 5 + 1);
const offScale2 = 0.3 / Math.sqrt(t2Games / 5 + 1);

const t1OffDiff = Math.round((s1 - exp1) * offScale1);
const t2OffDiff = Math.round((s2 - exp2) * offScale2);
const t1DefDiff = Math.round((exp2 - s2) * offScale1);
const t2DefDiff = Math.round((exp1 - s1) * offScale2);
```

**Files Changed:** 1 (`App.jsx`)
**Lines Changed:** ~10

---

### 4. Regression to Mean for All Sports

**Difficulty: Easy** ⭐

**Current Code** (`src/App.jsx:384-389`):
```javascript
const regressRating = (val, sp) => {
  if (sp === 'nba' || sp === 'cbb') {
    const regressed = val * 0.925 + 100 * 0.075;
    return Math.round(Math.max(80, Math.min(120, regressed)));
  }
  return Math.round(val);
};
```

**Required Changes:**

```javascript
const regressRating = (val, sp) => {
  const regressionRates = {
    nba: 0.075,  // 7.5% - high volume, many games
    cbb: 0.075,
    nhl: 0.05,   // 5% - medium volume
    nfl: 0.03,   // 3% - low volume, each game matters
    cfb: 0.03,
    d3mb: 0.06,
    d3wb: 0.06,
  };

  const rate = regressionRates[sp] || 0;
  if (rate === 0) return Math.round(val);

  const regressed = val * (1 - rate) + 100 * rate;

  // Tighter bounds for basketball
  const bounds = (sp === 'nba' || sp === 'cbb' || sp === 'd3mb' || sp === 'd3wb')
    ? [80, 120]
    : [70, 130];

  return Math.round(Math.max(bounds[0], Math.min(bounds[1], regressed)));
};
```

**Files Changed:** 1 (`App.jsx`)
**Lines Changed:** ~15

---

### 5. Team-Specific Home Advantage

**Difficulty: Medium** ⭐⭐

**Current Code** (`src/App.jsx:2136`):
```javascript
const ha = isNeutral ? 0 : c.homeAdvantage;
```

**Required Changes:**

1. Add `homeBonus` to team objects:
```javascript
'Denver Broncos': { elo: 1660, off: 95, def: 84, homeBonus: 10 },  // Altitude
'Seattle Seahawks': { elo: 1610, off: 108, def: 94, homeBonus: 8 }, // 12th Man
```

2. Update home advantage calculation:
```javascript
const teamHomeBonus = teams[team1]?.homeBonus || 0;
const ha = isNeutral ? 0 : (c.homeAdvantage + teamHomeBonus);
```

3. (Optional) Add travel distance factor:
```javascript
// Add lat/long to teams, calculate distance for cross-country games
const travelPenalty = calculateTravelPenalty(teams[team2], teams[team1]);
const ha = isNeutral ? 0 : (c.homeAdvantage + teamHomeBonus - travelPenalty);
```

**Files Changed:** 1 (`App.jsx`)
**Lines Changed:** ~20-50 depending on travel implementation

---

### 6. Recency Weighting

**Difficulty: Medium-Hard** ⭐⭐⭐

**Issue:** This requires storing timestamps with games and applying decay.

**Required Changes:**

1. Add timestamp to game log entries (`src/App.jsx:459-468`):
```javascript
setGameLog(prev => [...prev, {
  date: new Date().toLocaleDateString(),
  timestamp: Date.now(),  // NEW: Unix timestamp for decay calculation
  // ... rest of fields
}]);
```

2. Create recency multiplier function:
```javascript
const getRecencyMultiplier = (gameTimestamp, currentTimestamp) => {
  const daysAgo = (currentTimestamp - gameTimestamp) / (1000 * 60 * 60 * 24);
  const halfLife = 30; // Games lose half their weight after 30 days
  return Math.pow(0.5, daysAgo / halfLife);
};
```

3. Apply to Elo calculation:
```javascript
const recency = getRecencyMultiplier(gameTimestamp, Date.now());
const baseEloChange = Math.round(c.kFactor * movMultiplier * (1 - exp) * recency);
```

**Challenge:** The `deleteGameFromLog` function recalculates all ratings from scratch. This would need to apply recency at recalculation time, which is complex.

**Alternative (Easier):** Add a "form" indicator that tracks last 5 games separately from Elo, displayed in UI but not affecting core Elo.

**Files Changed:** 1 (`App.jsx`)
**Lines Changed:** ~40

---

### 7. Non-Normal Spread Distribution

**Difficulty: Hard** ⭐⭐⭐⭐

**Current Code** (`src/utils/calculations.js:125-140`):
```javascript
export const spreadCoverProb = (pred, book, sportConfig) => {
  const diff = safeParseFloat(book) - pred;
  const z = diff / (sportConfig.scoringVar * Math.sqrt(2));
  // ... normal CDF via erf()
};
```

**Required Changes:**

1. Create empirical distribution lookup for NFL key numbers:
```javascript
// Based on historical margin distributions
const nflMarginProbs = {
  // probability mass at each margin (from historical data)
  0: 0.005, 1: 0.025, 2: 0.030, 3: 0.095, 4: 0.040, 5: 0.035,
  6: 0.055, 7: 0.080, 8: 0.030, 9: 0.020, 10: 0.055, // ... etc
};

export const spreadCoverProbNFL = (pred, book) => {
  // Use empirical CDF instead of normal
  let coverProb = 0;
  for (let margin = -50; margin <= 50; margin++) {
    const adjustedMargin = margin - pred;
    if (adjustedMargin + book > 0) {
      coverProb += nflMarginProbs[Math.abs(margin)] || 0.01;
    }
  }
  return coverProb;
};
```

2. Update `spreadCoverProb` to dispatch by sport:
```javascript
export const spreadCoverProb = (pred, book, sportConfig, sport) => {
  if (sport === 'nfl') return spreadCoverProbNFL(pred, book);
  if (sport === 'nhl') return spreadCoverProbNHL(pred, book);
  // ... fallback to normal distribution
};
```

**Challenge:** Requires sourcing historical margin distribution data for each sport.

**Files Changed:** 1 (`calculations.js`)
**Lines Changed:** ~100+

---

### 8. CLV Tracking (P1 Feature)

**Difficulty: Low-Medium** ⭐⭐

**Required Changes:**

#### Step 1: Update bet state (`src/App.jsx:60-70`)

```javascript
const [newBet, setNewBet] = useState({
  date: new Date().toISOString().split('T')[0],
  sport: 'nfl',
  game: '',
  betType: 'ML',
  pick: '',
  odds: '',
  closingOdds: '',  // NEW
  stake: '',
  result: 'pending',
  payout: 0
});
```

#### Step 2: Add CLV calculation (`src/utils/calculations.js`)

```javascript
/**
 * Calculate Closing Line Value
 * Positive CLV = you beat the closing line (good)
 * Negative CLV = market moved against you (bad)
 */
export const calculateCLV = (openingOdds, closingOdds) => {
  if (!closingOdds || closingOdds === '') return null;
  const openProb = americanToImpliedProb(openingOdds);
  const closeProb = americanToImpliedProb(closingOdds);
  // CLV in percentage points
  return (closeProb - openProb) * 100;
};
```

#### Step 3: Update `calculateStats()` (`src/App.jsx:2121-2132`)

```javascript
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

  // NEW: CLV statistics
  const betsWithCLV = settled.filter(b => b.closingOdds && b.closingOdds !== '');
  const clvValues = betsWithCLV.map(b => calculateCLV(b.odds, b.closingOdds));
  const avgCLV = clvValues.length > 0
    ? clvValues.reduce((sum, c) => sum + c, 0) / clvValues.length
    : null;
  const positiveCLV = clvValues.filter(c => c > 0).length;
  const negativeCLV = clvValues.filter(c => c < 0).length;

  return {
    wins, losses, pushes, totalStaked, totalProfit, roi, winRate, units,
    pending: bets.filter(b => b.result === 'pending').length,
    // NEW CLV stats
    avgCLV,
    clvCount: betsWithCLV.length,
    positiveCLV,
    negativeCLV,
    clvWinRate: betsWithCLV.length > 0 ? (positiveCLV / betsWithCLV.length) * 100 : null
  };
};
```

#### Step 4: Add UI input for closing odds (`src/App.jsx:3223-3230`)

Add after the "Odds" input:
```javascript
<div>
  <label className={labelStyle}>Closing</label>
  <input
    type="text"
    value={newBet.closingOdds}
    onChange={(e) => setNewBet({...newBet, closingOdds: e.target.value})}
    placeholder="-115"
    className={inputStyle}
  />
</div>
```

#### Step 5: Add CLV to stats dashboard (`src/App.jsx:3207-3215`)

Add after ROI display:
```javascript
{stats.avgCLV !== null && (
  <div className={`rounded-lg p-3 text-center ${stats.avgCLV >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
    <p className="text-xs text-gray-500">Avg CLV</p>
    <p className={`font-bold text-lg ${stats.avgCLV >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
      {stats.avgCLV >= 0 ? '+' : ''}{stats.avgCLV.toFixed(2)}%
    </p>
  </div>
)}
{stats.clvWinRate !== null && (
  <div className="bg-white rounded-lg p-3 text-center">
    <p className="text-xs text-gray-500">CLV Win%</p>
    <p className="font-bold text-lg">{stats.clvWinRate.toFixed(0)}%</p>
  </div>
)}
```

#### Step 6: Add CLV column to bet history table

In the bet history section, add CLV display:
```javascript
{bet.closingOdds && (
  <span className={`text-xs ${calculateCLV(bet.odds, bet.closingOdds) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
    CLV: {calculateCLV(bet.odds, bet.closingOdds) >= 0 ? '+' : ''}
    {calculateCLV(bet.odds, bet.closingOdds).toFixed(1)}%
  </span>
)}
```

**Files Changed:** 2 (`App.jsx`, `calculations.js`)
**Lines Changed:** ~50-70

---

## Implementation Priority Summary

| Improvement | Difficulty | Impact | Recommended Order |
|-------------|------------|--------|-------------------|
| **CLV Tracking** | ⭐⭐ Low-Medium | High | 1st - Validates model |
| **Regression for All Sports** | ⭐ Easy | Medium | 2nd - Quick win |
| **Dynamic K-Factor** | ⭐ Easy | Medium | 3rd - Quick win |
| **Confidence-Weighted Off/Def** | ⭐ Easy | Low | 4th - Quick win |
| **Team-Specific Home Advantage** | ⭐⭐ Medium | Medium | 5th |
| **Sport-Specific MOV** | ⭐⭐ Medium | Low | 6th |
| **Recency Weighting** | ⭐⭐⭐ Medium-Hard | Medium | 7th |
| **Non-Normal Distributions** | ⭐⭐⭐⭐ Hard | High | 8th - Research needed |

---

## Conclusion

Atmospheric Edge is a well-designed sports betting model with:
- ✅ Solid theoretical foundations (Elo, Kelly, EV)
- ✅ Sophisticated dual-model analysis
- ✅ Good sport-specific handling
- ✅ Clean Monte Carlo implementation
- ✅ Thoughtful bankroll management

**Key areas for improvement:**
1. Dynamic K-factor for Elo updates
2. Recency weighting for game results
3. Non-normal distributions for spread/total probabilities
4. **CLV tracking (P1 recommendation)**

The recommended P1 feature (CLV tracking) would provide the validation layer needed to determine if the model's predictions are actually finding market inefficiencies.
