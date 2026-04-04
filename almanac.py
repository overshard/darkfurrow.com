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

TIME_LABELS = ['night', 'dawn', 'morning', 'afternoon', 'evening']

TIME_CONTENT = {
    'night':     ['sky/', 'names/', 'remedies/', 'storms/'],
    'dawn':      ['planting/', 'foraging/'],
    'morning':   ['planting/', 'chores/', 'bugs/'],
    'afternoon': ['kitchen/', 'bugs/', 'chores/'],
    'evening':   ['kitchen/', 'remedies/', 'foraging/', 'names/', 'storms/'],
}


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


def highlight_text(text):
    fragments = re.split(r'(?<=\.)\s+', text)
    result = []
    for frag in fragments:
        trimmed = frag.strip()
        if not trimmed:
            continue
        plain = re.sub(r'</?strong>', '', trimmed)
        words = plain.split()

        if len(words) <= 4:
            result.append(f'<strong>{trimmed}</strong>')
            continue

        if '<strong>' in trimmed:
            result.append(trimmed)
            continue

        comma = trimmed.find(',')
        if 0 < comma < 30:
            result.append(f'<strong>{trimmed[:comma]}</strong>{trimmed[comma:]}')
            continue

        first = words[0].lower()
        count = 3 if first in ('the', 'a', 'an', 'if', 'when', 'it', 'and', 'or', 'but', 'do', 'in') else 2
        count = min(count, len(words))
        result.append(f'<strong>{" ".join(words[:count])}</strong> {" ".join(words[count:])}')

    return ' '.join(result)


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


def sky_text(now, time):
    phase = moon_phase(now)
    name = moon_name(phase)
    illum = round(moon_illumination(phase) * 100)
    hours = daylight_hours(now)
    from datetime import timedelta
    yesterday = now - timedelta(days=1)
    gained = (hours - daylight_hours(yesterday)) * 60
    sign = '+' if gained > 0 else ''
    sunrise = 12 - hours / 2
    sunset = 12 + hours / 2

    bold_name = f'<strong>{name}</strong>'
    lines = []

    if time == 'night':
        lines.append(f'the moon is {bold_name}, {illum}% lit.')
        lines.append('the world is turned away from the sun.')
        lines.append(f'<strong>{format_hm(hours)}</strong> of daylight today. {sign}{gained:.1f} minutes from yesterday.')
    elif time == 'dawn':
        lines.append(f'the sun rises around <strong>{format_clock(sunrise)}</strong>.')
        lines.append(f'the moon is {bold_name}, {illum}% lit.')
        lines.append(f'<strong>{format_hm(hours)}</strong> of daylight ahead. it sets around {format_clock(sunset)}.')
    elif time == 'evening':
        lines.append(f'the sun set around <strong>{format_clock(sunset)}</strong>.')
        lines.append(f'the moon is {bold_name}, {illum}% lit.')
        lines.append(f'there were <strong>{format_hm(hours)}</strong> of daylight today. {sign}{gained:.1f} minutes from yesterday.')
    else:
        lines.append(f'the moon is {bold_name}, {illum}% lit.')
        lines.append(f'the sun rose around <strong>{format_clock(sunrise)}</strong> and sets around <strong>{format_clock(sunset)}</strong>.')
        lines.append(f'<strong>{format_hm(hours)}</strong> of daylight today. {sign}{gained:.1f} minutes from yesterday.')

    return '<br>'.join(lines)


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
    seen = {}

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

        # primary date range
        seasons.append(entry)
        if name not in seen:
            seen[name] = entry

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


# --- content assembly ---

