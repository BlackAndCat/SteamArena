/* 本轮授权主线程直接设计。以下是逐车确定的装配清单，不调用进化、随机搜索或组合枚举。
 * 平台函数只展开相同底架与机组；五个有名称的方案分别明确选择武器、材料和结构差异。
 * 再次执行会覆盖本批 JSON，因此只在草稿修订阶段运行，冻结实测后不再执行。 */
'use strict';
const fs=require('fs'),path=require('path');
const {loadGame}=require('../../../tools/evolve.js');
const {stageSpecForCandidate,fixedItems}=require('./planned-spec.js');
const {SA}=loadGame(),model='Codex 主线程（本轮授权接手）';
const root=path.resolve(__dirname,'..');
// 显式锚点均用16×12子格；普通件默认乌兹钢、耐久三级，额外改造独立记在第七项。
const C=(id,r,c,mt=5,lv=3,extra)=>[SA.MODULES[id].layer==='side'?1:0,r,c,id,mt,lv,...(extra?[extra]:[])];
const tracks=(cols,mt=5)=>cols.map(c=>C('track',10,c,mt));
const quads=(cols,mt=5)=>cols.map(c=>C('quad',10,c,mt));
const plates=(r,cols,mt=5)=>cols.map(c=>C('plate',r,c,mt,0));
const A=(r,c,mt=5)=>C('armor',r,c,mt,0);
const R=(r,c,mt=5)=>C('radiator',r,c,mt);
const stages=[];
function add(ch,st,designs,note){
  const spec=stageSpecForCandidate(SA,ch,st),unique=spec.planningPatch.uniqueReward;
  const data={schemaVersion:1,stageId:`${ch}:${st}`,stageName:spec.name,source:'ai-generated',model,
    designProcess:'模型逐车直接设计显式锚点；共用底架仅展开固定清单，不走进化、随机搜索、自动装配或自动预算填充。',
    designTargetWinRate:[.6,.75],status:'draft',spec,
    rewardPlan:{status:'proposal-not-saved',fixedItems:fixedItems[ch][st],uniqueLoot:unique?[SA.uniqueByKey(unique)]:[],note},
    referenceLearning:[{stageId:'1:0',finding:'沿用人工铁皮罐头的低位机组和前柱甲，把动力、水与驾驶员装进连续轮廓。'},
      {stageId:'1:2',finding:'沿用煤灰寡妇顶置高抛、前置直射的分工，不在直射炮前堆甲。'},
      {stageId:'1:6',finding:'多段底盘承托成组火力，底盘数由平台宽度确定，避免散乱悬空附件。'}],
    candidates:designs.map(([name,style,intent,cells],i)=>({id:`ch${ch}-0${st+1}-0${i+1}`,name:`AI生成·${name}`,
      source:'ai-generated',model,stageId:`${ch}:${st}`,style,aim:.8,revision:1,designIntent:intent,
      requiredModules:spec.requiredModules,cells,preview:`previews/ch${ch}-0${st+1}-0${i+1}.png`,previewInspection:{inspected:false},
      budgetTradeoff:{note:ch===4&&st===3?'本关刻意保留黄铜／熟铁旧样车与休息关定位，不升高材质消耗预算。':ch===5&&st===4?'茶点车保留镀镍、薄甲、少水的剧情弱点，不为消耗预算改造成重型堡垒。':
        ['4:2','5:0','5:2'].includes(`${ch}:${st}`)?'单对双足承重、重心与速度优先；装备已按功能选材升级，未用预算不通过无作用填充件补齐。':'优先升级主火力、机组与驾驶舱；剩余预算保留为后续手工改装空间，不通过冗余小件填满车间。'}}))};
  stages.push(data);
}
// 一号炮组：两层驾驶舱与前方炮列共用一体机组，顶部保留清晰台阶轮廓。
function gunCrew(front,top,mt=4){return [...tracks([2,4,6,8,10,12],mt),C('boiler_l',7,3,mt),C('water_l',7,6,mt),
  C('cockpit',8,9,5),C('cockpit',6,9,mt),A(8,11,5),A(6,11,5),R(8,11,mt),R(6,11,mt),
  C('boiler',5,5,mt),C(top,top==='mortar_s'?6:5,3,mt),C('pressure_tank',5,7,mt),...front];}
