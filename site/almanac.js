// almanac.js
//
// the engine beneath the soil.
// reads the clock and the calendar, fetches what is relevant,
// and renders the page that belongs to this moment.

(function () {
  'use strict';

  var LAT = 35.78; // north carolina, zone 7a


  // --- time and season ---

  var SEASONS = [
    { name: 'winter',       start: [1, 1],   end: [2, 28],  label: 'winter',       note: 'the ground is still. the light is short.\nrest is not emptiness, it is preparation.' },
    { name: 'early-spring', start: [3, 1],   end: [4, 15],  label: 'early spring',  note: 'the soil warms. the light returns longer each day.\nwhat was sleeping is not sleeping anymore.' },
    { name: 'late-spring',  start: [4, 16],  end: [5, 31],  label: 'late spring',   note: 'the frost is gone or nearly gone.\neverything is rushing now. the green is loud.' },
    { name: 'early-summer', start: [6, 1],   end: [6, 30],  label: 'early summer',  note: 'the days are longest. the heat is building.\nthe garden is a job now, not a hope.' },
    { name: 'midsummer',    start: [7, 1],   end: [8, 31],  label: 'midsummer',     note: 'the full weight of summer.\neverything is ripe or ripening or done.' },
    { name: 'early-fall',   start: [9, 1],   end: [10, 31], label: 'early fall',    note: 'the light is leaving but slowly.\nmornings are cool again. the garden exhales.' },
    { name: 'late-fall',    start: [11, 1],  end: [11, 30],  label: 'late fall',     note: 'the trees are bare or nearly.\nthe first frost has come or is coming tonight.' },
    { name: 'winter',       start: [12, 1],  end: [12, 31], label: 'winter',        note: 'the ground is still. the light is short.\nrest is not emptiness, it is preparation.' }
  ];

  var TIMES = [
    { name: 'night',     start: 0,  end: 5  },
    { name: 'dawn',      start: 5,  end: 8  },
    { name: 'morning',   start: 8,  end: 12 },
    { name: 'afternoon', start: 12, end: 17 },
    { name: 'evening',   start: 17, end: 21 },
    { name: 'night',     start: 21, end: 24 }
  ];

  function getSeason(date) {
    var m = date.getMonth() + 1;
    var d = date.getDate();
    for (var i = 0; i < SEASONS.length; i++) {
      var s = SEASONS[i];
      var afterStart = m > s.start[0] || (m === s.start[0] && d >= s.start[1]);
      var beforeEnd = m < s.end[0] || (m === s.end[0] && d <= s.end[1]);
      if (afterStart && beforeEnd) return s;
    }
    return SEASONS[0];
  }

  function getTimeOfDay(date) {
    var h = date.getHours();
    for (var i = 0; i < TIMES.length; i++) {
      if (h >= TIMES[i].start && h < TIMES[i].end) return TIMES[i].name;
    }
    return 'night';
  }


  // --- daylight cycle ---
  // shifts the palette based on time of day

  var CYCLES = {
    night:     { bg: '#080706', text: '#9a8e80', accent: '#4a6340', heading: '#7a6a58', glow: 'rgba(60,50,35,0.08)' },
    dawn:      { bg: '#0f0c09', text: '#c4b5a0', accent: '#7a9a62', heading: '#c0885a', glow: 'rgba(180,120,60,0.06)' },
    morning:   { bg: '#0e0c0a', text: '#d4c8b8', accent: '#7a9a62', heading: '#b07a50', glow: 'rgba(140,100,50,0.04)' },
    afternoon: { bg: '#0d0b09', text: '#d0c2b0', accent: '#6a8a55', heading: '#a87048', glow: 'rgba(160,100,40,0.05)' },
    evening:   { bg: '#0b0908', text: '#c8b8a5', accent: '#5a7d4a', heading: '#b87840', glow: 'rgba(180,100,40,0.08)' }
  };

  function applyDaylightCycle(time) {
    var c = CYCLES[time] || CYCLES.morning;
    var r = document.documentElement;
    r.style.setProperty('--earth', c.bg);
    r.style.setProperty('--bone', c.text);
    r.style.setProperty('--sprout', c.accent);
    r.style.setProperty('--ember', c.heading);
    r.style.setProperty('--glow', c.glow);
    document.body.setAttribute('data-time', time);
  }


  // --- sky calculations ---

  function moonPhase(date) {
    var known = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
    var synodic = 29.53058867;
    var diff = (date.getTime() - known.getTime()) / 86400000;
    return ((diff % synodic) + synodic) % synodic;
  }

  function moonName(phase) {
    if (phase < 1.85) return 'new moon';
    if (phase < 7.38) return 'waxing crescent';
    if (phase < 9.23) return 'first quarter';
    if (phase < 14.77) return 'waxing gibbous';
    if (phase < 16.61) return 'full moon';
    if (phase < 22.15) return 'waning gibbous';
    if (phase < 23.99) return 'last quarter';
    if (phase < 27.68) return 'waning crescent';
    return 'new moon';
  }

  function moonIllumination(phase) {
    return (1 - Math.cos(2 * Math.PI * phase / 29.53058867)) / 2;
  }

  function daylight(date, lat) {
    var doy = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    var decl = 23.45 * Math.sin((2 * Math.PI / 365) * (doy - 81));
    var cosH = -Math.tan(lat * Math.PI / 180) * Math.tan(decl * Math.PI / 180);
    cosH = Math.max(-1, Math.min(1, cosH));
    return (2 * Math.acos(cosH) * 180 / Math.PI) / 15;
  }

  function formatHM(hours) {
    var h = Math.floor(hours);
    var m = Math.round((hours - h) * 60);
    return h + 'h ' + m + 'm';
  }

  function skyText(now, time) {
    var phase = moonPhase(now);
    var name = moonName(phase);
    var illum = Math.round(moonIllumination(phase) * 100);
    var hours = daylight(now, LAT);
    var yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    var gained = ((hours - daylight(yesterday, LAT)) * 60).toFixed(1);
    var sign = gained > 0 ? '+' : '';

    var lines = [];

    if (time === 'night') {
      lines.push('the moon is ' + name + ', ' + illum + '% lit.');
      lines.push('the world is turned away from the sun.');
      lines.push(formatHM(hours) + ' of daylight today. ' + sign + gained + ' minutes from yesterday.');
    } else if (time === 'dawn') {
      lines.push('the sun is finding the edge of things.');
      lines.push('the moon is ' + name + ', ' + illum + '% lit.');
      lines.push(formatHM(hours) + ' of daylight ahead.');
    } else if (time === 'evening') {
      lines.push('the light is going.');
      lines.push('the moon is ' + name + ', ' + illum + '% lit.');
      lines.push('there were ' + formatHM(hours) + ' of daylight today. ' + sign + gained + ' minutes from yesterday.');
    } else {
      lines.push('the moon is ' + name + ', ' + illum + '% lit.');
      lines.push(formatHM(hours) + ' of daylight today.');
      lines.push(sign + gained + ' minutes from yesterday, quietly.');
    }

    return lines.join('\n');
  }


  // --- markdown parsing ---
  // just enough to render what we write. no libraries.

  function parseFrontmatter(text) {
    var match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: text };
    var meta = {};
    match[1].split('\n').forEach(function (line) {
      var parts = line.split(/:\s*/);
      if (parts.length >= 2) meta[parts[0].trim()] = parts.slice(1).join(':').trim();
    });
    return { meta: meta, body: match[2].trim() };
  }

  function renderMarkdown(body) {
    var lines = body.split('\n');
    var html = '';
    var inList = false;

    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (trimmed.match(/^- /)) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + trimmed.slice(2) + '</li>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (trimmed === '') {
          html += '<br>';
        } else {
          html += trimmed + '<br>';
        }
      }
    });
    if (inList) html += '</ul>';
    return html;
  }


  // --- word reveal ---

  function revealWords(root) {
    var elements = root.querySelectorAll('h2, p, li');
    var allWords = [];

    elements.forEach(function (el) {
      var nodes = [];
      el.childNodes.forEach(function (node) {
        if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach(function (w) {
            if (/^\s*$/.test(w)) {
              nodes.push(document.createTextNode(w));
            } else {
              var span = document.createElement('span');
              span.className = 'word';
              span.textContent = w;
              nodes.push(span);
              allWords.push(span);
            }
          });
        } else {
          nodes.push(node.cloneNode(true));
        }
      });
      el.textContent = '';
      nodes.forEach(function (n) { el.appendChild(n); });
    });

    var delay = 0;
    allWords.forEach(function (span) {
      span.style.animationDelay = delay + 'ms';
      delay += 18;
    });
  }


  // --- main ---

  function render() {
    var now = new Date();
    var season = getSeason(now);
    var time = getTimeOfDay(now);

    // daylight cycle
    applyDaylightCycle(time);

    // season header
    document.querySelector('.season-name').textContent = season.label;
    document.querySelector('.season-note').innerHTML = season.note.replace(/\n/g, '<br>');

    // sky
    var skyP = document.querySelector('.sky p');
    skyP.innerHTML = skyText(now, time).replace(/\n/g, '<br>');

    // fetch content
    fetch('/data/manifest.json')
      .then(function (r) { return r.json(); })
      .then(function (manifest) {
        // filter to current season and time of day
        var relevant = manifest.filter(function (entry) {
          if (entry.season && entry.season !== season.name) return false;
          if (entry.time && entry.time !== time) return false;
          return true;
        });

        return Promise.all(relevant.map(function (entry) {
          return fetch('/data/' + entry.path)
            .then(function (r) { return r.text(); })
            .then(function (text) { return parseFrontmatter(text); });
        }));
      })
      .then(function (entries) {
        var almanac = document.querySelector('.almanac');
        almanac.innerHTML = '';

        entries.forEach(function (entry) {
          var div = document.createElement('div');
          div.className = 'entry';

          var h2 = document.createElement('h2');
          h2.textContent = entry.meta.section || '';
          div.appendChild(h2);

          var content = document.createElement('div');
          content.innerHTML = renderMarkdown(entry.body);
          div.appendChild(content);

          almanac.appendChild(div);
        });

        // reveal everything
        revealWords(document.querySelector('main'));
      });
  }

  render();

})();
