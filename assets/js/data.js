/* =========================================================
   НЕЙРОВАСЯ · данные сериала и настройки видео
   ---------------------------------------------------------
   ГДЕ ПОДКЛЮЧИТЬ ВИДЕО (когда загрузите серии):
   1) HUGGING FACE (бесплатно, выбрано по умолчанию):
      залейте файлы скриптом tools/upload-hf.sh, затем впишите ниже
      свой ник и репозиторий:  hf: { user: 'ВАШ_НИК', repo: '…', … }
      Плеер сам соберёт ссылки вида
      https://huggingface.co/datasets/НИК/РЕПО/resolve/main/s01e01.mp4
   2) Любой другой CDN/объектное хранилище (R2, Bunny, B2…):
         videoBase: 'https://cdn.ваш-домен.ru/neurovasya/'
   3) Точечно для одной серии:
         NV.VIDEO_SRC['1:01'] = 'https://…/sezon1/seria01.mp4';
   4) Небольшие файлы можно класть прямо в папку /videos/ сайта
      (GitHub/Vercel не потянут гигабайты — только лёгкие файлы!).
   Файлы везде должны называться s01e01.mp4 … s02e16.mp4.
   Пока файлов нет — плеер автоматически работает в режиме заглушки.
   ========================================================= */
window.NV = (function () {
  'use strict';

  var config = {
    /* Hugging Face: бесплатное хранилище видео. Публичный датасет FoxVuk. */
    hf: { user: 'FoxVuk', repo: 'dhhadhshjjdkahddas', type: 'datasets' }, // type: 'datasets' | 'models'
    videoBase: '',           // ← или base-URL другого CDN (если hf не используется)
    autoDetect: true,        // проверять наличие файлов и включать реальный плеер
    autoNextCountdown: 12    // сек до автопереключения на следующую серию
  };

  /* План загрузки 2 сезона на серверы сайта (временные отметки):
     серии 1–6   — уже загружены и играют как 1 сезон (умный выбор mp4/mkv);
     серии 7–9   — «скоро загрузится»: выходят на Okko сегодня, пользователь зальёт
                   файлы позже; плеер караулит хранилище и включится сам;
     серии 10–16 — ещё не вышли на Okko: обычная плашка «Серия ещё не вышла».
     Как зальёте 7–9 — уберите их из awaitingUpload (станут обычными). */
  var s2plan = { awaitingUpload: [7, 8, 9], locked: [] };
  function isLocked(s, e) { return s === 2 && s2plan.locked.indexOf(e) !== -1; }
  function isAwaitingUpload(s, e) { return s === 2 && s2plan.awaitingUpload.indexOf(e) !== -1; }

  var VIDEO_SRC = {};        // '1:01': 'https://…/s01e01.mp4' — точечные переопределения

  var seasons = [
    { n: 1, year: 2025, count: 20, schedule: null },
    { n: 2, year: 2026, count: 16, schedule: 'по 3 серии в день (Okko)', start: '2026-11-02' }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function epUrl(s, e) { return '/season-' + s + '/episode-' + pad(e); }

  /* дата выхода серии 2-го сезона — по графику Okko: старт 02.11.2026,
     каждый день выходит по 3 серии (2 ноя: 1–3, 3 ноя: 4–6, 4 ноя: 7–9,
     5 ноя: 10–12, 6 ноя: 13–15, 7 ноя: 16) */
  function airDate(s, e) {
    if (s !== 2) return null;
    var st = seasons[1].start.split('-');
    var start = new Date(+st[0], +st[1] - 1, +st[2]);   // локальная полночь
    var shift = Math.floor((e - 1) / 3);                // пачка по 3 серии в день
    var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + shift);
    return d;
  }

  function dayKey(d) { return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }

  /* aired — уже в эфире, today — сегодня в 20:00, soon — ещё не вышла */
  function status(s, e) {
    if (s === 1) return 'aired';
    var d = airDate(s, e);
    var now = new Date();
    if (dayKey(d) === dayKey(now)) return 'today';
    return d < now ? 'aired' : 'soon';
  }

  function fmtDate(d) {
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    } catch (err) { return d.toLocaleDateString(); }
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s);
  }

  function ep(s, e) {
    var d = airDate(s, e);
    return {
      s: s, e: e,
      key: s + ':' + pad(e),
      url: epUrl(s, e),
      date: d,
      dateStr: s === 2 ? fmtDate(d) : '2025',
      status: status(s, e),
      title: 'Серия ' + e
    };
  }

  function list(s) {
    var sec = seasons[s - 1], out = [];
    for (var i = 1; i <= sec.count; i++) out.push(ep(s, i));
    return out;
  }

  function all() { return list(1).concat(list(2)); }

  function next(s, e) {
    var sec = seasons[s - 1];
    if (e < sec.count) return ep(s, e + 1);
    if (s < seasons.length) return ep(s + 1, 1);
    return null;
  }
  function prev(s, e) {
    if (e > 1) return ep(s, e - 1);
    if (s > 1) return ep(s - 1, seasons[s - 2].count);
    return null;
  }

  /* последняя вышедшая серия (для кнопки на главной) */
  function latestAired() {
    var res = ep(1, 1), a = all();
    for (var i = 0; i < a.length; i++) {
      if (a[i].status !== 'soon') res = a[i]; else break;
    }
    return res;
  }

  /* последняя серия, которую реально можно смотреть: вышла, не заблокирована
     и уже на серверах (не в плане «скоро загрузится») */
  function latestAvailable() {
    for (var s = seasons.length; s >= 1; s--) {
      var l = list(s);
      for (var i = l.length - 1; i >= 0; i--) {
        var x = l[i];
        if (x.status === 'soon' || isLocked(x.s, x.e) || isAwaitingUpload(x.s, x.e)) continue;
        return x;
      }
    }
    return ep(1, 1);
  }

  /* base-URL Hugging Face: https://huggingface.co/[datasets/]user/repo/resolve/main/ */
  function hfBase() {
    var h = config.hf;
    if (!h || !h.user || !h.repo) return '';
    var kind = h.type === 'models' ? '' : (h.type || 'datasets') + '/';
    return 'https://huggingface.co/' + kind + h.user + '/' + h.repo + '/resolve/main/';
  }

  /* кандидаты на видеофайл серии: переопределение → base + типовые имена.
     Фактические имена в хранилище FoxVuk: 1_1.mkv … 1_20.mkv (2 сезон: 2_1.mkv …),
     плюс mp4-копии и прежние шаблоны s01e01.mp4.
     prefer — формат, который уже сыграл на этом устройстве: пробуется первым. */
  function videoCandidates(s, e, prefer) {
    var key = s + ':' + pad(e);
    if (VIDEO_SRC[key]) return [VIDEO_SRC[key]];
    if (!config.autoDetect) return [];
    var base = config.videoBase || hfBase() || '/videos/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    var n1 = s + '_' + e, n2 = 's' + pad(s) + 'e' + pad(e);
    var list = [
      base + n1 + '.mp4', base + n1 + '.mkv', base + n1 + '.m4v',
      base + n2 + '.mp4', base + n2 + '.m4v', base + n2 + '.webm'
    ];
    if (prefer) {
      list.sort(function (a, b) {
        var pa = a.slice(-(prefer.length + 1)) === '.' + prefer ? 0 : 1;
        var pb = b.slice(-(prefer.length + 1)) === '.' + prefer ? 0 : 1;
        return pa - pb;
      });
    }
    return list;
  }

  return {
    config: config,
    VIDEO_SRC: VIDEO_SRC,
    seasons: seasons,
    pad: pad,
    epUrl: epUrl,
    airDate: airDate,
    status: status,
    fmtDate: fmtDate,
    fmtTime: fmtTime,
    ep: ep,
    list: list,
    all: all,
    next: next,
    prev: prev,
    latestAired: latestAired,
    latestAvailable: latestAvailable,
    isLocked: isLocked,
    isAwaitingUpload: isAwaitingUpload,
    hfBase: hfBase,
    videoCandidates: videoCandidates
  };
})();
