# Brand Vision — Webflow custom code template

TypeScript + esbuild toolchain for Webflow client sites — JS **and** CSS.
Dev = localhost live reload · Staging = auto-deploy on push · Prod = pinned jsDelivr tag.

Source files: `src/index.ts` (bundled to `dist/index.js`) and `src/styles.css`
(minified to `dist/styles.css`). Both ship together under one version tag.

The Webflow Designer owns layout and classes. Nothing in this repo generates
markup.

## Requirements

- [Node](https://nodejs.org) 22 (the version CI builds with)
- [pnpm](https://pnpm.io/installation) 11 — `corepack enable`

```bash
pnpm install
```

## Commands

```bash
pnpm dev      # esbuild watch + server on :3000 (unminified, sourcemaps)
pnpm build    # minified -> dist/
pnpm check    # tsc --noEmit
```

## New project checklist

1. Use this template → create repo `wf-<client>` (public)
2. `package.json` → change `"name"`
3. Repo Settings → Pages → Source: **GitHub Actions**
4. Repo → Settings → Collaborators and teams → add the `developers` team (Write)
5. Paste the three snippets from `loader.html` into Webflow, replacing `REPO`
   with this repo's name in each — head code, an **Embed on the canvas**, and
   footer code. Piece 2 must be an Embed inside a component that appears on
   every page; site custom code does not render in the Designer.
6. Publish to staging and confirm the canvas picks up `styles.css`

## Daily

- `pnpm dev`, then on the `.webflow.io` site append `?bv-dev=1` to the URL →
  your browser loads localhost with live reload. `?bv-dev=0` to exit.
- `git push` → client-facing staging bundle updates in ~1 min (no Webflow publish)
- Live reload works in the browser. It does **not** work on the Designer canvas,
  which never runs scripts — reload the Designer tab instead.

## Release (launch / retainer updates)

```
pnpm build
git add -f dist && git commit -m "release: vX.Y.Z"
git tag vX.Y.Z && git push && git push --tags
git rm -r --cached dist && git commit -m "chore: untrack dist after vX.Y.Z"
git push
```

`dist/` is gitignored for day-to-day work, so the `-f` is required — without
it the release commit is empty, the tag carries no build, and jsDelivr serves
a 404 to the live site.

The un-track at the end is not optional tidying. `.gitignore` only governs
files git is not already *tracking*, so the release commit permanently
cancels the ignore rule for `dist/`: from that point on every rebuild shows
as a modification and `git add .` sweeps a minified bundle into whatever
commit you are writing. `--cached` un-tracks it but leaves the files on
disk, so the ignore rule applies again. The tag is untouched — it still
points at the commit that contains the build, and jsDelivr serves that
forever.

Then bump `VER` in BOTH Webflow snippets (the CSS/config Embed and the footer
loader) → publish staging → verify → publish prod.
Rollback = revert the version strings. Never use `@latest` or branch URLs in prod.

**Tag rules (learned the hard way):**

- `dist/` must be committed *before* the tag is pushed
- A pushed tag must **never** be moved (`tag -f`) — jsDelivr snapshots a
  version once and keeps it forever, so a half-baked snapshot is permanent.
  Botched release? Cut the next patch version instead
- Un-track `dist/` again once the tag is pushed, or the ignore rule stays
  dead for every commit after the first release

**Before attaching a custom domain,** confirm the repo actually has the tag
`VER` points at. A site running on `.webflow.io` never touches the prod URLs,
so a placeholder `VER = "X.Y.Z"` stays invisible until the moment the domain
goes live — and then both CSS and JS 404 at once.

## How the files reach the page

Three snippets, documented in [`loader.html`](loader.html) — read that file
before touching any of them.

| Environment    | Source                  |
| -------------- | ----------------------- |
| Production     | pinned jsDelivr tag     |
| `*.webflow.io` | GitHub Pages staging    |
| `?bv-dev=1`    | `http://localhost:3000` |

Dev mode is localhost-only by design: `http://localhost` is a
potentially-trustworthy origin so an https page may load it, but a LAN IP is
not and gets blocked as mixed content. To check work on another device, push
and use the staging bundle.

Pushing to `master` triggers
[`.github/workflows/staging.yml`](.github/workflows/staging.yml), which runs
`pnpm build` and publishes `dist/` to GitHub Pages. Production is pinned to a
tag, so a staging deploy never touches the live site.

## Project structure

```
src/
  index.ts            entry point; a manifest of module imports and calls
  styles.css          the whole stylesheet, in numbered sections
  modules/            one file per feature, each exporting an init function
build.mjs             esbuild config and dev server
loader.html           the three Webflow snippets, documented
```

`src/styles.css` opens with cascade notes and a numbered table of contents.
Section order is the tiebreaker for same-specificity rules — add to the
section a rule belongs to, never to the end of the file.


The stylesheet includes the shared CSS foundation: fluid root sizing, element
resets, Webflow default overrides, opt-in effects and utilities, rich-text
spacing, keyboard focus styles, and reduced-motion support. Tune the sizing
tokens, wire the accent and container width to the site's Webflow variables,
and set `--nav-h` when adding a fixed header. Marquees need duplicated tracks;
read-more controls need their own JavaScript toggle.

TypeScript runs `strict`, targets ES2019, and defines no path aliases —
imports are relative.

## Webflow MCP

`.mcp.json` carries the Webflow MCP server definition. Approve the project
server on first launch, then run `/mcp` to authorise Webflow — OAuth is
per-machine, so this is repeated on each new machine.

## Auditing before launch

Before shipping, check every JS module and CSS block against the live markup —
modules whose selectors/attributes appear on no page are dead weight
(the TeraWulf migration dropped 5 of 7 inherited modules this way).

## Handoff (site leaving the agency)

Build → paste `dist/index.js` inline into Site footer, CSS inline into the
canvas Embed → remove loader + external tags → publish → zip `src/` for the
client → archive repo.
