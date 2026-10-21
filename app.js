// TROPHEON · Ancient Roots. Modern Nutrition.
// Statische Web-App (kein Build nötig). Firebase: Auth (Google), Firestore (Daten), AI Logic (Gemini, Fotoanalyse).
import CONFIG from './firebase-config.js';

const FB_VERSION = '12.19.0';
const FB = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
const configured = !!CONFIG?.firebase?.apiKey && !/^DEIN/.test(CONFIG.firebase.apiKey);

/* ───────── Konstanten ───────── */
const NUTS = [
  {k:'kcal',l:'Kalorien',u:'kcal',main:1},
  {k:'protein',l:'Protein',u:'g',main:1},
  {k:'carbs',l:'Kohlenhydrate',u:'g',main:1},
  {k:'fat',l:'Fett',u:'g',main:1},
  {k:'fiber',l:'Ballaststoffe',u:'g'},
  {k:'sugar',l:'Zucker',u:'g',limit:1},
  {k:'satfat',l:'Gesättigte Fettsäuren',u:'g',limit:1},
  {k:'vitA',l:'Vitamin A',u:'µg'},
  {k:'vitB12',l:'Vitamin B12',u:'µg'},
  {k:'vitC',l:'Vitamin C',u:'mg'},
  {k:'vitD',l:'Vitamin D',u:'µg'},
  {k:'vitE',l:'Vitamin E',u:'mg'},
  {k:'folate',l:'Folat',u:'µg'},
  {k:'calcium',l:'Calcium',u:'mg'},
  {k:'iron',l:'Eisen',u:'mg'},
  {k:'magnesium',l:'Magnesium',u:'mg'},
  {k:'potassium',l:'Kalium',u:'mg'},
  {k:'sodium',l:'Natrium',u:'mg',limit:1},
];
// Die Mahlzeiten der alten Griechen: Akratisma (Frühstück), Ariston (Mittag), Hesperisma (Nachmittag), Deipnon (Abend)
const MEALS = [
  {k:'breakfast',l:'Frühstück',s:'Frühstück',g:'ΑΚΡΑΤΙΣΜΑ'},
  {k:'lunch',l:'Mittagessen',s:'Mittag',g:'ΑΡΙΣΤΟΝ'},
  {k:'dinner',l:'Abendessen',s:'Abend',g:'ΔΕΙΠΝΟΝ'},
  {k:'snack',l:'Snacks',s:'Snack',g:'ΕΣΠΕΡΙΣΜΑ'},
];
const ACT = {
  sit:{f:1.2,l:'Sitzend – kaum Bewegung'},
  light:{f:1.375,l:'Leicht aktiv – 1–3× Sport pro Woche'},
  mod:{f:1.55,l:'Mäßig aktiv – 3–5× Sport pro Woche'},
  high:{f:1.725,l:'Sehr aktiv – 6–7× Sport pro Woche'},
  ext:{f:1.9,l:'Extrem aktiv – körperliche Arbeit + Sport'},
};
const K_LOCAL='tropheon.local', K_MODE='tropheon.mode', K_THEME='tropheon.theme';

/* ───────── Helfer ───────── */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const r1 = n => Math.round(n * 10) / 10;
const fmt = (n, d = 0) => (+n || 0).toLocaleString('de-AT', {minimumFractionDigits:d, maximumFractionDigits:d}).replace('-', '−');
const sgn = (n, d = 0) => (n > 0 ? '+' : '') + fmt(n, d);
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); };
const todayKey = () => key(new Date());
const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return key(d); };
const uid8 = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clone = o => JSON.parse(JSON.stringify(o));
const lsGet = k => { try { return localStorage.getItem(k); } catch(e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch(e) {} };
function dayLabel(k){ const t = todayKey(); if (k === t) return 'Heute'; if (k === addDays(t,-1)) return 'Gestern'; return fromKey(k).toLocaleDateString('de-AT',{weekday:'long'}); }
const dateLong = k => fromKey(k).toLocaleDateString('de-AT',{day:'numeric',month:'long',year:'numeric'});
function defaultMeal(){ const h = new Date().getHours(); return h < 10.5 ? 'breakfast' : h < 15 ? 'lunch' : h < 17 ? 'snack' : h < 22 ? 'dinner' : 'snack'; }
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2800); }

/* ───────── Zustand ───────── */
const S = { profile:null, days:{}, view:'today', date:todayKey(), range:7, mode:'boot', user:null,
  draft:null, draftImg:null, product:null, portion:null, pendingMeal:defaultMeal(), ai:'off' };
let cacheKey = K_LOCAL;
function loadCache(){ try { const o = JSON.parse(lsGet(cacheKey) || 'null'); S.profile = o?.profile || null; S.days = o?.days || {}; } catch(e) { S.profile = null; S.days = {}; } }
function saveCache(){ lsSet(cacheKey, JSON.stringify({profile:S.profile, days:S.days})); }

/* ───────── Ernährungs-Mathematik ───────── */
function sumItems(items){ const t = {}; NUTS.forEach(n => t[n.k] = 0); (items||[]).forEach(it => NUTS.forEach(n => t[n.k] += num(it[n.k]))); return t; }
function sumEntries(es){ const t = {}; NUTS.forEach(n => t[n.k] = 0); (es||[]).forEach(e => { const s = sumItems(e.items); NUTS.forEach(n => t[n.k] += s[n.k]); }); return t; }
function calc(p){
  if (!p || !(p.weight > 0) || !(p.height > 0) || !(p.age > 0) || !p.sex) return null;
  const h = p.height / 100, bmi = p.weight / (h*h);
  const bmr = 10*p.weight + 6.25*p.height - 5*p.age + (p.sex === 'm' ? 5 : -161);   // Mifflin-St Jeor
  const tdee = bmr * (ACT[p.activity] || ACT.light).f;
  const rate = num(p.rate) || 0.5;
  const delta = p.goal === 'lose' ? -rate*7700/7 : p.goal === 'gain' ? rate*7700/7 : 0;   // 7700 kcal ≈ 1 kg Körperfett
  let target = tdee + delta, warn = '';
  const floor = p.sex === 'm' ? 1500 : 1200;
  if (p.goal === 'lose' && target < floor) { target = floor; warn = `Dein Tagesziel wurde auf ${fmt(floor)} kcal angehoben – weniger ist ohne ärztliche Begleitung nicht empfehlenswert. Wähle ein langsameres Tempo.`; }
  else if (p.goal === 'lose' && -delta > tdee*0.25) warn = 'Das gewählte Tempo bedeutet ein großes Defizit (über 25 % deines Bedarfs). Langsamer ist meist nachhaltiger und schont die Muskeln.';
  if (p.goal === 'lose' && bmi < 18.5) warn = 'Dein BMI liegt im Untergewicht. Abnehmen wird nicht empfohlen – sprich bitte mit einer Ärztin oder einem Arzt.';
  const refW = bmi > 30 ? 25*h*h : p.weight;
  const protein = refW * (p.goal === 'keep' ? 1.4 : 1.8);
  const fat = target * 0.3 / 9;
  const carbs = Math.max(0, (target - protein*4 - fat*9) / 4);
  let eta = null;
  if (p.targetWeight > 0 && p.goal !== 'keep') {
    const diff = p.weight - p.targetWeight;
    if ((p.goal === 'lose' && diff > 0) || (p.goal === 'gain' && diff < 0)) {
      const weeks = Math.abs(diff) / rate, d = new Date(); d.setDate(d.getDate() + Math.round(weeks*7)); eta = {weeks, date:d};
    }
  }
  return {bmi, bmr, tdee, delta:target - tdee, target, protein, fat, carbs, warn, healthy:[18.5*h*h, 24.9*h*h], eta};
}
const bmiCat = b => b < 18.5 ? 'Untergewicht' : b < 25 ? 'Normalgewicht' : b < 30 ? 'Übergewicht' : b < 35 ? 'Adipositas Grad I' : b < 40 ? 'Adipositas Grad II' : 'Adipositas Grad III';
function refs(p, c){ // D-A-CH-Referenzwerte für Erwachsene
  const f = p?.sex === 'f', age = p?.age || 30, kcal = c?.target || 2000;
  return {kcal, protein:c?.protein||60, carbs:c?.carbs||250, fat:c?.fat||70, fiber:30, sugar:kcal*0.1/4, satfat:kcal*0.1/9,
    vitA:f?700:850, vitB12:4, vitC:f?95:110, vitD:20, vitE:f?12:14, folate:300, calcium:1000, iron:f?(age<51?16:14):11,
    magnesium:f?300:350, potassium:4000, sodium:1500};
}

