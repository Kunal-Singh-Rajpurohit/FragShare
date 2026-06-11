import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc 
} from 'firebase/firestore';

// Replace this with your actual Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyMockKeyForDevelopmentOnly",
  authDomain: "fragshare-dev.firebaseapp.com",
  projectId: "fragshare-dev",
  storageBucket: "fragshare-dev.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// === MOCK BACKEND FOR DEVELOPMENT WITHOUT REAL CONFIG ===
// Because we have a fake config above, real Firebase calls will fail.
// We intercept them with a localStorage mock for the MVP to feel fully functional.

const MOCK_DELAY = 800;

export const mockSignIn = async (email, password) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
      if (users[email] && users[email].password === password) {
        localStorage.setItem('currentUser', email);
        resolve({ user: { email, uid: users[email].uid } });
      } else {
        reject(new Error("Invalid credentials"));
      }
    }, MOCK_DELAY);
  });
};

export const mockSignUp = async (email, password) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
      if (users[email]) {
        reject(new Error("Email already in use"));
      } else {
        const uid = 'usr_' + Math.random().toString(36).substr(2, 9);
        users[email] = { email, password, uid };
        localStorage.setItem('mockUsers', JSON.stringify(users));
        localStorage.setItem('currentUser', email);
        resolve({ user: { email, uid } });
      }
    }, MOCK_DELAY);
  });
};

export const mockSignOut = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      localStorage.removeItem('currentUser');
      resolve();
    }, MOCK_DELAY);
  });
};

export const mockGetProfile = async (uid) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const profiles = JSON.parse(localStorage.getItem('mockProfiles') || '{}');
      resolve(profiles[uid] || { 
        name: 'New User', 
        usdc: 100000, // starting balance
        frup: 0,
        fractions: {},
        yieldEarned: 0
      });
    }, MOCK_DELAY);
  });
};

export const mockSaveProfile = async (uid, data) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const profiles = JSON.parse(localStorage.getItem('mockProfiles') || '{}');
      profiles[uid] = data;
      localStorage.setItem('mockProfiles', JSON.stringify(profiles));
      resolve(true);
    }, MOCK_DELAY);
  });
};
