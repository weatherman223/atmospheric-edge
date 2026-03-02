import { useEffect, useState } from 'react';
import { americanToDecimal } from '../utils/calculations';
import { getLocalDateString } from '../utils/date';

export const useBets = (sport) => {
  const [bets, setBets] = useState([]);
  const [newBet, setNewBet] = useState({
    date: getLocalDateString(),
    sport,
    game: '',
    betType: 'ML',
    pick: '',
    odds: '',
    closingOdds: '',
    stake: '',
    result: 'pending',
    payout: 0
  });
  const [editingBet, setEditingBet] = useState(null);
  const [addBetError, setAddBetError] = useState('');

  // Sync newBet.sport when user switches the active sport
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewBet(prev => prev.sport === sport ? prev : { ...prev, sport });
  }, [sport]);

  const addBet = () => {
    const missingFields = [];
    if (!newBet.game.trim()) missingFields.push('game');
    if (!newBet.pick.trim()) missingFields.push('pick');
    if (!newBet.odds.toString().trim()) missingFields.push('odds');
    if (!newBet.stake.toString().trim()) missingFields.push('stake');
    if (missingFields.length > 0) {
      setAddBetError(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    const parsedStake = parseFloat(newBet.stake);
    if (!Number.isFinite(parsedStake) || parsedStake <= 0) {
      setAddBetError('Stake must be a positive number.');
      return;
    }

    setAddBetError('');
    const bet = { ...newBet, id: Date.now(), stake: parsedStake, odds: newBet.odds, closingOdds: newBet.closingOdds };
    setBets(prev => [...prev, bet]);
    setNewBet({ date: getLocalDateString(), sport: sport, game: '', betType: 'ML', pick: '', odds: '', closingOdds: '', stake: '', result: 'pending', payout: 0 });
  };

  const updateBetResult = (id, result) => {
    setBets(prev => prev.map(bet => {
      if (bet.id !== id) return bet;
      let payout = 0;
      if (result === 'win') {
        const decimal = americanToDecimal(bet.odds);
        payout = bet.stake * (decimal - 1);
      } else if (result === 'loss') {
        payout = -bet.stake;
      } else if (result === 'push') {
        payout = 0;
      }
      return { ...bet, result, payout };
    }));
  };

  const deleteBet = (id) => setBets(prev => prev.filter(b => b.id !== id));

  const startEditBet = (bet) => {
    setEditingBet({ ...bet, stake: bet.stake.toString() });
  };

  const saveEditBet = () => {
    if (!editingBet) return;
    setBets(prev => prev.map(bet => {
      if (bet.id !== editingBet.id) return bet;
      const updatedBet = {
        ...editingBet,
        stake: parseFloat(editingBet.stake)
      };
      if (updatedBet.result === 'win') {
        const decimal = americanToDecimal(updatedBet.odds);
        updatedBet.payout = updatedBet.stake * (decimal - 1);
      } else if (updatedBet.result === 'loss') {
        updatedBet.payout = -updatedBet.stake;
      } else if (updatedBet.result === 'push') {
        updatedBet.payout = 0;
      }
      return updatedBet;
    }));
    setEditingBet(null);
  };

  const cancelEditBet = () => setEditingBet(null);

  return {
    bets, setBets,
    newBet, setNewBet,
    editingBet, setEditingBet,
    addBetError,
    addBet, updateBetResult, deleteBet,
    startEditBet, saveEditBet, cancelEditBet,
  };
};
