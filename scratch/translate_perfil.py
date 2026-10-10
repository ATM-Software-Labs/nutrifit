import re

with open('src/components/PaginaPerfil.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("Pestañas", "{t('perfil.pestanas')}")
content = content.replace("Logros", "{t('perfil.logros')}")
content = content.replace("Amigos", "{t('perfil.amigos')}")
content = content.replace("Días en racha", "{t('perfil.racha')}")
content = content.replace("Sesiones este mes", "{t('perfil.sesiones')}")
content = content.replace("Seguir", "{t('perfil.seguir')}")
content = content.replace("Siguiendo", "{t('perfil.siguiendo')}")

with open('src/components/PaginaPerfil.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
