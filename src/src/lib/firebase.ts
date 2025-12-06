import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, Auth, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate environment variables
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase config missing! Check your .env file in src/');
  console.error('Current env vars:', {
    apiKey: firebaseConfig.apiKey ? '✅' : '❌',
    projectId: firebaseConfig.projectId ? '✅' : '❌',
  });
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Auth helpers
export const signInWithGoogle = async (): Promise<User> => {
  try {
    // Try popup first (better UX, no page reload)
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('✅ Popup sign-in successful:', result.user.email);
      return result.user;
    } catch (popupError: any) {
      // If popup is blocked, fall back to redirect
      if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
        console.log('ℹ️ Popup blocked, using redirect instead');
        await signInWithRedirect(auth, googleProvider);
        // Redirect will cause page reload, so we don't return here
        throw new Error('Redirecting to Google...');
      }
      throw popupError;
    }
  } catch (error: any) {
    console.error('❌ Error signing in with Google:', error);
    throw error;
  }
};

// Get redirect result (call this after page load)
export const getGoogleRedirectResult = async (): Promise<User | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      console.log('✅ Google redirect successful, user:', result.user.email);
      return result.user;
    }
    console.log('ℹ️ No redirect result found');
    return null;
  } catch (error: any) {
    console.error('❌ Error getting redirect result:', error);
    return null;
  }
};

// Get current user ID
export const getCurrentUserId = (): string | null => {
  return auth.currentUser?.uid || null;
};

// Get current user data (name and photo from Google)
export const getCurrentUserData = (): { name: string; photoURL: string | null } | null => {
  const user = auth.currentUser;
  if (!user) return null;
  
  // Get only the first name from displayName
  let firstName = 'Jogador';
  if (user.displayName) {
    firstName = user.displayName.split(' ')[0];
  } else if (user.email) {
    firstName = user.email.split('@')[0];
  }
  
  return {
    name: firstName,
    photoURL: user.photoURL || null,
  };
};

// Wait for auth to initialize
export const waitForAuth = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user?.uid || null);
    });
  });
};
