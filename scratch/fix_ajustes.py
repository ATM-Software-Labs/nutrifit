import re
with open('src/components/Ajustes.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("    </section>\n  )\n}\n}\n\nexport default function", "    </section>\n  )\n}\n\nexport default function")

with open('src/components/Ajustes.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
