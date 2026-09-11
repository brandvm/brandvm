import * as esbuild from 'esbuild';

const dev = process.argv.includes('--dev');

const config = {
  entryPoints: ['src/index.ts', 'src/styles.css'],
  bundle: true,
  outdir: 'dist',
  minify: !dev,
  sourcemap: dev,
  target: 'es2019',
  logLevel: 'info',
  banner: dev
    ? { js: "(() => { try { var u = document.currentScript && document.currentScript.src ? new URL('/esbuild', document.currentScript.src).href : 'http://localhost:3000/esbuild'; new EventSource(u).addEventListener('change', () => location.reload()); } catch (e) {} })();" }
    : {},
};

if (dev) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  await ctx.serve({ servedir: 'dist', port: 3000, cors: { origin: '*' } });
  for (const e of config.entryPoints) {
    console.log('dev → http://localhost:3000/' + e.split('/').pop().replace(/\.ts$/, '.js'));
  }
} else {
  await esbuild.build(config);
}