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
  ok(NV.isLocked(2, 10) === false && NV.isLocked(2, 3) === false, 'блокировка снята: все страницы 2 сезона живые');
  ok(NV.isAwaitingUpload(2, 8) === true && NV.isAwaitingUpload(2, 3) === false && NV.isAwaitingUpload(1, 3) === false,
     'в плане «скоро загрузится» только 2×07–09');
  const s2cards = [...d.querySelectorAll('#grid .ep-card')];
  ok(s2cards.length === 16 && s2cards.slice(0, 6).every((c) => /на Okko с/.test(c.textContent)), 'карточки 2×01–06: «на Okko с…» — играют');
  ok(s2cards.slice(6, 9).every((c) => /скоро загрузится/.test(c.textContent)), 'карточки 2×07–09: «скоро загрузится»');
  ok(s2cards.slice(9).every((c) => /Okko \d/.test(c.textContent)), 'карточки 2×10–16: дата выхода на Okko');
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

console.log('season-2/episode-02.html (файл есть: умный выбор и диагностика формата)');
{
  const dom = await load('season-2/episode-02.html', (win) => {
    /* хранилище отвечает 200 на все HEAD: файлы «существуют» */
    try {
      Object.defineProperty(win, 'fetch', {
        value: () => Promise.resolve({ ok: true }), writable: true, configurable: true
      });
    } catch (e) {}
  });
  const win = dom.window, d = win.document;
  ok(await until(dom, (w) => !!w.NV_PLAYER), 'скрипты страницы серии загрузились');
  await forceFailProbe(win);                  // jsdom не играет медиа → все кандидаты «не сыграли»
  const panel = d.getElementById('statePanel');
  ok(d.getElementById('stage').classList.contains('idle'), 'без успешного старта плеер остаётся в idle');
  ok(/Формат не поддержан/.test(panel.textContent), 'карточка: «Формат не поддержан» (файл найден)');
  ok(/2_2\.mp4/.test(panel.textContent), 'в карточке имя найденного файла 2_2.mp4 (MP4 первым)');
  ok(/MP4-версия/.test(panel.textContent), 'подсказка про MP4-версию');
  ok(/S2E6/.test(panel.textContent), 'кнопка «последняя доступная» → S2E6');
  ok(/2_2\.mp4/.test(d.getElementById('spPanel').textContent), 'статус-панель: красный статус с именем файла');
  ok(d.getElementById('timeLbl').textContent === '--:-- / --:--', 'время прочерками: фейкового воспроизведения нет');
  ok(!/huggingface|FoxVuk/i.test(d.body.textContent), 'на странице серии нет упоминаний Hugging Face');
  ok(d.querySelectorAll('#strip .ep-card').length === 16, 'лента сезона: 16 серий');
  ok(d.getElementById('topLabel').textContent.includes('S2E2'), 'подпись сверху S2E2');
  ok(/на Okko с/.test(d.getElementById('epBadge').textContent), 'бейдж: «на Okko с 3 ноября»');
  ok(win.localStorage.getItem('nv:pos:2:2') === null, 'позиция не сохраняется');
  ok(d.getElementById('btnResetEp').classList.contains('hidden'), 'сброс серии скрыт: отметки нет');
  dom.window.close();
}

console.log('season-2/episode-07.html (скоро загрузится на серверы)');
{
  const dom = await load('season-2/episode-07.html');
  const win = dom.window, d = win.document;
  ok(await until(dom, (w) => !!w.NV_PLAYER), 'скрипты страницы серии загрузились');
  await forceFailProbe(win);                  // файла 2_7 ещё нет → «скоро загрузится»
  const panel = d.getElementById('statePanel');
  ok(d.getElementById('stage').classList.contains('idle'), 'плеер в idle, пока файла нет');
  ok(/скоро загрузится/i.test(panel.textContent), 'карточка: «Скоро загрузится на серверы»');
  ok(/75 секунд/.test(panel.textContent), 'плеер продолжит караулить файл');
  ok(/S2E6/.test(panel.textContent), 'кнопка «последняя доступная» → S2E6');
  ok(/сегодня на Okko/.test(d.getElementById('epBadge').textContent), 'бейдж: «сегодня на Okko»');
  ok(/сегодня на Okko/.test(d.getElementById('spPanel').textContent), 'статус-панель: Okko сегодня');
  ok(/караулит файл/i.test(d.getElementById('spPanel').textContent), 'статус-панель: плеер караулит файл');
  ok(win.localStorage.getItem('nv:pos:2:7') === null, 'позиция не сохраняется');
  dom.window.close();
}

console.log('season-2/episode-10.html (ещё не вышла на Okko)');
{
  const dom = await load('season-2/episode-10.html');
  await until(dom, (w) => !!w.NV_PLAYER);
  const d = dom.window.document;
  ok(d.getElementById('stage').classList.contains('idle'), 'стадия idle до выхода');
  const p10 = d.getElementById('statePanel');
  ok(p10 && !p10.classList.contains('hidden'), 'статус-карточка видна');
  ok(/ещё не вышла/.test(p10.textContent), 'карточка: «Серия ещё не вышла»');
  ok(/5 ноября/.test(p10.textContent), 'дата выхода на Okko (5 ноября, пачка 10–12)');
  ok(/S2E6/.test(p10.textContent), 'кнопка «последняя доступная» → S2E6');
  ok(d.querySelectorAll('video').length === 1 && d.querySelector('video').hidden === true,
     'видео скрыто, файлы до дня выхода не ищутся');
  ok(/после выхода на Okko/.test(d.getElementById('spPanel').textContent), 'статус-панель: видео появится после выхода');
  ok(/в день выхода/.test(d.getElementById('spPanel').textContent), 'статус-панель: плеер откроется в день выхода');
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
