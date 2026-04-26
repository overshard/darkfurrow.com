"""
almanac.py

the engine beneath the soil.
reads the clock and the calendar, assembles what belongs to this moment.
"""

import json
import math
import os
import re

import mistune


LAT = 35.78  # north carolina, zone 7a

_md = mistune.create_markdown()


def render_md(text):
    """render markdown to html, stripping outer <p> tags for inline use."""
    html = _md(text).strip()
    # strip single wrapping <p>...</p> for inline contexts
    if html.startswith('<p>') and html.endswith('</p>') and html.count('<p>') == 1:
        html = html[3:-4]
    return html


def render_md_block(text):
    """render markdown to html, keeping block-level tags."""
    return _md(text).strip()


# --- seeded randomness ---
# same picks all day, different tomorrow


def day_hash(date):
    doy = date.timetuple().tm_yday
    return date.year * 1000 + doy


def _imul(a, b):
    """replicate javascript Math.imul: 32-bit integer multiply."""
    a &= 0xFFFFFFFF
    b &= 0xFFFFFFFF
    ah = (a >> 16) & 0xFFFF
    al = a & 0xFFFF
    bh = (b >> 16) & 0xFFFF
    bl = b & 0xFFFF
    result = (al * bl) + (((ah * bl + al * bh) & 0xFFFF) << 16)
    return result & 0xFFFFFFFF


def _to_signed32(n):
    n &= 0xFFFFFFFF
    if n >= 0x80000000:
        return n - 0x100000000
    return n


def seeded_random(seed):
    s = _to_signed32(seed)

    def next_val():
        nonlocal s
        s = _to_signed32(s + 0x6D2B79F5)
        t = _imul((s ^ ((s & 0xFFFFFFFF) >> 15)), (1 | s) & 0xFFFFFFFF)
        t = _to_signed32(t)
        t = _to_signed32(t + _to_signed32(_imul(
            (t ^ ((t & 0xFFFFFFFF) >> 7)) & 0xFFFFFFFF,
            (61 | t) & 0xFFFFFFFF
        )))
        t = t ^ ((t & 0xFFFFFFFF) >> 14)
        return (t & 0xFFFFFFFF) / 4294967296

    return next_val


def pick_items(lst, count, rng):
    if len(lst) <= count:
        return list(lst)
    copy = list(lst)
    result = []
    for _ in range(count):
        idx = int(rng() * len(copy))
        result.append(copy[idx])
        del copy[idx]
    return result


# --- time ---

TIMES = [
    {'name': 'night',     'start': 0,  'end': 5},
    {'name': 'dawn',      'start': 5,  'end': 8},
    {'name': 'morning',   'start': 8,  'end': 12},
    {'name': 'afternoon', 'start': 12, 'end': 17},
    {'name': 'evening',   'start': 17, 'end': 21},
    {'name': 'night',     'start': 21, 'end': 24},
]

def get_time_of_day(date):
    h = date.hour
    for t in TIMES:
        if t['start'] <= h < t['end']:
            return t['name']
    return 'night'


# --- markdown parsing ---

def parse_frontmatter(text):
    match = re.match(r'^---\n(.*?)\n---\n(.*)$', text, re.DOTALL)
    if not match:
        return {'meta': {}, 'body': text}
    meta = {}
    for line in match.group(1).split('\n'):
        parts = line.split(':', 1)
        if len(parts) == 2:
            meta[parts[0].strip()] = parts[1].strip()
    return {'meta': meta, 'body': match.group(2).strip()}


def parse_list_items(body):
    lines = body.split('\n')
    bullets = []
    prose = []
    in_prose = False
    current_prose = ''

    for line in lines:
        trimmed = line.strip()
        if trimmed.startswith('- '):
            if in_prose and current_prose:
                prose.append(current_prose.strip())
                current_prose = ''
                in_prose = False
            bullets.append(trimmed[2:])
        elif trimmed == '':
            if in_prose and current_prose:
                prose.append(current_prose.strip())
                current_prose = ''
                in_prose = False
        else:
            in_prose = True
            current_prose += (' ' if current_prose else '') + trimmed

    if in_prose and current_prose:
        prose.append(current_prose.strip())

    return {'bullets': bullets, 'prose': prose}


