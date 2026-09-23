import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'vite';
import { JSDOM } from 'jsdom';

test('title/content editor protects drafts and preview remains literal', async () => {
  const compiled = await build({ configFile:false, logLevel:'silent', build:{ write:false, minify:false, lib:{ entry:'src/main.mjs', formats:['iife'], name:'LinksawTest' } } });
  const output = Array.isArray(compiled) ? compiled[0] : compiled;
  const code = output.output.find(item => item.type === 'chunk').code;
  const dom = new JSDOM(readFileSync('index.html','utf8'), { url:'http://localhost', runScripts:'outside-only', pretendToBeVisual:true });
  const w=dom.window,d=w.document;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  const snippet={id:'test-id',title:'Example',body:'<b>literal preview</b>',details:[]};
  let failSave=true,writes=0,copied='',detailDeletes=0;
  Object.defineProperty(w.navigator,'clipboard',{value:{readText:async()=>'',writeText:async text=>{copied=text;}}});
  w.sessionStorage.setItem('linksaw-demo-token','test-only-token');
  w.fetch=async(url,options={})=>{const path=new URL(url).pathname;
    if(path==='/details'&&options.method==='DELETE'){detailDeletes++;return{ok:true,status:200,json:async()=>({ok:true})};}
    if(options.method==='PUT'){writes++;return{ok:!failSave,status:failSave?500:200,json:async()=>failSave?{error:'Simulated failure'}:{ok:true}};}
    return{ok:true,status:200,json:async()=>path==='/me'?{user:{email:'test@example.com'}}:{snippets:[snippet]}};};
  const flush=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
  const key=(target,value,extras={})=>target.dispatchEvent(new w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...extras}));
  try{
    w.eval(code);await flush();assert.equal(detailDeletes,1,'legacy details are cleared after authentication');
    assert.equal(d.querySelector('[id*=detail]'),null,'details UI is absent');
    const search=d.getElementById('search');key(search,'ArrowRight');
    const preview=d.getElementById('snippet-preview');assert.equal(preview.open,true);
    assert.equal(d.getElementById('preview-body').textContent,snippet.body);assert.equal(d.querySelector('#preview-body b'),null);
    d.getElementById('preview-copy').click();await flush();assert.equal(copied,snippet.body);
    d.getElementById('preview-edit').click();const editor=d.getElementById('editor-dialog');
    d.getElementById('snippet-body').value='Changed draft';d.getElementById('cancel-editor').click();
    assert.equal(d.getElementById('unsaved-confirmation').hidden,false);d.querySelector('[data-keep]').click();
    key(editor,'s',{ctrlKey:true});await flush();assert.equal(editor.open,true);assert.match(d.getElementById('editor-feedback').textContent,/Simulated failure/);
    failSave=false;key(editor,'s',{metaKey:true});await flush();assert.equal(editor.open,false);assert.equal(writes,2);
    d.querySelector('.result-edit').click();d.getElementById('snippet-body').value='Another change';editor.dispatchEvent(new w.Event('cancel',{cancelable:true}));
    d.querySelector('[data-discard]').click();assert.equal(editor.open,false);assert.equal(writes,2);
  }finally{await new Promise(resolve=>setTimeout(resolve,100));dom.window.close();}
});
