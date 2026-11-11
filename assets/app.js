/* airports: search by code, city or name; recently viewed; live clock; table filter; distance calculator */
(function () {
  'use strict';
  var d = document, S = window.SYG, $ = function (s, r) { return (r || d).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var KEY = 'syg-airports-recent';
  var plain = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var IDX = null, wait = null;
  var load = function () { return wait || (wait = S.json('/data/idx.json').then(function (j) { IDX = j; j.forEach(function (r) { r.q = plain(r[1] + ' ' + r[2]); r.c = plain(r[2]); }); return j; })); };
  /* best matches: exact code, then code prefix, then city prefix, then anything; airports with scheduled flights first */
  var find = function (v, n) {
    v = plain(v.trim());
    if (v.length < 2) return [];
    var a = [], b = [], c = [], e = [];
    IDX.forEach(function (r) {
      var code = r[0].toLowerCase();
      if (code === v) a.push(r); else if (v.length < 3 && code.indexOf(v) === 0) b.push(r); else if (r.c.indexOf(v) === 0) c.push(r); else if (r.q.indexOf(v) > -1) e.push(r);
    });
    var sched = function (x, y) { return y[4] - x[4]; };
    return a.concat(b.sort(sched), c.sort(sched), e.sort(sched)).slice(0, n || 8);
  };
  var label = function (r) { return '<b>' + r[0] + '</b> ' + S.esc(r[1]) + ' <small>' + S.esc([r[2], r[3]].filter(Boolean).join(', ')) + '</small>'; };

  /* airport page */
  var art = $('[data-a]');
  if (art) S.recent(KEY, { u: '/' + art.getAttribute('data-a') + '/', t: art.getAttribute('data-name') });
  var ck = $('.clock[data-tz]');
  if (ck) {
    var tick = function () {
      try { $('b', ck).textContent = new Intl.DateTimeFormat('en-GB', { timeZone: ck.getAttribute('data-tz'), weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
      catch (e) { ck.hidden = true; }
    };
    tick(); setInterval(tick, 15000);
  }

  /* a search box with suggestions; pick(row) is called when one is chosen */
  var box = function (inp, sug, pick) {
    var paint = function () {
      if (inp.value.trim().length < 2) { sug.hidden = true; return; }
      load().then(function () {
        var m = find(inp.value);
        sug.innerHTML = m.length ? m.map(function (r) { return '<li><button type="button" data-code="' + r[0] + '">' + label(r) + '</button></li>'; }).join('') : '<li class="none">No airport matches. Try the city name or the three-letter code.</li>';
        sug.hidden = false;
      }).catch(function () { sug.hidden = false; sug.innerHTML = '<li class="none">The airport list could not be loaded. Check your connection.</li>'; });
    };
    var choose = function (code) { var r = IDX.filter(function (x) { return x[0] === code; })[0]; if (r) { sug.hidden = true; pick(r); } };
    inp.addEventListener('focus', function () { load().catch(function () {}); });
    inp.addEventListener('input', paint);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var b = $('button', sug); if (b && !sug.hidden) choose(b.getAttribute('data-code')); } if (e.key === 'Escape') sug.hidden = true; });
    sug.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) choose(b.getAttribute('data-code')); });
  };

  /* home */
  var q = $('#q');
  if (q) {
    box(q, $('#sug'), function (r) {
      if (r[4]) location.href = '/' + r[0].toLowerCase() + '-airport/';
      else { q.value = r[0]; S.toast(r[0] + ' is ' + r[1] + (r[2] ? ', ' + r[2] : '') + '. It has no scheduled flights, so it has no page of its own.'); }
    });
    var rec = S.recent(KEY);
    if (rec.length) { $('#recent-list').innerHTML = rec.map(function (x) { return '<a href="' + S.esc(x.u) + '">' + S.esc(x.t) + '</a>'; }).join(''); $('#recent').hidden = false; }
  }

  /* table filter */
  var lq = $('#lq'), ft = $('table.filt');
  if (lq && ft) {
    var rows = $$('tbody tr', ft), cnt = $('#lcount');
    lq.addEventListener('input', function () {
      var v = plain(lq.value.trim()), n = 0;
      rows.forEach(function (r) { var show = !v || plain(r.getAttribute('data-q')).indexOf(v) > -1; r.hidden = !show; if (show) n++; });
      cnt.textContent = v ? (n ? n + ' of ' + rows.length + ' rows shown' : 'Nothing matches. Check the spelling.') : '';
    });
  }

  /* distance */
  var da = $('#da'), db = $('#db'), res = $('#dres');
  if (da && db && res) {
    var A = null, B = null;
    var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
    var draw = function () {
      if (!A || !B) { res.hidden = true; return; }
      if (A[0] === B[0]) { res.hidden = false; res.innerHTML = '<p>You chose the same airport twice. Pick a different second airport.</p>'; return; }
      var p = Math.PI / 180, x = Math.pow(Math.sin((B[5] - A[5]) * p / 2), 2) + Math.cos(A[5] * p) * Math.cos(B[5] * p) * Math.pow(Math.sin((B[6] - A[6]) * p / 2), 2), km = 12742 * Math.asin(Math.sqrt(x));
      var mins = Math.round((km / 830 * 60 + 30) / 5) * 5, tm = mins >= 60 ? Math.floor(mins / 60) + ' h ' + ('0' + mins % 60).slice(-2) + ' min' : mins + ' min';
      var name = function (r) { return r[0] + ' (' + (r[2] || r[1]) + ')'; };
      var txt = name(A) + ' to ' + name(B) + ': ' + fmt(km) + ' km (' + fmt(km / 1.609344) + ' miles), about ' + tm + ' flying time for a direct jet flight.';
      var lnk = function (r) { return r[4] ? '<a href="/' + r[0].toLowerCase() + '-airport/">' + S.esc(r[1]) + '</a>' : S.esc(r[1]); };
      res.innerHTML = '<h2>' + S.esc(name(A)) + ' to ' + S.esc(name(B)) + '</h2><p class="big">' + fmt(km) + ' km</p><dl class="facts"><dt>Miles</dt><dd>' + fmt(km / 1.609344) + '</dd><dt>Nautical miles</dt><dd>' + fmt(km / 1.852) +
        '</dd><dt>Rough flying time</dt><dd>' + tm + '</dd><dt>From</dt><dd>' + lnk(A) + ', ' + S.esc(A[3]) + '</dd><dt>To</dt><dd>' + lnk(B) + ', ' + S.esc(B[3]) + '</dd></dl>' +
        '<p class="hint">Shortest path over the globe. The flying time is a rough guide and does not mean a direct flight exists.</p>' +
        '<div class="acts"><button class="btn sm" type="button" data-copy="' + S.esc(txt) + '">Copy result</button><button class="btn sm ghost" type="button" data-wa="' + S.esc(txt) + '">WhatsApp</button>' +
        '<button class="btn sm ghost" type="button" data-copy="' + S.esc(location.origin + '/distance/?from=' + A[0] + '&to=' + B[0]) + '" data-done="Link copied">Copy link</button></div>';
      res.hidden = false;
      try { history.replaceState(null, '', '/distance/?from=' + A[0] + '&to=' + B[0]); } catch (e) {}
    };
    var show = function (inp, r) { inp.value = r[0] + ' ' + (r[2] || r[1]); };
    box(da, $('#sa'), function (r) { A = r; show(da, r); draw(); if (!B) db.focus(); });
    box(db, $('#sb'), function (r) { B = r; show(db, r); draw(); });
    var ps = new URLSearchParams(location.search), pf = (ps.get('from') || '').toUpperCase(), pt = (ps.get('to') || '').toUpperCase();
    if (pf || pt) load().then(function () {
      IDX.forEach(function (r) { if (r[0] === pf) { A = r; show(da, r); } if (r[0] === pt) { B = r; show(db, r); } });
      draw();
    }).catch(function () {});
  }
})();
