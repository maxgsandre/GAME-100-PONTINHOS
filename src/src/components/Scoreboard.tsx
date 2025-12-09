import { Player } from '../lib/firestoreGame';

interface ScoreboardProps {
  players: Player[];
  playerOrder: string[];
  currentTurnIndex: number;
  currentUserId: string | null;
}

export function Scoreboard({ players, playerOrder, currentTurnIndex, currentUserId }: ScoreboardProps) {
  const sortedPlayers = playerOrder
    .map(id => players.find(p => p.id === id))
    .filter((p): p is Player => p !== undefined);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="mb-3 text-gray-700">Placar</h3>
      <div className="space-y-2">
        {sortedPlayers.map((player, index) => {
          const isCurrentTurn = index === currentTurnIndex;
          const isCurrentUser = player.id === currentUserId;

          return (
            <div
              key={player.id}
              className={`
                p-3 rounded-lg flex justify-between items-center
                ${isCurrentTurn ? 'bg-yellow-50 border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.4)]' : 'bg-gray-50'}
                ${isCurrentUser ? 'ring-2 ring-blue-400' : ''}
              `}
            >
              <div className="flex items-center gap-2">
                {isCurrentTurn && (
                  <span className="text-yellow-500 text-xl drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]">▶</span>
                )}
                {player.photoURL ? (
                  <img
                    src={player.photoURL}
                    alt={player.name}
                    className="w-8 h-8 rounded-full object-cover border-2 border-gray-300"
                  />
                ) : (
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {player.name[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className={isCurrentUser ? 'text-blue-600' : ''}>
                    {player.name} {isCurrentUser && '(Você)'}
                  </p>
                  {isCurrentTurn && (
                    <p className="text-xs text-yellow-500 font-semibold drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]">Vez dele</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg">{player.score}</p>
                <p className="text-xs text-gray-500">pontos</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
