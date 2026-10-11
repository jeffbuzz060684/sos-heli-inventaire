// Générateur d'icônes PNG en pur Node (zlib) — SOS HELI
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
  const u = x => x/S, v = y => y/S;
  const inCirc = (x,y,cx,cy,r) => { const dx=u(x)-cx, dy=v(y)-cy; return dx*dx+dy*dy <= r*r; };
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const U=u(x), V=v(y);
    // rotor principal (barre blanche)
    if(V>=0.20 && V<=0.245 && U>=0.08 && U<=0.92) px(x,y,226,232,240);
    if(U>=0.08 && U<=0.115 && V>=0.17 && V<=0.275) px(x,y,226,232,240);
    if(U>=0.885 && U<=0.92 && V>=0.17 && V<=0.275) px(x,y,226,232,240);
    // mât
    if(U>=0.465 && U<=0.525 && V>=0.245 && V<=0.40) px(x,y,226,232,240);
    // corps orange
    if(inCirc(x,y,0.46,0.57,0.155)) px(x,y,249,115,22);
    // bulle cockpit
    if(inCirc(x,y,0.385,0.545,0.055)) px(x,y,147,197,253);
    // poutail
    if(V>=0.545 && V<=0.60 && U>=0.60 && U<=0.90) px(x,y,249,115,22);
    // empennage
    if(U>=0.855 && U<=0.905 && V>=0.43 && V<=0.545) px(x,y,249,115,22);
    // rotor anticouple
    if(inCirc(x,y,0.915,0.47,0.032)) px(x,y,226,232,240);
    // patins
    if(V>=0.76 && V<=0.785 && U>=0.28 && U<=0.68) px(x,y,226,232,240);
    if(U>=0.345 && U<=0.375 && V>=0.71 && V<=0.76) px(x,y,226,232,240);
    if(U>=0.565 && U<=0.595 && V>=0.71 && V<=0.76) px(x,y,226,232,240);
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
