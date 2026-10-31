const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
const root=path.resolve(__dirname,'..');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const catalogs=JSON.parse(html.match(/<script id="locale-catalogs" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:402,height:874},locale:'ja-JP'});let errors=[],submissions=[],mode='offline',rankMode='normal',raceCalls=0;const ledger=new Map();
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.open=()=>null;window.__audioContexts=0;const Original=window.AudioContext;if(Original)window.AudioContext=class extends Original{constructor(...args){super(...args);window.__audioContexts++;}};});
 await page.route('**/*.supabase.co/**',async route=>{
  const rpc=route.request().url().split('/').pop();
  if(rpc==='submit_score_once_shared_v1'){
   const payload=route.request().postDataJSON();submissions.push(payload);const duplicate=ledger.has(payload.p_submission_id);ledger.set(payload.p_submission_id,payload);
   if(mode==='offline'){await route.fulfill({status:503,json:{code:'network_error'}});return;}
   await route.fulfill({json:[{accepted:true,result_display_name:payload.p_display_name,result_normalized_name:payload.p_display_name,result_first_score:payload.p_score,result_best_score:payload.p_score,result_play_count:1,was_duplicate:duplicate}]});return;
  }
  assert.notEqual(rpc,'submit_score','unsafe legacy submission must never be used');
  if(rpc==='get_game_play_stats'){await route.fulfill({json:[{total_play_count:50,player_count:35}]});return;}
  if(rankMode==='failure'){await route.fulfill({status:503,json:{code:'network_error'}});return;}
  if(rankMode==='empty'){await route.fulfill({json:[]});return;}
  let name='Player';if(rankMode==='race'){raceCalls++;name=raceCalls<=2?'Stale':'Fresh';await new Promise(r=>setTimeout(r,raceCalls<=2?200:10));}
  await route.fulfill({json:Array.from({length:35},(_,i)=>({rank_no:i<2?1:i+1,display_name:rankMode==='normal'?(i<2?'同名 <img>':`Player ${i}`):name,best_score:123+i,first_score:223+i,play_count:3}))});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 assert.equal(await page.locator('#homeScreen #playerNameInput').count(),1);assert.equal(await page.locator('#nameDisclosure').textContent(),catalogs.ja.nameDisclosure);
 await page.click('#soundToggle');assert.equal(await page.evaluate(()=>window.__audioContexts),0,'first mute must not initialize audio');
 await page.locator('#soundVolume').fill('0');await page.locator('#soundVolume').dispatchEvent('input');await page.reload();
 assert.equal(await page.evaluate(()=>window.gameAudio.enabled),false);assert.equal(await page.evaluate(()=>window.gameAudio.volume),0);
 for(const lang of Object.keys(catalogs)){
  await page.selectOption('#languageSelect',lang);assert.equal(await page.locator('#shareGameBtn').textContent(),catalogs[lang].shareX);
  for(const viewport of [{width:402,height:874},{width:874,height:402}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,lang+' overflow');}
  await page.click('#shareGameBtn');const share=await page.locator('#commonShareText').inputValue();assert.ok(share.startsWith(catalogs[lang].gameTitle));assert.ok(share.includes('https://chameleonjp.codeberg.page/anatano_1byou/'));await page.click('#commonShareClose');
 }
 await page.setViewportSize({width:402,height:874});await page.selectOption('#languageSelect','en');
 async function complete(){await page.evaluate(()=>{clearAllTimers();beginMeasurement();game.startedAt=performance.now()-1200;game.taps=game.targets.map(n=>n+0.11);finishGame('clear')});await page.waitForFunction(()=>document.body.dataset.screen==='result');await page.waitForFunction(()=>document.getElementById('bestRankingList').children.length===30);}
 for(const name of ['', '   ']){
  await page.fill('#playerNameInput',name);await page.click('#startBtn');await complete();assert.equal(submissions.length,0);assert.equal(await page.locator('#rankingStatus').textContent(),catalogs.en.guestResult);await page.click('#finishBtn');
 }
 await page.click('#startBtn');await page.evaluate(()=>{clearAllTimers();beginMeasurement();game.taps=game.targets.map(n=>n+0.11);finishGame('clear');});
 await page.reload();assert.equal(await page.evaluate(()=>game.phase),'result','a clear survives reload during its result transition');assert.equal(await page.evaluate(()=>game.finalScore),0.33);await page.click('#finishBtn');
 await page.fill('#playerNameInput','名前 <>& +');
 await page.locator('#playerNameInput').dispatchEvent('keydown',{key:'Enter',isComposing:true});assert.equal(await page.evaluate(()=>game.phase),'home');
 await page.click('#startBtn');await page.evaluate(()=>{clearAllTimers();beginMeasurement();game.startedAt=performance.now()-1200;});
 const before=await page.evaluate(()=>({targets:game.targets,startedAt:game.startedAt,taps:game.taps,phase:game.phase}));
 await page.evaluate(()=>{window.gameI18n.setLanguage('vi');document.getElementById('playerNameInput').value='Changed later';});
 assert.deepEqual(await page.evaluate(()=>({targets:game.targets,startedAt:game.startedAt,taps:game.taps,phase:game.phase})),before);
 await complete();await page.waitForFunction(()=>game.submissionStatus==='pending');assert.equal(submissions.length,1);assert.equal(submissions[0].p_display_name,'名前 <>& +');assert.equal(submissions[0].p_score,33);
 const payload=submissions[0];assert.equal(await page.locator('#rankingStatus').textContent(),catalogs.vi.scorePending);assert.equal(await page.locator('#rankingReadStatus').textContent(),catalogs.vi.rankingLoaded);
 await page.reload();await page.waitForFunction(()=>game.phase==='result'&&game.submissionStatus==='pending');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>game.finalScore),0.33);assert.ok(submissions.length>=2);assert.deepEqual(submissions.at(-1),payload);
 mode='online';await page.click('#retrySendBtn');await page.waitForFunction(()=>game.submissionStatus==='submitted');await page.waitForFunction(()=>!document.getElementById('retryRankingBtn').disabled);
 assert.equal(ledger.size,1);assert.deepEqual(submissions.at(-1),payload);assert.equal(await page.locator('#bestRankingList .ranking-row').count(),30);assert.equal(await page.locator('#bestRankingList img').count(),0);
 const submissionCount=submissions.length;
 for(const lang of Object.keys(catalogs)){
  await page.evaluate(l=>window.gameI18n.setLanguage(l),lang);assert.equal(await page.evaluate(()=>game.finalScore),0.33);assert.equal(submissions.length,submissionCount);assert.equal(await page.locator('#bestRankingList .ranking-row').count(),30);
  await page.click('#shareResultBtn');const share=await page.locator('#commonShareText').inputValue();assert.ok(share.includes('0.33'));assert.ok(!share.includes('名前 <>& +'));await page.click('#commonShareClose');
 }
 rankMode='race';await page.evaluate(()=>{void loadRankings();void loadRankings();});await page.waitForTimeout(400);assert.equal(await page.locator('#bestRankingList .ranking-name').first().textContent(),'Fresh');
 rankMode='failure';await page.click('#retryRankingBtn');await page.waitForFunction(()=>!document.getElementById('retryRankingBtn').disabled);assert.equal(await page.locator('#rankingReadStatus').textContent(),catalogs.th.rankingLoadFailed);assert.equal(await page.evaluate(()=>game.finalScore),0.33);
 rankMode='empty';await page.click('#retryRankingBtn');await page.waitForFunction(()=>!document.getElementById('retryRankingBtn').disabled);assert.equal(await page.locator('#bestRankingList').textContent(),catalogs.th.noRecords);
 await page.click('#finishBtn');await page.fill('#playerNameInput','');await page.locator('#playerNameInput').dispatchEvent('change');await page.reload();assert.equal(await page.locator('#playerNameInput').inputValue(),'');assert.equal(await page.evaluate(()=>localStorage.getItem('anatano_1byo_best_score_v1')),'0.33');
 assert.equal(await page.evaluate(()=>window.gameAudio.enabled),false);assert.equal(await page.evaluate(()=>window.gameAudio.volume),0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({languages:Object.keys(catalogs).length,guestCases:3,score:0.33,submissionAttempts:submissions.length,distinctSubmissionIds:ledger.size,unchangedLanguageState:true,top30:true,rankingRace:true,rankingFailureAndEmpty:true,soundOffZeroPreserved:true,productionWrites:0}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
