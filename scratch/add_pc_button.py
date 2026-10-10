import re

with open('src/components/SeccionDescargas.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''          <section aria-label="Descargar en el m\xf3vil" className="tarjeta mt-6 flex flex-col items-center gap-6 p-6 sm:flex-row">
          <div className="shrink-0 rounded-2xl border border-neutral-200 p-2 dark:border-neutral-800">
            <QrDescarga tamano={168} />
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold tracking-tight">Escanea el c\xf3digo o instala en tu PC</p>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Apunta con la c\xe1mara de tu m\xf3vil para instalar la app, o pulsa el bot\xf3n de abajo para instalarla directamente en este ordenador (Windows/Mac).
            </p>
            <div className="mt-5 w-full max-w-xs">
              <BotonInstalar />
            </div>
          </div>
        </section>'''

# Because of encoding issues in regex, I'll replace the block from <section aria-label="Descargar en el m.vil" to </section> inside the {plataforma === 'escritorio' ? (
import re

content = re.sub(
    r'<section aria-label="Descargar en el m[^"]+" className="tarjeta mt-6 flex flex-col items-center gap-6 p-6 sm:flex-row">.*?</section>',
    replacement,
    content,
    flags=re.DOTALL
)

with open('src/components/SeccionDescargas.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
