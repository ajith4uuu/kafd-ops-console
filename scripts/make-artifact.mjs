// Bundle the Vite build into a single self-contained artifact page.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist', 'assets');
const files = readdirSync(dist);
const cssFile = files.find((f) => f.endsWith('.css'));
const jsFile = files.find((f) => f.endsWith('.js'));
const css = readFileSync(join(dist, cssFile), 'utf8');
// Escape any closing-script sequences inside the bundle so the inline tag survives.
const js = readFileSync(join(dist, jsFile), 'utf8').replaceAll('</script', '<\\/script');

const html = `<title>KAFD Ops Console</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

writeFileSync(join(process.cwd(), 'dist', 'artifact.html'), html);
console.log('artifact.html', Math.round(html.length / 1024), 'KB');