add(4,0,[
 ['四组协同炮车','counter','四人舱分组指挥：上层机炮、中段重机枪、下层中小炮；炮口前方留空，后部锅炉与水箱保持低宽一体轮廓。',gunCrew([C('mg',4,12,5),C('mg_heavy',6,12,5),C('cannon_m',8,12,5),C('cannon_s',9,12,5)],'mortar_s')],
 ['镀镍齐射台','turtle','保留上下两条直射线，将下层小炮换成中炮，顶部抛射架负责越障；外形以银色装甲柱收住机组。',gunCrew([C('mg',4,12,4),C('mg_heavy',6,12,4),C('cannon_m',8,12,5),C('cannon_m',9,12,4)],'rocket_rack')],
 ['兵工厂护航炮组','counter','顶层机炮与重机枪清轻甲，中炮和小炮分守低位；顶置高抛补足对厚甲的攻击。',gunCrew([C('mg',4,12,4),C('mg_heavy',6,12,5),C('cannon_m',8,12,4),C('cannon_s',9,12,4)],'mortar')],
 ['黄铜指挥塔','wander','镀镍底架承托机组，乌兹钢双驾驶舱与机炮保住指挥链；鱼叉替换小炮，拉近距离给各炮组创造集火机会。',gunCrew([C('mg',4,12,5),C('mg_heavy',6,12,4),C('cannon_m',8,12,5),C('harpoon',9,12,4)],'mortar_s')],
 ['炮组攻坚型','turtle','上层保留机炮，下层用三层中小炮形成齐射；顶部臼炮对付遮挡，机组藏在前甲后方。',gunCrew([C('mg',4,12,4),C('cannon_m',6,12,4),C('cannon_s',7,12,4),C('cannon_m',8,12,4),C('cannon_s',9,12,4)],'mortar')]
],'四人联合驾驶舱固定奖励提案；本批候选包含多组火力，正式采用前不修改关卡。');
// 铁龟：厚前甲和连续甲片顶盖；双小臼坐在盖板上，后舱只留单层防护。
function turtle(top,extra,mt=4){return [...tracks([2,4,6,8,10,12],mt),C('boiler_l',7,3,5),C('water_l',7,6,5),
 C('cockpit',8,9,5),C('water',6,9,mt),A(8,11,5),A(6,11,5),A(8,12,5),A(6,12,5),A(8,13,5),A(6,13,5),
 R(8,11,5),R(6,11,5),A(8,2,mt),C('tank_tall',6,2,mt),...plates(6,[3,4,5,6,7,8],mt),
 C('mortar_s',5,top[0],5),C('mortar_s',5,top[1],5),...extra];}
add(4,1,[
 ['铁龟双臼堡','turtle','六段履带承托低矮龟壳，双臼越过货箱；三列前甲、单列后甲，明确留后部弱点。',turtle([5,8],[...plates(5,[9,10,11,12,13],4)])],
 ['铁龟长背型','turtle','双臼拉开布置，背部加蓄压罐保护供汽；四人舱仍低置，前甲不遮蔽高抛线。',turtle([4,8],[C('pressure_tank',4,6,5),...plates(5,[9,10,11,12,13],5)])],
 ['铁龟前盾型','counter','双臼集中后背，前方多一层短甲台；正面耐打但后端锅炉靠近薄甲。',turtle([3,6],[A(4,11,5),A(4,12,5),A(4,13,5),...plates(5,[7,8,9,10],4)])],
 ['铁龟水冷型','turtle','增加背部储水，强调长时间抛射；炮位分置储水两侧，顶盖保持台阶而非堆成高塔。',turtle([3,8],[C('water',4,5,5),...plates(5,[9,10,11,12,13],4)])],
 ['铁龟指挥型','turtle','保留双臼和前厚甲，背部多一座低指挥舱形成备用驾驶链；不是全向无弱点堡垒。',turtle([3,8],[C('cockpit',4,5,5),...plates(5,[9,10,11,12,13],4)])]
],'无实际模块奖励的规划关补镀镍装甲×2；下注功能仍为原规划，未在本次实现。');
// 野兔：腿在质心下，水箱分挂腰胯；上身炮口沿右缘排齐，动力包贴背。
function hare(top,back='water',refit=3){return [C('biped',8,8,5,3,{refit}),C('water',8,6,4,0,{refit:1}),C('water',8,10,4,0,{refit:1}),
 C('boiler',6,6,5,3,{refit:2}),C('cockpit',6,8,5),C('mg2',6,10,5),C(back,4,6,4,0),
 C('harpoon',5,8,5),...plates(4,[8,9],4),...top];}
