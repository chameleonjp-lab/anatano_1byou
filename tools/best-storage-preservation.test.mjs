import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const html = readFileSync(process.env.ANATANO_HTML ?? new URL('../index.html', import.meta.url), 'utf8');
const storageHelpers = html.match(/^    function safeGetItem\(key\) \{[\s\S]+?^    \}\n\n    function safeSetItem\(key, value\) \{[\s\S]+?^    \}/m)?.[0];
const bestHelpers = html.match(/^(?:    function readBestRecord\(\) \{[\s\S]+?^    \}\n\n)?    function getSavedBestScore\(\) \{[\s\S]+?^    \}/m)?.[0];
const bestKey = html.match(/^    const BEST_KEY = '[^']+';$/m)?.[0];
const finalize = html.match(/^      game\.bestUpdated = false;[\s\S]+?(?=^      game\.finalized=true;)/m)?.[0];
assert.ok(storageHelpers && bestHelpers && bestKey && finalize, 'expected production blocks');

function run({raw = null, score = 0.2, completed = true, resultType = 'clear', failure = ''} = {}) {
  const best = 'anatano_1byo_best_score_v1';
  const last = 'test:last';
  const original = raw;
  const values = new Map([[best, raw], ['unrelated', 'keep']]);
  const attempts = [];
  let bestReads = 0;
  const game = {bestUpdated: true, resultType};
  const localStorage = {
    getItem(key) {
      if (key === best) {
        bestReads++;
        if (failure === 'read' || (failure === 'readback' && bestReads === 2)) throw Error('unavailable');
        if (failure === 'wrong-readback' && bestReads === 2) return original;
      }
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      attempts.push([key, value]);
      if (key === best && failure === 'write') throw Error('quota');
      if (key !== best || failure !== 'drop-write') values.set(key, value);
    },
  };
  const context = vm.createContext({game, completed, totalDiff: score, LAST_KEY: last, localStorage}, {codeGeneration:{strings:false,wasm:false}});
  const displayScore = vm.runInContext(bestKey + '\n' + storageHelpers + '\n' + bestHelpers + '\n' + finalize + '\ngetSavedBestScore();', context, {timeout: 250});
  assert.equal(values.get('unrelated'), 'keep');
  return {raw: values.get(best), updated: game.bestUpdated, writes: attempts.filter(([key]) => key === best).length, last: values.get(last), displayScore};
}

test('BEST read exception preserves preexisting faster raw and still records completion', () => {
  assert.deepEqual(run({raw:'0.1',failure:'read'}), {raw:'0.1',updated:false,writes:0,last:'クリア',displayScore:null});
});
for (const raw of ['{future', 'Infinity', 'NaN']) {
  test('unrecognized raw is preserved: ' + raw, () => {
    assert.deepEqual(run({raw}), {raw,updated:false,writes:0,last:'クリア',displayScore:null});
  });
}
for (const fail of ['write','drop-write','readback','wrong-readback']) {
  test('does not announce a best before exact readback: ' + fail, () => {
    const got = run({raw:'1',failure:fail});
    assert.equal(got.updated,false);
    assert.equal(got.writes,1);
    assert.equal(got.last,'クリア');
    if (fail === 'write' || fail === 'drop-write') assert.equal(got.raw,'1');
  });
}
for (const raw of [null,'1',' 1e0 ','0x1']) {
  test('missing or slower finite record permits confirmed lower score: ' + raw, () => {
    assert.deepEqual(run({raw}), {raw:'0.2',updated:true,writes:1,last:'クリア',displayScore:0.2});
  });
}
for (const raw of ['0.2','0.1','0','', '  ', '-1']) {
  test('equal or faster finite legacy representation remains exact: ' + JSON.stringify(raw), () => {
    assert.deepEqual(run({raw}), {raw,updated:false,writes:0,last:'クリア',displayScore:Number(raw)});
  });
}
for (const [resultType, last] of [['timeout','時間切れ'],['retire','リタイア']]) {
  test('non-clear result leaves BEST alone: ' + resultType, () => {
    assert.deepEqual(run({raw:'1',completed:false,resultType}), {raw:'1',updated:false,writes:0,last,displayScore:1});
  });
}
