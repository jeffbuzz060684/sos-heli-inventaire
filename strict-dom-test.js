// Boot réel avec DOM STRICT — SOS HELI Inventaire Unique
// node strict-dom-test.js <index.html>
// getElementById renvoie null si l'id n'existe ni dans le HTML ni dans les innerHTML générés
"use strict";
const fs = require("fs"), vm = require("vm");
const idxPath = process.argv[2] || "index.html";
const html = fs.readFileSync(idxPath, "utf8");
const appJs = html.split("<script>")[1].split("</script>")[0];

// ids présents dans le fichier (statique + chaînes innerHTML du JS)
const ids = new Set();
for(const m of html.matchAll(/id="([^"]*)"/g)) ids.add(m[1]);
for(const m of html.matchAll(/id=\\?"([^\\"]*)/g)) ids.add(m[1]);
["errBar"].forEach(x => ids.add(x));
for(let i = 0; i < 10; i++) ids.add("fL" + i); // grille des 10 lieux générée dynamiquement
console.log("ids connus :", ids.size);

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
    appendChild(){}, removeChild(){}, setSelectionRange(){}
  };
  return el;
}
const elMap = {};
let missingHits = [];
global.document = {
  hidden: true,
  getElementById(id){
    if(!ids.has(id)){ missingHits.push(id); return null; } // DOM strict : null si inconnu
    return (elMap[id] = elMap[id] || makeEl());
  },
  createElement: () => makeEl(),
  addEventListener(){},
  body: { appendChild(){}, removeChild(){} }
};
global.window = globalThis;
global.addEventListener = global.addEventListener || function(){};
global.removeEventListener = global.removeEventListener || function(){};
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
navigator.setAppBadge = () => {};
navigator.clearAppBadge = () => {};
global.confirm = () => true;
global.URL.createObjectURL = () => "blob:stub";
global.URL.revokeObjectURL = () => {};

let crashed = null;
try{
  vm.runInThisContext(appJs, { filename: "app.js" });
}catch(e){ crashed = e; }

if(crashed){
  console.error("❌ CRASH au boot :", crashed.stack ? crashed.stack.split("\n").slice(0, 4).join("\n") : crashed);
  process.exit(1);
}
if(missingHits.length){
  console.error("❌ ids demandés mais absents du DOM :", JSON.stringify(missingHits));
  process.exit(1);
}
// interactions de base après boot : ouvrir une fiche, filtrer, journal
try{
  const first = global.state.items[0];
  global.openItem(first.id);
  global.setStatFilter("manque");
  global.setStatFilter("all");
  global.openJournal();
  global.closeJournal();
  global.exportCsv();
}catch(e){
  console.error("❌ CRASH interaction :", e.stack ? e.stack.split("\n").slice(0, 4).join("\n") : e);
  process.exit(1);
}
if(missingHits.length){
  console.error("❌ ids demandés mais absents du DOM :", JSON.stringify(missingHits));
  process.exit(1);
}
console.log("✅ Boot DOM strict : aucun crash, aucun id manquant (" + global.state.items.length + " références)");
