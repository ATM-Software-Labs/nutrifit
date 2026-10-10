import re

with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add vista === 'peso' block
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

# 2. Add 'peso' to the type definition
content = content.replace("vista?: 'hoy' | 'historial' | 'profile' | 'ajustes'\n", "vista?: 'hoy' | 'historial' | 'profile' | 'ajustes' | 'peso'\n")

# 3. Add onPeso to BarraLateral
content = content.replace("onAgua={() => verHoy('agua')}", "onPeso={() => navegar('/peso')}\n          onAgua={() => verHoy('agua')}")

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