# --- sky calculations ---

def moon_phase(date):
    from datetime import datetime, timezone
    known = datetime(2000, 1, 6, 18, 14, 0, tzinfo=timezone.utc)
    synodic = 29.53058867
    diff = (date.timestamp() - known.timestamp()) / 86400
    return ((diff % synodic) + synodic) % synodic


def moon_name(phase):
    if phase < 1.85:
        return 'new moon'
    if phase < 7.38:
        return 'waxing crescent'
    if phase < 9.23:
        return 'first quarter'
    if phase < 14.77:
        return 'waxing gibbous'
    if phase < 16.61:
        return 'full moon'
    if phase < 22.15:
        return 'waning gibbous'
    if phase < 23.99:
        return 'last quarter'
    if phase < 27.68:
        return 'waning crescent'
    return 'new moon'


def moon_illumination(phase):
    return (1 - math.cos(2 * math.pi * phase / 29.53058867)) / 2


def daylight_hours(date, lat=LAT):
    doy = date.timetuple().tm_yday
    import calendar
    year_len = 366 if calendar.isleap(date.year) else 365
    decl = 23.45 * math.sin((2 * math.pi / year_len) * (doy - 81))
    cos_h = -math.tan(math.radians(lat)) * math.tan(math.radians(decl))
    cos_h = max(-1, min(1, cos_h))
    return (2 * math.degrees(math.acos(cos_h))) / 15


def format_hm(hours):
    h = int(hours)
    m = round((hours - h) * 60)
    return f'{h}h {m}m'


def format_clock(hours):
    h = int(hours)
    m = round((hours - h) * 60)
    if m == 60:
        h += 1
        m = 0
    suffix = 'pm' if h >= 12 else 'am'
    display = h - 12 if h > 12 else (12 if h == 0 else h)
    return f'{display}:{m:02d} {suffix}'


MONTHS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
]

ORDINALS = [
    '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
    'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
    'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth',
    'eighteenth', 'nineteenth', 'twentieth', 'twenty-first', 'twenty-second',
    'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth',
    'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth',
    'thirty-first',
]


def written_date(date):
    time = get_time_of_day(date)
    return f'{time}, the {ORDINALS[date.day]} of {MONTHS[date.month - 1]}'


def sky_data_lines(now):
    """three short lines: moon, sun, daylight. shown in the sky section."""
    from datetime import timedelta
    phase = moon_phase(now)
    name = moon_name(phase)
    illum = round(moon_illumination(phase) * 100)
    hours = daylight_hours(now)
    gained = (hours - daylight_hours(now - timedelta(days=1))) * 60
    sign = '+' if gained > 0 else ''
    sunrise = 12 - hours / 2
    sunset = 12 + hours / 2
    return [
        f'<strong>{name}</strong>, {illum}% lit',
        f'sunrise <strong>{format_clock(sunrise)}</strong> \u00b7 sunset <strong>{format_clock(sunset)}</strong>',
        f'<strong>{format_hm(hours)}</strong> of daylight ({sign}{gained:.1f} minutes from yesterday)',
    ]


# --- data loading ---
# all content lives in markdown files under data/


def _parse_date(s):
    """parse 'm/d' into (month, day) tuple."""
    parts = s.split('/')
    return (int(parts[0]), int(parts[1]))


def load_seasons(data_dir):
    """load season definitions from data/seasons/*.md"""
    seasons_dir = os.path.join(data_dir, 'seasons')
    seasons = []

    for filename in sorted(os.listdir(seasons_dir)):
        if not filename.endswith('.md'):
            continue
        with open(os.path.join(seasons_dir, filename)) as f:
            parsed = parse_frontmatter(f.read())

        meta = parsed['meta']
        name = meta['name']
        note = parsed['body'].strip()

        entry = {
            'name': name,
            'label': meta['label'],
            'start': _parse_date(meta['start']),
            'end': _parse_date(meta['end']),
            'note': note,
        }

        seasons.append(entry)

        # winter has a second range (dec)
        if 'start-alt' in meta:
            seasons.append({
                'name': name,
                'label': meta['label'],
                'start': _parse_date(meta['start-alt']),
                'end': _parse_date(meta['end-alt']),
                'note': note,
            })

    # sort by start month/day so lookup order is correct
    seasons.sort(key=lambda s: (s['start'][0], s['start'][1]))

    # build the canonical-order map after sorting so the nav reads
    # winter -> early spring -> ... -> late fall instead of alphabetical
    seen = {}
    for s in seasons:
        if s['name'] not in seen:
            seen[s['name']] = s

    return seasons, seen


