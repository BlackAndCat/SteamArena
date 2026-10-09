/* 冻结装配的批量实测调度：只调用校验器，固定种子、策略和换边规则；绝不搜索或改装。 */
'use strict';
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'../../..');
const mode=process.argv[2]||'diagnostic';
if(!['diagnostic','formal','cross'].includes(mode))throw new Error('模式必须为diagnostic/formal/cross');
// 参考链由设计者明确指定；如短诊断导致修订，在正式测试之前另行更新，不自动选胜率。
const selected={3:[null,null,null,null,null,1],4:[1,5,3,2,3,3],5:[3,4,2,1,2,1]};
const file=(ch,s)=>`artifacts/ai-vehicles/chapter-${ch}/ch${ch}-0${s+1}-candidates.json`;
const jobs=[];
for(const ch of [4,5])for(let s=0;s<6;s++){
  const pc=s?ch:ch-1,ps=s?s-1:5,ref=selected[pc][ps],refs=mode==='cross'?[1,2,3,4,5].filter(i=>i!==ref):[ref];
  for(const n of refs){
    const out=`artifacts/ai-vehicles/chapter-${ch}/results/ch${ch}-0${s+1}-${mode}${mode==='cross'?'-0'+n:''}.json`;
    jobs.push({ch,s,n,out,args:[`artifacts/ai-vehicles/chapter-${ch}/lib/design-check.js`,'battle',file(ch,s),file(pc,ps),`ch${pc}-0${ps+1}-0${n}`,mode==='formal'?'60':'3',out]});
  }
}
let next=0,failed=false;
async function worker(){while(next<jobs.length){const job=jobs[next++];await new Promise(resolve=>{
  const child=spawn(process.execPath,job.args,{cwd:root,windowsHide:true,stdio:['ignore','ignore','pipe']});
  let errors='';child.stderr.on('data',b=>{const t=b.toString();errors+=t;process.stdout.write(t);});
  child.on('error',e=>{failed=true;console.error(e);resolve();});
  child.on('exit',code=>{if(code){failed=true;console.error(`失败 ${job.out}: ${code}`);}else{
    const r=JSON.parse(fs.readFileSync(path.join(root,job.out),'utf8'));
    console.log(JSON.stringify({complete:job.out,rates:r.candidates.map(c=>[c.id,c.battleTests.winRate])}));
  }resolve();});
});}}
Promise.all(Array.from({length:mode==='cross'?3:6},worker)).then(()=>{process.exitCode=failed?1:0;});
