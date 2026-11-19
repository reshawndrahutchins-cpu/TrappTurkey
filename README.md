# 🦃 The Turkey Day Trophic Trap
### An AP Environmental Science Escape Room at the Hutchins-Trapp Estate

Players are trapped in a billionaire conservationist's biodome on Thanksgiving. To escape before the feast is ruined, they must open 4 locks by solving puzzles from APES Units 1–3.

| Lock | Room | Concept |
|---|---|---|
| 1 | Heritage Corn Greenhouse | GPP vs. NPP and the 10% rule (calculation) |
| 2 | Forest Wing | Logistic growth and carrying capacity (graph reading) |
| 3 | Burnt Orchard | Secondary succession (ordering) |
| 4 | Harrison's Study | Demographic Transition Model and age structure |

**Rules:** 45-minute countdown, 3 wrong guesses total, a hint after every wrong answer, and an "Ask Harrison" hint that costs 2 minutes. The festive music is generated in the browser, so there are no audio files to upload.

## Files
- `index.html` is the page
- `style.css` holds the look and layout
- `game.js` contains the puzzles, game logic and music

## Putting it online with GitHub Pages
1. On GitHub, click **New repository**, give it a name (for example `turkey-escape`), set it to **Public**, and create it.
2. Click **Add file → Upload files**, drag in `index.html`, `style.css`, `game.js` and `README.md`, then click **Commit changes**. Keep all files in the top level of the repository, not in a folder.
3. Go to **Settings → Pages**. Under "Build and deployment," set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, and click **Save**.
4. Wait 1–2 minutes and refresh the page. Your link will appear at the top:
   `https://YOUR-USERNAME.github.io/turkey-escape/`

## Customizing
At the top of `game.js`:
```js
const START_SECONDS = 45 * 60;   // total game clock
const HINT_COST_SECONDS = 120;   // "Ask Harrison" penalty
const MAX_WRONG = 3;             // wrong guesses allowed
```
