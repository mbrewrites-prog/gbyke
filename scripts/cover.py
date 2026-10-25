"""Automatic cover: OpenAI scene with the avatar (via Make) + quiz-name card and Spang Torie logo (fixed style)."""
import json, os, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter
COVER_HOOK = 'https://hook.eu2.make.com/b5d9vrdej87l86xqjiq8wp24jn7pck9a'
FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf'
DARK = (31, 19, 0)
PALETTE = [(221, 97, 74), (249, 203, 64), (115, 165, 128), (244, 134, 104)]   # rood, geel, groen, zalm (rotating)
NAMES = {'piramide': 'Woordpiramide', 'husselaar': 'Letterhusselaar', 'cryptisch': 'Cryptische omschrijving',
         'code': 'Code kraken', 'klinkers': 'Ontbrekende klinkers', 'tweewoorden': 'Twee woorden worden één'}
DEFAULT_SCENE = {'piramide': 'a cosy living room, she stacks plain blank wooden blocks into a small pyramid on a low table',
                 'husselaar': 'the steps of a sunny city square, she rearranges a row of plain blank wooden letter tiles beside her',
                 'cryptisch': 'a bright café terrace, she thinks with a pencil at her lips over a notebook with blank pages',
                 'code': 'a tidy desk in the evening, she turns the dials of a small brass combination lock',
                 'klinkers': 'a bench in a green park, she smiles at her phone while playing a word game (screen facing away)',
                 'tweewoorden': 'a rooftop terrace at golden hour, she holds two plain blank wooden puzzle pieces that fit together'}

def scene_prompt(e):
    scene = e.get('scene') or DEFAULT_SCENE[e['type']]
    outfit = e.get('outfit') or 'an oversized bomber jacket, plain white T-shirt, cargo trousers and plain sneakers'
    return ("Use the two reference photos ONLY for the identity of the woman: keep her exact face, dark skin tone, eyebrows and smile. "
            "Create a NEW vertical lifestyle photo. CAMERA: wide full-body shot taken from about 4 metres away, she is small in the frame. "
            "Her HEAD must be in the MIDDLE of the image (between 45% and 55% of the image height, measured from the top), and the entire "
            "TOP 40% of the image must be only a calm, softly blurred background with no people and no busy details. "
            "HAIR: sleek, pulled back with a centre part into ONE single long thick braid over one shoulder, gold hoop earrings. "
            f"Scene: {scene}. OUTFIT (contemporary streetwear): {outfit}. "
            "Photorealistic, natural skin texture, shallow depth of field, natural light, 35mm film look. Cheerful mood. "
            "Plain sneakers without any logo. No brand logos, no text, no letters, no numbers, no signs anywhere in the image.")

def make_cover(e, out_dir, logo_path):
    font = os.path.join(out_dir, 'Poppins-Bold.ttf')
    if not os.path.exists(font): urllib.request.urlretrieve(FONT_URL, font)
    req = urllib.request.Request(COVER_HOOK, data=json.dumps({'prompt': scene_prompt(e), 'file_name': f"gbyke_scene_{e['id']}_{e['answer']}.jpg"}).encode(),
                                 headers={'Content-Type': 'application/json'})
    raw = os.path.join(out_dir, 'scene.jpg'); open(raw, 'wb').write(urllib.request.urlopen(req, timeout=300).read())
    W, H, card_top = 1080, 1920, 310
    src = Image.open(raw).convert('RGB'); s = max(W / src.width, H / src.height)
    im = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS); x = (im.width - W) // 2; im = im.crop((x, 0, x + W, H))
    word = NAMES[e['type']]; fill = PALETTE[e['id'] % 4]; size = 190; fw = ImageFont.truetype(font, size); d = ImageDraw.Draw(im, 'RGBA')
    while d.textbbox((0, 0), word, font=fw)[2] > W * 0.84 - 160: size -= 6; fw = ImageFont.truetype(font, size)
    wb = d.textbbox((0, 0), word, font=fw); logo_h = 96
    cw = min(int(W * 0.84), max(int(W * 0.56), (wb[2] - wb[0]) + 160)); cx = (W - cw) // 2; ch = logo_h // 2 + 40 + (wb[3] - wb[1]) + 56
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((cx + 6, card_top + 16, cx + cw + 6, card_top + ch + 16), 44, fill=(0, 0, 0, 100))
    sh = sh.filter(ImageFilter.GaussianBlur(20)); im.paste(sh, (0, 0), sh)
    d = ImageDraw.Draw(im, 'RGBA'); d.rounded_rectangle((cx, card_top, cx + cw, card_top + ch), 44, fill=fill)
    logo = Image.open(logo_path).convert('RGBA'); lw = int(logo_h * logo.width / logo.height); logo = logo.resize((lw, logo_h), Image.LANCZOS)
    cw2, chh = lw + 40, logo_h + 20; chx, chy = (W - cw2) // 2, card_top - chh // 2
    d.rounded_rectangle((chx, chy, chx + cw2, chy + chh), 22, fill=DARK); im.paste(logo, (chx + (cw2 - lw) // 2, chy + (chh - logo_h) // 2), logo)
    y = chy + chh + 28; d.text(((W - (wb[2] - wb[0])) // 2 - wb[0], y - wb[1]), word, font=fw, fill=DARK)
    path = os.path.join(out_dir, f"GBYKE_cover_{e['id']}_{e['answer']}.jpg"); im.save(path, quality=92, optimize=True)
    return path
