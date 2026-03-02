import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SportsBettingModelPro from './App';
import { AppProvider } from './context/AppContext';
import React from 'react';

let localStorageData = {};

const installLocalStorageMock = () => {
  localStorageData = {};
  const mock = {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(localStorageData, key) ? localStorageData[key] : null),
    setItem: (key, value) => {
      localStorageData[key] = String(value);
    },
    removeItem: (key) => {
      delete localStorageData[key];
    },
    clear: () => {
      localStorageData = {};
    },
  };
  vi.stubGlobal('localStorage', mock);
  return mock;
};

const getSavedState = () => {
  const raw = localStorage.getItem('sportsBettingModel');
  return raw ? JSON.parse(raw) : null;
};

const renderApp = () => render(
  React.createElement(AppProvider, null, React.createElement(SportsBettingModelPro))
);

const clearSavedStorage = () => {
  localStorage.removeItem('sportsBettingModel');
  localStorage.removeItem('injuryCache');
};

const completedEspnGamePayload = {
  events: [
    {
      id: 'test-event-1',
      competitions: [
        {
          status: {
            type: {
              completed: true,
              detail: 'Final'
            },
            period: 4,
          },
          competitors: [
            {
              homeAway: 'home',
              team: {
                displayName: 'New England Patriots',
              },
              score: '24',
            },
            {
              homeAway: 'away',
              team: {
                displayName: 'Denver Broncos',
              },
              score: '17',
            },
          ],
        },
      ],
    },
  ],
};

describe('App-level workflows', () => {
  beforeEach(() => {
    installLocalStorageMock();
    clearSavedStorage();
    vi.restoreAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updates ratings and logs a manual result', async () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /results/i }));

    const recordCard = screen.getByRole('heading', { name: /record result/i }).parentElement;
    const selects = within(recordCard).getAllByRole('combobox');
    const scoreInputs = within(recordCard).getAllByRole('spinbutton');

    fireEvent.change(selects[0], { target: { value: 'New England Patriots' } });
    fireEvent.change(selects[1], { target: { value: 'Denver Broncos' } });
    fireEvent.change(scoreInputs[0], { target: { value: '27' } });
    fireEvent.change(scoreInputs[1], { target: { value: '20' } });

    fireEvent.click(within(recordCard).getByRole('button', { name: /update ratings/i }));

    expect(await screen.findByText(/New England Patriots vs Denver Broncos/i)).toBeInTheDocument();

    await waitFor(() => {
      const saved = getSavedState();
      expect(saved?.gameLog?.length).toBe(1);
      expect(saved?.gameLog?.[0]?.t1Changes).toBeTruthy();
      expect(saved?.gameLog?.[0]?.t2Changes).toBeTruthy();
    });
  });

  it('imports selected ESPN games into game log', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => completedEspnGamePayload,
    }));

    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /results/i }));
    fireEvent.click(screen.getByRole('button', { name: /fetch nfl 2025 scores/i }));

    const importButton = await screen.findByRole('button', { name: /import selected \(1\)/i });
    fireEvent.click(importButton);

    expect(await screen.findByText(/New England Patriots vs Denver Broncos/i)).toBeInTheDocument();

    await waitFor(() => {
      const saved = getSavedState();
      expect(saved?.gameLog?.length).toBe(1);
      expect(saved?.gameLog?.[0]?.eventId).toBe('test-event-1');
    });
  });

  it('resets current sport data while preserving other sports', async () => {
    localStorage.setItem('sportsBettingModel', JSON.stringify({
      sport: 'nfl',
      teamsBySport: {
        nfl: {
          'New England Patriots': { elo: 1200, off: 99, def: 101 },
          'Denver Broncos': { elo: 1800, off: 101, def: 99 },
        },
        nba: {
          'Boston Celtics': { elo: 1540, off: 110, def: 106 },
          'Miami Heat': { elo: 1595, off: 104, def: 94 },
        },
      },
      bets: [
        {
          id: 1,
          sport: 'nfl',
          game: 'NE vs DEN',
          betType: 'ML',
          pick: 'NE',
          odds: -110,
          stake: 50,
          result: 'pending',
          payout: 0,
        },
        {
          id: 2,
          sport: 'nba',
          game: 'BOS vs MIA',
          betType: 'ML',
          pick: 'BOS',
          odds: -110,
          stake: 50,
          result: 'pending',
          payout: 0,
        },
      ],
      gameLog: [
        { sport: 'nfl', team1: 'New England Patriots', team2: 'Denver Broncos', score: '24-17' },
        { sport: 'nba', team1: 'Boston Celtics', team2: 'Miami Heat', score: '101-99' },
      ],
      bankroll: '1500',
      kellyFraction: '0.25',
      aiModel: 'google/gemma-3-12b-it:free',
      enableWebSearch: false,
      privacyMode: false,
    }));

    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /ratings/i }));
    fireEvent.click(screen.getByRole('button', { name: /reset nfl 2025/i }));

    await waitFor(() => {
      const saved = getSavedState();
      expect(saved?.teamsBySport?.nfl?.['New England Patriots']?.elo).toBe(1680);
      expect(saved?.bets).toHaveLength(1);
      expect(saved?.bets?.[0]?.sport).toBe('nba');
      expect(saved?.gameLog).toHaveLength(1);
      expect(saved?.gameLog?.[0]?.sport).toBe('nba');
    });
  });

  it('privacy mode keeps bankroll and history out of persisted storage', async () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /bankroll/i }));

    const privacyToggle = screen.getByRole('checkbox', { name: /privacy mode/i });
    fireEvent.click(privacyToggle);

    const bankrollInput = screen.getByDisplayValue('1000');
    fireEvent.change(bankrollInput, { target: { value: '2500' } });

    await waitFor(() => {
      const saved = getSavedState();
      expect(saved?.privacyMode).toBe(true);
      expect(saved).not.toHaveProperty('bankroll');
      expect(saved?.bets).toEqual([]);
      expect(saved?.gameLog).toEqual([]);
    });
  });
});
