/* Смоук-тест сайта в jsdom: главная, страница серии (заглушка), невышедшая серия.
   Запуск: npm i jsdom && node tools/smoke-test.mjs            */
import { JSDOM, VirtualConsole } from 'jsdom';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(path.dirname(path.resolve(url.fileURLToPath(import.meta.url))));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) fails++; };

function stubCanvas(win) {
  const ctx = new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return null;
      if (p === 'createLinearGradient') return () => ({ addColorStop() {} });
      return typeof p === 'string' ? (t[p] !== undefined ? t[p] : () => {}) : undefined;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
  win.HTMLCanvasElement.prototype.getContext = () => ctx;
}

async function load(file, { search = '' } = {}) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) console.log('   [jsdomError]', e.message); });
  vc.on('error', (m) => console.log('   [console.error]', m));
  const dom = await JSDOM.fromFile(path.join(ROOT, file), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    url: 'http://localhost:8000/' + file + search,
    beforeParse: stubCanvas
  });
  return dom;
}

/* ---------- главная ---------- */
console.log('index.html');
{
  const dom = await load('index.html');
  await sleep(600);
  const d = dom.window.document;
  ok(d.querySelectorAll('#grid .ep-card').length === 16, 'сетка 2 сезона: 16 карточек');
  ok(d.querySelectorAll('#ctaRow .btn').length >= 2, 'CTA-кнопки в hero');
  ok(d.getElementById('continueSec').classList.contains('hidden'), 'блок «продолжить» скрыт до просмотра');
  const NV = dom.window.NV;
  const todayE = NV.list(2).find((q) => q.status === 'today');
  const cards = [...d.querySelectorAll('#grid .ep-card')];
  if (todayE) {
    ok(/сегодня/.test(cards[todayE.e - 1].querySelector('.st').textContent), `серия ${todayE.e} помечена «сегодня в 20:00»`);
  } else {
    ok(!d.querySelector('#grid .st.today'), 'сегодня эфира нет — карточек «сегодня» нет');
  }
  d.querySelector('.tab[data-s="1"]').click();
  ok(d.querySelectorAll('#grid .ep-card').length === 20, 'переключение на 1 сезон: 20 карточек');
  dom.window.close();
}

/* ---------- страница серии (вышедшая) ---------- */
console.log('season-2/episode-02.html');
{
  const dom = await load('season-2/episode-02.html');
  const win = dom.window, d = win.document;
  await sleep(400);
  /* ускоряем провал пробы видео: кидаем error на каждую попытку src */
  for (let i = 0; i < 4; i++) {
    const v = d.getElementById('video');
    if (v.getAttribute('src')) v.dispatchEvent(new win.Event('error'));
    await sleep(120);
  }
  await sleep(300);
  const stage = d.getElementById('stage');
  ok(!!win.NV_PLAYER, 'NV_PLAYER инициализирован');
  ok(stage.classList.contains('demo'), 'включён режим заглушки (demo)');
  ok(/24:00/.test(d.getElementById('timeLbl').textContent), 'длительность заглушки 24:00');
  ok(d.querySelectorAll('#strip .ep-card').length === 16, 'лента сезона: 16 серий');
  ok(/Сезон 2 · Серия 2/.test(d.getElementById('epFacts').textContent), 'факты серии заполнены');
  ok(d.getElementById('topLabel').textContent.includes('S2E2'), 'подпись сверху S2E2');

  ok(!stage.classList.contains('paused'), 'автозапуск заглушки после загрузки');
  win.NV_PLAYER.toggle();                       // pause
  await sleep(150);
  ok(stage.classList.contains('paused'), 'пауза работает');
  win.NV_PLAYER.toggle();                       // play
  await sleep(150);
  ok(!stage.classList.contains('paused'), 'воспроизведение идёт');
  win.NV_PLAYER.seekBy(60);
  ok(/01:0\d/.test(d.getElementById('timeLbl').textContent), 'перемотка +60 c');
  win.NV_PLAYER.seekPercent(50);
  ok(/12:0/.test(d.getElementById('timeLbl').textContent), 'перемотка к 50%');
  ok(JSON.parse(win.localStorage.getItem('nv:pos:2:2')).t > 60, 'позиция сохранена в localStorage');
  ok(JSON.parse(win.localStorage.getItem('nv:last')).e === 2, 'последняя серия сохранена');

  /* автопереход: доматываем до конца */
  win.NV_PLAYER.seekPercent(100);
  await sleep(900);
  ok(!d.getElementById('nextUp').classList.contains('hidden'), 'оверлей автоперехода показан в конце');
  ok(/Серия 3/.test(d.getElementById('nextUp').textContent), 'в оверлее следующая серия 3');
  ok(JSON.parse(win.localStorage.getItem('nv:pos:2:2')).done === true, 'серия помечена просмотренной');
  const lastAfter = JSON.parse(win.localStorage.getItem('nv:last') || 'null');
  const nextAired = win.NV.status(2, 3) !== 'soon';
  ok(nextAired ? (lastAfter && lastAfter.e === 3) : lastAfter === null,
     nextAired ? '«последняя» сдвинулась на серию 3' : 'следующая не вышла — «последняя» сброшена');
  dom.window.close();
}

/* ---------- невышедшая серия ---------- */
console.log('season-2/episode-10.html');
{
  const dom = await load('season-2/episode-10.html');
  await sleep(400);
  const d = dom.window.document;
  ok(d.getElementById('stage').classList.contains('locked'), 'плашка «серия ещё не вышла»');
  ok(/17 ноября/.test(d.getElementById('lockedPanel').textContent), 'указана дата эфира 17 ноября');
  dom.window.close();
}

console.log(fails ? `\nFAIL: ${fails}` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
