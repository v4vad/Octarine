// Build script for Octarine Figma plugin
// This inlines the compiled JavaScript into the HTML file

const esbuild = require('esbuild');
const fs = require('fs');

async function build() {
  // Build code.ts (plugin code)
  // Figma's sandbox uses an older JS engine, so we target ES6
  // and transform object spread to Object.assign
  await esbuild.build({
    entryPoints: ['code.ts'],
    bundle: true,
    outfile: 'code.js',
    target: 'es6',
    supported: {
      'object-rest-spread': false,  // Transform {...obj} to Object.assign
    },
  });
  console.log('Built code.js');

  // Build ui.tsx to a temporary file
  await esbuild.build({
    entryPoints: ['ui.tsx'],
    bundle: true,
    outfile: 'ui.js.tmp',
    target: 'es2020',
  });
  console.log('Built UI JavaScript');

  // Read the compiled JavaScript
  const uiJs = fs.readFileSync('ui.js.tmp', 'utf8');

  // Read CSS
  const customCSS = fs.readFileSync('styles.css', 'utf8');
  console.log('Read CSS files');

  // Create the HTML with inlined JavaScript and CSS
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap" rel="stylesheet">
  <style>${customCSS}</style>
</head>
<body>
  <div id="root"></div>
  <script>${uiJs}</script>
</body>
</html>`;

  // Write the final HTML
  fs.writeFileSync('ui.html', html);
  console.log('Built ui.html with inlined JavaScript');

  // Clean up temporary file
  fs.unlinkSync('ui.js.tmp');

  console.log('Build complete!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
