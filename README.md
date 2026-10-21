# TROPHEON
**Ancient Roots. Modern Nutrition.**

Kalorien- und Nährstoff-Tracker im Stil des antiken Griechenlands. Teller fotografieren, und die KI (Gemini über Firebase AI Logic) erkennt die Speisen und schätzt Kalorien, Protein, Kohlenhydrate, Fett, Vitamine und Mineralstoffe. Alles lässt sich manuell korrigieren.

- Foto, Text-Beschreibung oder manuelle Eingabe
- Korrektur per Hand oder per Satz („das ist Hühnchen, nicht Tofu“)
- Tage auswählen, Verlauf mit Diagramm, Gesamt-Defizit in kcal und kg
- Profil: BMI, Grundumsatz, Gesamtbedarf, Tagesziel für Abnehmen, Halten oder Zunehmen, Makro-Ziele, Zieldatum
- Vitamine und Mineralstoffe gegen die D-A-CH-Referenzwerte
- Login mit Google, Daten in Firestore, auf allen Geräten synchron
- Installierbar am Handy (PWA): „Zum Startbildschirm hinzufügen“
- Ohne Firebase-Einrichtung läuft sie im Offline-Modus (Speicherung nur auf dem Gerät, keine Foto-Analyse)

Reines HTML/CSS/JavaScript, kein Build-Schritt.

---

## Einrichtung (ca. 20 Minuten, einmalig)

### 1. Firebase-Projekt anlegen
1. Öffne <https://console.firebase.google.com> und klicke **Projekt hinzufügen**.
2. Name z. B. `tropheon`. Google Analytics brauchst du nicht.
3. Merke dir die **Projekt-ID** (steht unter dem Projektnamen, z. B. `tropheon-1a2b3`).

### 2. Web-App registrieren
1. In der Projektübersicht auf das Symbol **`</>`** (Web) klicken.
2. Spitzname `TROPHEON`, **Firebase Hosting aktivieren** anhaken, registrieren.
3. Firebase zeigt dir ein `firebaseConfig`-Objekt. Kopiere die Werte in **`firebase-config.js`** (ersetze alle `DEIN_...`).
4. Trage die Projekt-ID in **`.firebaserc`** statt `DEIN-PROJEKT` ein.

### 3. Google-Anmeldung aktivieren
**Build → Authentication → Jetzt starten → Anmeldemethode → Google → Aktivieren**, Support-E-Mail wählen, speichern.

### 4. Datenbank anlegen
1. **Build → Firestore Database → Datenbank erstellen**.
2. Standort: `eur3 (Europe)`. Modus: **Produktionsmodus**.
3. Tab **Regeln**: Inhalt der Datei `firestore.rules` hineinkopieren und **Veröffentlichen**.

### 5. KI aktivieren (Firebase AI Logic)
1. **AI Services → AI Logic → Jetzt starten**.
2. Als Anbieter **Gemini Developer API** wählen (kostenloser Spark-Tarif reicht) und den Assistenten abschließen.
3. Modell: in `firebase-config.js` steht `gemini-3.5-flash` (stabil, im Gratis-Kontingent). Du kannst es dort ändern.

### 6. App Check einrichten (Pflicht für die KI)
Schützt dein KI-Kontingent davor, dass fremde Seiten es benutzen.
1. Öffne <https://www.google.com/recaptcha/admin/create>, Typ **reCAPTCHA v3**.
2. Domains: `DEINE-PROJEKT-ID.web.app`, `DEINE-PROJEKT-ID.firebaseapp.com` und `localhost`.
3. Du bekommst einen **Websiteschlüssel** und einen **geheimen Schlüssel**.
4. Firebase-Konsole: **Security → App Check → Apps → deine Web-App → reCAPTCHA** → geheimen Schlüssel eintragen, speichern.
5. Den **Websiteschlüssel** in `firebase-config.js` bei `recaptchaSiteKey` eintragen.
6. Unter **App Check → APIs** muss „Firebase AI Logic“ auf **Erzwungen** stehen.

### 7. Online stellen

**A) Einmalig vom Computer aus (am einfachsten)**
```bash
npm install -g firebase-tools
firebase login
firebase deploy
```
Danach läuft die App unter `https://DEINE-PROJEKT-ID.web.app`.

**B) Automatisch bei jedem Push auf GitHub** (Workflow liegt schon in `.github/workflows/deploy.yml`)
1. Google Cloud Console → **IAM & Verwaltung → Dienstkonten** (gleiches Projekt) → **Dienstkonto erstellen**, Name `github-deploy`, Rolle **Firebase Hosting-Administrator**.
2. Beim Dienstkonto **Schlüssel → Schlüssel hinzufügen → JSON** herunterladen.
3. GitHub-Repo → **Settings → Secrets and variables → Actions**:
   - Secret `FIREBASE_SERVICE_ACCOUNT` = kompletter Inhalt der JSON-Datei
   - Tab **Variables**: `FIREBASE_READY` = `true`
4. Ab jetzt wird jeder Push auf `main` automatisch veröffentlicht.

Alternativ macht `firebase init hosting:github` die Schritte 1–3 automatisch (überschreibt dabei den Workflow, das ist in Ordnung).

### 8. Am Handy installieren
Seite im Handy-Browser öffnen →
- **iPhone (Safari):** Teilen → **Zum Home-Bildschirm**
- **Android (Chrome):** Menü ⋮ → **App installieren**

---

## Lokal testen
```bash
npx serve .        # oder: python3 -m http.server 8080
```
Dann <http://localhost:8080>. Für die KI lokal: In der Browser-Konsole erscheint ein App-Check-Debug-Token. Trage ihn unter **App Check → Apps → ⋮ → Debug-Tokens verwalten** ein.

## Dateien
| Datei | Zweck |
|---|---|
| `index.html` | Grundgerüst, Login-Bildschirm |
| `styles.css` | Design (Marmor hell / Schwarzfigurig dunkel) |
| `app.js` | App-Logik, Berechnungen, Firebase, KI |
| `firebase-config.js` | **deine** Firebase-Werte |
| `firestore.rules` | Datenbank-Regeln: jede Person sieht nur ihre Daten |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installierbare App (PWA) |

## Berechnungen
- Grundumsatz: Mifflin-St-Jeor; Gesamtbedarf = Grundumsatz × Aktivitätsfaktor (1,2 bis 1,9)
- Defizit/Überschuss: kg pro Woche × 7700 kcal ÷ 7; Untergrenze 1200 kcal (w) bzw. 1500 kcal (m)
- Protein 1,8 g/kg beim Ab- und Zunehmen, 1,4 g/kg beim Halten (bei BMI über 30 bezogen auf das Gewicht bei BMI 25); Fett 30 % der Energie; Rest Kohlenhydrate
- Mikronährstoffe: D-A-CH-Referenzwerte für Erwachsene

Alle Werte aus Fotos sind Schätzungen und kein Ersatz für ärztliche oder diätologische Beratung.
