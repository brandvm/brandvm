# Brand Vision — Webflow custom code

Agent instructions for this repository. Codex, Cursor and similar tools read
this file directly; Claude Code reads it through `CLAUDE.md`. It is the single
source of agent rules — edit this file, never a copy of it.

Shared CSS and JavaScript for brandvm.com, following `brandvm/wf-template`'s
integration pattern (real CSS links in the Designer, a separate configuration
Embed, JavaScript loading from the footer). This repo supersedes
`hamounbv/brandvm`; the v1.1.0 assets here matched that repo's served release
byte for byte at migration (8cd2ce3, PR #1).

## Project facts

- Client / site: Brand Vision (brandvm.com)
- GitHub: `brandvm/brandvm`, default branch `master`
- Webflow site ID: `68b9f0236581de795cba8ec2` (from
  `scripts/check-webflow.mjs`)
- Staging site: `https://brandvm.webflow.io`
- Staging bundles: `https://brandvm.github.io/brandvm/`
- Production bundles: `https://cdn.jsdelivr.net/gh/brandvm/brandvm@1.1.2/dist/`
- Production domain: `https://www.brandvm.com`
- Production release: `v1.1.2` (`package.json`, both `VER` values in
  `loader.html`, `dist/version.json`)

## Who owns what

Webflow owns markup, layout, classes, components, CMS content, interactions
**and styling by default**. This repo owns JavaScript behaviour and only the
CSS the Designer cannot express.

That split is deliberate. Repo CSS loads from an Embed after `webflow.css`,
so it wins every specificity tie against the Designer. Any rule written here
that the Designer could have expressed becomes a hidden override: the next
person changes that style in the Designer, nothing happens, and the only fix
is edit `src/` → push → wait for staging → reload the Designer. Every project
built from this template has lost time to that loop.

## CSS policy — Designer first

Existing rules predate this policy and are untagged; add a `repo-css` tag to
any rule you touch, and question rules the Designer could own.

Before writing any CSS, decide where it belongs.

1. **Can the Designer do it?** A class or combo class style, a variable, a
   breakpoint style, a state (hover/focus/current), an interaction. If yes:
   - With the Webflow MCP connected, apply it in Webflow (styles and
     variables tools), then tell the user what was changed.
   - Without the MCP, give the user exact Designer steps: class, breakpoint,
     property, value.
   - Do **not** add it to `src/styles.css`.
2. **Repo CSS needs a reason.** Every rule — or the section header comment
   covering a group of rules — carries one tag from this list:

   ```css
   /* repo-css: <tag> — <short why> */
   ```

   | Tag | Use for |
   | --- | --- |
   | `js-state` | Classes/attributes a module toggles (`.is-open`, `.is-loading`, `[data-state]`) |
   | `designer-cant` | Name the feature: `:has()`, complex combinators, `@keyframes`, `@supports`, container queries, `::marker`, `color-mix()`, masks |
   | `third-party` | Swiper, Lenis, Finsweet or other library markup |
   | `canvas-preview` | `.w-editor`, `.wf-design-mode`, `html:not([data-wf-domain])` helpers |
   | `approved-base` | A site-wide base the user explicitly asked to keep in code |
   | `override-webflow` | Overriding a `.w-*` default or a Designer style |

3. **`override-webflow` needs the user's explicit approval** and a
   `GOTCHAS.md` entry explaining why. Ask before writing it.
4. **Never, without that approval:** set `font-size` on `:root`/`html`,
   neutralize `.w-*` defaults, or reference Webflow variable names
   (`--_layout---…`, `--_typography---…`). A renamed variable in Webflow
   silently breaks every rule that reads it — Webflow rewrites its own
   references, never this bundle's.
5. **Ambiguous request?** Say which parts go in the Designer and which go in
   code before editing anything. "Make the heading bigger on mobile" is a
   Designer breakpoint style, not a media query here.

Pre-existing exceptions in this repo, all predating the policy (log any
change to them in `GOTCHAS.md`):

- §01 Token Hub sets the fluid root `font-size` (ideal and max 1680px).
- `src/styles.css` reads Webflow variables by name (`--_colors---…`,
  `--_color-token---…`, `--_typography---font-family--heading-serif`) and
  uses `!important` in places. Check them whenever a variable is renamed.
- The README asks to keep Brand Vision's sizing, tokens and component rules
  when adopting documentation or tooling from `wf-template` — this policy
  governs new rules; do not strip existing ones without the user.

## Architecture

### How CSS/JS reach the page

**Edit and copy from `loader.html`.** It is the single source for the
integration code; no generator. Four marked sections, each pasted to its own
place — never the whole file into one field:

| Section | Placement |
| --- | --- |
| `HEAD` | Site settings → Head code: connection hints only |
| `EMBED_CSS` | Designer Embed 1: stylesheet links only, shared near the top of every page |
| `EMBED_CONFIG` | Designer Embed 2: configuration script, immediately after Embed 1 |
| `FOOTER` | Site settings → Footer code, before `</body>`: starts the bundle download |

Both Embeds must appear on every page using these assets. Keep surrounding
tracking, metadata, schema, inline styles and page/component code.

- **CSS loads from Embed 1 (`bv-css` staging + `bv-css-dev` localhost), so
  `src/styles.css` is visible on the Designer canvas.** The Designer does not
  run Embed 2; on published pages Embed 2 sets `window.BV`, picks
  production or staging CSS and removes the localhost link unless dev mode
  is on.
- The footer guards against double execution and loads JS with fallback
  localhost → GitHub Pages → pinned release. Fallbacks do not switch CSS. A
  missing config Embed warns and loads production JS only.

| Environment | CSS | JavaScript |
| --- | --- | --- |
| Designer editing canvas | GitHub Pages, plus localhost when available | Embed scripts do not run |
| Production | Pinned jsDelivr v1.1.2 | Pinned jsDelivr v1.1.2 |
| Webflow staging / custom-code preview | GitHub Pages | GitHub Pages |
| Staging with `?bv-dev=1` | GitHub Pages plus localhost | Localhost |

Dev mode: `?bv-dev=1` / `?bv-dev=0` on `*.webflow.io` or
`*.canvas.webflow.com` (persists per origin), or the bottom-left Staging /
Dev control (`src/modules/environment-switcher.ts`; hidden on production, in
the Editor/Designer and preview frames, and in print). On preview frames the
flag must be on the frame's own URL or storage.

### Source layout

- `src/index.ts` imports modules and initialises them after `Webflow.push`;
  each feature runs in its own `run(name, init)` error boundary, in order,
  behind a boot guard.
- **jQuery and GSAP are supplied by Webflow — do not bundle another copy.**
  Lenis is optional; Swiper is lazy-loaded. Finsweet Attributes is a
  separate script tag installed in Webflow (`fs-list`, `fs-socialshare`);
  its `fs-autovideo` must stay removed because the bundle's lazy-video
  controller replaces it.
- `src/styles.css` is one file in five sections (01 tokens & color system …
  05 cards, lists & bento) listed in its opening comment. Add rules beside
  the related feature and preserve existing order.
- No template scroll lock, theme change or icon library is used; do not add
  them from `wf-template`.
- `README.md` documents the lazy-video controller
  (`data-bv-lazy-video`, `data-src`) and the navigation/Home hero
  visibility fallback. Read it before changing either.

## Webflow canvas facts

- **The Designer canvas never runs scripts.** Anything shown only after JS
  runs is invisible there; use a `canvas-preview` rule if the Designer needs
  to see it. Embed 2 never runs on the canvas.
- **The canvas loads two stylesheets — staging and localhost — and they are
  additive.** Adding a rule locally shows up; *removing* one does not,
  because staging's copy still applies. Deletions can only be verified after
  a push, or by temporarily commenting out the `bv-css` link.
- No live reload on the canvas. Run `pnpm dev` and reload the Designer.
- Debug "is my CSS loading?" with `background`, not `outline` — outlines on
  `body` paint outside the canvas iframe and get clipped.
- Published pages may request the static staging and localhost links before
  Embed 2 removes them; this pattern does not guarantee zero extra requests.

## Snippets are not versioned

A push updates the JS/CSS bundles only. Any change to `loader.html` must be
re-pasted into Webflow and published to take effect — say so in the commit
or PR description, and keep `loader.html` identical to what is installed.
Repository work never publishes Webflow. Roll back an integration change by
restoring all four sections together.

## Commands and release

```bash
pnpm dev           # watch + server on :3000
pnpm check         # strict TypeScript
pnpm build         # clean production build -> dist/
pnpm test          # node tests against the real loader.html sections
pnpm test:browser  # Playwright checks against current dist/ (build first)
pnpm validate      # check + build + test + test:browser
pnpm test:webflow  # build + read-only checks against published pages
```

Node 22.13+ and pnpm 11.25.0; `pnpm exec playwright install chromium` once.
`scripts/check-webflow.mjs` is manual (not CI), read-only, and blocks
non-read HTTP methods, tracking and media requests.

**`dist/` is committed permanently.** CI (`.github/workflows/ci.yml`) runs
`pnpm validate`, requires `dist/` and `loader.html` to be tracked, fails on
`git diff --exit-code -- dist`, and on `master` deploys `dist/` to GitHub
Pages. Stop `pnpm dev` before a release build — both write `dist/`.

Release (README "Validation and production releases"):

1. Update `package.json` and both `VER` values in `loader.html` together;
   tests reject a mismatch.
2. Stop the dev server, `pnpm validate`, commit source, `dist/` and
   `loader.html`.
3. Merge after CI passes, verify staging with `?bv-dev=0`, then create a new
   immutable tag on that commit.
4. Verify the pinned CDN files, apply all four sections to Webflow staging,
   test, then publish production.

Never move a published tag or use `@latest` / branch URLs in production. The
v1.1.0 tag holds the earlier head-loader instructions; use the current
`loader.html`.

## Webflow MCP limits

Worked around, not fixed — do not rediscover these.

- `custom_value` is rejected for Color and Size variables (`color-mix()`,
  `oklch()`, `calc()`). Create those through the variables JSON import with
  `valueType: "custom"`.
- No variable rename or reorder within a collection. Rename in the Designer
  (preserves ids and aliases; recreating does not).
- The WHTML importer drops `class` attributes. Create the style, then apply
  it.
- `get_all_elements` does not descend into component definitions — pass the
  component scope. An element "missing" from a page is usually inside one.
- Concurrent Designer edits change element ids. Re-query on "Element not
  found" instead of assuming deletion.
- Responsive styles are only returned when breakpoints are requested
  explicitly (`include_breakpoints`).

## Session protocol

1. **Start:** read `GOTCHAS.md`. Do not repeat a mistake already logged.
2. **During:** when something surprising costs time — a Webflow quirk, a
   template default that gets in the way, an MCP limitation, a fix that had
   to be reverted — add an entry to `GOTCHAS.md` in the same commit as the
   fix, using the format at the top of that file.
3. **Scope:** tag an entry `template-candidate` when it would recur on any
   project built from `wf-template`; those entries are collected later to
   improve the template. Otherwise tag it `project`.
4. Never delete entries. Update `Status` when something is fixed or
   upstreamed.
