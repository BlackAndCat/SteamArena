/* 第四章薄入口：隔离提案规格，复用真实构筑与固定种子战斗。 */
'use strict';
const common=require('../../chapter-2/lib/design-check.js');
const {stageSpecForCandidate,additionalConditions}=require('../../lib/planned-spec.js');
if(require.main===module)common.main({stageSpecForCandidate,additionalConditions,includeReferenceSnapshot:true});
module.exports={...common,stageSpecForCandidate,additionalConditions};
