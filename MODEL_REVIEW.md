# Atmospheric Edge - Sports Betting Model Review

**Reviewed by:** Claude (AI Sports Betting Model Expert)
**Date:** December 24, 2025 (Updated)

---

## Executive Summary

Atmospheric Edge is a well-designed sports betting analytics application that uses Elo ratings and offensive/defensive metrics to evaluate matchups and calculate expected value (EV) for betting opportunities. The model demonstrates sophisticated understanding of sports betting fundamentals while maintaining usability.

---

## Recently Implemented Features

The following features have been added based on earlier review recommendations:

| Feature | Status | Description |
|---------|--------|-------------|
| **CLV Tracking** | ✅ Implemented | Closing Line Value tracking with average CLV stats, CLV per bet display, and model validation metrics |
| **Dynamic K-Factor** | ✅ Implemented | K-factor starts at 1.5x base and decays to 0.6x over ~50 games for faster early-season calibration |
| **Confidence-Weighted Off/Def** | ✅ Implemented | Off/def update scale decreases as more games are played (0.3 / sqrt(games/5 + 1)) |
| **Games Played Tracking** | ✅ Implemented | Derived from game log automatically, with "Copy GP" debug button |

---

## What the Model Does Well

### 1. Dual Prediction System (Elo + Off/Def)

The model intelligently uses two complementary approaches:
- **Elo ratings** for overall team strength and spread prediction
- **Offensive/Defensive ratings** for totals prediction

This dual system generates sophisticated divergence analysis that identifies when the two models disagree, providing actionable insights like:
- "Spread May Be Too Wide"
- "Conflicting Signals"
- "High Confidence" (when models align)

**Strength:** This catches scenarios where Elo says one thing but the matchup dynamics say another—a common source of betting value.

### 2. Sport-Specific Configurations

The `sportConfig` object is well-designed with sport-appropriate parameters:

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

The `conferenceTiers` mapping intelligently assigns starting Elo based on conference strength:

| Conference Tier | Starting Elo | Examples |
|-----------------|--------------|----------|
| Power 5 (Elite) | 1600 | Big Ten, SEC, ACC |
| High Major | 1450 | Mountain West, AAC |
| Mid Major | 1400 | MAC, A-10, MVC |
| Low Major | 1300 | MEAC, SWAC |
| Unknown | 1200 | D2/D3/NAIA |

**Strength:** This is critical for college sports where team quality varies dramatically.

### 5. Live Bankroll Calculation

The model correctly calculates available bankroll:

```javascript
const liveBankroll = safeParseFloat(bankroll) + totalProfit - pendingStaked;
const maxBet = liveBankroll * 0.05; // 5% max bet cap
```

This accounts for:
- Starting bankroll
- Settled P/L
- Pending stakes as **money already at risk**

**Strength:** Many models ignore pending bets, leading to over-betting.

### 6. Kelly Criterion with Caps

The `kellyStakeCapped` function properly:
- Applies **fractional Kelly** (default 25% to reduce variance)
- Caps maximum bet at **5% of live bankroll** (prevents ruin scenarios)
- Returns both **capped and raw amounts** for transparency
- Ensures non-negative stakes (no shorting)

### 7. Robust Duplicate Detection

The `isDuplicateGame` function handles:
- Both team orderings (home/away can be swapped)
- Exact score matching
- Prevents double-importing games from ESPN

### 8. Comprehensive Divergence Analysis

The model generates 12 different insight types:

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

## Remaining Areas for Improvement

### 1. Margin of Victory Scaling Could Be More Sport-Specific

**Current** (`src/App.jsx`):
```javascript
Math.min(Math.log(mov * (c.marginMult || 1) + 1) * 0.8 + 1, 2.5)
```

**Issue:**
- The 2.5x cap is arbitrary
- Logarithmic scaling may not be optimal for all sports
- NHL goals have much higher variance impact than NBA points
- Key NFL numbers (3, 7, 10) have special significance

**Recommendation:** Sport-specific MOV functions with empirically-derived parameters.

### 2. Regression to Mean Only for Basketball

**Current:** `regressRating()` only applies to NBA/CBB

**Issue:** NFL and NHL also suffer from rating drift over a season. Without regression, ratings can drift toward extremes after streaky periods.

**Recommendation:** Apply sport-appropriate regression for all sports with different rates:
- NBA/CBB: 7.5% (current, high volume)
- NHL: 5% (medium volume)
- NFL: 3% (low volume, each game matters more)

### 3. Home Advantage Is Static

**Current:** Fixed home advantage per sport (e.g., 48 Elo points for NFL)

**Issue:** Home advantage varies significantly by:
- **Team:** Some teams have notoriously tough home environments (Seahawks, Saints)
- **Altitude:** Denver teams have measurable advantages
- **Travel distance:** Cross-country trips affect performance
- **Time zones:** West Coast teams playing early East Coast games struggle
- **Rest differential:** Short week vs long week affects fatigue

**Recommendation:** Team-specific home advantage modifiers or travel-distance adjustments.

### 4. No Recency Weighting

**Current:** All games in the season have equal weight

