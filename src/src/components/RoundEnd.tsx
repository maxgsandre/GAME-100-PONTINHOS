import { useState, useEffect } from 'react';
import { Trophy, RotateCcw, Play } from 'lucide-react';
import {
  Room,
  Player,
  Hand,
  subscribeToPlayers,
  subscribeToHand,
} from '../lib/firestoreGame';
import { Card, generateDoubleDeck, shuffleDeck } from '../lib/deck';
import { calculateHandPoints } from '../lib/rules';
import { runTransaction, doc, deleteField, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../app/store';
import { useDialog } from '../contexts/DialogContext';

interface RoundEndProps {
  room: Room;
}

export function RoundEnd({ room }: RoundEndProps) {
  const { confirm, alert } = useDialog();
  const userId = useAppStore(state => state.userId);
  const [players, setPlayers] = useState<Player[]>([]);
  const [hands, setHands] = useState<Record<string, Hand>>({});
  const [processing, setProcessing] = useState(false);

  const isOwner = room.ownerId === userId;
  const winner = players.find(p => p.id === room.winnerId);

  useEffect(() => {
    const unsubscribePlayers = subscribeToPlayers(room.id, setPlayers);

    // Subscribe to all hands to calculate points
    const unsubscribes = room.playerOrder.map(playerId => {
      return subscribeToHand(room.id, playerId, (hand) => {
        setHands(prev => ({ ...prev, [playerId]: hand }));
      });
    });

    return () => {
      unsubscribePlayers();
      unsubscribes.forEach(unsub => unsub());
    };
  }, [room.id, room.playerOrder]);

  // Calculate scores
  const scores = room.playerOrder.map(playerId => {
    const player = players.find(p => p.id === playerId);
    const hand = hands[playerId];
    const points = hand ? calculateHandPoints(hand.cards, room.rules) : 0;
    const isWinner = playerId === room.winnerId;

    return {
      playerId,
      playerName: player?.name || 'Jogador',
      roundPoints: isWinner ? 0 : points,
      totalScore: (player?.score || 0) + (isWinner ? 0 : points),
    };
  });

  const handleNextRound = async () => {
    if (!isOwner || processing) return;

    try {
      setProcessing(true);

      // Update player scores and start new round in ONE transaction
      // This avoids the intermediate 'lobby' state and permission issues
      await runTransaction(db, async (transaction) => {
        const roomRef = doc(db, 'rooms', room.id);
        const roomDoc = await transaction.get(roomRef);

        if (!roomDoc.exists()) {
          throw new Error('Sala não encontrada');
        }

        const roomData = roomDoc.data() as Room;

        // Verify it's still roundEnd
        if (roomData.status !== 'roundEnd') {
          throw new Error('Status da sala mudou. Recarregue a página.');
        }

        // Read all player documents
        const playerDocs: any[] = [];
        for (const playerId of roomData.playerOrder) {
          const playerRef = doc(db, 'rooms', room.id, 'players', playerId);
          const playerDoc = await transaction.get(playerRef);
          if (playerDoc.exists()) {
            playerDocs.push(playerDoc);
          }
        }

        // Update each player's score and reset game state
        for (const score of scores) {
          const playerRef = doc(db, 'rooms', room.id, 'players', score.playerId);
          transaction.update(playerRef, {
            score: score.totalScore,
            hasDrawnThisTurn: false,
            isBlocked: false,
          });
        }

        // Generate and shuffle deck
        const deck = shuffleDeck(generateDoubleDeck());

        // Deal 9 cards to each player
        const playerOrder = roomData.playerOrder;
        const hands: Record<string, Card[]> = {};

        playerOrder.forEach((playerId, index) => {
          hands[playerId] = deck.slice(index * 9, (index + 1) * 9);
        });

        // Delete all melds from previous round
        const meldsRef = collection(db, 'rooms', room.id, 'melds');
        const meldsSnapshot = await getDocs(meldsRef);
        meldsSnapshot.forEach((meldDoc) => {
          transaction.delete(meldDoc.ref);
        });

        // Remaining cards go to stock
        const stock = deck.slice(playerOrder.length * 9);
        
        // First card of stock goes to discard
        const firstDiscard = stock.pop()!;
        const discard = [firstDiscard];

        // Increment round
        const currentRound = roomData.round || 0;
        const newRound = currentRound + 1;

        // Definir quem começa: vencedor anterior, se existir na ordem
        const winnerIndex = roomData.winnerId
          ? roomData.playerOrder.indexOf(roomData.winnerId)
          : -1;
        const startingTurnIndex = winnerIndex >= 0 ? winnerIndex : 0;

        // Update room to start new round
        // Use deleteField() to remove winnerId and pausedBy instead of setting to null
        transaction.update(roomRef, {
          status: 'playing',
          round: newRound,
          turnIndex: startingTurnIndex,
          discardTop: firstDiscard,
          lastAction: 'Jogo iniciado',
          firstPassComplete: false,
          isPaused: false,
          pausedBy: deleteField(),
          winnerId: deleteField(),
        });

        // Create hands
        for (const playerId of playerOrder) {
          const handRef = doc(db, 'rooms', room.id, 'hands', playerId);
          transaction.set(handRef, { cards: hands[playerId] });
        }

        // Create deck state
        const deckRef = doc(db, 'rooms', room.id, 'state', 'deck');
        transaction.set(deckRef, { stock, discard });
      });
    } catch (error: any) {
      console.error('Error starting next round:', error);
      await alert({ message: error.message || 'Erro ao iniciar próxima rodada' });
      setProcessing(false);
    }
  };

  const handleResetScores = async () => {
    if (!isOwner || processing) return;

    const confirmed = await confirm({
      title: 'Confirmar reinício',
      message: 'Tem certeza que deseja reiniciar o placar?',
      confirmText: 'Reiniciar',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    
    if (!confirmed) return;

    try {
      setProcessing(true);

      await runTransaction(db, async (transaction) => {
        const roomRef = doc(db, 'rooms', room.id);

        // Reset all player scores
        for (const playerId of room.playerOrder) {
          const playerRef = doc(db, 'rooms', room.id, 'players', playerId);
          transaction.update(playerRef, {
            score: 0,
          });
        }

        // Reset room
        transaction.update(roomRef, {
          status: 'lobby',
          round: 0,
          winnerId: null,
          lastAction: 'Placar reiniciado',
        });
      });
    } catch (error: any) {
      console.error('Error resetting scores:', error);
      await alert({ message: error.message || 'Erro ao reiniciar placar' });
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Trophy className="text-yellow-500" size={64} />
            </div>
            <h1 className="text-green-700 mb-2">Fim da Rodada {room.round}!</h1>
            <p className="text-xl text-gray-900 font-semibold">
              {winner?.name} bateu! 🎉
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <h3 className="text-gray-700">Pontuação da Rodada</h3>
            {scores
              .sort((a, b) => a.totalScore - b.totalScore)
              .map((score) => (
                <div
                  key={score.playerId}
                  className={`
                  p-4 rounded-lg flex justify-between items-center
                  ${score.playerId === room.winnerId ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-50'}
                `}
                >
                  <div>
                    <p className="text-gray-900 font-semibold">
                      {score.playerName}
                      {score.playerId === userId && ' (Você)'}
                    </p>
                    <p className="text-sm text-gray-600">
                      +{score.roundPoints} pontos nesta rodada
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl">{score.totalScore}</p>
                    <p className="text-xs text-gray-500">total</p>
                  </div>
                </div>
              ))}
          </div>

          {isOwner && (
            <div className="space-y-3">
              <button
                onClick={handleNextRound}
                disabled={processing}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={20} />
                {processing ? 'Iniciando...' : 'Próxima Rodada'}
              </button>

              <button
                onClick={handleResetScores}
                disabled={processing}
                className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw size={20} />
                Reiniciar Placar
              </button>
            </div>
          )}

          {!isOwner && (
            <div className="text-center text-gray-600">
              <p>Aguardando o dono da sala iniciar a próxima rodada...</p>
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-center text-gray-700">
              ⚠️ Quem chegar a 100 pontos perde!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
