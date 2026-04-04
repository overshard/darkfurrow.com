// almanac.js
//
// the surface of the page. handles color, motion, and navigation.
// all content is assembled on the server now.

(function () {
  'use strict';

  var ANIM_WORD_DELAY = 18;
  var ANIM_LIST_DELAY = 60;
  var ANIM_NAV_DELAY = 80;


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

  var SEASONS_LIST = [
    'winter', 'early-spring', 'late-spring', 'early-summer',
    'midsummer', 'early-fall', 'late-fall'
  ];

  function getTimeOfDay(date) {
    var h = date.getHours();
    for (var i = 0; i < TIMES.length; i++) {
      if (h >= TIMES[i].start && h < TIMES[i].end) return TIMES[i].name;
    }
    return 'night';
  }

  // season detection for auto-refresh
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

  var CYCLES = {
    night: {
      bg: '#060504', text: '#9a8e80', accent: '#3a5030', heading: '#7a6a58',
      glow: 'rgba(30,25,20,0.08)', under1: 'rgba(15,12,10,0.8)',
      under2: 'rgba(20,18,15,0.6)', under3: 'rgba(10,10,15,0.5)'
    },
    dawn: {
      bg: '#0f0c09', text: '#c4b5a0', accent: '#7a9a62', heading: '#c0885a',
      glow: 'rgba(180,120,60,0.06)', under1: 'rgba(40,25,15,0.6)',
      under2: 'rgba(50,30,18,0.4)', under3: 'rgba(30,20,12,0.5)'
    },
    morning: {
      bg: '#0e0c0a', text: '#d4c8b8', accent: '#7a9a62', heading: '#b07a50',
      glow: 'rgba(140,100,50,0.04)', under1: 'rgba(26,23,20,0.7)',
      under2: 'rgba(42,36,32,0.5)', under3: 'rgba(26,23,20,0.4)'
    },
    afternoon: {
      bg: '#0d0b09', text: '#d0c2b0', accent: '#6a8a55', heading: '#a87048',
      glow: 'rgba(160,100,40,0.05)', under1: 'rgba(35,28,20,0.6)',
      under2: 'rgba(30,25,18,0.5)', under3: 'rgba(40,30,20,0.4)'
    },
    evening: {
      bg: '#0b0908', text: '#c8b8a5', accent: '#5a7d4a', heading: '#b87840',
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
    var elements = root.querySelectorAll('h2, p, li, blockquote');
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

    var delay = 0;
    allItems.forEach(function (item) {
      item.style.animationDelay = delay + 'ms';
      delay += item.tagName === 'LI' ? ANIM_LIST_DELAY : ANIM_WORD_DELAY;
    });
  }


  // --- main ---

  var currentSeasonOverride = null;
  var currentTimeOverride = null;
  var naturalSeason = null;
  var naturalTime = null;

  var dom = {};
  function cacheDOM() {
    dom.dateLine = document.querySelector('.date-line');
    dom.seasonName = document.querySelector('.season-name');
    dom.seasonNote = document.querySelector('.season-note');
    dom.haikuBlock = document.querySelector('.flow-haiku blockquote');
    dom.weatherMoodText = document.querySelector('.weather-mood-text');
    dom.skyData = document.querySelector('.sky-data');
    dom.footerP = document.querySelector('footer p');
    dom.wisdom = document.querySelector('.wisdom');
    dom.flowEntries = document.querySelector('.flow-entries');
    dom.readout = document.querySelector('.readout');
    dom.footer = document.querySelector('footer');
    dom.seasonsNav = document.querySelector('.seasons-nav');
    dom.timesNav = document.querySelector('.times-nav');
    dom.navDrawer = document.querySelector('.nav-drawer');
    dom.navToggle = document.querySelector('.nav-toggle');

    if (dom.navToggle) {
      dom.navToggle.addEventListener('click', function () {
        var open = dom.navDrawer.classList.toggle('open');
        dom.navToggle.textContent = open ? '...close' : '...explore';
      });
    }
  }

  function loadContent(seasonOverride, timeOverride) {
    var fadeTargets = ['.flow-season', '.flow-sky', '.flow-haiku', '.wisdom', '.flow-entries', 'footer'];
    fadeTargets.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.style.opacity = '0';
    });

    var params = [];
    if (seasonOverride) params.push('season=' + encodeURIComponent(seasonOverride));
    if (timeOverride) params.push('time=' + encodeURIComponent(timeOverride));
    var url = '/api/content' + (params.length ? '?' + params.join('&') : '');

    currentSeasonOverride = seasonOverride;
    currentTimeOverride = timeOverride;

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        dom.dateLine.textContent = data.date_line;
        dom.seasonName.textContent = data.season_name;
        dom.seasonNote.innerHTML = data.season_note;
        dom.haikuBlock.innerHTML = data.haiku_html;
        dom.weatherMoodText.innerHTML = data.weather_mood;
        dom.skyData.innerHTML = data.sky_data;
        dom.flowEntries.innerHTML = data.narrative_html;
        dom.footerP.textContent = data.footer_text;
        dom.seasonsNav.innerHTML = data.season_nav_html;
        dom.timesNav.innerHTML = data.time_nav_html;

        // update body attributes for the season color
        document.body.setAttribute('data-season', data.season_key);
        document.body.setAttribute('data-time', data.time_key);

        // daylight cycle follows real clock, season follows content
        var realTime = getTimeOfDay(new Date());
        applyDaylightCycle(realTime, data.season_key);

        fadeTargets.forEach(function (sel) {
          var el = document.querySelector(sel);
          if (el) el.style.opacity = '1';
        });

        revealWords(dom.readout);
        revealWords(dom.footer);

        bindNavClicks();
      })
      .catch(function () {
        dom.flowEntries.innerHTML = '<p style="color:var(--ash);font-style:italic;">the pages could not be found. try again in a moment.</p>';
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
        if (season === naturalSeason) {
          loadContent(null, currentTimeOverride);
        } else {
          loadContent(season, currentTimeOverride);
        }
      });
    });

    dom.timesNav.querySelectorAll('a[data-time]').forEach(function (a) {
      a.addEventListener('click', function () {
        var time = a.getAttribute('data-time');
        if (time === 'now') {
          loadContent(currentSeasonOverride, null);
        } else {
          loadContent(currentSeasonOverride, time);
        }
      });
    });
  }


  // --- init ---

  cacheDOM();

  var now = new Date();
  naturalSeason = getSeasonName(now);
  naturalTime = getTimeOfDay(now);

  // apply daylight cycle from server-provided attributes
  var initSeason = document.body.getAttribute('data-season') || naturalSeason;
  var initTime = document.body.getAttribute('data-time') || naturalTime;
  applyDaylightCycle(initTime, initSeason);

  // reveal the server-rendered content
  revealWords(dom.readout);
  revealWords(dom.footer);

  // bind nav clicks on the server-rendered nav
  bindNavClicks();

  // auto-refresh when time of day or season changes
  setInterval(function () {
    var check = new Date();
    var newTime = getTimeOfDay(check);
    var newSeason = getSeasonName(check);
    if (newTime !== naturalTime || newSeason !== naturalSeason) {
      naturalTime = newTime;
      naturalSeason = newSeason;
      if (!currentTimeOverride) {
        loadContent(currentSeasonOverride, null);
      }
      // always update the daylight cycle to real time
      applyDaylightCycle(newTime, document.body.getAttribute('data-season') || newSeason);
    }
  }, 60000);

  // register service worker for offline access
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js');
  }

})();
