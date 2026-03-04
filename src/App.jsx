import { useApp } from './context/AppContext';
import AnalyzeTab from './components/AnalyzeTab';
import BankrollTab from './components/BankrollTab';
import RatingsTab from './components/RatingsTab';
import TrackerTab from './components/TrackerTab';
import ResultsTab from './components/ResultsTab';
import { sportConfig } from './config';

const SportsBettingModelPro = () => {
  const {
    activeTab, setActiveTab,
    sport, setSport,
    privacyMode,
  } = useApp();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-3">
      <div className="max-w-7xl mx-auto space-y-3">
        <div className="text-center py-3">
          <h1 className="text-2xl font-bold text-white mb-1">🎯 Sports Betting Model Pro</h1>
          <p className="text-blue-200 text-sm">2025-26 Season • Verified Ratings • Bet Tracker • Auto-Save</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {Object.entries(sportConfig).map(([key, cfg]) => (
            <button key={key} onClick={() => setSport(key)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${sport === key ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}>{cfg.name}</button>
          ))}
        </div>

        <div className="flex gap-1 justify-center flex-wrap">
          {['analyze', 'tracker', 'ratings', 'results', 'bankroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {tab === 'analyze' && '🎯 Analyze'}{tab === 'tracker' && '📈 Tracker'}{tab === 'ratings' && '📊 Ratings'}{tab === 'results' && '📝 Results'}{tab === 'bankroll' && '💰 Bankroll'}
            </button>
          ))}
        </div>

        {activeTab === 'analyze' && <AnalyzeTab />}

        {activeTab === 'tracker' && <TrackerTab />}

        {activeTab === 'ratings' && <RatingsTab />}

        {activeTab === 'results' && <ResultsTab />}

        {activeTab === 'bankroll' && <BankrollTab />}

        <div className="text-center text-xs text-blue-200 py-2">{privacyMode ? 'Privacy mode enabled • Sensitive data stays in session memory' : 'Data auto-saves to browser'} • Ratings from Nov 28, 2025 • Bet responsibly • Made with ❤️ by Zachary Miller</div>
      </div>
    </div>
  );
};

export default SportsBettingModelPro;
