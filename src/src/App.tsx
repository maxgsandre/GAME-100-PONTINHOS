import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, signInAnonymouslyUser } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAppStore } from './app/store';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { NotFound } from './pages/NotFound';

function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const { userId, setUserId } = useAppStore();

  useEffect(() => {
    // Initialize auth
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setAuthLoading(false);
      } else {
        // Sign in anonymously
        try {
          const uid = await signInAnonymouslyUser();
          setUserId(uid);
          setAuthLoading(false);
        } catch (error) {
          console.error('Failed to sign in:', error);
          setAuthLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [setUserId]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-blue-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <h2 className="text-red-700 mb-4">Erro de Autenticação</h2>
          <p className="text-gray-600">Não foi possível conectar. Recarregue a página.</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
