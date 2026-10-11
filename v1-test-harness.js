// Harnais de tests v1 — SOS HELI Inventaire Unique
// node v1-test-harness.js <index.html> <sw.js>
"use strict";
const fs = require("fs"), vm = require("vm");
const idxPath = process.argv[2] || "index.html";
const swPath = process.argv[3] || "sw.js";
const html = fs.readFileSync(idxPath, "utf8");
const swSrc = fs.readFileSync(swPath, "utf8");
const appJs = html.split("<script>")[1].split("</script>")[0];

// ---------- stubs ----------
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
function makeEl(){
  const el = {
    value: "", innerHTML: "", textContent: "", checked: false, files: null,
    style: {}, listeners: {},
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); },
    setAttribute(){}, focus(){}, select(){}, click(){},
    appendChild(){}, removeChild(){},
    setSelectionRange(){}
  };
  return el;
}
const elMap = {};
global.document = {
  hidden: true,
  getElementById: id => (elMap[id] = elMap[id] || makeEl()),
  createElement: () => makeEl(),
  addEventListener(){},
  body: { appendChild(){}, removeChild(){} }
};
global.window = globalThis;
global.addEventListener = global.addEventListener || function(){};
global.removeEventListener = global.removeEventListener || function(){};
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
global.__badge = -1;
navigator.setAppBadge = n => { global.__badge = n; };
navigator.clearAppBadge = () => { global.__badge = 0; };
let confirmAnswer = true;
global.confirm = () => confirmAnswer;
global.URL.createObjectURL = () => "blob:stub";
global.URL.revokeObjectURL = () => {};
global.__downloads = [];
global.FileReader = function(){
  this.onload = null;
  this.readAsArrayBuffer = (f) => {
    setTimeout(() => {
      Promise.resolve((f && f.arrayBuffer) ? f.arrayBuffer() : f).then(ab => {
        this.result = ab;
        if(this.onload) this.onload({ target: { result: ab } });
      });
    }, 5);
  };
  this.readAsText = (f) => {
    setTimeout(() => {
      this.result = (f && f.text) ? f.text() : String(f);
      if(this.onload) this.onload({ target: { result: this.result } });
    }, 5);
  };
};

// fetch stub pilotable
let reqs = [];
let __remote = null;          // contenu actuel du fichier Drive
let __remoteExists = false;   // le fichier Drive existe-t-il
let __tokenFail = false;
global.fetch = function(url, opts){
  reqs.push({ url: String(url), method: (opts && opts.method) || "GET", body: opts && opts.body });
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if(String(url).indexOf("oauth2.googleapis.com/token") >= 0){
        if(__tokenFail) return resolve({ ok: false, json: () => Promise.resolve({ error: "invalid_grant" }) });
        return resolve({ ok: true, json: () => Promise.resolve({ access_token: "TOK123" }) });
      }
      if(String(url).indexOf("/drive/v3/files?") >= 0 && String(url).indexOf("q=") >= 0){
        const q = decodeURIComponent(String(url).split("q=")[1]);
        if(q.indexOf("google-apps.folder") >= 0) return resolve({ ok: true, json: () => Promise.resolve({ files: [{ id: "FOLD1", name: "taffbmpm" }] }) });
        if(q.indexOf("application/json") >= 0){
          if(__remoteExists) return resolve({ ok: true, json: () => Promise.resolve({ files: [{ id: "FILE1", name: "sos-heli-inventaire.json" }] }) });
          return resolve({ ok: true, json: () => Promise.resolve({ files: [] }) });
        }
        return resolve({ ok: true, json: () => Promise.resolve({ files: [] }) });
      }
      if(String(url).indexOf("alt=media") >= 0){
        return resolve({ ok: true, text: () => Promise.resolve(__remote || "") });
      }
      if(String(url).indexOf("/upload/drive/v3/files") >= 0){
        if(opts && opts.body){
          if(String(url).indexOf("uploadType=multipart") >= 0){
            const mMatch = String(opts.body).match(/Content-Type: application\/json\n\n([\s\S]*?)\n--sosb--$/);
            __remote = mMatch ? mMatch[1] : null;
          } else {
            __remote = String(opts.body);
          }
        }
        __remoteExists = true;
        return resolve({ ok: true, json: () => Promise.resolve({ id: "FILE1" }) });
      }
      resolve({ ok: true, json: () => Promise.resolve({}) });
    }, 5);
  });
};

