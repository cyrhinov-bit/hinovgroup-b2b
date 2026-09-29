const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('dist')) {
        results = results.concat(getFiles(fullPath));
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = getFiles('./src');
const issues = [];

files.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Look for empty onClick
  const emptyClickRegex = /onClick=\{?\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}?/g;
  let match;
  while ((match = emptyClickRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    issues.push({ file: filePath, line, type: 'empty_onClick', snippet: match[0] });
  }

  // Look for TODO, Bientôt disponible, console.log in onClick
  const placeholderRegex = /onClick=\{[^}]*(?:bientôt|bientot|coming soon|TODO|console\.log)[^}]*\}/gi;
  while ((match = placeholderRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    issues.push({ file: filePath, line, type: 'placeholder_onClick', snippet: match[0] });
  }

  // Multi-line button finder
  const buttonRegex = /<(?:button|Button)\b([^>]*?)(\/?>)/gs;
  while ((match = buttonRegex.exec(content)) !== null) {
    const attrs = match[1];
    const line = content.substring(0, match.index).split('\n').length;
    
    const hasOnClick = /\bonClick\b/.test(attrs);
    const isSubmit = /type\s*=\s*['"]submit['"]/.test(attrs);
    const hasRest = /\{\.\.\./.test(attrs);
    const isModalDismiss = /data-bs-dismiss|data-dismiss/.test(attrs);

    if (!hasOnClick && !isSubmit && !hasRest && !isModalDismiss) {
      // Get the tag snippet
      const snippet = content.substring(match.index, Math.min(match.index + 120, content.length)).replace(/\s+/g, ' ');
      // exclude UI component definition itself
      if (!filePath.includes(path.join('components', 'ui', 'Button.tsx'))) {
        issues.push({ file: filePath, line, type: 'no_onClick_or_submit', snippet });
      }
    }
  }
});

console.log(`Total issues found: ${issues.length}`);
issues.forEach(iss => {
  console.log(`[${iss.type}] ${iss.file}:${iss.line} -> ${iss.snippet}`);
});
