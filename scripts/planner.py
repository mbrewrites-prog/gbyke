"""Automatic weekly quiz planner: picks words from wortubuku-compleet.csv (via Make), lets Claude build the quizzes
(via Make), and keeps only quizzes that pass every fixed rule. No human step needed."""
import csv, io, json, random, re, urllib.request, datetime, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import rules
DICT_HOOK = 'https://hook.eu2.make.com/t7l68iyt2nq1804dk8y87j5cy21i2yz3'
CLAUDE_HOOK = 'https://hook.eu2.make.com/advxg31wkv83sa307tsbwa16ija8ns7v'
ORDER = ['piramide', 'husselaar', 'cryptisch', 'code', 'klinkers', 'tweewoorden']
LAYERS = [4, 5, 6, 7]
# never: Winti / spiritual practice, curse words, vulgar or crude language, sex, body parts, STI/STD
# A word is refused when ANY of its meanings (all senses in translation, definition and domain) hits one of these,
# so a word that is innocent in one meaning but a curse word / vulgar / sexual in another meaning is never used.
BAD_MARKERS = [r'winti', r'obia', r'bonu', r'afgod', r'tover', r'vloek', r'scheld', r'vulg', r'\bgrof', r'\bplat\b', r'ordinair',
               r'beledig', r'\bpej', r'ongunstig', r'seks', r'\bsex', r'erot', r'geslachts', r'penis', r'vagina', r'schaam', r'\bborst',
               r'\bbillen\b', r'\bkont\b', r'\bsoa\b', r'\bhoer', r'neuk', r'naakt', r'verkracht', r'\bdrugs?\b', r'\bwiet\b',
               r'dronken', r'\bdood\b', r'moord', r'\blijk\b', r'naai', r'bezeten', r'geest']
BAD_RE = re.compile('|'.join(BAD_MARKERS))

def post(url, payload, timeout=300):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    return urllib.request.urlopen(req, timeout=timeout).read()

def load_dictionary():
    raw = post(DICT_HOOK, {}).decode('utf-8-sig')
    return list(csv.DictReader(io.StringIO(raw), delimiter=';'))

def clean_sets(rows):
    bad_words = rules.blocklist()
    answers, any_word = {}, {}
    for r in rows:
        w = (r.get('word') or '').strip()
        if not re.fullmatch(r'[a-z]+', w) or w in bad_words: continue        # lowercase only = no names/places
        tr = (r.get('translation') or '').strip()
        if not tr or 'gramm' in (r.get('word_type') or '').lower(): continue
        items = [t.strip() for t in tr.split(';') if t.strip()]
        safe = [t for t in items if not BAD_RE.search(t.lower())]          # the innocent meanings of this word
        extra = ' '.join([r.get('definition') or '', r.get('domain') or '']).lower()
        # a word with several meanings is allowed, but ONLY with its innocent meaning (asi = paard, never anything else);
        # refused when it has no innocent meaning, or when its main (first) meaning is itself a curse/vulgar/Winti meaning
        if not safe or (BAD_RE.search(items[0].lower()) and BAD_RE.search(extra)): continue
        any_word[w] = safe[0]
        if 3 <= len(w) <= 9: answers[w] = safe[0]
    return answers, any_word