def load_haiku(data_dir):
    """load haiku from data/haiku/*.md"""
    haiku_dir = os.path.join(data_dir, 'haiku')
    haiku = {}

    for filename in os.listdir(haiku_dir):
        if not filename.endswith('.md'):
            continue
        with open(os.path.join(haiku_dir, filename)) as f:
            parsed = parse_frontmatter(f.read())

        season = parsed['meta']['season']
        poems = []
        for block in parsed['body'].split('---'):
            lines = [l.strip() for l in block.strip().split('\n') if l.strip()]
            if len(lines) == 3:
                poems.append(lines)
        haiku[season] = poems

    return haiku


def load_moods(data_dir):
    """load weather moods from data/moods/*.md"""
    moods_dir = os.path.join(data_dir, 'moods')
    moods = {}

    for filename in os.listdir(moods_dir):
        if not filename.endswith('.md'):
            continue
        with open(os.path.join(moods_dir, filename)) as f:
            parsed = parse_frontmatter(f.read())

        season = parsed['meta']['season']
        season_moods = {}
        for line in parsed['body'].split('\n'):
            line = line.strip()
            if line.startswith('- '):
                line = line[2:]
                colon = line.index(':')
                time_name = line[:colon].strip()
                mood_text = line[colon + 1:].strip()
                season_moods[time_name] = mood_text
        moods[season] = season_moods

    return moods


def load_moon_tips(data_dir):
    """load moon gardening tips from data/moon-tips.md"""
    path = os.path.join(data_dir, 'moon-tips.md')
    with open(path) as f:
        parsed = parse_frontmatter(f.read())

    tips = []
    for line in parsed['body'].split('\n'):
        line = line.strip()
        if not line.startswith('- '):
            continue
        line = line[2:]
        colon = line.index(':')
        range_str = line[:colon].strip()
        tip_text = line[colon + 1:].strip()
        lo, hi = range_str.split('-')
        tips.append((float(lo), float(hi), tip_text))

    return tips


def load_data(data_dir):
    """load manifest, markdown files, and all structured content."""
    manifest_path = os.path.join(data_dir, 'manifest.json')
    with open(manifest_path) as f:
        manifest = json.load(f)

    files = {}
    for entry in manifest:
        path = os.path.join(data_dir, entry['path'])
        try:
            with open(path) as f:
                files[entry['path']] = f.read()
        except FileNotFoundError:
            pass

    seasons, seasons_map = load_seasons(data_dir)
    haiku = load_haiku(data_dir)
    moods = load_moods(data_dir)
    moon_tips = load_moon_tips(data_dir)

    return {
        'manifest': manifest,
        'files': files,
        'seasons': seasons,
        'seasons_map': seasons_map,
        'haiku': haiku,
        'moods': moods,
        'moon_tips': moon_tips,
    }


# --- season lookup ---

def get_season(date, seasons):
    m = date.month
    d = date.day
    for s in seasons:
        after_start = m > s['start'][0] or (m == s['start'][0] and d >= s['start'][1])
        before_end = m < s['end'][0] or (m == s['end'][0] and d <= s['end'][1])
        if after_start and before_end:
            return s
    return seasons[0]


def get_season_by_name(name, seasons_map):
    return seasons_map.get(name, list(seasons_map.values())[0])


def days_until_next_season(date, seasons):
    from datetime import datetime
    current = get_season(date, seasons)
    for s in seasons:
        s_date = datetime(date.year, s['start'][0], s['start'][1])
        if s_date.date() > date.date() and s['name'] != current['name']:
            diff = (s_date.date() - date.date()).days
            return {'days': diff, 'label': s['label']}
    first = seasons[0]
    next_date = datetime(date.year + 1, first['start'][0], first['start'][1])
    return {'days': (next_date.date() - date.date()).days, 'label': first['label']}


# --- haiku lookup ---

