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


  console.log("== L-x. Export Excel (.xlsx) — feuille identique à l'original ==");
  let xCap = null;
  const xDl = global.download;
  global.download = (name, content) => { xCap = { name, content }; };
  exportXlsx();
  const xb = xCap.content;
  T("xlsx : signature ZIP (PK)", xb && xb.length > 4 && xb[0] === 0x50 && xb[1] === 0x4B && xb[2] === 0x03 && xb[3] === 0x04);
  T("xlsx : nom de fichier INVENTAIRE UNIQUE-AAAA-MM-JJ.xlsx", xCap.name === "INVENTAIRE UNIQUE-" + today() + ".xlsx");
  const zlib = require("zlib");
  function unzipN(u8){
    const files = {};
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for(let i = u8.length - 22; i >= 0; i--){ if(dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; } }
    if(eocd < 0) throw new Error("EOCD introuvable");
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    for(let k = 0; k < count; k++){
      const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
      const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = Buffer.from(u8.subarray(off + 46, off + 46 + nlen)).toString("utf8");
      const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
      let data = u8.subarray(lho + 30 + lnlen + lelen, lho + 30 + lnlen + lelen + csize);
      if(method === 8) data = zlib.inflateRawSync(Buffer.from(data));
      else if(method !== 0) throw new Error("méthode " + method);
      files[name] = Buffer.from(data);
      off += 46 + nlen + elen + clen;
    }
    return files;
  }
  const xf = unzipN(new Uint8Array(xb));
  T("xlsx : 8 fichiers du package OOXML", Object.keys(xf).length === 8 && !!xf["[Content_Types].xml"] && !!xf["xl/worksheets/sheet1.xml"] && !!xf["xl/styles.xml"] && !!xf["docProps/core.xml"]);
  const wbx = xf["xl/workbook.xml"].toString("utf8");
  const sx = xf["xl/worksheets/sheet1.xml"].toString("utf8");
  const stx = xf["xl/styles.xml"].toString("utf8");
  T("xlsx : feuille « INVENTAIRE UNIQUE »", wbx.includes('name="INVENTAIRE UNIQUE"'));
  T("xlsx : recalcul forcé à l'ouverture (formules vivantes)", wbx.includes('fullCalcOnLoad="1"'));
  const nX = state.items.length;
  const sReel = state.items.reduce((a, it) => a + reelOf(it), 0);
  const sEcart = state.items.reduce((a, it) => a + ecartOf(it), 0);
  const sNv = state.items.filter(it => !it.dc).length;
  const LROW = Math.max(299, 8 + nX + 1);
  T("xlsx : titre + sous-titre d'origine (lignes 1-2)", sx.includes("INVENTAIRE UNIQUE — SOS HÉLIPORTE") && sx.includes("RÉCAPITULATION GESTIONNAIRE — DOCUMENTATION • TRANSMISSION • INCENDIE"));
  T("xlsx : compteurs ligne 5 avec formules vivantes d'origine", sx.includes("<f>COUNTA(B8:B" + LROW + ")</f>") && sx.includes("<f>SUM(O8:O" + LROW + ")</f>") && sx.includes("<f>SUM(P8:P" + LROW + ")</f>") && sx.includes('COUNTIFS(B8:B' + LROW + ',&quot;&lt;&gt;&quot;,Q8:Q' + LROW + ',&quot;&quot;)'));
  T("xlsx : compteurs en cache = état courant (" + nX + " réf)", sx.includes("<f>COUNTA(B8:B" + LROW + ")</f><v>" + nX + "</v>") && sx.includes("<f>SUM(O8:O" + LROW + ")</f><v>" + sReel + "</v>") && sx.includes("<f>SUM(P8:P" + LROW + ")</f><v>" + sEcart + "</v>"));
  T("xlsx : non vérifiés en cache", sx.includes(',&quot;&lt;&gt;&quot;,Q8:Q' + LROW + ',&quot;&quot;)</f><v>' + sNv + "</v>"));
  const td = today();
  T("xlsx : MAJ du jour en Q5 (comme l'original, date en texte)", sx.includes("<c r=\"Q5\" s=\"7\" t=\"inlineStr\"><is><t>" + td.slice(8,10) + "/" + td.slice(5,7) + "/" + td.slice(0,4) + "</t>"));
  T("xlsx : 18 en-têtes ligne 7 identiques à l'original", sx.includes("RÉFÉRENCE NNO/MAT") && sx.includes("LIBELLÉ") && sx.includes("TOTAL CHARGÉ") && sx.includes("CMDIH") && sx.includes("VRCG") && sx.includes("VHR") && sx.includes("VL 75") && sx.includes("CM IBN LVN") && sx.includes("CM IBN GIMAE") && sx.includes("GRANDE SOUTE") && sx.includes("SOUTE HELI") && sx.includes("SOUTE GIMAE") && sx.includes("BUREAU") && sx.includes("ÉCART") && sx.includes("DATE CONTRÔLE") && sx.includes("OBSERVATION"));
  const it0 = state.items[0];
  T("xlsx : 1re référence ligne 8 (A-D : section, NNO, libellé, total chargé)", sx.includes('r="A8" s="' + ({DOCUMENTATION:18, TRANSMISSION:19, INCENDIE:20}[it0.sec] || 21) + '" t="inlineStr"><is><t>' + it0.sec + "</t>") && sx.includes('r="B8" s="22" t="inlineStr"><is><t>' + it0.nno + "</t>") && sx.includes('r="C8" s="22" t="inlineStr"><is><t>' + it0.lib + "</t>") && sx.includes('r="D8" s="23"><v>' + it0.d + "</v>"));
  T("xlsx : formules vivantes O8=SUM(E8:N8) et P8=O8-D8 comme l'original", sx.includes("<c r=\"O8\" s=\"27\"><f>SUM(E8:N8)</f><v>" + reelOf(it0) + "</v></c>") && sx.includes("<c r=\"P8\" s=\"25\"><f>O8-D8</f><v>" + ecartOf(it0) + "</v></c>"));
  T("xlsx : date de contrôle en série Excel (Q8)", it0.dc ? sx.includes('<c r="Q8" s="28"><v>' + isoToSerial(it0.dc) + "</v></c>") : sx.includes('<c r="Q8" s="28"/>'));
  const ti = state.items.findIndex(it => it.lib === "TREILLIS GIMAE");
  if(ti >= 0){
    const rT = 8 + ti;
    T("xlsx : TREILLIS GIMAE — SOUTE GIMAE 300, O et P vivants", sx.includes('<c r="M' + rT + '" s="25"><v>300</v></c>') && sx.includes("<c r=\"O" + rT + '" s="27"><f>SUM(E' + rT + ":N" + rT + ")</f><v>300</v></c>") && sx.includes("<c r=\"P" + rT + '" s="25"><f>O' + rT + "-D" + rT + "</f><v>300</v></c>"));
  } else T("xlsx : TREILLIS GIMAE absent — ignoré", true);
  const neg = state.items.findIndex(it => ecartOf(it) < 0);
  if(neg >= 0){
    const rN = 8 + neg;
    T("xlsx : écart négatif en cache (P" + rN + ")", sx.includes("<c r=\"P" + rN + '" s="25"><f>O' + rN + "-D" + rN + "</f><v>" + ecartOf(state.items[neg]) + "</v></c>"));
  } else T("xlsx : aucun écart négatif — ignoré", true);
  T("xlsx : " + LROW + " lignes (en-têtes + données + lignes bordées jusqu'à 299)", (sx.match(/<row r=/g) || []).length === LROW);
  T("xlsx : lignes de données toutes à hauteur 14.25 comme l'original", (sx.match(/ht="14.25"/g) || []).length === LROW - 7);
  T("xlsx : formule O sur ligne vide étendue (ligne " + LROW + ")", sx.includes("<f>SUM(E" + LROW + ":N" + LROW + ")</f><v>0</v>"));
  T("xlsx : 10 fusions d'origine", sx.includes('<mergeCells count="10">') && sx.includes('<mergeCell ref="A1:Q1"/>') && sx.includes('<mergeCell ref="A4:C4"/>') && sx.includes('<mergeCell ref="K4:N4"/>') && sx.includes('<mergeCell ref="O4:P4"/>') && sx.includes('<mergeCell ref="E5:G5"/>'));
  T("xlsx : volet figé sous la ligne 7", sx.includes('<pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/>'));
  T("xlsx : quadrillage masqué + filtre A7:Q" + LROW + " comme l'original", sx.includes('showGridLines="0"') && sx.includes('<autoFilter ref="A7:Q' + LROW + '"/>'));
  T("xlsx : largeurs de colonnes d'origine (A 17.28, B 22, C 49.85)", sx.includes('width="17.28515625"') && sx.includes('width="22"') && sx.includes('width="49.85546875"') && sx.includes('width="32.42578125"'));
  T("xlsx : colonnes Cle tri / Rang masquées comme l'original", sx.includes('<col min="19" max="20" width="13" hidden="1" customWidth="1"/>') && sx.includes("Cle tri") && sx.includes("Rang"));
  T("xlsx : formules Cle tri et Rang reconstituées (S8/T8)", sx.includes('TEXT(ROW(),&quot;0000&quot;)') && sx.includes("SUMPRODUCT(($S$8:$S$" + LROW + "&lt;&gt;&quot;&quot;)*($S$8:$S$" + LROW + "&lt;=$S8))"));
  T("xlsx : mise en forme conditionnelle sections (3 couleurs d'origine)", sx.includes('<formula>$A8="DOCUMENTATION"</formula>') && sx.includes('<formula>$A8="TRANSMISSION"</formula>') && sx.includes('<formula>$A8="INCENDIE"</formula>'));
  T("xlsx : mise en forme conditionnelle écart (vert &gt;0, rouge &lt;0)", sx.includes('<cfRule type="cellIs" dxfId="0" priority="1" operator="greaterThan"><formula>0</formula>') && sx.includes('<cfRule type="cellIs" dxfId="1" priority="2" operator="lessThan"><formula>0</formula>'));
  T("xlsx : validations d'origine (date Q + liste sections A)", sx.includes("DATE(2000,1,1)") && sx.includes('"DOCUMENTATION,TRANSMISSION,INCENDIE"') && sx.includes("Section invalide"));
  T("xlsx : styles d'origine (Aptos Display 20, bleu nuit, soutes)", stx.includes('<name val="Aptos Display"/>') && stx.includes('rgb="FF17365D"') && stx.includes('rgb="FFE2F0D9"') && stx.includes('rgb="FFD9EAF7"') && stx.includes('rgb="FF92D050"') && stx.includes('rgb="FFFF0000"'));
  T("xlsx : 30 styles de cellules du classeur exporté", stx.includes('<cellXfs count="30">'));
  T("xlsx : pied de page impression d'origine", sx.includes("Inventaire SOS Héliporte — &amp;P / &amp;N"));
  global.download = xDl;


  console.log("== M. Verrous de version ==");
  T("M1 APP_VERSION v1.2", APP_VERSION === "v1.2");
  T("M2 SW_CACHE sos-heli-inventaire-v1.2", SW_CACHE === "sos-heli-inventaire-v1.2");
  T("M3 clé storage sos-heli-inventaire-v1", KEY === "sos-heli-inventaire-v1");
  T("M4 sw.js : cache v1.2", swSrc.indexOf('CACHE = "sos-heli-inventaire-v1.2"') >= 0);
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
