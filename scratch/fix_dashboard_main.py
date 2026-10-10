import re
with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("          </div>\n        </div>\n  )\n\n  return (", "          </div>\n        </div>\n      </div>\n    </main>\n  )\n\n  return (")

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
