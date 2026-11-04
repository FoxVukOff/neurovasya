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

async function load(file, seed) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) console.log('   [jsdomError]', e.message); });
  vc.on('error', (m) => console.log('   [console.error]', m));
  return JSDOM.fromFile(path.join(ROOT, file), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    url: 'http://localhost:8001/' + file,
    virtualConsole: vc,
    beforeParse: (win) => { stubEnv(win); if (seed) seed(win); }
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

console.log('index.html (прогресс есть → кнопка общего сброса)');
{
  const dom = await load('index.html', (win) => {
    win.localStorage.setItem('nv:pos:1:1', JSON.stringify({ t: 600, d: 1500, done: true }));
    win.localStorage.setItem('nv:pos:1:2', JSON.stringify({ t: 60, d: 1500, done: false }));
    win.localStorage.setItem('nv:last', JSON.stringify({ s: 1, e: 2, t: 60 }));
  });
  ok(await until(dom, (w) => w.NV && w.document.querySelectorAll('#grid .ep-card').length > 0), 'скрипты главной загрузились');
  const d = dom.window.document;
  ok(d.querySelectorAll('#grid .ep-card').length === 16, 'сетка 2 сезона: 16 карточек');
  ok(d.querySelectorAll('#ctaRow .btn').length >= 2, 'CTA-кнопки в афише');
  ok(d.querySelectorAll('#sched .sched-week').length === 6, 'расписание Okko: 6 выпусков по 3 серии');
  ok(d.querySelectorAll('#sched .sched-cell').length === 16, 'расписание: 16 слотов эфира');
  ok(d.querySelectorAll('#cast .cast-card').length === 4, 'блок актёров: 4 карточки');
  ok(d.querySelectorAll('.status-board .sb-row').length === 4, 'статус-борд: 4 строки');
  ok(!/huggingface|FoxVuk/i.test(d.body.textContent), 'на главной нет упоминаний Hugging Face');
  ok(!!d.getElementById('btnRefresh'), 'кнопка «Обновить» (Ctrl+F5) на главной');
  ok(!d.querySelector('.logo .emblem'), 'эмблемы-щита в логотипе нет (фан-сайт, не официальный ТНТ)');
  const NV = dom.window.NV;
  ok(NV.isLocked(2, 10) === true && NV.isLocked(2, 3) === false, 'блокировка 2 сезона: 7–16 заблокированы, 1–6 нет');
  ok(NV.isAwaitingUpload(2, 3) === true && NV.isAwaitingUpload(1, 3) === false, 'серии 2×01–06 в плане «скоро загрузится»');
  const s2cards = [...d.querySelectorAll('#grid .ep-card')];
  ok(s2cards.length === 16 && s2cards.slice(0, 6).every((c) => /скоро загрузится/.test(c.textContent)), 'карточки 2×01–06: «скоро загрузится»');
  ok(s2cards.slice(6).every((c) => /на серверах не скоро/.test(c.textContent)), 'карточки 2×07–16: «на серверах не скоро»');
  ok([...d.querySelectorAll('#sched .sched-cell .st')].some((el) => /сегодня/.test(el.textContent)) ||
     !NV.list(2).some((q) => q.status === 'today'), 'в расписании слот «сегодня» отмечен');
  d.querySelector('.tab[data-s="1"]').click();
  const s1cards = [...d.querySelectorAll('#grid .ep-card')];
  ok(s1cards.length === 20, 'переключение на 1 сезон: 20 карточек');
  ok(s1cards.every((c) => !/не скоро|скоро загрузится/.test(c.textContent)), '1 сезон без серверных плашек');
  ok(/Продолжить: S1E2/.test(d.getElementById('ctaRow').textContent), 'CTA «Продолжить» из посева');

  /* общий сброс прогресса: два клика (подтверждение) */
  const ra = d.getElementById('btnResetAll');
  ok(ra && !ra.classList.contains('hidden'), 'кнопка «Сбросить весь прогресс» видна, когда прогресс есть');
  ra.click();
  ok(/Точно/.test(ra.textContent), 'первый клик — подтверждение «Точно сбросить всё?»');
  ok(ra.classList.contains('danger'), 'кнопка подтверждения выделена');
  ra.click();
  const ls = dom.window.localStorage;
  ok(ls.getItem('nv:pos:1:1') === null && ls.getItem('nv:pos:1:2') === null && ls.getItem('nv:last') === null,
     'второй клик — весь прогресс удалён из хранилища');
  ok(/Готово/.test(ra.textContent), 'сообщение «Готово» после сброса');
  ok(!/Продолжить: S1E2/.test(d.getElementById('ctaRow').textContent), 'CTA «Продолжить» убрано');
  ok(d.getElementById('continueSec').classList.contains('hidden'), 'секция «Продолжить просмотр» скрыта');
  await sleep(1900);
  ok(ra.classList.contains('hidden'), 'после сброса кнопка скрыта (сбрасывать нечего)');
  ok(!d.querySelector('#grid .ep-card.watched'), 'сетка: отметок «просмотрено» не осталось');
  dom.window.close();
}

console.log('season-2/episode-02.html (скоро загрузится на серверы)');
{
  const dom = await load('season-2/episode-02.html');
  const win = dom.window, d = win.document;
  ok(await until(dom, (w) => !!w.NV_PLAYER), 'скрипты страницы серии загрузились');
  await forceFailProbe(win);                  // файла пока нет → карточка «скоро загрузится»
  const stage = d.getElementById('stage');
  ok(stage.classList.contains('idle'), 'плеер в idle, пока файла нет');
  const panel = d.getElementById('statePanel');
  ok(panel && !panel.classList.contains('hidden'), 'статус-карточка видна');
  ok(/скоро загрузится/i.test(panel.textContent), 'карточка: «Скоро загрузится на серверы»');
  ok(/75 секунд/.test(panel.textContent), 'плеер продолжит караулить файл');
  ok(/S1E20/.test(panel.textContent), 'кнопка ведёт на последнюю доступную (S1E20)');
  ok(d.querySelector('video').hidden === true, 'видео скрыто');
  ok(d.getElementById('fmtChip').classList.contains('hidden'), 'чип формата скрыт');
  ok(d.getElementById('timeLbl').textContent === '--:-- / --:--', 'время прочерками');
  win.NV_PLAYER.toggle(); win.NV_PLAYER.seekBy(60);
  ok(d.getElementById('timeLbl').textContent === '--:-- / --:--', 'без файла плеер не «играет» и не ошибается');
  ok(d.getElementById('nextUp').classList.contains('hidden'), 'оверлей автоперехода скрыт');
  ok(/скоро загрузится/i.test(d.getElementById('spPanel').textContent), 'статус-панель: видео скоро загрузится');
  ok(/караулит файл/i.test(d.getElementById('spPanel').textContent), 'статус-панель: плеер караулит файл');
  ok(!/huggingface|FoxVuk/i.test(d.body.textContent), 'на странице серии нет упоминаний Hugging Face');
  ok(!!d.getElementById('btnRefresh'), 'кнопка «Обновить» (Ctrl+F5) на месте');
  ok(d.querySelectorAll('#strip .ep-card').length === 16, 'лента сезона: 16 серий');
  ok(/Сезон 2 · Серия 2/.test(d.getElementById('epFacts').textContent), 'факты серии заполнены');
  ok(d.getElementById('topLabel').textContent.includes('S2E2'), 'подпись сверху S2E2');
  ok(win.localStorage.getItem('nv:pos:2:2') === null, 'позиция не сохраняется');
  ok(d.getElementById('btnResetEp').classList.contains('hidden'), 'сброс серии скрыт: отметки нет');
  dom.window.close();
}

console.log('season-2/episode-07.html (заблокирована: «не скоро»)');
{
  const dom = await load('season-2/episode-07.html');
  const win = dom.window, d = win.document;
  ok(await until(dom, (w) => !!w.NV_PLAYER), 'скрипты страницы серии загрузились');
  const panel = d.getElementById('statePanel');
  ok(d.getElementById('stage').classList.contains('idle'), 'плеер спит (idle)');
  ok(panel && !panel.classList.contains('hidden'), 'статус-карточка видна');
  ok(/ещё не на серверах/i.test(panel.textContent), 'карточка: «Эта серия ещё не на серверах»');
  ok(/не скоро/i.test(panel.textContent), 'карточка: появится «не скоро»');
  ok(/сегодня|ноября/.test(panel.textContent), 'дата выхода на Okko сохранена');
  ok(d.querySelectorAll('video').length === 1 && d.querySelector('video').hidden === true,
     'пробные <video> не создавались — файлы даже не ищутся');
  win.NV_PLAYER.toggle(); win.NV_PLAYER.seekBy(60); win.NV_PLAYER.goNext();
  ok(d.getElementById('timeLbl').textContent === '--:-- / --:--', 'плеер-пустышка безопасен');
  ok(/не скоро/i.test(d.getElementById('spPanel').textContent), 'статус-панель: видео появится не скоро');
  ok(/заблокирован/i.test(d.getElementById('spPanel').textContent), 'статус-панель: плеер заблокирован');
  ok(win.localStorage.getItem('nv:pos:2:7') === null, 'позиция не сохраняется');
  dom.window.close();
}

console.log('season-2/episode-10.html (ещё не вышла + заблокирована: «не скоро»)');
{
  const dom = await load('season-2/episode-10.html');
  await until(dom, (w) => !!w.NV_PLAYER);
  const d = dom.window.document;
  ok(d.getElementById('stage').classList.contains('idle'), 'стадия idle до эфира');
  const p10 = d.getElementById('statePanel');
  ok(p10 && !p10.classList.contains('hidden'), 'статус-карточка видна');
  ok(/ещё не на серверах/i.test(p10.textContent), 'карточка: «ещё не на серверах»');
  ok(/не скоро/i.test(p10.textContent), 'карточка: появится «не скоро»');
  ok(/5 ноября/.test(p10.textContent), 'дата выхода на Okko (5 ноября, пачка 10–12) в карточке');
  ok(d.querySelector('video').hidden === true, 'видео скрыто до эфира');
  dom.window.close();
}

console.log('season-1/episode-01.html (сброс отметки серии)');
{
  const dom = await load('season-1/episode-01.html', (win) => {
    win.localStorage.setItem('nv:pos:1:1', JSON.stringify({ t: 600, d: 1500, done: true }));
  });
  const win = dom.window, d = win.document;
  ok(await until(dom, (w) => !!w.NV_PLAYER), 'скрипты страницы серии загрузились');
  await forceFailProbe(win);                  // файла нет → idle-карточка
  ok(d.getElementById('stage').classList.contains('idle'), '1 сезон без файла: idle, а не блокировка');
  ok(/ещё не загружено/.test(d.getElementById('statePanel').textContent), 'карточка: «Видео серии ещё не загружено»');
  const rb = d.getElementById('btnResetEp');
  ok(rb && !rb.classList.contains('hidden'), 'кнопка сброса видна: серия отмечена просмотренной');
  ok(/просмотрено/i.test(rb.textContent), 'подпись: «Сбросить отметку «просмотрено»»');
  /* «чистый экран»: кнопка глаза прячет интерфейс, любой тычок возвращает */
  const hb = d.getElementById('btnHideUI');
  ok(!!hb, 'кнопка «Скрыть интерфейс» (глаз) в пульта-строке');
  hb.click();
  ok(d.getElementById('stage').classList.contains('ui-hidden'), 'кнопка включает режим чистого экрана');
  const cev = new win.MouseEvent('click', { bubbles: true, cancelable: true });
  d.body.dispatchEvent(cev);
  ok(!d.getElementById('stage').classList.contains('ui-hidden'), 'тычок в любом месте возвращает интерфейс');
  hb.click();
  const kev = new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  win.dispatchEvent(kev);
  ok(!d.getElementById('stage').classList.contains('ui-hidden'), 'любая кнопка пульта возвращает интерфейс');
  ok(kev.defaultPrevented, 'первое нажатие не доходит до плеера (пауза не срабатывает)');
  ok(d.querySelector('#strip .ep-card.watched') !== null, 'в ленте сезона серия помечена «просмотрено»');
  rb.click();
  ok(win.localStorage.getItem('nv:pos:1:1') === null, 'отметка удалена из хранилища');
  ok(d.querySelector('#strip .ep-card.watched') === null, 'лента сезона обновилась без отметки');
  ok(/Готово/.test(rb.textContent), 'подтверждение «Готово — отметка сброшена»');
  await sleep(1900);
  ok(rb.classList.contains('hidden'), 'после сброса кнопка скрыта');
  dom.window.close();
}

console.log(fails ? `\nFAIL: ${fails}` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
