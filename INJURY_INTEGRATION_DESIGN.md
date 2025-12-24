# Automated Injury Data Integration Design

## Overview

This document outlines a comprehensive approach to integrate automated injury data into Atmospheric Edge, replacing manual slider adjustments with real-time data from ESPN's injury API.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         User Interface                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ Injury Report   │  │ Auto-Populated   │  │ Override Controls      │  │
│  │ Panel           │  │ Sliders          │  │ (Manual Adjustment)    │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────────┬───────────┘  │
└───────────┼─────────────────────┼──────────────────────────┼────────────┘
            │                     │                          │
            ▼                     ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Impact Calculator                                   │
│  ┌──────────────────┐  ┌───────────────────┐  ┌─────────────────────┐   │
│  │ Position Weights │  │ Status Multiplier │  │ Depth Chart Factor  │   │
│  │ QB: 1.0          │  │ Out: 1.0          │  │ Starter: 1.0        │   │
│  │ RB: 0.5          │  │ Doubtful: 0.8     │  │ 2nd String: 0.4     │   │
│  │ WR1: 0.4         │  │ Questionable: 0.5 │  │ 3rd String: 0.1     │   │
│  └──────────────────┘  └───────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Layer                                        │
│  ┌──────────────────┐  ┌───────────────────┐  ┌─────────────────────┐   │
│  │ ESPN Injury API  │  │ Injury Cache      │  │ Team ID Mapping     │   │
│  │ Fetcher          │  │ (localStorage)    │  │ Dictionary          │   │
│  └──────────────────┘  └───────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. ESPN Injury API Integration

### API Endpoints

```javascript
const injuryEndpoints = {
  nfl: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/{teamId}/injuries?limit=100',
  nba: 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/teams/{teamId}/injuries?limit=100',
  nhl: 'https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/teams/{teamId}/injuries?limit=100',
  cfb: 'https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/teams/{teamId}/injuries?limit=100',
  cbb: 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/teams/{teamId}/injuries?limit=100'
};
```

### Expected Response Structure

```javascript
// ESPN Injury API Response (inferred from similar endpoints)
{
  "count": 5,
  "items": [
    {
      "$ref": "https://sports.core.api.espn.com/v2/.../injuries/12345"
    }
  ]
}

// Individual Injury Detail (after following $ref)
{
  "id": "12345",
  "athlete": {
    "$ref": "https://sports.core.api.espn.com/v2/.../athletes/4040715"
  },
  "status": "Out",           // Out, Doubtful, Questionable, Day-To-Day, IR
  "type": {
    "name": "Knee",
    "description": "ACL Tear"
  },
  "details": {
    "returnDate": "2025-12-31",
    "comment": "Expected to miss 4-6 weeks"
  }
}
```

### Fetch Function Implementation

```javascript
/**
 * Fetch injury data for a specific team
 * @param {string} sport - Sport key (nfl, nba, nhl, cfb, cbb)
 * @param {number} teamId - ESPN team ID
 * @returns {Promise<Array>} Array of injury objects
 */
const fetchTeamInjuries = async (sport, teamId) => {
  const endpoint = injuryEndpoints[sport].replace('{teamId}', teamId);

  try {
    // First, get the list of injury references
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return [];
    }

    // Fetch each injury detail (parallel requests)
    const injuryDetails = await Promise.all(
      data.items.map(async (item) => {
        try {
          const detailRes = await fetch(item.$ref);
          const detail = await detailRes.json();

          // Also fetch athlete info if needed
          let athleteInfo = {};
          if (detail.athlete?.$ref) {
            const athleteRes = await fetch(detail.athlete.$ref);
            athleteInfo = await athleteRes.json();
          }

          return {
            id: detail.id,
            player: athleteInfo.displayName || 'Unknown',
            position: athleteInfo.position?.abbreviation || 'UNK',
            status: detail.status || 'Unknown',
            injury: detail.type?.description || detail.type?.name || 'Undisclosed',
            returnDate: detail.details?.returnDate,
            comment: detail.details?.comment
          };
        } catch (err) {
          console.warn('Failed to fetch injury detail:', err);
          return null;
        }
      })
    );

    return injuryDetails.filter(Boolean);
  } catch (error) {
    console.error(`Failed to fetch injuries for ${sport} team ${teamId}:`, error);
    return [];
  }
};
```

---

## 2. Team ID Mapping

### NFL Team IDs