add(4,2,[
 ['野兔游骑兵','kite','鱼叉牵制与腰线双联机枪配合；两侧水箱压低重心，三级承重改造承担双侧水箱，速度相应下降15%。',hare([])],
 ['野兔双叉型','kite','上身增加第二支鱼叉，错开两条发射线；双联机枪持续覆盖，被牵住时仍能反击。',hare([C('harpoon',3,8,5)])],
 ['野兔跳弹猎手','wander','顶端一门中炮增加穿甲，背水保障双联机枪持续射击；保持紧凑肩线。',hare([C('cannon_m',3,8,5)])],
 ['野兔小臼侦骑','kite','背包上装一门小臼补越障，正面继续鱼叉与双联机枪；不会堆成长枪柱。',hare([C('mortar_s',3,6,5)])],
 ['野兔双控型','counter','背部水箱换备用驾驶舱，提升指挥链生存；肩顶补小水罐，代价是储水较少。',hare([C('tank_s',3,6,5)],'cockpit')]
],'双联机枪固定奖励提案。完整8×6车间沿用用户要求，不重新锁回规划7×6。');
// 旧样车：大锅炉是主视觉，只有熟铁与黄铜；三种矮炮楼和两种开背结构。
function oldCar(front,back,mt=2){return [...tracks([3,5,7,9,11],mt),C('boiler_l',7,3,1,0),C('water_l',7,6,2,0),
 C('cockpit',8,9,2,0),A(8,11,2),C('gyroscope',8,11,2,0),C('cannon_m',8,12,2,0),...plates(9,[12,13],2),...front,...back];}
add(4,3,[
 ['零号老锅炉','turtle','巨大的旧黄铜锅炉与熟铁中炮还原早期试验车；陀螺仪装前甲，整车低矮、没有现代副炮。',oldCar([],[])],
 ['零号双炮原型','counter','在旧底架上追加上层中炮，甲片撑起短炮台；仍采用旧机组，作为技术演进的早期双炮样机。',oldCar([C('cannon_m',7,11,2,0)],[])],
 ['零号测绘车','turtle','大锅炉背后是矮水罐，上层小臼用于测绘弹道；新陀螺仪安装在旧壳上。',oldCar([], [C('mortar_s',6,6,2,0)])],
 ['零号修补车','wander','机组顶部加一层熟铁补片，保留前低炮和完整旧锅炉轮廓；低预算符合剧情休息关。',oldCar([],plates(6,[3,4,5],2))],
 ['零号备用指挥车','counter','背部增设双人备用舱，保留单门中炮；让玩家能观察旧式指挥冗余而非火力堆叠。',oldCar([], [C('cockpit_pair',5,6,2,0)])]
],'陀螺仪熟铁模块固定奖励提案。保留三十年前旧样车的弱势，不为高预算换成乌兹钢。');
// 攻城平台：四段四足连续承托，臼炮组只在屋顶，前柱甲守住机组。
function siege(roof,front,mt=5){return [...[0,4,8,12].map(c=>C('quad',10,c,mt,1)),C('boiler_l',7,3,mt),C('water_l',7,6,mt),C('cockpit',8,9,mt),
 C('cockpit',6,9,mt),A(8,11,mt),A(6,11,mt),R(8,11,mt),R(6,11,mt),C('water',5,7,mt),C('boiler',5,5,mt),
 ...roof,...front];}
