import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const langs=['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'];
const match=html.match(/<script id="locale-catalogs" type="application\/json">([\s\S]*?)<\/script>/);
const code=html.match(/<script id="localization">([\s\S]*?)<\/script>/)?.[1];
function boot(saved=null,languages=['ja-JP']) {
  const data=new Map([['chameleonjp_player_name_v1','元の名前'],['anatano_1byo_best_score_v1','1.23']]);
  if(saved!==null)data.set('anatano_1byou-language',saved);
  const selector={value:'',addEventListener(){}};
  const document={documentElement:{lang:'ja'},getElementById(id){return id==='locale-catalogs'?{textContent:match?.[1]}:selector;},querySelectorAll(){return []}};
  const context={document,navigator:{languages},localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},window:{dispatchEvent(){}},CustomEvent:class{},console};
  vm.createContext(context);vm.runInContext(code,context);
  return {api:context.window.gameI18n,data,document};
}
test('all fifteen catalogs contain the full same placeholders',()=>{
  assert.ok(match,'embedded catalogs must be included in the shipped single HTML');
  const all=JSON.parse(match[1]);assert.deepEqual(Object.keys(all).sort(),langs.toSorted());
  const keys=Object.keys(all.en).sort();
  for(const [lang,entries] of Object.entries(all)){
    assert.deepEqual(Object.keys(entries).sort(),keys,lang);
    for(const key of keys){assert.equal(typeof entries[key],'string');assert.ok(entries[key].trim(),`${lang}/${key}`);assert.deepEqual((entries[key].match(/\{\w+\}/g)||[]).sort(),(all.en[key].match(/\{\w+\}/g)||[]).sort(),`${lang}/${key}`)}
  }
});
test('saved language wins and browser aliases fall back explicitly',()=>{
  assert.ok(code,'localization runtime must exist');
  assert.equal(boot('vi',['ja-JP']).api.language,'vi');
  assert.equal(boot(null,['zh-TW']).api.language,'zh-Hant');assert.equal(boot(null,['zh-Hans-TW']).api.language,'zh-Hans');assert.equal(boot(null,['zh-Hant-CN']).api.language,'zh-Hant');
  assert.equal(boot(null,['pt-PT']).api.language,'pt-BR');
  assert.equal(boot(null,['xx','de-AT']).api.language,'de');
  assert.equal(boot('invalid',['xx']).api.language,'en');
});
test('language changes preserve name/best and interpolate plain text',()=>{
  assert.ok(code,'localization runtime must exist');
  const {api,data,document}=boot('ja');api.setLanguage('en');
  assert.equal(data.get('anatano_1byou-language'),'en');assert.equal(data.get('chameleonjp_player_name_v1'),'元の名前');assert.equal(data.get('anatano_1byo_best_score_v1'),'1.23');
  assert.equal(document.documentElement.lang,'en');assert.equal(api.t('playerName',{name:'<img onerror=x>'}),'Ranking name: <img onerror=x>');
});
