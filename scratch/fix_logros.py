import re

with open('src/components/PaginaPerfil.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the import
if 'Trophy' not in content:
    content = content.replace("import { BadgeCheck, Flame, User } from 'lucide-react'", "import { BadgeCheck, Flame, User, Trophy, Target, Droplets, Dumbbell, Zap, Users, Rocket, Scale } from 'lucide-react'")

logros_replacement = '''const logros = [
    { id: 'racha7', icono: <Flame size={24} className="text-orange-500" />, titulo: '7 días seguidos', detalle: 'Una semana registrando', ok: racha >= 7 },
    { id: 'racha30', icono: <Flame size={24} className="text-orange-500" />, titulo: '30 días seguidos', detalle: 'Un mes de constancia', ok: racha >= 30 },
    { id: 'racha100', icono: <Flame size={24} className="text-orange-500" />, titulo: '100 días seguidos', detalle: 'Una dedicación increíble', ok: racha >= 100 },
    { id: 'prote', icono: <Dumbbell size={24} className="text-blue-500" />, titulo: 'Meta de proteína', detalle: 'El objetivo de hoy', ok: metas.proteinas > 0 && totales.proteinas >= metas.proteinas },
    { id: 'equilibrio', icono: <Scale size={24} className="text-emerald-500" />, titulo: 'Equilibrio perfecto', detalle: 'Cumpliste tus macros', ok: macrosOk },
    { id: 'calorias', icono: <Target size={24} className="text-purple-500" />, titulo: 'Diana de calorías', detalle: 'Acierto exacto en calorías', ok: caloriasOk },
    { id: 'agua', icono: <Droplets size={24} className="text-cyan-500" />, titulo: 'Hidratación óptima', detalle: 'Más de 2 litros de agua', ok: agua >= 2000 },
    { id: 'deportista', icono: <Trophy size={24} className="text-yellow-500" />, titulo: 'Deportista activo', detalle: 'Has registrado al menos 5 entrenamientos', ok: sesiones.length >= 5 },
    { id: 'intenso', icono: <Zap size={24} className="text-red-500" />, titulo: 'Entrenamiento intenso', detalle: 'Registraste una sesión de alta intensidad', ok: sesiones.some(s => s.intensidad === 'alta') },
    { id: 'social', icono: <Users size={24} className="text-indigo-500" />, titulo: 'Amigable', detalle: 'Tienes al menos 1 amigo', ok: amigos >= 1 },
    { id: 'pionero', icono: <Rocket size={24} className="text-pink-500" />, titulo: 'Pionero', detalle: 'Cuenta creada en NutriFit', ok: Boolean(usuario.creado_en) },
  ]'''

content = re.sub(r'const logros = \[.*?\]', logros_replacement, content, flags=re.DOTALL)

# Reemplazar <span>{logro.ok ? '??' : '??'}</span>
content = re.sub(r'<span aria-hidden="true">\{logro\.ok \? .*?\}</span>', r'<span aria-hidden="true">{logro.ok ? logro.icono : <Trophy size={24} className="text-neutral-400" />}</span>', content)

with open('src/components/PaginaPerfil.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
