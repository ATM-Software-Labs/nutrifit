const fs = require('fs');
let data = fs.readFileSync('functions/utils/email.ts', 'utf8');
data = data.replace('font-size:12px;line-height:1.5;color:#6b7280;"', 'font-size:11px;line-height:1.5;color:#6b7280;"');
fs.writeFileSync('functions/utils/email.ts', data);
console.log('Fixed footer');
