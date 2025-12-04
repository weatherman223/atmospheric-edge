import { describe, it, expect } from 'vitest';
import {
  safeParseFloat,
  eloToWinProb,
  americanToImpliedProb,
  probToAmerican,
  americanToDecimal,
  calculateEV,
  kellyStake,
  kellyStakeCapped,
  spreadCoverProb,
  totalProb,
  getConfidenceTier
} from './calculations';

describe('safeParseFloat', () => {
  it('parses regular numbers', () => {
    expect(safeParseFloat('100')).toBe(100);
    expect(safeParseFloat('-110')).toBe(-110);
    expect(safeParseFloat('2.5')).toBe(2.5);
  });

  it('handles EVEN odds', () => {
    expect(safeParseFloat('EVEN')).toBe(100);
    expect(safeParseFloat('even')).toBe(100);
    expect(safeParseFloat('EV')).toBe(100);
  });

  it('handles pick\'em spreads', () => {
    expect(safeParseFloat('PK')).toBe(0);
    expect(safeParseFloat('pk')).toBe(0);
    expect(safeParseFloat('PICK')).toBe(0);
  });

  it('returns fallback for invalid input', () => {
    expect(safeParseFloat('invalid')).toBe(0);
    expect(safeParseFloat('invalid', 999)).toBe(999);
    expect(safeParseFloat('')).toBe(0);
  });

  it('handles numeric input', () => {
    expect(safeParseFloat(100)).toBe(100);
    expect(safeParseFloat(-110)).toBe(-110);
  });
});

describe('eloToWinProb', () => {
  it('equal ratings with no home advantage = 50%', () => {
    expect(eloToWinProb(1500, 1500, 0)).toBeCloseTo(0.5, 5);
  });

  it('100 point advantage ≈ 64% win probability', () => {
    expect(eloToWinProb(1600, 1500, 0)).toBeCloseTo(0.64, 2);
  });

  it('200 point advantage ≈ 76% win probability', () => {
    expect(eloToWinProb(1700, 1500, 0)).toBeCloseTo(0.76, 2);
  });

  it('applies home advantage correctly', () => {
    // Equal teams, 48 point home advantage (NFL standard)
    const homeWinProb = eloToWinProb(1500, 1500, 48);
    expect(homeWinProb).toBeGreaterThan(0.5);
    expect(homeWinProb).toBeCloseTo(0.567, 2);
  });

  it('handles negative home advantage (road game)', () => {
    const roadWinProb = eloToWinProb(1500, 1500, -48);
    expect(roadWinProb).toBeLessThan(0.5);
    expect(roadWinProb).toBeCloseTo(0.433, 2);
  });

  it('larger rating differences create higher win probabilities', () => {
    const prob100 = eloToWinProb(1600, 1500, 0);
    const prob200 = eloToWinProb(1700, 1500, 0);
    const prob300 = eloToWinProb(1800, 1500, 0);
    expect(prob200).toBeGreaterThan(prob100);
    expect(prob300).toBeGreaterThan(prob200);
  });
});

describe('americanToImpliedProb', () => {
  it('converts positive odds correctly', () => {
    // +100 = 50% implied
    expect(americanToImpliedProb(100)).toBeCloseTo(0.5, 5);
    // +200 = 33.33% implied
    expect(americanToImpliedProb(200)).toBeCloseTo(0.3333, 3);
    // +150 = 40% implied
    expect(americanToImpliedProb(150)).toBeCloseTo(0.4, 2);
  });

  it('converts negative odds correctly', () => {
    // -110 ≈ 52.38% implied
    expect(americanToImpliedProb(-110)).toBeCloseTo(0.5238, 3);
    // -200 = 66.67% implied
    expect(americanToImpliedProb(-200)).toBeCloseTo(0.6667, 3);
    // -150 = 60% implied
    expect(americanToImpliedProb(-150)).toBeCloseTo(0.6, 2);
  });

  it('handles EVEN odds', () => {
    expect(americanToImpliedProb('EVEN')).toBeCloseTo(0.5, 5);
  });

  it('handles string input', () => {
    expect(americanToImpliedProb('-110')).toBeCloseTo(0.5238, 3);
    expect(americanToImpliedProb('+150')).toBeCloseTo(0.4, 2);
  });
});

describe('probToAmerican', () => {
  it('converts 50% to +100', () => {
    const result = probToAmerican(0.5);
    expect(result).toBe('+100');
  });

  it('converts favorites (>50%) to negative odds', () => {
    expect(probToAmerican(0.6)).toBe('-150');
    expect(probToAmerican(0.7)).toBe('-233');
  });

  it('converts underdogs (<50%) to positive odds', () => {
    expect(probToAmerican(0.4)).toBe('+150');
    expect(probToAmerican(0.3333)).toBe('+200');
  });

  it('handles edge cases', () => {
    expect(probToAmerican(0.9)).toBe('-900');
    expect(probToAmerican(0.1)).toBe('+900');
  });

  it('guards against 0 and 1 probabilities', () => {
    expect(probToAmerican(0)).toBe('+999900');
    expect(probToAmerican(1)).toBe('-999900');
  });
});