add(4,4,[
 ['攻城三联臼炮','turtle','三门屋顶高抛形成攻城齐射，四足保持射击稳定；前方小炮仅作近身防护，巨炮留给第五章决赛。',siege([C('mortar',3,5),C('mortar',3,7),C('mortar',4,9)],[C('cannon_m',8,12),C('cannon_m',9,12),A(6,12),A(6,13)])],
 ['攻城火箭臼炮','turtle','双高抛搭配抛射架，前端厚盾与底层中炮相连，保持前低后高的炮兵轮廓。',siege([C('mortar',3,5),C('rocket_rack',3,7),C('mortar',4,9)],[C('cannon_m',8,12),C('cannon_m',9,12),A(6,12),A(6,13)])],
 ['攻城重炮护卫','counter','后部双臼负责越坡，前端重炮负责直射；两种火力占独立高度，水冷柱留在火炮后。',siege([C('mortar',3,5),C('mortar',3,7),C('water',4,9)],[C('cannon_heavy',6,12),C('cannon_m',8,12),...plates(9,[12,13,14])])],
 ['攻城蓄压炮台','turtle','臼炮与抛射架集中顶部，蓄压罐支持齐射时动力峰值；保持前甲，故意保留炮兵近身盲区。',siege([C('mortar',3,5),C('mortar',3,7),C('rocket_rack',4,9)],[A(8,12),A(8,13),A(6,12),A(6,13),C('pressure_tank',5,3)])],
 ['攻城四臼堡','turtle','屋顶双大臼、双小臼作连续射击，前沿仅配置机炮自卫；上部台阶清楚，不封住高抛射界。',siege([C('mortar',3,5),C('mortar',3,7),C('mortar_s',5,9),C('mortar_s',5,10)],[C('mg',6,12),C('cannon_m',8,12),...plates(9,[12,13])])]
],'规划乌兹钢锭尚非库存物品，本批改提乌兹钢高抛火炮×1；不借用以太巨炮。');
// 差分机：火力网络与低机组分层，双联机枪位于最前方，重炮有独立通道。
function engine(roof,front){return [...tracks([1,3,5,7,9,11,13]),C('boiler_l',7,2),C('water_l',7,5),C('boiler',8,8),
 C('cockpit',6,8),C('cockpit',8,10),A(6,10),A(6,11),A(8,12),R(6,10),R(8,12),C('water',5,6),
 C('boiler',5,4),C('boss_core',7,11),...roof,...front];}
add(4,5,[
 ['差分机齐射矩阵','counter','双四人舱分别指挥前方双联机枪、机炮和中炮，顶置双高抛越过货箱；锅炉与水箱构成连续低平台。',engine([C('mortar',3,4),C('mortar',3,6)],[C('mg2',4,12),C('mg',6,12),C('cannon_m',8,13),C('cannon_m',9,13)])],
 ['差分机火箭网','turtle','双联机枪守上层、机炮守中层；顶部抛射架与臼炮分工，火力网优先覆盖货箱后目标。',engine([C('rocket_rack',3,4),C('mortar',3,6)],[C('mg2',4,12),C('mg',6,12),C('cannon_m',8,13),C('cannon_m',9,13)])],
 ['差分机重炮网','counter','重炮放在上前角，双联机枪在下层；顶部臼炮形成曲直配合，避免所有武器叠成一根高柱。',engine([C('mortar',3,4),C('mortar',3,6)],[C('cannon_heavy',4,12),C('mg2',6,12),C('cannon_m',8,13),C('cannon_m',9,13)])],
 ['差分机牵引网','wander','鱼叉与双联机枪、机炮组合，牵引目标出掩体；水冷与备用驾驶舱让多组武器持续工作。',engine([C('rocket_rack',3,4),C('water',3,6)],[C('mg2',4,12),C('mg',6,12),C('harpoon',8,13),C('cannon_m',9,13)])],
 ['差分机三线炮网','turtle','上层双联机枪、下方三层中炮，后部高抛压制；相同一体机组中比较少量重弹与高频齐射。',engine([C('mortar',3,4),C('rocket_rack',3,6)],[C('mg2',4,12),C('cannon_m',6,12),C('cannon_m',7,12),C('cannon_m',8,13),C('cannon_m',9,13)])]
],'乌兹钢双联机枪×1固定奖励提案；未实施的材料锭、工艺与剧情仍不伪装为已发放物品。');
// 第五章首关：真实蒸汽人重腿，双机炮同侧错层；供汽与冷却专项改造只用于双足。
function steamman(top,waist='water',refit=2){return [C('biped',8,8,5,3,{unique:'biped:steamman',look:'steamman',refit}),
 C('water',8,6,5,3,{refit:2}),C(waist,8,10,5,3,{refit:2}),C('boiler',6,6,5,3,{refit:3}),
 C('cockpit',6,8),C('mg',6,10),C('water',4,6,5,3,{refit:2}),C('cockpit',4,8),C('mg',4,10),C('harpoon',3,10),...top];}
