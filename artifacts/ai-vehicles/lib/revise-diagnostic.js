/* 短诊断后的单次人工结构修订：依据实际火力不足补强，不改策略、不刷种子。
 * 仅改铁龟、蒸汽人、黑龙，原诊断文件保留，后续重新校验、渲染并做正式测试。 */
'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
for(const [ch,st] of [[4,2],[5,1],[5,2]]){
  const file=path.join(root,`chapter-${ch}/ch${ch}-0${st}-candidates.json`),d=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const c of d.candidates){
    if(c.revision!==1)throw new Error(`${c.id} 已修订，禁止重复加装`);
    if(ch===4){
      c.cells.push([0,3,9,'mortar',5,3]);
      for(const cell of c.cells)if(cell[3]==='armor'&&cell[2]>=11)cell[5]=3;
      c.designIntent+=' 短诊断发现双小臼无法有效削减上一关多炮车，故增加一门顶置高抛并加固前甲；保留双小臼、厚前甲与薄后甲主题。';
    }else if(st===1){
      c.cells.find(cell=>cell[3]==='biped')[6].refit=3;
      if(c.id.endsWith('04'))c.cells.find(cell=>cell[3]==='mortar_s')[2]=8;
      if(c.id.endsWith('05'))c.cells=c.cells.filter(cell=>!(cell[3]==='plate'&&cell[2]===7));
      c.cells.push([0,2,6,'mortar',5,3]);
      c.designIntent+=' 短诊断中双机炮难以威胁上一章重炮车，增加背部高抛并将重腿承重改造升至三级；仍保留双机炮与鱼叉。';
    }else{
      c.cells.push([0,5,12,'cannon_m',5,3]);
      c.designIntent+=' 矿坑短诊断显示大量喷火未形成有效伤害，故在前甲顶增加中炮，补充射程与穿甲，保留双喷火器和抛射架。';
    }
    c.revision=2;c.previewInspection={inspected:false};
    c.revisionNote='固定种子短诊断后的唯一一次火力／防护修订；正式成绩仅对应修订后结构。';
  }
  d.status='draft';fs.writeFileSync(file,JSON.stringify(d,null,2));
}