/* ───────── Firebase ───────── */
let fb = null, unsubs = [];
async function initFirebase(){
  const [appM, authM, fsM] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  const app = appM.initializeApp(CONFIG.firebase);
  if (CONFIG.recaptchaSiteKey) {
    try {
      const ac = await import(FB + 'firebase-app-check.js');
      if (['localhost','127.0.0.1'].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      ac.initializeAppCheck(app, {provider:new ac.ReCaptchaEnterpriseProvider(CONFIG.recaptchaSiteKey), isTokenAutoRefreshEnabled:true});
    } catch(e) { console.warn('App Check', e); }
  }
  const auth = authM.getAuth(app);
  auth.languageCode = 'de';
  let db;
  try { db = fsM.initializeFirestore(app, {localCache: fsM.persistentLocalCache({tabManager: fsM.persistentMultipleTabManager()})}); }
  catch(e) { db = fsM.getFirestore(app); }
  let models = [];
  try {
    const aiM = await import(FB + 'firebase-ai.js');
    const ai = aiM.getAI(app, {backend: new aiM.GoogleAIBackend()});
    const gc = {responseMimeType:'application/json', temperature:0.2};
    const names = [CONFIG.geminiModel || 'gemini-3.5-flash', ...(CONFIG.fallbackModels || ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'])];
    models = [...new Set(names)].map(n => ({name:n, m:aiM.getGenerativeModel(ai, {model:n, generationConfig:gc})}));
  } catch(e) { console.warn('AI Logic', e); }
  fb = {app, auth, db, authM, fsM, models, model:models[0]?.m || null};
  S.ai = models.length ? 'on' : 'off';
  authM.getRedirectResult(auth).catch(e => showLoginError(e));
  authM.onAuthStateChanged(auth, u => {
    if (u) startCloud(u);
    else if (lsGet(K_MODE) === 'local') startLocal();
    else showLogin();
  });
}
function showLogin(){ S.mode = 'login'; $('#login').hidden = false; $('#app').hidden = true; $('#tabs').hidden = true; $('#fab').hidden = true; }
function hideLogin(){ $('#login').hidden = true; $('#app').hidden = false; $('#tabs').hidden = false; }
function showLoginError(e){
  const el = $('#login-err'); if (!el || !e) return;
  const c = e.code || '';
  if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return;
  el.textContent = c === 'auth/unauthorized-domain' ? 'Diese Domain ist in Firebase nicht freigegeben (Authentication → Einstellungen → Autorisierte Domains).'
    : c === 'auth/operation-not-allowed' ? 'Google-Anmeldung ist in Firebase noch nicht aktiviert (README Schritt 3).'
    : 'Anmeldung fehlgeschlagen. Bitte nochmal versuchen.';
  el.hidden = false;
}
async function signInGoogle(){
  const {authM, auth} = fb; const provider = new authM.GoogleAuthProvider();
  try { await authM.signInWithPopup(auth, provider); }
  catch(e) {
    if (['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(e.code)) await authM.signInWithRedirect(auth, provider);
    else showLoginError(e);
  }
}
function stopListeners(){ unsubs.forEach(u => { try { u(); } catch(e) {} }); unsubs = []; }

/* Aufbewahrung: Fotos 7 Tage, Einträge 1 Monat (Gewichtsverlauf bleibt) */
const KEEP_DAYS = 31, PHOTO_DAYS = 7;
const minDate = () => addDays(todayKey(), -(KEEP_DAYS - 1));
function cleanup(){
  const flag = 'tropheon.cleanup.' + cacheKey, t = todayKey();
  if (lsGet(flag) === t) return; lsSet(flag, t);
  const oldest = minDate(), photoCut = addDays(t, -PHOTO_DAYS);
  let removed = 0, photos = 0;
  Object.keys(S.days).forEach(k => {
    const d = S.days[k];
    if (k < oldest) { d.entries = []; removed++; saveDay(k); return; }
    if (k < photoCut && d?.entries?.some(e => String(e.thumb || '').startsWith('data:'))) {
      d.entries.forEach(e => { if (String(e.thumb || '').startsWith('data:')) { e.thumb = null; photos++; } }); saveDay(k);
    }
  });
  Object.values(productCache()).forEach(pr => { if (String(pr.img || '').startsWith('data:') && (pr.used || 0) < Date.now() - PHOTO_DAYS*864e5) { pr.img = null; const c = productCache(); c[pr.code] = pr; lsSet(K_PRODUCTS, JSON.stringify(c)); } });
  if (removed || photos) { console.info('Aufgeräumt', {removed, photos}); softRender(); }
}
function startLocal(){
  stopListeners(); S.mode = 'local'; S.user = null; cacheKey = K_LOCAL; loadCache(); cleanup(); hideLogin(); render();
}
function startCloud(user){
  stopListeners(); S.mode = 'cloud'; S.user = user; cacheKey = 'tropheon.cache.' + user.uid; loadCache(); hideLogin(); render();
  const {db, fsM} = fb;
  const profRef = fsM.doc(db, 'users', user.uid), daysRef = fsM.collection(db, 'users', user.uid, 'days');
  const migrateKey = 'tropheon.migrated.' + user.uid;
  unsubs.push(fsM.onSnapshot(profRef, s => {
    if (s.exists()) { S.profile = s.data(); saveCache(); softRender(); return; }
    if (s.metadata.fromCache) return;
    const local = JSON.parse(lsGet(K_LOCAL) || 'null');
    const p = S.profile || local?.profile;
    if (p) { S.profile = p; fsM.setDoc(profRef, clone(p)).catch(() => {}); softRender(); }
  }, e => console.warn(e)));
  unsubs.push(fsM.onSnapshot(daysRef, qs => {
    if (qs.empty && qs.metadata.fromCache) return;
    if (qs.empty && !lsGet(migrateKey)) {
      lsSet(migrateKey, '1');
      const local = JSON.parse(lsGet(K_LOCAL) || 'null')?.days || {};
      const all = {...local, ...S.days};
      Object.entries(all).forEach(([k, d]) => { if (d?.entries?.length) fsM.setDoc(fsM.doc(daysRef, k), {date:k, entries:d.entries, updated:Date.now()}).catch(() => {}); });
      if (Object.keys(all).length) return;
    }
    lsSet(migrateKey, '1');
    const m = {}; qs.forEach(d => { m[d.id] = d.data(); }); S.days = m; saveCache(); softRender();
    if (!qs.metadata.fromCache) { mergeLocalIntoCloud(); cleanup(); }
  }, e => console.warn(e)));
}
// Einträge, die offline bzw. ohne Anmeldung auf dem Gerät gemacht wurden, ins Konto übernehmen (doppelte per ID ausgeschlossen)
let merged = false;
function mergeLocalIntoCloud(){
  if (merged) return; merged = true;
  let local; try { local = JSON.parse(lsGet(K_LOCAL) || 'null'); } catch(e) { return; }
  if (!local?.days) return;
  let n = 0;
  Object.entries(local.days).forEach(([k, d]) => {
    if (!d?.entries?.length) return;
    const day = S.days[k] || (S.days[k] = {date:k, entries:[]}), ids = new Set(day.entries.map(e => e.id));
    const add = d.entries.filter(e => !ids.has(e.id)); if (!add.length) return;
    day.entries.push(...add); n += add.length; saveDay(k);
  });
  if (!S.profile && local.profile) { S.profile = local.profile; saveProfile(); }
  lsSet(K_LOCAL, JSON.stringify({profile:local.profile || null, days:{}}));
  if (n) { softRender(); toast(`${n} Einträge vom Gerät ins Konto übernommen`); }
}
function saveDay(k){
  const d = S.days[k];
  if (d && !d.entries?.length) delete S.days[k];
  saveCache();
  if (S.mode !== 'cloud') return;
  const {db, fsM} = fb, ref = fsM.doc(db, 'users', S.user.uid, 'days', k);
  const p = S.days[k] ? fsM.setDoc(ref, {date:k, entries:clone(S.days[k].entries), updated:Date.now()}) : fsM.deleteDoc(ref);
  p.catch(() => toast('Speichern in der Cloud fehlgeschlagen – auf dem Gerät gesichert.'));
}
function saveProfile(){
  saveCache();
  if (S.mode !== 'cloud') return;
  const {db, fsM} = fb;
  fsM.setDoc(fsM.doc(db, 'users', S.user.uid), clone(S.profile)).catch(() => toast('Profil konnte nicht in der Cloud gespeichert werden.'));
}
async function signOutNow(){ stopListeners(); lsSet(K_MODE, null); try { await fb.authM.signOut(fb.auth); } catch(e) {} location.reload(); }

/* ───────── KI (Gemini über Firebase AI Logic) ───────── */
const SCHEMA = '{"title":"kurzer Name der Mahlzeit","items":[{"name":"Komponente","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"satfat":0,"vitA":0,"vitB12":0,"vitC":0,"vitD":0,"vitE":0,"folate":0,"calcium":0,"iron":0,"magnesium":0,"potassium":0,"sodium":0}],"confidence":"hoch|mittel|niedrig","note":"ein kurzer Satz zu Unsicherheiten"}';
const UNITS = 'Einheiten: grams in g; kcal in kcal; protein, carbs, fat, fiber, sugar, satfat in g; vitA in µg RAE; vitB12 in µg; vitC in mg; vitD in µg; vitE in mg; folate in µg; calcium, iron, magnesium, potassium, sodium in mg. Alle Werte gelten für die geschätzte Menge der jeweiligen Komponente (nicht pro 100 g). Nur Zahlen, keine Einheiten in den Werten.';
const EXPERT = 'Du bist erfahrene Ernährungswissenschaftlerin. Gib realistische Werte nach Standard-Nährwertdatenbanken (BLS, USDA) an. Komponentennamen auf Deutsch.';
function normItems(arr){ return (Array.isArray(arr) ? arr : []).map(it => { const o = {name:String(it?.name || 'Zutat').slice(0,80)}; NUTS.forEach(n => o[n.k] = r1(Math.max(0, num(it?.[n.k])))); o.grams = r1(Math.max(0, num(it?.grams))); return o; }); }
function parseJSON(t){
  try { return JSON.parse(t); } catch(e) {}
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch(e) {} }
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b+1)); } catch(e) {} }
  throw {code:'invalid_json'};
}
let aiCtl = null, modelIdx = 0;
const isQuota = m => /\b429\b|RESOURCE_EXHAUSTED|quota|Too Many Requests|rate.?limit/i.test(m);
const isRetryable = m => isQuota(m) || /\b(404|500|503|504)\b|UNAVAILABLE|overloaded|not found|deadline/i.test(m);
async function ask(prompt, img){
  if (!fb?.models?.length) throw {code:'off'};
  aiCtl = new AbortController(); const sig = aiCtl.signal;
  const parts = [{text:prompt}]; if (img) parts.push({inlineData:{data:img.b64, mimeType:img.mime}});
  let lastErr;
  // Ein Modell nach dem anderen probieren: wenn eines überlastet oder sein Kontingent leer ist, nimmt das nächste
  for (let n = 0; n < fb.models.length; n++) {
    const i = (modelIdx + n) % fb.models.length;
    try {
      const res = await new Promise((ok, fail) => {
        const t = setTimeout(() => fail({code:'timeout'}), 45000);
        sig.addEventListener('abort', () => { clearTimeout(t); fail({code:'cancelled'}); });
        fb.models[i].m.generateContent(parts).then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); fail(e); });
      });
      modelIdx = i;
      return parseJSON(res.response.text());
    } catch(e) {
      lastErr = e; const m = String(e?.message || '');
      console.warn('KI', fb.models[i].name, e);
      if (e?.code === 'cancelled' || e?.code === 'invalid_json') throw e;
      if (!(e?.code === 'timeout' || isRetryable(m))) throw e;
    }
  }
  throw lastErr;
}
function aiError(e){
  const c = e?.code, m = String(e?.message || e || '');
  if (c === 'cancelled') return null;
  if (c === 'off') return configured ? 'Die KI ist nicht erreichbar. Prüfe Firebase AI Logic (README Schritt 5).' : 'Die Foto-Analyse braucht ein verbundenes Firebase-Projekt (siehe README). Du kannst manuell eintragen.';
  if (c === 'invalid_json') return 'Die Antwort war unvollständig. Bitte nochmal versuchen.';
  if (c === 'timeout') return 'Die KI antwortet gerade zu langsam. Versuch es gleich nochmal – oder scanne den Barcode.';
  let msg;
  if (/app.?check|attestation|recaptcha/i.test(m)) msg = 'App Check blockiert die Anfrage.';
  else if (isQuota(m)) msg = 'Das kostenlose KI-Kontingent ist für den Moment aufgebraucht. In ein paar Minuten geht es wieder – Barcode-Scan und manuelle Eingabe funktionieren immer.';
  else if (/SAFETY|blocked|RECITATION/i.test(m)) msg = 'Zu diesem Bild konnte keine Schätzung erstellt werden. Versuch ein anderes Foto.';
  else if (/api-not-enabled|SERVICE_DISABLED|has not been used|is disabled/i.test(m)) msg = 'Die Gemini-API ist im Firebase-Projekt noch nicht aktiviert (AI Logic → Jetzt starten).';
  else if (/PERMISSION_DENIED|\b403\b|API key/i.test(m)) msg = 'Zugriff verweigert – Firebase AI Logic oder App Check prüfen.';
  else if (/network|Failed to fetch|offline/i.test(m)) msg = 'Keine Verbindung. Prüfe dein Internet.';
  else msg = 'Die KI-Anfrage ist fehlgeschlagen. Bitte nochmal versuchen.';
  return msg + '\n\nTechnisch: ' + m.slice(0, 220);
}
function loadImage(file){ return new Promise((ok, fail) => { const url = URL.createObjectURL(file), img = new Image(); img.onload = () => ok({img, url}); img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('decode')); }; img.src = url; }); }
async function prepImage(file){
  const {img, url} = await loadImage(file);
  const max = 1024, sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth*sc); c.height = Math.round(img.naturalHeight*sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const b64 = c.toDataURL('image/jpeg', 0.8).split(',')[1];
  const s = 150, t = document.createElement('canvas'); t.width = s; t.height = s;
  const r = Math.max(s/img.naturalWidth, s/img.naturalHeight);
  t.getContext('2d').drawImage(img, (s - img.naturalWidth*r)/2, (s - img.naturalHeight*r)/2, img.naturalWidth*r, img.naturalHeight*r);
  URL.revokeObjectURL(url);
  return {b64, mime:'image/jpeg', thumb:t.toDataURL('image/jpeg', 0.7)};
}

/* ───────── Rendering ───────── */
function render(){
  if (S.mode === 'boot' || S.mode === 'login') return;
  document.querySelectorAll('.tab').forEach(t => t.dataset.view === S.view ? t.setAttribute('aria-current','page') : t.removeAttribute('aria-current'));
  $('#fab').hidden = S.view === 'profile';
  $('#app').innerHTML = topHTML() + (S.view === 'today' ? todayHTML() : S.view === 'history' ? historyHTML() : profileHTML());
  if (S.view === 'profile') updateProfileResults();
}
function softRender(){ if (S.view === 'profile') { const el = $('#store-chip'); if (el) el.innerHTML = storeText(); return; } render(); }
function storeText(){ return S.mode === 'cloud' ? 'Cloud ✓<br>' + esc(S.user?.displayName?.split(' ')[0] || '') : 'nur dieses<br>Gerät'; }
function topHTML(){ return `<div class="top"><div class="brand"><svg viewBox="0 0 200 200" aria-hidden="true"><use href="#olympian"/></svg><span><b>TROPHEON</b><small>Ancient Roots. Modern Nutrition.</small></span></div><span class="store-chip" id="store-chip">${storeText()}</span></div><div class="meander" aria-hidden="true"></div>`; }

