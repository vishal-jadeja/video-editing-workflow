import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,rename,readdir,stat,rm} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
export async function exists(file:string){try{await stat(file);return true;}catch{return false;}}
export async function json<T=unknown>(file:string):Promise<T>{return JSON.parse(await readFile(file,'utf8'));}
export async function atomic(file:string,value:unknown){await mkdir(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;await writeFile(tmp,JSON.stringify(value,null,2)+'\n');await rename(tmp,file);}
export const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function fileHash(file:string){const h=createHash('sha256');for await(const data of createReadStream(file))h.update(data);return h.digest('hex');}
export async function treeHash(root:string):Promise<string>{const entries=await readdir(root,{withFileTypes:true});const parts=await Promise.all(entries.sort((a,b)=>a.name.localeCompare(b.name)).filter(e=>!e.name.startsWith('.')&&e.name!=='__pycache__').map(async e=>[e.name,e.isDirectory()?await treeHash(path.join(root,e.name)):await fileHash(path.join(root,e.name))]));return hash(parts);}
export async function engineHash(){return hash(await Promise.all(['src','schemas','pipeline','public/fonts'].map(treeHash)).then(async h=>[...h,await fileHash('package-lock.json')]));}
export async function run(command:string,args:string[],options:{capture?:boolean}={}){return new Promise<string>((resolve,reject)=>{const proc=spawn(command,args,{stdio:options.capture?['ignore','pipe','pipe']:'inherit'});let out='',err='';proc.stdout?.on('data',d=>out+=d);proc.stderr?.on('data',d=>err+=d);proc.on('error',reject);proc.on('close',code=>code===0?resolve(out):reject(new Error(`${command} exited ${code}\n${err.slice(-6000)}`)));});}
export async function cached(project:string,stage:string,key:unknown,outputs:string[],work:()=>Promise<void>,preserveEdits=false){
 const cache=path.join(project,'.cache',`${stage}.json`),digest=hash(key);
 if(await exists(cache)){const saved=await json<{key:string;outputs?:string[]}>(cache);if(saved.key===digest&&(await Promise.all(outputs.map(exists))).every(Boolean)){
  const current=await Promise.all(outputs.map(fileHash));if(preserveEdits||hash(saved.outputs)===hash(current)){console.log(`${stage}: cached`);return;}
 }}await work();await atomic(cache,{key:digest,outputs:await Promise.all(outputs.map(fileHash))});
}
export async function lock<T>(project:string,fn:()=>Promise<T>):Promise<T>{const dir=path.join(project,'.cache','lock');await mkdir(path.dirname(dir),{recursive:true});try{await mkdir(dir);}catch{throw new Error(`Project is busy (${dir}); remove the lock only after confirming its process has stopped.`);}try{return await fn();}finally{await rm(dir,{recursive:true,force:true});}}
export async function python(){return await exists('.venv/bin/python')?path.resolve('.venv/bin/python'):'python3';}
