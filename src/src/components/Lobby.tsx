import { useState, useEffect } from 'react';
import { Copy, Check, Users, Play } from 'lucide-react';
import { Room, Player, subscribeToPlayers, startGame } from '../lib/firestoreGame';
import { useAppStore } from '../app/store';
import { Chat } from './Chat';

interface LobbyProps {
  room: Room;
}

export function Lobby({ room }: LobbyProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const userId = useAppStore(state => state.userId);

  const isOwner = room.ownerId === userId;
  const canStart = players.length >= 2 && players.length <= 4;

  useEffect(() => {
    const unsubscribe = subscribeToPlayers(room.id, setPlayers);
    return () => unsubscribe();
  }, [room.id]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleStartGame = async () => {
    if (!canStart || starting) return;

    try {
      setStarting(true);
      await startGame(room.id);
    } catch (error: any) {
      console.error('Failed to start game:', error);
      alert(error.message || 'Erro ao iniciar jogo');
      setStarting(false);
    }
  };

  // Sort players by join order
  const sortedPlayers = room.playerOrder
    .map(id => players.find(p => p.id === id))
    .filter((p): p is Player => p !== undefined);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="mb-4 text-center text-green-700">Sala de Espera</h1>

          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <p className="text-center text-sm text-gray-600 mb-2">Código da Sala</p>
            <div className="flex items-center justify-center gap-2">
              <div className="bg-white px-6 py-3 rounded-lg shadow-sm">
                <p className="text-3xl tracking-widest">{room.code}</p>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">
              Compartilhe este código com seus amigos
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users size={20} className="text-gray-600" />
              <h3 className="text-gray-700">
                Jogadores ({sortedPlayers.length}/4)
              </h3>
            </div>
            <div className="space-y-2">
              {sortedPlayers.map((player) => (
                <div
                  key={player.id}
                  className="bg-gray-50 rounded-lg p-3 flex justify-between items-center"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white">
                      {player.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p>
                        {player.name}
                        {player.id === userId && ' (Você)'}
                        {player.id === room.ownerId && ' 👑'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isOwner && (
            <div className="space-y-2">
              <button
                onClick={handleStartGame}
                disabled={!canStart || starting}
                className={`
                  w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2
                  transition-all duration-200
                  ${canStart && !starting
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                <Play size={20} />
                {starting ? 'Iniciando...' : 'Iniciar Jogo'}
              </button>
              {!canStart && (
                <p className="text-xs text-center text-gray-500">
                  Aguardando mais jogadores (mínimo 2, máximo 4)
                </p>
              )}
            </div>
          )}

          {!isOwner && (
            <div className="text-center text-gray-600">
              <p>Aguardando o dono da sala iniciar o jogo...</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat */}
      <Chat roomId={room.id} />
    </div>
  );
}
