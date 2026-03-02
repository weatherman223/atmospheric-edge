export const STORAGE_KEY = 'sportsBettingModel';

export const loadAppState = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
};

export const saveAppState = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