def prompt_for(n, start_type, start_layer, sample, short_words, recent):
    types = [ORDER[(start_type + k) % 6] for k in range(n)]
    layers, li = [], start_layer
    for t in types:
        if t == 'piramide': layers.append(LAYERS[li % 4]); li += 1
        else: layers.append(None)
    plan = '\n'.join(f"{k+1}. type={t}" + (f", layers={L}" if L else '') for k, (t, L) in enumerate(zip(types, layers)))
    return f"""Je maakt Sranantongo-quizzen voor Spang Torie Academy (Gebroiki Yu Koni Esi). Maak precies {n} quizzen in deze volgorde:
{plan}

HARDE REGELS
- Antwoorden ALLEEN uit de lijst ANTWOORDWOORDEN hieronder (exact zo gespeld). Gebruik UITSLUITEND de Nederlandse betekenis die in de lijst staat: dat is altijd de onschuldige betekenis. Heeft een woord ook een andere betekenis (bijv. asi = paard), noem of verwijs daar NOOIT naar, ook niet in de hint, de omschrijving of de scène.
- Geen scheldwoorden en geen dubbelzinnige woorden: een woord dat in één betekenis onschuldig is maar in een andere betekenis een scheldwoord, grof, plat of seksueel kan zijn, is VERBODEN. Ook niets over Winti of spirituele praktijken, geen grove taal. Kies vrolijke, alledaagse, familievriendelijke woorden.
- Niet gebruiken (recent gebruikt): {', '.join(sorted(recent)) or '-'}
- Elk antwoord maar één keer in deze set.
- hint: één korte Nederlandse zin die helpt zonder het antwoord of de vertaling letterlijk te noemen.
- scene en outfit (Engels): een alledaagse, fotogenieke plek voor de coverfoto die het antwoord NIET verklapt; outfit is eigentijdse streetwear (bijv. bomberjack, cargo, oversized tee, denim, hoodie, sneakers zonder logo).

PER TYPE (velden)
- piramide: answer (precies 'layers' letters), rows = lijst van layers-1 Sranantongo-woorden met 1, 2, 3, … letters (rij k heeft k letters), ALLE rijwoorden uit de lijst KORTE WOORDEN, en ELKE letter van het antwoord moet in de rijwoorden voorkomen; row_meanings = Nederlandse betekenis per rij.
- husselaar: answer (max 7 letters), extra = één letter die NIET in het antwoord zit.
- cryptisch: answer (max 8 letters), clue = cryptische Nederlandse omschrijving (max 15 woorden), extra_line = korte uitleg (max 8 woorden).
- code: answer (max 7 letters).
- klinkers: answer (max 9 letters, minstens 2 klinkers).
- tweewoorden: answer (max 10 letters) dat te splitsen is in TWEE Sranantongo-woorden die allebei in KORTE WOORDEN of ANTWOORDWOORDEN staan; words = twee losse Nederlandse woorden (één woord per deel, mag een synoniem zijn, wissel makkelijk en moeilijk af).

Antwoord ALLEEN met een JSON-array, zonder uitleg. Elk object: {{"type","answer","meaning","hint","scene","outfit", + typevelden}}.

ANTWOORDWOORDEN (woord = betekenis):
{chr(10).join(f'{w} = {m}' for w, m in sample)}

KORTE WOORDEN (voor piramiderijen en samenstellingen):
{', '.join(short_words)}
"""

def plan(cal, n=7, today=None):
    today = today or datetime.date.today()
    rows = load_dictionary(); answers, any_word = clean_sets(rows)
    used = {e['answer'] for e in cal}
    recent = {e['answer'] for e in cal if e.get('made_on') and (today - datetime.date.fromisoformat(e['made_on'])).days < 90} | \
             {e['answer'] for e in cal if e.get('status') == 'klaar'}
    rnd = random.Random(str(today))
    pool = [(w, m) for w, m in answers.items() if w not in used]
    sample = rnd.sample(pool, min(140, len(pool)))
    short_words = sorted(w for w in any_word if len(w) <= 6)
    last = [e for e in cal if e.get('type') in ORDER]
    start_type = (ORDER.index(last[-1]['type']) + 1) % 6 if last else 0
    pyrs = [len(e['rows']) + 1 for e in cal if e.get('type') == 'piramide' and e.get('rows')]
    start_layer = (LAYERS.index(pyrs[-1]) + 1) % 4 if pyrs and pyrs[-1] in LAYERS else 0
    text = post(CLAUDE_HOOK, {'prompt': prompt_for(n + 3, start_type, start_layer, sample, short_words, recent)}, timeout=600).decode()
    m = re.search(r'\[.*\]', text, re.S)
    items = json.loads(m.group(0)) if m else []
    good, nid = [], max([e['id'] for e in cal] or [0]) + 1
    for it in items:
        try:
            a = it['answer'].lower().strip()
            if a in used or a in recent or a in {g['answer'] for g in good}: raise ValueError('al gebruikt')
            if it['type'] == 'tweewoorden':
                if not any(a[:k] in any_word and a[k:] in any_word for k in range(2, len(a) - 1)): raise ValueError('geen 2 Sranantongo-delen')
                it['meaning'] = it.get('meaning') or answers.get(a, '')
            elif a not in answers: raise ValueError('niet in woordenboek/veilige lijst')
            else: it['meaning'] = answers[a]                     # meaning always from the dictionary
            if it['type'] == 'piramide':
                if any(r.lower() not in any_word and r.lower() not in ('a', 'e', 'o', 'i') for r in it['rows']): raise ValueError('rijwoord niet in woordenboek')
                it['row_meanings'] = [any_word.get(r.lower(), m) for r, m in zip(it['rows'], it.get('row_meanings', it['rows']))]
            e = dict({'id': nid, 'status': 'klaar', 'planned_by': 'claude', 'planned_on': str(today)}, **it); e['answer'] = a
            rules.build(e)                                            # all fixed quiz rules + blocklist
            good.append(e); nid += 1
        except Exception as err:
            print('AFGEKEURD', it.get('type'), it.get('answer'), '-', err)
        if len(good) >= n: break
    print('GEPLAND:', [(g['type'], g['answer']) for g in good])
    return good
