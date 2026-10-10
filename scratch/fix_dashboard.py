import re

with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Reemplazar GraficaPeso con WidgetAyuno en la vista de hoy
content = re.sub(
    r'<Suspense fallback={<Esqueleto alto="h-64" />}>\s*<GraficaPeso usuario=\{usuario\} />\s*</Suspense>',
    r'<WidgetAyuno />',
    content
)

# 2. Agregar import de WidgetAyuno si no existe
if 'WidgetAyuno' not in content:
    content = content.replace("import { WidgetAgua } from './WidgetAgua.tsx'", "import { WidgetAgua } from './WidgetAgua.tsx'\nimport { WidgetAyuno } from './WidgetAyuno.tsx'")

# 3. Agregar vista de peso en la función principal
vista_ajustes_block = ''') : vista === 'ajustes' ? (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <Ajustes usuario={usuario} onClose={() => navegar('/')} onUsuario={(u) => { onUsuario(u); recargar() }} onSalir={onSalir} />
        </Suspense>
      ) : ('''

vista_peso_block = ''') : vista === 'ajustes' ? (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <Ajustes usuario={usuario} onClose={() => navegar('/')} onUsuario={(u) => { onUsuario(u); recargar() }} onSalir={onSalir} />
        </Suspense>
      ) : vista === 'peso' ? (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <main className="mx-auto max-w-2xl px-5 pb-12 pt-6 lg:px-0 lg:pt-10">
            <h1 className="mb-6 text-2xl font-semibold tracking-tight text-graphite dark:text-neutral-100">Progreso de peso corporal</h1>
            <GraficaPeso usuario={usuario} />
            <div className="mt-8 space-y-4">
              <h2 className="text-lg font-medium">Estimaciones corporales</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-neutral-200 bg-card p-4 dark:border-neutral-800 dark:bg-card-dark">
                  <p className="text-sm text-neutral-500">Masa muscular estimada</p>
                  <p className="mt-1 text-2xl font-semibold">{usuario.peso_kg ? (usuario.peso_kg * 0.4).toFixed(1) : '--'} kg</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-card p-4 dark:border-neutral-800 dark:bg-card-dark">
                  <p className="text-sm text-neutral-500">Grasa corporal estimada</p>
                  <p className="mt-1 text-2xl font-semibold">{usuario.peso_kg ? (usuario.peso_kg * 0.15).toFixed(1) : '--'} %</p>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-2">Nota: Estos valores son estimaciones genéricas basadas en tu peso total. Más adelante podrás sincronizar tu báscula inteligente o importar datos exactos para mayor precisión.</p>
              
              <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <button onClick={() => alert('Próximamente: Sincronización con básculas inteligentes, Apple Health, y Google Fit.')} className="w-full h-12 rounded-xl border border-neutral-300 font-medium text-sm flex items-center justify-center dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition">Importar historial de peso y métricas...</button>
              </div>
            </div>
          </main>
        </Suspense>
      ) : ('''

if "vista === 'peso'" not in content:
    content = content.replace(vista_ajustes_block, vista_peso_block)

# 4. Modificar layout para arreglar layout shift
content = content.replace(
    '''<div className="mt-5 grid grid-cols-1 gap-4 lg:mt-0 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto_1fr] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] xl:grid-rows-[auto_auto_1fr]">''',
    '''<div className="mt-5 flex flex-col gap-4 lg:mt-0 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 xl:gap-8">'''
)

content = content.replace(
    '''<section className="tarjeta px-6 pb-6 pt-7 lg:col-start-1 lg:row-start-1" aria-label="Resumen de caloras y macros">''',
    '''<div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8">\n            <section className="tarjeta px-6 pb-6 pt-7" aria-label="Resumen de caloras y macros">'''
)

content = content.replace(
    '''</section>\n\n            <div className="space-y-3 lg:col-start-2 lg:row-span-4 lg:row-start-1 xl:row-span-3">''',
    '''</section>'''
)

content = content.replace(
    '''<div className="hidden lg:col-start-1 lg:row-start-2 lg:block">''',
    '''<div className="hidden lg:block">'''
)