add(5,0,[
 ['草原套索枪手','kite','蒸汽人重腿承托双层机炮，肩部鱼叉拉住目标；两侧腰箱压低重心，使用承重二级改造。',steamman([])],
 ['草原双套索','kite','双鱼叉位于不同高度，双机炮维持覆盖；背包水冷改造保障持续交战。',steamman([C('harpoon',2,10)])],
 ['草原炮骑兵','wander','肩顶增加一门中炮提供穿甲，双机炮和鱼叉仍是主体；腰胯水箱与背包围绕腿轴布置。',steamman([C('cannon_m',2,10)])],
 ['草原弧射手','counter','背包顶端小臼補充曲射，维持双机炮与套索；保留蒸汽人原始外观而不改模块美术。',steamman([C('mortar_s',3,6)])],
 ['草原护胸型','kite','顶部轻甲覆盖备用指挥舱，鱼叉单独伸出肩线；以防护代替额外炮塔，保留紧凑双足轮廓。',steamman(plates(3,[7,8,9],5))]
],'真实唯一蒸汽人列为可选缴获提案，部件存活时才可能选取；不改其原支线登记。');
// 黑龙：一件真实唯一黑龙四足加连续普通四足，火焰喷口分层，抛射架在背部。
function dragon(roof,front){return [C('quad',10,0,6,3,{unique:'quad:dragon',look:'dragon'}),...quads([4,8,12]),
 C('boiler_l',7,3),C('water_l',7,6),C('cockpit',8,9),C('cockpit',6,9),A(6,11),A(8,11),R(6,11),R(8,11),
 C('water',5,7),C('boiler',5,5),A(8,2),...roof,...front];}
add(5,1,[
 ['黑龙熔炉','rush','真实黑龙四足串联成低宽龙身，两层喷火器守正面，背部抛射架越过矿坑遮挡；重甲围住驾驶舱。',dragon([C('rocket_rack',3,5),C('mortar',3,7)],[C('flamer',8,12),C('flamer',9,12),A(6,12),A(6,13)])],
 ['黑龙火雨','rush','双背部抛射架与双喷火器兼顾远近，前甲形成短鼻；唯一黑龙只保留一件，其余为普通乌兹四足。',dragon([C('rocket_rack',3,5),C('rocket_rack',3,7)],[C('flamer',8,12),C('flamer',9,12),A(6,12),A(6,13)])],
 ['黑龙猎叉','rush','两层火焰之外加入鱼叉，把目标留在喷口范围；后背保留抛射架，前缘炮口不被甲板遮挡。',dragon([C('rocket_rack',3,5),C('water',3,7)],[C('harpoon',7,12),C('flamer',8,12),C('flamer',9,12),...plates(6,[12,13])])],
 ['黑龙重颚','rush','前上方中炮补穿甲，两层喷火器继续压迫近身；抛射与高抛成对置于龙背。',dragon([C('rocket_rack',3,5),C('mortar',3,7)],[C('cannon_m',7,12),C('flamer',8,12),C('flamer',9,12),...plates(6,[12,13])])],
 ['黑龙冷凝堡','counter','减少一门高抛换成大水冷背包，双喷火与抛射架构成三组核心武器；侧散热柱保护前甲。',dragon([C('rocket_rack',3,5),C('water',3,7)],[C('flamer',8,12),C('flamer',9,12),A(6,12),A(6,13)])]
],'真实唯一黑龙为可选缴获；仅该底盘用以太6，普通装备上限乌兹5，不把全车静默升至以太。');
// 舞者：单对普通双足，高速路线使用三级承重改造并减轻非关键件耐久升级；撞角贴胯，枪口仍在上身。
function dancer(top,refit=3){return [C('biped',8,8,5,0,{refit}),C('spike',8,10),C('water',8,6,5,0,{refit:2}),
 C('boiler',6,6,5,1,{refit:3}),C('cockpit',6,8),C('mg2',6,10,5,1),C('water',4,6,5,0,{refit:2}),
 C('cockpit',4,8,5,1),C('mg2',4,10,5,1),...top];}
