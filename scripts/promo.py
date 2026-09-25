"""GBYKE promo for Spang Torie Academy: avatar (speaks the whole text) + feature cards + Afro house take 1 underneath."""
import json, os, sys, subprocess, datetime, threading, http.server, socketserver, urllib.request, shutil
sys.path.insert(0, os.path.dirname(__file__))
from daily import drive, sh, serve, TPL, OUT, FPS, MUSIC_ID
PROMO_AVATAR_ID = os.environ.get('PROMO_AVATAR_ID', '')          # Drive id of GBYKE_promo_avatar.mp4 (SPA Audio)
SPANG_BRAND = '7053287'
# the spoken text, split per card (used to time the cards)
PARTS = ["Wil jij spelenderwijs Sranantongo leren? Speel dan mee met Gebroiki Yu Koni Esi!",
         "Eén: elke dag een nieuwe quiz met een nieuw Surinaams woord.",
         "Twee: zes verschillende spellen, van de woordpiramide tot code kraken.",
         "Drie: bij elk antwoord leer je meteen wat het woord betekent.",
         "Zo train je je hersenen én leer je elke dag iets nieuws.",
         "Volg ons op Instagram en Facebook. Speel je mee?"]
TAIL = 2.0                                                         # music-only seconds after she finishes

def main():
    os.makedirs(OUT, exist_ok=True)
    avatar = os.environ.get('AVATAR_PATH') or drive(PROMO_AVATAR_ID, f'{OUT}/promo_avatar.mp4')
    music = os.environ.get('MUSIC_PATH') or drive(MUSIC_ID, f'{OUT}/music.mp3')
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', avatar], capture_output=True, text=True).stdout)
    total_chars = sum(len(p) for p in PARTS); acc = 0; marks = []
    for p in PARTS: marks.append(round(0.15 + (dur - 0.3) * acc / total_chars, 2)); acc += len(p)
    json.dump({'marks': marks, 'duration': dur}, open(os.path.join(TPL, 'promo.json'), 'w'))
    serve(); frames = os.path.join(OUT, 'promo_frames'); shutil.rmtree(frames, ignore_errors=True); os.makedirs(frames)
    from playwright.sync_api import sync_playwright
    n = int((dur + TAIL) * FPS)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1080, "height": 1920})
        pg.goto("http://127.0.0.1:8766/promo.html"); pg.evaluate("window.ready")
        for f in range(n):
            pg.evaluate(f"renderAt({f / FPS})"); pg.screenshot(path=f"{frames}/o{f:04d}.png", omit_background=True)
        b.close()
    total = dur + TAIL
    name = f"GBYKE_promo_{datetime.date.today():%Y-%m-%d}.mp4"; final = os.path.join(OUT, name)
    fc = (f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,tpad=stop_mode=clone:stop_duration={TAIL}[av];"
          f"[av][1:v]overlay=0:0[v];"
          f"[0:a]aresample=48000,apad[va];"
          f"[2:a]aresample=48000,aloop=loop=-1:size=2e9,volume='if(lt(t,{dur:.2f}),0.18,0.55)':eval=frame,afade=t=in:d=0.8[m];"
          f"[va][m]amix=inputs=2:duration=longest:normalize=0,atrim=0:{total:.2f},afade=t=out:st={total - 1.5:.2f}:d=1.5[a]")
    sh('ffmpeg', '-y', '-loglevel', 'error', '-i', avatar, '-framerate', str(FPS), '-i', f'{frames}/o%04d.png', '-i', music,
       '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{total:.2f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
       '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', final)
    if os.environ.get('TEST'): print('TEST OK', final); return
    tag = f"promo-{datetime.date.today():%Y-%m-%d}"; repo = os.environ['GITHUB_REPOSITORY']
    sh('gh', 'release', 'create', tag, final, '--title', 'GBYKE promo', '--notes', 'Promo video Spang Torie Academy')
    url = f"https://github.com/{repo}/releases/download/{tag}/{name}"
    cap = ("Wil jij spelenderwijs Sranantongo leren? 🇸🇷🧩\n\nSpeel elke dag mee met Gebroiki Yu Koni Esi:\n"
           "1️⃣ Elke dag een nieuwe quiz met een nieuw Surinaams woord\n2️⃣ 6 verschillende spellen\n3️⃣ Bij elk antwoord leer je wat het woord betekent\n\n"
           "👉 Volg @gbykequiz op Instagram en Facebook!\n\n#Sranantongo #Surinaams #SpangTorieAcademy #GebroikiYuKoniEsi #LeerSranantongo #Quiz")
    payload = {'brand_id': SPANG_BRAND, 'video_url': url, 'file_name': name, 'caption': cap, 'title': 'Speel mee met Gebroiki Yu Koni Esi',
               'publish_at': 'elke vrijdag (na goedkeuring)', 'answer': 'PROMO'}
    req = urllib.request.Request(os.environ['MAKE_WEBHOOK_URL'], data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    print('Make:', urllib.request.urlopen(req, timeout=300).read().decode())

if __name__ == '__main__': main()
