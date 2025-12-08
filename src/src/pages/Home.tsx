import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, DoorOpen, Key, LogOut } from 'lucide-react';
import { createRoom, joinRoom } from '../lib/firestoreGame';
import { useAppStore } from '../app/store';
import { signOutUser } from '../lib/firebase';
import { useDialog } from '../contexts/DialogContext';

export function Home() {
  const navigate = useNavigate();
  const { setCurrentRoomId, setPlayerName } = useAppStore();
  const { confirm, alert } = useDialog();

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      const { roomId } = await createRoom();
      const { getCurrentUserData } = await import('../lib/firebase');
      const userData = getCurrentUserData();
      if (userData) {
        setPlayerName(userData.name);
      }
      setCurrentRoomId(roomId);
      navigate(`/room/${roomId}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar sala');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length !== 6) {
      setError('Digite o código da sala (6 dígitos)');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const roomId = await joinRoom(code.trim());
      const { getCurrentUserData } = await import('../lib/firebase');
      const userData = getCurrentUserData();
      if (userData) {
        setPlayerName(userData.name);
      }
      setCurrentRoomId(roomId);
      navigate(`/room/${roomId}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar na sala');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Confirmar saída',
      message: 'Tem certeza que deseja sair?',
      confirmText: 'Sair',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    
    if (confirmed) {
      try {
        await signOutUser();
        navigate('/login');
      } catch (err: any) {
        await alert({
          title: 'Erro',
          message: 'Erro ao fazer logout: ' + err.message,
          variant: 'destructive',
        });
      }
    }
  };

  if (mode === 'menu') {
    return (
      <div 
        className="relative flex items-center justify-center min-h-screen p-4 overflow-hidden bg-black"
      >
        {/* Logout button - top right */}
        <button
          onClick={handleLogout}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-lg"
          title="Sair da conta"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Sair</span>
        </button>

        {/* Main content container */}
        <div className="relative z-10 flex flex-col items-center p-10 bg-black rounded-2xl shadow-2xl max-w-md w-full border border-gray-800">
          {/* Spade icon */}
          <div className="mb-8">
            <div 
              className="text-white text-7xl font-bold"
              style={{
                textShadow: '0 0 15px rgba(255, 215, 0, 0.6), 0 0 30px rgba(255, 215, 0, 0.4)',
                filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.8))',
              }}
            >
              ♠
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-white mb-3 tracking-wide">
            100 Pontinhos
          </h1>

          {/* Slogan */}
          <p className="text-lg text-gray-300 mb-6">Jogue com seus amigos!</p>

          {/* Gemini Image */}
          <div className="mb-6 w-full flex justify-center">
            <img 
              src="/Gemini_Generated_Image.png" 
              alt="100 Pontinhos" 
              className="max-w-full h-auto rounded-lg shadow-lg"
              style={{ maxHeight: '200px' }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col space-y-5 w-full">
            <button
              onClick={() => setMode('create')}
              className="flex items-center justify-start gap-3 px-6 py-4 text-lg font-semibold text-white 
                         bg-[#27D07F] rounded-lg shadow-lg 
                         hover:bg-[#22B870] transition-all duration-200 ease-in-out
                         focus:outline-none focus:ring-4 focus:ring-green-400 focus:ring-opacity-50"
            >
              <Users size={24} className="drop-shadow-lg" />
              <span>Criar Sala</span>
            </button>

            <button
              onClick={() => setMode('join')}
              className="flex items-center justify-between px-6 py-4 text-lg font-semibold text-white 
                         bg-gradient-to-r from-[#4A70FF] to-[#9B4AFF] rounded-lg shadow-lg 
                         hover:from-[#3D5CE6] hover:to-[#8A3FE6] transition-all duration-200 ease-in-out
                         focus:outline-none focus:ring-4 focus:ring-purple-400 focus:ring-opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-white/80 text-base">[</span>
                  <Plus size={18} className="drop-shadow-lg" />
                  <span className="text-white/80 text-base">]</span>
                </div>
                <span>Entrar em Sala</span>
              </div>
              <div className="flex items-center gap-2">
                <DoorOpen size={20} className="drop-shadow-lg" />
                <Key size={18} className="drop-shadow-lg" />
              </div>
            </button>
          </div>

          {/* Footer info */}
          <p className="mt-12 text-sm text-gray-400">
            2-4 jogadores • modo multiplayer
          </p>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                style={{ color: '#111827' }}
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
