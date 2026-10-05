import json
from pathlib import Path

def update_marking_schemes():
    table_spec = {
        '2017': {'nat': (4, 0), 'msq': (4, 0, False), 'mcq': (3, -1)},
        '2018': {'nat': (4, 0), 'msq': (4, 0, False), 'mcq': (3, -1)},
        '2019': {'nat': (3, 0), 'msq': (3, -0.19, False), 'mcq': (4, -1.32)},
        '2020': {'nat': (4, 0), 'msq': (4, -0.19, False), 'mcq': (3, -0.71)},
        '2021': {'nat': (4, 0), 'msq': (4, -0.19, False), 'mcq': (3, -0.71)},
        '2022': {'nat': (4, 0), 'msq': (4, -1, True), 'mcq': (3, -0.71)},
        '2023': {'nat': (4, 0), 'msq': (4, -1, True), 'mcq': (3, -0.71)},
        '2024': {'nat': (4, 0), 'msq': (4, -1, True), 'mcq': (3, -0.71)},
        '2025': {'nat': (4, 0), 'msq': (4, -1, True), 'mcq': (3, -0.71)},
        '2026': {'nat': (4, 0), 'msq': (4, -1, True), 'mcq': (3, -0.71)},
    }

    fixtures = sorted(Path('fixtures').glob('uceed-*.json'))

    for f in fixtures:
        data = json.loads(f.read_text(encoding='utf-8'))
        fid = data.get('id', '')
        year = None
        for y in table_spec:
            if y in fid or f.name.startswith(f"uceed-{y}"):
                year = y
                break
        if not year:
            continue

        spec = table_spec[year]
        modified = 0

        for q in data['questions']:
            t = q['type'].lower()
            if t == 'nat':
                corr, inc = spec['nat']
                q['marks'] = {'correct': corr, 'incorrect': inc, 'unanswered': 0}
            elif t == 'msq':
                corr, inc, has_partial = spec['msq']
                q['marks'] = {'correct': corr, 'incorrect': inc, 'unanswered': 0}
                if not has_partial and 'partialCredit' in q:
                    del q['partialCredit']
                    modified += 1
                elif has_partial and 'partialCredit' not in q:
                    q['partialCredit'] = {'1': 1, '2': 2, '3': 3}
                    modified += 1
            elif t == 'mcq':
                corr, inc = spec['mcq']
                q['marks'] = {'correct': corr, 'incorrect': inc, 'unanswered': 0}

        # Recalculate max marks
        data['maxMarks'] = sum(q['marks']['correct'] for q in data['questions'])

        f.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f"Updated {f.name} ({year}): maxMarks={data['maxMarks']}, modified partialCredit on {modified} questions")

if __name__ == "__main__":
    update_marking_schemes()
