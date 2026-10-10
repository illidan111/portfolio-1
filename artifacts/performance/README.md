# Performance measurements

## Current Classic / Game update

Use Node 22.12+ within the 22.x release line. The current budget starts at **24,887 external + 121 inline gzip bytes**, with at most 5,000 additional bytes. `scripts/measure-modes.mjs` measures both explicit mode URLs with fresh profiles, includes inline executable scripts, and enforces a conservative 29,887-byte combined ceiling. Run it with labels `current-modes` and `current-modes-mobile` (the latter with `--mobile --cpu=4`).

`scripts/lighthouse.ps1 -Label current` audits Game home, Fieldnotes, the Skills anchor, and Classic home. If the shell resolves a different Node version, pass `-NodePath` with the Node 22 executable. The script records all four categories, LCP, CLS, runtime warnings, and a pass/fail summary. Keep other test browsers closed during measurement. Final current results and deployment status are recorded in the root README; local results do not establish live Vercel performance.

## Historical ten-feature Game measurements

The remaining measurements below belong to the earlier Game-only implementation and its separate 25,000-byte growth allowance. They are retained for comparison and are not the current update's gate.

Run the production preview first (`npm run build`, then `npm run preview -- --port 4323`). The baseline static output was preserved in `baseline-dist` before feature implementation.

```powershell
node scripts/measure.mjs --label=current --duration=10000
node scripts/measure.mjs --label=current-high-night --scenario=high-night --routes=/ --duration=10000
node scripts/measure.mjs --label=current-mobile-low --scenario=low-mobile-day --routes=/ --duration=10000
node scripts/measure.mjs --matrix --label=current --routes=/ --duration=10000
./scripts/lighthouse.ps1 -Label current
```

The optional `--storage` file is a JSON object mapping localStorage keys to string values. Other options are `--url=http://127.0.0.1:4323`, `--reduced`, and a comma-separated `--routes` list. Scenarios are `high-day` (clear), `high-night` (rain), `low-mobile-day` (clear), and `low-mobile-night` (snow/static tint). Low mobile scenarios use a 360×800 touch viewport with 4× CPU throttling. `--theme`, `--quality`, `--weather`, and `--cpu` override these defaults. `--matrix` runs all four scenarios sequentially and appends scenario names to the output label.

`measure.mjs` launches installed Edge with a project-local profile, visits fresh pages, and records the actual initial script network graph after load plus one second. It gzips each response body with Node's default zlib gzip settings; this is comparable compressed source payload, excluding HTTP headers. Inline executable scripts are counted separately. Initial means before any deliberate user interaction, so automatically requested visible voxel chunks count on project pages. The frame sample starts after that load window. Long-task samples retain their load/idle phase.

Lighthouse runs use mobile defaults, simulated mobile CPU/network, Lighthouse 13.5.0, installed Edge, all four requested categories, and saved traces. npm tooling cache and browser temporary directories are under this project. Lighthouse is transient tooling, not a project dependency. Runs are sequential to avoid measuring concurrent Lighthouse CPU contention.

Skills and Journey are existing sections (`/#skills` and `/#about`), not separate routes. Skills receives its own hash-targeted audit; that is still the same HTML document.

Frame results describe this Windows host and headless real Edge, whose refresh cadence is approximately 165 Hz. A mobile viewport or CPU throttling is an emulation, not a measurement of a physical mid-range phone. Scores and frame rates can vary with machine load. Do not claim hardware performance that was not measured.

Monitor animation-frame cadence is reported separately from actual game render performance. `frames.engineFinal` contains the engine's `data-engine-fps` and `data-engine-max-work` counters plus running/reduced/quality state; `frames.engineSamples` records them every 500 ms. Engine FPS is cumulative over running time and capped at 60 Hz by the engine. Maximum work is the largest update/render duration over that engine's lifetime, including initial load. The measurements also retain actual weather, lighting, and particle counts so static Low/reduced runs cannot be mistaken for High effects. There is no engine counter in the original baseline.

Raw Lighthouse JSON, traces, network logs, and measurement JSON are retained beneath each run label. The original baseline home and project audits scored 100/100/100/100 with CLS 0. The initial home external JS baseline is 8,227 gzip bytes, plus 120 gzip bytes of inline initialization; the external budget therefore caps the new initial home network graph at 33,227 gzip bytes (+25,000 bytes).

The corrected P1/P2 gate is recorded in `p2-final/summary.json`: all three mobile Lighthouse targets score 100/100/100/100; home external JavaScript is 19,651 gzip bytes (+11,424). High day/night world counters report 59.3–59.4 fps and Low mobile with 4× CPU throttling reports 59.0–59.2 fps, with no idle long task over 100 ms. Raw first-attempt failures remain in `p2`: a missing hidden-anchor href reduced SEO, and mobile WebGL driver/extension initialization reduced project performance. The corrections retain valid link destinations and start Auto quality at Low on coarse-pointer screens no wider than 700 px; explicit High still enables mobile models.

Lighthouse 13.5 sometimes emits an internal `NO_LCP` trace-insight diagnostic for hash navigation to Skills while its completed report contains a valid scored LCP metric and no `runWarnings`. This tooling diagnostic occurred in the baseline too; it is distinct from application console errors or build/check warnings.

The final all-feature audit is recorded in `final/summary.json`, including the SHA-256 of the frozen homepage build. Mobile scores (Performance / Accessibility / Best Practices / SEO) are home **100 / 100 / 100 / 100**, Fieldnotes **100 / 100 / 100 / 100**, and Skills **99 / 100 / 100 / 100**. The final Skills audit emitted no internal diagnostic. Lighthouse CLS is at most 0.00527; the maximum across Lighthouse and the four engine samples is 0.00639.

Final home external JavaScript is **24,887 gzip bytes**, an increase of **16,660** over the 8,227-byte baseline, leaving **8,340 bytes** within the additional 25,000-byte budget. Inline initialization remains 120 gzip bytes. High day/night world counters both report **59.3 fps**, with maximum update/render work of **0.7 / 1.0 ms**. Low mobile with 4× CPU throttling reports **58.9 / 58.6 fps**, with maximum work of **14.0 / 11.4 ms**. All four 10-second samples contain no idle task over 100 ms and no application error. The Low night sample includes one 48.4 ms monitor-frame interval; retained raw measurements show that outlier rather than replacing the run.
