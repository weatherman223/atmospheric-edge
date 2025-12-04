import { describe, it, expect, vi, afterEach } from 'vitest';
import { runScoreSimulations } from './simulations';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runScoreSimulations', () => {
  it('returns deterministic results with zero variance and includes percentiles', () => {
    const result = runScoreSimulations({
      predictedSpread: -3,
      predictedTotal: 40,
      scoringVar: 0,
      simulations: 3,
      bookSpread: -3,
      bookTotal: 40,
      includePercentiles: true
    });

    expect(result.team1WinRate).toBe(1);
    expect(result.team2WinRate).toBe(0);

    expect(result.spread).toEqual({
      homeCover: 0,
      awayCover: 0,
      push: 1
    });

    expect(result.totals).toEqual({
      over: 0,
      under: 0,
      push: 1
    });

    expect(result.averages.team1).toBeCloseTo(21.5, 5);
    expect(result.averages.team2).toBeCloseTo(18.5, 5);

    expect(result.percentiles).toEqual({
      team1: { p10: 21.5, p50: 21.5, p90: 21.5 },
      team2: { p10: 18.5, p50: 18.5, p90: 18.5 }
    });
  });

  it('computes cover and total frequencies when lines differ from the model', () => {
    const result = runScoreSimulations({
      predictedSpread: -3,
      predictedTotal: 40,
      scoringVar: 0,
      simulations: 2,
      bookSpread: -7,
      bookTotal: 35,
      includePercentiles: false
    });

    expect(result.team1WinRate).toBe(1);
    expect(result.team2WinRate).toBe(0);

    expect(result.spread).toEqual({
      homeCover: 0,
      awayCover: 1,
      push: 0
    });

    expect(result.totals).toEqual({
      over: 1,
      under: 0,
      push: 0
    });

    expect(result.percentiles).toBeNull();
  });

  it('returns null for spread and totals when lines are not provided', () => {
    const result = runScoreSimulations({
      predictedSpread: 4,
      predictedTotal: 44,
      scoringVar: 0,
      simulations: 1
    });

    expect(result.spread).toBeNull();
    expect(result.totals).toBeNull();
  });

  it('respects randomness injection to validate tie/cover branches', () => {
    const mockValues = [
      0.25, 0.75, // marginNoise
      0.4, 0.6, // totalNoise
      0.9, 0.1, // skew noise
      0.5, 0.5, // marginNoise (tie)
      0.5, 0.5, // totalNoise (tie)
      0.2, 0.8 // skew noise
    ];

    let idx = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => mockValues[idx++ % mockValues.length]);

    const result = runScoreSimulations({
      predictedSpread: 0,
      predictedTotal: 20,
      scoringVar: 1,
      simulations: 2,
      bookSpread: 0,
      bookTotal: 20
    });

    expect(result.team1WinRate).toBe(0);
    expect(result.team2WinRate).toBe(0.5);

    expect(result.spread).toEqual({
      homeCover: 0,
      awayCover: 0.5,
      push: 0.5
    });

    expect(result.totals).toEqual({
      over: 0,
      under: 1,
      push: 0
    });
  });
});
