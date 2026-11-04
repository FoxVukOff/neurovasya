/* Смоук-тест сайта v2 (jsdom): главная, режим ожидания плеера, невышедшая серия.
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

async function load(file) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) console.log('   [jsdomError]', e.message); });
  vc.on('error', (m) => console.log('   [console.error]', m));
  return JSDOM.fromFile(path.join(ROOT, file), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    url: 'http://localhost:8001/' + file,
    beforeParse: stubCanvas
  });
}

/* провал пробы видео: кидаем error на каждую попытку src → уходим в ожидание */
async function forceStandby(win) {
  const d = win.document;
  for (let i = 0; i < 4; i++) {
    const v = d.getElementById('video');
    if (v.getAttribute('src')) v.dispatchEvent(new win.Event('error'));
    await sleep(120);
  }
  await sleep(250);
}

console.log('index.html');
{
  const dom = await load('index.html');
  await sleep(600);
  const d = dom.window.document;
  ok(d.querySelectorAll('#grid .ep-card').length === 16, 'сетка 2 сезона: 16 карточек');
  ok(d.querySelectorAll('#ctaRow .btn').length >= 2, 'CTA-кнопки в афише');
  ok(d.querySelectorAll('#sched .sched-week').length === 4, 'расписание: 4 недели');
  ok(d.querySelectorAll('#sched .sched-cell').length === 16, 'расписание: 16 слотов эфира');
  ok(d.querySelectorAll('#cast .cast-card').length === 4, 'блок актёров: 4 карточки');
  ok(d.querySelectorAll('.status-board .sb-row').length === 4, 'статус-борд: 4 строки');
  ok(/FoxVuk\/dhhadhshjjdkahddas/.test(d.querySelector('.status-board').textContent), 'в статус-борде указано хранилище HF');
  const NV = dom.window.NV;
  const todayE = NV.list(2).find((q) => q.status === 'today');
  const cards = [...d.querySelectorAll('#grid .ep-card')];
  if (todayE) ok(/сегодня/.test(cards[todayE.e - 1].querySelector('.st').textContent), `серия ${todayE.e} помечена «сегодня в 20:00»`);
  else ok(!d.querySelector('#grid .st.today'), 'сегодня эфира нет — карточек «сегодня» нет');
  d.querySelector('.tab[data-s="1"]').click();
  ok(d.querySelectorAll('#grid .ep-card').length === 20, 'переключение на 1 сезон: 20 карточек');
  dom.window.close();
}

console.log('season-2/episode-02.html (режим ожидания)');
{
  const dom = await load('season-2/episode-02.html');
  const win = dom.window, d = win.document;
  await sleep(400);
  await forceStandby(win);
  const stage = d.getElementById('stage');
  ok(!!win.NV_PLAYER, 'NV_PLAYER инициализирован');
  ok(stage.classList.contains('standby'), 'плеер в режиме ожидания (standby)');
  ok(d.getElementById('timeLbl').textContent === '--:-- / --:--', 'время прочерками: фейкового воспроизведения нет');
  win.NV_PLAYER.toggle(); win.NV_PLAYER.seekBy(60);
  ok(d.getElementById('timeLbl').textContent === '--:-- / --:--', 'до загрузки видео плеер не «играет» и не ошибается');
  ok(d.getElementById('nextUp').classList.contains('hidden'), 'оверлей автоперехода скрыт');
  ok(/режим ожидания/i.test(d.getElementById('spPanel').textContent), 'статус-панель: плеер в ожидании');
  ok(/загружается в хранилище/i.test(d.getElementById('spPanel').textContent), 'статус-панель: видео загружается');
  ok(d.querySelectorAll('#strip .ep-card').length === 16, 'лента сезона: 16 серий');
  ok(/Сезон 2 · Серия 2/.test(d.getElementById('epFacts').textContent), 'факты серии заполнены');
  ok(d.getElementById('topLabel').textContent.includes('S2E2'), 'подпись сверху S2E2');
  ok(win.localStorage.getItem('nv:pos:2:2') === null, 'в ожидании позиция не сохраняется');
  dom.window.close();
}

console.log('season-2/episode-10.html (ещё не вышла)');
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
