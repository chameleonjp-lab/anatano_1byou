import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('    async function callSupabaseRpc'),html.indexOf('    function resetRankingDisplay'));
test('stalled RPC is aborted and cleaned up so pending results remain retryable',async()=>{
 const timers=[];let cleared=false;const context={hasSupabaseConfig:()=>true,getSupabasePublishableKey:()=> 'public',SUPABASE_URL:'https://example.test',AbortController,setTimeout(fn,ms){timers.push({fn,ms});return 1;},clearTimeout(){cleared=true;},fetch(url,options){return new Promise((resolve,reject)=>options.signal?.addEventListener('abort',()=>reject(new Error('aborted'))));}};
 vm.createContext(context);vm.runInContext(code,context);const promise=context.callSupabaseRpc('test',{});assert.equal(timers.length,1,'RPC must have a bounded timeout');assert.ok(timers[0].ms<=10000);timers[0].fn();await assert.rejects(promise,/aborted/);assert.equal(cleared,true);
});