// ---------- exécution de l'app ----------
vm.runInThisContext(appJs, { filename: "app.js" });
const flush = () => new Promise(r => setTimeout(r, 30));

// interception de download()
const _origDownload = global.download;
global.download = function(name, content, mime){
  global.__downloads.push({ name, content, mime });
};
// réinjecte dans le contexte de l'app (les fonctions de l'app référencent download global)
vm.runInThisContext("download = " + global.download.toString(), { filename: "download-override.js" });

// ---------- asserts ----------
let pass = 0, fail = 0;
function T(name, cond){
  if(cond){ pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name); }
}
function resetConfirm(v){ confirmAnswer = v; }

(async function main(){
  console.log("== A. Boot & seed ==");
  T("A1 115 références chargées", state.items.length === 115);
  var secs = {};
  state.items.forEach(function(it){ secs[it.sec] = (secs[it.sec]||0)+1; });
  T("A2 sections DOCUMENTATION 2", secs["DOCUMENTATION"] === 2);
  T("A3 sections TRANSMISSION 13", secs["TRANSMISSION"] === 13);
  T("A4 sections INCENDIE 100", secs["INCENDIE"] === 100);
  var tr = 0, eg = 0, nv = 0;
  state.items.forEach(function(it){ tr += reelOf(it); eg += ecartOf(it); if(!it.dc) nv++; });
  T("A5 total réel = 1227 (E5 de l'Excel)", tr === 1227);
  T("A6 écart global = +504 (K5 de l'Excel)", eg === 504);
  T("A7 non vérifié = 10 (O5 de l'Excel)", nv === 10);
  var counts = { manque:0, exces:0, conforme:0, nv:0 };
  state.items.forEach(function(it){ counts[statutOf(it)]++; });
  T("A8 statuts : 8 manques", counts.manque === 8);
  T("A9 statuts : 17 excès", counts.exces === 17);
  T("A10 statuts : 80 conformes", counts.conforme === 80);
  T("A11 statuts : 10 non vérifiés", counts.nv === 10);
  T("A12 sous-titre 115 références", elMap["hSub"].textContent.indexOf("115 références") >= 0);
  T("A13 récap contient 1227 / +504 / MAJ 24/08/2026",
    elMap["recap"].innerHTML.indexOf("1227") >= 0 && elMap["recap"].innerHTML.indexOf("+504") >= 0 && elMap["recap"].innerHTML.indexOf("24/08/2026") >= 0);

  console.log("== B. Calcul (formules O=SUM(E:N), P=O-D) ==");
  var atlas = state.items.filter(function(it){ return it.lib === "ATLAS DFCI"; })[0];
  T("B1 ATLAS DFCI trouvé", !!atlas);
  if(atlas){
    T("B2 ATLAS chargé 4, réel 4, écart 0", atlas.d === 4 && reelOf(atlas) === 4 && ecartOf(atlas) === 0);
    T("B3 ATLAS vérifié 2026-09-03 → conforme", atlas.dc === "2026-09-03" && statutOf(atlas) === "conforme");
  }
  var casque = state.items.filter(function(it){ return it.lib === "VDM CASQUE MICRO" && it.sec === "TRANSMISSION"; })[0];
  T("B4 casque micro (TRANSMISSION) trouvé", !!casque);
  if(casque){
    T("B5 casque : chargé 1, réel 9 (GIMAE 7 + S.HELI 1 + BUR 1), écart +8", casque.d === 1 && reelOf(casque) === 9 && ecartOf(casque) === 8);
    T("B6 casque sans date → statut non vérifié (priorité)", statutOf(casque) === "nv" && isAlert(casque));
  }
  var em80 = state.items.filter(function(it){ return it.lib === "VDM EMETTEUR RECEPTEUR PORTATIF 80 MHZ"; })[0];
  T("B7 em-rép 80MHz : chargé 3, réel 4, écart +1 → exces", !!em80 && em80.d === 3 && reelOf(em80) === 4 && ecartOf(em80) === 1 && statutOf(em80) === "exces");
  var chargeur = state.items.filter(function(it){ return it.lib === "VDM CHARGEUR MULTIPLE" && it.nno === "HN 002 1539"; })[0];
  T("B8 chargeur multiple : chargé 1, réel 0, écart −1 → manque", !!chargeur && chargeur.d === 1 && reelOf(chargeur) === 0 && ecartOf(chargeur) === -1 && statutOf(chargeur) === "manque");
  var retenue = state.items.filter(function(it){ return it.lib === "RETENUE"; })[0];
  T("B9 retenue : chargé 1, aucun lieu → réel 0, manque", !!retenue && retenue.d === 1 && reelOf(retenue) === 0 && statutOf(retenue) === "manque");
  var treillis = state.items.filter(function(it){ return it.lib === "TREILLIS GIMAE"; })[0];
  T("B10 treillis GIMAE : chargé 0, S.GIMAE 300 → écart +300", !!treillis && treillis.d === 0 && reelOf(treillis) === 300 && ecartOf(treillis) === 300);
  var a1 = state.items[0];
  T("B11 résumé lieux CMDIH×1 · VRCG×2 · VHR×1", locSummary(a1) === "CMDIH×1 · VRCG×2 · VHR×1");
  T("B12 résumé lieux vide si rien", locSummary(retenue) === "");

  console.log("== C. Filtres & recherche ==");
  setStatFilter("manque");
  T("C1 filtre manques → 8 visibles", visibleItems().length === 8);
  setStatFilter("nv");
  T("C2 filtre non vérifiés → 10 visibles", visibleItems().length === 10);
  setStatFilter("exces");
  T("C3 filtre excès → 17 visibles", visibleItems().length === 17);
  setStatFilter("conforme");
  T("C4 filtre conformes → 80 visibles", visibleItems().length === 80);
  state.cfg.q = "ATLAS"; setStatFilter("all"); state.cfg.q = "ATLAS";
  T("C5 recherche ATLAS → 2 références", visibleItems().length === 2);
  state.cfg.q = "";
  state.cfg.secFilter = "TRANSMISSION";
  T("C6 filtre section TRANSMISSION → 13", visibleItems().length === 13);
  state.cfg.secFilter = "";
  T("C7 retour toutes → 115", visibleItems().length === 115);

  console.log("== D. Vérification en 1 geste + annuler ==");
  var nvAvant = state.items.filter(function(it){ return !it.dc; }).length;
  quickVerif(casque.id);
  T("D1 quickVerif : date contrôle = aujourd'hui", casque.dc === today());
  T("D2 quickVerif : historique +1", casque.hist.length === 1);
  T("D3 journal : entrée verif en tête", state.log[0].act === "verif" && state.log[0].lib === "VDM CASQUE MICRO");
  T("D4 non vérifiés : " + nvAvant + " → " + (nvAvant-1), state.items.filter(function(it){ return !it.dc; }).length === nvAvant - 1);
  T("D5 statut recalculé → exces (+8 vérifié)", statutOf(casque) === "exces");
  undoLast();
  T("D6 annuler : date contrôle restaurée", casque.dc === null);
  T("D7 annuler : historique restauré", casque.hist.length === 0);
  T("D8 annuler journalisée", state.log[0].act === "annulation");

  console.log("== E. Vérification datée depuis la fiche ==");
  openItem(casque.id);
  elMap["ctlDate"].value = "2026-10-05";
  elMap["ctlNote"].value = "comptage camion";
  doVerif();
  T("E1 doVerif : date contrôle 2026-10-05", casque.dc === "2026-10-05");
  T("E2 doVerif : note dans l'historique", casque.hist.length === 1 && casque.hist[0].n === "comptage camion");
  T("E3 journal verif avec note", state.log[0].act === "verif" && state.log[0].n === "comptage camion");
  undoLast();
  T("E4 annuler la vérification datée", casque.dc === null && casque.hist.length === 0);
  closeSheet();

  console.log("== F. Édition fiche (diffs champ par champ) ==");
  openItem(em80.id);
  T("F1 fiche pré-remplie (chargé 3)", String(elMap["fD"].value) === "3");
  elMap["fL9"].value = "7"; // BUREAU 4 → 7
  elMap["fObs"].value = "2 au garage";
  saveItem();
  T("F2 écart recalculé : 3→7 → +4", ecartOf(em80) === 4);
  var lastEdit = state.log[0];
  T("F3 journal edit", lastEdit.act === "edit" && lastEdit.lib === "VDM EMETTEUR RECEPTEUR PORTATIF 80 MHZ");
  var chgF = lastEdit.chg.map(function(c){ return c[0]; });
  T("F4 diffs uniquement BUREAU + Observation (pas de fantôme)",
    chgF.indexOf("BUREAU") >= 0 && chgF.indexOf("Observation") >= 0 && chgF.length === 2);
  var bureaux = lastEdit.chg.filter(function(c){ return c[0] === "BUREAU"; })[0];
  T("F5 diff BUREAU 4 → 7", bureaux[1] === 4 && bureaux[2] === 7);
  // édition sans changement → aucune entrée
  var logLen = state.log.length;
  openItem(em80.id); saveItem();
  T("F6 enregistrement sans modif → pas de nouvelle entrée journal", state.log.length === logLen);
  closeSheet();

  console.log("== G. Ajout / suppression / tombstone ==");
  openItem(null);
  elMap["fSec"].value = "INCENDIE";
  elMap["fNno"].value = "HN 999 9999";
  elMap["fLib"].value = "TEST NOUVELLE REF";
  elMap["fD"].value = "5";
  elMap["fL0"].value = "5";
  saveItem();
  T("G1 ajout → 116 références", state.items.length === 116);
  var nit = state.items[state.items.length-1];
  T("G2 nouvelle référence conforme (+u set)", nit.lib === "TEST NOUVELLE REF" && statutOf(nit) === "nv" && !!nit.u);
  T("G3 journal ajout", state.log[0].act === "ajout" && state.log[0].lib === "TEST NOUVELLE REF");
  openItem(nit.id);
  deleteItem();
  T("G4 suppression → 115", state.items.length === 115);
  T("G5 tombstone posée", !!state.tombs[nit.id]);
  T("G6 journal suppression", state.log[0].act === "suppression");
  undoLast();
  T("G7 annulation suppression → 116 restaurée", state.items.length === 116 && !state.tombs[nit.id]);
  // re-supprimer pour la suite
  openItem(nit.id); resetConfirm(true); deleteItem();
  T("G8 re-suppression propre", state.items.length === 115);

  console.log("== H. Alertes & badge ==");
  var al = alertItems();
  T("H1 alertes = 25 écart≠0 + 10 non vérifiées = 35", al.length === 35);
  var nbM = al.filter(function(i){ return statutOf(i) === "manque"; }).length;
  var nbE = al.filter(function(i){ return statutOf(i) === "exces"; }).length;
  var nbN = al.filter(function(i){ return statutOf(i) === "nv"; }).length;
  T("H2 décomposition 8 manque · 17 excès · 10 nv", nbM === 8 && nbE === 17 && nbN === 10);
  T("H3 badge = 35", global.__badge === 35);
  T("H4 bandeau affiché", elMap["alerts"].innerHTML.indexOf("35 référence(s)") >= 0);
  T("H5 manques triés en premier", statutOf(al[0]) === "manque");

  console.log("== I. Journal ==");
  T("I1 journal non vide", state.log.length > 5);
  var l0 = { t: state.log[0].t, id: state.log[0].id, act: state.log[0].act, chg: state.log[0].chg };
  mergeLogs([state.log[0]]);
  T("I2 mergeLogs dédoublonne", state.log.filter(function(e){ return e.t === l0.t && e.act === l0.act; }).length === 1);
  var bigLog = [];
  for(var i = 0; i < 600; i++) bigLog.push({ t: 1000000 + i, id: "x", act: "edit", chg: [["A", 1, 2]], n: null });
  mergeLogs(bigLog);
  T("I3 plafond 500 entrées", state.log.length === 500);
  global.__downloads.length = 0;
  exportJournalCsv();
  T("I4 export journal CSV téléchargé", global.__downloads.length === 1 && global.__downloads[0].name.indexOf("journal-modifications-inventaire-") === 0);
  T("I5 CSV : BOM + en-tête RÉF NNO / LIBELLÉ", global.__downloads[0].content.charCodeAt(0) === 0xFEFF && global.__downloads[0].content.indexOf("RÉF NNO") >= 0 && global.__downloads[0].content.indexOf("LIBELLÉ") >= 0);

  console.log("== J. Export / import JSON ==");
  global.__downloads.length = 0;
  exportFile();
  T("J1 export JSON téléchargé", global.__downloads.length === 1 && global.__downloads[0].name.indexOf("inventaire-sos-heli-") === 0);
  var parsed = JSON.parse(global.__downloads[0].content);
  T("J2 JSON : app + 115 items", parsed.app === "sos-heli-inventaire" && parsed.items.length === 115);
  var importTxt = global.__downloads[0].content;
  resetConfirm(true);
  importJsonText(importTxt, true);
  T("J3 import round-trip → 115", state.items.length === 115);
  T("J4 secours local écrit", store["sos-heli-inventaire-v1-secours"] !== undefined);
  T("J5 journal import", state.log[0].act === "import");

  console.log("== K. Export CSV inventaire ==");
  global.__downloads.length = 0;
  exportCsv();
  var csv = global.__downloads[0].content;
  T("K1 nom de fichier inventaire-unique", global.__downloads[0].name.indexOf("inventaire-unique-sos-heli-") === 0);
  T("K2 en-têtes Excel exacts (RÉF NNO/MAT, CM IBN LVN, SOUTE GIMAE…)",
    csv.indexOf("RÉF NNO/MAT") >= 0 && csv.indexOf("CM IBN LVN") >= 0 && csv.indexOf("SOUTE GIMAE") >= 0 && csv.indexOf("GRANDE SOUTE") >= 0);
  var csvLines = csv.replace(/\r/g, "").replace(/\uFEFF/g, "").split("\n");
  function csvRow(lib){ return csvLines.filter(function(l){ return l.indexOf('"' + lib + '"') >= 0; })[0]; }
  function fields(line){ return line ? line.split(/";"/).map(function(x){ return x.replace(/^"|"$/g, ""); }) : []; }
  var fA = fields(csvRow("ATLAS DFCI"));
  T("K3 ATLAS DFCI : chargé 4 · CMDIH 1 · VRCG 2 · VHR 1 · 7 lieux vides · réel 4 · écart 0 · date 2026-09-03",
    fA[0] === "DOCUMENTATION" && fA[1] === "HN 005 0007" && fA[3] === "4" && fA[4] === "1" && fA[5] === "2" && fA[6] === "1"
    && fA[7] === "" && fA[8] === "" && fA[9] === "" && fA[10] === "" && fA[11] === "" && fA[12] === "" && fA[13] === ""
    && fA[14] === "4" && fA[15] === "0" && fA[16] === "2026-09-03");
  var fT = fields(csvRow("TREILLIS GIMAE"));
  T("K4 TREILLIS GIMAE : chargé 0 · S.GIMAE 300 · réel 300 · écart 300 · jamais vérifié",
    fT[0] === "INCENDIE" && fT[1] === "NEANT" && fT[3] === "0" && fT[12] === "300" && fT[14] === "300" && fT[15] === "300" && fT[16] === "");

  console.log("== L. Sauvegarde Drive ==");
  state.cfg.dCid = "CID"; state.cfg.dRefresh = "RTOK"; state.cfg.driveAuto = true;
  reqs = [];
  await driveSend(true); await flush();
  T("L1 envoi Drive : token demandé", reqs.some(function(r){ return r.url.indexOf("oauth2.googleapis.com/token") >= 0; }));
  T("L2 fichier Drive sos-heli-inventaire.json cherché", reqs.some(function(r){ return r.url.indexOf("q=") >= 0 && decodeURIComponent(r.url.split("q=")[1]).indexOf("sos-heli-inventaire.json") >= 0; }));
  T("L3 upload multipart effectué", reqs.some(function(r){ return r.url.indexOf("uploadType=multipart") >= 0; }));
  var remoteJ = JSON.parse(__remote);
  T("L4 contenu Drive : app + 115 items", remoteJ.app === "sos-heli-inventaire" && remoteJ.items.length === 115);
  T("L5 driveSyncedAt + pill à jour", state.driveSyncedAt > 0 && elMap["drivePill"].textContent.indexOf("à jour") >= 0);
  // modification locale puis nouvel envoi → pull-before-push puis PATCH
  var em80L = state.items.filter(function(it){ return it.lib === "VDM EMETTEUR RECEPTEUR PORTATIF 80 MHZ"; })[0];
  em80L.loc[9] = 9; save();
  await driveSend(true); await flush();
  T("L6 2e envoi : téléchargement pull (alt=media)", reqs.some(function(r){ return r.url.indexOf("alt=media") >= 0; }));
  T("L7 2e envoi : PATCH update", reqs.some(function(r){ return r.url.indexOf("uploadType=media") >= 0 && r.method === "PATCH"; }));
  var remoteJ2 = JSON.parse(__remote);
  var em80r = remoteJ2.items.filter(function(it){ return it.lib === "VDM EMETTEUR RECEPTEUR PORTATIF 80 MHZ"; })[0];
  T("L8 la modif BUREAU 9 est partie sur Drive", em80r && em80r.loc[9] === 9);
  // fusion : une modif distante plus récente gagne
  var remoteMod = JSON.parse(__remote);
  var atlasR = remoteMod.items.filter(function(it){ return it.lib === "ATLAS DFCI"; })[0];
  atlasR.loc[0] = 12; atlasR.u = Date.now() + 60000;
  __remote = JSON.stringify(remoteMod);
  var m = mergeRemote(remoteMod);
  var atlasL = state.items.filter(function(it){ return it.lib === "ATLAS DFCI"; })[0];
  T("L9 fusion distante : ATLAS CMDIH → 12", atlasL.loc[0] === 12 && m.changed === 1);
  // tombstone distante supprime localement
  var remoteTombs = JSON.parse(__remote);
  var cible = remoteTombs.items.filter(function(it){ return it.lib === "RETENUE"; })[0];
  remoteTombs.tombs = remoteTombs.tombs || {};
  remoteTombs.tombs[cible.id] = Date.now() + 60000;
  var nAvant = state.items.length;
  var m2 = mergeRemote(remoteTombs);
  T("L10 tombstone distante : RETENUE supprimée localement", state.items.length === nAvant - 1 && m2.removed === 1);

  console.log("== M. Verrous de version ==");
  T("M1 APP_VERSION v1", APP_VERSION === "v1");
  T("M2 SW_CACHE sos-heli-inventaire-v1", SW_CACHE === "sos-heli-inventaire-v1");
  T("M3 clé storage sos-heli-inventaire-v1", KEY === "sos-heli-inventaire-v1");
  T("M4 sw.js : cache v1", swSrc.indexOf('CACHE = "sos-heli-inventaire-v1"') >= 0);
  T("M5 manifest : Inventaire Unique", html.indexOf("SOS HELI — Inventaire Unique") >= 0);
  T("M6 seed inline : ATLAS DFCI + TREILLIS GIMAE dans index.html", html.indexOf("ATLAS DFCI") >= 0 && html.indexOf("TREILLIS GIMAE") >= 0);
  T("M7 LOCS = 10 lieux", LOCS.length === 10 && LOCS[9].k === "BUREAU");

  console.log("== N. Config Drive ==");
  document.getElementById("dCid").value = "CID2"; document.getElementById("dSecret").value = ""; document.getElementById("dRefresh").value = "RTOK2"; document.getElementById("dFolder").value = "taffbmpm";
  saveDriveCfg();
  T("N1 config sauvegardée", state.cfg.dCid === "CID2" && state.cfg.dRefresh === "RTOK2");
  driveDisconnect();
  T("N2 déconnexion", state.cfg.dCid === "" && state.cfg.dRefresh === "");
  T("N3 pill repasse local", elMap["drivePill"].textContent.indexOf("local") >= 0);

  console.log("");
  console.log("RÉSULTAT : " + pass + " tests OK, " + fail + " échec(s)");
  if(fail) process.exit(1);
})().catch(e => { console.error("CRASH:", e); process.exit(2); });
