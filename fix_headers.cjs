const fs = require('fs');
let data = fs.readFileSync('functions/utils/email.ts', 'utf8');

data = data.replace(
  "delete headers['List-Unsubscribe-Post']\n  }",
  "delete headers['List-Unsubscribe-Post']\n  }\n\n  headers['X-Entity-Ref-ID'] = `nf-auth-${Date.now()}`"
);

fs.writeFileSync('functions/utils/email.ts', data);
console.log('Fixed headers');
