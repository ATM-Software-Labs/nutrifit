import re

with open('src/components/BloqueDescarga.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = r"""      \{plataforma === 'escritorio' \? \(
        <div className="flex items-center gap-5">
          <div className="shrink-0 rounded-2xl border border-neutral-200 p-1\.5 dark:border-neutral-800">
            <QrDescarga tamano=\{112\} />
          </div>
          <div className="min-w-0">
            <h2 id="titulo-descarga" className="text-lg font-semibold tracking-tight">
              Instala la app
            </h2>
            <p className="mt-1 text-sm font-medium text-mint-700 dark:text-mint-400">[^<]+</p>
            <p className="mt-1\.5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">[^<]+</p>
            \{conEnlace && \(
              <a href="/descargar" className="mt-2 inline-block text-sm font-medium text-graphite underline decoration-neutral-300 underline-offset-4 hover:decoration-mint dark:text-neutral-100 dark:decoration-neutral-600">
                Ver todas las opciones
              </a>
            \)\}
          </div>
        </div>
      \) : \("""

new_block = """      {plataforma === 'escritorio' ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="hidden sm:block shrink-0 rounded-2xl border border-neutral-200 p-1.5 dark:border-neutral-800">
            <QrDescarga tamano={100} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="titulo-descarga" className="text-lg font-semibold tracking-tight">
              Instala la app
            </h2>
            <p className="mt-1.5 mb-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              Instala NutriFit en tu ordenador o escanea el QR para llevarla en tu móvil.
            </p>
            <BotonesMovil plataforma={plataforma} />
            {conEnlace && (
              <a href="/descargar" className="mt-3 block text-center sm:text-left text-sm font-medium text-neutral-500 hover:text-graphite dark:text-neutral-400 dark:hover:text-white">
                Más opciones de instalación
              </a>
            )}
          </div>
        </div>
      ) : ("""

new_content = re.sub(old_block, new_block, content, count=1)
if content == new_content:
    print('Failed to match')
else:
    with open('src/components/BloqueDescarga.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Replaced successfully')
