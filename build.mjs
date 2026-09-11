import * as esbuild from 'esbuild';
import { readFile, writeFile, rm } from 'node:fs/promises';

const dev = process.argv.includes('--dev');
const { version } = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));

const config = {
  entryPoints: ['src/index.ts', 'src/styles.css'],
  bundle: true,
  format: 'iife',
  outdir: 'dist',
  minify: !dev,
  sourcemap: dev,
  target: 'es2019',
  legalComments: 'none',
  logLevel: 'info',
  define: { __BV_VERSION__: JSON.stringify(version) },
  banner: dev
    ? { js: "(() => { try { var u = document.currentScript && document.currentScript.src ? new URL('/esbuild', document.currentScript.src).href : 'http://localhost:3000/esbuild'; new EventSource(u).addEventListener('change', () => location.reload()); } catch (e) {} })();" }
    : {},
};

if (dev) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  await ctx.serve({ servedir: 'dist', host: '127.0.0.1', port: 3000, cors: { origin: '*' } });
  for (const e of config.entryPoints) {
    console.log('dev → http://localhost:3000/' + e.split('/').pop().replace(/\.ts$/, '.js'));
  }
} else {
  // Prevent dev sourcemaps or live-reload artifacts from entering a release.
  await rm('dist', { recursive: true, force: true });
  await esbuild.build(config);
  await writeFile('dist/version.json', JSON.stringify({ version }) + '\n');
}
