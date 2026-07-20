const fs = require('fs');
const path = require('path');

function searchInDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'build') {
        searchInDir(fullPath, query);
      }
    } else if (file.endsWith('.css') || file.endsWith('.scss')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(query)) {
        console.log(`Found "${query}" in ${fullPath}`);
      }
    }
  }
}

console.log("Searching in quantri-longwedding...");
searchInDir('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding', 'stepper-wrapper');
