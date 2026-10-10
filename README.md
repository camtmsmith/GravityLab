# Queensland Physics

Virtual practicals for Queensland senior Physics, Units 1–4, with realistic measurement error and CSV export. Static site — open `index.html` or serve the folder (GitHub Pages works as-is).

## Layout

```
index.html          page shell + markup for each lab (<div class="lab" id="lab-…">)
css/styles.css      all styles
js/common.js        shared helpers (PL.gauss, PL.fitLine, PL.sizeCanvas, PL.downloadCSV, …)
js/labs/*.js        one file per experiment
js/nav.js           unit + experiment tabs; the list of units and experiments lives here
```

## Adding an experiment

1. Add a `<div class="lab" id="lab-xyz" hidden>` to `index.html` (copy an existing lab's three-panel layout).
2. Add `js/labs/xyz.js` and a `<script>` tag for it after `js/common.js`.
3. In `js/nav.js`, give the experiment's entry `lab:'lab-xyz'` and a `tag`. Entries without `lab` show a "coming soon" panel.
