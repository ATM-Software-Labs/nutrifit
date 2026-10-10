import re
with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'\{/\*([^\}]+)escritorio, 2 columnas \(lg\) o 3 \(xl\) con las comidas en el centro. La\s*<div',
    r'{/* \1escritorio, 2 columnas (lg) o 3 (xl) con las comidas en el centro. */}\n        <div',
    content
)

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
