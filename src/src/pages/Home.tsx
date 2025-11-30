import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, LogIn, Gamepad2 } from 'lucide-react';
import { createRoom, joinRoom } from '../lib/firestoreGame';
import { useAppStore } from '../app/store';

export function Home() {
  const navigate = useNavigate();
  const { setCurrentRoomId, setPlayerName } = useAppStore();

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Digite seu nome');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const { roomId } = await createRoom(name.trim());
      setPlayerName(name.trim());
      setCurrentRoomId(roomId);
      navigate(`/room/${roomId}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar sala');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Digite seu nome');
      return;
    }
    if (!code.trim() || code.trim().length !== 6) {
      setError('Digite o código da sala (6 dígitos)');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const roomId = await joinRoom(code.trim(), name.trim());
      setPlayerName(name.trim());
      setCurrentRoomId(roomId);
      navigate(`/room/${roomId}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar na sala');
      setLoading(false);
    }
  };

  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Gamepad2 className="text-white" size={80} />
            </div>
            <h1 className="text-white mb-2">100 Pontinhos</h1>
            <p className="text-white/90">Jogue com seus amigos!</p>
          </div>

          <div className="bg-white rounded-lg shadow-2xl p-6 space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-3 transition-colors shadow-md"
            >
              <Users size={24} />
              <span className="text-lg">Criar Sala</span>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-3 transition-colors shadow-md"
            >
              <LogIn size={24} />
              <span className="text-lg">Entrar em Sala</span>
            </button>
          </div>

          <div className="mt-6 text-center text-white/80 text-sm">
            <p>2-4 jogadores • Modo multiplayer</p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-2xl p-6">
            <h2 className="mb-6 text-green-700">Criar Nova Sala</h2>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Seu Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite seu nome"
                  maxLength={20}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('menu');
                    setError('');
                  }}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                  disabled={loading}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Criando...' : 'Criar Sala'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-2xl p-6">
          <h2 className="mb-6 text-blue-700">Entrar em Sala</h2>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Seu Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite seu nome"
                maxLength={20}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Código da Sala
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(val);
                }}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode('menu');
                  setError('');
                }}
                className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                disabled={loading}
              >
                Voltar
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
