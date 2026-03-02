// Test setup file for Vitest
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test case (for React component tests)
afterEach(() => {
  cleanup();
});