def get_haiku(season_name, date, haiku):
    poems = haiku.get(season_name)
    if not poems:
        return None
    doy = date.timetuple().tm_yday
    return poems[doy % len(poems)]


# --- mood lookup ---

def get_weather_mood(season_name, time, moods):
    season_moods = moods.get(season_name, {})
    text = season_moods.get(time, '')
    return render_md(text) if text else ''


# --- moon garden tip lookup ---

def moon_garden_tip(phase, moon_tips):
    for lo, hi, tip in moon_tips:
        if lo <= phase < hi:
            return tip
    return moon_tips[-1][2] if moon_tips else ''


# --- section builders ---
# each builder returns a dict: {key, title, intro, groups, lore}
# - groups: [{label, items: [html, ...]}] rendered as labeled bullet lists
# - lore: [html, ...] rendered as short prose paragraphs


def _read_md(path, files):
    body = files.get(path)
    if not body:
        return None
    return parse_frontmatter(body)


def _section_sky(now, season, data, rng):
    files = data['files']
    intro = get_weather_mood(season['name'], get_time_of_day(now), data['moods'])

    lore = []
    tip = moon_garden_tip(moon_phase(now), data['moon_tips'])
    if tip:
        lore.append(render_md(tip))

    for path in (f"sky/{season['name']}.md", f"storms/{season['name']}.md"):
        parsed = _read_md(path, files)
        if not parsed:
            continue
        items = parse_list_items(parsed['body'])
        candidates = items['bullets'] + items['prose']
        if candidates:
            pick = pick_items(candidates, 1, rng)[0]
            lore.append(render_md(pick))

    return {
        'key': 'sky',
        'title': 'sky',
        'intro': intro,
        'groups': [{'label': '', 'items': sky_data_lines(now)}],
        'lore': lore,
    }


def _section_garden(season, data, rng):
    files = data['files']
    groups = []

    parsed = _read_md(f"planting/{season['name']}.md", files)
    if parsed:
        items = parse_list_items(parsed['body'])
        if items['bullets']:
            picks = pick_items(items['bullets'], min(4, len(items['bullets'])), rng)
            groups.append({
                'label': 'in the ground now',
                'items': [render_md(p) for p in picks],
            })

    parsed = _read_md(f"planting/{season['name']}-indoors.md", files)
    if parsed:
        items = parse_list_items(parsed['body'])
        if items['bullets']:
            picks = pick_items(items['bullets'], min(3, len(items['bullets'])), rng)
            groups.append({
                'label': 'starting indoors',
                'items': [render_md(p) for p in picks],
            })

    parsed = _read_md(f"chores/{season['name']}.md", files)
    if parsed:
        items = parse_list_items(parsed['body'])
        if items['bullets']:
            picks = pick_items(items['bullets'], min(2, len(items['bullets'])), rng)
            groups.append({
                'label': 'this week',
                'items': [render_md(p) for p in picks],
            })

    return {'key': 'garden', 'title': 'garden', 'intro': '', 'groups': groups, 'lore': []}


def _section_kitchen(season, data, rng):
    files = data['files']
    groups = []
    parsed = _read_md(f"kitchen/{season['name']}.md", files)
    if parsed:
        items = parse_list_items(parsed['body'])
        bullets = list(items['bullets'])
        if bullets:
            picks = pick_items(bullets, min(4, len(bullets)), rng)
            groups.append({
                'label': 'in season',
                'items': [render_md(p) for p in picks],
            })
            remaining = [b for b in bullets if b not in picks]
            tonight = pick_items(remaining, 1, rng)[0] if remaining else picks[-1]
            groups.append({
                'label': 'tonight',
                'items': [render_md(tonight)],
            })
    return {'key': 'kitchen', 'title': 'kitchen', 'intro': '', 'groups': groups, 'lore': []}


def _section_foraging(season, data, rng):
    files = data['files']
    groups = []
    lore = []
    parsed = _read_md(f"foraging/{season['name']}.md", files)
    if parsed:
        items = parse_list_items(parsed['body'])
        if items['bullets']:
            picks = pick_items(items['bullets'], min(4, len(items['bullets'])), rng)
            groups.append({'label': '', 'items': [render_md(p) for p in picks]})
        if items['prose']:
            lore.append(render_md(items['prose'][0]))
    return {'key': 'foraging', 'title': 'foraging', 'intro': '', 'groups': groups, 'lore': lore}


