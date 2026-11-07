// Junta la compilación en un solo HTML que se abre con doble clic, sin servidor ni internet.
// Uso: npm run demo:html  ->  dist/cafeteria-demo.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const dir = 'dist/frontend/browser';
const r = await build({ entryPoints: [`${dir}/main.js`], bundle: true, format: 'esm', minify: true, write: false, splitting: false });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(`${dir}/styles.css`, 'utf8');
const icono = Buffer.from(readFileSync(`${dir}/favicon.svg`)).toString('base64');
let html = readFileSync(`${dir}/index.html`, 'utf8')
  .replace(/<link rel="stylesheet"[^>]*styles[^>]*\.css[^>]*>/, '')
  .replace(/<noscript>.*?<\/noscript>/gs, '')
  .replace(/<link rel="modulepreload"[^>]*>/g, '')
  // Sin <base>: las rutas con # quedan sobre el mismo archivo aunque se le cambie el nombre.
  .replace(/<base [^>]*>/, '')
  .replace(/<script[^>]*src="main[^"]*\.js"[^>]*><\/script>/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${icono}">`);
// Con función, para que los $ del código no se tomen como patrones de reemplazo.
html = html.replace('</head>', () => `<style>${css}</style>\n</head>`).replace('</body>', () => `<script type="module">${js}</script>\n</body>`);
writeFileSync('dist/cafeteria-demo.html', html);
console.log('dist/cafeteria-demo.html', Math.round(html.length / 1024), 'kB');
