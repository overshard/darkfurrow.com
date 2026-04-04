"""
app.py

the root that holds the page together.
"""

import os
from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, render_template, request

from almanac import assemble_content, load_data

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
DATA = load_data(DATA_DIR)


@app.route('/')
def index():
    now = datetime.now(ZoneInfo('America/New_York'))
    content = assemble_content(now, DATA)
    return render_template('index.html', **content)


@app.route('/api/content')
def api_content():
    now = datetime.now(ZoneInfo('America/New_York'))
    season_override = request.args.get('season')
    time_override = request.args.get('time')
    content = assemble_content(
        now, DATA,
        season_override=season_override,
        time_override=time_override,
    )
    return jsonify(content)
