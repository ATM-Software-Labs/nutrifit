import sys
content = open('src/components/SeccionDescargas.tsx', encoding='utf-8').read()
old_str = """            <div className="mt-5 w-full max-w-xs">
              <BotonInstalar />
            </div>"""
new_str = """            <div className="mt-5 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <BotonInstalar />
              </div>
              <a
                href="/NutriFit.apk"
                download="NutriFit.apk"
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-neutral-800 text-[15px] font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                <Download size={18} /> Descargar APK
              </a>
            </div>"""
if old_str in content:
    open('src/components/SeccionDescargas.tsx', 'w', encoding='utf-8').write(content.replace(old_str, new_str))
    print('Replaced')
else:
    print('Not found')
