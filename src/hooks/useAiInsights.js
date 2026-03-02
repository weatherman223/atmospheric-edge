import { useEffect, useState } from 'react';
import { sportConfig } from '../config';

export const useAiInsights = (sport) => {
  const [aiInsights, setAiInsights] = useState(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [showAiInsights, setShowAiInsights] = useState(true);
  const [openRouterApiKey, setOpenRouterApiKey] = useState(
    () => localStorage.getItem('openRouterApiKey') || ''
  );
  const [aiModel, setAiModel] = useState('google/gemma-3-12b-it:free');
  const [enableWebSearch, setEnableWebSearch] = useState(false);

  // Persist API key to its own localStorage key (separate from main app state)
  useEffect(() => {
    if (openRouterApiKey) {
      localStorage.setItem('openRouterApiKey', openRouterApiKey);
    } else {
      localStorage.removeItem('openRouterApiKey');
    }
  }, [openRouterApiKey]);

  const fetchAiInsights = async (awayTeam, homeTeam, gameTime) => {
    if (!openRouterApiKey) {
      setAiInsights({
        text: 'Please add your OpenRouter API key in the Bankroll Settings tab to enable AI Insights. Get a free key at openrouter.ai',
        error: true,
        needsApiKey: true,
        generatedAt: new Date().toLocaleTimeString(),
      });
      return;
    }

    setAiInsightsLoading(true);
    setAiInsights(null);

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const sportName = sportConfig[sport]?.name || sport.toUpperCase();

    const prompt = `You are a sports betting analyst providing insights for a ${sportName} game. Today is ${today}.

MATCHUP: ${awayTeam} @ ${homeTeam} (${gameTime || 'Today'})

Please provide a concise analysis with the following sections. Be specific and actionable:

1. **🏥 INJURY REPORT** (2-3 sentences max)
List any significant injuries or player availability issues for both teams. If you're unsure of current injuries, mention key players to watch and suggest the user verify injury status.

2. **📊 RECENT FORM** (2-3 sentences max)
Brief assessment of each team's recent performance, momentum, and any notable trends.

3. **⚡ SUGGESTED ADJUSTMENTS** (provide specific numbers)
Based on any known factors, suggest Elo adjustments for the betting model:
- ${homeTeam} Injury: [0 to -100, where -30=minor, -60=key player, -100=star out]
- ${homeTeam} Rest: [-30 to +30, positive=extra rest, negative=tired/back-to-back]
- ${homeTeam} Motivation: [-40 to +40, rivalry/playoffs=positive, nothing to play for=negative]
- ${awayTeam} Injury: [0 to -100]
- ${awayTeam} Rest: [-30 to +30]
- ${awayTeam} Motivation: [-40 to +40]

4. **🎯 KEY FACTORS** (3-4 bullet points)
What specific factors could swing this game? Consider:
- Matchup advantages/disadvantages
- Pace of play / style clashes
- Home court/ice/field advantage significance
- Historical head-to-head trends
- Weather (if outdoor sport)

5. **💡 BETTING ANGLE** (1-2 sentences)
One specific insight that might not be captured by the Elo model - something the market might be over/undervaluing.

Keep the entire response under 400 words. Be direct and insightful, not generic.`;

    try {
      const modelWithSearch = enableWebSearch ? `${aiModel}:online` : aiModel;

      const requestBody = {
        model: modelWithSearch,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      };

      if (enableWebSearch) {
        requestBody.plugins = [{
          id: "web",
          max_results: 5,
          search_prompt: `Web search results for ${sportName} game ${awayTeam} @ ${homeTeam} (injuries, news, recent form):`
        }];
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterApiKey}`,
          "HTTP-Referer": window.location.href,
          "X-Title": "Sports Betting Model"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const insightText = data.choices?.[0]?.message?.content || 'Unable to generate insights.';
      const modelUsed = data.model || aiModel;

      const parseAdjustment = (text, team, type) => {
        const patterns = [
          new RegExp(`${team}.*?${type}[:\\s]*([+-]?\\d+)`, 'i'),
          new RegExp(`${type}[:\\s]*([+-]?\\d+).*?${team}`, 'i'),
        ];
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) return parseInt(match[1]);
        }
        return 0;
      };

      setAiInsights({
        text: insightText,
        model: modelUsed,
        webSearchUsed: enableWebSearch,
        suggestions: {
          team1Injury: parseAdjustment(insightText, homeTeam.split(' ').pop(), 'Injury'),
          team1Rest: parseAdjustment(insightText, homeTeam.split(' ').pop(), 'Rest'),
          team1Motivation: parseAdjustment(insightText, homeTeam.split(' ').pop(), 'Motivation'),
          team2Injury: parseAdjustment(insightText, awayTeam.split(' ').pop(), 'Injury'),
          team2Rest: parseAdjustment(insightText, awayTeam.split(' ').pop(), 'Rest'),
          team2Motivation: parseAdjustment(insightText, awayTeam.split(' ').pop(), 'Motivation'),
        },
        generatedAt: new Date().toLocaleTimeString(),
      });

    } catch (err) {
      console.error('Failed to fetch AI insights:', err);
      setAiInsights({
        text: `Error: ${err.message}. Check your API key and try again.`,
        error: true,
        generatedAt: new Date().toLocaleTimeString(),
      });
    }

    setAiInsightsLoading(false);
  };

  return {
    aiInsights, setAiInsights,
    aiInsightsLoading,
    showAiInsights, setShowAiInsights,
    openRouterApiKey, setOpenRouterApiKey,
    aiModel, setAiModel,
    enableWebSearch, setEnableWebSearch,
    fetchAiInsights,
  };
};
