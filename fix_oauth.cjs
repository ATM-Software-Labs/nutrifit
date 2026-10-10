const fs = require('fs');
let f = 'tests/escanearOAuth.test.ts';
let d = fs.readFileSync(f, 'utf8');
d = d.replace(
  "'https://nutri.trujillomingorance.com/?auth=error'",
  "'https://nutri.trujillomingorance.com/?auth=error&motivo=error_token&detalle=%7B%22error%22%3A%22invalid_grant%22%2C%22error_description%22%3A%22Bad%20Request%22%7D'"
);
fs.writeFileSync(f, d);
console.log('Fixed OAuth test');
