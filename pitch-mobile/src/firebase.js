// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAjlu6nqjG7-rtxZ2oZeBvwZb5K1DbB9vc",
  authDomain: "pitch-card-game-5144a.firebaseapp.com",
  projectId: "pitch-card-game-5144a",
  storageBucket: "pitch-card-game-5144a.firebasestorage.app",
  messagingSenderId: "222564218969",
  appId: "1:222564218969:web:3098553abc9df43ae21948",
  measurementId: "G-BEJHCNTGFV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
