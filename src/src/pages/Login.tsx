import { useState } from 'react';
import { Gamepad2, Sparkles } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
      // signInWithRedirect will cause a page reload
    } catch (err: any) {
      console.error('Failed to sign in:', err);
      setError(err.message || 'Erro ao fazer login. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Logo and Title Section */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl"></div>
              <div className="relative bg-white/10 backdrop-blur-sm p-6 rounded-full border-2 border-white/30">
                <Gamepad2 className="text-white" size={64} strokeWidth={2} />
              </div>
            </div>
          </div>
          <h1 className="text-white text-5xl font-extrabold mb-3 drop-shadow-lg">
            100 Pontinhos
          </h1>
          <div className="flex items-center justify-center gap-2 text-white/90">
            <Sparkles size={18} className="text-yellow-300" />
            <p className="text-lg font-medium">Jogue com seus amigos!</p>
            <Sparkles size={18} className="text-yellow-300" />
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20 animate-slide-up">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Bem-vindo de volta!
            </h2>
            <p className="text-gray-600 text-sm">
              Faça login para começar a jogar
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg animate-shake">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-4 px-6 bg-white hover:bg-gray-50 text-gray-700 rounded-xl flex items-center justify-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl border-2 border-gray-200 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-700"></div>
                <span className="text-base font-semibold">Entrando...</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-base font-semibold">Continuar com Google</span>
              </>
            )}
          </button>

          <p className="mt-6 text-center text-xs text-gray-500 leading-relaxed">
            Ao continuar, você concorda com nossos{' '}
            <span className="text-cyan-600 hover:text-cyan-700 underline cursor-pointer">
              termos de uso
            </span>{' '}
            e{' '}
            <span className="text-cyan-600 hover:text-cyan-700 underline cursor-pointer">
              política de privacidade
            </span>
          </p>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <p className="text-white/90 text-sm font-medium">
              2-4 jogadores • Modo multiplayer
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 0.6s ease-out 0.2s both;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
}

