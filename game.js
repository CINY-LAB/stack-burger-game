(function () {
  'use strict';

  // ---------- 스프라이트 (freeBuns.png 288x272, [x, y, w, h]) ----------
  var SHEET_W = 288, SHEET_H = 272;
  var ITEMS = {
    bunBottom: { name: '아랫빵', r: [34, 12, 28, 19] },
    lettuce:   { name: '양상추', r: [65, 9, 30, 18] },
    patty:     { name: '고기',   r: [98, 8, 28, 18] },
    cheese:    { name: '치즈',   r: [128, 5, 31, 23] },
    tomato:    { name: '토마토', r: [160, 5, 29, 23] },
    bunTop:    { name: '윗빵',   r: [193, 2, 30, 20] },
    fries:     { name: '감자튀김', r: [5, 35, 21, 28], side: true },
    nuggets:   { name: '치킨너겟', r: [132, 102, 25, 24], side: true },
    cola:      { name: '콜라',   r: [39, 68, 18, 28], side: true }
  };
  var CELL_ORDER = ['bunBottom', 'lettuce', 'patty', 'cheese', 'tomato', 'bunTop', 'fries', 'nuggets', 'cola'];
  var INNER = ['lettuce', 'patty', 'cheese', 'tomato'];
  var SIDES = ['fries', 'nuggets', 'cola'];
  var MAX_STACK = 12;
  var GAME_SEC = 60;
  var STORE_KEY = 'stackBurger.records';

  function sprite(key, s) {
    var r = ITEMS[key].r, d = document.createElement('div');
    d.className = 'sprite';
    d.style.width = r[2] * s + 'px';
    d.style.height = r[3] * s + 'px';
    d.style.backgroundSize = SHEET_W * s + 'px ' + SHEET_H * s + 'px';
    d.style.backgroundPosition = -r[0] * s + 'px ' + -r[1] * s + 'px';
    return d;
  }

  function $(id) { return document.getElementById(id); }
  function rnd(n) { return Math.floor(Math.random() * n); }

  // ---------- 효과음 (Web Audio) ----------
  var audio = null;
  var soundOn = localStorage.getItem('stackBurger.sound') !== 'off';

  function ensureAudio() {
    if (!audio) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audio = new AC();
    }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }
  function tone(freq, start, dur, type, vol) {
    if (!soundOn) return;
    var a = ensureAudio();
    if (!a) return;
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + start;
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var sfx = {
    move:  function () { tone(900, 0, 0.03, 'square', 0.04); },
    pick:  function () { tone(330, 0, 0.09, 'sine', 0.12); tone(440, 0.04, 0.08, 'sine', 0.08); },
    reset: function () { tone(110, 0, 0.3, 'sawtooth', 0.1); },
    done:  function () { tone(523, 0, 0.1, 'triangle', 0.14); tone(784, 0.1, 0.16, 'triangle', 0.14); },
    combo: function () { tone(988, 0.22, 0.12, 'triangle', 0.12); tone(1319, 0.32, 0.16, 'triangle', 0.12); },
    tick:  function () { tone(1200, 0, 0.04, 'square', 0.05); },
    end:   function () { tone(440, 0, 0.15, 'triangle', 0.14); tone(330, 0.15, 0.15, 'triangle', 0.14); tone(220, 0.3, 0.35, 'triangle', 0.14); }
  };

  // ---------- 화면 전환 ----------
  var current = 'main';
  function show(name) {
    current = name;
    ['main', 'game', 'result', 'records'].forEach(function (n) {
      $('screen-' + n).classList.toggle('active', n === name);
    });
    if (name === 'main') { heroStart(); } else { heroStop(); }
  }

  // ---------- 메인 햄버거 연출 ----------
  var HERO_LAYERS = ['bunBottom', 'lettuce', 'patty', 'cheese', 'tomato', 'bunTop'];
  var HERO_SCALE = 6, HERO_CYCLE = 8.5;
  var heroEls = [], heroRaf = 0, heroT0 = 0;

  function heroBuild() {
    var hero = $('hero');
    hero.innerHTML = '';
    heroEls = HERO_LAYERS.map(function (k) {
      var e = sprite(k, HERO_SCALE);
      hero.appendChild(e);
      return e;
    });
  }
  function heroFrame(now) {
    var t = ((now - heroT0) / 1000) % HERO_CYCLE;
    var gap = 22, y = 0;
    // 3.8초 이후 간격이 줄며 합쳐지고, 7.4초부터 사라짐
    if (t > 3.8) { var q = Math.min(1, (t - 3.8) / 0.5); gap = 22 - q * 24; }
    var bounce = 0;
    if (t > 4.3 && t < 4.7) bounce = Math.sin((t - 4.3) / 0.4 * Math.PI) * 6;
    var fade = t > 7.4 ? Math.max(0, 1 - (t - 7.4) / 0.9) : 1;
    HERO_LAYERS.forEach(function (k, i) {
      var h = ITEMS[k].r[3] * HERO_SCALE, w = ITEMS[k].r[2] * HERO_SCALE;
      var start = 0.3 + i * 0.6, p = Math.min(1, Math.max(0, (t - start) / 0.5));
      var ease = 1 - Math.pow(1 - p, 3);
      var drop = (1 - ease) * 300;
      var e = heroEls[i];
      e.style.bottom = y + 'px';
      e.style.opacity = p * fade;
      e.style.transform = 'translate(-50%,' + (-drop + bounce * (i / 5) * -1) + 'px)';
      y += h * 0.55 + gap;
      void w;
    });
    heroRaf = requestAnimationFrame(heroFrame);
  }
  function heroStart() {
    heroStop();
    if (!heroEls.length) heroBuild();
    heroT0 = performance.now();
    heroRaf = requestAnimationFrame(heroFrame);
  }
  function heroStop() { if (heroRaf) cancelAnimationFrame(heroRaf); heroRaf = 0; }

  // ---------- 게임 상태 ----------
  var G = null;

  function orderKey(o) {
    return (o.hasBurger ? o.inner.join(',') : '-') + '|' + o.sides.slice().sort().join(',');
  }
  function newOrder(mode, prev) {
    var o, tries = 0;
    do {
      var hasBurger = Math.random() < 0.75;
      var sideCnt = rnd(4), sides = SIDES.slice();
      var picked = [];
      while (picked.length < sideCnt) picked.push(sides.splice(rnd(sides.length), 1)[0]);
      var inner = [];
      if (hasBurger) {
        var n = mode === 'hard' ? 3 + rnd(4) : 1 + rnd(3);
        for (var i = 0; i < n; i++) inner.push(INNER[rnd(INNER.length)]);
      }
      o = { hasBurger: hasBurger, inner: inner, sides: picked };
      tries++;
    } while ((!hasBurger && picked.length === 0 || (prev && orderKey(o) === orderKey(prev))) && tries < 200);
    return o;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function startGame() {
    ensureAudio();
    var nick = $('nick').value.replace(/^\s+|\s+$/g, '').slice(0, 10) || '아무개';
    G = {
      mode: selectedMode, nick: nick,
      score: 0, count: 0, combo: 0, maxCombo: 0,
      cells: CELL_ORDER.slice(), cursor: 0,
      order: null, stack: [], sides: [], burgerDone: false,
      endAt: performance.now() + GAME_SEC * 1000, lastSec: GAME_SEC, timer: 0, over: false
    };
    show('game');
    nextOrder(true);
    renderHud();
    G.timer = setInterval(tick, 100);
    tick();
  }

  function nextOrder(first) {
    G.order = newOrder(G.mode, G.order);
    G.stack = []; G.sides = []; G.burgerDone = false;
    if (G.mode === 'hard') { G.cells = shuffle(CELL_ORDER.slice()); G.cursor = 0; }
    renderCells();
    renderBoards();
    void first;
  }

  function tick() {
    if (!G || G.over) return;
    var left = Math.max(0, G.endAt - performance.now());
    var sec = Math.ceil(left / 1000);
    $('hud-time').textContent = sec;
    var bar = $('timebar');
    bar.style.width = left / (GAME_SEC * 10) + '%';
    bar.classList.toggle('warn', sec <= 10);
    if (sec !== G.lastSec) {
      G.lastSec = sec;
      if (sec <= 10 && sec > 0) sfx.tick();
    }
    if (left <= 0) endGame();
  }

  function renderHud() {
    $('hud-score').textContent = G.score;
    $('hud-count').textContent = G.count;
    $('hud-combo').textContent = G.combo;
  }

  function stackEl(arr, s) {
    var st = document.createElement('div');
    st.className = 'stack';
    arr.forEach(function (k, i) {
      var e = sprite(k, s);
      if (i > 0) e.style.marginBottom = -Math.round(ITEMS[k].r[3] * s * 0.45) + 'px';
      st.appendChild(e);
    });
    return st;
  }
  function sidesEl(arr, s) {
    var d = document.createElement('div');
    d.className = 'sides';
    SIDES.forEach(function (k) { if (arr.indexOf(k) >= 0) d.appendChild(sprite(k, s)); });
    return d;
  }
  function renderBoards() {
    var o = G.order, op = $('order'), tp = $('tray');
    op.innerHTML = ''; tp.innerHTML = '';
    if (o.hasBurger) op.appendChild(stackEl(['bunBottom'].concat(o.inner, ['bunTop']), 3));
    if (o.sides.length) op.appendChild(sidesEl(o.sides, 2));
    if (G.stack.length) tp.appendChild(stackEl(G.stack, 3));
    if (G.sides.length) tp.appendChild(sidesEl(G.sides, 2));
  }
  function renderCells() {
    var box = $('cells');
    box.innerHTML = '';
    G.cells.forEach(function (k, i) {
      var c = document.createElement('div');
      c.className = 'cell' + (i === G.cursor ? ' cursor' : '');
      c.dataset.idx = i;
      c.appendChild(sprite(k, 2));
      var l = document.createElement('span');
      l.textContent = ITEMS[k].name;
      c.appendChild(l);
      c.addEventListener('click', function () { choose(i); });
      box.appendChild(c);
    });
  }
  function updateCursor() {
    var cs = $('cells').children;
    for (var i = 0; i < cs.length; i++) cs[i].classList.toggle('cursor', i === G.cursor);
  }

  function moveCursor(d) {
    var n = G.cells.length;
    G.cursor = (G.cursor + d + n) % n;
    updateCursor();
    sfx.move();
  }

  // 선택: 커서 위치와 무관하게 idx 칸을 고름 (키보드는 커서 칸, 마우스는 클릭한 칸)
  function choose(idx) {
    if (!G || G.over) return;
    var k = G.cells[idx];
    if (ITEMS[k].side) {
      var p = G.sides.indexOf(k);
      if (p >= 0) G.sides.splice(p, 1); else G.sides.push(k);
      sfx.pick();
    } else if (k === 'bunTop') {
      if (G.burgerDone) return;
      G.stack.push(k);
      judgeBurger();
    } else {
      if (G.burgerDone || G.stack.length >= MAX_STACK - 1) return;
      G.stack.push(k);
      sfx.pick();
    }
    renderBoards();
    checkComplete();
  }

  // 윗빵을 올릴 때만 비교. 다르면 햄버거만 초기화, 감점 없음, 콤보 0
  function judgeBurger() {
    var want = ['bunBottom'].concat(G.order.inner, ['bunTop']);
    var ok = want.length === G.stack.length && want.every(function (k, i) { return k === G.stack[i]; });
    if (ok) {
      G.burgerDone = true;
      sfx.pick();
    } else {
      G.stack = [];
      G.combo = 0;
      renderHud();
      sfx.reset();
      var t = $('tray');
      t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
    }
  }

  function checkComplete() {
    var o = G.order;
    if (o.hasBurger && !G.burgerDone) return;
    if (G.sides.length !== o.sides.length) return;
    for (var i = 0; i < o.sides.length; i++) if (G.sides.indexOf(o.sides[i]) < 0) return;
    // 주문 완성
    var pts = ((o.hasBurger ? o.inner.length : 0) + o.sides.length) * 10;
    G.combo++;
    if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    var bonus = G.combo >= 2 ? Math.min(G.combo - 1, 5) * 10 : 0;
    G.score += pts + bonus;
    G.count++;
    renderHud();
    sfx.done();
    if (bonus) sfx.combo();
    var od = $('order');
    od.classList.remove('pop'); void od.offsetWidth; od.classList.add('pop');
    nextOrder();
  }

  function clearTray() {
    if (!G || G.over) return;
    G.stack = []; G.sides = []; G.burgerDone = false;
    renderBoards();
    sfx.reset();
  }

  // ---------- 결과 / 기록 ----------
  function loadRecords() {
    try { var r = JSON.parse(localStorage.getItem(STORE_KEY)); return Array.isArray(r) ? r : []; }
    catch (e) { return []; }
  }
  function sortRecs(a, b) { return b.score - a.score || b.count - a.count; }

  function saveRecord(rec) {
    var all = loadRecords(), keep = [];
    all.push(rec);
    ['easy', 'hard'].forEach(function (m) {
      keep = keep.concat(all.filter(function (r) { return r.mode === m; }).sort(sortRecs).slice(0, 10));
    });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(keep)); } catch (e) { /* 저장 불가 시 무시 */ }
    var list = keep.filter(function (r) { return r.mode === rec.mode; }).sort(sortRecs);
    return list.indexOf(rec) + 1; // 순위권 밖이면 0
  }

  function endGame() {
    if (!G || G.over) return;
    G.over = true;
    clearInterval(G.timer);
    sfx.end();
    var rec = { nick: G.nick, mode: G.mode, score: G.score, count: G.count, combo: G.maxCombo, at: Date.now() };
    var rank = saveRecord(rec);
    $('r-count').textContent = G.count;
    $('r-score').textContent = G.score;
    $('r-combo').textContent = G.maxCombo;
    $('r-rank').textContent = rank ? (G.mode === 'hard' ? '하드' : '이지') + ' 모드 ' + rank + '위!' : '기록 10위 밖이에요';
    lastRecAt = rec.at;
    show('result');
  }

  var lastRecAt = 0, recMode = 'easy';
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function renderRecords() {
    var rows = loadRecords().filter(function (r) { return r.mode === recMode; }).sort(sortRecs).slice(0, 10);
    var tb = document.querySelector('#rec-table tbody');
    tb.innerHTML = '';
    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="6">아직 기록이 없어요</td></tr>';
    }
    rows.forEach(function (r, i) {
      var d = new Date(r.at), tr = document.createElement('tr');
      var cells = [i + 1, r.nick, r.score, r.count, r.combo,
        (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())];
      cells.forEach(function (v) {
        var td = document.createElement('td');
        td.textContent = v; // 닉네임은 textContent 로만 넣음
        if (r.at === lastRecAt) td.className = 'me';
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.rtab'), function (b) {
      b.classList.toggle('active', b.dataset.mode === recMode);
    });
  }

  // ---------- 메인 화면 컨트롤 ----------
  var selectedMode = 'easy';
  Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (b) {
    b.addEventListener('click', function () {
      selectedMode = b.dataset.mode;
      Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (x) {
        x.classList.toggle('active', x === b);
      });
      b.blur();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.rtab'), function (b) {
    b.addEventListener('click', function () { recMode = b.dataset.mode; renderRecords(); b.blur(); });
  });
  function syncSoundBtn() { $('btn-sound').textContent = soundOn ? '소리 켜짐' : '소리 꺼짐'; }
  $('btn-sound').addEventListener('click', function () {
    soundOn = !soundOn;
    localStorage.setItem('stackBurger.sound', soundOn ? 'on' : 'off');
    syncSoundBtn();
    if (soundOn) { ensureAudio(); sfx.pick(); }
    this.blur();
  });
  $('btn-start').addEventListener('click', startGame);
  $('btn-records').addEventListener('click', function () { recMode = selectedMode; lastRecAt = 0; renderRecords(); show('records'); });
  $('btn-rec-back').addEventListener('click', function () { show('main'); });
  $('btn-clear').addEventListener('click', function () { clearTray(); this.blur(); });
  $('btn-retry').addEventListener('click', startGame);
  $('btn-home').addEventListener('click', function () { show('main'); });

  // ---------- 키보드 ----------
  document.addEventListener('keydown', function (e) {
    if (e.repeat && current !== 'game') return;
    var k = e.key;
    if (current === 'game') {
      if (k === 'ArrowLeft') { e.preventDefault(); moveCursor(-1); }
      else if (k === 'ArrowRight') { e.preventDefault(); moveCursor(1); }
      else if (k === ' ' || k === 'Spacebar') { e.preventDefault(); if (!e.repeat) choose(G.cursor); }
      else if (k === 'Escape') { e.preventDefault(); clearTray(); }
    } else if (current === 'main') {
      if (k === 'Enter') { e.preventDefault(); startGame(); }
    } else if (current === 'result') {
      if (k === 'Enter') { e.preventDefault(); startGame(); }
      else if (k === 'Escape') { show('main'); }
    } else if (current === 'records') {
      if (k === 'Escape') { show('main'); }
    }
  });

  syncSoundBtn();
  show('main');
})();
