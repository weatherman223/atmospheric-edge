import { useState, useRef, useEffect } from 'react';
import { espnTeamIds, injuryEndpoints, ESPN_ALLOWED_REF_HOSTS, INJURY_CACHE_KEY, CACHE_DURATION_MS } from '../config';
import { calculateInjuryImpact } from '../utils/injuries';

export const useInjuries = ({ team1, team2, sport, useAutoInjuries, setTeam1Injury, setTeam2Injury }) => {
  const [team1Injuries, setTeam1Injuries] = useState([]);
  const [team2Injuries, setTeam2Injuries] = useState([]);
  const [team1InjuryAuto, setTeam1InjuryAuto] = useState(0);
  const [team2InjuryAuto, setTeam2InjuryAuto] = useState(0);
  const [injuriesLoading, setInjuriesLoading] = useState(false);
  const [injuriesError, setInjuriesError] = useState('');
  const injuriesAbortControllerRef = useRef(null);

  const fetchEspnRefJson = async (refUrl, signal) => {
    if (!refUrl) return null;

    let parsedUrl;
    try {
      parsedUrl = new URL(refUrl);
    } catch {
      return null;
    }

    const isAllowedHost = ESPN_ALLOWED_REF_HOSTS.has(parsedUrl.hostname);
    if (parsedUrl.protocol !== 'https:' || !isAllowedHost) {
      console.warn('Blocked untrusted ESPN $ref URL:', refUrl);
      return null;
    }

    const response = await fetch(refUrl, { signal });
    if (!response.ok) return null;
    return response.json();
  };

  const getInjuryCache = () => {
    try {
      const cached = localStorage.getItem(INJURY_CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  };

  const getCachedInjuries = (sp, teamId) => {
    const cache = getInjuryCache();
    const entry = cache[`${sp}_${teamId}`];
    if (!entry || Date.now() - entry.timestamp > CACHE_DURATION_MS) return null;
    return entry.data;
  };

  const cacheInjuries = (sp, teamId, injuries) => {
    const cache = getInjuryCache();
    cache[`${sp}_${teamId}`] = { data: injuries, timestamp: Date.now() };
    const entries = Object.entries(cache);
    if (entries.length > 50) {
      const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      localStorage.setItem(INJURY_CACHE_KEY, JSON.stringify(Object.fromEntries(sorted.slice(0, 50))));
    } else {
      localStorage.setItem(INJURY_CACHE_KEY, JSON.stringify(cache));
    }
  };

  const fetchTeamInjuries = async (sp, teamId, signal) => {
    const endpoint = injuryEndpoints[sp];
    if (!endpoint) return [];

    try {
      const url = endpoint.replace('{teamId}', teamId);
      const response = await fetch(url, { signal });
      if (!response.ok) return [];
      const data = await response.json();

      if (!data.items?.length) return [];

      const injuries = await Promise.all(
        data.items.slice(0, 15).map(async (item) => {
          try {
            const detail = await fetchEspnRefJson(item.$ref, signal);
            if (!detail) return null;

            let athleteInfo = {};
            let gamesPlayed = 0;
            if (detail.athlete?.$ref) {
              athleteInfo = await fetchEspnRefJson(detail.athlete.$ref, signal) || {};

              let statsFound = false;
              if (athleteInfo.statistics?.$ref) {
                try {
                  const statsData = await fetchEspnRefJson(athleteInfo.statistics.$ref, signal);
                  if (!statsData) throw new Error('Stats reference unavailable');
                  const findGP = (obj) => {
                    if (!obj) return null;
                    if (Array.isArray(obj.stats)) {
                      const gp = obj.stats.find(s =>
                        s.name?.toLowerCase().includes('gamesplayed') ||
                        s.name === 'GP' ||
                        s.abbreviation === 'GP'
                      );
                      if (gp?.value) return gp.value;
                    }
                    if (obj.splits?.categories) {
                      for (const cat of obj.splits.categories) {
                        const gp = cat.stats?.find(s =>
                          s.name?.toLowerCase().includes('gamesplayed') ||
                          s.name === 'GP' ||
                          s.abbreviation === 'GP'
                        );
                        if (gp?.value) return gp.value;
                      }
                    }
                    return null;
                  };
                  const gpValue = findGP(statsData);
                  if (gpValue !== null) {
                    gamesPlayed = gpValue;
                    statsFound = true;
                  }
                } catch (error) {
                  if (error?.name === 'AbortError') throw error;
                }
              }
              if (!statsFound && athleteInfo.experience?.years > 0) {
                gamesPlayed = 20;
              }
            }

            return {
              player: athleteInfo.displayName || 'Unknown',
              position: athleteInfo.position?.abbreviation || 'UNK',
              status: detail.status || 'Unknown',
              injury: detail.type?.description || detail.type?.name || 'Undisclosed',
              gamesPlayed,
              experience: athleteInfo.experience?.years || 0
            };
          } catch (error) {
            if (error?.name === 'AbortError') throw error;
            return null;
          }
        })
      );

      return injuries.filter(inj => {
        if (!inj) return false;
        const status = (inj.status || '').toLowerCase();
        return !status.includes('active') && status !== 'healthy';
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      console.warn(`Failed to fetch injuries for ${sp} team ${teamId}:`, error);
      return [];
    }
  };

  const fetchMatchupInjuries = async () => {
    if (!team1 || !team2) return;

    const teamIds = espnTeamIds[sport];
    if (!teamIds) {
      injuriesAbortControllerRef.current?.abort();
      injuriesAbortControllerRef.current = null;
      setInjuriesLoading(false);
      setInjuriesError('Injury data not available for this sport');
      return;
    }

    const t1Id = teamIds[team1];
    const t2Id = teamIds[team2];

    if (!t1Id || !t2Id) {
      injuriesAbortControllerRef.current?.abort();
      injuriesAbortControllerRef.current = null;
      setInjuriesLoading(false);
      setInjuriesError('Team not found in ESPN database');
      return;
    }

    injuriesAbortControllerRef.current?.abort();
    const controller = new AbortController();
    injuriesAbortControllerRef.current = controller;
    const { signal } = controller;

    setInjuriesLoading(true);
    setInjuriesError('');

    try {
      let t1Inj = getCachedInjuries(sport, t1Id);
      let t2Inj = getCachedInjuries(sport, t2Id);

      if (!t1Inj) {
        t1Inj = await fetchTeamInjuries(sport, t1Id, signal);
        cacheInjuries(sport, t1Id, t1Inj);
      }
      if (!t2Inj) {
        t2Inj = await fetchTeamInjuries(sport, t2Id, signal);
        cacheInjuries(sport, t2Id, t2Inj);
      }

      if (signal.aborted) return;

      setTeam1Injuries(t1Inj);
      setTeam2Injuries(t2Inj);

      const t1Impact = calculateInjuryImpact(t1Inj, sport);
      const t2Impact = calculateInjuryImpact(t2Inj, sport);

      setTeam1InjuryAuto(t1Impact.totalImpact);
      setTeam2InjuryAuto(t2Impact.totalImpact);

      if (useAutoInjuries) {
        setTeam1Injury(t1Impact.totalImpact);
        setTeam2Injury(t2Impact.totalImpact);
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setInjuriesError('Failed to fetch injury data');
      console.error('Injury fetch error:', error);
    } finally {
      if (injuriesAbortControllerRef.current === controller) {
        injuriesAbortControllerRef.current = null;
        setInjuriesLoading(false);
      }
    }
  };

  // Fetch injuries when matchup changes
  useEffect(() => {
    if (team1 && team2 && espnTeamIds[sport]) {
      fetchMatchupInjuries();
    } else {
      injuriesAbortControllerRef.current?.abort();
      injuriesAbortControllerRef.current = null;
      setInjuriesLoading(false);
      setTeam1Injuries([]);
      setTeam2Injuries([]);
      setTeam1InjuryAuto(0);
      setTeam2InjuryAuto(0);
    }
  // Only re-fetch when team selections or sport change. Including fetchMatchupInjuries would cause circular re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team1, team2, sport]);

  return {
    team1Injuries, team2Injuries,
    team1InjuryAuto, team2InjuryAuto,
    injuriesLoading, injuriesError,
    injuriesAbortControllerRef,
    fetchMatchupInjuries,
  };
};
