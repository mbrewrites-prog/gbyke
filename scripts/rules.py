"""Builds the template settings for any word and checks the fixed rules per quiz type."""
import json, random, re, os
VOWELS = set('aeiou')
TYPES = {
  'piramide':    {'page': 'piramide.html'},
  'husselaar':   {'page': 'husselaar.html'},
  'cryptisch':   {'page': 'generiek.html', 'game': 'CRYPTISCHE OMSCHRIJVING', 'theme': 'butter', 'mode': 'clue',
                  'title': 'Welk woord zoeken we?', 'sub': 'Lees de omschrijving goed.'},
  'code':        {'page': 'generiek.html', 'game': 'CODE KRAKEN', 'theme': 'mint', 'mode': 'code',
                  'title': 'Ontcijfer de code', 'sub': 'Elke letter is 1 plaats verschoven: a = 2, b = 3, c = 4 …'},
  'klinkers':    {'page': 'generiek.html', 'game': 'ONTBREKENDE KLINKERS', 'theme': 'candy', 'mode': 'vowels',
                  'title': 'Welke klinkers ontbreken?', 'sub': 'Vul het volledige woord in.'},
  'tweewoorden': {'page': 'generiek.html', 'game': 'TWEE WOORDEN WORDEN ÉÉN', 'theme': 'candy', 'mode': 'clue', 'two': True,
                  'title': 'Welk woord zoeken we?', 'sub': 'Twee woorden worden één Surinaams woord.'},
}
GAME_NAME = {'piramide': 'Woordpiramide', 'husselaar': 'Letterhusselaar', 'cryptisch': 'Cryptische omschrijving',
             'code': 'Code kraken', 'klinkers': 'Ontbrekende klinkers', 'tweewoorden': 'Twee woorden worden één'}

def blocklist():
    p = os.path.join(os.path.dirname(__file__), '..', 'blocklist.txt')
    return {l.strip().lower() for l in open(p, encoding='utf-8') if l.strip() and not l.startswith('#')}

def check_clean(e):
    bad = blocklist()
    text = ' '.join(str(v) for v in e.values()).lower()
    words = set(re.findall(r"[a-zà-ÿ]+", text))
    hits = sorted(words & bad)
    if hits: raise ValueError('verboden woord(en): ' + ', '.join(hits))

def build(e):
    """e = one calendar entry. Returns (page, quiz_json_dict). Raises ValueError when a rule is broken."""
    t = e['type']; w = e['answer'].lower().strip(); A = list(w)
    if t not in TYPES: raise ValueError('onbekend type ' + t)
    if not re.fullmatch(r'[a-z]+', w): raise ValueError('antwoord mag alleen letters a-z bevatten')
    check_clean(e)
    base = {k: v for k, v in TYPES[t].items() if k != 'page'}
    card = f"{w} = {e['meaning']}"
    if t == 'piramide':
        rows = [r.lower() for r in e['rows']]; N = len(rows) + 1
        if N not in (4, 5, 6, 7) or [len(r) for r in rows] != list(range(1, N)) or len(A) != N:
            raise ValueError('piramide: 4-7 lagen; bovenste lagen hebben 1, 2, 3 … letters en het antwoord N letters')
        if not set(A) <= set(''.join(rows)): raise ValueError('piramide: antwoord gebruikt letters die niet in de lagen staan')
        distinct = len(set(A)) == N
        sub = (f'Vul de onderste laag met {N} verschillende letters uit de lagen erboven.' if distinct
               else f'Vul de onderste laag ({N} letters) met letters uit de lagen erboven.')
        pairs = list(zip(rows, e['row_meanings']))
        cfg = {'title': 'Maak de piramide af', 'sub': sub, 'rows': [list(r) for r in rows] + [['?'] * N], 'answer': A,
               'answerCard': card, 'meanings': ' &nbsp;|&nbsp; '.join(f"{r} = {m}" for r, m in (pairs if N <= 5 else pairs[-3:]))}
    elif t == 'husselaar':
        x = e['extra'].lower()
        if len(x) != 1 or len(A) > 7: raise ValueError('husselaar: precies 1 extra letter, antwoord max. 7 letters')
        letters = A + [x]; rnd = random.Random(w)
        for _ in range(50):
            rnd.shuffle(letters)
            if ''.join(letters[:len(A)]) != w: break
        cfg = {'title': 'Maak er een woord van', 'sub': 'Eén letter hoort er niet bij.', 'letters': letters,
               'answer': A, 'extra': letters.index(x), 'answerCard': card, 'meanings': f"De letter {x} hoort er niet bij"}
    elif t == 'code':
        if len(A) > 7: raise ValueError('code: max. 7 letters')
        codes = [str(ord(c) - 96 + 1) for c in A]
        cfg = dict(base, codes=codes, answer=A, answerCard=card, meanings=' · '.join(codes) + '  →  ' + ' · '.join(A))
    elif t == 'klinkers':
        if len(A) > 9 or not (VOWELS & set(A)): raise ValueError('klinkers: max. 9 letters en minstens één klinker')
        pattern = ['?' if c in VOWELS else c for c in A]
        cfg = dict(base, pattern=pattern, answer=A, answerCard=card,
                   meanings='De ontbrekende klinkers: ' + ' · '.join(c for c in A if c in VOWELS))
    elif t == 'cryptisch':
        if len(A) > 8: raise ValueError('cryptisch: max. 8 letters')
        cfg = dict(base, clue=e['clue'], answer=A, answerCard=card, meanings=e.get('extra_line', e['meaning']))
    elif t == 'tweewoorden':
        if len(A) > 8: raise ValueError('tweewoorden: max. 8 letters')
        w1, w2 = e['words']
        cfg = dict(base, clue=f"{w1}&nbsp;&nbsp;+&nbsp;&nbsp;{w2}", answer=A, answerCard=card,
                   meanings=f"{w1} + {w2} → {e['meaning']}")
    cfg['hint'] = e['hint']
    return TYPES[t]['page'], cfg

def caption(e):
    name = GAME_NAME[e['type']]
    return (f"🧩 {name} van de dag!\n\nWeet jij het antwoord? Speel mee en zet je antwoord in de reacties 👇\n"
            f"Het antwoord zie je aan het einde van de video.\n\n"
            f"Leer elke dag een nieuw Sranantongo-woord met Gebroiki Yu Koni Esi 🇸🇷\n\n"
            f"#Sranantongo #Surinaams #GebroikiYuKoniEsi #SpangTorieAcademy #LeerSranantongo #Quiz #Taalquiz")
