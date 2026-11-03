/* =========================================================
   НЕЙРОВАСЯ · плеер
   - реальное видео, если файл найден (иначе красивая заглушка-«голограмма»)
   - перемотка (мышь / тач / клавиши / цифры пульта), скорость, громкость, FS
   - автосохранение позиции и последней серии (localStorage)
   - автопереход на следующую серию с обратным отсчётом
   - управление с пульта Android TV (D-pad, OK, Назад, медиа-кнопки)
   ========================================================= */
(function () {
  'use strict';
  var NV = window.NV, App = window.NVApp;
  if (!NV || document.body.dataset.page !== 'watch') return;

  var s = +document.body.dataset.s, e = +document.body.dataset.e;
  var x = NV.ep(s, e);

  function el(id) { return document.getElementById(id); }
  var stage = el('stage'), video = el('video'), canvas = el('demoCanvas');
  var controls = el('controls'), timeline = el('timeline');
  var tlBuf = timeline.querySelector('.tl-buffer'), tlPlay = timeline.querySelector('.tl-played'),
      tlHandle = timeline.querySelector('.tl-handle'), tlTip = timeline.querySelector('.tl-tip');
  var btnPlay = el('btnPlay'), btnB10 = el('btnBack10'), btnF10 = el('btnFwd10'), btnNext = el('btnNext'),
      btnRate = el('btnRate'), btnMute = el('btnMute'), btnFs = el('btnFs'), vol = el('vol'),
      timeLbl = el('timeLbl'), bigPlay = el('bigPlay'), autoChk = el('autoNext');
  var nextUp = el('nextUp'), lockPanel = el('lockedPanel'), toast = el('resumeToast');
  var wrap = document.querySelector('.stage-wrap');
  el('topLabel').textContent = 'НЕЙРОВАСЯ · S' + s + 'E' + e;

  /* ---------- серия ещё не вышла ---------- */
  if (x.status === 'soon') {
    stage.classList.add('locked');
    var la = NV.latestAired();
    lockPanel.classList.remove('hidden');
    lockPanel.innerHTML =
      '<div class="lock-card"><svg viewBox="0 0 24 24"><use href="#i-clock"/></svg>' +
      '<h3>Серия ещё не вышла</h3>' +
      '<p>Премьера на ТНТ: <span class="when">' + x.dateStr + ', 20:00</span>.<br>Плеер откроется автоматически в день эфира.</p>' +
      '<div class="nu-btns" style="justify-content:center">' +
      '<a class="btn btn-primary" href="' + la.url + '">Последняя вышедшая: S' + la.s + 'E' + la.e + '</a>' +
      '<a class="btn btn-ghost" href="/">На главную</a></div></div>';
    window.NV_PLAYER = { closeOverlay: function () { return false; } };
    return;
  }

  /* ---------- состояние ---------- */
  var mode = 'demo';            // 'video' | 'demo'
  var dur = NV.config.demoDuration;
  var ready = false, dragging = false, overlay = null, toastTimer = 0, saveAcc = 0, uiAcc = 0;
  var rate = App.store.get('rate', 1);
  var RATES = [1, 1.25, 1.5, 2, 0.75];
  var autoStart = new URLSearchParams(location.search).get('auto') === '1';

  var demo = { t: 0, playing: false, lastTs: 0 };

  function curTime() { return mode === 'video' ? (video.currentTime || 0) : demo.t; }
  function duration() { return mode === 'video' ? (isFinite(video.duration) && video.duration ? video.duration : dur) : dur; }
  function isPaused() { return mode === 'video' ? video.paused : !demo.playing; }
  function bufferEnd() {
    if (mode === 'video') { try { var b = video.buffered; if (b.length) return b.end(b.length - 1); } catch (err) {} return 0; }
    return Math.min(duration(), demo.t + 120);
  }

  /* ---------- UI ---------- */
  function fmt(sec) { return NV.fmtTime(sec); }
  function emitUI() {
    var d = duration() || 1, c = curTime();
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

  /* ---------- сохранение прогресса ---------- */
  function save() {
    if (!ready) return;
    var c = curTime(), d = duration();
    App.setPos(s, e, { t: Math.round(c), d: Math.round(d), done: false });
    App.setLast({ s: s, e: e, t: Math.round(c), ts: Date.now() });
  }
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') save(); });

  /* ---------- воспроизведение ---------- */
  function play() {
    if (mode === 'video') {
      var pr = video.play();
      if (pr && pr.catch) pr.catch(function () { setPausedUI(true); });
      else setPausedUI(false);
    } else {
      demo.playing = true; setPausedUI(false);
    }
    poke();
  }
  function pause() {
    if (mode === 'video') video.pause(); else demo.playing = false;
    setPausedUI(true); save();
  }
  function toggle() { if (!ready) return; isPaused() ? play() : pause(); }
  function seek(t) {
    if (!ready) return;
    var d = duration();
    t = Math.max(0, Math.min(d - 0.4, t));
    if (overlay) hideNextUp();
    if (mode === 'video') video.currentTime = t; else demo.t = t;
    emitUI(); save();
  }
  function seekBy(dt) { seek(curTime() + dt); poke(); }
  function seekPercent(p) { seek(duration() * p / 100); }

  /* ---------- следующая / предыдущая ---------- */
  function go(url) { save(); location.href = url; }
  function goNext() {
    var n = NV.next(s, e);
    if (!n) return;
    if (n.status === 'soon') { showToastText('Серия ' + n.e + ' ещё не вышла — эфир ' + n.dateStr + ' в 20:00'); return; }
    go(n.url + '?auto=1');
  }
  function goPrev() { var p = NV.prev(s, e); if (p) go(p.url); }

  /* ---------- тост ---------- */
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
    var d = duration();
    App.setPos(s, e, { t: Math.round(d), d: Math.round(d), done: true });
    var n = NV.next(s, e);
    if (n && n.status !== 'soon') App.setLast({ s: n.s, e: n.e, t: 0, ts: Date.now() });
    else App.store.del('last');
    showNextUp();
  }

  /* ---------- заглушка-«голограмма» (canvas) ---------- */
  var ctx = canvas.getContext('2d'), dpr = 1;
  function sizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(2, canvas.clientWidth * dpr);
    canvas.height = Math.max(2, canvas.clientHeight * dpr);
  }
  window.addEventListener('resize', sizeCanvas);

  function drawDemo() {
    if (mode !== 'demo') return;
    var W = canvas.width / dpr, H = canvas.height / dpr;
    if (W < 4) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var t = demo.t, cx = W / 2, horizon = H * 0.42;

    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04101e'); g.addColorStop(0.55, '#07203a'); g.addColorStop(1, '#03101f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* сетка-перспектива */
    ctx.strokeStyle = 'rgba(62,225,255,.14)'; ctx.lineWidth = 1;
    var off = (t * 0.6) % 1;
    for (var i = 0; i <= 12; i++) {
      var f = (i + off) / 12, y = horizon + f * f * (H - horizon);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (var k = -9; k <= 9; k++) {
      ctx.beginPath(); ctx.moveTo(cx + k * 26, horizon); ctx.lineTo(cx + k * W * 0.11, H); ctx.stroke();
    }

    /* луч-голограмма */
    var bg = ctx.createLinearGradient(0, H, 0, H * 0.1);
    bg.addColorStop(0, 'rgba(62,225,255,.30)'); bg.addColorStop(1, 'rgba(62,225,255,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(cx - 16, H); ctx.lineTo(cx - W * 0.16, H * 0.12);
    ctx.lineTo(cx + W * 0.16, H * 0.12); ctx.lineTo(cx + 16, H);
    ctx.closePath(); ctx.fill();

    /* кольца */
    for (var r = 0; r < 3; r++) {
      var ph = (t * 0.22 + r / 3) % 1;
      var ry = H - ph * H * 0.82, rx = 26 + ph * W * 0.16;
      ctx.strokeStyle = 'rgba(120,240,255,' + ((1 - ph) * 0.4).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(cx, ry, rx, rx * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    }

    /* глитч */
    var gs = Math.sin(t * 13.7) + Math.sin(t * 7.31 + 1.4);
    if (gs > 1.72) {
      for (var q = 0; q < 3; q++) {
        var seed = Math.floor(t * 20) * 37 + q * 101;
        var gy = (seed * 97) % H, gh = 3 + (seed % 9);
        ctx.fillStyle = q === 1 ? 'rgba(255,45,70,.20)' : 'rgba(62,225,255,.22)';
        ctx.fillRect((seed % 60) - 30, gy, W, gh);
      }
    }

    /* сканлайны */
    ctx.fillStyle = 'rgba(255,255,255,.028)';
    for (var sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);

    /* тексты */
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(62,225,255,.8)'; ctx.shadowBlur = 26;
    ctx.fillStyle = '#eaffff';
    ctx.font = '900 ' + Math.round(H * 0.105) + 'px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('НЕЙРОВАСЯ', cx, H * 0.40);
    ctx.shadowBlur = 12;
    ctx.font = '800 ' + Math.round(H * 0.052) + 'px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = '#9ff2ff';
    ctx.fillText('СЕЗОН ' + s + ' · СЕРИЯ ' + e, cx, H * 0.50);
    ctx.shadowBlur = 0;
    ctx.font = '600 ' + Math.round(H * 0.036) + 'px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = 'rgba(207,230,247,.85)';
    ctx.fillText('видеофайл серии загружается на Hugging Face', cx, H * 0.575);
    ctx.fillText('как только загрузится — плеер переключится сам', cx, H * 0.635);
    ctx.font = '700 ' + Math.round(H * 0.028) + 'px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,212,121,.75)';
    ctx.fillText('РЕЖИМ ЗАГЛУШКИ · ПЛЕЕР РАБОТАЕТ: ПЕРЕМОТКА, ПАУЗА, АВТОПЕРЕХОД', cx, H * 0.93);
  }

  function demoLoop(ts) {
    requestAnimationFrame(demoLoop);
    if (!demo.lastTs) demo.lastTs = ts;
    var dt = Math.min(0.25, (ts - demo.lastTs) / 1000);
    demo.lastTs = ts;
    if (demo.playing && ready) {
      demo.t += dt * rate;
      if (demo.t >= dur) { demo.t = dur; demo.playing = false; setPausedUI(true); onEnded(); }
      uiAcc += dt;
      if (uiAcc > 0.25) { uiAcc = 0; emitUI(); }
      saveAcc += dt;
      if (saveAcc > 3) { saveAcc = 0; save(); }
    }
    drawDemo();
  }

  /* ---------- поиск реального видео ---------- */
  var probeI = 0, probeTimeout = 0;
  var cands = NV.videoCandidates(s, e);
  function tryCandidate() {
    if (probeI >= cands.length) { startDemo(); return; }
    var src = cands[probeI++];
    var onErr = function () { cleanup(); tryCandidate(); };
    var onOk = function () { cleanup(); startVideo(); };
    function cleanup() {
      video.removeEventListener('error', onErr);
      video.removeEventListener('loadedmetadata', onOk);
      clearTimeout(probeTimeout);
    }
    video.addEventListener('error', onErr);
    video.addEventListener('loadedmetadata', onOk);
    video.preload = 'metadata';
    video.src = src;
    probeTimeout = setTimeout(onErr, 9000);
  }
  function startVideo() {
    mode = 'video'; ready = true;
    stage.classList.remove('demo');
    dur = isFinite(video.duration) && video.duration ? video.duration : dur;
    video.playbackRate = rate;
    var v = App.store.get('vol', 0.8);
    video.volume = v; vol.value = String(v);
    video.muted = App.store.get('mute', false);
    syncMuteIcon();
    afterReady();
  }
  function startDemo() {
    mode = 'demo'; ready = true;
    stage.classList.add('demo');
    dur = NV.config.demoDuration;
    vol.disabled = true; vol.title = 'Звук появится вместе с видео серии';
    btnMute.disabled = true;
    sizeCanvas();
    requestAnimationFrame(demoLoop);
    scheduleReprobe();
    afterReady();
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
    play();   // демо стартует всегда; реальное видео — если браузер разрешит autoplay
  }

  /* ---------- дозор: пока играем заглушку, следим за появлением файла на HF ----------
     Раз в 75 секунд тихонько пробуем кандидатов; как только файл долитился —
     переключаемся на настоящее видео с той же позиции, без перезагрузки. */
  function scheduleReprobe() {
    if (mode !== 'demo') return;
    setTimeout(reprobe, 75000);
  }
  function reprobe() {
    if (mode !== 'demo') return;
    var list = NV.videoCandidates(s, e), i = 0, settled = false;
    var pv = document.createElement('video');
    pv.preload = 'metadata';
    function next() {
      if (settled) return;
      if (i >= list.length) { settled = true; pv.removeAttribute('src'); scheduleReprobe(); return; }
      var src = list[i++];
      var to = setTimeout(function () {
        pv.removeEventListener('loadedmetadata', onOk);
        pv.removeEventListener('error', onErr);
        next();
      }, 8000);
      function onOk() {
        clearTimeout(to);
        pv.removeEventListener('error', onErr);
        settled = true;
        switchToVideo(src);
      }
      function onErr() {
        clearTimeout(to);
        pv.removeEventListener('loadedmetadata', onOk);
        next();
      }
      pv.addEventListener('loadedmetadata', onOk);
      pv.addEventListener('error', onErr);
      pv.src = src;
    }
    next();
  }
  function switchToVideo(src) {
    var t = demo.t, wasPlaying = demo.playing;
    demo.playing = false;
    mode = 'video';
    stage.classList.remove('demo');
    video.addEventListener('loadedmetadata', function once() {
      video.removeEventListener('loadedmetadata', once);
      dur = (isFinite(video.duration) && video.duration) ? video.duration : dur;
      try { video.currentTime = Math.min(t, Math.max(0, dur - 1)); } catch (err) {}
      video.playbackRate = rate;
      var v = App.store.get('vol', 0.8);
      video.volume = v; vol.value = String(v);
      vol.disabled = false; btnMute.disabled = false;
      video.muted = App.store.get('mute', false);
      syncMuteIcon();
      el('factDur').textContent = 'Длительность: ' + fmt(dur);
      emitUI();
      showToastText('Видео серии появилось на Hugging Face — включено настоящее воспроизведение');
      if (wasPlaying) play(); else setPausedUI(true);
    });
    video.src = src;
  }

  /* ---------- события видео ---------- */
  video.addEventListener('timeupdate', function () {
    emitUI();
    saveAcc += 0.25;
    if (saveAcc > 3) { saveAcc = 0; save(); }
  });
  video.addEventListener('progress', emitUI);
  video.addEventListener('play', function () { setPausedUI(false); });
  video.addEventListener('pause', function () { setPausedUI(true); save(); });
  video.addEventListener('ended', onEnded);
  video.addEventListener('ratechange', function () { rate = video.playbackRate; });
  video.addEventListener('error', function () {
    if (!ready || mode !== 'video') return;      // во время начальной пробы не мешаем
    mode = 'demo';
    stage.classList.add('demo');
    demo.playing = false;
    vol.disabled = true; btnMute.disabled = true;
    showToastText('Файл серии недоступен — снова режим заглушки');
    scheduleReprobe(); setPausedUI(true); emitUI();
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
    seek(f * duration());
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
    tlTip.textContent = fmt(f * duration());
    if (dragging) seekFromEvent(ev);
  });
  timeline.addEventListener('pointerup', function () { dragging = false; save(); });
  timeline.addEventListener('pointercancel', function () { dragging = false; });
  timeline.addEventListener('keydown', function (ev) {
    var step = ev.shiftKey ? 60 : 10;
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.stopPropagation(); seekBy(-step); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.stopPropagation(); seekBy(step); }
    else if (ev.key === 'Home') { ev.preventDefault(); ev.stopPropagation(); seek(0); }
    else if (ev.key === 'End') { ev.preventDefault(); ev.stopPropagation(); seek(duration() - 1); }
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
  emitUI();
  if (cands.length) tryCandidate(); else startDemo();
})();
