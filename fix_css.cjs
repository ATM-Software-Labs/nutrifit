const fs = require('fs');
let lines = fs.readFileSync('src/index.css', 'utf8').split('\n');
const goodLines = lines.slice(0, 157);
const code = `
@layer utilities {
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}
`;
fs.writeFileSync('src/index.css', goodLines.join('\n') + code);
console.log('Fixed index.css');
