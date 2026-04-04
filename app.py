"""
app.py

the root that holds the page together.
"""

import os
from datetime import datetime

from flask import Flask, jsonify, render_template, request

from almanac import assemble_content, load_data

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
DATA = load_data(DATA_DIR)


@app.route('/')
def index():
    now = datetime.now()
    content = assemble_content(now, DATA)
    return render_template('index.html', **content)


@app.route('/api/content')
def api_content():
    now = datetime.now()
    season_override = request.args.get('season')
    time_override = request.args.get('time')
    content = assemble_content(
        now, DATA,
        season_override=season_override,
        time_override=time_override,
    )
    return jsonify(content)
