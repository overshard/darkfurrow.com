// almanac.js
//
// the engine beneath the soil.
// reads the clock and the calendar, fetches what is relevant,
// and renders the page that belongs to this moment.

(function () {
  'use strict';

  var LAT = 35.78; // north carolina, zone 7a

  var ANIM_WORD_DELAY = 18;
  var ANIM_LIST_DELAY = 60;
  var ANIM_NAV_DELAY = 80;


  // --- seeded randomness ---
  // same picks all day, different tomorrow

  function dayHash(date) {
    var doy = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    return date.getFullYear() * 1000 + doy;
  }

  function seededRandom(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickItems(list, count, rng) {
    if (list.length <= count) return list.slice();
    var copy = list.slice();
    var result = [];
    for (var i = 0; i < count; i++) {
      var idx = Math.floor(rng() * copy.length);
      result.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return result;
  }

  function parseListItems(body) {
    var lines = body.split('\n');
    var bullets = [];
    var prose = [];
    var inProse = false;
    var currentProse = '';

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (trimmed.match(/^- /)) {
        if (inProse && currentProse) {
          prose.push(currentProse.trim());
          currentProse = '';
          inProse = false;
        }
        bullets.push(trimmed.slice(2));
      } else if (trimmed === '') {
        if (inProse && currentProse) {
          prose.push(currentProse.trim());
          currentProse = '';
          inProse = false;
        }
      } else {
        inProse = true;
        currentProse += (currentProse ? ' ' : '') + trimmed;
      }
    }
    if (inProse && currentProse) {
      prose.push(currentProse.trim());
    }

    return { bullets: bullets, prose: prose };
  }

  function highlightText(text) {
    // split into sentence fragments on ". " boundaries
    var fragments = text.split(/(?<=\.)\s+/);
    return fragments.map(function (frag) {
      var trimmed = frag.trim();
      if (!trimmed) return '';
      var words = trimmed.split(/\s+/);

      // short fragments (4 words or fewer): bold the whole thing
      if (words.length <= 4) {
        return '<strong>' + trimmed + '</strong>';
      }

      // if there's an early comma, bold up to it
      var comma = trimmed.indexOf(',');
      if (comma > 0 && comma < 30) {
        return '<strong>' + trimmed.slice(0, comma) + '</strong>' + trimmed.slice(comma);
      }

      // otherwise bold the first 2-3 words (3 if first word is an article/conjunction)
      var count = /^(the|a|an|if|when|it|and|or|but|do|in)$/i.test(words[0]) ? 3 : 2;
      count = Math.min(count, words.length);
      return '<strong>' + words.slice(0, count).join(' ') + '</strong> ' + words.slice(count).join(' ');
    }).join(' ');
  }


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

  // which content categories belong to each time of day
  var TIME_CONTENT = {
    night:     ['sky/', 'names/', 'remedies/', 'storms/'],
    dawn:      ['planting/', 'foraging/'],
    morning:   ['planting/', 'chores/', 'bugs/'],
    afternoon: ['kitchen/', 'bugs/', 'chores/'],
    evening:   ['kitchen/', 'remedies/', 'foraging/', 'names/', 'storms/']
  };

  var TIME_LABELS = ['night', 'dawn', 'morning', 'afternoon', 'evening'];


  // --- haiku ---
  // real poems. the old masters wrote about exactly this.

  var HAIKU = {
    'winter': [
      { lines: ['the winter stillness\na woodpecker searching through\nthe hollow silence'] },
      { lines: ['bare frozen furrows\nhold the memory of seed\nbeneath the long dark'] },
      { lines: ['woodsmoke ascending\nthrough the grey unmoving sky\nthe kettle whistles'] }
    ],
    'early-spring': [
      { lines: ['the old dark furrow\nfills with rain and waits for warmth\nsomething stirs below'] },
      { lines: ['cold mud on my hands\nthe first row planted before\nthe sparrows arrive'] },
      { lines: ['fog lifts from the creek\nrevealing green where there was\nnothing just last week'] }
    ],
    'late-spring': [
      { lines: ['petals on the path\nthe bees have already found\nwhat i just planted'] },
      { lines: ['warm rain after dawn\nthe lettuce grows so quickly\ni cannot keep up'] },
      { lines: ['the frogs resume their\nevening argument like\nold familiar friends'] }
    ],
    'early-summer': [
      { lines: ['cicadas tuning\ntheir one long note in the oaks\nthe heat has arrived'] },
      { lines: ['the tomato vine\nclimbs past the stake i gave it\nreaching for the sun'] },
      { lines: ['lightning bugs at dusk\neach one a small question asked\nthen answered in dark'] }
    ],
    'midsummer': [
      { lines: ['the garden gives more\nthan i can carry inside\nthe table overflows'] },
      { lines: ['shade beneath the oak\nthe only cool place to sit\nthe dog already knows'] },
      { lines: ['thunder in the west\nthe corn stands perfectly still\nwaiting for the rain'] }
    ],
    'early-fall': [
      { lines: ['the first cool morning\ni can see my breath again\nthe garden exhales'] },
      { lines: ['one red leaf falling\nthrough the still september air\nlanding in my palm'] },
      { lines: ['the garlic goes in\nan act of faith in the dark\nsee you in the spring'] }
    ],
    'late-fall': [
      { lines: ['bare branch on bare branch\nthe crow arrives without sound\nthe sky turns away'] },
      { lines: ['the last harvest done\ni clean the blade and hang it\non its proper nail'] },
      { lines: ['wind through empty stalks\nplaying the garden like some\nforgotten instrument'] }
    ]
  };

  function getHaiku(season) {
    var poems = HAIKU[season.name];
    if (!poems) return null;
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
    'winter':       { bg: '#07080b', tint: '40,50,80' },
    'early-spring': { bg: '#0a0c08', tint: '50,70,35' },
    'late-spring':  { bg: '#0b0d07', tint: '55,80,30' },
    'early-summer': { bg: '#0d0b07', tint: '80,65,20' },
    'midsummer':    { bg: '#0e0a06', tint: '90,60,15' },
    'early-fall':   { bg: '#0d0906', tint: '85,45,20' },
    'late-fall':    { bg: '#0b0908', tint: '65,40,30' }
  };

  function applyDaylightCycle(time, season) {
    var c = CYCLES[time] || CYCLES.morning;
    var s = SEASON_COLORS[season.name] || SEASON_COLORS['early-spring'];
    var r = document.documentElement;

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
        'radial-gradient(ellipse at 30% 15%, rgba(' + s.tint + ',0.25) 0%, transparent 55%), ' +
        'radial-gradient(ellipse at 70% 80%, rgba(' + s.tint + ',0.12) 0%, transparent 55%), ' +
        'radial-gradient(ellipse at 50% 50%, rgba(' + s.tint + ',0.08) 0%, transparent 70%)';
    }

    // time layer: light source
    var timeEl = document.getElementById('time-layer');
    if (timeEl) {
      timeEl.style.background = TIME_LIGHTS[time] || TIME_LIGHTS.morning;
    }
  }

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
    var yearLen = new Date(date.getFullYear(), 1, 29).getDate() === 29 ? 366 : 365;
    var decl = 23.45 * Math.sin((2 * Math.PI / yearLen) * (doy - 81));
    var cosH = -Math.tan(lat * Math.PI / 180) * Math.tan(decl * Math.PI / 180);
    cosH = Math.max(-1, Math.min(1, cosH));
    return (2 * Math.acos(cosH) * 180 / Math.PI) / 15;
  }

  function formatHM(hours) {
    var h = Math.floor(hours);
    var m = Math.round((hours - h) * 60);
    return h + 'h ' + m + 'm';
  }

  function formatClock(hours) {
    var h = Math.floor(hours);
    var m = Math.round((hours - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    var suffix = h >= 12 ? 'pm' : 'am';
    var display = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return display + ':' + (m < 10 ? '0' : '') + m + ' ' + suffix;
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
    var first = SEASONS[0];
    var next = new Date(date.getFullYear() + 1, first.start[0] - 1, first.start[1]);
    return { days: Math.ceil((next - date) / 86400000), label: first.label };
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
    var sunrise = 12 - hours / 2;
    var sunset = 12 + hours / 2;

    var boldName = '<strong>' + name + '</strong>';
    var lines = [];

    if (time === 'night') {
      lines.push('the moon is ' + boldName + ', ' + illum + '% lit.');
      lines.push('the world is turned away from the sun.');
      lines.push('<strong>' + formatHM(hours) + '</strong> of daylight today. ' + sign + gained + ' minutes from yesterday.');
    } else if (time === 'dawn') {
      lines.push('the sun rises around <strong>' + formatClock(sunrise) + '</strong>.');
      lines.push('the moon is ' + boldName + ', ' + illum + '% lit.');
      lines.push('<strong>' + formatHM(hours) + '</strong> of daylight ahead. it sets around ' + formatClock(sunset) + '.');
    } else if (time === 'evening') {
      lines.push('the sun set around <strong>' + formatClock(sunset) + '</strong>.');
      lines.push('the moon is ' + boldName + ', ' + illum + '% lit.');
      lines.push('there were <strong>' + formatHM(hours) + '</strong> of daylight today. ' + sign + gained + ' minutes from yesterday.');
    } else {
      lines.push('the moon is ' + boldName + ', ' + illum + '% lit.');
      lines.push('the sun rose around <strong>' + formatClock(sunrise) + '</strong> and sets around <strong>' + formatClock(sunset) + '</strong>.');
      lines.push('<strong>' + formatHM(hours) + '</strong> of daylight today. ' + sign + gained + ' minutes from yesterday.');
    }

    return lines.join('<br>');
  }


  // --- moon gardening ---

  function moonGardenTip(phase) {
    if (phase < 3.7)
      return 'the moon is dark. this is a time for <strong>rest and planning</strong>. prepare beds, amend soil, but do not plant. the old farmers said nothing wants to start in the dark.';
    if (phase < 7.4)
      return 'the moon is waxing. <strong>plant leafy things</strong>: lettuce, spinach, cabbage, herbs that grow above ground. the light is growing and pulls the energy upward.';
    if (phase < 11.1)
      return 'the moon is in its first quarter. <strong>plant things that fruit</strong>: tomatoes, peppers, beans, squash. the increasing light favors strong stems and heavy fruit.';
    if (phase < 14.8)
      return 'the moon is nearly full. <strong>transplant, fertilize, graft</strong>. the light is strongest and the sap is rising. a good time to move plants and feed the soil.';
    if (phase < 18.5)
      return 'the moon is full. <strong>plant root crops</strong>: carrots, potatoes, beets, onions, garlic. the energy is pulling downward now. bulbs and perennials go in well under a full moon.';
    if (phase < 22.1)
      return 'the moon is waning. <strong>harvest what is ready</strong>, cut herbs for drying, prune what needs shaping. the energy is drawing inward. what you cut now heals faster.';
    if (phase < 25.8)
      return 'the moon is in its last quarter. <strong>pull weeds, turn compost</strong>, cultivate the soil. this is a killing time, good for destroying what you do not want. the weeds will not come back as fast.';
    return 'the moon is a thin crescent, almost gone. <strong>do not plant</strong>. rest, clean tools, plan the next cycle. the old almanacs left these days blank on purpose.';
  }


  // --- markdown parsing ---

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
    if (!root) return;
    var elements = root.querySelectorAll('h2, p, li, blockquote');
    var allItems = [];

    elements.forEach(function (el) {
      if (el.tagName === 'LI' || el.tagName === 'BLOCKQUOTE') {
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
          // for child elements like <strong>, split their text into word spans too
          var wrapper = document.createElement(node.tagName.toLowerCase());
          // copy attributes
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

  var currentSeason = null;
  var currentTimeOverride = null;
  var cachedManifest = null;
  var naturalSeason = null;
  var naturalTime = null;

  // cached DOM references
  var dom = {};
  function cacheDOM() {
    dom.dateLine = document.querySelector('.date-line');
    dom.seasonName = document.querySelector('.season-name');
    dom.seasonNote = document.querySelector('.season-note');
    dom.haikuBlock = document.querySelector('.flow-haiku blockquote');
    dom.moonGardenTip = document.querySelector('.moon-garden-tip');
    dom.weatherMoodText = document.querySelector('.weather-mood-text');
    dom.skyData = document.querySelector('.sky-data');
    dom.footerP = document.querySelector('footer p');
    dom.wisdom = document.querySelector('.wisdom');
    dom.flowEntries = document.querySelector('.flow-entries');
    dom.readout = document.querySelector('.readout');
    dom.footer = document.querySelector('footer');
    dom.seasonsNav = document.querySelector('.seasons-nav');
    dom.timesNav = document.querySelector('.times-nav');
  }

  function loadContent(seasonOverride, timeOverride) {
    var now = new Date();
    var season = seasonOverride || getSeason(now);
    var realTime = getTimeOfDay(now);
    var contentTime = timeOverride || realTime;
    currentSeason = season;
    currentTimeOverride = timeOverride;

    // daylight cycle follows the real clock, not the content override
    applyDaylightCycle(realTime, season);

    // date line
    dom.dateLine.textContent = writtenDate(now);

    // season header
    dom.seasonName.textContent = season.label;
    var noteHTML = season.note.replace(/\n/g, '<br>');
    var next = daysUntilNextSeason(now);
    if (next.days <= 7) {
      noteHTML += '<br>' + next.label + ' begins in ' + next.days + (next.days === 1 ? ' day.' : ' days.');
    }
    dom.seasonNote.innerHTML = noteHTML;

    // haiku
    var haiku = getHaiku(season);
    if (haiku) {
      var haikuLines = haiku.lines[0].split('\n');
      dom.haikuBlock.innerHTML = haikuLines.map(function (l) {
        return '<span class="haiku-line">' + l + '</span>';
      }).join('');
    }

    // moon gardening tip (now with bold highlights)
    var phase = moonPhase(now);
    dom.moonGardenTip.innerHTML = moonGardenTip(phase);

    // weather mood
    dom.weatherMoodText.textContent = getWeatherMood(season, contentTime);

    // sky data (now with bold highlights)
    dom.skyData.innerHTML = skyText(now, contentTime);

    // footer countdown
    dom.footerP.textContent =
      next.days + ' days until ' + next.label + ' \u00b7 zone 7a \u00b7 north carolina';

    // fade out content areas, then rebuild
    var fadeTargets = ['.flow-season', '.flow-sky', '.flow-haiku', '.wisdom', '.flow-entries', 'footer'];
    fadeTargets.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.style.opacity = '0';
    });

    // seed the random number generator for today
    var rng = seededRandom(dayHash(now));

    // fetch or use cached manifest
    var p = cachedManifest
      ? Promise.resolve(cachedManifest)
      : fetch('/data/manifest.json').then(function (r) { return r.json(); });

    p.then(function (manifest) {
        cachedManifest = manifest;

        var allowedPrefixes = TIME_CONTENT[contentTime] || [];

        var relevant = manifest.filter(function (entry) {
          // wisdom entries: filter by time
          if (entry.time) return entry.time === contentTime;
          // season entries: filter by season AND time-based category
          if (entry.season && entry.season !== season.name) return false;
          for (var i = 0; i < allowedPrefixes.length; i++) {
            if (entry.path.indexOf(allowedPrefixes[i]) === 0) return true;
          }
          return false;
        });

        return Promise.all(relevant.map(function (entry) {
          return fetch('/data/' + entry.path)
            .then(function (r) { return r.text(); })
            .then(function (text) { return parseFrontmatter(text); })
            .catch(function () { return null; });
        })).then(function (results) {
          return results.filter(function (r) { return r !== null; });
        });
      })
      .then(function (entries) {
        dom.wisdom.innerHTML = '';
        dom.flowEntries.innerHTML = '';

        // collect all fragments into one flowing narrative
        var fragments = [];

        // wisdom lines
        entries.forEach(function (entry) {
          if (!entry.meta.time) return;
          var lines = entry.body.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
          if (lines.length === 0) return;
          var picks = pickItems(lines, Math.min(2, lines.length), rng);
          picks.forEach(function (line) { fragments.push(line); });
        });

        // seasonal entries: pick 1 item from each category
        entries.forEach(function (entry) {
          if (entry.meta.time) return;
          var parsed = parseListItems(entry.body);

          if (parsed.bullets.length > 0) {
            var picks = pickItems(parsed.bullets, 1, rng);
            picks.forEach(function (item) { fragments.push(item); });
          }

          if (parsed.prose.length > 0) {
            var prosePick = pickItems(parsed.prose, 1, rng);
            fragments.push(prosePick[0]);
          }
        });

        // shuffle all fragments together for a natural mixed read
        for (var i = fragments.length - 1; i > 0; i--) {
          var j = Math.floor(rng() * (i + 1));
          var tmp = fragments[i];
          fragments[i] = fragments[j];
          fragments[j] = tmp;
        }

        // compose into flowing paragraphs, ~3-4 fragments each
        var SEP = ' <span class="sep">\u2767</span> ';
        var chunkSize = Math.min(4, Math.ceil(fragments.length / 2));
        for (var c = 0; c < fragments.length; c += chunkSize) {
          var chunk = fragments.slice(c, c + chunkSize);
          var html = chunk.map(function (f) { return highlightText(f); }).join(SEP);
          var p = document.createElement('p');
          p.className = 'narrative';
          p.innerHTML = html;
          dom.flowEntries.appendChild(p);
        }

        // fade in and reveal
        fadeTargets.forEach(function (sel) {
          var el = document.querySelector(sel);
          if (el) el.style.opacity = '1';
        });

        revealWords(dom.readout);
        revealWords(dom.footer);

        // update navs
        updateNav(season);
        updateTimeNav(contentTime);
      })
      .catch(function () {
        dom.flowEntries.innerHTML = '<p style="color:var(--ash);font-style:italic;">the pages could not be found. try again in a moment.</p>';
        fadeTargets.forEach(function (sel) {
          var el = document.querySelector(sel);
          if (el) el.style.opacity = '1';
        });
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
    dom.seasonsNav.innerHTML = '';
    var delay = 0;

    seasonOrder.forEach(function (s) {
      var a = document.createElement('a');
      a.textContent = s.label;
      if (s.name === activeSeason.name) {
        a.className = 'active';
        a.setAttribute('aria-current', 'true');
      }
      a.style.animationDelay = delay + 'ms';
      delay += ANIM_NAV_DELAY;
      a.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadContent(s, currentTimeOverride);
      });
      dom.seasonsNav.appendChild(a);
    });

    if (activeSeason.name !== naturalSeason.name) {
      var ret = document.createElement('a');
      ret.textContent = 'return to now';
      ret.className = 'return-now';
      ret.style.animationDelay = delay + 'ms';
      ret.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadContent(null, currentTimeOverride);
      });
      dom.seasonsNav.appendChild(ret);
    }
  }

  function updateTimeNav(activeTime) {
    if (!dom.timesNav) return;
    dom.timesNav.innerHTML = '';
    var delay = 0;

    TIME_LABELS.forEach(function (t) {
      var a = document.createElement('a');
      a.textContent = t;
      if (t === activeTime) {
        a.className = 'active';
        a.setAttribute('aria-current', 'true');
      }
      a.style.animationDelay = delay + 'ms';
      delay += ANIM_NAV_DELAY;
      a.addEventListener('click', function () {
        loadContent(currentSeason === naturalSeason ? null : currentSeason, t);
      });
      dom.timesNav.appendChild(a);
    });

    if (currentTimeOverride && currentTimeOverride !== naturalTime) {
      var ret = document.createElement('a');
      ret.textContent = 'return to now';
      ret.className = 'return-now';
      ret.style.animationDelay = delay + 'ms';
      ret.addEventListener('click', function () {
        loadContent(currentSeason === naturalSeason ? null : currentSeason, null);
      });
      dom.timesNav.appendChild(ret);
    }
  }

  // initial render
  cacheDOM();
  var now = new Date();
  naturalSeason = getSeason(now);
  naturalTime = getTimeOfDay(now);
  loadContent(null);

  // auto-refresh when time of day or season changes
  setInterval(function () {
    var check = new Date();
    var newTime = getTimeOfDay(check);
    var newSeason = getSeason(check);
    if (newTime !== naturalTime || newSeason.name !== naturalSeason.name) {
      naturalTime = newTime;
      naturalSeason = newSeason;
      if (!currentTimeOverride) {
        loadContent(currentSeason === naturalSeason ? null : currentSeason, null);
      }
    }
  }, 60000);

  // register service worker for offline access
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }

})();
