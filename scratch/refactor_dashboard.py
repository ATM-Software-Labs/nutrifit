import re

with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

grid_search = '''<div className="mt-5 grid grid-cols-1 gap-4 lg:mt-0 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto_1fr] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] xl:grid-rows-[auto_auto_1fr]">'''

grid_replacement = '''<div className="mt-5 flex flex-col gap-4 lg:mt-0 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 xl:gap-8">'''

content = content.replace(grid_search, grid_replacement)

# AnilloCalorias
content = content.replace(
    '''<section className="tarjeta px-6 pb-6 pt-7 lg:col-start-1 lg:row-start-1" aria-label="Resumen de calor\xeedas y macros">''',
    '''<div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4">\n            <section className="tarjeta px-6 pb-6 pt-7" aria-label="Resumen de calor\xeedas y macros">'''
)

# After macros
content = content.replace(
    '''</section>\n\n            <div className="space-y-3 lg:col-start-2 lg:row-span-4 lg:row-start-1 xl:row-span-3">''',
    '''</section>'''
)

# AnadirRapido
content = content.replace(
    '''<div className="hidden lg:col-start-1 lg:row-start-2 lg:block">\n              <AnadirRapido''',
    '''<div className="hidden lg:block">\n              <AnadirRapido'''
)

content = content.replace(
    '''onEscaner={() => setEscanerAbierto(true)}\n              />\n            </div>\n\n            <div className="space-y-4 lg:col-start-1 lg:row-start-3 lg:space-y-6 xl:col-start-3 xl:row-span-3 xl:row-start-1">''',
    '''onEscaner={() => setEscanerAbierto(true)}\n              />\n            </div>\n            <div className="space-y-4 lg:space-y-6 xl:hidden">\n              <WidgetAyuno />\n              <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />\n            </div>\n          </div>\n\n          <div className="space-y-3 lg:col-span-7 xl:col-span-5">'''
)

# End of SeccionComida
content = content.replace(
    '''onFrecuente={(c) => void frecuente(c)} />\n                  ))}\n            </div>\n\n            <div className="hidden lg:col-start-1 lg:row-start-2 lg:block">''',
    '''onFrecuente={(c) => void frecuente(c)} />\n                  ))}\n            </div>\n\n          <div className="hidden xl:flex xl:col-span-3 flex-col gap-6">\n            <WidgetAyuno />\n            <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />\n          </div>\n\n          {/* BORRAR ESTO */}\n          <div className="hidden">'''
)

content = content.replace(
    '''<WidgetAyuno />\n              <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />\n            </div>\n          </div>\n        </div>''',
    '''</div>\n        </div>'''
)

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
