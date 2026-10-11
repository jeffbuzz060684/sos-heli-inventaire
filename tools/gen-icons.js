// Générateur d'icônes PNG en pur Node (zlib) — SOS HELI Inventaire
// Logo : planche d'inventaire (clipboard) avec cases cochées — distinct de l'hélico des autres apps
"use strict";
const zlib = require("zlib"), fs = require("fs");

function crc32(buf){
  let t = crc32.t;
  if(!t){
    t = crc32.t = new Int32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n]=c;
    }
  }
  let c=-1;
  for(let i=0;i<buf.length;i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, file){
  const S = size;
  const px = (x, y, r, g, b, a) => { const i = (y*S + x)*4; d[i]=r; d[i+1]=g; d[i+2]=b; d[i+3]=a===undefined?255:a; };
  const d = Buffer.alloc(S*S*4);
  // fond bleu nuit
  for(let y=0;y<S;y++) for(let x=0;x<S;x++) px(x,y,15,23,42);
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const U=x/S, V=y/S;
    // clip métallique en haut (au-dessus de la planchette)
    if(U>=0.40 && U<=0.60 && V>=0.05 && V<=0.17) px(x,y,148,163,184);
    if(U>=0.435 && U<=0.565 && V>=0.075 && V<=0.13) px(x,y,15,23,42); // trou du clip
    // planchette orange (corps du clipboard)
    if(U>=0.20 && U<=0.80 && V>=0.13 && V<=0.90) px(x,y,249,115,22);
    // feuille de papier
    if(U>=0.27 && U<=0.73 && V>=0.24 && V<=0.86) px(x,y,226,232,240);
    // 3 lignes de checklist : case cochée verte + ligne de texte
    for(let i=0;i<3;i++){
      const y0 = 0.32 + i*0.18;
      if(U>=0.315 && U<=0.415 && V>=y0 && V<=y0+0.095) px(x,y,34,197,94);
      if(U>=0.46 && U<=0.68 && V>=y0+0.025 && V<=y0+0.06) px(x,y,100,116,139);
    }
  }
  // scanlines
  const raw = Buffer.alloc(S*(S*4+1));
  for(let y=0;y<S;y++){
    raw[y*(S*4+1)] = 0;
    d.copy(raw, y*(S*4+1)+1, y*S*4, (y+1)*S*4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S,0); ihdr.writeUInt32BE(S,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const out = Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, {level:9})),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, out);
  console.log(file, out.length, "octets");
}
png(192, "icon-192.png");
png(512, "icon-512.png");
