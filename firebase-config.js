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
    apiKey: "DEIN_API_KEY",
    authDomain: "DEIN-PROJEKT.firebaseapp.com",
    projectId: "DEIN-PROJEKT",
    storageBucket: "DEIN-PROJEKT.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000"
  },

  // App Check (Pflicht für die KI): reCAPTCHA-v3-Websiteschlüssel.
  // Anleitung im README, Schritt 6.
  recaptchaSiteKey: "",

  // Gemini-Modell für die Fotoanalyse (Firebase AI Logic, Gemini Developer API).
  // gemini-3.5-flash ist stabil und im kostenlosen Spark-Tarif nutzbar.
  geminiModel: "gemini-3.5-flash"
};
