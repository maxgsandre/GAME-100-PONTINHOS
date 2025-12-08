import { useState } from 'react';
import { signInWithGoogle } from '../lib/firebase';

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      const user = await signInWithGoogle();
      // If we get here, popup was successful (no redirect happened)
      console.log('✅ Login successful, user:', user.uid);
      // The App.tsx will handle the auth state change
    } catch (err: any) {
      // If it's a redirect, don't show error (page will reload)
      if (err.message === 'Redirecting to Google...') {
        return;
      }
      console.error('Failed to sign in:', err);
      setError(err.message || 'Erro ao fazer login. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="max-w-md w-full relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="flex justify-center mb-6">
            <img 
              src="/Gemini_Generated_Image.png" 
              alt="100 Pontinhos" 
              className="max-w-full h-auto rounded-lg shadow-lg"
              style={{ maxHeight: '200px' }}
            />
          </div>
        </div>

        {/* Login Card - Versão Premium Refinada */}
        <div className="relative mx-auto w-full animate-slide-up">
          <div className="relative mx-auto w-[min(92vw,420px)] rounded-3xl bg-white/90 backdrop-blur-xl shadow-[0_8px_40px_-6px_rgba(0,0,0,0.25)] ring-1 ring-white/60 overflow-hidden">
            {/* Borda colorida superior */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400" />

            <div className="px-6 pt-8 pb-6 text-center">
              {/* Título */}
              <h2 className="text-2xl font-extrabold text-slate-900">Bem-vindo!</h2>
              <p className="mt-1 text-[15px] text-slate-600">Faça login para começar a jogar</p>

              {/* Error message */}
              {error && (
                <div className="mt-6 mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg animate-shake">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              {/* Botão Google */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800 shadow-[0_3px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_5px_14px_rgba(0,0,0,0.08)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-slate-700"></div>
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 48 48" className="h-5 w-5">
                      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.32 32.657 29.027 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.826 6.053 29.683 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
                      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.406 16.128 18.844 14 24 14c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C34.826 6.053 29.683 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                      <path fill="#4CAF50" d="M24 44c5.886 0 11.09-2.251 15.047-5.903l-6.949-5.869C29.994 33.847 27.112 35 24 35c-5.002 0-9.277-3.317-10.787-7.906l-6.61 5.09C9.014 39.67 15.93 44 24 44z"/>
                      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a9.99 9.99 0 0 1-3.255 4.228l6.949 5.869C41.135 35.883 44 30.626 44 24c0-1.341-.138-2.651-.389-3.917z"/>
                    </svg>
                    Continuar com Google
                  </>
                )}
              </button>

              {/* Termos */}
              <p className="mt-4 text-xs text-slate-500">
                Ao continuar, você concorda com nossos{' '}
                <span className="underline decoration-emerald-400/60 underline-offset-2 hover:text-slate-700 cursor-pointer">
                  termos de uso
                </span>{' '}
                e{' '}
                <span className="underline decoration-cyan-400/60 underline-offset-2 hover:text-slate-700 cursor-pointer">
                  política de privacidade
                </span>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Espaçamento explícito */}
        <div style={{ height: '24px' }}></div>

        {/* Badge */}
        <div className="flex justify-center animate-slide-up">
          <div 
            className="rounded-full border border-gray-700 bg-gray-900 text-[13px] text-gray-300"
            style={{ padding: '12px 24px' }}
          >
            2-4 jogadores · Modo multiplayer
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
