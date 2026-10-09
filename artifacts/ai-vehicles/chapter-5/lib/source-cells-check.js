/* 第5章源结构保真入口：检查真实已落稿候选，结果只写入本章。 */
'use strict';
const path=require('path');
process.argv[2]=path.resolve(__dirname,'..');
process.argv[3]=path.join(__dirname,'design-check.js');
require('../../chapter-2/lib/source-cells-check.js');

