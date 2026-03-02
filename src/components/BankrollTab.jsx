import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculateStats } from '../utils/betStats';
import { inputStyle, labelStyle, cardStyle } from './styles';

const BankrollTab = () => {
  const {
    bets, bankroll, setBankroll,
    kellyFraction, setKellyFraction,
    privacyMode, setPrivacyMode,
    openRouterApiKey, setOpenRouterApiKey,
    aiModel, setAiModel,
    enableWebSearch, setEnableWebSearch,
  } = useApp();

  const stats = useMemo(() => calculateStats(bets, bankroll), [bets, bankroll]);
  const pendingStaked = bets.filter(b => b.result === 'pending').reduce((sum, b) => sum + b.stake, 0);
  const settledBankroll = parseFloat(bankroll) + stats.totalProfit;
  const availableBankroll = settledBankroll - pendingStaked;

  return (
    <div className={cardStyle}>
      <h2 className="text-lg font-bold mb-4">💰 Bankroll Settings</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div><label className={labelStyle}>Starting Bankroll ($)</label><input type="number" value={bankroll} onChange={(e) => setBankroll(e.target.value)} className={inputStyle} /></div>
        <div>
          <label className={labelStyle}>Settled P/L</label>
          <div className={`p-2 border rounded-lg text-center ${stats.totalProfit >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
            <p className={`font-bold text-lg ${stats.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${settledBankroll.toFixed(0)}</p>
            <p className="text-xs text-gray-500">{stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(0)} from bets</p>
          </div>
        </div>
        <div>
          <label className={labelStyle}>At Risk</label>
          <div className={`p-2 border rounded-lg text-center ${pendingStaked > 0 ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`font-bold text-lg ${pendingStaked > 0 ? 'text-amber-600' : 'text-gray-400'}`}>${pendingStaked.toFixed(0)}</p>
            <p className="text-xs text-gray-500">{stats.pending} pending bet{stats.pending !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div>
          <label className={labelStyle}>Available (for Kelly)</label>
          <div className={`p-2 border rounded-lg text-center ${availableBankroll >= parseFloat(bankroll) ? 'bg-emerald-50 border-emerald-300' : 'bg-blue-50 border-blue-300'}`}>
            <p className={`font-bold text-lg ${availableBankroll >= parseFloat(bankroll) ? 'text-emerald-600' : 'text-blue-600'}`}>${availableBankroll.toFixed(0)}</p>
            <p className="text-xs text-gray-500">for new bets</p>
          </div>
        </div>
      </div>
      <div className="mt-4"><label className={labelStyle}>Kelly Fraction</label><select value={kellyFraction} onChange={(e) => setKellyFraction(e.target.value)} className={inputStyle}><option value="1">Full Kelly (risky)</option><option value="0.5">Half Kelly</option><option value="0.25">Quarter Kelly ✓</option><option value="0.1">Tenth Kelly (safe)</option></select></div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-emerald-50 p-3 rounded border border-emerald-200"><p className="text-xs text-gray-500">Max Bet (5%)</p><p className="font-bold text-emerald-700">${(availableBankroll*0.05).toFixed(0)}</p></div>
        <div className="bg-gray-50 p-3 rounded"><p className="text-xs text-gray-500">Standard (1%)</p><p className="font-bold">${(availableBankroll*0.01).toFixed(0)}</p></div>
        <div className="bg-gray-50 p-3 rounded"><p className="text-xs text-gray-500">Daily Limit (10%)</p><p className="font-bold">${(availableBankroll*0.1).toFixed(0)}</p></div>
        <div className="bg-gray-50 p-3 rounded"><p className="text-xs text-gray-500">Weekly (25%)</p><p className="font-bold">${(availableBankroll*0.25).toFixed(0)}</p></div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800"><strong>💾 Auto-Sync:</strong> Kelly uses your <em>available</em> bankroll (settled - pending). Limits update as bets settle.</p>
      </div>
      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={privacyMode}
            onChange={(e) => setPrivacyMode(e.target.checked)}
            className="w-4 h-4 mt-0.5 text-amber-600 rounded"
          />
          <div>
            <span className="font-medium text-amber-800">🛡️ Privacy Mode (session only)</span>
            <p className="text-xs text-amber-700">When enabled, bets, game log, and bankroll are not persisted to localStorage.</p>
          </div>
        </label>
      </div>
      <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
        <p className="text-sm text-emerald-800"><strong>📡 Live Odds:</strong> Today's Games picker fetches odds directly from ESPN — no API key required!</p>
      </div>

      {/* AI Insights API Settings */}
      <div className="mt-4 p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50">
        <h3 className="font-bold text-sm mb-2">🤖 AI Insights (OpenRouter)</h3>
        <p className="text-xs text-gray-600 mb-3">
          Get a free API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-medium">openrouter.ai/keys</a> —
          Free models: OLMo 32B, Gemma 3, Qwen3, Llama 3.2, Nova Lite
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelStyle}>API Key</label>
            <input
              type="password"
              value={openRouterApiKey}
              onChange={(e) => setOpenRouterApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className={`${inputStyle} font-mono text-sm`}
            />
          </div>
          <div>
            <label className={labelStyle}>AI Model</label>
            <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className={inputStyle}>
              <optgroup label="🆓 Free Models (Best for Sports)">
                <option value="allenai/olmo-3-32b-think:free">OLMo 3 32B Think (Best reasoning)</option>
                <option value="google/gemma-3-12b-it:free">Gemma 3 12B (Fast + Smart)</option>
                <option value="amazon/nova-lite-v1:free">Amazon Nova 2 Lite (1M context)</option>
              </optgroup>
              <optgroup label="🆓 Free Models (Smaller/Faster)">
                <option value="qwen/qwen3-4b:free">Qwen3 4B (Dual-mode reasoning)</option>
                <option value="meta-llama/llama-3.2-3b-instruct:free">Llama 3.2 3B (Multilingual)</option>
                <option value="google/gemma-3-4b-it:free">Gemma 3 4B (Multimodal)</option>
                <option value="google/gemma-3n-e4b-it:free">Gemma 3n 4B (Mobile-optimized)</option>
                <option value="google/gemma-3n-e2b-it:free">Gemma 3n 2B (Ultra-lightweight)</option>
              </optgroup>
              <optgroup label="🔍 With Built-in Search (Paid)">
                <option value="perplexity/sonar">Perplexity Sonar (Live search)</option>
                <option value="perplexity/sonar-pro">Perplexity Sonar Pro (Better)</option>
                <option value="perplexity/sonar-reasoning">Perplexity Reasoning (Multi-step)</option>
              </optgroup>
              <optgroup label="🏆 Flagship Models (Best Quality)">
                <option value="anthropic/claude-opus-4.5">Claude Opus 4.5 (Best coding/agents)</option>
                <option value="anthropic/claude-sonnet-4.5">Claude Sonnet 4.5 (Fast + smart)</option>
                <option value="openai/gpt-5.1">GPT-5.1 (Adaptive reasoning)</option>
                <option value="google/gemini-3-pro">Gemini 3 Pro (Best multimodal)</option>
              </optgroup>
              <optgroup label="💰 Paid Models (Good quality)">
                <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
                <option value="openai/gpt-4o">GPT-4o</option>
                <option value="google/gemini-2.5-flash-preview">Gemini 2.5 Flash</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Web Search Toggle */}
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enableWebSearch}
              onChange={(e) => setEnableWebSearch(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded"
            />
            <div>
              <span className="font-medium text-amber-800">🔍 Enable Web Search (+$0.02/request)</span>
              <p className="text-xs text-amber-600">Fetches real-time injury reports & news via Exa.ai</p>
            </div>
          </label>
        </div>

        {openRouterApiKey && (
          <p className="text-xs text-emerald-600 mt-2">
            ✓ API key saved • Using {aiModel.split('/').pop().split(':')[0]}
            {enableWebSearch && ' + Web Search'}
          </p>
        )}
      </div>
    </div>
  );
};

export default BankrollTab;