```javascript
const nflTeamIds = {
  'Arizona Cardinals': 22,
  'Atlanta Falcons': 1,
  'Baltimore Ravens': 33,
  'Buffalo Bills': 2,
  'Carolina Panthers': 29,
  'Chicago Bears': 3,
  'Cincinnati Bengals': 4,
  'Cleveland Browns': 5,
  'Dallas Cowboys': 6,
  'Denver Broncos': 7,
  'Detroit Lions': 8,
  'Green Bay Packers': 9,
  'Houston Texans': 34,
  'Indianapolis Colts': 11,
  'Jacksonville Jaguars': 30,
  'Kansas City Chiefs': 12,
  'Las Vegas Raiders': 13,
  'Los Angeles Chargers': 24,
  'Los Angeles Rams': 14,
  'Miami Dolphins': 15,
  'Minnesota Vikings': 16,
  'New England Patriots': 17,
  'New Orleans Saints': 18,
  'New York Giants': 19,
  'New York Jets': 20,
  'Philadelphia Eagles': 21,
  'Pittsburgh Steelers': 23,
  'San Francisco 49ers': 25,
  'Seattle Seahawks': 26,
  'Tampa Bay Buccaneers': 27,
  'Tennessee Titans': 10,
  'Washington Commanders': 28
};
```

### NBA Team IDs

```javascript
const nbaTeamIds = {
  'Atlanta Hawks': 1,
  'Boston Celtics': 2,
  'Brooklyn Nets': 17,
  'Charlotte Hornets': 30,
  'Chicago Bulls': 4,
  'Cleveland Cavaliers': 5,
  'Dallas Mavericks': 6,
  'Denver Nuggets': 7,
  'Detroit Pistons': 8,
  'Golden State Warriors': 9,
  'Houston Rockets': 10,
  'Indiana Pacers': 11,
  'LA Clippers': 12,
  'Los Angeles Lakers': 13,
  'Memphis Grizzlies': 29,
  'Miami Heat': 14,
  'Milwaukee Bucks': 15,
  'Minnesota Timberwolves': 16,
  'New Orleans Pelicans': 3,
  'New York Knicks': 18,
  'Oklahoma City Thunder': 25,
  'Orlando Magic': 19,
  'Philadelphia 76ers': 20,
  'Phoenix Suns': 21,
  'Portland Trail Blazers': 22,
  'Sacramento Kings': 23,
  'San Antonio Spurs': 24,
  'Toronto Raptors': 28,
  'Utah Jazz': 26,
  'Washington Wizards': 27
};
```

### NHL Team IDs

```javascript
const nhlTeamIds = {
  'Anaheim Ducks': 25,
  'Arizona Coyotes': 24,
  'Boston Bruins': 1,
  'Buffalo Sabres': 2,
  'Calgary Flames': 3,
  'Carolina Hurricanes': 7,
  'Chicago Blackhawks': 4,
  'Colorado Avalanche': 17,
  'Columbus Blue Jackets': 29,
  'Dallas Stars': 9,
  'Detroit Red Wings': 5,
  'Edmonton Oilers': 6,
  'Florida Panthers': 26,
  'Los Angeles Kings': 8,
  'Minnesota Wild': 30,
  'Montreal Canadiens': 10,
  'Nashville Predators': 27,
  'New Jersey Devils': 11,
  'New York Islanders': 12,
  'New York Rangers': 13,
  'Ottawa Senators': 14,
  'Philadelphia Flyers': 15,
  'Pittsburgh Penguins': 16,
  'San Jose Sharks': 18,
  'Seattle Kraken': 36,
  'St. Louis Blues': 19,
  'Tampa Bay Lightning': 20,
  'Toronto Maple Leafs': 21,
  'Utah Hockey Club': 37,
  'Vancouver Canucks': 22,
  'Vegas Golden Knights': 35,
  'Washington Capitals': 23,
  'Winnipeg Jets': 28
};
```

---

## 3. Position Impact Weights

### NFL Position Weights

```javascript
const nflPositionWeights = {
  // Offense
  'QB': 1.00,    // Quarterback - most impactful
  'RB': 0.45,    // Running Back
  'WR': 0.35,    // Wide Receiver
  'TE': 0.25,    // Tight End
  'OL': 0.20,    // Offensive Line (aggregate)
  'LT': 0.25,    // Left Tackle (protects blind side)
  'RT': 0.20,    // Right Tackle
  'LG': 0.15,    // Left Guard
  'RG': 0.15,    // Right Guard
  'C': 0.18,     // Center

  // Defense
  'EDGE': 0.40,  // Edge Rusher
  'DE': 0.35,    // Defensive End
  'DT': 0.25,    // Defensive Tackle
  'LB': 0.30,    // Linebacker
  'CB': 0.40,    // Cornerback
  'S': 0.30,     // Safety
  'FS': 0.28,    // Free Safety
  'SS': 0.28,    // Strong Safety

  // Special Teams
  'K': 0.15,     // Kicker
  'P': 0.08,     // Punter

  // Default for unknown positions
  'default': 0.20
};
```

