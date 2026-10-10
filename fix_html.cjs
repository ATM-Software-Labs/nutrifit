const fs = require('fs');

let data = fs.readFileSync('functions/utils/email.ts', 'utf8');

data = data.replace('width="580"', 'width="480"');
data = data.replace('max-width:580px;', 'max-width:480px;');

data = data.replace(
  'font-size:36px;line-height:1.2;font-weight:700;letter-spacing:8px;',
  'font-size:28px;line-height:1.2;font-weight:700;letter-spacing:6px;'
);

const preheaderOld = '<span style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escaparHtml(preheader)}</span>';
const preheaderNew = '<span style="display:none;font-size:1px;color:#f6f8fa;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escaparHtml(preheader)}</span>';
data = data.replace(preheaderOld, preheaderNew);

data = data.replace('background-color: #10b981;', 'background-color: #059669;');

fs.writeFileSync('functions/utils/email.ts', data);
console.log('Fixed HTML properties');