**Issue:** Games from week 1 have the same weight as games from last week. Recent performance is often more predictive than early-season games, especially after:
- Roster changes
- Injuries
- Scheme adjustments
- Coaching changes

**Recommendation:** Time-decay on Elo changes or separate "hot streak" indicators.

### 5. Spread Probability Assumes Normal Distribution

**Current:** Uses normal CDF via error function approximation

**Issue:**
- Real sports margins have **fatter tails** than normal distribution (more blowouts and close games than expected)
- **Key numbers** (3, 7, 10 in NFL; 1, 2 in NHL) are not accounted for
- Normal distribution underestimates push probability on common numbers

**Recommendation:** Use mixture distributions or empirically-derived CDF for each sport.

### 6. Context Adjustments Are Manual

**Current:** Users manually input injury/rest/motivation via sliders

**Issue:** This introduces human bias and requires users to have knowledge the model should provide.

**Recommendation:** Integrate injury APIs (ESPN Injury Reports, RotoBaller, etc.) to auto-populate injury adjustments.

---

## Complete Feature List

### Core Analysis Features

| Feature | Description |
|---------|-------------|
| **Matchup Analysis** | Elo-based win probability, spread, and total predictions |
| **Context Adjustments** | Injury, rest, and motivation sliders modify Elo |
| **EV Calculation** | Expected value for ML, spread, and totals |
| **Kelly Criterion** | Stake sizing with fractional Kelly and caps |
| **Monte Carlo Simulation** | Optional simulation-based probabilities |
| **Divergence Analysis** | 12 insight types comparing Elo vs Off/Def |
| **Confidence Tiers** | 5-star rating system for bet quality |
| **Dynamic K-Factor** | ✅ Higher K early season, lower as confidence builds |
| **Confidence-Weighted Updates** | ✅ Off/def adjustments decrease with more data |
| **CLV Tracking** | ✅ Closing line value tracking and validation |

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
| **CLV Stats** | ✅ Average CLV, CLV win rate, per-bet CLV display |
| **Performance Stats** | Win rate, ROI, units, P&L dashboard |
| **Team Management** | Add, edit, delete teams; reset to baseline |
| **Game Log** | Full history with rating changes |
| **Games Played Debug** | ✅ Copy GP button to export games played per team |
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

## Implementation Details for Remaining Improvements

### 1. Margin of Victory Sport-Specific Scaling

**Difficulty: Medium** ⭐⭐

**Required Changes:**

1. Add MOV function to `sportConfig`:
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
const baseEloChange = Math.round(dynamicK * movMultiplier * (1 - exp));
```

**Files Changed:** 1 (`App.jsx`)
**Lines Changed:** ~30

---

### 2. Regression to Mean for All Sports

**Difficulty: Easy** ⭐

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

### 3. Team-Specific Home Advantage

**Difficulty: Medium** ⭐⭐

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

### 4. Recency Weighting

**Difficulty: Medium-Hard** ⭐⭐⭐

**Required Changes:**

1. Add timestamp to game log entries:
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
const baseEloChange = Math.round(dynamicK * movMultiplier * (1 - exp) * recency);
```

**Challenge:** The `deleteGameFromLog` function recalculates all ratings from scratch. This would need to apply recency at recalculation time, which is complex.

**Alternative (Easier):** Add a "form" indicator that tracks last 5 games separately from Elo, displayed in UI but not affecting core Elo.

**Files Changed:** 1 (`App.jsx`)
**Lines Changed:** ~40

---

### 5. Non-Normal Spread Distribution

**Difficulty: Hard** ⭐⭐⭐⭐

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

## Implementation Priority Summary

| Improvement | Difficulty | Impact | Recommended Order |
|-------------|------------|--------|-------------------|
| **Regression for All Sports** | ⭐ Easy | Medium | 1st - Quick win |
| **Team-Specific Home Advantage** | ⭐⭐ Medium | Medium | 2nd |
| **Sport-Specific MOV** | ⭐⭐ Medium | Low | 3rd |
| **Recency Weighting** | ⭐⭐⭐ Medium-Hard | Medium | 4th |
| **Non-Normal Distributions** | ⭐⭐⭐⭐ Hard | High | 5th - Research needed |

---

## Conclusion

Atmospheric Edge is a well-designed sports betting model with:
- ✅ Solid theoretical foundations (Elo, Kelly, EV)
- ✅ Sophisticated dual-model analysis
- ✅ Good sport-specific handling
- ✅ Clean Monte Carlo implementation
- ✅ Thoughtful bankroll management
- ✅ **Dynamic K-factor for Elo updates** (NEW)
- ✅ **Confidence-weighted off/def updates** (NEW)
- ✅ **CLV tracking for model validation** (NEW)

**Remaining areas for improvement:**
1. Regression to mean for all sports (not just basketball)
2. Team-specific home advantage modifiers
3. Recency weighting for game results
4. Non-normal distributions for spread/total probabilities
5. Automated injury data integration

The model now includes the critical CLV tracking feature, providing the validation layer needed to determine if predictions are actually finding market inefficiencies.