add(5,2,[
 ['舞者双枪燕尾','rush','双联机枪上下错层，撞角直接贴胯；背水与前方撞角配平，保留高速双足的紧凑燕尾形。',dancer([])],
 ['舞者穿甲步','rush','肩顶中炮补穿甲，双联机枪和撞角保持近身压制；三级承重改造后仍保留双足速度优势。',dancer([C('cannon_m',3,10)])],
 ['舞者牵引步','rush','肩顶鱼叉留住目标，随后撞角前冲；机组分置腿轴前后，整车不加厚重外围甲。',dancer([C('harpoon',3,10)])],
 ['舞者弧线步','wander','背部小臼提供越障火力，双联机枪覆盖追击；同一撞角让玩家比较迂回与直接冲锋。',dancer([C('mortar_s',3,6)])],
 ['舞者银肩步','rush','给驾驶舱上方加短肩甲，枪口保持裸露；不用额外火炮，以轻防护保住冲锋指挥链。',dancer(plates(3,[8,9],4))]
],'无实际模块的乌兹钢锭规划改为乌兹双联机枪×1提案。提速、跳跃新件尚无本批解锁来源，因此不擅自装入。');
// 寡妇复仇：前置真实液压撞头、上部直射与高抛，沿用第一章寡妇的火力语言。
function widow(roof,front){return [...tracks([1,3,5,7,9,11]),C('boss_ram',10,13,5,3,{unique:'boss_ram'}),
 C('boiler_l',7,2),C('water_l',7,5),C('cockpit',8,8),C('cockpit',6,8),A(8,10),A(6,10),R(8,10),R(6,10),
 C('boiler',5,4),C('water',5,6),...roof,...front];}
add(5,3,[
 ['煤灰寡妇复仇炮车','rush','继承第一章寡妇的顶置高抛，乌兹钢机组装在低平台；真实液压撞头在履带最前端，重炮有独立射界。',widow([C('mortar',3,4),C('mortar',3,6)],[C('cannon_heavy',6,11),C('cannon_m',8,11),C('cannon_m',9,11)])],
 ['寡妇火雨复仇','counter','高抛与抛射架负责越过工厂障碍，前重炮凿甲；撞头维持接敌后的反击能力。',widow([C('mortar',3,4),C('rocket_rack',3,6)],[C('cannon_heavy',6,11),C('cannon_m',8,11),C('cannon_m',9,11)])],
 ['寡妇三层齐射','rush','中炮分三层排在前甲外，双高抛在后背；比重炮版更强调连续齐射与撞击。',widow([C('mortar',3,4),C('mortar',3,6)],[C('mg2',6,11),C('cannon_m',8,11),C('cannon_m',9,11),C('cannon_m',5,11),...plates(5,[8,9,10])])],
 ['寡妇套索撞槌','rush','鱼叉拉近目标后由液压撞头接手，重炮与高抛仍提供主伤害；保持旧寡妇的前低后高轮廓。',widow([C('mortar',3,4),C('mortar',3,6)],[C('cannon_heavy',6,11),C('harpoon',8,11),C('cannon_m',9,11)])],
 ['寡妇冷却护卫','counter','一门高抛加储水背包，降低持续交火的冷却压力；重炮、中炮与撞头组成稳健三段攻击。',widow([C('mortar',3,4),C('water',3,6)],[C('cannon_heavy',6,11),C('cannon_m',8,11),C('cannon_m',9,11)])]
],'唯一液压撞头可选缴获提案，使用已注册身份且每车恰好一件。');
// 寿辰前夜：银色茶点履带车，刻意小水罐薄甲，机组不是假装可靠的决赛重车。
function tea(extra,top='cockpit_pair'){return [...tracks([4,6,8,10],4),C('boiler',8,4,4),C('tank_s',9,6,4),C('tank_s',9,7,4),
 C('cockpit',8,8,4),A(8,10,4,0),C('flamer',8,11,4),C('harpoon',9,11,4),C(top,6,8,4),...extra];}
