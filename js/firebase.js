/**
 * RainMap AI - Firebase Realtime Database Connection Module
 * 
 * Initializes Firebase app, connects to Firebase Realtime Database,
 * and exports database utilities for real-time IoT sensor ingestion.
 * 
 * Database Path: /RainGauge
 * Expected Structure:
 *   { rainfallMM, rainfallPercent, waterHeight, analogValue, status }
 */

// Firebase SDK CDN Imports (ES Module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Firebase Project Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQHM9azAM-FkN6b5GiavP73xeoutBRx_U",
  authDomain: "rainmap-8c7cf.firebaseapp.com",
  databaseURL: "https://rainmap-8c7cf-default-rtdb.firebaseio.com/",
  projectId: "rainmap-8c7cf",
  storageBucket: "rainmap-8c7cf.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:test"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
const db = getDatabase(app);

console.log('[Firebase] 🔥 Firebase App initialized successfully.');
console.log('[Firebase] 📡 Realtime Database connected:', firebaseConfig.databaseURL);

// Export database instance and utilities
export { db, ref, onValue };