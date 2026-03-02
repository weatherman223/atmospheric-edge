import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculateCLV } from '../utils/calculations';
import { calculateStats } from '../utils/betStats';
import { sportConfig } from '../config';
import { inputStyle, labelStyle, cardStyle } from './styles';

const TrackerTab = () => {
  const {
    bets, bankroll,
    newBet, setNewBet,
    editingBet, setEditingBet,
    addBetError,
    addBet, updateBetResult, deleteBet,
    startEditBet, saveEditBet, cancelEditBet,
  } = useApp();

  const stats = useMemo(() => calculateStats(bets, bankroll), [bets, bankroll]);

  return (
    <div className="space-y-4">
      {/* P/L Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Record</p><p className="font-bold text-lg">{stats.wins}-{stats.losses}-{stats.pushes}</p></div>
        <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Win Rate</p><p className="font-bold text-lg">{stats.winRate.toFixed(1)}%</p></div>
        <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Total Staked</p><p className="font-bold text-lg">${stats.totalStaked.toFixed(0)}</p></div>
        <div className={`rounded-lg p-3 text-center ${stats.totalProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}><p className="text-xs text-gray-500">Profit/Loss</p><p className={`font-bold text-lg ${stats.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(2)}</p></div>
        <div className={`rounded-lg p-3 text-center ${stats.roi >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}><p className="text-xs text-gray-500">ROI</p><p className={`font-bold text-lg ${stats.roi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%</p></div>
        <div className={`rounded-lg p-3 text-center ${stats.units >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}><p className="text-xs text-gray-500">Units</p><p className={`font-bold text-lg ${stats.units >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{stats.units >= 0 ? '+' : ''}{stats.units.toFixed(1)}u</p></div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Pending</p><p className="font-bold text-lg text-yellow-600">{stats.pending}</p></div>
        <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Bankroll</p><p className="font-bold text-lg text-blue-600">${(parseFloat(bankroll) + stats.totalProfit - bets.filter(b => b.result === 'pending').reduce((sum, b) => sum + b.stake, 0)).toFixed(0)}</p></div>
      </div>

      {/* CLV Dashboard */}
      {stats.clvCount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className={`rounded-lg p-3 text-center ${stats.avgCLV >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <p className="text-xs text-gray-500">Avg CLV</p>
            <p className={`font-bold text-lg ${stats.avgCLV >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.avgCLV >= 0 ? '+' : ''}{stats.avgCLV.toFixed(2)}%
            </p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">CLV Record</p>
            <p className="font-bold text-lg">{stats.positiveCLV}-{stats.negativeCLV}</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">CLV Win%</p>
            <p className="font-bold text-lg">{stats.clvWinRate.toFixed(0)}%</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Bets w/ CLV</p>
            <p className="font-bold text-lg text-indigo-600">{stats.clvCount}</p>
          </div>
        </div>
      )}

      {/* Add New Bet */}
      <div className={cardStyle}>
        <h2 className="text-lg font-bold mb-3">➕ Log New Bet</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-2">
          <div><label className={labelStyle}>Date</label><input type="date" value={newBet.date} onChange={(e) => setNewBet({...newBet, date: e.target.value})} className={inputStyle} /></div>
          <div><label className={labelStyle}>Sport</label><select value={newBet.sport} onChange={(e) => setNewBet({...newBet, sport: e.target.value})} className={inputStyle}>{Object.keys(sportConfig).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}</select></div>
          <div><label className={labelStyle}>Game</label><input type="text" value={newBet.game} onChange={(e) => setNewBet({...newBet, game: e.target.value})} placeholder="NE vs DEN" className={inputStyle} /></div>
          <div><label className={labelStyle}>Type</label><select value={newBet.betType} onChange={(e) => setNewBet({...newBet, betType: e.target.value})} className={inputStyle}><option>ML</option><option>Spread</option><option>Over</option><option>Under</option></select></div>
          <div><label className={labelStyle}>Pick</label><input type="text" value={newBet.pick} onChange={(e) => setNewBet({...newBet, pick: e.target.value})} placeholder="Patriots -3" className={inputStyle} /></div>
          <div><label className={labelStyle}>Odds</label><input type="text" value={newBet.odds} onChange={(e) => setNewBet({...newBet, odds: e.target.value})} placeholder="-110" className={inputStyle} /></div>
          <div><label className={labelStyle}>Close</label><input type="text" value={newBet.closingOdds} onChange={(e) => setNewBet({...newBet, closingOdds: e.target.value})} placeholder="-115" className={inputStyle} title="Closing line odds (optional, for CLV tracking)" /></div>
          <div><label className={labelStyle}>Stake ($)</label><input type="number" value={newBet.stake} onChange={(e) => setNewBet({...newBet, stake: e.target.value})} placeholder="25" className={inputStyle} /></div>
          <div><label className={labelStyle}>&nbsp;</label><button onClick={addBet} className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600">Add</button></div>
        </div>
        {addBetError && (
          <p role="alert" aria-live="polite" className="text-xs text-red-600 mt-2">
            {addBetError}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-2">💡 Enter closing odds after game starts to track CLV (Closing Line Value)</p>
      </div>

      {/* Edit Bet Modal */}
      {editingBet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-lg font-bold mb-4">✏️ Edit Bet</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelStyle}>Date</label><input type="date" value={editingBet.date} onChange={(e) => setEditingBet({...editingBet, date: e.target.value})} className={inputStyle} /></div>
                <div><label className={labelStyle}>Sport</label>
                  <select value={editingBet.sport} onChange={(e) => setEditingBet({...editingBet, sport: e.target.value})} className={inputStyle}>
                    {Object.keys(sportConfig).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div><label className={labelStyle}>Game</label><input type="text" value={editingBet.game} onChange={(e) => setEditingBet({...editingBet, game: e.target.value})} className={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelStyle}>Bet Type</label>
                  <select value={editingBet.betType} onChange={(e) => setEditingBet({...editingBet, betType: e.target.value})} className={inputStyle}>
                    <option value="ML">Moneyline</option><option value="Spread">Spread</option><option value="Total">Total</option><option value="Prop">Prop</option><option value="Parlay">Parlay</option>
                  </select>
                </div>
                <div><label className={labelStyle}>Pick</label><input type="text" value={editingBet.pick} onChange={(e) => setEditingBet({...editingBet, pick: e.target.value})} className={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={labelStyle}>Odds</label><input type="text" value={editingBet.odds} onChange={(e) => setEditingBet({...editingBet, odds: e.target.value})} placeholder="-110" className={inputStyle} /></div>
                <div><label className={labelStyle}>Closing Odds</label><input type="text" value={editingBet.closingOdds || ''} onChange={(e) => setEditingBet({...editingBet, closingOdds: e.target.value})} placeholder="-115" className={inputStyle} /></div>
                <div><label className={labelStyle}>Stake ($)</label><input type="number" value={editingBet.stake} onChange={(e) => setEditingBet({...editingBet, stake: e.target.value})} className={inputStyle} /></div>
              </div>
              <p className="text-xs text-gray-400">💡 Add closing odds after the game starts to track CLV</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveEditBet} className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600">Save Changes</button>
              <button onClick={cancelEditBet} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bet History */}
      <div className={cardStyle}>
        <h2 className="text-lg font-bold mb-3">📋 Bet History</h2>
        {bets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-gray-500"><th className="p-2">Date</th><th className="p-2">Sport</th><th className="p-2">Game</th><th className="p-2">Pick</th><th className="p-2">Odds</th><th className="p-2">CLV</th><th className="p-2">Stake</th><th className="p-2">Result</th><th className="p-2">P/L</th><th className="p-2">Actions</th></tr></thead>
              <tbody>
                {bets.slice().reverse().map(bet => {
                  const clv = calculateCLV(bet.odds, bet.closingOdds);
                  return (
                  <tr key={bet.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{bet.date}</td>
                    <td className="p-2 uppercase">{bet.sport}</td>
                    <td className="p-2">{bet.game}</td>
                    <td className="p-2 font-medium">{bet.pick}</td>
                    <td className="p-2">{bet.odds}{bet.closingOdds && <span className="text-gray-400 text-xs ml-1">→{bet.closingOdds}</span>}</td>
                    <td className="p-2">
                      {clv !== null ? (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${clv >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {clv >= 0 ? '+' : ''}{clv.toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="p-2">${bet.stake}</td>
                    <td className="p-2">
                      <select value={bet.result} onChange={(e) => updateBetResult(bet.id, e.target.value)} className={`text-xs p-1 rounded ${bet.result === 'win' ? 'bg-emerald-100 text-emerald-700' : bet.result === 'loss' ? 'bg-red-100 text-red-700' : bet.result === 'push' ? 'bg-gray-100' : 'bg-yellow-100 text-yellow-700'}`}>
                        <option value="pending">Pending</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="push">Push</option>
                      </select>
                    </td>
                    <td className={`p-2 font-bold ${bet.payout > 0 ? 'text-emerald-600' : bet.payout < 0 ? 'text-red-600' : ''}`}>{bet.result !== 'pending' ? (bet.payout >= 0 ? '+' : '') + '$' + bet.payout.toFixed(2) : '-'}</td>
                    <td className="p-2 flex gap-1"><button onClick={() => startEditBet(bet)} className="text-blue-500 hover:text-blue-700 text-xs">✏️</button><button onClick={() => deleteBet(bet.id)} className="text-red-500 hover:text-red-700 text-xs">🗑️</button></td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        ) : <p className="text-gray-400 text-center py-8">No bets logged yet. Add your first bet above!</p>}
      </div>
    </div>
  );
};

export default TrackerTab;