add(5,4,[
 ['寿辰银盘茶车','rush','镀镍低履带茶车，喷火器与鱼叉藏在服务台前；仅两个小水罐，拖久后热量是明确弱点。',tea([])],
 ['寿辰双层茶车','rush','第二层服务台放备用四人舱，保留少水和薄甲；前端双层喷口与鱼叉呈整齐横线。',tea([C('flamer',7,11,4),...plates(7,[10],4)],'cockpit')],
 ['寿辰热壶茶车','wander','茶壶般的顶部小锅炉提供动力，但水量仍有限；鱼叉拉近、喷火骚扰，不作为重甲攻坚方案。',tea([C('boiler_s',6,7,4)])],
 ['寿辰银盖茶车','rush','上方加短镀镍甲盖与单人观察舱，轮廓更低；服务台前仍保留鱼叉与喷火。',tea([C('helmet',7,6,4),...plates(7,[4,5],4)])],
 ['寿辰小炮茶车','counter','鱼叉与喷火之外加一门小炮，作为管家临时加装的武装服务车；水少甲薄的关卡弱点保留。',tea([C('cannon_s',7,11,4),...plates(7,[9,10],4)])]
],'履带茶点车没有风箱腿，不虚填唯一掉落；补镀镍喷火器×1固定奖励提案。全修、风箱腿和决赛情报仍为待实现剧情规划。');
// 女王号：六层完整轮廓，唯一巨炮坐在两列机组之上；普通件乌兹5，巨炮以太6。
function queen(roof,front){return [...tracks([0,2,4,6,8,10,12,14]),C('boiler_l',7,1),C('water_l',7,4),C('boiler_l',7,7),
 C('water',8,10),C('cockpit',8,12),A(8,14),A(8,15),R(8,14),C('water',5,4),C('cockpit',5,6),
 C('water',5,8),C('cockpit',6,10),A(6,12),A(6,13),R(6,12),C('cannon_giant',0,6,6,3,{unique:'cannon_giant'}),
 C('boss_core',7,6),...plates(4,[6,7,8,9]),...roof,...front];}
add(5,5,[
 ['女王号加冕堡垒','turtle','完整六层炮堡：以太巨炮坐正中上层，乌兹重炮守前缘，双大锅炉配三组水冷支撑；仅呈现单阶段车辆。',queen([C('mortar',3,4)],[C('cannon_heavy',4,13),C('cannon_m',6,14),C('cannon_m',7,14)])],
 ['女王号皇家火雨','turtle','巨炮与双臼构成高抛主群，前缘双联机枪守近距离；巨炮顶部留空，底座构成六层轮廓。',queen([C('mortar',3,4),C('mortar',4,10)],[C('mg2',4,13),C('cannon_m',6,14),C('cannon_m',7,14)])],
 ['女王号重炮王冠','counter','巨炮之外以前方重炮、中炮与鱼叉形成曲直配合；双大锅炉藏在底层，玩家仍可绕开高抛落点攻击机组。',queen([C('rocket_rack',3,4)],[C('cannon_heavy',4,13),C('harpoon',6,14),C('cannon_m',7,14)])],
 ['女王号长战堡垒','turtle','巨炮配大容量分散储水，减少屋顶副炮而增加续航；前缘重炮保持威胁，主锅炉仍是可破坏弱点。',queen([C('water',3,4)],[C('cannon_heavy',4,13),C('cannon_m',6,14),C('cannon_m',7,14)])],
 ['女王号四组军乐','counter','巨炮、重炮、双联机枪与中炮分组，低层双驾驶舱指挥；巨炮唯一身份保真，不假装已有两阶段切换机制。',queen([C('mortar',3,4),C('mg2',2,10),C('water',4,10)],[C('cannon_heavy',4,13),C('cannon_m',6,14),C('cannon_m',7,14)])]
],'唯一以太巨炮为可选缴获；以太结晶与两阶段决赛仍属规划，本批只提供现有引擎可运行的单阶段候选。');
for(const data of stages){
  const[ch,st]=data.stageId.split(':').map(Number),dir=path.join(root,`chapter-${ch}`);
  fs.mkdirSync(path.join(dir,'results'),{recursive:true});
  fs.writeFileSync(path.join(dir,`ch${ch}-0${st+1}-candidates.json`),JSON.stringify(data,null,2));
}
console.log(JSON.stringify({stages:stages.length,candidates:stages.reduce((n,s)=>n+s.candidates.length,0),process:'显式设计清单，无搜索'}));