describe('americanToDecimal', () => {
  it('converts positive American odds to decimal', () => {
    expect(americanToDecimal(100)).toBe(2.0);
    expect(americanToDecimal(200)).toBe(3.0);
    expect(americanToDecimal(150)).toBe(2.5);
  });

  it('converts negative American odds to decimal', () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.909, 2);
    expect(americanToDecimal(-200)).toBe(1.5);
    expect(americanToDecimal(-150)).toBeCloseTo(1.667, 2);
  });

  it('handles EVEN odds', () => {
    expect(americanToDecimal('EVEN')).toBe(2.0);
  });
});

describe('calculateEV', () => {
  it('50% win prob at +100 odds = 0% EV', () => {
    expect(calculateEV(0.5, 100)).toBeCloseTo(0, 5);
  });

  it('60% win prob at +100 odds = 20% EV', () => {
    expect(calculateEV(0.6, 100)).toBeCloseTo(0.2, 3);
  });

  it('negative EV when probability is lower than implied odds', () => {
    // 40% win prob at +100 odds (50% implied) = -20% EV
    expect(calculateEV(0.4, 100)).toBeCloseTo(-0.2, 3);
  });

  it('calculates EV for favorites correctly', () => {
    // 60% win prob at -150 odds (60% implied) ≈ 0% EV
    expect(calculateEV(0.6, -150)).toBeCloseTo(0, 1);
  });

  it('positive EV for edge bets', () => {
    // 55% win prob at +100 odds = 10% EV
    expect(calculateEV(0.55, 100)).toBeCloseTo(0.1, 3);
  });

  it('handles large underdog bets', () => {
    // 40% win prob at +200 odds (33.33% implied) = 20% EV
    expect(calculateEV(0.4, 200)).toBeCloseTo(0.2, 2);
  });
});

describe('kellyStake', () => {
  it('no edge = no bet', () => {
    // 50% win prob at +100 odds = 0% EV = 0 bet
    expect(kellyStake(0.5, 100, 1000, 1)).toBe(0);
  });

  it('calculates quarter Kelly correctly', () => {
    // 55% win prob at +100 odds, $1000 bankroll, 0.25 Kelly
    const stake = kellyStake(0.55, 100, 1000, 0.25);
    expect(stake).toBeGreaterThan(0);
    expect(stake).toBeLessThan(1000);
    expect(stake).toBeCloseTo(25, 0); // Should be around $25
  });

  it('never recommends negative stakes', () => {
    // Bad bet with negative EV
    expect(kellyStake(0.4, 100, 1000, 1)).toBe(0);
  });

  it('larger edge = larger stake', () => {
    const stake1 = kellyStake(0.52, 100, 1000, 0.25);
    const stake2 = kellyStake(0.55, 100, 1000, 0.25);
    const stake3 = kellyStake(0.60, 100, 1000, 0.25);
    expect(stake2).toBeGreaterThan(stake1);
    expect(stake3).toBeGreaterThan(stake2);
  });

  it('handles fractional Kelly correctly', () => {
    const fullKelly = kellyStake(0.55, 100, 1000, 1);
    const halfKelly = kellyStake(0.55, 100, 1000, 0.5);
    const quarterKelly = kellyStake(0.55, 100, 1000, 0.25);
    expect(halfKelly).toBeCloseTo(fullKelly / 2, 1);
    expect(quarterKelly).toBeCloseTo(fullKelly / 4, 1);
  });
});

describe('kellyStakeCapped', () => {
  it('returns uncapped amount when below max', () => {
    const result = kellyStakeCapped(0.55, 100, 1000, 0.25, 100);
    expect(result.wasCapped).toBe(false);
    expect(result.amount).toBe(result.rawAmount);
  });

  it('caps stake at maxBet when exceeded', () => {
    const result = kellyStakeCapped(0.65, 100, 10000, 0.25, 100);
    expect(result.wasCapped).toBe(true);
    expect(result.amount).toBe(100);
    expect(result.rawAmount).toBeGreaterThan(100);
  });

  it('returns all required properties', () => {
    const result = kellyStakeCapped(0.55, 100, 1000, 0.25, 50);
    expect(result).toHaveProperty('amount');
    expect(result).toHaveProperty('wasCapped');
    expect(result).toHaveProperty('rawAmount');
  });
});

describe('spreadCoverProb', () => {
  const nflConfig = { scoringVar: 14 };

  it('exactly at predicted spread = 50% cover probability', () => {
    // Model predicts -7, book is -7
    const prob = spreadCoverProb(-7, -7, nflConfig);
    expect(prob).toBeCloseTo(0.5, 2);
  });

  it('book spread more favorable = higher cover probability', () => {
    // Model predicts -7, book is -3 (easier to cover)
    const prob = spreadCoverProb(-7, -3, nflConfig);
    expect(prob).toBeGreaterThan(0.5);
  });

  it('book spread less favorable = lower cover probability', () => {
    // Model predicts -7, book is -10 (harder to cover)
    const prob = spreadCoverProb(-7, -10, nflConfig);
    expect(prob).toBeLessThan(0.5);
  });

  it('returns probability between 0 and 1', () => {
    const prob = spreadCoverProb(-7, -3, nflConfig);
    expect(prob).toBeGreaterThanOrEqual(0);
    expect(prob).toBeLessThanOrEqual(1);
  });
});

