# -*- coding: utf-8 -*-
"""Генератор статического сайта «Нейровася» (v2, официальный пресс-стиль) для Vercel.
Запуск: python3 tools/build.py"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SPRITE = '''<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
<symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></symbol>
<symbol id="i-pause" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></symbol>
<symbol id="i-rew" viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="16.4" text-anchor="middle" font-size="7.2" font-weight="800" fill="currentColor" font-family="Arial">10</text></symbol>
<symbol id="i-fwd" viewBox="0 0 24 24"><g transform="matrix(-1,0,0,1,24,0)"><path d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></g><text x="12" y="16.4" text-anchor="middle" font-size="7.2" font-weight="800" fill="currentColor" font-family="Arial">10</text></symbol>
<symbol id="i-vol" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="i-mute" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M16 9l6 6m0-6l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="i-fs" viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z"/></symbol>
<symbol id="i-fsx" viewBox="0 0 24 24"><path d="M9 4v2H7v2H5V4h4zm6 0h4v4h-2V6h-2V4zM5 16h2v2h2v2H5v-4zm12 0h4v4h-4v-2h2v-2z"/></symbol>
<symbol id="i-next" viewBox="0 0 24 24"><path d="M6 6l8.5 6L6 18V6zm10 0h2.5v12H16z"/></symbol>
<symbol id="i-home" viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.8-13h-1.6v6l4.4 2.6.8-1.3-3.6-2.1V7z"/></symbol>
<symbol id="i-back" viewBox="0 0 24 24"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></symbol>
<symbol id="i-chevl" viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></symbol>
<symbol id="i-chevr" viewBox="0 0 24 24"><path d="M8.6 7.4 10 6l6 6-6 6-1.4-1.4L13.2 12z"/></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5 0 .9-.24 1.74-.66 2.46l1.45 1.45A6.96 6.96 0 0 0 20 13c0-3.87-3.13-7-7-7zm-5 7c0-.9.24-1.74.66-2.46L6.21 9.09A6.96 6.96 0 0 0 4 13c0 3.87 3.13 7 7 7v3l4-4-4-4v3c-2.76 0-5-2.24-5-5z"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><path d="M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2zM9 7a3 3 0 0 1 6 0v2H9V7zm4 8.72V17h-2v-1.28a2 2 0 1 1 2 0z"/></symbol>
<symbol id="i-undo" viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></symbol>
</svg>'''

HEAD = '''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#060b16">
<title>__TITLE__</title>
<meta name="description" content="__DESC__">
<meta property="og:title" content="__TITLE__">
<meta property="og:description" content="__DESC__">
<meta property="og:image" content="/assets/img/poster-wide.jpg">
<meta property="og:type" content="video.tv_show">
<meta property="og:locale" content="ru_RU">
<link rel="icon" type="image/webp" href="/assets/img/poster.webp">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/assets/css/style.css?v=261104d">
</head>'''

HEADER = '''<header class="site-head">
<a class="logo" href="/">НЕЙРО<b>ВАСЯ</b><small>фан-сайт сериала</small></a>
<nav>
<a href="/#seasons">Серии</a>
<a href="/#schedule">Эфир</a>
<a href="/#cast">В ролях</a>
<a href="/#about">О сериале</a>
</nav>
<button class="refresh-btn" id="btnRefresh" title="Обновить страницу без кэша (Ctrl+F5)"><svg viewBox="0 0 24 24"><use href="#i-refresh"/></svg>Обновить</button>
<span class="age">16+</span>
</header>'''

FOOTER = '''<footer>
<div class="container foot-grid">
  <div>
    <div class="f-logo">НЕЙРО<b>ВАСЯ</b></div>
    <p>Неофициальная фан-страница комедийного сериала телеканала ТНТ. Сайт работает в
    техническом режиме: видеофайлы серий загружаются в облачное хранилище,
    плеер активируется автоматически после появления каждого файла.</p>
  </div>
  <div>
    <b class="hd">Эфир</b>
    <ul>
      <li>Сезон 1 — 2025 · 20 серий</li>
      <li>Сезон 2 — с 02.11.2026 · 16 серий</li>
      <li>Понедельник–четверг, 20:00</li>
      <li>Телеканал ТНТ</li>
    </ul>
  </div>
  <div>
    <b class="hd">Разделы</b>
    <ul>
      <li><a href="/#seasons">Все серии</a></li>
      <li><a href="/#schedule">Расписание эфира</a></li>
      <li><a href="/#cast">Актёры и роли</a></li>
      <li><a href="/#about">О сериале</a></li>
      <li><a href="/season-2/episode-01">Премьера 2 сезона</a></li>
    </ul>
  </div>
</div>
<div class="container foot-note">
<span>© 2025–2026 · фан-проект. Сериал «Нейровася» и все связанные материалы принадлежат ТНТ и правообладателям.</span>
<span>16+</span>
</div>
</footer>'''

SCRIPTS = '''<script src="/assets/js/data.js?v=261104d"></script>
<script src="/assets/js/app.js?v=261104d"></script>__PLAYER__
</body>
</html>'''

INDEX = '''<body data-page="home">
__SPRITE__
__HEADER__
<section class="hero">
  <div class="hero-bg"><img src="/assets/img/poster-wide.jpg" alt="Нейровася — официальный ключевой арт 2 сезона"></div>
  <div class="hero-in container">
    <div class="hero-poster-wrap">
      <img class="hero-poster" src="/assets/img/poster.webp" alt="Нейровася — постер" width="220" height="330">
      <div class="hero-poster-cap">ключевой арт · сезон 2</div>
    </div>
    <div>
      <div class="badge-row">
        <span class="badge red">2 сезон · в эфире</span>
        <span class="badge ghost">телеканал ТНТ · комедия</span>
      </div>
      <h1 class="title">Нейровася</h1>
      <p class="title-sub">с 2 ноября 2026 · понедельник–четверг · 20:00</p>
      <p class="tagline">Опер Вася Фролов раскрывает дела по старинке, а нейросеть «Света» —
      по последнему слову техники. Комедия о том, как трудно идти в ногу со временем,
      когда время — голограмма.</p>
      <div class="cta-row" id="ctaRow"></div>
    </div>
  </div>
  <div class="hero-facts">
    <div><b>Премьера 1 сезона</b><span>2025 · 20 серий</span></div>
    <div><b>Премьера 2 сезона</b><span>02.11.2026 · 16 серий</span></div>
    <div><b>Эфир на ТНТ</b><span>пн–чт · 20:00</span></div>
    <div><b>Возрастная марка</b><span>16+</span></div>
  </div>
</section>

<main>
<section class="container block">
  <div class="slabel">состояние сайта</div>
  <div class="status-board">
    <div class="sb-head"><h3>Техническое объявление</h3><span class="live"><span class="pulse-dot"></span>обновляется в реальном времени</span></div>
    <div class="sb-row"><span class="dot ok"></span><b>Видео 1 сезона</b><span class="val">1 сезон уже на серверах сайта: страницы серий открывают видео автоматически. Первые 6 серий 2 сезона скоро загрузятся на серверы — плеер включит их сам, остальные серии 2 сезона появятся позже.</span></div>
    <div class="sb-row"><span class="dot wait"></span><b>Плеер</b><span class="val">не показывает «пустой» плеер: пока файла нет — аккуратная статус-карточка, а при его появлении плеер активируется сам: перемотка, скорость, автопереход, сохранение позиции, поддержка Android TV.</span></div>
    <div class="sb-row"><span class="dot ok"></span><b>Эфир 2 сезона (ТНТ)</b><span class="val">идёт: с 2 ноября 2026 года, понедельник–четверг в 20:00. На сайте серии 2 сезона открываются по мере загрузки на серверы: у каждой серии страница честно показывает свой статус.</span></div>
    <div class="sb-row"><span class="dot ok"></span><b>Сезон 1</b><span class="val">полностью в эфире (2025, 20 серий). Страницы всех серий опубликованы и откроют видео, как только файлы будут загружены.</span></div>
  </div>
</section>

<section class="container block hidden" id="continueSec"></section>

<section class="container block" id="seasons">
  <div class="slabel">01 · каталог</div>
  <h2 class="sec-h">Все <span>серии</span></h2>
  <div class="tabs" id="tabs" role="tablist"></div>
  <div class="sec-tools">
    <button class="btn btn-ghost btn-sm hidden" id="btnResetAll" type="button"><svg viewBox="0 0 24 24"><use href="#i-undo"/></svg><span>Сбросить весь прогресс</span></button>
  </div>
  <div class="grid" id="grid"></div>
</section>

<section class="container block" id="schedule">
  <div class="slabel">02 · эфир ТНТ</div>
  <h2 class="sec-h">Расписание <span>2 сезона</span></h2>
  <div class="sched" id="sched"></div>
  <p class="sched-note">Даты эфира — по сетке вещания ТНТ (понедельник–четверг, 20:00). Страница серии на сайте открывается в день эфира.</p>
</section>

<section class="container block" id="cast">
  <div class="slabel">03 · состав</div>
  <h2 class="sec-h">В главных <span>ролях</span></h2>
  <div class="cast">
    <div class="cast-card"><span class="avatar">ВЕ</span><div><div class="n">Владимир Епифанцев</div><div class="r">Василий «Вася» Фролов — майор полиции, опер</div><span class="lead">главная роль</span></div></div>
    <div class="cast-card"><span class="avatar">ДБ</span><div><div class="n">Дарья Блохина</div><div class="r">Света (svt 1.9) — голограмма-нейросеть</div><span class="lead">главная роль</span></div></div>
    <div class="cast-card"><span class="avatar">АП</span><div><div class="n">Анастасия Панина</div><div class="r">Алёна Фролова — жена Васи</div></div></div>
    <div class="cast-card"><span class="avatar">ЮИ</span><div><div class="n">Юлия Ильина</div><div class="r">Даша</div></div></div>
  </div>
  <p class="sched-note">Режиссёр — Георгий Даниелянц. Производство: телеканал ТНТ. В ролях также Светлана Камынина, Михаил Тарабукин, Роберт Захарян и другие.</p>
</section>

<section class="container block" id="about">
  <div class="slabel">04 · справка</div>
  <h2 class="sec-h">О <span>сериале</span></h2>
  <div class="about">
    <div>
      <p>«Нейровася» — комедия телеканала ТНТ о полицейском старой закалки. Василий Фролов
      (Владимир Епифанцев) привык раскрывать дела по старинке: интуиция, опыт и никаких
      «ваших интернетов». Но после развода и череды служебных неурядиц в пару ему достаётся
      передовая нейросеть «Света» — голограмма, которая умеет всё: взламывать базы, строить
      версии и выводить Васю из себя.</p>
      <p>Первый сезон из 20 серий вышел в 2025 году и стал одним из заметных комедийных
      хитов канала. Второй сезон из 16 серий стартовал 2 ноября 2026 года и выходит
      по будням — с понедельника по четверг в 20:00.</p>
    </div>
    <ul class="facts">
      <li><b>Канал</b><span>ТНТ</span></li>
      <li><b>Жанр</b><span>комедия</span></li>
      <li><b>Режиссёр</b><span>Георгий Даниелянц</span></li>
      <li><b>Сезон 1</b><span>2025 · 20 серий</span></li>
      <li><b>Сезон 2</b><span>с 02.11.2026 · 16 серий</span></li>
      <li><b>Эфир 2 сезона</b><span>пн–чт, 20:00</span></li>
      <li><b>Возраст</b><span>16+</span></li>
    </ul>
  </div>
</section>
</main>
__FOOTER__
__SCRIPTS__'''

WATCH = '''<body data-page="watch" data-s="__S__" data-e="__E__">
__SPRITE__
__HEADER__
<main class="container-wide">
  <nav class="crumbs" aria-label="Навигация">
    <a href="/">Главная</a><svg viewBox="0 0 24 24" width="13" height="13"><use href="#i-chevr"/></svg>
    <a href="/#seasons">Сезон __S__</a><svg viewBox="0 0 24 24" width="13" height="13"><use href="#i-chevr"/></svg>
    <span>Серия __E__</span>
  </nav>
  <div class="watch-head">
    <div class="ep-label">
      <h1>Серия __E__</h1>
      <span class="sn">сезон __S__</span>
      <span class="badge dim" id="epBadge"></span>
    </div>
  </div>

  <div class="stage-wrap">
    <div class="stage paused" id="stage" tabindex="0" aria-label="Плеер серии __S__x__E__">
      <video id="video" playsinline preload="metadata"></video>

      <div class="topbar">
        <span class="tl-lbl" id="topLabel"></span>
        <span class="fmt-chip hidden" id="fmtChip"></span>
        <span class="spacer"></span>
        <label class="auto-switch"><input type="checkbox" id="autoNext" checked>авто-следующая</label>
      </div>

      <button class="big-play" id="bigPlay" aria-label="Смотреть"><svg viewBox="0 0 24 24"><use href="#i-play"/></svg></button>

      <div class="controls" id="controls">
        <div class="timeline" id="timeline" role="slider" tabindex="0" aria-label="Перемотка" aria-valuemin="0">
          <div class="tl-buffer"></div>
          <div class="tl-played"></div>
          <div class="tl-handle"></div>
          <div class="tl-tip">00:00</div>
        </div>
        <div class="ctl-row">
          <button id="btnPlay" aria-label="Пауза"><svg viewBox="0 0 24 24"><use href="#i-play"/></svg></button>
          <button id="btnBack10" aria-label="Назад на 10 секунд"><svg viewBox="0 0 24 24"><use href="#i-rew"/></svg></button>
          <button id="btnFwd10" aria-label="Вперёд на 10 секунд"><svg viewBox="0 0 24 24"><use href="#i-fwd"/></svg></button>
          <span class="time" id="timeLbl">--:-- / --:--</span>
          <span class="spacer"></span>
          <button id="btnRate" aria-label="Скорость воспроизведения">×1</button>
          <button id="btnMute" aria-label="Звук"><svg viewBox="0 0 24 24"><use href="#i-vol"/></svg></button>
          <input type="range" id="vol" min="0" max="1" step="0.05" value="0.8" aria-label="Громкость">
          <button id="btnNext" aria-label="Следующая серия"><svg viewBox="0 0 24 24"><use href="#i-next"/></svg></button>
          <button id="btnFs" aria-label="Во весь экран"><svg viewBox="0 0 24 24"><use href="#i-fs"/></svg></button>
        </div>
      </div>

      <div class="overlay hidden" id="nextUp">
        <div class="nu-card">
          <div class="nu-ring">
            <svg viewBox="0 0 74 74"><circle class="bgc" cx="37" cy="37" r="32"></circle><circle class="fgc" cx="37" cy="37" r="32"></circle></svg>
            <b>12</b>
          </div>
          <div class="nu-body"></div>
        </div>
      </div>

      <div class="overlay hidden" id="statePanel"></div>
      <div class="toast hidden" id="resumeToast"></div>
    </div>
  </div>

  <div class="hints">
    <span><kbd>←</kbd><kbd>→</kbd> перемотка 10 с</span>
    <span><kbd>OK</kbd>/<kbd>Space</kbd> пауза</span>
    <span><kbd>↓</kbd> пульт плеера</span>
    <span><kbd>0–9</kbd> к проценту времени</span>
    <span><kbd>N</kbd> следующая серия</span>
    <span><kbd>F</kbd> весь экран</span>
    <span><kbd>Назад</kbd> выход</span>
    <span class="muted">на Android TV — стрелки и OK пульта</span>
  </div>

  <section class="ep-info">
    <div class="ep-info-grid">
      <div>
        <div class="slabel">карточка серии</div>
        <h2 class="sec-h">О серии <span>__E__</span></h2>
        <p class="muted">Синопсис серии будет опубликован вместе с видео. Страница уже готова:
        статусы эфира и загрузки, навигация по сезону, а плеер активируется автоматически,
        как только серия появится на серверах сайта — перезагружать страницу не придётся.</p>
        <ul class="ep-facts" id="epFacts"></ul>
      </div>
      <aside>
        <div class="status-panel" id="spPanel"></div>
        <div class="side-tools">
          <button class="btn btn-ghost btn-sm hidden" id="btnResetEp" type="button"><svg viewBox="0 0 24 24"><use href="#i-undo"/></svg><span>Сбросить отметку просмотра</span></button>
        </div>
        <div class="ep-nav">
          <a class="nav-card" id="prevCard" href="#"></a>
          <a class="nav-card" id="nextCard" href="#"></a>
        </div>
      </aside>
    </div>
    <div class="slabel" style="margin-top:30px">серии сезона</div>
    <h2 class="sec-h">Сезон <span id="stripSeason"></span> · все серии</h2>
    <div class="strip" id="strip"></div>
  </section>
</main>
__FOOTER__
__SCRIPTS__'''

ERR404 = '''<body data-page="404">
__SPRITE__
__HEADER__
<main class="err">
  <div>
    <h1>404</h1>
    <p>Страница потерялась, как отчёт Васи Фролова. Зато все серии — на месте.</p>
    <a class="btn btn-primary" href="/"><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor"><use href="#i-home"/></svg>На главную</a>
  </div>
</main>
__FOOTER__
__SCRIPTS__'''


def page(title, desc, body, player=False):
    html = HEAD.replace('__TITLE__', title).replace('__DESC__', desc)
    html += '\n' + body
    html = (html.replace('__SPRITE__', SPRITE).replace('__HEADER__', HEADER)
                .replace('__FOOTER__', FOOTER)
                .replace('__SCRIPTS__', SCRIPTS.replace('__PLAYER__', '\n<script src="/assets/js/player.js?v=261104d"></script>' if player else '')))
    return html


def build():
    desc_home = ('Нейровася — комедия ТНТ. 1 сезон (2025, 20 серий) и 2 сезон '
                 '(с 02.11.2026, 16 серий, пн–чт 20:00). Расписание эфира, актёры и все серии онлайн: '
                 'плеер с перемоткой, автопереходом и поддержкой Android TV.')
    with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(page('Нейровася — все сезоны и серии смотреть онлайн', desc_home, INDEX))

    with open(os.path.join(ROOT, '404.html'), 'w', encoding='utf-8') as f:
        f.write(page('404 — Нейровася', 'Страница не найдена', ERR404))

    counts = {1: 20, 2: 16}
    for s, cnt in counts.items():
        d = os.path.join(ROOT, 'season-%d' % s)
        os.makedirs(d, exist_ok=True)
        for e in range(1, cnt + 1):
            body = WATCH.replace('__S__', str(s)).replace('__E__', str(e))
            title = 'Нейровася — %d сезон, %d серия — смотреть онлайн' % (s, e)
            desc = ('Нейровася, сезон %d, серия %d. Статус эфира, расписание и плеер с перемоткой, '
                    'автопереходом и поддержкой Android TV. Видео серии активируется после загрузки.' % (s, e))
            with open(os.path.join(d, 'episode-%02d.html' % e), 'w', encoding='utf-8') as f:
                f.write(page(title, desc, body, player=True))
    print('OK: index.html, 404.html, season-1 (20), season-2 (16)')


if __name__ == '__main__':
    build()
