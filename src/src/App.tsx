import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, getGoogleRedirectResult } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAppStore } from './app/store';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { NotFound } from './pages/NotFound';

function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const { userId, setUserId } = useAppStore();

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const initAuth = async () => {
      // Safety timeout - if auth doesn't resolve in 10 seconds, stop loading
      timeoutId = setTimeout(() => {
        console.warn('⚠️ Auth initialization timeout - stopping loading');
        setAuthLoading(false);
      }, 10000);

      // First, check for redirect result (must be done before setting up listener)
      try {
        const redirectUser = await getGoogleRedirectResult();
        if (redirectUser) {
          console.log('✅ Redirect successful, user:', redirectUser.uid);
          setUserId(redirectUser.uid);
          if (timeoutId) clearTimeout(timeoutId);
          setAuthLoading(false);
          return;
        }
      } catch (error) {
        console.error('❌ Redirect error:', error);
      }

      // If no redirect result, set up auth state listener
      unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('🔔 Auth state changed:', user ? `User: ${user.email} (${user.uid})` : 'No user');
        if (user) {
          setUserId(user.uid);
        } else {
          setUserId(null);
        }
        if (timeoutId) clearTimeout(timeoutId);
        setAuthLoading(false);
      });
    };

    initAuth();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
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
    return <Login />;
  }

  return (
    <BrowserRouter>
      <div className="font-sans antialiased">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