def assemble_content(now, data, season_override=None, time_override=None):
    """assemble the full page content for a given moment."""
    seasons = data['seasons']
    seasons_map = data['seasons_map']
    manifest = data['manifest']
    files = data['files']

    season = get_season_by_name(season_override, seasons_map) if season_override else get_season(now, seasons)
    real_time = get_time_of_day(now)
    content_time = time_override or real_time

    # date line
    date_line = written_date(now)

    # season header
    note_html = render_md_block(season['note'])
    nxt = days_until_next_season(now, seasons)
    if nxt['days'] <= 7:
        note_html += '<p>' + nxt['label'] + ' begins in ' + str(nxt['days']) + (' day.' if nxt['days'] == 1 else ' days.') + '</p>'

    # haiku
    haiku_lines = get_haiku(season['name'], now, data['haiku'])
    haiku_html = ''
    if haiku_lines:
        haiku_html = ''.join(f'<span class="haiku-line">{line}</span>' for line in haiku_lines)

    # moon phase for garden tip
    phase = moon_phase(now)

    # weather mood
    weather_mood = get_weather_mood(season['name'], content_time, data['moods'])

    # sky data
    sky_data = sky_text(now, content_time)

    # footer
    footer_text = f"{nxt['days']} days until {nxt['label']} \u00b7 zone 7a \u00b7 north carolina"

    # seed the rng for today
    rng = seeded_random(day_hash(now))

    # filter manifest
    allowed_prefixes = TIME_CONTENT.get(content_time, [])
    relevant = []
    for entry in manifest:
        if 'time' in entry:
            if entry['time'] == content_time:
                relevant.append(entry)
        elif 'season' in entry:
            if entry['season'] != season['name']:
                continue
            for prefix in allowed_prefixes:
                if entry['path'].startswith(prefix):
                    relevant.append(entry)
                    break

    # parse entries
    entries = []
    for entry in relevant:
        text = files.get(entry['path'])
        if text is None:
            continue
        entries.append(parse_frontmatter(text))

    # collect fragments
    fragments = []
    fragments.append(moon_garden_tip(phase, data['moon_tips']))

    # wisdom lines
    for entry in entries:
        if 'time' not in entry['meta']:
            continue
        lines = [l.strip() for l in entry['body'].split('\n') if l.strip()]
        if not lines:
            continue
        picks = pick_items(lines, min(2, len(lines)), rng)
        fragments.extend(picks)

    # seasonal entries
    for entry in entries:
        if 'time' in entry['meta']:
            continue
        parsed = parse_list_items(entry['body'])

        if parsed['bullets']:
            picks = pick_items(parsed['bullets'], 1, rng)
            fragments.extend(picks)

        if parsed['prose']:
            prose_pick = pick_items(parsed['prose'], 1, rng)
            fragments.append(prose_pick[0])

    # shuffle
    for i in range(len(fragments) - 1, 0, -1):
        j = int(rng() * (i + 1))
        fragments[i], fragments[j] = fragments[j], fragments[i]

    # compose into paragraphs
    sep = ' <span class="sep">\u2767</span> '
    chunk_size = min(4, max(1, math.ceil(len(fragments) / 2)))
    narrative_html = ''
    for c in range(0, len(fragments), chunk_size):
        chunk = fragments[c:c + chunk_size]
        html = sep.join(highlight_text(render_md(f)) for f in chunk)
        narrative_html += f'<p class="narrative">{html}</p>'

    # build nav html
    season_nav_html = build_season_nav(season, seasons_map)
    time_nav_html = build_time_nav(content_time, real_time)

    return {
        'date_line': date_line,
        'season_name': season['label'],
        'season_note': note_html,
        'season_key': season['name'],
        'time_key': real_time,
        'content_time': content_time,
        'haiku_html': haiku_html,
        'weather_mood': weather_mood,
        'sky_data': sky_data,
        'narrative_html': narrative_html,
        'footer_text': footer_text,
        'season_nav_html': season_nav_html,
        'time_nav_html': time_nav_html,
    }


# --- navigation ---

def build_season_nav(active_season, seasons_map):
    html = ''
    for name, s in seasons_map.items():
        cls = ' class="active" aria-current="true"' if s['name'] == active_season['name'] else ''
        html += f'<a data-season="{s["name"]}"{cls}>{s["label"]}</a>'
    return html


def build_time_nav(active_time, natural_time):
    html = ''
    for t in TIME_LABELS:
        cls = ' class="active" aria-current="true"' if t == active_time else ''
        html += f'<a data-time="{t}"{cls}>{t}</a>'
    if active_time != natural_time:
        html += '<a class="return-now" data-time="now">return to now</a>'
    return html
