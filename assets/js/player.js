/* =========================================================
   НЕЙРОВАСЯ · плеер v3
   - умный выбор файла: mp4/mkv помнятся по устройству (что сыграло —
     пробуется первым), каждый кандидат проверяется на играбельность;
   - никакой заглушки-«голограммы»: если играть нечего, показывается
     аккуратная статус-плашка (ждём загрузку / формат не поддержан /
     серия ещё не вышла), плеер активируется сам, когда файл появится;
   - перемотка, скорость, громкость, FS, автопереход, сохранение позиции;
   - управление с пульта Android TV (D-pad, OK, Назад, медиа-кнопки).
   ========================================================= */
(function () {
  'use strict';
  var NV = window.NV, App = window.NVApp;
  if (!NV || document.body.dataset.page !== 'watch') return;

  var s = +document.body.dataset.s, e = +document.body.dataset.e;
  var x = NV.ep(s, e);

  function el(id) { return document.getElementById(id); }
  var stage = el('stage'), video = el('video');
  var controls = el('controls'), timeline = el('timeline');
  var tlBuf = timeline.querySelector('.tl-buffer'), tlPlay = timeline.querySelector('.tl-played'),
      tlHandle = timeline.querySelector('.tl-handle'), tlTip = timeline.querySelector('.tl-tip');
  var btnPlay = el('btnPlay'), btnB10 = el('btnBack10'), btnF10 = el('btnFwd10'), btnNext = el('btnNext'),
      btnRate = el('btnRate'), btnMute = el('btnMute'), btnFs = el('btnFs'), vol = el('vol'),
      timeLbl = el('timeLbl'), bigPlay = el('bigPlay'), autoChk = el('autoNext');
  var nextUp = el('nextUp'), statePanel = el('statePanel'), toast = el('resumeToast');
  var wrap = document.querySelector('.stage-wrap');
  var fmtChip = el('fmtChip');
  el('topLabel').textContent = 'НЕЙРОВАСЯ · S' + s + 'E' + e;

  /* ---------- безопасная пустышка NV_PLAYER для страниц без плеера ---------- */
  function noopPlayer() {
    function nope() {}
    return {
      closeOverlay: function () { return false; },
      toggle: nope, seekBy: nope, seekPercent: nope, goNext: nope, goPrev: nope,
      fullscreen: nope, mute: nope, focusControls: nope
    };
  }

  /* ---------- серия заблокирована: «на серверах не скоро», плеер не просыпается ---------- */
  if (NV.isLocked(s, e)) {
    showState('locked');
    window.NV_PLAYER = noopPlayer();
    return;
  }

  /* ---------- серия ещё не вышла ---------- */
  if (x.status === 'soon') {
    showState('soon');
    window.NV_PLAYER = noopPlayer();
    return;
  }

  /* ---------- состояние ---------- */
  var mode = 'idle';            // 'idle' (играть нечего) | 'video'
  var ready = false, dragging = false, overlay = null, toastTimer = 0, saveAcc = 0;
  /* авторетраи: на ТВ «не открылось» чаще значит «не успело загрузиться» —
     пробуем снова и снова с нарастающей паузой, пока не получится */
  var retryRound = 0, retryTimer = 0;                 // повторы проб кандидатов
  var reloadTries = 0, reloadTimer = 0;               // перезапуски оборвавшегося файла
  var lastGoodSrc = '', lastPos = 0;
  var dur = 0;
  var rate = App.store.get('rate', 1);
  var RATES = [1, 1.25, 1.5, 2, 0.75];
  var autoStart = new URLSearchParams(location.search).get('auto') === '1';

  function fmt(sec) { return NV.fmtTime(sec); }
  function extOf(src) { var m = String(src).split('?')[0].match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : ''; }

  /* ---------- статус-плашки вместо заглушки ---------- */
  function showState(kind, src) {
    mode = 'idle';
    stage.classList.add('idle');
    stage.classList.remove('paused');
    video.hidden = true;                       // под статус-плашкой видео не показываем
    timeLbl.textContent = '--:-- / --:--';
    var la = NV.latestAvailable();
    var btns =
      '<a class="btn btn-primary" href="' + la.url + '">Последняя доступная: S' + la.s + 'E' + la.e + '</a>' +
      '<a class="btn btn-ghost" href="/">На главную</a>';
    var html = '<div class="lock-card">';
    if (kind === 'locked') {
      var when = x.status === 'today' ? 'сегодня' : x.dateStr.replace(/ \d{4}$/, '');
      html += '<svg viewBox="0 0 24 24"><use href="#i-lock"/></svg><h3>Эта серия ещё не на серверах</h3>' +
        '<p>На серверах сайта она появится не скоро — плеер откроется после загрузки. ' +
        (x.status === 'soon' ? 'Выход на Okko: <span class="when">' + when + '</span>.' : 'Уже на Okko: <span class="when">' + when + '</span> — смотрите там, а здесь серия откроется после загрузки.') + '</p>' + btns;
    } else if (kind === 'soon') {
      html += '<svg viewBox="0 0 24 24"><use href="#i-clock"/></svg><h3>Серия ещё не вышла</h3>' +
        '<p>Выход на Okko: <span class="when">' + x.dateStr.replace(/ \d{4}$/, '') + '</span>.<br>Страница откроет плеер автоматически в день выхода.</p>' + btns;
    } else if (kind === 'bad') {
      html += '<svg viewBox="0 0 24 24"><use href="#i-info"/></svg><h3>Видео пока не запускается</h3>' +
        '<p>Файл <b>' + String(src || '').split('/').pop() + '</b> найден, но не смог запуститься — ' +
        'на телевизорах это чаще всего временная проблема загрузки, а не формат. ' +
        'Плеер пробует снова автоматически' + (retryRound ? ' (попытка ' + (retryRound + 1) + ')' : '') +
        ' и включит видео, как только получится.</p>' + btns;
      window.dispatchEvent(new CustomEvent('nv:video-bad', { detail: { src: src } }));
    } else if (NV.isAwaitingUpload(s, e)) {
      html += '<svg viewBox="0 0 24 24"><use href="#i-clock"/></svg><h3>Скоро загрузится на серверы</h3>' +
        '<p>Файл серии вот-вот появится на серверах сайта — и плеер включится сам, ' +
        'без перезагрузки страницы. Проверка хранилища продолжается каждые 75 секунд.</p>' + btns;
    } else {
      html += '<svg viewBox="0 0 24 24"><use href="#i-info"/></svg><h3>Видео серии ещё не загружено</h3>' +
        '<p>Файл серии появится в облачном хранилище сайта — и плеер включится сам, ' +
        'без перезагрузки страницы. Проверка хранилища продолжается каждые 75 секунд.</p>' + btns;
    }
    statePanel.innerHTML = html + '</div>';
    statePanel.classList.remove('hidden');
  }

  /* ---------- умный выбор файла: помним, что сыграло на этом устройстве ---------- */
  var prefer = App.store.get('fmt', '');
  var cands = NV.videoCandidates(s, e, prefer);
  var existed = null;

  function playability(src, cb) {
    var pv = document.createElement('video');
    pv.preload = 'metadata';
    pv.style.display = 'none';
    var done = false;
    var to = setTimeout(function () { fin(false); }, App.isTV ? 15000 : 9000);
    function fin(v) {
      if (done) return;
      done = true; clearTimeout(to);
      pv.removeEventListener('loadedmetadata', onOk);
      pv.removeEventListener('error', onErr);
      pv.removeAttribute('src');
      if (pv.parentNode) pv.parentNode.removeChild(pv);
      cb(v);
    }
    function onOk() { fin(true); }
    function onErr() { fin(false); }
    pv.addEventListener('loadedmetadata', onOk);
    pv.addEventListener('error', onErr);
    if (document.body) document.body.appendChild(pv);
    pv.src = src;
  }

  function tryCandidate(i) {
    if (i >= cands.length) {
      showState(existed ? 'bad' : 'wait', existed || '');
      scheduleReprobe(!!existed);   // 'bad' — быстрые нарастающие ретраи, 'wait' — раз в 75 с
      return;
    }
    var src = cands[i];
    function checkPlay() {
      playability(src, function (ok) {
        if (ok) startVideo(src);
        else tryCandidate(i + 1);
      });
    }
    if (window.fetch) {
      fetch(src, { method: 'HEAD' }).then(function (r) {
        if (!r.ok) { tryCandidate(i + 1); return; }
        existed = existed || src;
        checkPlay();
      }).catch(function () {
        existed = existed || src;
        checkPlay();
      });
    } else {
      checkPlay();
    }
  }

  function startVideo(src) {
    mode = 'video';
    retryRound = 0; reloadTries = 0;
    clearTimeout(retryTimer); clearTimeout(reloadTimer);
    lastGoodSrc = src; lastPos = 0;
    stage.classList.remove('idle');
    statePanel.classList.add('hidden');
    video.hidden = false;
    video.addEventListener('loadedmetadata', function once() {
      video.removeEventListener('loadedmetadata', once);
      ready = true;
      dur = (isFinite(video.duration) && video.duration) ? video.duration : 0;
      video.playbackRate = rate;
      var v = App.store.get('vol', 0.8);
      video.volume = v; vol.value = String(v);
      vol.disabled = false; btnMute.disabled = false;
      video.muted = App.store.get('mute', false);
      syncMuteIcon();
      var ex = extOf(src);
      if (ex) {
        App.store.set('fmt', ex);                 // запоминаем играбельный формат устройства
        fmtChip.textContent = ex.toUpperCase();
        fmtChip.classList.remove('hidden');
      }
      window.dispatchEvent(new CustomEvent('nv:video-on'));
      afterReady();
    });
    video.src = src;
  }

  function afterReady() {
    el('factDur').textContent = 'Длительность: ' + fmt(dur);
    var saved = App.getPos(s, e);
    if (!autoStart && saved && !saved.done && saved.t > 15 && saved.t < dur - 30) {
      seek(saved.t);
      showResumeToast(saved.t);
    }
    emitUI();
    setPausedUI(true);
    play();   // стартует, если браузер разрешит autoplay; иначе — большая кнопка
  }

  /* ---------- дозор и авторетраи ----------
     'wait' (файла нет) — проверяем хранилище раз в 75 с;
     'bad' (файл есть, не запустился) — пробуем снова и снова с нарастающей
     паузой 5 → 10 → 20 → 40 → 60 с и далее каждую минуту, до победного. */
  var reprobeOn = false;
  function scheduleReprobe(fast) {
    if (mode !== 'idle' || reprobeOn) return;
    reprobeOn = true;
    var delay = fast ? Math.min(60000, 5000 * Math.pow(2, retryRound)) : 75000;
    retryTimer = setTimeout(function () {
      reprobeOn = false;
      if (fast) retryRound++;
      reprobe();
    }, delay);
  }
  function reprobe() {
    if (mode !== 'idle') return;
    var list = NV.videoCandidates(s, e, prefer), i = 0, settled = false;
    function next() {
      if (settled) return;
      if (i >= list.length) {
        settled = true;
        if (existed) showState('bad', existed);   // обновить карточку со счётчиком попыток
        scheduleReprobe(!!existed);
        return;
      }
      var src = list[i++];
      playability(src, function (ok) {
        if (!ok) { next(); return; }
        settled = true;
        startVideo(src);
      });
    }
    next();
  }

  /* ---------- UI ---------- */
  function emitUI() {
    var d = dur || 1, c = curTime();
    var pct = Math.min(100, c / d * 100);
    tlPlay.style.width = pct + '%';
    tlHandle.style.left = pct + '%';
    tlBuf.style.width = Math.min(100, bufferEnd() / d * 100) + '%';
    timeLbl.textContent = fmt(c) + ' / ' + fmt(d);
    timeline.setAttribute('aria-valuenow', String(Math.round(c)));
    timeline.setAttribute('aria-valuetext', fmt(c) + ' из ' + fmt(d));
  }
  function setPausedUI(p) {
    stage.classList.toggle('paused', p);
    btnPlay.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-' + (p ? 'play' : 'pause') + '"/></svg>';
    btnPlay.setAttribute('aria-label', p ? 'Смотреть' : 'Пауза');
    poke();
  }
  function poke() {
    stage.classList.add('ctl-show');
    clearTimeout(poke._t);
    poke._t = setTimeout(function () {
      if (!isPaused() && !overlay && !controls.contains(document.activeElement) && !dragging) {
        stage.classList.remove('ctl-show');
      }
    }, 3200);
  }
  ['pointermove', 'pointerdown', 'keydown'].forEach(function (ev) {
    stage.addEventListener(ev, poke, { passive: true });
  });

  /* ---------- «чистый экран»: прячем верхнюю панель, контролы и полоску прогресса ----------
     Кнопка с иконкой глаза (удобна с пульта Android TV), возврат — любой тычок
     или любая кнопка пульта/клавиатуры: первое нажатие только возвращает
     интерфейс и до плеера не доходит (пауза/перемотка не срабатывают). */
  var btnHideUI = el('btnHideUI');
  var uiHidden = false;
  function hideUI() {
    uiHidden = true;
    stage.classList.add('ui-hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function showUI() {
    if (!uiHidden) return;
    uiHidden = false;
    stage.classList.remove('ui-hidden');
    poke();
  }
  btnHideUI.addEventListener('click', function (ev) { ev.stopPropagation(); hideUI(); });
  document.addEventListener('click', function (ev) {
    if (!uiHidden) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    showUI();
  }, true);
  window.addEventListener('keydown', function (ev) {
    if (!uiHidden) return;
    ev.preventDefault(); ev.stopPropagation();
    showUI();
  }, true);

  function curTime() { return mode === 'video' ? (video.currentTime || 0) : 0; }
  function isPaused() { return mode === 'video' ? video.paused : true; }
  function bufferEnd() {
    if (mode === 'video') { try { var b = video.buffered; if (b.length) return b.end(b.length - 1); } catch (err) {} }
    return 0;
  }

  function save() {
    if (mode !== 'video' || !ready) return;
    var c = curTime(), d = dur;
    App.setPos(s, e, { t: Math.round(c), d: Math.round(d), done: false });
    App.setLast({ s: s, e: e, t: Math.round(c), ts: Date.now() });
  }
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') save(); });

  function play() {
    if (mode !== 'video' || !ready) return;
    var pr = video.play();
    if (pr && pr.catch) pr.catch(function () { setPausedUI(true); });
    else setPausedUI(false);
    poke();
  }
  function pause() {
    if (mode !== 'video' || !ready) return;
    video.pause();
    setPausedUI(true); save();
  }
  function toggle() { if (mode !== 'video' || !ready) return; isPaused() ? play() : pause(); }
  function seek(t) {
    if (mode !== 'video' || !ready) return;
    t = Math.max(0, Math.min(dur - 0.4, t));
    if (overlay) hideNextUp();
    video.currentTime = t;
    emitUI(); save();
  }
  function seekBy(dt) { seek(curTime() + dt); poke(); }
  function seekPercent(p) { seek(dur * p / 100); }

  function go(url) { save(); location.href = url; }
  function goNext() {
    var n = NV.next(s, e);
    if (!n) return;
    if (n.status === 'soon') { showToastText('Серия ' + n.e + ' ещё не вышла — эфир ' + n.dateStr + ' в 20:00'); return; }
    go(n.url + '?auto=1');
  }
  function goPrev() { var p = NV.prev(s, e); if (p) go(p.url); }

  function showToastText(html) {
    toast.innerHTML = '<span>' + html + '</span>';
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.add('hidden'); }, 5000);
  }
  function showResumeToast(t) {
    toast.innerHTML = '<span>Продолжить с ' + fmt(t) + '?</span>' +
      '<button id="rstStart">Сначала</button><button id="rstOk">Ок</button>';
    toast.classList.remove('hidden');
    el('rstStart').onclick = function () { toast.classList.add('hidden'); seek(0); };
    el('rstOk').onclick = function () { toast.classList.add('hidden'); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.add('hidden'); }, 8000);
  }

  /* ---------- автопереход ---------- */
  var cdTimer = 0;
  function showNextUp() {
    overlay = 'next';
    var n = NV.next(s, e);
    var ring = nextUp.querySelector('.fgc'), num = nextUp.querySelector('.nu-ring b');
    nextUp.classList.remove('hidden');
    poke();
    if (!n) {
      nextUp.querySelector('.nu-body').innerHTML =
        '<div class="nu-t">Конец</div><div class="nu-n">Это была последняя серия «Нейроваси»</div>' +
        '<div class="nu-btns"><a class="btn btn-primary" href="/">На главную</a></div>';
      nextUp.querySelector('.nu-ring').style.display = 'none';
      return;
    }
    var canAuto = autoChk.checked && n.status !== 'soon';
    nextUp.querySelector('.nu-ring').style.display = '';
    nextUp.querySelector('.nu-body').innerHTML =
      '<div class="nu-t">' + (n.status === 'soon' ? 'Скоро' : canAuto ? 'Следующая серия через' : 'Следующая серия') + '</div>' +
      '<div class="nu-n">Серия ' + n.e + ' · сезон ' + n.s + (n.status === 'soon' ? ' — эфир ' + n.dateStr + ', 20:00' : '') + '</div>' +
      '<div class="nu-btns">' +
      (n.status === 'soon'
        ? '<a class="btn btn-ghost" href="/">К вышедшим сериям</a>'
        : '<button class="btn btn-primary" id="nuNow">Смотреть сейчас</button>') +
      (canAuto ? '<button class="btn btn-ghost" id="nuCancel">Отмена</button>' : '') +
      '</div>';
    if (canAuto) {
      var left = NV.config.autoNextCountdown, C = 201;
      num.textContent = left;
      ring.style.strokeDashoffset = 0;
      el('nuNow').onclick = function () { goNext(); };
      el('nuCancel').onclick = function () { hideNextUp(); };
      clearInterval(cdTimer);
      var t0 = performance.now();
      cdTimer = setInterval(function () {
        var passed = (performance.now() - t0) / 1000;
        var rest = Math.max(0, left - passed);
        num.textContent = Math.ceil(rest);
        ring.style.strokeDashoffset = String(C * (passed / left));
        if (rest <= 0) { clearInterval(cdTimer); goNext(); }
      }, 200);
      nextUp.querySelector('#nuNow').focus({ preventScroll: true });
    }
  }
  function hideNextUp() {
    overlay = null; clearInterval(cdTimer);
    nextUp.classList.add('hidden');
    poke();
  }
  function onEnded() {
    setPausedUI(true);
    App.setPos(s, e, { t: Math.round(dur), d: Math.round(dur), done: true });
    var n = NV.next(s, e);
    if (n && n.status !== 'soon') App.setLast({ s: n.s, e: n.e, t: 0, ts: Date.now() });
    else App.store.del('last');
    showNextUp();
  }

  /* ---------- события видео ---------- */
  video.addEventListener('timeupdate', function () {
    emitUI();
    lastPos = video.currentTime || lastPos;
    saveAcc += 0.25;
    if (saveAcc > 3) { saveAcc = 0; save(); }
  });
  video.addEventListener('progress', emitUI);
  video.addEventListener('play', function () { setPausedUI(false); });
  video.addEventListener('pause', function () { setPausedUI(true); save(); });
  video.addEventListener('ended', onEnded);
  video.addEventListener('ratechange', function () { rate = video.playbackRate; });
  video.addEventListener('error', function () {
    if (mode !== 'video') return;
    /* обрыв загрузки на ТВ — не приговор: перезапускаем тот же файл с того же места */
    if (lastGoodSrc && reloadTries < 4) {
      reloadTries++;
      showToastText('Видео прервалось — пробую снова (' + reloadTries + ' из 4)…');
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(function () {
        if (mode !== 'video') return;
        video.addEventListener('loadedmetadata', function once() {
          video.removeEventListener('loadedmetadata', once);
          reloadTries = 0;
          try { video.currentTime = lastPos; } catch (err) {}
          play();
        });
        video.src = lastGoodSrc;
      }, Math.min(30000, 2000 * reloadTries));
      return;
    }
    ready = false;
    existed = existed || lastGoodSrc || video.currentSrc;
    showToastText('Видео не запускается — продолжаю пробовать автоматически');
    showState('bad', existed || '');
    scheduleReprobe(true);
  });

  /* ---------- контролы ---------- */
  btnPlay.addEventListener('click', toggle);
  bigPlay.addEventListener('click', function () { play(); bigPlay.blur(); });
  btnB10.addEventListener('click', function () { seekBy(-10); });
  btnF10.addEventListener('click', function () { seekBy(10); });
  btnNext.addEventListener('click', goNext);
  btnRate.addEventListener('click', function () {
    var i = (RATES.indexOf(rate) + 1) % RATES.length;
    rate = RATES[i];
    if (mode === 'video') video.playbackRate = rate;
    btnRate.textContent = '×' + rate;
    App.store.set('rate', rate);
  });
  btnMute.addEventListener('click', mute);
  function mute() {
    if (mode !== 'video') return;
    video.muted = !video.muted;
    App.store.set('mute', video.muted);
    syncMuteIcon();
  }
  function syncMuteIcon() {
    btnMute.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-' + (video.muted || vol.value === '0' ? 'mute' : 'vol') + '"/></svg>';
  }
  vol.addEventListener('input', function () {
    if (mode === 'video') { video.volume = +vol.value; video.muted = (+vol.value === 0); }
    App.store.set('vol', +vol.value);
    syncMuteIcon();
  });
  btnFs.addEventListener('click', fullscreen);
  function fullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    var pr = wrap.requestFullscreen && wrap.requestFullscreen();
    if (pr && pr.catch) pr.catch(function () {});
  }
  document.addEventListener('fullscreenchange', function () {
    btnFs.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-' + (document.fullscreenElement ? 'fsx' : 'fs') + '"/></svg>';
  });
  autoChk.checked = App.store.get('autoNext', true);
  autoChk.addEventListener('change', function () { App.store.set('autoNext', autoChk.checked); });
  btnRate.textContent = '×' + rate;

  stage.addEventListener('click', function (ev) {
    if (ev.target.closest('.controls, .topbar, .overlay, .toast, button, a, input')) return;
    toggle();
  });

  /* ---------- таймлайн ---------- */
  function seekFromEvent(ev) {
    var r = timeline.getBoundingClientRect();
    var f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    seek(f * dur);
  }
  timeline.addEventListener('pointerdown', function (ev) {
    dragging = true;
    timeline.setPointerCapture(ev.pointerId);
    seekFromEvent(ev);
  });
  timeline.addEventListener('pointermove', function (ev) {
    var r = timeline.getBoundingClientRect();
    var f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    tlTip.style.left = (f * 100) + '%';
    tlTip.textContent = fmt(f * dur);
    if (dragging) seekFromEvent(ev);
  });
  timeline.addEventListener('pointerup', function () { dragging = false; save(); });
  timeline.addEventListener('pointercancel', function () { dragging = false; });
  timeline.addEventListener('keydown', function (ev) {
    var step = ev.shiftKey ? 60 : 10;
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.stopPropagation(); seekBy(-step); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.stopPropagation(); seekBy(step); }
    else if (ev.key === 'Home') { ev.preventDefault(); ev.stopPropagation(); seek(0); }
    else if (ev.key === 'End') { ev.preventDefault(); ev.stopPropagation(); seek(dur - 1); }
  });

  /* ---------- API для глобальных клавиш (app.js) ---------- */
  window.NV_PLAYER = {
    toggle: toggle,
    seekBy: seekBy,
    seekPercent: seekPercent,
    goNext: goNext,
    goPrev: goPrev,
    mute: mute,
    fullscreen: fullscreen,
    focusControls: function () { btnPlay.focus({ preventScroll: true }); poke(); },
    closeOverlay: function () {
      if (overlay === 'next') { hideNextUp(); return true; }
      if (!toast.classList.contains('hidden')) { toast.classList.add('hidden'); return true; }
      return false;
    }
  };

  /* ---------- старт ---------- */
  setPausedUI(true);
  timeLbl.textContent = '--:-- / --:--';
  tryCandidate(0);
})();
