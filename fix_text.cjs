const fs = require('fs');

let data = fs.readFileSync('functions/utils/email.ts', 'utf8');

const newTextLogc = `
  const texto = cifras
    ? \`Tu código de verificación de NutriFit es: \${cifras}\\n\\nEste código es de un solo uso y caduca en 15 minutos.\\n\\nO accede directamente pulsando aquí:\\n\${enlace}\\n\\nNutriFit · Seguridad transaccional\\nhttps://nutri.trujillomingorance.com\`
    : \`Has solicitado iniciar sesión en NutriFit.\\n\\nAcceder a mi cuenta:\\n\${enlace}\\n\\n\${aviso}\\n\\nNutriFit · Seguridad transaccional\\nhttps://nutri.trujillomingorance.com\`;
`;

data = data.replace(/const texto = cifras[\s\S]*?Ajustes: \$\{URL_AJUSTES\}`/, newTextLogc.trim());

fs.writeFileSync('functions/utils/email.ts', data);
console.log('Fixed text');
