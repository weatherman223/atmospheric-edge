// ESPN Team ID Mappings for Injury API
export const espnTeamIds = {
  nfl: {
    'Arizona Cardinals': 22, 'Atlanta Falcons': 1, 'Baltimore Ravens': 33, 'Buffalo Bills': 2,
    'Carolina Panthers': 29, 'Chicago Bears': 3, 'Cincinnati Bengals': 4, 'Cleveland Browns': 5,
    'Dallas Cowboys': 6, 'Denver Broncos': 7, 'Detroit Lions': 8, 'Green Bay Packers': 9,
    'Houston Texans': 34, 'Indianapolis Colts': 11, 'Jacksonville Jaguars': 30, 'Kansas City Chiefs': 12,
    'Las Vegas Raiders': 13, 'Los Angeles Chargers': 24, 'Los Angeles Rams': 14, 'Miami Dolphins': 15,
    'Minnesota Vikings': 16, 'New England Patriots': 17, 'New Orleans Saints': 18, 'New York Giants': 19,
    'New York Jets': 20, 'Philadelphia Eagles': 21, 'Pittsburgh Steelers': 23, 'San Francisco 49ers': 25,
    'Seattle Seahawks': 26, 'Tampa Bay Buccaneers': 27, 'Tennessee Titans': 10, 'Washington Commanders': 28
  },
  nba: {
    'Atlanta Hawks': 1, 'Boston Celtics': 2, 'Brooklyn Nets': 17, 'Charlotte Hornets': 30,
    'Chicago Bulls': 4, 'Cleveland Cavaliers': 5, 'Dallas Mavericks': 6, 'Denver Nuggets': 7,
    'Detroit Pistons': 8, 'Golden State Warriors': 9, 'Houston Rockets': 10, 'Indiana Pacers': 11,
    'Los Angeles Clippers': 12, 'Los Angeles Lakers': 13, 'Memphis Grizzlies': 29, 'Miami Heat': 14,
    'Milwaukee Bucks': 15, 'Minnesota Timberwolves': 16, 'New Orleans Pelicans': 3, 'New York Knicks': 18,
    'Oklahoma City Thunder': 25, 'Orlando Magic': 19, 'Philadelphia 76ers': 20, 'Phoenix Suns': 21,
    'Portland Trail Blazers': 22, 'Sacramento Kings': 23, 'San Antonio Spurs': 24, 'Toronto Raptors': 28,
    'Utah Jazz': 26, 'Washington Wizards': 27
  },
  nhl: {
    'Anaheim Ducks': 25, 'Boston Bruins': 1, 'Buffalo Sabres': 2, 'Calgary Flames': 3,
    'Carolina Hurricanes': 7, 'Chicago Blackhawks': 4, 'Colorado Avalanche': 17, 'Columbus Blue Jackets': 29,
    'Dallas Stars': 9, 'Detroit Red Wings': 5, 'Edmonton Oilers': 6, 'Florida Panthers': 26,
    'Los Angeles Kings': 8, 'Minnesota Wild': 30, 'Montreal Canadiens': 10, 'Nashville Predators': 27,
    'New Jersey Devils': 11, 'New York Islanders': 12, 'New York Rangers': 13, 'Ottawa Senators': 14,
    'Philadelphia Flyers': 15, 'Pittsburgh Penguins': 16, 'San Jose Sharks': 18, 'Seattle Kraken': 36,
    'St. Louis Blues': 19, 'Tampa Bay Lightning': 20, 'Toronto Maple Leafs': 21, 'Utah Mammoth': 37,
    'Vancouver Canucks': 22, 'Vegas Golden Knights': 35, 'Washington Capitals': 23, 'Winnipeg Jets': 28
  }
};

// ESPN Injury API endpoints
export const injuryEndpoints = {
  nfl: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/{teamId}/injuries?limit=100',
  nba: 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/teams/{teamId}/injuries?limit=100',
  nhl: 'https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/teams/{teamId}/injuries?limit=100'
};

// ESPN Import Functions
export const espnEndpoints = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  cfb: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  cbb: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
};

// Season start dates for each sport (approximate)
export const seasonStartDates = {
  nfl: '20250904',   // NFL 2025 season start
  nba: '20251021',   // NBA 2025-26 season start
  nhl: '20251007',   // NHL 2025-26 season start
  cfb: '20250823',   // CFB 2025 season start
  cbb: '20251103',   // CBB 2025-26 season start
  d3mb: '20251108',  // D3 Men's Basketball 2025-26 season start
  d3wb: '20251108',  // D3 Women's Basketball 2025-26 season start
};

// ESPN sport/league mapping for odds endpoint
export const espnOddsConfig = {
  nfl: { sport: 'football', league: 'nfl' },
  nba: { sport: 'basketball', league: 'nba' },
  nhl: { sport: 'hockey', league: 'nhl' },
  cfb: { sport: 'football', league: 'college-football' },
  cbb: { sport: 'basketball', league: 'mens-college-basketball' },
};

export const ESPN_ALLOWED_REF_HOSTS = new Set([
  'sports.core.api.espn.com',
  'site.api.espn.com'
]);
