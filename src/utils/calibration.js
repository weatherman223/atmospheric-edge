/**
 * Probability calibration using Platt scaling
 * Ships with identity defaults, learns from audit data using walk-forward splits
 */

export const DEFAULT_CALIBRATION_PARAMS = {
  ml:     { a: 1, b: 0 },  // identity transform
  spread: { a: 1, b: 0 },
  total:  { a: 1, b: 0 },
};

export const CALIBRATION_STORAGE_KEY = 'nba_calibration_params';

/**
 * Apply Platt scaling calibration to a probability
 * logit → linear transform → sigmoid
 * @param {number} rawProb - Raw probability (0-1)
 * @param {{ a: number, b: number }} params - Calibration params
 * @returns {number} Calibrated probability (0-1)
 */
export const calibrateProb = (rawProb, { a, b }) => {
  if (a === 1 && b === 0) return rawProb; // fast path: identity
  const EPSILON = 1e-6;
  const p = Math.max(EPSILON, Math.min(1 - EPSILON, rawProb));
  const logit = Math.log(p / (1 - p));
  return 1 / (1 + Math.exp(-(a * logit + b)));
};

/**
 * Learn calibration parameters via gradient descent on log-loss
 * Requires >= 30 samples for meaningful calibration
 * @param {Array<{prob: number, outcome: number}>} data - Array of {prob, outcome} where outcome is 0 or 1
 * @param {number} lr - Learning rate
 * @param {number} iterations - Number of gradient descent iterations
 * @returns {{ a: number, b: number }} Learned calibration parameters
 */
export const learnCalibrationParams = (data, lr = 0.01, iterations = 1000) => {
  if (!data || data.length < 30) {
    return { a: 1, b: 0 }; // not enough data
  }

  const EPSILON = 1e-6;
  let a = 1;
  let b = 0;

  for (let iter = 0; iter < iterations; iter++) {
    let gradA = 0;
    let gradB = 0;

    for (const { prob, outcome } of data) {
      const p = Math.max(EPSILON, Math.min(1 - EPSILON, prob));
      const logit = Math.log(p / (1 - p));
      const calibrated = 1 / (1 + Math.exp(-(a * logit + b)));
      const error = calibrated - outcome;
      gradA += error * logit;
      gradB += error;
    }

    gradA /= data.length;
    gradB /= data.length;

    a -= lr * gradA;
    b -= lr * gradB;
  }

  return { a, b };
};

/**
 * Walk-forward calibration: learn on first splitFraction of data
 * Avoids data leakage by not training on test data
 * @param {Array<{prob: number, outcome: number}>} data - Full dataset (chronological order)
 * @param {number} splitFraction - Fraction of data to use for training (default 0.6)
 * @returns {{ a: number, b: number }} Learned calibration parameters
 */
export const learnCalibrationWalkForward = (data, splitFraction = 0.6) => {
  if (!data || data.length < 50) return { a: 1, b: 0 }; // need enough for both train and validate
  const splitIdx = Math.floor(data.length * splitFraction);
  const trainData = data.slice(0, splitIdx);
  return learnCalibrationParams(trainData);
};

/**
 * Load calibration params from localStorage
 * @returns {object|null} Calibration params or null if not found
 */
export const loadCalibrationParams = () => {
  try {
    const stored = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!stored) return null;
    const params = JSON.parse(stored);
    // Validate structure
    if (params.ml && params.spread && params.total) return params;
    return null;
  } catch {
    return null;
  }
};

/**
 * Save calibration params to localStorage
 * @param {object} params - { ml: {a, b}, spread: {a, b}, total: {a, b} }
 */
export const saveCalibrationParams = (params) => {
  try {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(params));
  } catch {
    console.error('Failed to save calibration params to localStorage');
  }
};
