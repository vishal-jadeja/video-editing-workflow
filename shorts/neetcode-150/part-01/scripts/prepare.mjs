import {mkdir, writeFile, copyFile, access, readFile} from 'node:fs/promises';
for (const d of ['assets/sfx','public/fonts','public/audio','src/generated','out/qa','.cache']) await mkdir(d,{recursive:true});
await writeFile('src/generated/episode.json',await readFile(process.env.PART_DATA||'data/part-01.json'));
// Fetch Google Fonts once; render from local files for deterministic offline exports.
for (const [family,file] of [['Inter:wght@400;700;900','inter'],['JetBrains+Mono:wght@400;600','jetbrains']]) {
  try {
    const cached=await readFile(`public/fonts/${file}.css`,'utf8');
    const files=[...cached.matchAll(/url\(\.\/([^)]+)\)/g)].map(m=>m[1]);
    if(files.length){
      await Promise.all(files.map(name=>access(`public/fonts/${name}`)));
      console.log('Cached font:',file);
      continue;
    }
  }catch{}
  const response=await fetch(`https://fonts.googleapis.com/css2?family=${family}&display=swap`,{headers:{'User-Agent':'Mozilla/5.0'}});
  if(!response.ok)throw Error(`Font stylesheet ${file}: HTTP ${response.status}`);
  const css = await response.text();
  const urls=[...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m=>m[1]))];
  if(!urls.length)throw Error(`No font files found for ${file}`);
  let local=css;
  for (let i=0;i<urls.length;i++) {
    const name=`${file}-${i}.woff2`;
    const font=await fetch(urls[i]);
    if(!font.ok)throw Error(`Font file ${name}: HTTP ${font.status}`);
    await writeFile(`public/fonts/${name}`,Buffer.from(await font.arrayBuffer()));
    local=local.replaceAll(urls[i],`./${name}`);
  }
  await writeFile(`public/fonts/${file}.css`,local);
}
let avatar=false;
for (const candidate of ['assets/avatar.png','../../assets/avatar.png']) {
  try {await access(candidate); await copyFile(candidate,'public/avatar.png'); avatar=true; break;} catch {}
}
await writeFile('src/generated/assets.json',JSON.stringify({avatar}));
// Cover is independently renderable before narration exists.
try {await access('src/generated/timeline.json');} catch {
  await writeFile('src/generated/timeline.json',JSON.stringify({ready:false,provider:null,duration:1,scenes:[]}));
}
console.log('Google Fonts cached. Avatar:',avatar?'loaded':'placeholder');
