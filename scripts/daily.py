"""GBYKE daily quiz: take the next calendar entry, render it, assemble scene 1 + music, send to Make for archiving.
Posting only happens after approval in the Claude chat."""
import json, os, sys, subprocess, datetime, threading, http.server, socketserver, urllib.request, shutil
from zoneinfo import ZoneInfo
sys.path.insert(0, os.path.dirname(__file__))
import rules
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TPL = os.path.join(ROOT, 'templates'); OUT = os.path.join(ROOT, 'out'); FPS = 30
INTRO_ID = '1WdTv6GdlUW0dG6hDUWXcgJTP-WGDiP8C'                     # GBYKE_scene1_avatar_intro.mp4 (SPA Audio)
MUSIC_ID = '1u6JiMmFqgOSizp83Xty1ol4n0Fj_Sim9'                     # Afro house take 1 – the one fixed track
GBYKE_BRAND = '7087115'
TEST_FRAMES = int(os.environ.get('TEST_FRAMES', '0'))              # >0 = quick test render, no publishing

def sh(*a): print('+', ' '.join(a), flush=True); subprocess.run(a, check=True)
def drive(fid, path):
    if not os.path.exists(path): urllib.request.urlretrieve(f'https://drive.google.com/uc?export=download&id={fid}', path)
    return path

def serve():
    class Q(http.server.SimpleHTTPRequestHandler):
        def __init__(s, *a, **k): super().__init__(*a, directory=TPL, **k)
        def log_message(s, *a): pass
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 8766), Q)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

def render(page, frames_dir):
    from playwright.sync_api import sync_playwright
    os.makedirs(frames_dir, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        pg.goto(f"http://127.0.0.1:8766/{page}"); pg.wait_for_function("window.ready !== undefined"); pg.evaluate("window.ready")
        n = int(round(pg.evaluate("window.DURATION") * FPS))
        if TEST_FRAMES: n = min(n, TEST_FRAMES)
        for f in range(n):
            pg.evaluate(f"renderAt({f / FPS})"); pg.screenshot(path=f"{frames_dir}/f{f:04d}.jpg", type="jpeg", quality=93)
        # transparent overlay (logo + caption) for scene 1
        pg.goto("http://127.0.0.1:8766/intro_overlay.html"); pg.evaluate("window.ready")
        pg.screenshot(path=f"{OUT}/intro_overlay.png", omit_background=True)
        b.close()

def main():
    cal_path = os.path.join(ROOT, 'calendar.json'); cal = json.load(open(cal_path, encoding='utf-8'))
    entry = None
    today = datetime.datetime.now(ZoneInfo('Europe/Amsterdam')).date()
    recent = {e['answer'].lower() for e in cal if e.get('made_on') and (today - datetime.date.fromisoformat(e['made_on'])).days < 7}
    for e in cal:
        if e.get('status') != 'klaar': continue
        if e['answer'].lower() in recent: print('SKIP (woord al gebruikt deze week):', e['answer']); continue
        try: page, cfg = rules.build(e); entry = e; break
        except ValueError as err: e['status'] = 'afgekeurd'; e['reason'] = str(err); print('REJECTED', e['id'], err)
    if not entry:
        json.dump(cal, open(cal_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        sys.exit('Geen quiz met status "klaar" meer in calendar.json – vul de kalender aan.')
    os.makedirs(OUT, exist_ok=True)
    json.dump(cfg, open(os.path.join(TPL, 'quiz.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    serve(); frames = os.path.join(OUT, 'frames'); shutil.rmtree(frames, ignore_errors=True); render(page, frames)
    body = os.path.join(OUT, 'body.mp4')
    sh('ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{frames}/f%04d.jpg', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', body)
    intro = os.environ.get('INTRO_PATH') or drive(INTRO_ID, f'{OUT}/intro.mp4')
    music = os.environ.get('MUSIC_PATH') or drive(MUSIC_ID, f'{OUT}/music.mp3')
    name = f"GBYKE_{today:%Y-%m-%d}_{entry['type']}_{entry['answer']}.mp4"; final = os.path.join(OUT, name)
    # scene 1 (avatar + caption + logo) -> scenes 2-3; music under everything, ducked while the avatar speaks
    dur = lambda f: float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)
    di, db = dur(intro), dur(body); total = di + db
    fc = (f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[iv];"
          f"[iv][2:v]overlay=0:0:shortest=1,fade=t=out:st={di - 0.35:.2f}:d=0.35[i1];[1:v]fade=t=in:st=0:d=0.35,setsar=1[b1];"
          f"[i1][b1]concat=n=2:v=1:a=0[v];"
          f"[0:a]aresample=48000,apad[va];"
          f"[3:a]aresample=48000,aloop=loop=-1:size=2e9,volume='if(lt(t,{di + 0.15:.2f}),0.22,0.55)':eval=frame,afade=t=in:d=0.6[m];"
          f"[va][m]amix=inputs=2:duration=longest:normalize=0,atrim=0:{total:.2f},afade=t=out:st={total - 1.5:.2f}:d=1.5[a0]")
    sh('ffmpeg', '-y', '-loglevel', 'error', '-i', intro, '-i', body, '-loop', '1', '-i', f'{OUT}/intro_overlay.png', '-i', music,
       '-filter_complex', fc, '-map', '[v]', '-map', '[a0]', '-t', f'{total:.2f}',
       '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', final)
    if TEST_FRAMES: print('TEST OK', final); return
    tag = f"quiz-{today:%Y-%m-%d}-{entry['id']}"; repo = os.environ['GITHUB_REPOSITORY']
    sh('gh', 'release', 'create', tag, final, '--title', f"{today} – {entry['type']} – {entry['answer']}", '--notes', 'GBYKE daily quiz')
    url = f"https://github.com/{repo}/releases/download/{tag}/{name}"
    payload = {'brand_id': GBYKE_BRAND, 'video_url': url, 'file_name': name, 'caption': rules.caption(entry),
               'title': rules.GAME_NAME[entry['type']] + ' van de dag', 'publish_at': f"{today:%Y-%m-%d}T18:00:00", 'answer': entry['answer']}
    req = urllib.request.Request(os.environ['MAKE_WEBHOOK_URL'], data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    print('Make:', urllib.request.urlopen(req, timeout=300).read().decode())
    # NOT posted yet: waits for approval in the Claude chat, then Claude schedules it for 18:00
    entry['status'] = 'wacht op goedkeuring'; entry['made_on'] = str(today); entry['video_url'] = url
    json.dump(cal, open(cal_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

if __name__ == '__main__': main()
