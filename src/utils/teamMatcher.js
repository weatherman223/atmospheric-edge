// Team name matching - accepts teams object as parameter
export const matchTeamName = (espnName, teams) => {
  // Try exact match first
  if (teams[espnName]) return espnName;

  // Normalize function - handle common abbreviations and variations
  const normalize = (name) => {
    const normalized = name
      .toLowerCase()
      .replace(/\bst\.?\b/gi, 'state')  // St. or St -> state
      .replace(/\bconn\.?\b/gi, 'connecticut')  // Conn. -> connecticut
      .replace(/\buniv\.?\b/gi, 'university')  // Univ. or Univ -> university
      .replace(/[()]/g, '')  // Remove parentheses
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
    const canonicalAliases = {
      'la clippers': 'los angeles clippers',
      'utah hockey club': 'utah mammoth'
    };
    return canonicalAliases[normalized] || normalized;
  };

  const espnNorm = normalize(espnName);
  const teamNames = Object.keys(teams);

  // Try normalized exact match
  for (const teamName of teamNames) {
    if (normalize(teamName) === espnNorm) {
      return teamName;
    }
  }

  // Try matching without common suffixes (mascots)
  const cleanName = espnName.replace(/ (Buckeyes|Wolverines|Crimson Tide|Tigers|Bulldogs|Sooners|Longhorns|Wildcats|Bears|Cardinals|Bruins|Trojans|Ducks|Beavers|Cougars|Huskies|Sun Devils|Golden Bears|Utes|Buffaloes|Aztecs|Spartans|Nittany Lions|Hawkeyes|Cornhuskers|Badgers|Gophers|Fighting Irish|Hoosiers|Boilermakers|Illini|Mountaineers|Panthers|Seminoles|Hurricanes|Cavaliers|Hokies|Yellow Jackets|Demon Deacons|Blue Devils|Tar Heels|Wolfpack|Orange|Red Raiders|Horned Frogs|Cyclones|Jayhawks|Aggies|Razorbacks|Rebels|Commodores|Volunteers|Gamecocks|Gators|Dawgs)$/i, '').trim();
  if (teams[cleanName]) return cleanName;

  // Also try normalized version without suffix
  const cleanNorm = normalize(cleanName);
  for (const teamName of teamNames) {
    if (normalize(teamName) === cleanNorm) {
      return teamName;
    }
  }

  // VERY STRICT matching from this point
  // Only match if we have strong confidence to avoid false positives
  // like "Central Conn. St." -> "Central Penn"

  // Word-based matching - require at least 2 significant matching words
  // This prevents single-word matches like "Central" from matching everything
  for (const teamName of teamNames) {
    const espnWords = espnNorm.split(' ').filter(w => w.length > 2);
    const teamWords = normalize(teamName).split(' ').filter(w => w.length > 2);

    // Need at least 2 words in both to attempt matching
    if (espnWords.length < 2 || teamWords.length < 2) continue;

    // Determine which is shorter and which is longer
    const [shorterWords, longerWords] = espnWords.length <= teamWords.length
      ? [espnWords, teamWords]
      : [teamWords, espnWords];

    // All words from the shorter name must appear in the longer name
    const allWordsMatch = shorterWords.every(word => longerWords.includes(word));

    // STRICT: Require at least 2 words to match to prevent false positives
    if (allWordsMatch && shorterWords.length >= 2) {
      return teamName;
    }
  }

  return null; // No match found - better to ask user to add manually than false match
};

export const normalizeGameDate = (dateValue) => {
  if (!dateValue) return '';
  const parsed = new Date(dateValue);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return String(dateValue).trim();
};

export const buildGameIdentity = ({ team1, team2, score1, score2, date }) => {
  const normalizedDate = normalizeGameDate(date);
  const sideA = `${team1}|${score1}`;
  const sideB = `${team2}|${score2}`;
  const [first, second] = [sideA, sideB].sort();
  return `date:${normalizedDate}|${first}|${second}`;
};

export const inferGameSport = (gameEntry, teamsBySportMap) => {
  if (!gameEntry || typeof gameEntry !== 'object') return '';
  if (typeof gameEntry.sport === 'string' && gameEntry.sport) return gameEntry.sport;

  const gameTeam1 = gameEntry.team1;
  const gameTeam2 = gameEntry.team2;
  if (!gameTeam1 || !gameTeam2) return '';
  if (!teamsBySportMap || typeof teamsBySportMap !== 'object' || Array.isArray(teamsBySportMap)) return '';

  const matchingSports = Object.entries(teamsBySportMap)
    .filter(([, teamsForSport]) => {
      if (!teamsForSport || typeof teamsForSport !== 'object' || Array.isArray(teamsForSport)) return false;
      return Boolean(teamsForSport[gameTeam1] && teamsForSport[gameTeam2]);
    })
    .map(([sportKey]) => sportKey);

  return matchingSports.length === 1 ? matchingSports[0] : '';
};
