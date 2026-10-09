import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBN8qOi93UzonlAr3s4BX1YlBbunl8A690',
  authDomain: 'auroraview-714f7.firebaseapp.com',
  projectId: 'auroraview-714f7',
  storageBucket: 'auroraview-714f7.firebasestorage.app',
  messagingSenderId: '406130228874',
  appId: '1:406130228874:web:6f4f4d118d47de6979b773'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
