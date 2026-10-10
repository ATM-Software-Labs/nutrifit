const fs = require('fs');
let data = fs.readFileSync('tests/email.test.ts', 'utf8');

data = data.replace(
  "headers: { 'Content-Language': 'es', 'X-Auto-Response-Suppress': 'All', 'List-Unsubscribe': '<https://nutri.trujillomingorance.com/ajustes>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }",
  "headers: { 'Content-Language': 'es', 'X-Auto-Response-Suppress': 'All', 'List-Unsubscribe': '<https://nutri.trujillomingorance.com/ajustes>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', 'X-Entity-Ref-ID': peticion.headers['X-Entity-Ref-ID'] }"
);

fs.writeFileSync('tests/email.test.ts', data);
console.log('Fixed email tests');