### NBA Position Weights

```javascript
const nbaPositionWeights = {
  'PG': 0.85,    // Point Guard - primary ball handler
  'SG': 0.65,    // Shooting Guard
  'SF': 0.70,    // Small Forward
  'PF': 0.60,    // Power Forward
  'C': 0.55,     // Center
  'G': 0.75,     // Generic Guard
  'F': 0.65,     // Generic Forward
  'default': 0.50
};
```

### NHL Position Weights

```javascript
const nhlPositionWeights = {
  'G': 0.90,     // Goalie - single most impactful
  'C': 0.50,     // Center
  'LW': 0.40,    // Left Wing
  'RW': 0.40,    // Right Wing
  'D': 0.45,     // Defenseman
  'F': 0.45,     // Generic Forward
  'default': 0.35
};
```

### Status Multipliers

```javascript
const statusMultipliers = {
  'Out': 1.0,              // Definitely missing
  'IR': 1.0,               // Injured Reserve
  'Injured Reserve': 1.0,
  'Doubtful': 0.85,        // 75%+ chance of missing
  'Questionable': 0.50,    // 50/50 chance
  'Day-To-Day': 0.40,      // Likely to play but limited
  'Probable': 0.15,        // Likely playing, minor concern
  'Expected': 0.0,         // Expected to play
  'default': 0.5
};
```

---

## 4. Impact Calculation Engine

```javascript
/**
 * Calculate total Elo impact from a team's injuries
 * @param {Array} injuries - Array of injury objects
 * @param {string} sport - Sport key
 * @returns {Object} Impact breakdown
 */
const calculateInjuryImpact = (injuries, sport) => {
  const positionWeights = {
    nfl: nflPositionWeights,
    nba: nbaPositionWeights,
    nhl: nhlPositionWeights,
    cfb: nflPositionWeights,  // Use NFL weights for CFB
    cbb: nbaPositionWeights   // Use NBA weights for CBB
  }[sport] || nflPositionWeights;

  // Base impact constants (max impact for a star QB out)
  const BASE_MAX_IMPACT = {
    nfl: -100,
    nba: -80,
    nhl: -70,
    cfb: -90,
    cbb: -75
  }[sport] || -100;

  let totalImpact = 0;
  const breakdown = [];

  for (const injury of injuries) {
    const posWeight = positionWeights[injury.position] || positionWeights.default;
    const statusMult = statusMultipliers[injury.status] || statusMultipliers.default;

    // Depth chart factor (if available) - starters hurt more
    const depthFactor = injury.isStarter ? 1.0 : (injury.depth === 2 ? 0.4 : 0.15);

    // Calculate raw impact
    const rawImpact = BASE_MAX_IMPACT * posWeight * statusMult * depthFactor;

    // Cap individual player impact
    const playerImpact = Math.max(rawImpact, BASE_MAX_IMPACT * 0.6);

    totalImpact += playerImpact;

    breakdown.push({
      player: injury.player,
      position: injury.position,
      status: injury.status,
      impact: Math.round(playerImpact)
    });
  }

  // Apply diminishing returns for multiple injuries
  // First few injuries have full impact, additional injuries have less
  const diminishingFactor = injuries.length > 3
    ? Math.pow(0.9, injuries.length - 3)
    : 1.0;

  // Cap total team impact
  const cappedImpact = Math.max(
    Math.round(totalImpact * diminishingFactor),
    BASE_MAX_IMPACT * 1.5  // Max -150 for completely decimated roster
  );

  return {
    totalImpact: cappedImpact,
    breakdown: breakdown.sort((a, b) => a.impact - b.impact), // Most impactful first
    injuryCount: injuries.length,
    keyInjuries: breakdown.filter(b => b.impact <= -20)
  };
};
```

---

## 5. Caching Strategy

```javascript
/**
 * Injury cache with expiration
 */
const INJURY_CACHE_KEY = 'injuryCache';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const getInjuryCache = () => {
  try {
    const cached = localStorage.getItem(INJURY_CACHE_KEY);
    if (!cached) return {};
    return JSON.parse(cached);
  } catch {
    return {};
  }
};

const setInjuryCache = (cache) => {
  localStorage.setItem(INJURY_CACHE_KEY, JSON.stringify(cache));
};

const getCachedInjuries = (sport, teamId) => {
  const cache = getInjuryCache();
  const key = `${sport}_${teamId}`;
  const entry = cache[key];

  if (!entry) return null;

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
    return null;
  }

  return entry.data;
};

const cacheInjuries = (sport, teamId, injuries) => {
  const cache = getInjuryCache();
  const key = `${sport}_${teamId}`;

  cache[key] = {
    data: injuries,
    timestamp: Date.now()
  };

  // Clean old entries (keep only last 50)
  const entries = Object.entries(cache);
  if (entries.length > 50) {
    const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const newCache = Object.fromEntries(sorted.slice(0, 50));
    setInjuryCache(newCache);
  } else {
    setInjuryCache(cache);
  }
};
```

