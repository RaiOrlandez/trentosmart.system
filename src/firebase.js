import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

// Firebase configuration for TrentoSmart system
const firebaseConfig = {
  apiKey: "AIzaSyCEdKp5Ta7grB7tHEUpG9vj1Y2HtFgDmK8",
  authDomain: "trentosmart-22f0d.firebaseapp.com",
  projectId: "trentosmart-22f0d",
  storageBucket: "trentosmart-22f0d.firebasestorage.app",
  messagingSenderId: "817458673311",
  appId: "1:817458673311:web:60ce694ad8f2c7be2c94aa",
  measurementId: "G-CMR7P33HFX"
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);
export const auth = getAuth(app);

// Request permission and get device token
export const requestForToken = async () => {
  try {
    if (typeof Notification === 'undefined') {
      console.warn('[FCM] Push notifications are not supported by this browser.');
      return null;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const currentToken = await getToken(messaging, {
        // You get the VAPID key in Project Settings > Cloud Messaging > Web configuration
        vapidKey: 'BNdDIWlhUtP-t_g6hqSLpqxkT0ycHkcbGVC2FyKn4wq0U6jq1f5gYR56xqO6i7Me2DR0t64KbdIk7GG_bSbMmlM'
      });
      if (currentToken) {
        console.log('FCM Token:', currentToken);
        return currentToken;
      }
    }
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
  }
  return null;
};

/**
 * Opens a Google Sign-In popup via Firebase Auth.
 * Returns the Firebase ID token string that should be sent to the backend.
 */
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  // Request additional scopes if needed
  provider.addScope('email');
  provider.addScope('profile');

  const result = await signInWithPopup(auth, provider);
  // Get the Firebase ID token to send to our Django backend
  const idToken = await result.user.getIdToken();
  return idToken;
};