content = content.replace(
    '''onManual={(comida) => setHoja({ tipo: 'revision', comida, resultado: null, imagenUrl: null })}\n              />\n            </div>\n\n            {/* Agua y peso van juntos (tambin en mvil, uno tras otro). */}\n            <div className="space-y-4 lg:col-start-1 lg:row-start-3 lg:space-y-6 xl:col-start-3 xl:row-span-3 xl:row-start-1">\n              <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />\n              <WidgetAyuno />\n            </div>\n          </div>\n        </div>\n      </main>''',
    '''onManual={(comida) => setHoja({ tipo: 'revision', comida, resultado: null, imagenUrl: null })}\n              />\n            </div>\n            <div className="space-y-4 lg:space-y-6 xl:hidden">\n              <WidgetAyuno />\n              <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />\n            </div>\n          </div>\n\n          <div className="space-y-3 lg:col-span-7 xl:col-span-5">'''
)

content = content.replace(
    '''frecuente(c)} />\n                  ))}\n            </div>\n\n            <div className="hidden lg:block">''',
    '''frecuente(c)} />\n                  ))}\n          </div>\n\n          <div className="hidden xl:flex xl:col-span-3 flex-col gap-6 lg:sticky lg:top-8">\n            <WidgetAyuno />\n            <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />\n          </div>\n\n          <div className="hidden lg:block">'''
)

# Replace 'caloras' encoded string if it exists
content = re.sub(
    r'<section className="tarjeta px-6 pb-6 pt-7 lg:col-start-1 lg:row-start-1" aria-label="Resumen de calor.as y macros">',
    r'<div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8">\n            <section className="tarjeta px-6 pb-6 pt-7" aria-label="Resumen de calor\xeedas y macros">',
    content
)

# In case the exact layout replacement failed, use regex for layout shift
# Just regexing the grid parts
import re
def fix_layout(text):
    text = re.sub(r'<div className="mt-5 grid grid-cols-1 gap-4 lg:mt-0 lg:grid-cols-2 lg:grid-rows-\[auto_auto_auto_1fr\] lg:items-start lg:gap-6 xl:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.2fr\)_minmax\(0,1fr\)\] xl:grid-rows-\[auto_auto_1fr\]">',
                  r'<div className="mt-5 flex flex-col gap-4 lg:mt-0 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 xl:gap-8">', text)
    
    # Left column wrapper
    if 'lg:col-span-5' not in text:
        text = re.sub(r'(<section className="tarjeta px-6 pb-6 pt-7)[^"]*("[^>]*>)', r'<div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8">\n            \1\2', text)
        text = re.sub(r'</section>\s*<div className="space-y-3 lg:col-start-2 lg:row-span-4 lg:row-start-1 xl:row-span-3">', r'</section>', text)
        text = re.sub(r'<div className="hidden lg:col-start-1 lg:row-start-2 lg:block">', r'<div className="hidden lg:block">', text)
        text = re.sub(r'(<div className="space-y-4) lg:col-start-1 lg:row-start-3 lg:space-y-6 xl:col-start-3 xl:row-span-3 xl:row-start-1(">)', r'\1 lg:space-y-6 xl:hidden\2', text)
        
        # After Anillo
        text = re.sub(r'(<WidgetAyuno />\s*</div>)\s*</div>\s*</div>\s*</main>', r'\1\n          </div>\n\n          <div className="space-y-3 lg:col-span-7 xl:col-span-5">', text)
        
        # At the end of SeccionComida, close the col-span-7 and add the right column for xl
        text = re.sub(r'(frecuente\(c\)\} />\s*\)\)\})\s*</div>\s*<div className="hidden lg:block">', r'\1\n          </div>\n\n          <div className="hidden xl:flex xl:col-span-3 flex-col gap-6 lg:sticky lg:top-8">\n            <WidgetAyuno />\n            <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />\n          </div>\n\n          {/* Removed */}\n          <div className="hidden">', text)
    return text

content = fix_layout(content)

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
