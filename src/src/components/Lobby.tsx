import { useState, useEffect } from 'react';
import { Copy, Check, Users, Play, Crown } from 'lucide-react';
import { Room, Player, subscribeToPlayers, startGame } from '../lib/firestoreGame';
import { useAppStore } from '../app/store';
import { Chat } from './Chat';
import { useDialog } from '../contexts/DialogContext';

interface LobbyProps {
  room: Room;
}

export function Lobby({ room }: LobbyProps) {
  const { alert } = useDialog();
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
      // If successful, the component will re-render with new room status
    } catch (error: any) {
      console.error('Failed to start game:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        error: error
      });
      await alert({ message: error.message || 'Erro ao iniciar jogo' });
      setStarting(false);
    }
  };

  // Sort players by join order
  const sortedPlayers = room.playerOrder
    .map(id => players.find(p => p.id === id))
    .filter((p): p is Player => p !== undefined);

  return (
    <div 
      className="min-h-screen p-4 flex items-center justify-center"
      style={{
        backgroundImage: 'url(/mesa.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          {/* Gradiente verde no topo */}
          <div className="bg-gradient-to-r from-green-400 to-green-500 h-2"></div>
          
          <div className="p-6">
            {/* Título + rodada */}
            <div className="flex flex-col items-center mb-6">
              <h1 className="text-2xl font-bold text-green-600">Sala de Espera</h1>
              <p className="text-sm text-gray-500 mt-1">Rodada atual: {room.round || 1}</p>
            </div>

            {/* Código da Sala */}
            <div className="mb-6">
              <p className="text-center text-sm text-gray-600 mb-2">Código da Sala</p>
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="bg-white border-2 border-green-200 px-6 py-3 rounded-lg">
                  <p className="text-3xl font-bold tracking-widest text-gray-800">{room.code}</p>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                >
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
              <p className="text-center text-xs text-gray-500">
                Compartilhe este código com seus amigos
              </p>
            </div>

            {/* Divisor */}
            <div className="border-t border-gray-200 my-6"></div>

            {/* Jogadores */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-gray-600" />
                <h3 className="text-gray-700 font-medium">
                  Jogadores ({sortedPlayers.length}/4)
                </h3>
              </div>
              <div className="space-y-3">
                {sortedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3"
                  >
                    {player.photoURL ? (
                      <img
                        src={player.photoURL}
                        alt={player.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-purple-500"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {player.name[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-1">
                      <p className="text-gray-800">
                        {player.name}
                        {player.id === userId && <span className="text-gray-500"> (Você)</span>}
                      </p>
                      {player.id === room.ownerId && (
                        <Crown size={16} className="text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Divisor */}
            <div className="border-t border-gray-200 my-6"></div>

            {/* Botão Iniciar Jogo */}
            {isOwner && (
              <div className="space-y-2">
                <button
                  onClick={handleStartGame}
                  disabled={!canStart || starting}
                  className={`
                    w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2
                    transition-all duration-200 font-medium
                    ${canStart && !starting
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  <Play size={18} className={canStart && !starting ? 'fill-white' : ''} />
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
      </div>

      {/* Chat */}
      <Chat roomId={room.id} />
    </div>
  );
}