describe('totalProb', () => {
  const nflConfig = { scoringVar: 14 };

  it('predicted total equals book = ~50% for over/under', () => {
    const overProb = totalProb(47, 47, true, nflConfig);
    const underProb = totalProb(47, 47, false, nflConfig);
    expect(overProb).toBeCloseTo(0.5, 1);
    expect(underProb).toBeCloseTo(0.5, 1);
  });

  it('model predicts higher total = over more likely', () => {
    const overProb = totalProb(50, 45, true, nflConfig);
    expect(overProb).toBeGreaterThan(0.5);
  });

  it('model predicts lower total = under more likely', () => {
    const underProb = totalProb(42, 47, false, nflConfig);
    expect(underProb).toBeGreaterThan(0.5);
  });

  it('over and under probabilities sum to ~1', () => {
    const overProb = totalProb(50, 47, true, nflConfig);
    const underProb = totalProb(50, 47, false, nflConfig);
    expect(overProb + underProb).toBeCloseTo(1, 1);
  });

  it('returns probability between 0 and 1', () => {
    const prob = totalProb(50, 47, true, nflConfig);
    expect(prob).toBeGreaterThanOrEqual(0);
    expect(prob).toBeLessThanOrEqual(1);
  });
});

describe('getConfidenceTier', () => {
  it('classifies ELITE bets (10%+ EV)', () => {
    const tier = getConfidenceTier(12);
    expect(tier.label).toBe('ELITE');
    expect(tier.stars).toBe('★★★★★');
    expect(tier.color).toBe('text-yellow-500');
  });

  it('classifies STRONG bets (6-10% EV)', () => {
    const tier = getConfidenceTier(7);
    expect(tier.label).toBe('STRONG');
    expect(tier.stars).toBe('★★★★☆');
    expect(tier.color).toBe('text-emerald-600');
  });

  it('classifies GOOD bets (3-6% EV)', () => {
    const tier = getConfidenceTier(4);
    expect(tier.label).toBe('GOOD');
    expect(tier.stars).toBe('★★★☆☆');
    expect(tier.color).toBe('text-blue-600');
  });

  it('classifies LEAN bets (1-3% EV)', () => {
    const tier = getConfidenceTier(2);
    expect(tier.label).toBe('LEAN');
    expect(tier.stars).toBe('★★☆☆☆');
    expect(tier.color).toBe('text-gray-600');
  });

  it('classifies MARGINAL bets (<1% EV)', () => {
    const tier = getConfidenceTier(0.5);
    expect(tier.label).toBe('MARGINAL');
    expect(tier.stars).toBe('★☆☆☆☆');
    expect(tier.color).toBe('text-gray-400');
  });

  it('handles edge case at thresholds', () => {
    expect(getConfidenceTier(10).label).toBe('ELITE');
    expect(getConfidenceTier(9.9).label).toBe('STRONG');
    expect(getConfidenceTier(6).label).toBe('STRONG');
    expect(getConfidenceTier(5.9).label).toBe('GOOD');
  });

  it('returns all required properties', () => {
    const tier = getConfidenceTier(5);
    expect(tier).toHaveProperty('stars');
    expect(tier).toHaveProperty('label');
    expect(tier).toHaveProperty('color');
    expect(tier).toHaveProperty('bg');
  });
});

// Integration tests combining multiple functions
describe('Integration: Full betting scenario', () => {
  it('calculates correct EV and Kelly stake for a profitable bet', () => {
    // Scenario: 55% true win prob, +100 odds, $1000 bankroll, quarter Kelly
    const trueProb = 0.55;
    const odds = 100;
    const bankroll = 1000;
    const kellyFraction = 0.25;

    // Step 1: Check implied probability
    const impliedProb = americanToImpliedProb(odds);
    expect(impliedProb).toBeCloseTo(0.5, 2);

    // Step 2: Calculate EV
    const ev = calculateEV(trueProb, odds);
    expect(ev).toBeCloseTo(0.1, 2); // 10% EV

    // Step 3: Calculate stake
    const stake = kellyStake(trueProb, odds, bankroll, kellyFraction);
    expect(stake).toBeGreaterThan(0);
    expect(stake).toBeLessThan(bankroll);

    // Step 4: Check confidence tier
    const evPercent = ev * 100;
    const tier = getConfidenceTier(evPercent);
    expect(tier.label).toBe('ELITE');
  });

  it('recommends no bet when EV is negative', () => {
    // Scenario: 45% true win prob, +100 odds (50% implied)
    const trueProb = 0.45;
    const odds = 100;
    const bankroll = 1000;

    const ev = calculateEV(trueProb, odds);
    expect(ev).toBeLessThan(0);

    const stake = kellyStake(trueProb, odds, bankroll, 0.25);
    expect(stake).toBe(0);
  });
});
