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


  // --- haiku ---
  // real poems. the old masters wrote about exactly this.

  var HAIKU = {
    'winter': [
      { lines: ['the winter stillness\na woodpecker searching through\nthe hollow silence'], author: 'dark furrow' },
      { lines: ['bare frozen furrows\nhold the memory of seed\nbeneath the long dark'], author: 'dark furrow' },
      { lines: ['woodsmoke ascending\nthrough the grey unmoving sky\nthe kettle whistles'], author: 'dark furrow' }
    ],
    'early-spring': [
      { lines: ['the old dark furrow\nfills with rain and waits for warmth\nsomething stirs below'], author: 'dark furrow' },
      { lines: ['cold mud on my hands\nthe first row planted before\nthe sparrows arrive'], author: 'dark furrow' },
      { lines: ['fog lifts from the creek\nrevealing green where there was\nnothing just last week'], author: 'dark furrow' }
    ],
    'late-spring': [
      { lines: ['petals on the path\nthe bees have already found\nwhat i just planted'], author: 'dark furrow' },
      { lines: ['warm rain after dawn\nthe lettuce grows so quickly\ni cannot keep up'], author: 'dark furrow' },
      { lines: ['the frogs resume their\nevening argument like\nold familiar friends'], author: 'dark furrow' }
    ],
    'early-summer': [
      { lines: ['cicadas tuning\ntheir one long note in the oaks\nthe heat has arrived'], author: 'dark furrow' },
      { lines: ['the tomato vine\nclimbs past the stake i gave it\nreaching for the sun'], author: 'dark furrow' },
      { lines: ['lightning bugs at dusk\neach one a small question asked\nthen answered in dark'], author: 'dark furrow' }
    ],
    'midsummer': [
      { lines: ['the garden gives more\nthan i can carry inside\nthe table overflows'], author: 'dark furrow' },
      { lines: ['shade beneath the oak\nthe only cool place to sit\nthe dog already knows'], author: 'dark furrow' },
      { lines: ['thunder in the west\nthe corn stands perfectly still\nwaiting for the rain'], author: 'dark furrow' }
    ],
    'early-fall': [
      { lines: ['the first cool morning\ni can see my breath again\nthe garden exhales'], author: 'dark furrow' },
      { lines: ['one red leaf falling\nthrough the still september air\nlanding in my palm'], author: 'dark furrow' },
      { lines: ['the garlic goes in\nan act of faith in the dark\nsee you in the spring'], author: 'dark furrow' }
    ],
    'late-fall': [
      { lines: ['bare branch on bare branch\nthe crow arrives without sound\nthe sky turns away'], author: 'dark furrow' },
      { lines: ['the last harvest done\ni clean the blade and hang it\non its proper nail'], author: 'dark furrow' },
      { lines: ['wind through empty stalks\nplaying the garden like some\nforgotten instrument'], author: 'dark furrow' }
    ]
  };

  function getHaiku(season) {
    var poems = HAIKU[season.name];
    if (!poems) return null;
    // pick one based on day of year so it changes daily but is stable within the day
    var doy = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    return poems[doy % poems.length];
  }


  // --- weather moods ---
  // not forecasts. the character of the air in this season, at this hour.

  var WEATHER_MOODS = {
    'winter': {
      dawn: 'the cold is sharpest now. frost on everything. the air tastes like iron.',
      morning: 'grey and still. the kind of cold that settles in the bones and stays.',
      afternoon: 'thin winter light, already angling toward evening. the air is dry and quiet.',
      evening: 'the dark comes early and completely. woodsmoke from somewhere.',
      night: 'clear and bitter, or clouded and raw. either way, stay in.'
    },
    'early-spring': {
      dawn: 'cold still, but softer than last month. fog in the low places.',
      morning: 'cool and damp. the kind of morning that smells like turned earth.',
      afternoon: 'mild with a chance of anything. spring weather changes its mind.',
      evening: 'cooling fast once the sun drops. a jacket you almost left behind.',
      night: 'still cold enough to frost. the season is not settled yet.'
    },
    'late-spring': {
      dawn: 'warm already. dew on everything. the birds are unreasonably loud.',
      morning: 'bright and easy. the kind of morning that makes you go outside.',
      afternoon: 'warm, sometimes hot. thunderstorms build in the west by three.',
      evening: 'long golden light. warm enough to sit outside and do nothing.',
      night: 'mild, finally. windows open. the frogs are singing.'
    },
    'early-summer': {
      dawn: 'warm and humid before the sun is even up. it will be a hot one.',
      morning: 'hazy. the heat is already building. do what you need to do early.',
      afternoon: 'the full weight of it. cicadas. shade is the only mercy.',
      evening: 'still warm but the light softens. lightning bugs in the grass.',
      night: 'heavy air. the kind of night that does not cool down.'
    },
    'midsummer': {
      dawn: 'the air is thick before sunrise. everything is already sweating.',
      morning: 'blazing. the garden wilts by ten. water it or lose it.',
      afternoon: 'oppressive. thunderheads pile up. the storms when they come are violent and brief.',
      evening: 'a little relief if the storms came through. if not, you wait.',
      night: 'warm and loud with insects. sleep with the windows open or don\'t sleep.'
    },
    'early-fall': {
      dawn: 'cool at last. real cool. the first morning you can see your breath.',
      morning: 'crisp and blue. the clearest skies of the year.',
      afternoon: 'warm but not punishing. the light has that golden slant to it.',
      evening: 'cool enough for a fire. the smell of leaves starting.',
      night: 'cold and clear. you can see more stars now that the haze is gone.'
    },
    'late-fall': {
      dawn: 'raw and grey. the trees are bare. wind with nothing to stop it.',
      morning: 'cold rain or cold sun, both are possible. dress for both.',
      afternoon: 'short. the light is leaving by four. make use of what remains.',
      evening: 'dark already. the wind sounds different through bare branches.',
      night: 'the kind of cold that makes the house feel smaller and warmer.'
    }
  };

  function getWeatherMood(season, time) {
    var moods = WEATHER_MOODS[season.name];
    if (!moods) return '';
    return moods[time] || '';
  }


  // --- daylight cycle ---
  // shifts the palette based on time of day

  var CYCLES = {
    night: {
      bg: '#060504',
      text: '#9a8e80',
      accent: '#3a5030',
      heading: '#7a6a58',
      glow: 'rgba(30,25,20,0.08)',
      under1: 'rgba(15,12,10,0.8)',
      under2: 'rgba(20,18,15,0.6)',
      under3: 'rgba(10,10,15,0.5)'
    },
    dawn: {
      bg: '#0f0c09',
      text: '#c4b5a0',
      accent: '#7a9a62',
      heading: '#c0885a',
      glow: 'rgba(180,120,60,0.06)',
      under1: 'rgba(40,25,15,0.6)',
      under2: 'rgba(50,30,18,0.4)',
      under3: 'rgba(30,20,12,0.5)'
    },
    morning: {
      bg: '#0e0c0a',
      text: '#d4c8b8',
      accent: '#7a9a62',
      heading: '#b07a50',
      glow: 'rgba(140,100,50,0.04)',
      under1: 'rgba(26,23,20,0.7)',
      under2: 'rgba(42,36,32,0.5)',
      under3: 'rgba(26,23,20,0.4)'
    },
    afternoon: {
      bg: '#0d0b09',
      text: '#d0c2b0',
      accent: '#6a8a55',
      heading: '#a87048',
      glow: 'rgba(160,100,40,0.05)',
      under1: 'rgba(35,28,20,0.6)',
      under2: 'rgba(30,25,18,0.5)',
      under3: 'rgba(40,30,20,0.4)'
    },
    evening: {
      bg: '#0b0908',
      text: '#c8b8a5',
      accent: '#5a7d4a',
      heading: '#b87840',
      glow: 'rgba(180,100,40,0.08)',
      under1: 'rgba(45,25,12,0.7)',
      under2: 'rgba(35,18,10,0.6)',
      under3: 'rgba(25,15,8,0.5)'
    }
  };

  // season palettes — the color of the earth shifts with the year
  var SEASON_COLORS = {
    'winter':       { bg: '#07080b', tint: '40,50,80' },     // cold blue
    'early-spring': { bg: '#0a0c08', tint: '50,70,35' },     // dark moss
    'late-spring':  { bg: '#0b0d07', tint: '55,80,30' },     // green rising
    'early-summer': { bg: '#0d0b07', tint: '80,65,20' },     // golden heat
    'midsummer':    { bg: '#0e0a06', tint: '90,60,15' },     // scorched amber
    'early-fall':   { bg: '#0d0906', tint: '85,45,20' },     // rust and oak
    'late-fall':    { bg: '#0b0908', tint: '65,40,30' }      // bare wood
  };

  function applyDaylightCycle(time, season) {
    var c = CYCLES[time] || CYCLES.morning;
    var s = SEASON_COLORS[season.name] || SEASON_COLORS['early-spring'];
    var r = document.documentElement;

    // background color blends time + season
    r.style.setProperty('--earth', s.bg);
    r.style.setProperty('--bone', c.text);
    r.style.setProperty('--sprout', c.accent);
    r.style.setProperty('--ember', c.heading);
    r.style.setProperty('--glow', c.glow);
    r.style.setProperty('--under1', c.under1);
    r.style.setProperty('--under2', c.under2);
    r.style.setProperty('--under3', c.under3);

    document.body.setAttribute('data-time', time);
    document.body.setAttribute('data-season', season.name);

    // sky layer: season color wash
    var sky = document.getElementById('sky-layer');
    if (sky) {
      sky.style.background =
        'radial-gradient(ellipse at 30% 20%, rgba(' + s.tint + ',0.12) 0%, transparent 50%), ' +
        'radial-gradient(ellipse at 70% 80%, rgba(' + s.tint + ',0.08) 0%, transparent 50%), ' +
        'radial-gradient(ellipse at 50% 50%, rgba(' + s.tint + ',0.05) 0%, transparent 70%)';
    }

    // time layer: light source shining down from above
    var timeEl = document.getElementById('time-layer');
    if (timeEl) {
      timeEl.style.background = TIME_LIGHTS[time] || TIME_LIGHTS.morning;
    }
  }

  // the light source — a thin band across the top, sun or moon
  var TIME_LIGHTS = {
    night:
      'linear-gradient(to bottom, rgba(100,120,180,0.10) 0%, rgba(100,120,180,0.03) 40%, transparent 100%)',
    dawn:
      'linear-gradient(to bottom, rgba(220,150,70,0.14) 0%, rgba(200,120,50,0.04) 50%, transparent 100%)',
    morning:
      'linear-gradient(to bottom, rgba(240,210,140,0.10) 0%, rgba(240,210,140,0.02) 50%, transparent 100%)',
    afternoon:
      'linear-gradient(to bottom, rgba(240,200,110,0.12) 0%, rgba(240,200,110,0.03) 50%, transparent 100%)',
    evening:
      'linear-gradient(to bottom, rgba(200,90,30,0.16) 0%, rgba(180,70,20,0.04) 50%, transparent 100%)'
  };


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

  function moonGlyph(phase) {
    // 8 unicode moon glyphs mapped to the synodic cycle
    var glyphs = ['\uD83C\uDF11','\uD83C\uDF12','\uD83C\uDF13','\uD83C\uDF14','\uD83C\uDF15','\uD83C\uDF16','\uD83C\uDF17','\uD83C\uDF18'];
    var i = Math.floor((phase / 29.53058867) * 8) % 8;
    return glyphs[i];
  }

  var MONTHS = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  var ORDINALS = ['','first','second','third','fourth','fifth','sixth',
    'seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth',
    'fourteenth','fifteenth','sixteenth','seventeenth','eighteenth',
    'nineteenth','twentieth','twenty-first','twenty-second','twenty-third',
    'twenty-fourth','twenty-fifth','twenty-sixth','twenty-seventh',
    'twenty-eighth','twenty-ninth','thirtieth','thirty-first'];

  var TIME_WORDS = {
    night: 'night',
    dawn: 'dawn',
    morning: 'morning',
    afternoon: 'afternoon',
    evening: 'evening'
  };

  function writtenDate(date) {
    var time = getTimeOfDay(date);
    return TIME_WORDS[time] + ', the ' + ORDINALS[date.getDate()] + ' of ' + MONTHS[date.getMonth()];
  }

  function daysUntilNextSeason(date) {
    var current = getSeason(date);
    for (var i = 0; i < SEASONS.length; i++) {
      var s = SEASONS[i];
      var sDate = new Date(date.getFullYear(), s.start[0] - 1, s.start[1]);
      if (sDate > date && s.name !== current.name) {
        var diff = Math.ceil((sDate - date) / 86400000);
        return { days: diff, label: s.label };
      }
    }
    // wrap to next year
    var first = SEASONS[0];
    var next = new Date(date.getFullYear() + 1, first.start[0] - 1, first.start[1]);
    return { days: Math.ceil((next - date) / 86400000), label: first.label };
  }

  function skyText(now, time) {
    var phase = moonPhase(now);
    var name = moonName(phase);
    var glyph = moonGlyph(phase);
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
    var inPara = false;

    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (trimmed.match(/^- /)) {
        if (inPara) { html += '</p>'; inPara = false; }
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + trimmed.slice(2) + '</li>';
      } else if (trimmed === '') {
        if (inList) { html += '</ul>'; inList = false; }
        if (inPara) { html += '</p>'; inPara = false; }
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (!inPara) { html += '<p>'; inPara = true; }
        else { html += '<br>'; }
        html += trimmed;
      }
    });
    if (inList) html += '</ul>';
    if (inPara) html += '</p>';
    return html;
  }


  // --- word reveal ---

  function revealWords(root) {
    var elements = root.querySelectorAll('h2, p, li');
    var allItems = []; // mixed: word spans and whole li elements

    elements.forEach(function (el) {
      if (el.tagName === 'LI') {
        // list items fade in as a whole unit, bullet and all
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
        } else {
          nodes.push(node.cloneNode(true));
        }
      });
      el.textContent = '';
      nodes.forEach(function (n) { el.appendChild(n); });
    });

    var delay = 0;
    allItems.forEach(function (item) {
      item.style.animationDelay = delay + 'ms';
      delay += item.tagName === 'LI' ? 60 : 18;
    });
  }


  // --- main ---

  var currentSeason = null;
  var cachedManifest = null;
  var naturalSeason = null;

  function loadContent(seasonOverride) {
    var now = new Date();
    var season = seasonOverride || getSeason(now);
    var time = getTimeOfDay(now);
    currentSeason = season;

    // daylight cycle follows the clock, tinted by season
    applyDaylightCycle(time, season);

    // date line
    document.querySelector('.date-line').textContent = writtenDate(now);

    // season header
    document.querySelector('.season-name').textContent = season.label;
    document.querySelector('.season-note').innerHTML = season.note.replace(/\n/g, '<br>');

    // haiku
    var haiku = getHaiku(season);
    var haikuBlock = document.querySelector('.haiku blockquote');
    var haikuCite = document.querySelector('.haiku cite');
    if (haiku) {
      var haikuLines = haiku.lines[0].split('\n');
      haikuBlock.innerHTML = haikuLines.map(function (l) {
        return '<span class="haiku-line">' + l + '</span>';
      }).join('');
      haikuCite.textContent = '';
    }

    // weather mood
    var moodP = document.querySelector('.weather-mood p');
    moodP.textContent = getWeatherMood(season, time);

    // sky always shows real data
    var skyP = document.querySelector('.sky p');
    skyP.innerHTML = skyText(now, time).replace(/\n/g, '<br>');

    // footer countdown
    var next = daysUntilNextSeason(now);
    document.querySelector('footer p').textContent =
      next.days + ' days until ' + next.label + ' \u00b7 zone 7a \u00b7 north carolina';

    // crossfade: fade out content areas, then rebuild
    var fadeTargets = ['.season', '.haiku', '.weather-mood', '.sky', '.almanac', 'footer'];
    fadeTargets.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.style.opacity = '0';
    });

    // fetch or use cached manifest
    var p = cachedManifest
      ? Promise.resolve(cachedManifest)
      : fetch('/data/manifest.json').then(function (r) { return r.json(); });

    p.then(function (manifest) {
        cachedManifest = manifest;

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

        // fade in and reveal
        fadeTargets.forEach(function (sel) {
          var el = document.querySelector(sel);
          if (el) el.style.opacity = '1';
        });

        revealWords(document.querySelector('header'));
        revealWords(document.querySelector('.season'));
        revealWords(document.querySelector('.haiku'));
        revealWords(document.querySelector('.weather-mood'));
        revealWords(document.querySelector('.sky'));
        revealWords(document.querySelector('.almanac'));
        revealWords(document.querySelector('footer'));

        // update nav
        updateNav(season);
      });
  }

  // unique season names in order, for the nav
  var seasonOrder = [];
  var seasonMap = {};
  SEASONS.forEach(function (s) {
    if (!seasonMap[s.name]) {
      seasonMap[s.name] = s;
      seasonOrder.push(s);
    }
  });

  function updateNav(activeSeason) {
    var nav = document.querySelector('.seasons-nav');
    nav.innerHTML = '';
    var delay = 0;

    seasonOrder.forEach(function (s) {
      var a = document.createElement('a');
      a.textContent = s.label;
      if (s.name === activeSeason.name) {
        a.className = 'active';
      }
      a.style.animationDelay = delay + 'ms';
      delay += 80;
      a.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadContent(s);
      });
      nav.appendChild(a);
    });

    if (activeSeason.name !== naturalSeason.name) {
      var ret = document.createElement('a');
      ret.textContent = 'return to now';
      ret.className = 'return-now';
      ret.style.animationDelay = delay + 'ms';
      ret.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadContent(null);
      });
      nav.appendChild(ret);
    }
  }

  // initial render
  var now = new Date();
  naturalSeason = getSeason(now);
  loadContent(null);

})();
