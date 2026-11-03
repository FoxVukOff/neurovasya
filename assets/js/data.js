/* =========================================================
   НЕЙРОВАСЯ · данные сериала и настройки видео
   ---------------------------------------------------------
   ГДЕ ПОДКЛЮЧИТЬ ВИДЕО (когда загрузите серии):
   1) Проще всего: положите файлы на CDN/объектное хранилище
      (Cloudflare R2, Bunny, Backblaze B2…) и укажите здесь base-URL:
         videoBase: 'https://cdn.ваш-домен.ru/neurovasya/'
      Файлы должны называться: s01e01.mp4 … s01e20.mp4, s02e01.mp4 …
   2) Или задайте ссылку для конкретной серии:
         NV.VIDEO_SRC['1:01'] = 'https://…/sezon1/seria01.mp4';
   3) Или положите файлы в папку /videos/ самого сайта (тогда
      videoBase оставьте '/videos/') — но только для небольших файлов:
      GitHub и Vercel не предназначены для гигабайтов видео!
   Пока файла нет — плеер автоматически работает в режиме заглушки.
   ========================================================= */
window.NV = (function () {
  'use strict';

  var config = {
    videoBase: '/videos/',   // ← base-URL, где лежат файлы серий (см. выше)
    autoDetect: true,        // проверять наличие файлов и включать реальный плеер
    demoDuration: 24 * 60,   // длительность серии в режиме заглушки (сек)
    autoNextCountdown: 12    // сек до автопереключения на следующую серию
  };

  var VIDEO_SRC = {};        // '1:01': 'https://…/s01e01.mp4' — точечные переопределения

  var seasons = [
    { n: 1, year: 2025, count: 20, schedule: null },
    { n: 2, year: 2026, count: 16, schedule: 'пн–чт, 20:00 (ТНТ)', start: '2026-11-02' }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function epUrl(s, e) { return '/season-' + s + '/episode-' + pad(e); }

  /* дата эфира серии 2-го сезона: старт в понедельник 02.11.2026, показ пн–чт */
  function airDate(s, e) {
    if (s !== 2) return null;
    var st = seasons[1].start.split('-');
    var start = new Date(+st[0], +st[1] - 1, +st[2]);   // локальная полночь
    var i = e - 1;
    var shift = Math.floor(i / 4) * 7 + (i % 4);
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

  /* кандидаты на видеофайл серии: переопределение → base + типовые имена */
  function videoCandidates(s, e) {
    var key = s + ':' + pad(e);
    if (VIDEO_SRC[key]) return [VIDEO_SRC[key]];
    if (!config.autoDetect) return [];
    var base = config.videoBase || '/videos/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    var name = 's' + pad(s) + 'e' + pad(e);
    return [base + name + '.mp4', base + name + '.m4v', base + name + '.webm'];
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
    videoCandidates: videoCandidates
  };
})();