---

## 6. UI Components

### Injury Report Panel

```jsx
const InjuryReportPanel = ({ injuries, teamName, impact }) => {
  const [expanded, setExpanded] = useState(false);

  if (!injuries || injuries.length === 0) {
    return (
      <div className="text-green-400 text-sm flex items-center gap-1">
        <span>✓</span> No reported injuries
      </div>
    );
  }

  const keyInjuries = injuries.filter(i =>
    ['Out', 'Doubtful', 'IR'].includes(i.status)
  );

  return (
    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-red-400">🏥</span>
          <span className="font-medium">{teamName} Injuries</span>
          <span className="text-red-400 text-sm">
            ({keyInjuries.length} key, {injuries.length} total)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-red-400 font-mono font-bold">
            {impact > 0 ? impact : impact} Elo
          </span>
          <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {injuries.map((injury, idx) => (
            <div
              key={idx}
              className={`flex justify-between text-sm p-2 rounded ${
                injury.status === 'Out' ? 'bg-red-900/40' :
                injury.status === 'Doubtful' ? 'bg-orange-900/40' :
                injury.status === 'Questionable' ? 'bg-yellow-900/40' :
                'bg-gray-800/40'
              }`}
            >
              <div>
                <span className="font-medium">{injury.player}</span>
                <span className="text-gray-400 ml-2">({injury.position})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  injury.status === 'Out' ? 'bg-red-600' :
                  injury.status === 'Doubtful' ? 'bg-orange-600' :
                  injury.status === 'Questionable' ? 'bg-yellow-600' :
                  'bg-gray-600'
                }`}>
                  {injury.status}
                </span>
                <span className="text-red-400 font-mono w-12 text-right">
                  {injury.impact}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Auto-Populated Slider with Override