def _section_folklore(season, data, rng):
    files = data['files']
    lore = []

    parsed = _read_md(f"names/{season['name']}.md", files)
    if parsed:
        items = parse_list_items(parsed['body'])
        if items['prose']:
            lore.append(render_md(items['prose'][0]))
        elif items['bullets']:
            picks = pick_items(items['bullets'], min(2, len(items['bullets'])), rng)
            lore.append(' '.join(render_md(p) for p in picks))

    parsed = _read_md(f"remedies/{season['name']}.md", files)
    if parsed:
        items = parse_list_items(parsed['body'])
        parts = []
        if items['bullets']:
            parts.append(render_md(pick_items(items['bullets'], 1, rng)[0]))
        if items['prose']:
            parts.append(render_md(items['prose'][0]))
        if parts:
            lore.append(' '.join(parts))

    parsed = _read_md(f"bugs/{season['name']}.md", files)
    if parsed:
        items = parse_list_items(parsed['body'])
        if items['bullets']:
            lore.append(render_md(pick_items(items['bullets'], 1, rng)[0]))

    return {'key': 'folklore', 'title': 'folklore', 'intro': '', 'groups': [], 'lore': lore}


SECTION_BUILDERS = [_section_sky, _section_garden, _section_kitchen, _section_foraging, _section_folklore]


def render_sections_html(sections):
    """render the section list to a single HTML string used by both
    the server-side template and the JSON API response."""
    parts = []
    for s in sections:
        if not s['groups'] and not s['lore'] and not s.get('intro'):
            continue
        parts.append(f'<section class="bucket bucket-{s["key"]}">')
        parts.append(f'<h2>{s["title"]}</h2>')
        if s.get('intro'):
            parts.append(f'<p class="bucket-intro">{s["intro"]}</p>')
        for g in s['groups']:
            if g.get('label'):
                parts.append(f'<p class="bucket-label">{g["label"]}</p>')
            parts.append('<ul class="bucket-list">')
            for item in g['items']:
                parts.append(f'<li>{item}</li>')
            parts.append('</ul>')
        for line in s.get('lore', []):
            parts.append(f'<p class="bucket-lore">{line}</p>')
        parts.append('</section>')
    return ''.join(parts)


# --- content assembly ---

def assemble_content(now, data, season_override=None):
    """assemble the full page content for a given moment."""
    seasons = data['seasons']
    seasons_map = data['seasons_map']

    season = get_season_by_name(season_override, seasons_map) if season_override else get_season(now, seasons)
    real_time = get_time_of_day(now)

    note_html = render_md_block(season['note'])
    nxt = days_until_next_season(now, seasons)
    if nxt['days'] <= 7:
        note_html += '<p>' + nxt['label'] + ' begins in ' + str(nxt['days']) + (' day.' if nxt['days'] == 1 else ' days.') + '</p>'

    haiku_lines = get_haiku(season['name'], now, data['haiku'])
    haiku_html = ''
    if haiku_lines:
        haiku_html = ''.join(f'<span class="haiku-line">{line}</span>' for line in haiku_lines)

    rng = seeded_random(day_hash(now))
    sections = [build(now, season, data, rng) if build is _section_sky else build(season, data, rng)
                for build in SECTION_BUILDERS]
    sections_html = render_sections_html(sections)

    footer_text = f"{nxt['days']} days until {nxt['label']} \u00b7 zone 7a \u00b7 north carolina"

    return {
        'date_line': written_date(now),
        'season_name': season['label'],
        'season_note': note_html,
        'season_key': season['name'],
        'time_key': real_time,
        'haiku_html': haiku_html,
        'sections_html': sections_html,
        'footer_text': footer_text,
        'season_nav_html': build_season_nav(season, seasons_map),
    }


# --- navigation ---

def build_season_nav(active_season, seasons_map):
    html = ''
    for name, s in seasons_map.items():
        cls = ' class="active" aria-current="true"' if s['name'] == active_season['name'] else ''
        html += f'<a data-season="{s["name"]}"{cls}>{s["label"]}</a>'
    return html
