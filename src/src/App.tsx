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
    // Check for redirect result first (after Google redirect)
    getGoogleRedirectResult().then((user) => {
      if (user) {
        setUserId(user.uid);
        setAuthLoading(false);
      }
    });

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setAuthLoading(false);
      } else {
        // No user authenticated, show login screen
        setAuthLoading(false);
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
    return <Login />;
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
