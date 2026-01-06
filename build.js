// Build script for Octarine Figma plugin
// This inlines the compiled JavaScript into the HTML file

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

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

  // Create the HTML with inlined JavaScript
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      color: var(--figma-color-text, #333);
      background: var(--figma-color-bg, #fff);
    }
    #root {
      padding: 16px;
    }
  </style>
</head>
<body>
  <div id="root">Loading...</div>
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