```jsx
const InjurySlider = ({
  autoValue,      // Calculated from API
  manualValue,    // User override
  onChange,
  teamName,
  isAutoMode
}) => {
  const displayValue = isAutoMode ? autoValue : manualValue;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm text-gray-300">
          {teamName} Injury Impact
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange({ isAuto: true })}
            className={`px-2 py-1 text-xs rounded ${
              isAutoMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => onChange({ isAuto: false, value: autoValue })}
            className={`px-2 py-1 text-xs rounded ${
              !isAutoMode
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min="-100"
          max="0"
          value={displayValue}
          onChange={(e) => onChange({
            isAuto: false,
            value: parseInt(e.target.value)
          })}
          disabled={isAutoMode}
          className={`flex-1 ${isAutoMode ? 'opacity-50' : ''}`}
        />
        <span className={`font-mono w-12 text-right ${
          displayValue < -60 ? 'text-red-400' :
          displayValue < -30 ? 'text-orange-400' :
          displayValue < 0 ? 'text-yellow-400' :
          'text-green-400'
        }`}>
          {displayValue}
        </span>
      </div>

      {isAutoMode && (
        <p className="text-xs text-gray-500">
          Auto-calculated from ESPN injury report
        </p>
      )}
    </div>
  );
};
```

---

## 7. Integration with Existing Flow

### State Additions

```javascript
// Add to existing state declarations in App.jsx
const [team1Injuries, setTeam1Injuries] = useState([]);
const [team2Injuries, setTeam2Injuries] = useState([]);
const [team1InjuryAuto, setTeam1InjuryAuto] = useState(0);
const [team2InjuryAuto, setTeam2InjuryAuto] = useState(0);
const [useAutoInjuries, setUseAutoInjuries] = useState(true);
const [injuriesLoading, setInjuriesLoading] = useState(false);
const [injuriesError, setInjuriesError] = useState('');
const [lastInjuryFetch, setLastInjuryFetch] = useState(null);
```

### Fetch Trigger

```javascript
// Fetch injuries when matchup changes
useEffect(() => {
  const fetchMatchupInjuries = async () => {
    if (!team1 || !team2 || !sport) return;

    // Get team IDs
    const teamIds = getTeamIdsForSport(sport);
    const team1Id = teamIds[team1];
    const team2Id = teamIds[team2];

    if (!team1Id || !team2Id) {
      console.warn('Team IDs not found for injury lookup');
      return;
    }

    setInjuriesLoading(true);
    setInjuriesError('');

    try {
      // Check cache first
      let t1Injuries = getCachedInjuries(sport, team1Id);
      let t2Injuries = getCachedInjuries(sport, team2Id);

      // Fetch if not cached
      if (!t1Injuries) {
        t1Injuries = await fetchTeamInjuries(sport, team1Id);
        cacheInjuries(sport, team1Id, t1Injuries);
      }
      if (!t2Injuries) {
        t2Injuries = await fetchTeamInjuries(sport, team2Id);
        cacheInjuries(sport, team2Id, t2Injuries);
      }

      setTeam1Injuries(t1Injuries);
      setTeam2Injuries(t2Injuries);

      // Calculate impacts
      const t1Impact = calculateInjuryImpact(t1Injuries, sport);
      const t2Impact = calculateInjuryImpact(t2Injuries, sport);

      setTeam1InjuryAuto(t1Impact.totalImpact);
      setTeam2InjuryAuto(t2Impact.totalImpact);

      // Auto-apply if enabled
      if (useAutoInjuries) {
        setTeam1Injury(t1Impact.totalImpact);
        setTeam2Injury(t2Impact.totalImpact);
      }

      setLastInjuryFetch(new Date());
    } catch (error) {
      setInjuriesError('Failed to fetch injury data');
      console.error('Injury fetch error:', error);
    } finally {
      setInjuriesLoading(false);
    }
  };

  fetchMatchupInjuries();
}, [team1, team2, sport]);
```

---

## 8. Fallback Strategies

### When ESPN API Fails

1. **AI Web Search Fallback**: Use existing OpenRouter integration with web search to get injury info
2. **Manual Mode**: Fall back to manual slider adjustment
3. **Cached Data**: Use stale cached data with warning indicator

```javascript
const fetchInjuriesWithFallback = async (sport, teamId, teamName) => {
  // Try ESPN first
  try {
    const injuries = await fetchTeamInjuries(sport, teamId);
    if (injuries.length >= 0) return { injuries, source: 'ESPN' };
  } catch (err) {
    console.warn('ESPN injury fetch failed, trying fallback');
  }

  // Try cached data (even if stale)
  const cached = getCachedInjuries(sport, teamId);
  if (cached) {
    return { injuries: cached, source: 'cached', stale: true };
  }

  // AI fallback (if API key available)
  if (openRouterKey && enableWebSearch) {
    try {
      const aiResponse = await fetchAiInjuryInfo(teamName, sport);
      return { injuries: aiResponse, source: 'AI' };
    } catch (err) {
      console.warn('AI injury fallback failed');
    }
  }

  // No data available
  return { injuries: [], source: 'none' };
};
```

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure
- Add ESPN team ID mappings for all sports
- Implement injury API fetcher with caching
- Add position weight dictionaries
- Create impact calculation engine

### Phase 2: UI Integration
- Add injury report panel to Analyze tab
- Create auto/manual toggle for injury slider
- Add loading states and error handling
- Display injury breakdown with player details

### Phase 3: Smart Features
- Implement depth chart integration for starter detection
- Add historical injury tracking
- Create injury trend analysis
- Add "key player" detection based on usage stats

### Phase 4: Polish
- Add refresh button with rate limiting
- Implement stale data indicators
- Add injury data source attribution
- Create injury impact confidence scores

---

## 10. Future Enhancements

1. **Player Usage Integration**: Weight injuries by minutes/snaps played
2. **Recent Form Factor**: Adjust impact based on player's recent performance
3. **Matchup-Specific Impact**: CB injury matters more vs pass-heavy team
4. **Practice Report Integration**: Use Wednesday/Thursday/Friday practice status
5. **Historical Accuracy Tracking**: Compare predictions vs actual impact
6. **Multi-Source Aggregation**: Combine ESPN, RotoBaller, team official sources

---

## Summary

This design provides a comprehensive approach to automated injury integration:

| Feature | Current State | Proposed |
|---------|--------------|----------|
| Injury Input | Manual sliders (-100 to 0) | Auto-populated from ESPN API |
| Data Source | User knowledge + AI suggestions | Real-time ESPN injury reports |
| Position Weighting | None | Sport-specific weights |
| Caching | None | 30-minute localStorage cache |
| Fallback | AI web search | ESPN → Cache → AI → Manual |
| User Control | Full manual | Auto with manual override |

The implementation respects the existing architecture while adding powerful automation capabilities.
