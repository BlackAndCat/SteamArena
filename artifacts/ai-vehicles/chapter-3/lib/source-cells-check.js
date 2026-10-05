/* 第三章源结构保真入口：复用已验证的公共检查，输出固定到本章目录。 */
'use strict';
const path = require('path');
process.argv[2] = path.resolve(__dirname,'..');
process.argv[3] = path.join(__dirname,'design-check.js');
require('../../chapter-2/lib/source-cells-check.js');