function wreathRing(pct, over){
  const C0 = 80, R = 54, C = 2*Math.PI*R, p = Math.max(0, Math.min(1, pct));
  let leaves = '';
  for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
    const deg = 90 + side*(18 + i*13.5), a = deg*Math.PI/180, rr = i % 2 ? 66 : 71;
    const x = C0 + rr*Math.cos(a), y = C0 + rr*Math.sin(a), rot = deg + 90 + side*(-35);
    leaves += `<ellipse class="leaf" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="7.5" ry="3" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  return `<svg viewBox="0 0 160 160" class="ring" aria-hidden="true">${leaves}<circle cx="${C0}" cy="${C0}" r="${R}" class="ring-bg"/><circle cx="${C0}" cy="${C0}" r="${R}" class="ring-fg ${over?'over':''}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-p)).toFixed(1)}" transform="rotate(-90 ${C0} ${C0})"/></svg>`;
}
function column(lbl, val, tgt, cls){
  const p = tgt ? val/tgt : 0;
  return `<div class="col ${cls}"><div class="col-cap"></div><div class="col-echinus"></div><div class="col-shaft"><div class="col-fill ${p>1.1?'over':''}" style="height:${Math.min(100,p*100)}%"></div></div><div class="col-base"></div><div class="col-plinth"></div><b class="num">${fmt(val)}<small> / ${fmt(tgt)} g</small></b><span>${lbl}</span></div>`;
}
const pmHTML = t => `<span class="pm"><i class="P">P ${fmt(t.protein)}</i><i class="K">KH ${fmt(t.carbs)}</i><i class="F">F ${fmt(t.fat)}</i></span>`;

/* Orakel: ein Olympier kommentiert den Tag */
const GODS = {
  zeus:{n:'Zeus', g:'ΖΕΥΣ', r:'Herrscher des Olymp'}, demeter:{n:'Demeter', g:'ΔΗΜΗΤΗΡ', r:'Göttin der Ernte'},
  herakles:{n:'Herakles', g:'ΗΡΑΚΛΗΣ', r:'Held der Stärke'}, nike:{n:'Nike', g:'ΝΙΚΗ', r:'Göttin des Sieges'},
  dionysos:{n:'Dionysos', g:'ΔΙΟΝΥΣΟΣ', r:'Gott des Festes'}, athena:{n:'Athena', g:'ΑΘΗΝΑ', r:'Göttin der Weisheit'},
};
function oracle(k, entries, tot, c, R){
  const today = k === todayKey(), h = new Date().getHours(), gain = S.profile?.goal === 'gain';
  if (!c) return {god:'athena', t:'Erkenne dich selbst', x:'Γνῶθι σεαυτόν – stand am Tempel von Delphi. Leg im Profil Alter, Größe, Gewicht und Ziel fest, dann kenne ich deinen Bedarf.'};
  const rem = c.target - tot.kcal, p = tot.kcal / c.target, protLeft = R.protein - tot.protein;
  if (!entries.length) return today
    ? {god:'demeter', t:'Der Tisch ist gedeckt', x:`Demeter wartet auf deine erste Mahlzeit. Heute stehen dir ${fmt(c.target)} kcal und ${fmt(R.protein)} g Protein zu.`}
    : {god:'demeter', t:'Kein Eintrag an diesem Tag', x:'Für diesen Tag wurde nichts erfasst. Du kannst Mahlzeiten nachtragen.'};
  if (!gain && p > 1.1) return {god:'dionysos', t:`${fmt(-rem)} kcal über dem Ziel`, x:today ? 'Dionysos hat heute mitgefeiert. Kein Drama – ein Tag entscheidet nichts. Morgen zählt wieder.' : 'An diesem Tag hat Dionysos mitgefeiert. Ein einzelner Tag entscheidet nichts.'};
  if (Math.abs(p - 1) <= 0.1 && protLeft <= R.protein * 0.1) return {god:'nike', t:'Sieg!', x:`Kalorienziel und Protein erreicht – Nike bringt dir den Lorbeer. ${gain ? 'So wachsen Muskeln.' : 'So schmilzt das Fett, und die Muskeln bleiben.'}`, win:true};
  if (gain && today && h >= 18 && rem > 300) return {god:'herakles', t:`Noch ${fmt(rem)} kcal`, x:'Herakles wurde nicht mit leerem Magen stark. Für dein Aufbauziel fehlt heute noch eine richtige Mahlzeit.'};
  if (protLeft > R.protein * 0.35 && (!today || h >= 14)) return {god:'herakles', t:`Noch ${fmt(protLeft)} g Protein`, x:'Herakles mahnt: Ohne Protein keine Heldenkraft. Gute Quellen: griechischer Joghurt, Eier, Hähnchen, Linsen, Feta.'};
  if (entries.length >= 2 && tot.fiber < 12 && (!today || h >= 15)) return {god:'athena', t:'Mehr Grünes auf den Teller', x:`Athena rät: erst ${fmt(tot.fiber)} g Ballaststoffe. Gemüse, Hülsenfrüchte oder Oliven sättigen lange.`};
  if (rem >= 0) return {god:'zeus', t:`Noch ${fmt(rem)} kcal`, x:today ? `Zeus wacht über dein Ziel. ${gain ? 'Iss heute noch, was dir zusteht.' : `Du liegst gut – ${fmt(Math.max(0, protLeft))} g Protein fehlen noch.`}` : 'Unter dem Ziel geblieben.'};
  return {god:'zeus', t:`${fmt(-rem)} kcal über dem Ziel`, x:gain ? 'Für dein Aufbauziel ist das in Ordnung.' : 'Knapp drüber – Zeus drückt ein Auge zu.'};
}
function oracleHTML(o){
  const g = GODS[o.god];
  return `<section class="oracle ${o.win ? 'win' : ''}"><div class="coin"><svg viewBox="0 0 200 200" aria-hidden="true"><use href="#olympian"/></svg><span class="glyph"><svg viewBox="0 0 24 24"><use href="#g-${o.god}"/></svg></span></div><div class="oracle-t"><span class="eyebrow">${g.g} · ${g.r}</span><b>${esc(o.t)}</b><p>${esc(o.x)}</p></div></section>`;
}
function todayHTML(){
  const k = S.date, t = todayKey(), entries = S.days[k]?.entries || [], tot = sumEntries(entries), c = calc(S.profile), R = refs(S.profile, c);
  let h = `<div class="daynav"><button data-action="prev-day" aria-label="Vorheriger Tag" ${k <= minDate() ? 'disabled' : ''}>‹</button><label class="datepick">${dayLabel(k)}<small>${dateLong(k)}</small><input type="date" id="dpick" value="${k}" min="${minDate()}" max="${t}" aria-label="Tag auswählen"></label><button data-action="next-day" aria-label="Nächster Tag" ${k >= t ? 'disabled' : ''}>›</button></div>`;
  h += oracleHTML(oracle(k, entries, tot, c, R));
  if (c) {
    const rem = c.target - tot.kcal, over = rem < 0, bal = tot.kcal - c.tdee, gain = S.profile.goal === 'gain';
    const gl = S.profile.goal === 'lose' ? `Abnehmen · ${fmt(c.delta)} kcal/Tag` : gain ? `Zunehmen · ${sgn(c.delta)} kcal/Tag` : 'Gewicht halten';
    h += `<section class="panel"><div class="summary"><div class="ringwrap">${wreathRing(tot.kcal/c.target, over)}<div class="ring-center"><b class="num">${fmt(Math.abs(rem))}</b><span>${over ? 'kcal drüber' : 'kcal übrig'}</span></div></div>
      <div class="stats"><div class="stat"><span>Tagesziel</span><b>${fmt(c.target)} kcal</b></div><div class="stat"><span>Gegessen</span><b>${fmt(tot.kcal)} kcal</b></div><div class="stat"><span>Verbrauch</span><b>${fmt(c.tdee)} kcal</b></div><div class="stat"><span>${bal <= 0 ? 'Defizit' : 'Überschuss'}</span><b class="${(gain ? bal >= 0 : bal <= 0) ? 'pos' : 'neg'}">${sgn(bal)} kcal</b></div><span class="goalchip">${gl}</span></div></div>
      <div class="colonnade">${column('Protein', tot.protein, R.protein, 'protein')}${column('Kohlenh.', tot.carbs, R.carbs, 'carbs')}${column('Fett', tot.fat, R.fat, 'fat')}</div></section>`;
  } else {
    h += `<section class="panel"><h2>Erst dein Ziel festlegen</h2><p class="muted" style="margin:6px 0 12px">Mit Alter, Größe, Gewicht und Aktivität berechne ich deinen Kalorienbedarf, dein Defizit zum Abnehmen oder den Überschuss zum Zunehmen.</p><button class="primary" data-action="tab" data-view="profile">Profil einrichten</button>${entries.length ? `<hr class="hair"><div class="stat"><span>Gegessen</span><b>${fmt(tot.kcal)} kcal</b></div>` : ''}</section>`;
  }
  if (!entries.length) {
    h += `<div class="empty"><svg viewBox="0 0 120 120" aria-hidden="true"><use href="#amphora"/></svg><b>Die Amphore ist leer</b><span>Fotografiere deinen Teller – ich erkenne die Speisen und schätze Kalorien, Protein und Vitamine. Du kannst alles nachträglich korrigieren.</span><button class="primary" data-action="open-add">Erste Mahlzeit erfassen</button></div>`;
  } else {
    MEALS.forEach(m => {
      const es = entries.filter(e => e.meal === m.k); if (!es.length) return; const mt = sumEntries(es);
      h += `<section class="meal-group"><div class="meal-head"><h3>${m.l}<small>${m.g}</small></h3><span>${fmt(mt.kcal)} kcal</span></div>${es.map(e => { const s = sumItems(e.items); return `<button class="entry" data-action="edit" data-id="${esc(e.id)}">${e.thumb ? `<img class="thumb" src="${e.thumb}" alt="">` : `<span class="thumb">${esc((e.title || '?').trim()[0]?.toUpperCase() || '?')}</span>`}<span class="t"><b>${esc(e.title)}</b><small>${pmHTML(s)}</small></span><span class="k num">${fmt(s.kcal)}<small>kcal</small></span></button>`; }).join('')}</section>`;
    });
    h += `<section class="panel"><h2>Nährstoffe des Tages</h2><hr class="rule"><div class="label-table">${NUTS.filter(n => !n.main).map(n => { const v = tot[n.k], r = R[n.k], p = r ? v/r : 0; const cls = n.limit ? (p > 1 ? 'badf' : '') : (p >= 1 ? 'done' : ''); const col = n.limit && p > 1 ? 'var(--bad)' : !n.limit && p >= 1 ? 'var(--good)' : 'inherit'; return `<div class="lt-row ${n.limit ? 'limit' : ''}"><span class="lbl">${n.l}</span><span class="v"><b>${fmt(v, v < 10 && v > 0 ? 1 : 0)}</b> / ${fmt(r, r < 10 ? 1 : 0)} ${n.u}</span><span class="p num" style="color:${col}">${fmt(p*100)}%</span><div class="mini"><i class="${cls}" style="width:${Math.min(100, p*100)}%"></i></div></div>`; }).join('')}</div><p class="foot">Schätzwerte aus der Bildanalyse. Referenz: D-A-CH-Empfehlungen für Erwachsene; „max.“ markiert Obergrenzen.</p></section>`;
  }
  return h;
}

function historyHTML(){
  const n = S.range, t = todayKey(), keys = []; for (let i = n-1; i >= 0; i--) keys.push(addDays(t, -i));
  const c = calc(S.profile), vals = keys.map(k => sumEntries(S.days[k]?.entries));
  const logged = keys.map((k, i) => ({k, v:vals[i]})).filter(x => x.v.kcal > 0);
  const avg = a => logged.length ? logged.reduce((s, x) => s + x.v[a], 0) / logged.length : 0;
  const bal = c ? logged.reduce((s, x) => s + (x.v.kcal - c.tdee), 0) : 0, gain = S.profile?.goal === 'gain';
  const good = gain ? bal >= 0 : bal <= 0;
  let h = `<div class="hist-top"><h2 class="sec-title">Verlauf</h2><div class="seg" role="radiogroup" aria-label="Zeitraum">${[7,14,30].map(x => `<label><input type="radio" name="rng" data-action="range" data-n="${x}" ${x === n ? 'checked' : ''}><span>${x} Tage</span></label>`).join('')}</div></div>`;
  h += `<div class="kpis"><div class="kpi"><small>Ø Kalorien</small><b class="num">${fmt(avg('kcal'))}</b><span>${c ? `Ziel ${fmt(c.target)} kcal` : 'pro erfasstem Tag'}</span></div><div class="kpi"><small>Ø Protein</small><b class="num">${fmt(avg('protein'))} g</b><span>${c ? `Ziel ${fmt(c.protein)} g` : 'pro Tag'}</span></div><div class="kpi"><small>Tage erfasst</small><b class="num">${logged.length} / ${n}</b><span>im Zeitraum</span></div><div class="kpi"><small>${bal <= 0 ? 'Defizit gesamt' : 'Überschuss gesamt'}</small><b class="num ${c ? (good ? 'pos' : 'neg') : ''}">${c ? sgn(bal) : '–'}</b><span>${c ? `≈ ${sgn(bal/7700, 2)} kg Körperfett` : 'Profil nötig'}</span></div></div>`;
  h += `<section class="panel"><h2>Kalorien pro Tag</h2>${barChart(keys, vals, c)}<div class="legend"><span><i style="background:var(--good)"></i>im Ziel (±10 %)</span><span><i style="background:var(--protein)"></i>darunter</span><span><i style="background:var(--bad)"></i>darüber</span><span><i style="background:var(--gold);height:2px"></i>Tagesziel</span></div></section>`;
  const wl = (S.profile?.weightLog || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
  if (wl.length >= 2) h += `<section class="panel"><h2>Gewicht</h2>${weightChart(wl)}<p class="foot">${fmt(wl[0].kg, 1)} kg am ${fromKey(wl[0].date).toLocaleDateString('de-AT')} → ${fmt(wl.at(-1).kg, 1)} kg (${sgn(wl.at(-1).kg - wl[0].kg, 1)} kg)</p></section>`;
  const all = Object.keys(S.days).filter(k => S.days[k]?.entries?.length).sort().reverse();
  h += `<section class="panel"><h2>Alle Tage</h2><hr class="rule">${all.length ? `<div class="daylist">${all.map(k => { const s = sumEntries(S.days[k].entries); let pill = '<span></span>'; if (c) { const d = s.kcal - c.target, p = d / c.target; pill = `<span class="pill ${Math.abs(p) <= 0.1 ? 'ok' : d > 0 ? 'over' : 'under'}">${sgn(d)}</span>`; } return `<button class="dayrow" data-action="goto-day" data-date="${k}"><span><b>${dayLabel(k)}</b><small>${dateLong(k)} · ${S.days[k].entries.length} ${S.days[k].entries.length === 1 ? 'Eintrag' : 'Einträge'}</small></span>${pill}<span class="kc num">${fmt(s.kcal)}</span></button>`; }).join('')}</div>` : '<p class="muted">Sobald du Mahlzeiten erfasst, erscheinen hier alle Tage zum Nachschauen.</p>'}</section>`;
  return h;
}
function barChart(keys, vals, c){
  const W = 340, H = 160, top = 10, bot = 20, goal = c?.target || 0, mx = Math.max(goal*1.3, ...vals.map(v => v.kcal), 800);
  const y = v => H - bot - (v/mx)*(H - bot - top), bw = W / keys.length, gap = Math.min(6, bw*0.25);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kalorien pro Tag">`;
  [0.5, 1].forEach(f => { const v = mx*f; s += `<line class="grid" x1="0" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`; });
  keys.forEach((k, i) => {
    const v = vals[i].kcal, x = i*bw + gap/2, w = bw - gap;
    let cl = 'b-none'; if (v > 0) cl = goal ? (Math.abs(v - goal)/goal <= 0.1 ? 'b-ok' : v > goal ? 'b-over' : 'b-under') : 'b-ok';
    const hh = v > 0 ? Math.max(2, H - bot - y(v)) : 3;
    s += `<rect class="${cl}" x="${x.toFixed(1)}" y="${(H - bot - hh).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" rx="1"/>`;
    const d = fromKey(k), show = keys.length <= 14 || i % 5 === 0 || i === keys.length - 1;
    if (show) s += `<text x="${(x + w/2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${keys.length <= 7 ? d.toLocaleDateString('de-AT',{weekday:'short'}).slice(0,2) : d.getDate()}</text>`;
  });
  if (goal) s += `<line class="goal" x1="0" x2="${W}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}"/><text class="goal-t" x="${W-2}" y="${(y(goal) - 4).toFixed(1)}" text-anchor="end">${fmt(goal)}</text>`;
  return s + '</svg>';
}
function weightChart(wl){
  const W = 340, H = 130, p = 16, xs = wl.map(w => fromKey(w.date).getTime()), ys = wl.map(w => w.kg);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys) - 0.5, y1 = Math.max(...ys) + 0.5;
  const X = t => p + (x1 === x0 ? 0.5 : (t - x0)/(x1 - x0))*(W - 2*p), Y = v => H - p - (v - y0)/(y1 - y0)*(H - 2*p);
  const pts = wl.map((w, i) => `${X(xs[i]).toFixed(1)},${Y(w.kg).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf"><line class="grid" x1="0" x2="${W}" y1="${Y(y1-0.5).toFixed(1)}" y2="${Y(y1-0.5).toFixed(1)}"/><line class="grid" x1="0" x2="${W}" y1="${Y(y0+0.5).toFixed(1)}" y2="${Y(y0+0.5).toFixed(1)}"/><text x="2" y="${(Y(y1-0.5)-3).toFixed(1)}">${fmt(y1-0.5,1)}</text><text x="2" y="${(Y(y0+0.5)-3).toFixed(1)}">${fmt(y0+0.5,1)}</text><polyline class="wline" points="${pts}"/>${wl.map((w, i) => `<circle class="wdot" cx="${X(xs[i]).toFixed(1)}" cy="${Y(w.kg).toFixed(1)}" r="${i === wl.length-1 ? 4 : 2.5}"/>`).join('')}</svg>`;
}

