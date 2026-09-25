# Gebroiki Yu Koni Esi – daily quiz (automatic)

Every morning GitHub Actions takes the next quiz from `calendar.json`, renders it with the fixed templates,
and builds the full video:
- **Scene 1** – the avatar intro. This is the ONLY scene with speech ("Speel mee met deze quiz. Weet jij het antwoord?").
- **Scenes 2 and 3** – puzzle and answer. Silent: only the Afro house music (take 1, always the same track).

Make archives the video on Drive ("GBYKE gepubliceerde video's") together with a note `GOEDKEUREN_…`.
**Nothing is posted automatically.** Ask Claude in the chat for today's quiz; after your approval Claude schedules it
in Metricool as an Instagram + Facebook Reel for **18:00** on the **Gebroiki Yu Koni Esi (GBYKE)** brand.

## One-time setup (±10 minutes)
1. Create a free account on github.com.
2. Click **New repository** → name: `gbyke-quiz` → choose **Public** (free unlimited Actions minutes and
   public video links for Metricool) → **Create repository**.
3. Click **uploading an existing file** and drag in ALL files and folders from this zip
   (including the `.github` folder – on a Mac press Cmd+Shift+. to show hidden folders). **Commit changes**.
4. Go to **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `MAKE_WEBHOOK_URL`
   - Value: `https://hook.eu2.make.com/x95918b3q3nlxlddk8hcq46l7f9r1s9m`
5. Go to **Settings → Actions → General → Workflow permissions** → choose **Read and write permissions** → Save.
6. Test: **Actions** tab → **GBYKE daily quiz** → **Run workflow**. After ±30 minutes the video and the GOEDKEUREN note are on Drive – ask Claude to show it.
From then on it runs by itself every morning.

## The calendar (`calendar.json`)
Each entry is one day = one quiz (any of the six types – rotate the types, and rotate pyramids between 4, 5, 6 and 7 layers).
The script takes the first entry with `"status": "klaar"` and sets it to `"wacht op goedkeuring"`.
**Word rule:** a word is used at most once per 7 days; entries whose word was used in the last 7 days are skipped
until later. A word may come back later in another quiz type.
When no `"klaar"` entries are left, the run stops with a clear message (GitHub e-mails you) – then add new entries.

Fields per quiz type (all words must be checked in wortubuku-compleet.csv):
| type | required fields | rule |
|---|---|---|
| piramide | answer, meaning, rows (1, 2, 3 … letters), row_meanings, hint | 4, 5, 6 or 7 layers (alternate them); the answer only uses letters from the rows |
| husselaar | answer, meaning, extra (1 letter), hint | answer max 7 letters; letters are shuffled automatically |
| cryptisch | answer, meaning, clue, extra_line, hint | answer max 8 letters |
| code | answer, meaning, hint | numbers are calculated automatically (a = 2, b = 3 …) |
| klinkers | answer, meaning, hint | vowels are hidden automatically, max 9 letters |
| tweewoorden | answer, meaning, words [word1, word2], hint | answer max 8 letters |

## Safety
`blocklist.txt` lists curse words and words about genitalia, sex, STI/STD. Any entry containing one of them
(in the answer, the puzzle, the hint or the meaning) is automatically rejected (`"status": "afgekeurd"`) and skipped.
You can add words to the list at any time.

## Fixed assets (Google Drive, SPA Audio)
- Scene 1: `GBYKE_scene1_avatar_intro.mp4` (avatar bdb9c2ec…, SPA narrator voice)
- Music: `Afro_house_quiz_take1.mp3` (the one fixed track)
