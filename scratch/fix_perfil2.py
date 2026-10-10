import re
with open('src/components/PaginaPerfil.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix syntax errors
content = content.replace("{id === 'feed' ? 'Feed' : '{t('perfil.amigos')}'}", "{id === 'feed' ? 'Feed' : t('perfil.amigos')}")
content = content.replace("onClick={clicLista{t('perfil.amigos')}}", "onClick={clicListaAmigos}")

# There was another syntax error around line 628 (section closing tag missing)
# Let's check what was around there. Wait, onClick={clicLista{t('perfil.amigos')}} might have broken the JSX parser which cascaded to line 628. Let's run build again.

with open('src/components/PaginaPerfil.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
