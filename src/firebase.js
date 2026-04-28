import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// TODO: Replace with your actual Firebase config from the Firebase Console Let
const firebaseConfig = {
  apiKey: "AIzaSyCK0TPCAL3DCkZcbi5mm05Owu_wwr-Pnyo",
  authDomain: "transmart-c8c7b.firebaseapp.com",
  projectId: "transmart-c8c7b",
  storageBucket: "transmart-c8c7b.firebasestorage.app",
  messagingSenderId: "928911803916",
  appId: "1:928911803916:web:bd2f00673587c1c2039029",
  measurementId: "G-MZJ9HQCFDN"
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// Request permission and get device token
export const requestForToken = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        const currentToken = await getToken(messaging, { 
            // You get the VAPID key in Project Settings > Cloud Messaging > Web configuration
            vapidKey: 'BGR1CoKMxoH1sLjTg4vDqzKL0tnHx55yf7xgfiC-pq00wrhWPSANJaBkl78UBDxRv87-NQtwC6LRyDCqdUOp23g' 
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
