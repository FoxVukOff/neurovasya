/* Смоук-тест сайта v3 (jsdom): главная, idle-плеер без видео, статус-панели, невышедшая серия.
   Запуск: npm i jsdom && node tools/smoke-test.mjs            */
import { JSDOM, VirtualConsole } from 'jsdom';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(path.dirname(path.resolve(url.fileURLToPath(import.meta.url))));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* ждём, пока jsdom реально загрузит и выполнит скрипты страницы (без гонок с холодным сервером) */
async function until(dom, cond, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (cond(dom.window)) return true; } catch (e) {}
    await sleep(150);
  }
  return false;
}
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) fails++; };

function stubEnv(win) {
  /* без fetch: все кандидаты «не существуют» → плеер обязан уйти в idle с панелью */
  try { Object.defineProperty(win, 'fetch', { value: undefined, writable: true, configurable: true }); } catch (e) {}
}

async function load(file) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) console.log('   [jsdomError]', e.message); });
  vc.on('error', (m) => console.log('   [console.error]', m));
  return JSDOM.fromFile(path.join(ROOT, file), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    url: 'http://localhost:8001/' + file,
    virtualConsole: vc, beforeParse: stubEnv
  });
}

/* провал пробы играбельности: кидаем error на каждый пробный <video> → уходим в idle */
async function forceFailProbe(win) {
  const d = win.document;
  for (let i = 0; i < 10; i++) {
    d.querySelectorAll('video').forEach((v) => {
      if (v.getAttribute('src')) v.dispatchEvent(new win.Event('error'));
    });
    await sleep(110);
  }
  await sleep(250);
}

console.log('index.html');
{
  const dom = await load('index.html');
  ok(await until(dom, (w) => w.NV && w.document.querySelectorAll('#grid .ep-card').length > 0), 'скрипты главной загрузились');
  const d = dom.window.document;
  ok(d.querySelectorAll('#grid .ep-card').length === 16, 'сетка 2 сезона: 16 карточек');
  ok(d.querySelectorAll('#ctaRow .btn').length >= 2, 'CTA-кнопки в афише');
  ok(d.querySelectorAll('#sched .sched-week').length === 4, 'расписание: 4 недели');
  ok(d.querySelectorAll('#sched .sched-cell').length === 16, 'расписание: 16 слотов эфира');
  ok(d.querySelectorAll('#cast .cast-card').length === 4, 'блок актёров: 4 карточки');
  ok(d.querySelectorAll('.status-board .sb-row').length === 4, 'статус-борд: 4 строки');
  ok(!/huggingface|FoxVuk/i.test(d.body.textContent), 'на главной нет упоминаний Hugging Face');
  ok(!!d.getElementById('btnRefresh'), 'кнопка «Обновить» (Ctrl+F5) на главной');
  ok(!d.querySelector('.logo .emblem'), 'эмблемы-щита в логотипе нет (фан-сайт, не официальный ТНТ)');
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
  ok(await until(dom, (w) => !!w.NV_PLAYER), 'скрипты страницы серии загрузились');
  await forceFailProbe(win);
  const stage = d.getElementById('stage');
  ok(!!win.NV_PLAYER, 'NV_PLAYER инициализирован');
  ok(stage.classList.contains('idle'), 'плеер в idle: играть нечего');
  ok(d.getElementById('demoCanvas') === null, 'canvas-заглушки нет');
  const panel = d.getElementById('statePanel');
  ok(panel && !panel.classList.contains('hidden'), 'статус-панель видна');
  ok(/ещё не загружено/.test(panel.textContent), 'панель: «Видео серии ещё не загружено»');
  ok(/включится сам/.test(panel.textContent), 'панель: обещание автоактивации');
  ok(d.getElementById('fmtChip').classList.contains('hidden'), 'чип формата скрыт, пока нечего играть');
  ok(d.getElementById('timeLbl').textContent === '--:-- / --:--', 'время прочерками: фейкового воспроизведения нет');
  win.NV_PLAYER.toggle(); win.NV_PLAYER.seekBy(60);
  ok(d.getElementById('timeLbl').textContent === '--:-- / --:--', 'до загрузки видео плеер не «играет» и не ошибается');
  ok(d.getElementById('nextUp').classList.contains('hidden'), 'оверлей автоперехода скрыт');
  ok(/режим ожидания/i.test(d.getElementById('spPanel').textContent), 'статус-панель: плеер в ожидании');
  ok(/облачное хранилище|найден, но этот браузер/i.test(d.getElementById('spPanel').textContent), 'статус-панель: строка видео в честном статусе');
  ok(!/huggingface|FoxVuk/i.test(d.body.textContent), 'на странице серии нет упоминаний Hugging Face');
  ok(!!d.getElementById('btnRefresh'), 'кнопка «Обновить» (Ctrl+F5) на месте');
  ok(d.querySelectorAll('#strip .ep-card').length === 16, 'лента сезона: 16 серий');
  ok(/Сезон 2 · Серия 2/.test(d.getElementById('epFacts').textContent), 'факты серии заполнены');
  ok(d.getElementById('topLabel').textContent.includes('S2E2'), 'подпись сверху S2E2');
  ok(win.localStorage.getItem('nv:pos:2:2') === null, 'в ожидании позиция не сохраняется');
  dom.window.close();
}

console.log('season-2/episode-10.html (ещё не вышла)');
{
  const dom = await load('season-2/episode-10.html');
  await until(dom, (w) => !!w.NV_PLAYER);
  const d = dom.window.document;
  ok(d.getElementById('stage').classList.contains('idle'), 'стадия idle до эфира');
  const p10 = d.getElementById('statePanel');
  ok(p10 && !p10.classList.contains('hidden'), 'панель «серия ещё не вышла» видна');
  ok(/ещё не вышла/.test(p10.textContent), 'панель: «Серия ещё не вышла»');
  ok(/17 ноября/.test(p10.textContent), 'указана дата эфира 17 ноября');
  ok(d.querySelector('video').hidden === true, 'видео скрыто до эфира');
  dom.window.close();
}

console.log(fails ? `\nFAIL: ${fails}` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
