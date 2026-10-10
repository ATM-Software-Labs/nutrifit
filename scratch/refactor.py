import re

with open('src/components/Ajustes.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

seccion_replacement = '''function Seccion({ id, titulo, children }: { id?: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-8">
      <h3 className="etiqueta">{titulo}</h3>
      {children}
    </section>
  )
}'''
content = re.sub(r'function Seccion.*?return \(\n.*?<section.*?className="space-y-4".*?>\s*<h3.*?etiqueta.*?>\{titulo\}</h3>\s*\{children\}\s*</section>\n\s*\)', seccion_replacement, content, flags=re.DOTALL)

content = content.replace("<Seccion titulo={t('ajustes.perfil')}", "<Seccion id=\"perfil\" titulo={t('ajustes.perfil')}")
content = content.replace("<Seccion titulo={t('ajustes.idioma')}", "<Seccion id=\"preferencias\" titulo={t('ajustes.idioma')}")
content = content.replace("<Seccion titulo={t('ajustes.dispositivos')}", "<Seccion id=\"dispositivos\" titulo={t('ajustes.dispositivos')}")
content = content.replace("<Seccion titulo={t('ajustes.cuenta')}", "<Seccion id=\"cuenta\" titulo={t('ajustes.cuenta')}")

main_search = '''<main className="mx-auto max-w-2xl px-5 pb-12 pt-6 lg:px-0 lg:pt-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-graphite dark:text-neutral-100">{t('ajustes.titulo')}</h1>
      <div className="space-y-9 pb-2">'''

main_replacement = '''<main className="mx-auto max-w-5xl px-5 pb-12 pt-6 lg:px-8 lg:pt-10 flex flex-col lg:flex-row gap-8 lg:gap-16">
      <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-10 h-max z-10">
        <h1 className="mb-6 text-2xl lg:text-3xl font-semibold tracking-tight text-graphite dark:text-neutral-100">{t('ajustes.titulo')}</h1>
        <nav className="hidden lg:flex flex-col gap-1 text-sm font-medium" aria-label="Ajustes">
          <a href="#perfil" className="px-3 py-2 rounded-xl text-graphite dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">Perfil y Objetivos</a>
          <a href="#preferencias" className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">Preferencias</a>
          <a href="#dispositivos" className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">Conexiones y Dispositivos</a>
          <a href="#cuenta" className="px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">Cuenta</a>
        </nav>
      </aside>
      <div className="flex-1 space-y-12 pb-2 min-w-0">'''

content = content.replace(main_search, main_replacement)

with open('src/components/Ajustes.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
