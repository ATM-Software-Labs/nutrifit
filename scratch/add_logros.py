import re

with open('src/components/PaginaPerfil.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Buscamos const logros = ...
logros_search = r"const logros = \[\s*\{ id: 'racha7'.*?\}\s*\]"

new_logros = '''const agua = resumen?.agua_ml ?? 0
  const caloriasOk = metas.calorias > 0 && totales.calorias >= metas.calorias - 200 && totales.calorias <= metas.calorias + 200
  const macrosOk = metas.proteinas > 0 && totales.proteinas >= metas.proteinas * 0.9 && totales.carbohidratos >= metas.carbohidratos * 0.9 && totales.grasas >= metas.grasas * 0.9
  const logros = [
    { id: 'racha7', icono: '🔥', titulo: '7 días seguidos', detalle: 'Una semana registrando', ok: racha >= 7 },
    { id: 'racha30', icono: '🔥', titulo: '30 días seguidos', detalle: 'Un mes de constancia', ok: racha >= 30 },
    { id: 'racha100', icono: '🔥', titulo: '100 días seguidos', detalle: 'Una dedicación increíble', ok: racha >= 100 },
    { id: 'prote', icono: '🍗', titulo: 'Meta de proteína', detalle: 'El objetivo de hoy', ok: metas.proteinas > 0 && totales.proteinas >= metas.proteinas },
    { id: 'equilibrio', icono: '⚖️', titulo: 'Equilibrio perfecto', detalle: 'Cumpliste tus macros', ok: macrosOk },
    { id: 'calorias', icono: '🎯', titulo: 'Diana de calorías', detalle: 'Acierto exacto en calorías', ok: caloriasOk },
    { id: 'agua', icono: '💧', titulo: 'Hidratación óptima', detalle: 'Más de 2 litros de agua', ok: agua >= 2000 },
    { id: 'deportista', icono: '🏃', titulo: 'Deportista activo', detalle: 'Has registrado al menos 5 entrenamientos', ok: sesiones.length >= 5 },
    { id: 'intenso', icono: '⚡', titulo: 'Entrenamiento intenso', detalle: 'Registraste una sesión de alta intensidad', ok: sesiones.some(s => s.intensidad === 'alta') },
    { id: 'social', icono: '🤝', titulo: 'Amigable', detalle: 'Tienes al menos 1 amigo', ok: amigos >= 1 },
    { id: 'pionero', icono: '🚀', titulo: 'Pionero', detalle: 'Cuenta creada en NutriFit', ok: Boolean(usuario.creado_en) },
  ]'''

content = re.sub(r'const logros = \[.*?\]', new_logros, content, flags=re.DOTALL)

# Reemplazar <span>{logro.ok ? '✅' : '🔒'}</span> por el icono del logro
content = content.replace("<span aria-hidden=\"true\">{logro.ok ? '??' : '??'}</span>", "<span aria-hidden=\"true\">{logro.ok ? logro.icono : '🔒'}</span>")
# En caso de que se haya codificado como '✅' o '🔒' en el archivo en disco (las '??' suelen ser un error de impresión de la consola powershell)
content = content.replace("<span aria-hidden=\"true\">{logro.ok ? '✅' : '🔒'}</span>", "<span aria-hidden=\"true\">{logro.ok ? logro.icono : '🔒'}</span>")

with open('src/components/PaginaPerfil.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
