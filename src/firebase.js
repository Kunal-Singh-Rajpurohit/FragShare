import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDKsggDlWdrSmCPRTGDyT2tH0gMhSzmlZM",
  authDomain: "fragshare-c0e23.firebaseapp.com",
  projectId: "fragshare-c0e23",
  storageBucket: "fragshare-c0e23.firebasestorage.app",
  messagingSenderId: "983288753121",
  appId: "1:983288753121:web:7ec3947157f629cbb240a0",
  measurementId: "G-3P3YF01R3K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// === PRODUCTION BACKEND INTEGRATION ===

export const signIn = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  localStorage.setItem('currentUser', userCredential.user.email);
  localStorage.setItem('currentUid', userCredential.user.uid);
  return userCredential;
};

export const signUp = async (email, password) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;
  
  // Initialize new user profile in Firestore DB
  const defaultProfile = {
    email: email,
    usdc: 100000, 
    frup: 0,
    fractions: {},
    yieldEarned: 0,
    createdAt: new Date().toISOString()
  };
  
  await setDoc(doc(db, "users", uid), defaultProfile);
  
  localStorage.setItem('currentUser', email);
  localStorage.setItem('currentUid', uid);
  return userCredential;
};

export const logOut = async () => {
  await signOut(auth);
  localStorage.removeItem('currentUser');
  localStorage.removeItem('currentUid');
};

export const getProfile = async (uid) => {
  if (!uid) return null;
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data();
  } else {
    // If somehow missing, recreate default
    const defaultProfile = {
      email: localStorage.getItem('currentUser') || '',
      usdc: 100000, 
      frup: 0,
      fractions: {},
      yieldEarned: 0
    };
    await setDoc(doc(db, "users", uid), defaultProfile);
    return defaultProfile;
  }
};

export const saveProfile = async (uid, data) => {
  await setDoc(doc(db, "users", uid), data, { merge: true });
  return true;
};
