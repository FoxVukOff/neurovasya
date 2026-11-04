/* =========================================================
   НЕЙРОВАСЯ · общее приложение: хранилище, Android TV / D-pad,
   навигация стрелками, главная страница, блоки страницы серии
   ========================================================= */
(function () {
  'use strict';
  var NV = window.NV;

  /* ---------- хранилище (localStorage с защитой от приватного режима) ---------- */
  var mem = {};
  var store = {
    get: function (k, def) {
      try {
        var raw = window.localStorage.getItem('nv:' + k);
        if (raw === null) return (k in mem) ? mem[k] : def;
        return JSON.parse(raw);
      } catch (e) { return (k in mem) ? mem[k] : def; }
    },
    set: function (k, v) {
      mem[k] = v;
      try { window.localStorage.setItem('nv:' + k, JSON.stringify(v)); } catch (e) {}
    },
    del: function (k) {
      delete mem[k];
      try { window.localStorage.removeItem('nv:' + k); } catch (e) {}
    }
  };

  /* прогресс серии: {t: секунды, d: длительность, done: bool} */
  function getPos(s, e) { return store.get('pos:' + s + ':' + e, null); }
  function setPos(s, e, v) { store.set('pos:' + s + ':' + e, v); }
  function getLast() { return store.get('last', null); }
  function setLast(v) { store.set('last', v); }
  function getDone(s, e) { var p = getPos(s, e); return !!(p && p.done); }

  /* ---------- определение телевизора ---------- */
  var UA = navigator.userAgent || '';
  var isTV = /Android\s*\d*[^)]*\bTV\b|GoogleTV|SmartTV|SmartTv|HbbTV|NETTV|BRAVIA|Tizen|Web0S|Large\s*Screen|AFT[STKM]/i.test(UA);
  if (isTV) document.documentElement.classList.add('tv');

  /* ---------- пространственная навигация (D-pad / стрелки) ---------- */
  var FOC = 'a[href],button:not([disabled]),input:not([disabled]),select,[tabindex="0"]';
  function visible(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return false;
    var s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  }
  function focusables() {
    return Array.prototype.filter.call(document.querySelectorAll(FOC), function (el) {
      return visible(el) && !el.hasAttribute('data-nav-ignore');
    });
  }
  function center(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r }; }
  function spatial(dir) {
    var cur = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    var c = cur ? center(cur) : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var best = null, bestScore = Infinity;
    focusables().forEach(function (el) {
      if (el === cur) return;
      var p = center(el);
      var dx = p.x - c.x, dy = p.y - c.y;
      var prim, perp;
      if (dir === 'left' || dir === 'right') {
        if (dir === 'right' ? dx <= 4 : dx >= -4) return;
        prim = Math.abs(dx); perp = Math.abs(dy);
      } else {
        if (dir === 'down' ? dy <= 4 : dy >= -4) return;
        prim = Math.abs(dy); perp = Math.abs(dx);
      }
      var score = prim + perp * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
      best.focus({ preventScroll: true });
      best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: isTV ? 'auto' : 'smooth' });
      return true;
    }
    return false;
  }

  var BACK_KEYS = { Escape: 1, GoBack: 1, BrowserBack: 1, U: 0, XF86Back: 1 };
  function isBackKey(e) {
    if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.key === 'XF86Back') return true;
    return e.keyCode === 10009 || e.keyCode === 461 || (isTV && e.keyCode === 8);
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var P = window.NV_PLAYER;
    var ae = document.activeElement;
    var tag = ae ? ae.tagName : '';
    var inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    var onWatch = document.body.dataset.page === 'watch';
    var stageIdle = !ae || ae === document.body || ae === document.documentElement || (ae && ae.id === 'stage');

    /* «Назад» с пульта */
    if (isBackKey(e)) {
      if (P && P.closeOverlay()) { e.preventDefault(); return; }
      if (document.fullscreenElement) return;              // нативный выход из fullscreen
      e.preventDefault();
      if (onWatch) { location.href = '/'; }
      else if (history.length > 1) { history.back(); }
      return;
    }

    /* медиа-клавиши пультов и клавиатур */
    if (P && onWatch) {
      if (e.key === 'MediaPlayPause') { e.preventDefault(); P.toggle(); return; }
      if (e.key === 'MediaFastForward') { e.preventDefault(); P.seekBy(30); return; }
      if (e.key === 'MediaRewind') { e.preventDefault(); P.seekBy(-30); return; }
      if (e.key === 'MediaTrackNext') { e.preventDefault(); P.goNext(); return; }
      if (e.key === 'MediaTrackPrevious') { e.preventDefault(); P.goPrev(); return; }
    }

    if (inField) return;   // у input (громкость, чекбокс) свои стрелки

    /* цифры 0–9 на странице серии — переход к проценту времени */
    if (onWatch && stageIdle && /^[0-9]$/.test(e.key) && P) {
      e.preventDefault(); P.seekPercent(+e.key * 10); return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      /* у шкалы перемотки свои стрелки — не перехватываем */
      if (ae && (ae.id === 'timeline' || ae.getAttribute('role') === 'slider')) return;
      /* на странице серии «в воздухе» стрелки влево/вправо = перемотка */
      if (onWatch && stageIdle && P && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); P.seekBy(e.key === 'ArrowRight' ? 10 : -10); return;
      }
      if (onWatch && stageIdle && P && e.key === 'ArrowDown') {
        e.preventDefault(); P.focusControls(); return;
      }
      if (spatial(e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === 'ArrowUp' ? 'up' : 'down')) {
        e.preventDefault();
      }
      return;
    }

    if (onWatch && P && stageIdle && (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32)) {
      e.preventDefault(); P.toggle(); return;
    }
    if (onWatch && P && stageIdle && (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А')) { e.preventDefault(); P.fullscreen(); return; }
    if (onWatch && P && stageIdle && (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь')) { e.preventDefault(); P.mute(); return; }
    if (onWatch && P && stageIdle && (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т')) { e.preventDefault(); P.goNext(); return; }
  }, true);

  /* ---------- рендер карточки серии ---------- */
  function cardHTML(x, small) {
    var p = getPos(x.s, x.e);
    var lock = NV.isLocked(x.s, x.e), soonUp = NV.isAwaitingUpload(x.s, x.e);
    var stTxt = lock ? 'на серверах не скоро'
              : soonUp ? 'скоро загрузится'
              : x.status === 'aired' ? (x.s === 2 ? 'на Okko с ' + NV.fmtDate(x.date).replace(/ (\d{4})$/, '') : 'вышла')
              : x.status === 'today' ? (x.s === 2 ? 'сегодня на Okko' : 'сегодня в 20:00')
              : (x.s === 2 ? 'Okko ' : 'эфир ') + NV.fmtDate(x.date).replace(/ \d{4}$/, '');
    var prog = '';
    if (p && !p.done && p.d && p.t > 5) {
      prog = '<div class="prog"><i style="width:' + Math.min(100, Math.round(p.t / p.d * 100)) + '%"></i></div>';
    }
    var done = p && p.done ? '<span class="cc"><svg viewBox="0 0 24 24"><use href="#i-check"/></svg>просмотрено</span>' : '';
    return '<a class="ep-card' + (p && p.done ? ' watched' : '') + '" href="' + x.url + '">' +
      '<span class="big-n">' + x.e + '</span>' +
      '<span class="num">Серия ' + x.e + (small ? '' : ' · сезон ' + x.s) + '</span>' +
      '<span>' + prog + '</span>' +
      '<span class="cc" style="justify-content:space-between"><span class="st ' + (lock ? 'lock' : x.status) + '">' + stTxt + '</span>' + done + '</span>' +
      '</a>';
  }

  /* ---------- главная ---------- */
  function renderHome() {
    /* CTA в hero */
    var cta = document.getElementById('ctaRow');
    var last = getLast();
    var html = '';
    if (last && !getDone(last.s, last.e)) {
      var t = last.t > 10 ? NV.fmtTime(last.t) : null;
      html += '<a class="btn btn-primary" href="' + NV.epUrl(last.s, last.e) + '"><svg viewBox="0 0 24 24"><use href="#i-play"/></svg>Продолжить: S' + last.s + 'E' + last.e + (t ? ' · ' + t : '') + '</a>';
    } else {
      html += '<a class="btn btn-primary" href="' + NV.epUrl(1, 1) + '"><svg viewBox="0 0 24 24"><use href="#i-play"/></svg>Смотреть 1 сезон</a>';
    }
    var la = NV.latestAvailable();
    if (!(last && last.s === la.s && last.e === la.e)) {
      html += '<a class="btn btn-ghost" href="' + la.url + '">Последняя серия: S' + la.s + 'E' + la.e + '</a>';
    }
    html += '<a class="btn btn-ghost" href="#seasons">Все серии</a>';
    cta.innerHTML = html;

    /* «продолжить просмотр» */
    var cont = document.getElementById('continueSec');
    if (last && !getDone(last.s, last.e)) {
      var x = NV.ep(last.s, last.e);
      var p = getPos(last.s, last.e);
      var pct = p && p.d ? Math.min(100, Math.round(p.t / p.d * 100)) : 0;
      cont.classList.remove('hidden');
      cont.innerHTML =
        '<h2 class="sec-h">Продолжить <span>просмотр</span></h2>' +
        '<div class="continue-card">' +
        '<img src="/assets/img/poster-wide.jpg" alt="Нейровася — кадр-заглушка">' +
        '<div style="flex:1"><div class="cc-t">Сезон ' + x.s + ' · Серия ' + x.e + '</div>' +
        '<div class="cc-s">' + (last.t > 10 ? 'остановились на ' + NV.fmtTime(last.t) : 'серия ещё не начата') + ' · ' + (p && p.d ? NV.fmtTime(p.d) : '--:--') + '</div>' +
        '<div class="prog"><i style="width:' + pct + '%"></i></div>' +
        '<a class="btn btn-primary btn-sm" href="' + x.url + '"><svg viewBox="0 0 24 24"><use href="#i-play"/></svg>Продолжить</a>' +
        '</div></div>';
    } else {
      cont.classList.add('hidden');
      cont.innerHTML = '';
    }

    /* табы + сетки */
    var tabs = document.getElementById('tabs');
    var grid = document.getElementById('grid');
    var cur = store.get('tab', 2);
    function draw(season) {
      grid.innerHTML = NV.list(season).map(function (x) { return cardHTML(x); }).join('');
    }
    tabs.innerHTML = NV.seasons.map(function (s) {
      return '<button class="tab" role="tab" data-s="' + s.n + '" aria-selected="' + (s.n === cur) + '">Сезон ' + s.n + ' · ' + s.year + ' · ' + s.count + ' серий</button>';
    }).join('');
    if (!tabs.dataset.bound) {
      tabs.dataset.bound = '1';
      tabs.addEventListener('click', function (e) {
        var b = e.target.closest('.tab'); if (!b) return;
        cur = +b.dataset.s; store.set('tab', cur);
        Array.prototype.forEach.call(tabs.children, function (t) { t.setAttribute('aria-selected', String(t === b)); });
        draw(cur);
      });
    }
    draw(cur);
    syncResetAll();
  }

  /* ---------- сброс отметок просмотра ---------- */
  var raSync = null, raJustReset = false;
  function hasProgress() {
    if (getLast()) return true;
    try {
      var ls = window.localStorage;
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf('nv:pos:') === 0) return true;
      }
    } catch (e) {}
    for (var mk in mem) { if (mk.indexOf('pos:') === 0 && mem[mk]) return true; }
    return false;
  }
  function resetAllProgress() {
    try {
      var ls = window.localStorage;
      for (var i = ls.length - 1; i >= 0; i--) {
        var k = ls.key(i);
        if (k && (k.indexOf('nv:pos:') === 0 || k === 'nv:last')) ls.removeItem(k);
      }
    } catch (e) {}
    Object.keys(mem).forEach(function (k) {
      if (k.indexOf('pos:') === 0 || k === 'last') delete mem[k];
    });
  }
  function syncResetAll() { if (raSync && !raJustReset) raSync(); }

  /* ---------- страница серии: инфо-блок, prev/next, лента сезона ---------- */
  function renderWatch(s, e) {
    var x = NV.ep(s, e);
    document.getElementById('epBadge').outerHTML =
      '<span class="badge ' + (x.status === 'aired' ? 'ok' : x.status === 'today' ? 'red' : 'dim') + '" id="epBadge">' +
      (x.status === 'aired' ? (s === 2 ? 'на Okko с ' + x.dateStr : 'вышла в 2025') : x.status === 'today' ? (s === 2 ? 'сегодня на Okko' : 'сегодня в 20:00 на ТНТ') : (s === 2 ? 'Okko ' : 'эфир ') + x.dateStr) + '</span>';

    var facts = document.getElementById('epFacts');
    facts.innerHTML =
      '<li>Сезон ' + s + ' · Серия ' + e + '</li>' +
      '<li>' + (s === 1 ? '2025 год' : 'Okko: ' + x.dateStr) + '</li>' +
      '<li>ТНТ</li><li>16+</li>' +
      '<li id="factDur">Длительность: —</li>';

    var p = NV.prev(s, e), n = NV.next(s, e);
    var pc = document.getElementById('prevCard'), nc = document.getElementById('nextCard');
    if (p) pc.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-chevl"/></svg><span><small>Предыдущая</small>Серия ' + p.e + ' · сезон ' + p.s + '</span>';
    else { pc.classList.add('off'); pc.removeAttribute('href'); pc.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-chevl"/></svg><span><small>Предыдущая</small>Это самая первая серия</span>'; }
    if (n) nc.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-chevr"/></svg><span><small>Следующая</small>Серия ' + n.e + ' · сезон ' + n.s + (n.status === 'soon' ? ' (ещё не вышла)' : '') + '</span>';
    else { nc.classList.add('off'); nc.removeAttribute('href'); nc.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-chevr"/></svg><span><small>Следующая</small>Это последняя серия</span>'; }

    document.getElementById('strip').innerHTML = NV.list(s).map(function (q) { return cardHTML(q, true); }).join('');
    document.getElementById('stripSeason').textContent = s;

    /* статус-панель: эфир / видео / плеер */
    var sp = document.getElementById('spPanel');
    function spRow(dot, b, val) {
      return '<div class="sp-row"><span class="dot ' + dot + '"></span><div><b>' + b + '</b><div class="m">' + val + '</div></div></div>';
    }
    var lock = NV.isLocked(s, e), soonUp = NV.isAwaitingUpload(s, e);
    var air = s === 2
      ? (x.status === 'aired'
        ? spRow('ok', 'Okko', 'вышла ' + x.dateStr.replace(/ \d{4}$/, ''))
        : x.status === 'today'
          ? spRow('wait', 'Okko', 'сегодня на Okko (пачка из 3 серий)')
          : spRow('off', 'Okko', 'выход ' + x.dateStr.replace(/ \d{4}$/, '') + ' (пачка из 3 серий)'))
      : (x.status === 'aired'
        ? spRow('ok', 'Эфир', 'состоялся в 2025 году')
        : spRow('off', 'Эфир', 'запланирован на ' + x.dateStr));
    sp.innerHTML = '<h4>статусы серии</h4>' + air +
      '<div id="spVideo">' + (lock
        ? spRow('off', 'Видео', 'на серверах сайта появится не скоро')
        : soonUp
          ? spRow('wait', 'Видео', 'скоро загрузится на серверы сайта')
          : spRow('wait', 'Видео', 'загружается в облачное хранилище сайта')) + '</div>' +
      '<div id="spPlayer">' + (lock
        ? spRow('off', 'Плеер', 'заблокирован — откроется, когда серия появится на серверах')
        : soonUp
          ? spRow('wait', 'Плеер', 'караулит файл — включится автоматически')
          : spRow('wait', 'Плеер', 'режим ожидания — активируется сам')) + '</div>';
    window.addEventListener('nv:video-bad', function (ev) {
      var v = document.getElementById('spVideo');
      var name = String((ev.detail && ev.detail.src) || '').split('/').pop();
      if (v) v.innerHTML = spRow('bad', 'Видео', 'файл ' + name + ' найден, но этот браузер не может воспроизвести формат (MKV/кодек). Поможет конвертация в MP4 (H.264+AAC) или браузер Chrome / Android TV.');
    }, { once: true });
    window.addEventListener('nv:video-on', function () {
      var v = document.getElementById('spVideo'), p = document.getElementById('spPlayer');
      if (v) v.innerHTML = spRow('ok', 'Видео', 'файл загружен в хранилище');
      if (p) p.innerHTML = spRow('ok', 'Плеер', 'активен: воспроизведение, перемотка, автопереход');
    }, { once: true });

    /* кнопка сброса отметки просмотра этой серии */
    var rb = document.getElementById('btnResetEp');
    if (rb) {
      var rbLbl = rb.querySelector('span');
      function syncRb() {
        var pos = getPos(s, e);
        rb.classList.toggle('hidden', !pos);
        if (pos) rbLbl.textContent = pos.done ? 'Сбросить отметку «просмотрено»' : 'Сбросить позицию просмотра';
      }
      rb.addEventListener('click', function () {
        store.del('pos:' + s + ':' + e);
        var last = getLast();
        if (last && last.s === s && last.e === e) store.del('last');
        document.getElementById('strip').innerHTML = NV.list(s).map(function (q) { return cardHTML(q, true); }).join('');
        rbLbl.textContent = 'Готово — отметка сброшена';
        rb.classList.add('ok-flash');
        setTimeout(function () { rb.classList.remove('ok-flash'); syncRb(); }, 1800);
      });
      syncRb();
    }
  }

  /* ---------- расписание 2 сезона: пачки Okko по 3 серии в день ---------- */
  function renderSchedule() {
    var host = document.getElementById('sched');
    if (!host) return;
    function fmtD(d) {
      try { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(d).replace('.', ''); }
      catch (err) { return d.toLocaleDateString(); }
    }
    var batches = [];
    NV.list(2).forEach(function (x) {
      var k = NV.fmtDate(x.date);
      if (!batches.length || batches[batches.length - 1].key !== k) batches.push({ key: k, date: x.date, eps: [] });
      batches[batches.length - 1].eps.push(x);
    });
    var rows = '';
    batches.forEach(function (b, i) {
      var nums = b.eps.length > 1 ? b.eps[0].e + '–' + b.eps[b.eps.length - 1].e : String(b.eps[0].e);
      rows += '<div class="sched-week' + (b.eps.length < 3 ? ' finale' : '') + '"><div class="sched-lbl"><b>Выпуск ' + (i + 1) + '</b><span>' +
        fmtD(b.date) + ' · серии ' + nums + '</span></div>';
      b.eps.forEach(function (x) {
        var stTxt = x.status === 'aired' ? 'уже на okko' : x.status === 'today' ? 'сегодня' : 'ожидается';
        rows += '<div class="sched-cell"><span class="d">okko · ' + fmtD(x.date) + '</span>' +
          '<a href="' + x.url + '">Серия ' + x.e + '</a>' +
          '<span class="st ' + x.status + '">' + stTxt + '</span></div>';
      });
      rows += '</div>';
    });
    host.innerHTML = rows;
  }

  /* ---------- старт ---------- */
  window.NVApp = {
    store: store, isTV: isTV, spatial: spatial,
    getPos: getPos, setPos: setPos, getLast: getLast, setLast: setLast, getDone: getDone,
    cardHTML: cardHTML
  };

  /* кнопка «Обновить» = принудительная перезагрузка без кэша (как Ctrl+F5) */
  var rb = document.getElementById('btnRefresh');
  if (rb) rb.addEventListener('click', function () {
    var u = new URL(location.href);
    u.searchParams.set('upd', String(Date.now()));
    location.replace(u.toString());
  });

  /* общая кнопка «Сбросить весь прогресс» (главная): два шага против случайного клика */
  var ra = document.getElementById('btnResetAll');
  if (ra) {
    var raLbl = ra.querySelector('span');
    var armed = false, armTimer = 0;
    function disarmRa() {
      armed = false; clearTimeout(armTimer);
      ra.classList.remove('danger');
      raLbl.textContent = 'Сбросить весь прогресс';
    }
    raSync = function () {
      disarmRa();
      ra.classList.toggle('hidden', !hasProgress());
    };
    ra.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        ra.classList.add('danger');
        raLbl.textContent = 'Точно сбросить всё? Нажмите ещё раз';
        armTimer = setTimeout(disarmRa, 4000);
        return;
      }
      disarmRa();
      resetAllProgress();
      raLbl.textContent = 'Готово — все отметки сброшены';
      ra.classList.add('ok-flash');
      raJustReset = true;
      renderHome();
      setTimeout(function () {
        ra.classList.remove('ok-flash');
        raJustReset = false;
        raSync();
      }, 1800);
    });
    raSync();
  }

  var page = document.body.dataset.page;
  if (page === 'home') { renderHome(); renderSchedule(); }
  if (page === 'watch') renderWatch(+document.body.dataset.s, +document.body.dataset.e);

  if (isTV) {
    /* на телевизоре сразу ставим фокус на главный элемент */
    window.addEventListener('load', function () {
      var first = document.querySelector(page === 'watch' ? '#stage' : '.hero .btn-primary');
      if (first) first.focus({ preventScroll: true });
    });
  }
})();
