import { positionWeights, baseMaxImpact } from '../config';

// Calculate total Elo impact from injuries
// Only counts players who are actually OUT/IR/Doubtful significantly
// Questionable/Day-to-Day players usually play and get minimal weight
export const calculateInjuryImpact = (injuries, sp) => {
  const weights = positionWeights[sp] || positionWeights.nfl;
  const maxImpact = baseMaxImpact[sp] || -100;

  const breakdown = [];

  // Get status multiplier with case-insensitive matching
  const getStatusMult = (status) => {
    // Numeric codes (12=LTIR, etc) are IR statuses - definitely out
    if (!isNaN(status) && status !== '') return 1.0;
    const s = (status || '').toLowerCase();
    // Active/Healthy = no impact (shouldn't be in list but safety net)
    if (s.includes('active') || s === 'healthy') return 0;
    if (s.includes('out') || s === 'ir' || s.includes('injured') || s.includes('ltir')) return 1.0;
    if (s.includes('doubtful')) return 0.75;
    if (s.includes('questionable')) return 0.20;
    if (s.includes('day')) return 0.15; // Day-to-Day
    if (s.includes('probable')) return 0.05;
    return 0.1; // default for unknown
  };

  // Get games played multiplier - considers both games this season AND experience
  // Veterans returning from injury with few games still matter
  const getGamesMult = (gamesPlayed, experience) => {
    // Veterans (1+ years experience) returning from injury still matter
    if (experience > 0) {
      if (gamesPlayed === 0) return 0.5;  // Vet who hasn't played yet this year
      if (gamesPlayed < 5) return 0.75;   // Vet just back from injury
      if (gamesPlayed < 15) return 0.9;   // Vet working back to form
      return 1.0;
    }
    // Rookies/prospects with few games don't matter much
    if (gamesPlayed === 0) return 0;      // Prospect like Michael Misa
    if (gamesPlayed < 5) return 0.3;      // Barely played rookie
    if (gamesPlayed < 15) return 0.6;     // Limited role rookie
    return 1.0;
  };

  for (const injury of injuries) {
    const posWeight = weights[injury.position] || weights.default;
    const statusMult = getStatusMult(injury.status);
    const gamesMult = getGamesMult(injury.gamesPlayed || 0, injury.experience || 0);
    const rawImpact = maxImpact * posWeight * statusMult * gamesMult;
    breakdown.push({ ...injury, impact: Math.round(rawImpact) });
  }

  // Sort by impact (most negative first) and only count top contributors
  breakdown.sort((a, b) => a.impact - b.impact);

  // Only sum the top 4 most impactful injuries with diminishing returns
  // 1st injury: 100%, 2nd: 60%, 3rd: 35%, 4th: 20%
  const diminishingWeights = [1.0, 0.6, 0.35, 0.2];
  let totalImpact = 0;
  for (let i = 0; i < Math.min(breakdown.length, 4); i++) {
    totalImpact += breakdown[i].impact * diminishingWeights[i];
  }

  // Cap at 1.2x max impact (e.g., -120 for NFL)
  const cappedImpact = Math.max(Math.round(totalImpact), Math.round(maxImpact * 1.2));

  // Key injuries = Out/IR/LTIR/Doubtful with real impact (not Questionable bench players)
  // Use case-insensitive matching since ESPN status strings vary
  const isKeyStatus = (status) => {
    if (!isNaN(status) && status !== '') return true; // Numeric codes (12=LTIR) are key
    const s = (status || '').toLowerCase();
    return s.includes('out') || s.includes('ir') || s.includes('injured') || s.includes('doubtful');
  };
  const keyInjuries = breakdown.filter(b => isKeyStatus(b.status) && b.impact <= -15);

  return {
    totalImpact: cappedImpact,
    breakdown,
    keyInjuries
  };
};
