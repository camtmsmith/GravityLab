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

## Theory and experiment modes

The switch at the top right sets one site-wide mode (remembered per browser).

- **Theory**: every reading follows the physics exactly.
- **Experiment**: each lab's "Measurement error" panel appears, with
  - **random error** sliders (reaction time, parallax, launcher scatter, sensor noise…) that change every trial, and
  - **systematic error**: hidden offsets (untared balance, tape not started at zero, misdrawn normal…) drawn once per scenario and identical on every trial until *New scenario*. *Reveal* shows them for discussion.

In a lab script, `PL.errorPanel({...})` builds this; `err.on()` says whether experiment mode is on and `err.sys('key')` returns a systematic offset (0 in theory mode).

## Adding an experiment

1. Add a `<div class="lab" id="lab-xyz" hidden>` to `index.html` (copy an existing lab's three-panel layout).
2. Add `js/labs/xyz.js` and a `<script>` tag for it after `js/common.js`.
3. In `js/nav.js`, give the experiment's entry `lab:'lab-xyz'` and a `tag`. Entries without `lab` show a "coming soon" panel.