function profileHTML(){
  const p = S.profile || {sex:'', age:'', height:'', weight:'', activity:'light', goal:'lose', rate:0.5, targetWeight:''};
  const radio = (name, val, lab, cur) => `<label><input type="radio" name="${name}" id="${name}-${val}" value="${val}" ${cur === val ? 'checked' : ''}><span>${lab}</span></label>`;
  const theme = lsGet(K_THEME) || 'system';
  const acct = S.mode === 'cloud'
    ? `<div class="acct"><span>Angemeldet als <b>${esc(S.user?.email || S.user?.displayName || '')}</b><br><small class="muted">Daten werden in deinem Firebase-Konto gespeichert und auf allen Geräten synchronisiert.</small></span><button class="btn" data-action="sign-out">Abmelden</button></div>`
    : `<div class="acct"><span><b>Nur auf diesem Gerät</b><br><small class="muted">${configured ? 'Melde dich an, um deine Daten zu sichern und auf mehreren Geräten zu nutzen. Bisherige Einträge werden übernommen.' : 'Firebase ist noch nicht verbunden – siehe README im Repository.'}</small></span>${configured ? '<button class="btn" data-action="go-login">Anmelden</button>' : ''}</div>`;
  return `<h2 class="sec-title">Dein Profil</h2>
  <section class="panel" id="pform"><div style="display:flex;flex-direction:column;gap:14px">
    <div class="field"><span class="flabel">Körper (für die Formel)</span><div class="seg">${radio('p-sex','f','Weiblich',p.sex)}${radio('p-sex','m','Männlich',p.sex)}</div></div>
    <div class="grid3"><div class="field"><label for="p-age">Alter</label><input type="number" id="p-age" inputmode="numeric" min="14" max="100" placeholder="Jahre" value="${esc(p.age)}"></div><div class="field"><label for="p-height">Größe cm</label><input type="number" id="p-height" inputmode="decimal" min="120" max="230" placeholder="178" value="${esc(p.height)}"></div><div class="field"><label for="p-weight">Gewicht kg</label><input type="number" id="p-weight" inputmode="decimal" step="0.1" min="30" max="300" placeholder="80" value="${esc(p.weight)}"></div></div>
    <div class="field"><label for="p-activity">Aktivität im Alltag</label><select id="p-activity">${Object.entries(ACT).map(([k, a]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${a.l}</option>`).join('')}</select></div>
    <div class="field"><span class="flabel">Ziel</span><div class="seg">${radio('p-goal','lose','Abnehmen',p.goal)}${radio('p-goal','keep','Halten',p.goal)}${radio('p-goal','gain','Zunehmen',p.goal)}</div></div>
    <div class="grid2" id="p-rate-wrap"><div class="field"><label for="p-rate">Tempo</label><select id="p-rate"></select></div><div class="field"><label for="p-target">Zielgewicht kg</label><input type="number" id="p-target" inputmode="decimal" step="0.1" placeholder="optional" value="${esc(p.targetWeight)}"></div></div>
    <button class="primary" data-action="save-profile">Profil speichern</button>
  </div></section>
  <section class="panel"><h2>Deine Werte</h2><hr class="rule"><div class="results" id="p-results"></div></section>
  <section class="panel"><h2>Gewicht</h2><p class="muted" style="margin:4px 0 10px">Am besten morgens nüchtern. Gleiches Datum nochmal eintragen überschreibt den Wert. Dein Bedarf rechnet immer mit dem neuesten Gewicht.</p>
    <div class="weightlog"><div class="field"><label for="w-date">Datum</label><input type="date" id="w-date" value="${todayKey()}" max="${todayKey()}"></div><div class="field"><label for="w-new">kg</label><input type="number" id="w-new" inputmode="decimal" step="0.1" placeholder="${esc(p.weight || '80,0')}"></div><button class="btn" data-action="log-weight">Speichern</button></div>
    ${weightListHTML(p)}</section>
  <section class="panel"><h2>Konto &amp; Darstellung</h2><hr class="rule">${acct}<hr class="hair"><div class="field"><span class="flabel">Erscheinungsbild</span><div class="seg" id="theme-seg">${radio('p-theme','system','System',theme)}${radio('p-theme','light','Marmor',theme)}${radio('p-theme','dark','Schwarzfigurig',theme)}</div></div></section>
  <div class="meander gold" aria-hidden="true"></div>
  <p class="disclaimer">Alle Nährwerte aus Fotos sind Schätzungen. Bedarf nach Mifflin-St-Jeor-Formel, Referenzwerte nach D-A-CH. Kein Ersatz für ärztliche oder diätologische Beratung.</p>`;
}
function weightListHTML(p){
  const wl = (p.weightLog || []).slice().sort((a, b) => a.date < b.date ? 1 : -1);
  if (!wl.length) return '';
  return `<div class="daylist" id="w-list" style="margin-top:8px">${wl.slice(0, 40).map((w, i) => { const prev = wl[i + 1]; const d = prev ? w.kg - prev.kg : 0; return `<div class="wrow"><span><b>${fmt(w.kg, 1)} kg</b><small>${dayLabel(w.date)} · ${fromKey(w.date).toLocaleDateString('de-AT')}</small></span>${prev ? `<span class="pill ${d < 0 ? 'ok' : d > 0 ? 'over' : 'under'}">${sgn(d, 1)}</span>` : '<span></span>'}<button class="icon-btn" data-action="w-edit" data-date="${w.date}" aria-label="Bearbeiten">✎</button><button class="icon-btn" data-action="w-del" data-date="${w.date}" aria-label="Löschen">×</button></div>`; }).join('')}</div>`;
}
function readProfileForm(){
  const v = id => $('#' + id)?.value, r = n => document.querySelector(`input[name="${n}"]:checked`)?.value || '';
  return {...(S.profile || {}), sex:r('p-sex'), age:num(v('p-age')) || '', height:num(v('p-height')) || '', weight:num(v('p-weight')) || '',
    activity:v('p-activity') || 'light', goal:r('p-goal') || 'keep', rate:num(v('p-rate')) || num(S.profile?.rate) || 0.5, targetWeight:num(v('p-target')) || ''};
}
function rateOptions(goal, cur){ const o = goal === 'gain' ? [0.25, 0.5] : [0.25, 0.5, 0.75, 1]; if (!o.includes(cur)) cur = 0.5; return o.map(x => `<option value="${x}" ${x === cur ? 'selected' : ''}>${x.toLocaleString('de-AT')} kg pro Woche (${goal === 'gain' ? '+' : '−'}${fmt(x*1100)} kcal/Tag)</option>`).join(''); }
function updateProfileResults(){
  const p = readProfileForm(), wrap = $('#p-rate-wrap'), sel = $('#p-rate');
  if (wrap) { wrap.hidden = p.goal === 'keep'; if (sel.dataset.goal !== p.goal) { sel.innerHTML = rateOptions(p.goal, p.rate); sel.dataset.goal = p.goal; } }
  const c = calc({...p, rate:num(sel?.value) || p.rate}), el = $('#p-results'); if (!el) return;
  if (!c) { el.innerHTML = '<p class="muted" style="margin:0">Fülle Körper, Alter, Größe und Gewicht aus – dann siehst du hier BMI, Grundumsatz, Tagesbedarf und dein Kalorienziel.</p>'; return; }
  const pos = Math.max(0, Math.min(100, (c.bmi - 15)/25*100));
  el.innerHTML = `<div><span class="flabel">Body-Mass-Index</span><div class="bmi-big"><b class="num">${fmt(c.bmi, 1)}</b><span>${bmiCat(c.bmi)}</span></div><div class="bmi-scale"><i style="left:${pos}%"></i><span style="left:14%">18,5</span><span style="left:40%">25</span><span style="left:60%">30</span></div><span class="muted" style="font-size:14px">Gesunder Bereich für ${fmt(p.height)} cm: ${fmt(c.healthy[0], 1)}–${fmt(c.healthy[1], 1)} kg</span></div>
  <div class="label-table">
   <div class="lt-row"><span>Grundumsatz (in Ruhe)</span><span class="v"><b>${fmt(c.bmr)}</b> kcal</span><span></span></div>
   <div class="lt-row"><span>Gesamtbedarf mit Aktivität</span><span class="v"><b>${fmt(c.tdee)}</b> kcal</span><span></span></div>
   <div class="lt-row"><span>${p.goal === 'lose' ? 'Defizit' : p.goal === 'gain' ? 'Überschuss' : 'Anpassung'}</span><span class="v"><b>${sgn(c.delta)}</b> kcal</span><span></span></div>
   <div class="lt-row" style="border-bottom:3px double var(--ink)"><b>Dein Tagesziel</b><span class="v"><b style="font-size:16px">${fmt(c.target)}</b> kcal</span><span></span></div>
   <div class="lt-row"><span style="color:var(--protein);font-weight:700">Protein</span><span class="v"><b>${fmt(c.protein)}</b> g</span><span class="p">${fmt(c.protein*4/c.target*100)}%</span></div>
   <div class="lt-row"><span style="color:var(--carbs);font-weight:700">Kohlenhydrate</span><span class="v"><b>${fmt(c.carbs)}</b> g</span><span class="p">${fmt(c.carbs*4/c.target*100)}%</span></div>
   <div class="lt-row"><span style="color:var(--fat);font-weight:700">Fett</span><span class="v"><b>${fmt(c.fat)}</b> g</span><span class="p">30%</span></div>
  </div>
  ${c.eta ? `<p style="margin:0">Bei diesem Tempo erreichst du <b>${fmt(p.targetWeight, 1)} kg</b> in etwa <b>${fmt(c.eta.weeks)} Wochen</b> – rund um den ${c.eta.date.toLocaleDateString('de-AT',{day:'numeric',month:'long',year:'numeric'})}.</p>` : ''}
  ${c.warn ? `<div class="warnbox">${esc(c.warn)}</div>` : ''}`;
}

function applyWeights(p){
  p.weightLog.sort((a, b) => a.date < b.date ? -1 : 1);
  if (p.weightLog.length) p.weight = p.weightLog.at(-1).kg;
  S.profile = p; const wi = $('#p-weight'); if (wi) wi.value = p.weight;
  $('#w-new').value = ''; $('#w-date').value = todayKey();
  const list = $('#w-list'), html = weightListHTML(p);
  if (list) list.outerHTML = html || '<div id="w-list"></div>'; else $('#w-date').closest('.panel').insertAdjacentHTML('beforeend', html);
  updateProfileResults(); saveProfile();
}

/* ───────── Bottom-Sheets ───────── */
function openSheet(html){ $('#sheet-root').innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><div id="sheet-body">${html}</div></div></div>`; document.body.style.overflow = 'hidden'; }
function setSheet(html){ stopScan(); const b = $('#sheet-body'); if (b) b.innerHTML = html; else openSheet(html); }
function closeSheet(){ stopScan(); aiCtl?.abort(); $('#sheet-root').innerHTML = ''; document.body.style.overflow = ''; S.draft = null; S.draftImg = null; }
const head = t => `<div class="sheet-head"><h2>${t}</h2><button class="icon-btn" data-action="close-sheet" aria-label="Schließen">×</button></div>`;
const mealSeg = cur => `<div class="seg" role="radiogroup" aria-label="Mahlzeit">${MEALS.map(m => `<label><input type="radio" name="add-meal" value="${m.k}" ${m.k === cur ? 'checked' : ''}><span>${m.s}</span></label>`).join('')}</div>`;
const readMeal = () => document.querySelector('input[name="add-meal"]:checked')?.value || S.pendingMeal;
function addMenuHTML(){
  const off = S.ai !== 'on';
  return `${head('Essen erfassen')}
  <p class="muted" style="margin:-6px 0 0">${S.date === todayKey() ? 'Für heute' : 'Für ' + dayLabel(S.date) + ', ' + dateLong(S.date)}</p>
  ${mealSeg(S.pendingMeal)}
  <div class="add-grid">
    <button class="add-opt big" data-action="scan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7 8v8M10 8v8M13 8v8M16 8v8"/></svg><span><b>Barcode scannen</b><br><small>Verpackte Produkte – sofort und ohne KI</small></span></button>
    <label class="add-opt big" ${off ? 'aria-disabled="true"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span><b>Teller fotografieren</b><br><small>KI erkennt Speisen und Menge</small></span><input type="file" id="f-cam" accept="image/*" capture="environment" hidden></label>
    <label class="add-opt" ${off ? 'aria-disabled="true"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg><b>Aus Galerie</b><small>Vorhandenes Foto wählen</small><input type="file" id="f-gal" accept="image/*" hidden></label>
    <button class="add-opt" data-action="add-text" ${off ? 'aria-disabled="true"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 11h16M4 16h10"/></svg><b>Beschreiben</b><small>„2 Spiegeleier und ein Vollkornbrot“</small></button>
    <button class="add-opt" data-action="add-manual"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg><b>Manuell</b><small>Werte selbst eintippen</small></button>
    <button class="add-opt" data-action="recent-meals"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg><b>Schon gegessen</b><small>Frühere Mahlzeit nochmal eintragen</small></button>
  </div>
  ${recentProductsHTML()}
  ${off ? `<p class="ai-note">${esc(aiError({code:'off'}))}</p>` : ''}`;
}

