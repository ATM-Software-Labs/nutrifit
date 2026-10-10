import re

with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure useIdioma is imported
if 'useIdioma' not in content:
    content = content.replace("import { useResumen } from '../hooks/useResumen.ts'", "import { useResumen } from '../hooks/useResumen.ts'\nimport { useIdioma } from '../hooks/useIdioma.ts'")

# We need to add const { t } = useIdioma() inside Dashboard if it's not there, but wait, Dashboard already has it?
# Let's check if Dashboard uses 	. No, it doesn't currently. 
# Wait, actually let's just add it inside the Dashboard component or the specific block if it's rendered inline.
# Since the 'peso' block is inline in Dashboard, we can use 	 from Dashboard component.
if 'const { t } = useIdioma()' not in content:
    content = content.replace("const { recargar, resumen, sumarQuemadas, error, actualizar, borrar, repetir, frecuente } = useResumen(fecha, true)", "const { recargar, resumen, sumarQuemadas, error, actualizar, borrar, repetir, frecuente } = useResumen(fecha, true)\n    const { t } = useIdioma()")

content = content.replace("Progreso de peso corporal", "{t('peso.titulo')}")
content = content.replace("Estimaciones corporales", "{t('peso.estimaciones')}")
content = content.replace("Masa muscular estimada", "{t('peso.musculo')}")
content = content.replace("Grasa corporal estimada", "{t('peso.grasa')}")
content = content.replace("Nota: Estos valores son estimaciones genéricas basadas en tu peso total. Más adelante podrás sincronizar tu báscula inteligente o importar datos exactos para mayor precisión.", "{t('peso.nota')}")
content = content.replace("Importar historial de peso y métricas...", "{t('peso.importar')}")

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
