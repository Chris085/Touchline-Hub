const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // High emphasis text needs to switch from white to slate-50 (which becomes dark in light mode)
  content = content.replace(/text-white/g, 'text-slate-50');
  
  // Some standard backgrounds are bg-black, typically these are overlays or distinct dark backgrounds
  // Map them to slate-950 so they invert to white in light mode, or keep using an inverted overlay.
  content = content.replace(/bg-black\/(\d+)/g, 'bg-slate-950/$1');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', filePath);
  }
}

function walkDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  });
}

walkDir('./src');
