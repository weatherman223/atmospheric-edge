export const debugLog = (...args) => {
  if (import.meta.env.DEV) {
    console.debug(...args);
  }
};
