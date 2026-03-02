// Conference tier mappings for starting Elo (conferenceId -> tier)
// Tiers: Elite=1600, High=1450, Mid=1400, Low=1300, Unknown=1200
// WIDER GAPS to properly differentiate strength of schedule
// CBB Conference IDs from ESPN API: /apis/site/v2/sports/basketball/mens-college-basketball/groups
export const conferenceTiers = {
  cbb: {
    // Elite (Power 5) - 1600
    '2': 1600,   // ACC
    '4': 1600,   // Big East
    '7': 1600,   // Big Ten
    '8': 1600,   // Big 12
    '23': 1600,  // SEC
    // High Major - 1450 (good but not elite)
    '3': 1450,   // Atlantic 10
    '21': 1450,  // Pac-12
    '29': 1450,  // WCC (West Coast)
    '44': 1450,  // Mountain West
    '62': 1450,  // AAC (American)
    // Mid Major - 1400
    '1': 1400,   // America East
    '5': 1400,   // Big Sky
    '6': 1400,   // Big South
    '9': 1400,   // Big West
    '10': 1400,  // CAA (Coastal Athletic)
    '11': 1400,  // Conference USA
    '12': 1400,  // Ivy League
    '13': 1400,  // MAAC (Metro Atlantic)
    '14': 1400,  // MAC (Mid-American)
    '18': 1400,  // MVC (Missouri Valley)
    '20': 1400,  // OVC (Ohio Valley)
    '22': 1400,  // Patriot League
    '24': 1400,  // Southern Conference
    '25': 1400,  // Southland
    '27': 1400,  // Sun Belt
    '30': 1400,  // WAC
    '43': 1400,  // D1 Independents
    '45': 1400,  // Horizon League
    '46': 1400,  // ASUN
    '49': 1400,  // Summit League
    // Low Major - 1300
    '16': 1300,  // MEAC
    '19': 1300,  // NEC (Northeast)
    '26': 1300,  // SWAC
  },
  cfb: {
    // Elite (Power 4 + Notre Dame) - 1600
    '1': 1600,   // ACC
    '4': 1600,   // Big 12
    '5': 1600,   // Big Ten
    '8': 1600,   // SEC
    '18': 1600,  // FBS Independents (Notre Dame, UConn, UMass)
    // High (Group of 5) - 1500
    '9': 1500,   // Pac-12 (Washington State, Oregon State)
    '12': 1500,  // Conference USA
    '15': 1500,  // MAC (Mid-American)
    '17': 1500,  // Mountain West
    '37': 1500,  // Sun Belt
    '151': 1500, // AAC (American)
    // FCS Conferences - 1300
    '20': 1300,  // Big Sky
    '21': 1300,  // Missouri Valley Football (MVFC)
    '24': 1300,  // MEAC
    '25': 1300,  // NEC (Northeast)
    '27': 1300,  // Patriot League
    '29': 1300,  // Southern Conference
    '30': 1300,  // Southland
    '31': 1300,  // SWAC
    '32': 1300,  // FCS Independents
    '48': 1300,  // CAA Football
    '177': 1300, // United Athletic Conference
    '179': 1300, // OVC-Big South Football Association
  },
  // D3 Basketball Conference Tiers
  // Based on historical tournament success and competitiveness
  // Top conferences get 1500, mid-tier 1420, others 1350
  d3mb: {
    // Elite D3 conferences - regularly produce tournament teams
    'UAA': 1500,        // University Athletic Association (Chicago, NYU, Emory, etc.)
    'NESCAC': 1500,     // New England Small College Athletic Conference
    'ODAC': 1480,       // Old Dominion Athletic Conference
    'CCIW': 1480,       // College Conference of Illinois and Wisconsin
    'SCIAC': 1470,      // Southern California Intercollegiate Athletic
    'NEWMAC': 1470,     // New England Women's and Men's Athletic Conference
    'Centennial': 1460, // Centennial Conference
    'Liberty': 1460,    // Liberty League
    'SAA': 1450,        // Southern Athletic Association
    'WIAC': 1450,       // Wisconsin Intercollegiate Athletic Conference
    // Mid-tier conferences
    'MIAA': 1420,       // Michigan Intercollegiate Athletic Association
    'NACC': 1420,       // Northern Athletics Collegiate Conference
    'OAC': 1420,        // Ohio Athletic Conference
    'PAC': 1420,        // Presidents' Athletic Conference
    'SLIAC': 1420,      // St. Louis Intercollegiate Athletic
    'USA South': 1420,  // USA South Athletic Conference
    'CCC': 1400,        // Commonwealth Coast Conference
    'ASC': 1400,        // American Southwest Conference
    'SCAC': 1400,       // Southern Collegiate Athletic Conference
    'NC3': 1400,        // North Coast Athletic Conference
  },
  d3wb: {
    // Same structure for women's basketball (similar competitive landscape)
    'UAA': 1500,
    'NESCAC': 1500,
    'ODAC': 1480,
    'CCIW': 1480,
    'SCIAC': 1470,
    'NEWMAC': 1470,
    'Centennial': 1460,
    'Liberty': 1460,
    'SAA': 1450,
    'WIAC': 1450,
    'MIAA': 1420,
    'NACC': 1420,
    'OAC': 1420,
    'PAC': 1420,
    'SLIAC': 1420,
    'USA South': 1420,
    'CCC': 1400,
    'ASC': 1400,
    'SCAC': 1400,
    'NC3': 1400,
  }
};
