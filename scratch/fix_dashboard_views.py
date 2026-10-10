import re
with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure vista includes 'ajustes' and 'peso'
# Wait, let's just replace the whole {vista === 'hoy' ? ... } block
# to fix it completely

search = r"\{vista === 'hoy' \? \(\s*hoyVista\s*\) : vista === 'profile' \? \(\s*<Suspense fallback=\{<div className=\"p-10\"><Esqueleto alto=\"h-64\" /></div>\}>\s*<PaginaPerfil usuario=\{usuario\} onUsuario=\{onUsuario\} />\s*</Suspense>\s*\) : \(\s*<Suspense fallback=\{<div className=\"p-10\"><Esqueleto alto=\"h-64\" /></div>\}>\s*<Historial[^>]*/>\s*</Suspense>\s*\)\}"

replacement = '''{vista === 'hoy' ? (
        hoyVista
      ) : vista === 'profile' ? (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <PaginaPerfil usuario={usuario} onUsuario={onUsuario} />
        </Suspense>
      ) : vista === 'ajustes' ? (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <Ajustes usuario={usuario} onClose={() => navegar('/')} onUsuario={(u) => { onUsuario(u); recargar() }} onSalir={onSalir} />
        </Suspense>
      ) : vista === 'peso' ? (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <main className="mx-auto max-w-2xl px-5 pb-12 pt-6 lg:px-0 lg:pt-10">
            <h1 className="mb-6 text-2xl font-semibold tracking-tight text-graphite dark:text-neutral-100">{t('peso.titulo')}</h1>
            <GraficaPeso usuario={usuario} />
            <div className="mt-8 space-y-4">
              <h2 className="text-lg font-medium">{t('peso.estimaciones')}</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-neutral-200 bg-card p-4 dark:border-neutral-800 dark:bg-card-dark">
                  <p className="text-sm text-neutral-500">{t('peso.musculo')}</p>
                  <p className="mt-1 text-2xl font-semibold">{usuario.peso_kg ? (usuario.peso_kg * 0.4).toFixed(1) : '--'} kg</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-card p-4 dark:border-neutral-800 dark:bg-card-dark">
                  <p className="text-sm text-neutral-500">{t('peso.grasa')}</p>
                  <p className="mt-1 text-2xl font-semibold">{usuario.peso_kg ? (usuario.peso_kg * 0.15).toFixed(1) : '--'} %</p>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-2">{t('peso.nota')}</p>
              
              <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <button onClick={() => alert('Próximamente...')} className="w-full h-12 rounded-xl border border-neutral-300 font-medium text-sm flex items-center justify-center dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition">{t('peso.importar')}</button>
              </div>
            </div>
          </main>
        </Suspense>
      ) : (
        <Suspense fallback={<div className="p-10"><Esqueleto alto="h-64" /></div>}>
          <Historial
            usuario={usuario}
            onVerDia={(f) => {
              setFecha(f)
              navegar('/')
            }}
          />
        </Suspense>
      )}'''

content = re.sub(search, replacement, content, flags=re.DOTALL)

content = content.replace("onClick={() => setHoja({ tipo: 'ajustes' })}", "onClick={() => navegar('/ajustes')}")
content = content.replace("onAjustes={() => setHoja({ tipo: 'ajustes' })}", "onAjustes={() => navegar('/ajustes')}")

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
