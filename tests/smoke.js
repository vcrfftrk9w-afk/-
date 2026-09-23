// быстрая проверка: все модули загрузились и объявили свои глобальные объекты
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  const errors=[]; p.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  p.on('console',m=>{ if(m.type()==='error'&&!m.text().includes('ERR_')) errors.push('CONSOLE: '+m.text()); });
  await p.goto('http://localhost:8792/index.html');
  await p.waitForTimeout(2200);
  const mods = await p.evaluate(()=>{
    const check = (n) => { try { return eval('typeof ' + n) !== 'undefined' ? 'ok' : 'НЕТ'; } catch(e) { return 'НЕТ'; } };
    return ['Icons','Data','State','Sound','Music','FX','UI','Screens','Advisor','Palette','App','Path','Track','Planner','DayTpl','Chill','Verdict','Week','Cloud'].map(n => n+':'+check(n)).join(' ');
  });
  console.log(mods);
  console.log('ERRORS:', errors.length ? JSON.stringify(errors) : 'нет');
  await b.close();
  process.exit(errors.length ? 1 : 0);
})();
