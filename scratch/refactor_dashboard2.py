import re

with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Start of left column wrapper
content = re.sub(
    r'<section className="tarjeta px-6 pb-6 pt-7 lg:col-start-1 lg:row-start-1"[^>]*>',
    r'<div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4">\n            <section className="tarjeta px-6 pb-6 pt-7">',
    content
)

# 2. End of AnilloCalorias -> remove SeccionComida start wrapper here
content = re.sub(
    r'</section>\s*<div className="space-y-3 lg:col-start-2 lg:row-span-4 lg:row-start-1 xl:row-span-3">',
    r'</section>',
    content
)

# 3. AnadirRapido div
content = re.sub(
    r'<div className="hidden lg:col-start-1 lg:row-start-2 lg:block">',
    r'<div className="hidden lg:block">',
    content
)

# 4. End of left column / start of right column
content = re.sub(
    r'onManual=\{\(comida\) => setHoja\(\{ tipo: \'revision\', comida, resultado: null, imagenUrl: null \}\)\}\s*/>\s*</div>\s*<div className="space-y-4 lg:col-start-1 lg:row-start-3 lg:space-y-6 xl:col-start-3 xl:row-span-3 xl:row-start-1">\s*<WidgetAyuno />\s*<WidgetAgua[^>]*/>\s*</div>\s*</div>\s*</div>',
    r'onManual={(comida) => setHoja({ tipo: \'revision\', comida, resultado: null, imagenUrl: null })}\n              />\n            </div>\n            <div className="space-y-4 lg:space-y-6 xl:hidden">\n              <WidgetAyuno />\n              <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />\n            </div>\n          </div>\n\n          <div className="space-y-3 lg:col-span-7 xl:col-span-5">',
    content
)

# 5. After SeccionComida
content = re.sub(
    r'frecuente\(c\)\} />\n                  \)\)\}\n            </div>\n\n            <div className="hidden',
    r'frecuente(c)} />\n                  ))}\n          </div>\n\n          <div className="hidden xl:flex xl:col-span-3 flex-col gap-6">\n            <WidgetAyuno />\n            <WidgetAgua fecha={fecha} inicial={resumen?.agua_ml ?? 0} pesoKg={usuario.peso_kg} onActividad={onActividad} onCambio={(ml) => actualizar((r) => ({ ...r, agua_ml: ml }))} />\n          </div>\n\n          {/* BORRAR ESTO */}\n          <div className="hidden',
    content
)

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