/* ───────── Barcode-Scanner + Produktdatenbank (Open Food Facts) ───────── */
const K_PRODUCTS = 'tropheon.products';
const BC_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const BC_LIB = 'https://cdn.jsdelivr.net/npm/barcode-detector@3.2.2/dist/es/ponyfill.js';
// Open Food Facts speichert *_100g in Grundeinheit (g); Faktor rechnet in die App-Einheit um
const OFF_MAP = {protein:['proteins',1], carbs:['carbohydrates',1], fat:['fat',1], fiber:['fiber',1], sugar:['sugars',1], satfat:['saturated-fat',1],
  vitA:['vitamin-a',1e6], vitB12:['vitamin-b12',1e6], vitC:['vitamin-c',1e3], vitD:['vitamin-d',1e6], vitE:['vitamin-e',1e3], folate:['folates',1e6],
  calcium:['calcium',1e3], iron:['iron',1e3], magnesium:['magnesium',1e3], potassium:['potassium',1e3], sodium:['sodium',1e3]};

function productCache(){ try { return JSON.parse(lsGet(K_PRODUCTS) || '{}') || {}; } catch(e) { return {}; } }
function cacheProduct(p){
  const c = productCache(); c[p.code] = {...p, used:Date.now()};
  const keep = Object.keys(c).sort((a, b) => (c[b].used || 0) - (c[a].used || 0)).slice(0, 80);
  const o = {}; keep.forEach(k => o[k] = c[k]); lsSet(K_PRODUCTS, JSON.stringify(o));
  if (S.mode === 'cloud') { const {db, fsM} = fb; fsM.setDoc(fsM.doc(db, 'users', S.user.uid, 'products', p.code), clone({...p, used:Date.now()})).catch(() => {}); }
}
async function cloudProduct(code){
  if (S.mode !== 'cloud') return null;
  try { const {db, fsM} = fb; const s = await fsM.getDoc(fsM.doc(db, 'users', S.user.uid, 'products', code)); return s.exists() ? s.data() : null; } catch(e) { return null; }
}
function recentProductsHTML(){
  const list = Object.values(productCache()).filter(p => p.per100?.kcal >= 0 && p.hasNutri).sort((a, b) => (b.used || 0) - (a.used || 0)).slice(0, 8);
  if (!list.length) return '';
  return `<div class="field"><span class="flabel">Zuletzt gescannt</span><div class="chips">${list.map(p => `<button class="chip" data-action="open-product" data-code="${esc(p.code)}">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ''}<span>${esc(p.name)}</span></button>`).join('')}</div></div>`;
}
const validEAN = c => {
  if (!/^\d{8}$|^\d{12,14}$/.test(c)) return false;
  const d = c.split('').map(Number), chk = d.pop();
  const sum = d.reverse().reduce((s, v, i) => s + v * (i % 2 ? 1 : 3), 0);
  return (10 - sum % 10) % 10 === chk;
};
function parseOFF(code, p){
  const n = p.nutriments || {};
  const g = k => { const v = n[k + '_100g']; return v === undefined || v === '' ? null : num(v); };
  const per100 = {};
  let kcal = g('energy-kcal'); if (kcal == null && g('energy') != null) kcal = g('energy') / 4.184;
  per100.kcal = kcal ?? 0;
  Object.entries(OFF_MAP).forEach(([k, [off, f]]) => { const v = g(off) ?? (k === 'folate' ? g('vitamin-b9') : null); per100[k] = v == null ? 0 : v * f; });
  if (!per100.sodium && g('salt') != null) per100.sodium = g('salt') / 2.5 * 1000;
  Object.keys(per100).forEach(k => per100[k] = Math.round(per100[k] * 100) / 100);
  const serving = num(p.serving_quantity) > 0 ? num(p.serving_quantity) : null;
  return {code, name:String(p.product_name_de || p.product_name || p.generic_name_de || 'Produkt ' + code).trim().slice(0, 80), brand:String(p.brands || '').split(',')[0].trim().slice(0, 40),
    qty:String(p.quantity || '').slice(0, 30), img:p.image_front_small_url || p.image_small_url || null, per100, serving, servingLabel:String(p.serving_size || '').slice(0, 40),
    hasNutri:kcal != null, source:'off'};
}
async function lookupBarcode(code){
  const local = productCache()[code]; if (local) return local;
  const cloud = await cloudProduct(code); if (cloud) { cacheProduct(cloud); return cloud; }
  const fields = 'code,product_name,product_name_de,generic_name_de,brands,quantity,serving_size,serving_quantity,image_front_small_url,image_small_url,nutriments';
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?lc=de&fields=${fields}`, {signal:ctl.signal});
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(); if (j.status !== 1 || !j.product) return null;
    const p = parseOFF(code, j.product); cacheProduct(p); return p;
  } finally { clearTimeout(t); }
}

let scan = null;
let detectorP = null;
function getDetector(){
  return detectorP ||= (async () => {
    if ('BarcodeDetector' in window) {
      try { const f = await window.BarcodeDetector.getSupportedFormats(); if (f.includes('ean_13')) return new window.BarcodeDetector({formats:BC_FORMATS.filter(x => f.includes(x))}); } catch(e) {}
    }
    const m = await import(BC_LIB);
    return new m.BarcodeDetector({formats:BC_FORMATS});
  })().catch(e => { detectorP = null; throw e; });
}
function stopScan(){
  if (!scan) return; const s = scan; scan = null;
  clearTimeout(s.timer); s.stream?.getTracks().forEach(t => t.stop());
}
function scannerHTML(msg){
  return `${head('Barcode scannen')}
  <div class="scanner"><video id="bc-video" playsinline muted autoplay></video><div class="scan-frame"><i></i></div><button class="torch" id="bc-torch" type="button" aria-label="Licht an/aus" hidden><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 2h6l-1 6h-4zM10 8h4v13h-4zM12 12v3"/></svg></button><p class="scan-msg" id="bc-msg">${msg || 'Kamera wird gestartet…'}</p></div>
  <div class="add-item"><input id="bc-code" inputmode="numeric" pattern="[0-9]*" placeholder="oder Nummer eintippen, z. B. 4001686301265" aria-label="Barcode-Nummer"><button class="btn" data-action="bc-manual">Suchen</button></div>
  <label class="link" style="align-self:flex-start;cursor:pointer">Foto vom Barcode verwenden<input type="file" id="bc-file" accept="image/*" hidden></label>`;
}
function warmScanner(){ getDetector().then(d => { const c = document.createElement('canvas'); c.width = c.height = 16; return d.detect(c); }).catch(() => {}); }
async function startScan(){
  S.pendingMeal = readMeal();
  setSheet(scannerHTML());
  const video = $('#bc-video'), msg = $('#bc-msg');
  const my = {stream:null, timer:null}; scan = my;
  let detector;
  try {
    const [d, stream] = await Promise.all([getDetector(), navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1920}, height:{ideal:1080}}, audio:false})]);
    if (scan !== my) { stream.getTracks().forEach(t => t.stop()); return; }
    detector = d; my.stream = stream; video.srcObject = stream; await video.play().catch(() => {});
    const track = stream.getVideoTracks()[0], caps = track.getCapabilities?.() || {};
    const adv = [];
    if (caps.focusMode?.includes('continuous')) adv.push({focusMode:'continuous'});
    if (caps.zoom && caps.zoom.max >= 1.5) adv.push({zoom:Math.min(caps.zoom.max, 1.6)});
    if (adv.length) track.applyConstraints({advanced:adv}).catch(() => {});
    if (caps.torch) { const tb = $('#bc-torch'); tb.hidden = false; let on = false; tb.onclick = () => { on = !on; track.applyConstraints({advanced:[{torch:on}]}).catch(() => {}); tb.classList.toggle('on', on); }; }
    msg.textContent = 'Halte den Barcode in den Rahmen';
  } catch(e) {
    if (scan !== my) return;
    msg.textContent = e?.name === 'NotAllowedError' ? 'Kein Kamerazugriff. Erlaube die Kamera in den Browser-Einstellungen – oder tippe die Nummer ein.' : e?.name ? 'Kamera nicht verfügbar. Tippe die Nummer ein oder nimm ein Foto vom Barcode.' : 'Der Scanner konnte nicht geladen werden. Tippe die Nummer ein.';
    return;
  }
  // Nur den Bereich im Rahmen auswerten – kleiner = deutlich schneller und treffsicherer
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', {willReadFrequently:true});
  let frame = 0;
  const tick = async () => {
    if (scan !== my) return;
    try {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (video.readyState >= 2 && vw) {
        let src = video;
        if (frame++ % 4 !== 3) {
          const sw = vw * 0.86, sh = vh * 0.5, sc = Math.min(1, 900 / sw);
          cv.width = Math.round(sw * sc); cv.height = Math.round(sh * sc);
          cx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
          src = cv;
        }
        const res = await detector.detect(src);
        for (const r of res) {
          const c = String(r.rawValue || '').replace(/\D/g, '');
          if (validEAN(c)) { navigator.vibrate?.(60); onBarcode(c); return; }
        }
      }
    } catch(e) {}
    if (scan === my) my.timer = setTimeout(tick, 40);
  };
  tick();
}
async function scanFile(file){
  if (!file) return; const msg = $('#bc-msg'); if (msg) msg.textContent = 'Suche Barcode im Foto…';
  try {
    const d = await getDetector(), bmp = await createImageBitmap(file), res = await d.detect(bmp);
    const c = res.map(r => String(r.rawValue || '').replace(/\D/g, '')).find(validEAN);
    if (c) onBarcode(c); else if (msg) msg.textContent = 'Kein Barcode im Foto gefunden. Versuch es näher und scharf – oder tippe die Nummer ein.';
  } catch(e) { if (msg) msg.textContent = 'Das Foto konnte nicht gelesen werden. Tippe die Nummer ein.'; }
}
async function onBarcode(code){
  stopScan();
  setSheet(`${head('Barcode ' + esc(code))}<div class="busy"><div class="spin"></div><div class="grow"><b>Suche Produkt…</b><br><small class="muted">Open Food Facts Datenbank</small></div></div>`);
  try {
    const p = await lookupBarcode(code);
    if (p && p.hasNutri) { S.product = p; S.portion = null; setSheet(productHTML()); }
    else notFoundSheet(code, p);
  } catch(e) {
    setSheet(`${head('Barcode ' + esc(code))}<p class="ai-note">Die Produktdatenbank ist gerade nicht erreichbar. Prüfe deine Verbindung.</p><div class="sheet-actions"><button class="btn" data-action="scan">Nochmal scannen</button><button class="primary" data-action="bc-retry" data-code="${esc(code)}">Erneut suchen</button></div>`);
  }
}
function notFoundSheet(code, p){
  S.product = p || {code, name:'', brand:'', per100:{}, hasNutri:false};
  setSheet(`${head('Produkt unbekannt')}
  <p style="margin:0">${p?.name ? `<b>${esc(p.name)}</b> ist bekannt, aber ohne Nährwerte.` : `Den Barcode <b>${esc(code)}</b> kennt die Datenbank noch nicht.`} Fotografiere die <b>Nährwerttabelle</b> auf der Packung – TROPHEON merkt sich das Produkt, beim nächsten Scan ist es sofort da.</p>
  <div class="field"><label for="nf-name">Produktname</label><input id="nf-name" value="${esc(p?.name || '')}" placeholder="z. B. Skyr Natur"></div>
  <div id="nf-busy"></div>
  <div class="add-grid">
    <label class="add-opt big" ${S.ai !== 'on' ? 'aria-disabled="true"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><span><b>Nährwerttabelle fotografieren</b><br><small>KI liest die Werte pro 100 g ab</small></span><input type="file" id="nf-file" accept="image/*" capture="environment" hidden></label>
    <button class="add-opt" data-action="nf-manual"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg><b>Werte eintippen</b><small>pro 100 g von der Packung</small></button>
    <button class="add-opt" data-action="scan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7 8v8M10 8v8M13 8v8M16 8v8"/></svg><b>Nochmal scannen</b><small>Anderer Barcode</small></button>
  </div>`);
}
async function readLabel(file){
  if (!file) return; const busy = $('#nf-busy'), name = $('#nf-name')?.value.trim() || '';
  let img; try { img = await prepImage(file); } catch(e) { toast('Das Bild kann nicht geöffnet werden.'); return; }
  busy.innerHTML = busyHTML('Lese die Nährwerttabelle…');
  const keys = NUTS.map(n => n.k).join(', ');
  try {
    const res = await ask(`Auf dem Bild ist die Nährwerttabelle (und evtl. Vorderseite) einer Lebensmittelverpackung.${name ? ` Produkt: "${name}".` : ''} Lies die Werte PRO 100 g (bzw. 100 ml) exakt ab. Fehlende Vitamine/Mineralstoffe mit 0, außer sie stehen auf der Packung. Natrium = Salz ÷ 2,5 (in mg). Antworte NUR mit JSON: {"name":"Produktname","brand":"Marke oder leer","servingGrams":0,"servingLabel":"Portionsangabe von der Packung oder leer","per100":{${NUTS.map(n => `"${n.k}":0`).join(',')}}}\nSchlüssel: ${keys}. ${UNITS.replace('Alle Werte gelten für die geschätzte Menge der jeweiligen Komponente (nicht pro 100 g). ', '')}`, img);
    const per100 = {}; NUTS.forEach(n => per100[n.k] = Math.max(0, num(res?.per100?.[n.k])));
    if (!(per100.kcal > 0) && !(per100.protein + per100.carbs + per100.fat > 0)) throw {code:'invalid_json'};
    const p = {...S.product, name:(name || String(res.name || '') || 'Produkt ' + S.product.code).slice(0, 80), brand:String(res.brand || S.product.brand || '').slice(0, 40),
      per100, serving:num(res.servingGrams) > 0 ? num(res.servingGrams) : null, servingLabel:String(res.servingLabel || '').slice(0, 40), img:S.product.img || img.thumb, hasNutri:true, source:'label'};
    cacheProduct(p); S.product = p; S.portion = null; setSheet(productHTML()); toast('Produkt gespeichert – nächstes Mal sofort da');
  } catch(e) { const m = aiError(e); busy.innerHTML = m ? `<p class="ai-note">${esc(m)}</p>` : ''; }
}
function packG(q){ const m = String(q || '').replace(',', '.').match(/([\d.]+)\s*(kg|g|ml|l)\b/i); if (!m) return 0; const v = parseFloat(m[1]); return /^(kg|l)$/i.test(m[2]) ? v * 1000 : v; }
function portionGrams(){ const v = num($('#pr-g')?.value); return v > 0 ? v : (S.product.serving || 100); }
function productTotals(gr){ const p = S.product.per100, f = gr / 100, o = {}; NUTS.forEach(n => o[n.k] = num(p[n.k]) * f); return o; }
function productHTML(){
  const p = S.product, gr = S.portion || p.serving || 100, t = productTotals(gr);
  const quick = [...(p.serving ? [[p.serving, `1 Portion · ${fmt(p.serving)} g`]] : []), [100, '100 g'], ...(packG(p.qty) > 0 && packG(p.qty) !== 100 && packG(p.qty) !== p.serving ? [[packG(p.qty), `Ganze Packung · ${esc(p.qty)}`]] : [])];
  return `${head('Produkt')}
  <div class="prod">${p.img ? `<img src="${esc(p.img)}" alt="">` : `<span class="thumb">${esc((p.name || '?')[0].toUpperCase())}</span>`}<div><b>${esc(p.name)}</b><small>${esc([p.brand, p.qty].filter(Boolean).join(' · '))}</small><small class="muted">${fmt(p.per100.kcal)} kcal · P ${fmt(p.per100.protein, 1)} · KH ${fmt(p.per100.carbs, 1)} · F ${fmt(p.per100.fat, 1)} pro 100 g</small></div></div>
  ${mealSeg(S.pendingMeal)}
  <div class="field"><span class="flabel">Menge</span><div class="chips">${quick.map(([g, l]) => `<button class="chip ${Math.abs(g - gr) < 0.01 ? 'on' : ''}" data-action="pr-quick" data-g="${g}">${l}</button>`).join('')}</div></div>
  <div class="grid2"><div class="field"><label for="pr-g">Gramm / ml</label><input type="number" id="pr-g" inputmode="decimal" step="any" value="${r1(gr)}"></div>${p.serving ? `<div class="field"><label for="pr-n">Portionen</label><input type="number" id="pr-n" inputmode="decimal" step="0.25" value="${r1(gr / p.serving)}"></div>` : ''}</div>
  <div class="ed-total" id="pr-total">${totalHTML(t)}</div>
  <div class="sheet-actions"><button class="btn" data-action="pr-edit">Anpassen</button><button class="primary" data-action="pr-add">Hinzufügen</button></div>
  <p class="foot">Daten: Open Food Facts (ODbL)${p.source === 'label' ? ' · aus deinem Foto der Nährwerttabelle' : ''}</p>`;
}
function productEntry(){
  const p = S.product, gr = portionGrams(), t = productTotals(gr), it = {name:p.brand && !p.name.includes(p.brand) ? `${p.name} (${p.brand})` : p.name, grams:r1(gr)};
  NUTS.forEach(n => it[n.k] = r1(t[n.k]));
  return {id:uid8(), meal:readMeal(), title:p.name, items:[it], thumb:p.img || null, source:'barcode', code:p.code, confidence:'', note:'', created:Date.now()};
}
function recentMealsHTML(){
  const seen = new Set(), list = [];
  Object.keys(S.days).sort().reverse().forEach(k => (S.days[k]?.entries || []).slice().reverse().forEach(e => { const key = (e.title || '').toLowerCase(); if (key && !seen.has(key) && list.length < 40) { seen.add(key); list.push({e, k}); } }));
  return `${head('Schon gegessen')}${list.length ? `<div class="daylist">${list.map(({e, k}, i) => { const s = sumItems(e.items); return `<button class="dayrow" data-action="reuse" data-k="${k}" data-id="${esc(e.id)}"><span><b>${esc(e.title)}</b><small>${dayLabel(k)} · ${pmHTML(s)}</small></span><span></span><span class="kc num">${fmt(s.kcal)}</span></button>`; }).join('')}</div>` : '<p class="muted">Noch keine Mahlzeiten gespeichert.</p>'}`;
}

const busyHTML = msg => `<div class="busy"><div class="spin"></div><div class="grow"><b>${msg}</b><br><small class="muted">Das dauert meist 5–20 Sekunden.</small></div><button class="btn" data-action="stop">Stopp</button></div>`;
const lock = on => document.querySelectorAll('#sheet-body .sheet-actions button, #sheet-body .fix button, #sheet-body .add-item button').forEach(b => b.disabled = on);

async function onPhoto(file){
  if (!file) return; S.pendingMeal = readMeal();
  let img; try { img = await prepImage(file); } catch(e) { toast('Dieses Bild kann nicht geöffnet werden. Versuch ein JPG oder PNG.'); return; }
  S.draftImg = img;
  setSheet(`${head('Foto prüfen')}<img class="preview" src="data:${img.mime};base64,${img.b64}" alt="Dein Foto"><div class="field"><label for="ph-hint">Hinweis (optional)</label><input id="ph-hint" placeholder="z. B. in Olivenöl gebraten, halbe Portion gegessen"></div><div id="ph-busy"></div><div class="sheet-actions"><button class="btn" data-action="open-add">Anderes Foto</button><button class="primary" data-action="analyze-photo">Analysieren</button></div>`);
}
async function runAnalysis(kind){
  const hint = (kind === 'photo' ? $('#ph-hint') : $('#tx-text'))?.value.trim() || '';
  if (kind === 'text' && !hint) { toast('Beschreib kurz, was du gegessen hast.'); return; }
  const busyEl = kind === 'photo' ? $('#ph-busy') : $('#tx-busy');
  busyEl.innerHTML = busyHTML(kind === 'photo' ? 'Das Orakel betrachtet deinen Teller…' : 'Berechne Nährwerte…'); lock(true);
  const prompt = kind === 'photo'
    ? `${EXPERT} Auf dem Bild ist eine Mahlzeit. Erkenne jede einzelne Komponente (auch Saucen, Öl oder Butter, Beilagen, Getränke) und schätze die Portion in Gramm anhand von Tellergröße, Besteck und typischen Portionen.${hint ? ` Hinweis vom Nutzer: "${hint}".` : ''} Wenn auf dem Bild kein Essen zu sehen ist, antworte nur {"error":"kurze Erklärung auf Deutsch"}. Sonst antworte NUR mit JSON in genau dieser Form: ${SCHEMA}\n${UNITS}`
    : `${EXPERT} Der Nutzer beschreibt seine Mahlzeit so: "${hint}". Zerlege sie in Komponenten, nimm bei fehlenden Mengen übliche Portionsgrößen an. Antworte NUR mit JSON in genau dieser Form: ${SCHEMA}\n${UNITS}`;
  try {
    const res = await ask(prompt, kind === 'photo' ? S.draftImg : null);
    if (res?.error) { busyEl.innerHTML = `<p class="ai-note">${esc(res.error)}</p>`; lock(false); return; }
    const items = normItems(res?.items); if (!items.length) throw {code:'invalid_json'};
    S.draft = {id:uid8(), isNew:true, date:S.date, meal:S.pendingMeal, title:String(res.title || items.map(i => i.name).join(', ')).slice(0,80), items,
      thumb:kind === 'photo' ? S.draftImg?.thumb : null, source:kind, confidence:String(res.confidence || ''), note:String(res.note || '')};
    if (kind !== 'photo') S.draftImg = null;
    setSheet(editorHTML());
  } catch(e) { const m = aiError(e); busyEl.innerHTML = m ? `<p class="ai-note">${esc(m)}</p>` : ''; lock(false); }
}
const totalHTML = t => `<div class="big"><span class="flabel">Gesamt</span><b class="num">${fmt(t.kcal)} <small style="font-size:14px;font-family:var(--f-body)">kcal</small></b></div><div class="mrow"><span style="color:var(--protein)">Protein <b>${fmt(t.protein, 1)} g</b></span><span style="color:var(--carbs)">KH <b>${fmt(t.carbs, 1)} g</b></span><span style="color:var(--fat)">Fett <b>${fmt(t.fat, 1)} g</b></span><span class="muted">Ballaststoffe ${fmt(t.fiber, 1)} g</span></div>`;
function itemHTML(it, i){
  const inp = (k, lab) => `<label>${lab}<input type="number" step="any" inputmode="decimal" id="it-${i}-${k}" data-i="${i}" data-f="${k}" value="${r1(num(it[k]))}"></label>`;
  return `<div class="item"><div class="item-head"><input id="it-${i}-name" data-i="${i}" data-f="name" value="${esc(it.name)}" aria-label="Name der Komponente"><button class="icon-btn" data-action="rm-item" data-i="${i}" aria-label="Komponente entfernen">×</button></div>
  <div class="item-m">${inp('grams','Menge g')}${inp('kcal','kcal')}${inp('protein','P g')}${inp('carbs','KH g')}${inp('fat','F g')}</div>
  <details><summary>Weitere Nährwerte</summary><div class="micro-grid">${NUTS.filter(n => !n.main).map(n => inp(n.k, `${n.l.replace('Gesättigte Fettsäuren','Ges. FS')} ${n.u}`)).join('')}</div></details></div>`;
}
function editorHTML(){
  const d = S.draft, t = sumItems(d.items), ai = S.ai === 'on';
  return `${head(d.isNew ? 'Eintrag prüfen' : 'Eintrag bearbeiten')}
  ${d.confidence || d.note ? `<p class="ai-note">${d.confidence ? `<span class="conf conf-${esc(d.confidence)}">Sicherheit ${esc(d.confidence)}.</span>` : ''}${esc(d.note)}</p>` : ''}
  <div class="ed-top">${d.thumb ? `<img class="ed-thumb" src="${d.thumb}" alt="">` : ''}<div class="field grow"><label for="ed-title">Name</label><input id="ed-title" value="${esc(d.title)}" placeholder="z. B. Griechischer Salat"></div></div>
  <div class="grid2"><div class="field"><label for="ed-meal">Mahlzeit</label><select id="ed-meal">${MEALS.map(m => `<option value="${m.k}" ${m.k === d.meal ? 'selected' : ''}>${m.l}</option>`).join('')}</select></div><div class="field"><label for="ed-date">Tag</label><input type="date" id="ed-date" value="${d.date}" min="${minDate()}" max="${todayKey()}"></div></div>
  <div class="ed-total" id="ed-total">${totalHTML(t)}</div>
  <p class="sub">Komponenten – Menge ändern rechnet alle Werte mit</p>
  <div class="items">${d.items.map(itemHTML).join('') || '<p class="muted" style="margin:0">Noch keine Komponenten. Füge unten eine hinzu.</p>'}</div>
  <div class="add-item">${ai ? `<input id="ed-new" placeholder="Zutat dazu, z. B. 1 EL Olivenöl" aria-label="Zutat hinzufügen"><button class="btn" data-action="est-item">Schätzen</button>` : ''}<button class="btn" data-action="add-blank" ${ai ? '' : 'style="flex:1"'}>+ Leere Zeile</button></div>
  ${ai ? `<div class="fix"><label for="ed-fix">Etwas falsch erkannt?</label><textarea id="ed-fix" rows="2" placeholder="z. B. Das ist Hühnchen, nicht Tofu – ca. 150 g, und ohne Sauce"></textarea><button class="btn" data-action="ai-fix">Mit KI korrigieren</button></div>` : ''}
  <div id="ed-busy"></div>
  <div class="sheet-actions">${!d.isNew ? `<button class="danger" data-action="del-entry">Löschen</button>${d.date !== todayKey() ? '<button class="btn" data-action="copy-today">Heute nochmal</button>' : ''}` : ''}<button class="primary" data-action="save-entry">Speichern</button></div>`;
}
function refreshTotal(){ const el = $('#ed-total'); if (el && S.draft) el.innerHTML = totalHTML(sumItems(S.draft.items)); }
function syncDraftMeta(){ if (!S.draft) return; const t = $('#ed-title'), m = $('#ed-meal'), d = $('#ed-date'); if (t) S.draft.title = t.value; if (m) S.draft.meal = m.value; if (d && d.value) S.draft.date = d.value > todayKey() ? todayKey() : d.value < minDate() ? minDate() : d.value; }
async function editorAI(prompt, img, apply, msg){
  syncDraftMeta(); const b = $('#ed-busy'); b.innerHTML = busyHTML(msg); lock(true);
  try { const res = await ask(prompt, img); apply(res); setSheet(editorHTML()); toast('Aktualisiert'); }
  catch(e) { const m = aiError(e); b.innerHTML = m ? `<p class="ai-note">${esc(m)}</p>` : ''; lock(false); }
}

/* ───────── Aktionen ───────── */
const H = {
  tab: a => { S.view = a.dataset.view; render(); window.scrollTo(0, 0); },
  'prev-day': () => { if (S.date > minDate()) { S.date = addDays(S.date, -1); render(); } },
  'next-day': () => { if (S.date < todayKey()) { S.date = addDays(S.date, 1); render(); } },
  'goto-day': a => { S.date = a.dataset.date; S.view = 'today'; render(); window.scrollTo(0, 0); },
  range: a => { S.range = +a.dataset.n; render(); },
  'open-add': () => { warmScanner(); aiCtl?.abort(); S.draftImg = null; const html = addMenuHTML(); $('#sheet-body') ? setSheet(html) : openSheet(html); },
  'close-sheet': closeSheet,
  scan: () => startScan(),
  'bc-manual': () => { const c = ($('#bc-code')?.value || '').replace(/\D/g, ''); if (!/^\d{8,14}$/.test(c)) { toast('Gib die 8- oder 13-stellige Nummer unter dem Barcode ein.'); return; } onBarcode(c); },
  'bc-retry': a => onBarcode(a.dataset.code),
  'open-product': a => { const p = productCache()[a.dataset.code]; if (!p) return; S.pendingMeal = readMeal(); S.product = p; S.portion = null; cacheProduct(p); setSheet(productHTML()); },
  'pr-quick': a => { S.pendingMeal = readMeal(); S.portion = num(a.dataset.g); setSheet(productHTML()); },
  'pr-add': () => {
    const e = productEntry(), k = S.date, day = S.days[k] || (S.days[k] = {date:k, entries:[]});
    day.entries.push(e); cacheProduct(S.product); closeSheet(); saveDay(k); render(); toast(`${e.title} hinzugefügt · ${fmt(e.items[0].kcal)} kcal`);
  },
  'pr-edit': () => { const e = productEntry(); S.draft = {...e, isNew:true, date:S.date}; setSheet(editorHTML()); },
  'nf-manual': () => {
    const name = $('#nf-name')?.value.trim() || ''; const it = {name:name || 'Produkt'}; NUTS.forEach(n => it[n.k] = 0); it.grams = 100;
    S.draft = {id:uid8(), isNew:true, date:S.date, meal:S.pendingMeal, title:name, items:[it], thumb:S.product?.img || null, source:'barcode', code:S.product?.code};
    setSheet(editorHTML()); toast('Trag die Werte pro 100 g ein und dann die gegessene Menge');
  },
  'recent-meals': () => { S.pendingMeal = readMeal(); setSheet(recentMealsHTML()); },
  reuse: a => {
    const e = (S.days[a.dataset.k]?.entries || []).find(x => x.id === a.dataset.id); if (!e) return;
    S.draft = {...clone(e), id:uid8(), isNew:true, date:S.date, meal:S.pendingMeal, created:Date.now()}; delete S.draft.origDate; setSheet(editorHTML());
  },
  stop: () => aiCtl?.abort(),
  'add-text': () => { S.pendingMeal = readMeal(); setSheet(`${head('Mahlzeit beschreiben')}<div class="field"><label for="tx-text">Was hast du gegessen?</label><textarea id="tx-text" rows="4" placeholder="z. B. Gyros mit Tzatziki und Pommes, dazu ein Cola Zero 0,5 l"></textarea></div><div id="tx-busy"></div><div class="sheet-actions"><button class="btn" data-action="open-add">Zurück</button><button class="primary" data-action="run-text">Nährwerte schätzen</button></div>`); setTimeout(() => $('#tx-text')?.focus(), 50); },
  'run-text': () => runAnalysis('text'),
  'analyze-photo': () => runAnalysis('photo'),
  'add-manual': () => { S.pendingMeal = readMeal(); const it = {name:''}; NUTS.forEach(n => it[n.k] = 0); it.grams = 100; S.draft = {id:uid8(), isNew:true, date:S.date, meal:S.pendingMeal, title:'', items:[it], thumb:null, source:'manual'}; S.draftImg = null; setSheet(editorHTML()); setTimeout(() => $('#ed-title')?.focus(), 50); },
  edit: a => { const e = (S.days[S.date]?.entries || []).find(x => x.id === a.dataset.id); if (!e) return; S.draft = {...clone(e), isNew:false, date:S.date, origDate:S.date}; S.draftImg = null; openSheet(editorHTML()); },
  'rm-item': a => { syncDraftMeta(); S.draft.items.splice(+a.dataset.i, 1); setSheet(editorHTML()); },
  'add-blank': () => { syncDraftMeta(); const it = {name:'Neue Zutat'}; NUTS.forEach(n => it[n.k] = 0); it.grams = 0; S.draft.items.push(it); setSheet(editorHTML()); },
  'est-item': () => {
    const q = $('#ed-new')?.value.trim(); if (!q) { toast('Gib eine Zutat ein, z. B. „1 Banane“.'); return; }
    editorAI(`${EXPERT} Schätze die Nährwerte für: "${q}". Nimm bei fehlender Menge eine übliche Portion an. Antworte NUR mit JSON: {"items":[ein oder mehrere Objekte wie die items in ${SCHEMA}]}\n${UNITS}`, null,
      res => { const its = normItems(res?.items); if (!its.length) throw {code:'invalid_json'}; S.draft.items.push(...its); }, 'Schätze Zutat…');
  },
  'ai-fix': () => {
    const q = $('#ed-fix')?.value.trim(); if (!q) { toast('Schreib kurz, was falsch ist.'); return; }
    syncDraftMeta(); const cur = JSON.stringify({title:S.draft.title, items:S.draft.items});
    editorAI(`${EXPERT} Hier ist eine bestehende Nährwertschätzung einer Mahlzeit:\n${cur}\nDer Nutzer korrigiert: "${q}". Passe die Komponenten entsprechend an (ersetzen, Menge ändern, hinzufügen oder entfernen) und berechne betroffene Nährwerte neu. Unveränderte Komponenten behalten ihre Werte.${S.draftImg ? ' Das Foto der Mahlzeit ist beigefügt.' : ''} Antworte NUR mit JSON in genau dieser Form: ${SCHEMA}\n${UNITS}`, S.draftImg,
      res => { const its = normItems(res?.items); if (!its.length) throw {code:'invalid_json'}; S.draft.items = its; if (res.title) S.draft.title = String(res.title).slice(0,80); if (res.note) S.draft.note = String(res.note); if (res.confidence) S.draft.confidence = String(res.confidence); }, 'Korrigiere…');
  },
  'save-entry': () => {
    syncDraftMeta(); const d = S.draft;
    d.items = d.items.filter(it => String(it.name).trim() || num(it.kcal) > 0);
    if (!d.items.length) { toast('Füge mindestens eine Komponente mit Kalorien hinzu.'); return; }
    d.items.forEach(it => { if (!String(it.name).trim()) it.name = 'Zutat'; NUTS.forEach(n => it[n.k] = r1(num(it[n.k]))); it.grams = r1(num(it.grams)); });
    if (!String(d.title).trim()) d.title = d.items.map(i => i.name).join(', ').slice(0, 80);
    const entry = {id:d.id, meal:d.meal, title:String(d.title).trim(), items:d.items, thumb:d.thumb || null, source:d.source || 'manual', confidence:d.confidence || '', note:d.note || '', created:d.created || Date.now()};
    if (d.code) { entry.code = d.code; const it = d.items[0]; if (d.items.length === 1 && it.grams > 0 && it.kcal > 0) { const per100 = {}; NUTS.forEach(n => per100[n.k] = Math.round(num(it[n.k]) / it.grams * 10000) / 100); const old = productCache()[d.code] || {}; cacheProduct({...old, code:d.code, name:entry.title, brand:old.brand || '', img:old.img || d.thumb || null, per100, serving:old.serving || null, servingLabel:old.servingLabel || '', hasNutri:true, source:old.source || 'manual'}); } }
    const touched = new Set([d.date]);
    if (d.origDate && d.origDate !== d.date) { const od = S.days[d.origDate]; if (od) { od.entries = od.entries.filter(e => e.id !== d.id); touched.add(d.origDate); } }
    const day = S.days[d.date] || (S.days[d.date] = {date:d.date, entries:[]});
    const i = day.entries.findIndex(e => e.id === d.id); if (i >= 0) day.entries[i] = entry; else day.entries.push(entry);
    S.date = d.date; closeSheet(); touched.forEach(saveDay); render(); toast('Gespeichert');
  },
  'del-entry': a => {
    if (!a.classList.contains('armed')) { a.classList.add('armed'); a.textContent = 'Wirklich löschen?'; return; }
    const d = S.draft, k = d.origDate || d.date, day = S.days[k]; if (day) day.entries = day.entries.filter(e => e.id !== d.id);
    closeSheet(); saveDay(k); render(); toast('Gelöscht');
  },
  'copy-today': () => {
    syncDraftMeta(); const t = todayKey(), entry = {...clone(S.draft), id:uid8(), meal:defaultMeal(), created:Date.now()};
    ['isNew','date','origDate'].forEach(x => delete entry[x]);
    const day = S.days[t] || (S.days[t] = {date:t, entries:[]}); day.entries.push(entry);
    S.date = t; closeSheet(); saveDay(t); render(); toast('Zu heute hinzugefügt');
  },
  'save-profile': () => {
    const p = readProfileForm(); if (!p.sex || !p.age || !p.height || !p.weight) { toast('Bitte Körper, Alter, Größe und Gewicht ausfüllen.'); return; }
    p.rate = num($('#p-rate')?.value) || 0.5; p.weightLog = p.weightLog || []; if (!p.weightLog.length) p.weightLog.push({date:todayKey(), kg:p.weight});
    S.profile = p; saveProfile(); S.view = 'today'; render(); window.scrollTo(0, 0); toast('Profil gespeichert');
  },
  'log-weight': () => {
    const kg = num($('#w-new')?.value), date = $('#w-date')?.value || todayKey();
    if (!(kg > 25 && kg < 400)) { toast('Gib ein gültiges Gewicht ein.'); return; }
    if (date > todayKey()) { toast('Das Datum liegt in der Zukunft.'); return; }
    const p = {...readProfileForm()}; p.weightLog = (p.weightLog || []).filter(w => w.date !== date); p.weightLog.push({date, kg});
    applyWeights(p); toast('Gewicht gespeichert');
  },
  'w-edit': a => { const w = (S.profile?.weightLog || []).find(x => x.date === a.dataset.date); if (!w) return; $('#w-date').value = w.date; $('#w-new').value = w.kg; $('#w-new').focus(); },
  'w-del': a => {
    if (!a.classList.contains('armed')) { a.classList.add('armed'); a.textContent = '?'; a.setAttribute('aria-label', 'Wirklich löschen?'); setTimeout(() => { if (a.isConnected) { a.classList.remove('armed'); a.textContent = '×'; } }, 3000); return; }
    const p = {...readProfileForm()}; p.weightLog = (p.weightLog || []).filter(w => w.date !== a.dataset.date); applyWeights(p); toast('Eintrag gelöscht');
  },

  'sign-out': signOutNow,
  'go-login': () => { lsSet(K_MODE, null); showLogin(); },
};

/* ───────── Events ───────── */
let gBase = null; // Ausgangswerte, solange die Menge einer Komponente bearbeitet wird
document.addEventListener('click', e => {
  if (e.target.id === 'scrim') { closeSheet(); return; }
  const a = e.target.closest('[data-action]'); if (!a || a.disabled || a.tagName === 'LABEL') return;
  const f = H[a.dataset.action]; if (f) { if (a.type !== 'radio') e.preventDefault(); f(a, e); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'bc-file') { const f = t.files?.[0]; t.value = ''; scanFile(f); return; }
  if (t.id === 'nf-file') { const f = t.files?.[0]; t.value = ''; readLabel(f); return; }
  if (t.id === 'f-cam' || t.id === 'f-gal') { const f = t.files?.[0]; t.value = ''; onPhoto(f); return; }
  if (t.id === 'dpick' && t.value) { S.date = t.value > todayKey() ? todayKey() : t.value < minDate() ? minDate() : t.value; render(); return; }
  if (t.name === 'p-theme') { const v = t.value; if (v === 'system') { delete document.documentElement.dataset.theme; lsSet(K_THEME, null); } else { document.documentElement.dataset.theme = v; lsSet(K_THEME, v); } return; }
  if (t.closest('#pform')) updateProfileResults();
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.closest('#pform')) { updateProfileResults(); return; }
  if ((t.id === 'pr-g' || t.id === 'pr-n') && S.product) {
    let g = num($('#pr-g').value);
    if (t.id === 'pr-n') { g = num(t.value) * (S.product.serving || 100); $('#pr-g').value = r1(g); }
    else if ($('#pr-n')) $('#pr-n').value = r1(g / (S.product.serving || 100));
    S.portion = g > 0 ? g : null; $('#pr-total').innerHTML = totalHTML(productTotals(g > 0 ? g : 0));
    document.querySelectorAll('#sheet-body .chip[data-g]').forEach(c => c.classList.toggle('on', Math.abs(num(c.dataset.g) - g) < 0.01));
    return;
  }
  if (S.draft && t.dataset.f) {
    const it = S.draft.items[+t.dataset.i]; if (!it) return; const f = t.dataset.f;
    if (f === 'name') { it.name = t.value; return; }
    const v = Math.max(0, num(t.value));
    if (f === 'grams') {
      if (!gBase || gBase.it !== it) gBase = {it, grams:num(it.grams), vals:Object.fromEntries(NUTS.map(n => [n.k, num(it[n.k])]))};
      if (gBase.grams > 0 && v > 0) { const r = v / gBase.grams; NUTS.forEach(n => { it[n.k] = gBase.vals[n.k]*r; const el = document.getElementById(`it-${t.dataset.i}-${n.k}`); if (el) el.value = r1(it[n.k]); }); }
    } else if (gBase?.it === it) gBase = null;
    it[f] = v; refreshTotal();
  }
});
document.addEventListener('focusout', e => { if (e.target.dataset?.f === 'grams') gBase = null; });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#scrim')) closeSheet(); if (e.key === 'Enter' && e.target.id === 'bc-code') { e.preventDefault(); H['bc-manual'](); } });
$('#btn-google').addEventListener('click', () => { $('#login-err').hidden = true; signInGoogle(); });
$('#btn-local').addEventListener('click', () => { lsSet(K_MODE, 'local'); startLocal(); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());

/* ───────── Start ───────── */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
if (!configured) startLocal();
else initFirebase().catch(e => { console.error(e); startLocal(); toast('Firebase konnte nicht geladen werden – Offline-Modus.'); });
