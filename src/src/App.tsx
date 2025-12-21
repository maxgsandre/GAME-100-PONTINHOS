import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, getGoogleRedirectResult } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAppStore } from './app/store';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { NotFound } from './pages/NotFound';
import { DialogProvider } from './contexts/DialogContext';

function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const { userId, setUserId } = useAppStore();

  // Service Worker update detection and cache clearing
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Clear all caches on load to ensure fresh content
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          // Keep only firestore cache, clear others
          if (!cacheName.includes('firestore')) {
            caches.delete(cacheName);
          }
        });
      });

      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          // Check for updates immediately
          registration.update();

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  // Clear all caches when new worker activates
                  caches.keys().then((cacheNames) => {
                    cacheNames.forEach((cacheName) => {
                      caches.delete(cacheName);
                    });
                  });
                  // Não recarregar automaticamente durante uma partida (evita "sair da sala sozinho")
                  const inRoom = window.location.pathname.startsWith('/room/');
                  if (!inRoom) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        });
      });

      // Check for updates every 10 seconds
      const updateInterval = setInterval(() => {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.update();
          });
        });
      }, 10000);

      return () => clearInterval(updateInterval);
    }
  }, []);

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
    <DialogProvider>
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
    </DialogProvider>
  );
}

export default App;
