/* 交付前核对真实规则、固定种子成绩、参考链、图片与工作台完整种子。
 * 读取最终产物；若任何图片或成绩仍来自旧装配，立即失败，不替换实测数据。 */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const game=require('../../../tools/evolve.js'),common=require('../chapter-2/lib/design-check.js');
const specTools=require('./planned-spec.js'),Workbench=require('../../../tools/workbench-session.js');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const full=cells=>JSON.stringify(cells.map(c=>JSON.stringify([...c.slice(0,6),c[6]?.unique||null,c[6]?.refit||0])).sort());
let count=0,games=0,crossGames=0;const report=[];
function checkBattle(car,b,expectedGames){
  assert.equal(b.candidateFingerprint,common.fingerprint(car.cells));assert.equal(b.games,expectedGames);
  assert.equal(b.rows.length,expectedGames);assert.equal(b.seedBase,20261005);
  assert.equal(b.candidateAim,.8);assert.equal(b.referenceAim,.8);assert.equal(b.style,car.style);
  let wins=0,draws=0;
  for(let i=0;i<expectedGames/2;i++)for(const [j,side] of ['p','e'].entries()){
    const r=b.rows[i*2+j];assert.equal(r.seed,20261005+i);assert.equal(r.candidateSide,side);
    assert(['p','e','draw'].includes(r.result.winner));
    assert.equal(r.outcome,r.result.winner==='draw'?'draw':r.result.winner===side?'win':'loss');
    assert(Number.isFinite(r.result.pDealt));assert(Number.isFinite(r.result.eDealt));
    wins+=r.outcome==='win';draws+=r.outcome==='draw';
  }
  assert.equal(b.wins,wins);assert.equal(b.draws,draws);assert.equal(b.winRate,(wins+draws/2)/expectedGames);
}
for(const ch of [4,5])for(let st=1;st<=6;st++){
  const dir=path.join(root,`chapter-${ch}`),d=read(path.join(dir,`ch${ch}-0${st}-candidates.json`));
  const {SA}=game.loadGame(),spec=specTools.stageSpecForCandidate(SA,ch,st-1),rules=game.ruleFingerprint(SA);
  const formal=read(path.join(dir,`results/ch${ch}-0${st}-formal.json`));
  assert.equal(d.candidates.length,5);assert.equal(d.status,'completed');assert.equal(d.ruleFingerprint,rules);assert.equal(formal.rules,rules);
  const previous=read(path.resolve(root,'../..',formal.referenceSnapshot.sourceFile));
  const ref=previous.candidates.find(c=>c.id===formal.referenceSnapshot.id);assert(ref);
  assert.equal(common.fingerprint(ref.cells),formal.referenceSnapshot.fingerprint);
  const manifests=fs.readdirSync(path.join(dir,'previews')).filter(f=>f.endsWith('-render.json')).flatMap(f=>read(path.join(dir,'previews',f)));
  for(const car of d.candidates){
    const v=common.vehicle(SA,car,spec.grid),s=SA.V.stats(v),fp=common.fingerprint(car.cells);
    const checks={...game.constructionConditions(SA,v,spec),...common.sourceCellsConditions(SA,car,v),...specTools.additionalConditions(SA,car,v,spec)};
    assert(Object.values(checks).every(Boolean),car.id+' 构筑失败');assert.equal(s.value,car.budget);assert.equal(car.fingerprint,fp);
    assert.equal(car.model,'Codex 主线程（本轮授权接手）');assert.equal(car.source,'ai-generated');
    assert(SA.AI_STYLES.some(x=>x.id===car.style));assert.deepEqual(spec.grid,{cols:8,rows:6});
    // 直接验证原始矩形占格，补足仅靠锚点唯一性无法覆盖的内部交叠。
    const occupied=new Set();
    for(const [layer,r,c,id] of car.cells){const f=SA.fp(id);for(let y=r;y<r+f.h;y++)for(let x=c;x<c+f.w;x++){
      const k=`${layer}:${y}:${x}`;assert(!occupied.has(k),car.id+' 原始部件重叠 '+k);occupied.add(k);
    }}
    const row=formal.candidates.find(x=>x.id===car.id);assert.equal(row.fingerprint,fp);checkBattle(car,row.battleTests,120);
    assert.equal(car.battleTests.winRate,row.battleTests.winRate);assert.equal(car.battleTests.referenceFingerprint,formal.referenceSnapshot.fingerprint);
    assert.equal(car.crossTests.length,4);assert.equal(new Set(car.crossTests.map(x=>x.referenceId)).size,4);
    for(const cross of car.crossTests){
      assert.notEqual(cross.referenceId,car.battleTests.referenceId);
      const all=read(path.join(dir,cross.resultFile));assert.equal(all.rules,rules);
      const r=all.candidates.find(x=>x.id===car.id);checkBattle(car,r.battleTests,6);assert.equal(cross.winRate,r.battleTests.winRate);
      assert.equal(all.referenceSnapshot.fingerprint,common.fingerprint(all.referenceSnapshot.cells));crossGames+=6;
    }
    const png=fs.readFileSync(path.join(dir,car.preview)),pngHash=hash(png);
    assert(manifests.some(m=>m.id===car.id&&m.cellsFingerprint===fp&&m.pngFingerprint===pngHash),car.id+' 图片过期');
    assert.equal(car.previewInspection.inspected,true);assert.equal(car.previewInspection.cellsFingerprint,fp);
    const restored=Workbench.parseVehicle(Workbench.exportVehicle(v,SA),car.name,SA);
    assert.equal(full(SA.StageCars.cellsOf(restored)),full(car.cells));
    for(const loot of d.rewardPlan.uniqueLoot){
      const registered=SA.uniqueByKey(loot.key);assert(registered);assert.equal(loot.id,registered.id);assert.equal(loot.mt,registered.mt);
      assert(car.cells.some(cell=>(cell[6]?.unique||cell[3])===loot.key));
    }
    report.push({id:car.id,legal:true,budget:car.budget,budgetUsage:car.budgetUsage,winRate:car.battleTests.winRate,
      status:car.battleTests.status,cellsFingerprint:fp,pngFingerprint:pngHash,roundTrip:true});count++;games+=120;
  }
}
assert.equal(count,60);assert.equal(games,7200);assert.equal(crossGames,1440);
const result={candidates:count,formalGames:games,crossGames,totalGames:games+crossGames,allPassed:true,rows:report};
fs.writeFileSync(path.join(root,'chapter-5/results/chapter-4-5-delivery-check.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({candidates:count,formalGames:games,crossGames,totalGames:games+crossGames,allPassed:true}));
