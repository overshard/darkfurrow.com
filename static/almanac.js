// almanac.js
//
// the surface of the page. handles color, motion, and navigation.
// all content is assembled on the server now.

(function () {
  'use strict';

  var ANIM_WORD_DELAY = 18;
  var ANIM_LIST_DELAY = 60;


  // --- daylight cycle ---
  // shifts the palette based on time of day

  var TIMES = [
    { name: 'night',     start: 0,  end: 5 },
    { name: 'dawn',      start: 5,  end: 8 },
    { name: 'morning',   start: 8,  end: 12 },
    { name: 'afternoon', start: 12, end: 17 },
    { name: 'evening',   start: 17, end: 21 },
    { name: 'night',     start: 21, end: 24 }
  ];

  function getTimeOfDay(date) {
    var h = date.getHours();
    for (var i = 0; i < TIMES.length; i++) {
      if (h >= TIMES[i].start && h < TIMES[i].end) return TIMES[i].name;
    }
    return 'night';
  }

  function getSeasonName(date) {
    var m = date.getMonth() + 1;
    var d = date.getDate();
    var ranges = [
      ['winter',       1,1,   2,28],
      ['early-spring', 3,1,   4,15],
      ['late-spring',  4,16,  5,31],
      ['early-summer', 6,1,   6,30],
      ['midsummer',    7,1,   8,31],
      ['early-fall',   9,1,   10,31],
      ['late-fall',    11,1,  11,30],
      ['winter',       12,1,  12,31]
    ];
    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      var afterStart = m > r[1] || (m === r[1] && d >= r[2]);
      var beforeEnd = m < r[3] || (m === r[3] && d <= r[4]);
      if (afterStart && beforeEnd) return r[0];
    }
    return 'winter';
  }

  // palette per time of day. text stays in the bone/cream range so
  // contrast holds; the ember "heading" role drives the accent (drop
  // cap, roman numerals, links, mood markers) and stays warm-gold
  // even at night so editorial elements don't disappear.
  var CYCLES = {
    night: {
      bg: '#0a0806', text: '#dcd0b8', accent: '#86a07a', heading: '#d2a070',
      glow: 'rgba(30,25,20,0.08)', under1: 'rgba(15,12,10,0.8)',
      under2: 'rgba(20,18,15,0.6)', under3: 'rgba(10,10,15,0.5)'
    },
    dawn: {
      bg: '#13100b', text: '#e0d4be', accent: '#92a880', heading: '#e3b27a',
      glow: 'rgba(180,120,60,0.06)', under1: 'rgba(40,25,15,0.6)',
      under2: 'rgba(50,30,18,0.4)', under3: 'rgba(30,20,12,0.5)'
    },
    morning: {
      bg: '#14100c', text: '#e2d8c2', accent: '#92a880', heading: '#d8aa78',
      glow: 'rgba(140,100,50,0.04)', under1: 'rgba(26,23,20,0.7)',
      under2: 'rgba(42,36,32,0.5)', under3: 'rgba(26,23,20,0.4)'
    },
    afternoon: {
      bg: '#15110e', text: '#dccfba', accent: '#88a07a', heading: '#d3a06c',
      glow: 'rgba(160,100,40,0.05)', under1: 'rgba(35,28,20,0.6)',
      under2: 'rgba(30,25,18,0.5)', under3: 'rgba(40,30,20,0.4)'
    },
    evening: {
      bg: '#120f0b', text: '#dac9b4', accent: '#82987a', heading: '#dfa478',
      glow: 'rgba(180,100,40,0.08)', under1: 'rgba(45,25,12,0.7)',
      under2: 'rgba(35,18,10,0.6)', under3: 'rgba(25,15,8,0.5)'
    }
  };

  var SEASON_COLORS = {
    'winter':       { bg: '#07080b', tint: '40,50,80' },
    'early-spring': { bg: '#0a0c08', tint: '50,70,35' },
    'late-spring':  { bg: '#0b0d07', tint: '55,80,30' },
    'early-summer': { bg: '#0d0b07', tint: '80,65,20' },
    'midsummer':    { bg: '#0e0a06', tint: '90,60,15' },
    'early-fall':   { bg: '#0d0906', tint: '85,45,20' },
    'late-fall':    { bg: '#0b0908', tint: '65,40,30' }
  };

  var TIME_LIGHTS = {
    night:
      'linear-gradient(to bottom, rgba(100,120,180,0.15) 0%, rgba(100,120,180,0.05) 30%, transparent 70%)',
    dawn:
      'linear-gradient(to bottom, rgba(220,150,70,0.22) 0%, rgba(200,120,50,0.06) 40%, transparent 80%)',
    morning:
      'linear-gradient(to bottom, rgba(240,210,140,0.16) 0%, rgba(240,210,140,0.04) 40%, transparent 80%)',
    afternoon:
      'linear-gradient(to bottom, rgba(240,200,110,0.18) 0%, rgba(240,200,110,0.05) 40%, transparent 80%)',
    evening:
      'linear-gradient(to bottom, rgba(200,90,30,0.24) 0%, rgba(180,70,20,0.06) 40%, transparent 80%)'
  };

  function applyDaylightCycle(time, seasonName) {
    var c = CYCLES[time] || CYCLES.morning;
    var s = SEASON_COLORS[seasonName] || SEASON_COLORS['early-spring'];
    var r = document.documentElement;

    r.style.setProperty('--earth', s.bg);
    r.style.setProperty('--bone', c.text);
    r.style.setProperty('--sprout', c.accent);
    r.style.setProperty('--ember', c.heading);
    r.style.setProperty('--glow', c.glow);
    r.style.setProperty('--under1', c.under1);
    r.style.setProperty('--under2', c.under2);
    r.style.setProperty('--under3', c.under3);

    var sky = document.getElementById('sky-layer');
    if (sky) {
      sky.style.background =
        'radial-gradient(ellipse at 30% 15%, rgba(' + s.tint + ',0.25) 0%, transparent 55%), ' +
        'radial-gradient(ellipse at 70% 80%, rgba(' + s.tint + ',0.12) 0%, transparent 55%), ' +
        'radial-gradient(ellipse at 50% 50%, rgba(' + s.tint + ',0.08) 0%, transparent 70%)';
    }

    var timeEl = document.getElementById('time-layer');
    if (timeEl) {
      timeEl.style.background = TIME_LIGHTS[time] || TIME_LIGHTS.morning;
    }
  }


  // --- word reveal ---

  function revealWords(root) {
    if (!root) return;
    var elements = root.querySelectorAll('h1, h2, p, li, blockquote');
    var allItems = [];

    elements.forEach(function (el) {
      if (el.tagName === 'LI') {
        allItems.push(el);
        return;
      }

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
              allItems.push(span);
            }
          });
        } else if (node.nodeType === 1) {
          var wrapper = document.createElement(node.tagName.toLowerCase());
          for (var a = 0; a < node.attributes.length; a++) {
            wrapper.setAttribute(node.attributes[a].name, node.attributes[a].value);
          }
          var innerText = node.textContent || '';
          innerText.split(/(\s+)/).forEach(function (w) {
            if (/^\s*$/.test(w)) {
              wrapper.appendChild(document.createTextNode(w));
            } else {
              var span = document.createElement('span');
              span.className = 'word';
              span.textContent = w;
              wrapper.appendChild(span);
              allItems.push(span);
            }
          });
          nodes.push(wrapper);
        }
      });
      el.textContent = '';
      nodes.forEach(function (n) { el.appendChild(n); });
    });

    // cap total cascade so the last item lands within ~1s of the
    // first. budget includes both word and LI advances; with ~300
    // items the per-item step shrinks below 5ms which still reads
    // as a sweep rather than a pop.
    var ANIM_TOTAL_MS = 900;
    var n = allItems.length;
    var step = n > 1 ? ANIM_TOTAL_MS / (n - 1) : 0;
    var nextDelay = 0;
    allItems.forEach(function (item) {
      item.style.animationDelay = nextDelay + 'ms';
      nextDelay += step;
    });
  }


  // --- main ---

  var currentSeasonOverride = null;
  var naturalSeason = null;

  var dom = {};
  function cacheDOM() {
    dom.dateLine = document.querySelector('.date-line');
    dom.seasonName = document.querySelector('.season-name');
    dom.seasonNote = document.querySelector('.season-note');
    dom.haikuBlock = document.querySelector('.flow-haiku blockquote');
    dom.sections = document.querySelector('.sections');
    dom.footerStatus = document.querySelector('.footer-status');
    dom.readout = document.querySelector('.readout');
    dom.footer = document.querySelector('footer');
    dom.seasonsNav = document.querySelector('.seasons-nav');
  }

  function loadContent(seasonOverride) {
    var fadeTargets = ['.flow-season', '.flow-haiku', '.sections', 'footer'];
    fadeTargets.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.style.opacity = '0';
    });

    var url = '/api/content' + (seasonOverride ? '?season=' + encodeURIComponent(seasonOverride) : '');
    currentSeasonOverride = seasonOverride;

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        dom.dateLine.textContent = data.date_line;
        dom.seasonName.textContent = data.season_name;
        dom.seasonNote.innerHTML = data.season_note;
        dom.haikuBlock.innerHTML = data.haiku_html;
        dom.sections.innerHTML = data.sections_html;
        dom.footerStatus.textContent = data.footer_text;
        dom.seasonsNav.innerHTML = data.season_nav_html;

        document.body.setAttribute('data-season', data.season_key);
        document.body.setAttribute('data-time', data.time_key);

        // background cycle follows real clock; season tint follows content
        applyDaylightCycle(getTimeOfDay(new Date()), data.season_key);

        fadeTargets.forEach(function (sel) {
          var el = document.querySelector(sel);
          if (el) el.style.opacity = '1';
        });

        revealWords(dom.readout);
        revealWords(dom.footer);
        bindNavClicks();
      })
      .catch(function () {
        dom.sections.innerHTML = '<p style="color:var(--ash);font-style:italic;">the pages could not be found. try again in a moment.</p>';
        fadeTargets.forEach(function (sel) {
          var el = document.querySelector(sel);
          if (el) el.style.opacity = '1';
        });
      });
  }

  function bindNavClicks() {
    dom.seasonsNav.querySelectorAll('a[data-season]').forEach(function (a) {
      a.addEventListener('click', function () {
        var season = a.getAttribute('data-season');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadContent(season === naturalSeason ? null : season);
      });
    });
  }


  // --- init ---

  cacheDOM();

  var now = new Date();
  naturalSeason = getSeasonName(now);

  var initSeason = document.body.getAttribute('data-season') || naturalSeason;
  var initTime = document.body.getAttribute('data-time') || getTimeOfDay(now);
  applyDaylightCycle(initTime, initSeason);

  revealWords(dom.readout);
  revealWords(dom.footer);
  bindNavClicks();

  // refresh on season rollover; keep palette in sync with the clock
  setInterval(function () {
    var check = new Date();
    var newSeason = getSeasonName(check);
    if (newSeason !== naturalSeason) {
      naturalSeason = newSeason;
      if (!currentSeasonOverride) {
        loadContent(null);
        return;
      }
    }
    applyDaylightCycle(getTimeOfDay(check), document.body.getAttribute('data-season') || newSeason);
  }, 60000);

  // register service worker for offline access
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js');
  }

})();
