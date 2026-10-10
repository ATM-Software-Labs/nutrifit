import re
with open('src/components/PaginaPerfil.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix function clicLista{t('perfil.amigos')} -> function clicListaAmigos
content = content.replace("function clicLista{t('perfil.amigos')}", "function clicListaAmigos")

# Fix {t('perfil.amigos')} /> -> Amigos />
content = content.replace("<{t('perfil.amigos')} />", "<Amigos />")
content = content.replace("function {t('perfil.amigos')}()", "function Amigos()")

# Check for other broken syntax
content = content.replace("function {t('perfil.logros')}()", "function Logros()")
content = content.replace("interface {t('perfil.amigos')}", "interface Amigos")

with open('src/components/PaginaPerfil.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
