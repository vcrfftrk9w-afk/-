// Компилирует все .luau файлы проекта (код пишется на общем подмножестве Lua/Luau).
'use strict';
const fs = require('fs');
const path = require('path');
const { checkSyntax } = require('./lua.js');

const SRC = path.join(__dirname, '..', 'src');
let bad = 0, total = 0;
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.luau')) {
      total++;
      const err = checkSyntax(p);
      if (err) {
        bad++;
        console.log('ОШИБКА', path.relative(SRC, p), err);
      }
    }
  }
})(SRC);
console.log(`файлов: ${total}, с ошибками: ${bad}`);
process.exit(bad ? 1 : 0);
