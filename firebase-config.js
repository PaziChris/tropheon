// ─────────────────────────────────────────────────────────────
//  TROPHEON · Firebase-Konfiguration
//  Trage hier die Werte aus der Firebase-Konsole ein
//  (Projekteinstellungen → Allgemein → Deine Apps → Web-App → Konfiguration).
//  Diese Werte sind NICHT geheim – sie dürfen im Code stehen.
//  Solange hier noch "DEIN_..." steht, läuft die App im Offline-Modus
//  (Speicherung nur auf dem Gerät, keine Foto-Analyse).
// ─────────────────────────────────────────────────────────────
export default {
  firebase: {
    apiKey: "AIzaSyDZ9jux9Ud28skbcevt3SrsmjJWYHqzZV8",
    authDomain: "tropheon-758cb.firebaseapp.com",
    projectId: "tropheon-758cb",
    storageBucket: "tropheon-758cb.firebasestorage.app",
    messagingSenderId: "913162665282",
    appId: "1:913162665282:web:98ab5a2f2ae48e56729cdb",
    measurementId: "G-8W34RGER3H"
  },

  // App Check (Pflicht für die KI): Schlüssel aus Google Cloud Fraud Defense (reCAPTCHA Enterprise, Typ Web).
  // Anleitung im README, Schritt 6.
  recaptchaSiteKey: "",

  // Gemini-Modell für die Fotoanalyse (Firebase AI Logic, Gemini Developer API).
  // gemini-3.5-flash ist stabil und im kostenlosen Spark-Tarif nutzbar.
  geminiModel: "gemini-3.5-flash"
};
