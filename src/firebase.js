import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBOJR9PtxspbQuP-jZqeLeUlBRoBEy95Zc',
  authDomain: 'whatbuy-253cd.firebaseapp.com',
  projectId: 'whatbuy-253cd',
  storageBucket: 'whatbuy-253cd.firebasestorage.app',
  messagingSenderId: '474945334029',
  appId: '1:474945334029:web:c1a6cc19c4be16d2fcde44',
  measurementId: 'G-ZYKD1ZRGJD',
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
let authInstance;
try {
  authInstance = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;
export const db = getFirestore(app);
