import re

with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import { WidgetAgua } from './WidgetAgua.tsx'", "import { WidgetAgua } from './WidgetAgua.tsx'\nimport { WidgetAyuno } from './WidgetAyuno.tsx'")

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
