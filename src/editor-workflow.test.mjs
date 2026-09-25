import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'vite';
import { JSDOM } from 'jsdom';

test('content editor preserves private names, protects drafts and previews literally', async () => {
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
    if(options.method==='PUT'){writes++;if(!failSave)Object.assign(snippet,JSON.parse(options.body));return{ok:!failSave,status:failSave?500:200,json:async()=>failSave?{error:'Simulated failure'}:{ok:true}};}
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
    d.getElementById('preview-edit').click();
    assert.equal(d.getElementById('editor-dialog').open,true,'the pencil opens Edit directly');
    const editor=d.getElementById('editor-dialog');
    d.getElementById('snippet-body').value='Changed draft';d.getElementById('cancel-editor').click();
    await flush();assert.equal(editor.open,true,'a failed autosave keeps the editor open');
    key(editor,'s',{ctrlKey:true});await flush();assert.equal(editor.open,true);assert.match(d.getElementById('editor-feedback').textContent,/Couldn’t save/);
    failSave=false;key(editor,'s',{metaKey:true});await flush();assert.equal(editor.open,true);assert.equal(writes,3);
    d.getElementById('cancel-editor').click();await flush();assert.equal(editor.open,false);
    d.querySelector('.result-view').click();
    d.getElementById('preview-edit').click();
    d.getElementById('snippet-body').value='Another change';editor.dispatchEvent(new w.Event('cancel',{cancelable:true}));
    await flush();assert.equal(editor.open,false);assert.equal(writes,4);

    d.querySelector('.result-view').click();
    d.getElementById('preview-more').click();
    [...d.querySelectorAll('#snippet-action-list button')].find(button=>button.textContent==='Rename').click();
    d.getElementById('rename-input').value='Private name';
    d.getElementById('rename-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
    assert.equal(snippet.title,'Private name','Rename updates the private label');
    assert.equal(snippet.body,'Another change','Rename preserves the complete content');
    assert.equal(writes,5);
    d.getElementById('close-preview').click();

    snippet.body='';key(search,'ArrowRight');
    assert.equal(d.getElementById('preview-title').textContent,snippet.title);
    assert.equal(d.getElementById('preview-body').textContent,'','a title-only snippet does not generate repeated content');
    assert.equal(d.getElementById('preview-body').hidden,true);
    d.getElementById('close-preview').click();

    d.getElementById('add').click();
    const title=d.getElementById('snippet-title'),body=d.getElementById('snippet-body');
    assert.equal(title.type,'hidden','the private name is not part of everyday editing');
    assert.equal(d.activeElement,body,'a new snippet starts directly in content');
    assert.equal(body.hasAttribute('placeholder'),false,'content has no instructional placeholder');
    assert.equal(d.getElementById('editor-undo').disabled,true,'Undo starts disabled');
    assert.equal(d.getElementById('editor-redo').disabled,true,'Redo starts disabled');
    body.value='First';body.dispatchEvent(new w.Event('input',{bubbles:true}));
    d.getElementById('editor-undo').click();
    assert.equal(body.value,'','editor Undo restores the prior text');
    assert.equal(d.getElementById('editor-redo').disabled,false,'Redo becomes available after Undo');
    d.getElementById('editor-redo').click();
    assert.equal(body.value,'First','editor Redo restores the undone text');
    const paste=new w.Event('paste',{bubbles:true,cancelable:true});
    Object.defineProperty(paste,'clipboardData',{value:{getData:()=> 'First line\nSecond line'}});
    body.dispatchEvent(paste);
    assert.equal(paste.defaultPrevented,false,'paste uses the browser\'s normal plain-text field behavior');
  }finally{await new Promise(resolve=>setTimeout(resolve,100));dom.window.close();}
});
