import os
import shutil
import re
from datetime import datetime

DRIVE_ROOT = r"G:\My Drive\NutriFit Enterprise"
PROJECT_ROOT = r"C:\Users\Alberto\projects\nutrifit"

DOCS_MAPPING = {
    "01_Legal_y_Cumplimiento": [
        ("02_TERMINOS_Y_CONDICIONES_SERVICIO.md", "01_Terminos_y_Condiciones_de_Servicio.md", "Términos y Condiciones de Servicio"),
        ("03_POLITICA_PRIVACIDAD_Y_RGPD.md", "02_Politica_de_Privacidad_y_RGPD.md", "Política de Privacidad y Cumplimiento RGPD"),
        ("04_ACUERDO_PROCESAMIENTO_DATOS_DPA.md", "03_Acuerdo_de_Procesamiento_de_Datos_DPA.md", "Acuerdo de Procesamiento de Datos (DPA)"),
        ("06_ACUERDO_NIVEL_SERVICIO_SLA.md", "04_Acuerdo_de_Nivel_de_Servicio_SLA.md", "Acuerdo de Nivel de Servicio (SLA)"),
    ],
    "02_Corporativo_y_Estrategia": [
        ("01_DOSSIER_CORPORATIVO_NUTRIFIT.md", "01_Dossier_Corporativo_NutriFit.md", "Dossier Corporativo e Información General"),
        (os.path.join("..", "CHECKLIST-LANZAMIENTO.md"), "02_Checklist_Lanzamiento_y_Operaciones.md", "Checklist de Lanzamiento y Protocolos Operativos"),
    ],
    "03_Seguridad_y_Arquitectura": [
        ("05_SEGURIDAD_CIFRADO_ARQUITECTURA_LOCAL_FIRST.md", "01_Seguridad_Cifrado_y_Arquitectura_Local_First.md", "Seguridad, Cifrado y Arquitectura Local-First"),
        (os.path.join("..", "BACKEND.md"), "02_Arquitectura_Backend_Cloudflare_Workers.md", "Arquitectura Backend, Workers y Base de Datos"),
        (os.path.join("..", "FRONTEND.md"), "03_Arquitectura_Frontend_y_PWA.md", "Arquitectura Frontend, PWA e IndexedDB"),
        (os.path.join("..", "ANDROID.md"), "04_Distribucion_Android_TWA_APK.md", "Distribución Android, TWA y Paquetes APK"),
        (os.path.join("..", "SETUP-git-y-despliegue.md"), "05_Guia_Setup_Git_y_Despliegue.md", "Guía de Setup, Git y Despliegue Continuo"),
    ],
    "04_Marca_y_Activos_Visuales": [
        ("07_DIRECTRICES_MARCA_Y_RECURSOS.md", "01_Directrices_de_Identidad_de_Marca.md", "Directrices de Identidad de Marca y Recursos"),
    ]
}

def markdown_to_html(md_text, title):
    # Process lines
    lines = md_text.split('\n')
    html_lines = []
    in_code = False
    in_list = False
    in_table = False
    
    def inline_format(text):
        # Escape HTML basic
        text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        # Bold
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
        # Italic
        text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
        # Inline code
        text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
        # Links
        text = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2" target="_blank" rel="noopener">\1</a>', text)
        return text

    for line in lines:
        stripped = line.strip()
        
        # Code block
        if stripped.startswith('```'):
            if in_code:
                html_lines.append('</code></pre>')
                in_code = False
            else:
                html_lines.append('<pre class="code-block"><code>')
                in_code = True
            continue
            
        if in_code:
            html_lines.append(stripped.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))
            continue

        # Tables
        if stripped.startswith('|') and stripped.endswith('|'):
            if not in_table:
                html_lines.append('<div class="table-container"><table class="corporate-table">')
                in_table = True
            cells = [c.strip() for c in stripped.strip('|').split('|')]
            if re.match(r'^[\s\:\-]+$', ''.join(cells)):
                continue # Header separator
            cell_tag = 'th' if not any('th' in l for l in html_lines[-3:]) and in_table and len(html_lines) > 0 and 'corporate-table' in html_lines[-1] else 'td'
            row_html = '<tr>' + ''.join(f'<{cell_tag}>{inline_format(c)}</{cell_tag}>' for c in cells) + '</tr>'
            html_lines.append(row_html)
            continue
        elif in_table:
            html_lines.append('</table></div>')
            in_table = False

        # Lists
        if stripped.startswith('- ') or stripped.startswith('* '):
            if not in_list:
                html_lines.append('<ul>')
                in_list = True
            html_lines.append(f'<li>{inline_format(stripped[2:])}</li>')
            continue
        elif in_list and not stripped.startswith('- ') and not stripped.startswith('* ') and stripped != '':
            html_lines.append('</ul>')
            in_list = False
            
        # Headers
        if stripped.startswith('# '):
            html_lines.append(f'<h1 class="heading-1">{inline_format(stripped[2:])}</h1>')
        elif stripped.startswith('## '):
            html_lines.append(f'<h2 class="heading-2">{inline_format(stripped[3:])}</h2>')
        elif stripped.startswith('### '):
            html_lines.append(f'<h3 class="heading-3">{inline_format(stripped[4:])}</h3>')
        elif stripped.startswith('#### '):
            html_lines.append(f'<h4 class="heading-4">{inline_format(stripped[5:])}</h4>')
        elif stripped.startswith('> '):
            html_lines.append(f'<blockquote class="corporate-quote">{inline_format(stripped[2:])}</blockquote>')
        elif stripped == '---':
            html_lines.append('<hr class="divider" />')
        elif stripped == '':
            if in_list:
                html_lines.append('</ul>')
                in_list = False
            continue
        else:
            html_lines.append(f'<p class="paragraph">{inline_format(stripped)}</p>')

    if in_list:
        html_lines.append('</ul>')
    if in_table:
        html_lines.append('</table></div>')
    if in_code:
        html_lines.append('</code></pre>')

    body_content = '\n'.join(html_lines)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} · NutriFit Enterprise</title>
<style>
  :root {{
    --primary: #059669;
    --primary-light: #ecfdf5;
    --primary-border: #a7f3d0;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --bg-page: #f8fafc;
    --bg-card: #ffffff;
    --border-card: #e2e8f0;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background-color: var(--bg-page);
    color: var(--text-main);
    line-height: 1.6;
    padding: 40px 20px;
  }}
  .container {{
    max-width: 860px;
    margin: 0 auto;
    background: var(--bg-card);
    border: 1px solid var(--border-card);
    border-radius: 16px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
    padding: 48px;
  }}
  .header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid var(--border-card);
    padding-bottom: 24px;
    margin-bottom: 36px;
  }}
  .brand {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}
  .brand-logo {{
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 20px;
  }}
  .brand-text {{
    font-size: 20px;
    font-weight: 700;
    color: var(--text-main);
    letter-spacing: -0.5px;
  }}
  .badge {{
    background: var(--primary-light);
    color: var(--primary);
    border: 1px solid var(--primary-border);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .meta-bar {{
    background: #f1f5f9;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 32px;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }}
  .heading-1 {{ font-size: 28px; font-weight: 800; color: #0f172a; margin: 32px 0 16px; letter-spacing: -0.5px; line-height: 1.25; }}
  .heading-2 {{ font-size: 22px; font-weight: 700; color: #1e293b; margin: 28px 0 12px; border-bottom: 1px solid var(--border-card); padding-bottom: 8px; }}
  .heading-3 {{ font-size: 18px; font-weight: 600; color: #334155; margin: 20px 0 8px; }}
  .heading-4 {{ font-size: 15px; font-weight: 600; color: #475569; margin: 16px 0 6px; }}
  .paragraph {{ margin-bottom: 16px; font-size: 15px; color: #334155; }}
  ul {{ margin: 0 0 20px 24px; }}
  li {{ margin-bottom: 6px; font-size: 15px; color: #334155; }}
  a {{ color: var(--primary); text-decoration: none; font-weight: 500; }}
  a:hover {{ text-decoration: underline; }}
  code {{ font-family: ui-monospace, Menlo, Consolas, monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #0f172a; }}
  .code-block {{ background: #0f172a; color: #f8fafc; padding: 18px; border-radius: 10px; overflow-x: auto; margin-bottom: 20px; font-size: 13px; line-height: 1.5; }}
  .code-block code {{ background: transparent; color: inherit; padding: 0; }}
  .table-container {{ overflow-x: auto; margin: 24px 0; border: 1px solid var(--border-card); border-radius: 8px; }}
  .corporate-table {{ width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }}
  .corporate-table th {{ background: #f8fafc; padding: 12px 16px; font-weight: 600; color: #475569; border-bottom: 1px solid var(--border-card); }}
  .corporate-table td {{ padding: 12px 16px; border-bottom: 1px solid var(--border-card); color: #334155; }}
  .corporate-table tr:last-child td {{ border-bottom: none; }}
  .corporate-quote {{ border-left: 4px solid var(--primary); background: var(--primary-light); padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-style: italic; color: #065f46; }}
  .divider {{ border: none; border-top: 1px solid var(--border-card); margin: 36px 0; }}
  .footer {{ margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border-card); text-align: center; font-size: 12px; color: var(--text-muted); }}
  @media (max-width: 640px) {{
    .container {{ padding: 24px 16px; border-radius: 0; border: none; }}
    body {{ padding: 0; }}
  }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="brand">
      <div class="brand-logo">N</div>
      <div class="brand-text">NutriFit Enterprise</div>
    </div>
    <div class="badge">Documento Oficial</div>
  </div>
  <div class="meta-bar">
    <span><strong>Organización:</strong> NutriFit Global</span>
    <span><strong>Contacto:</strong> nutrifit@trujillomingorance.com</span>
    <span><strong>Sede:</strong> Barcelona, España</span>
    <span><strong>Fecha:</strong> Octubre 2026</span>
  </div>
  {body_content}
  <div class="footer">
    <p>NutriFit Enterprise · Sistema de Gestión Nutricional y Rendimiento Físico</p>
    <p>Portal Oficial: <a href="https://nutri.trujillomingorance.com">https://nutri.trujillomingorance.com</a> · Recursos: <a href="https://nutri.trujillomingorance.com/recursos">https://nutri.trujillomingorance.com/recursos</a></p>
  </div>
</div>
</body>
</html>"""

def main():
    print(f"Iniciando sincronización corporativa hacia Google Drive: {DRIVE_ROOT}")
    os.makedirs(DRIVE_ROOT, exist_ok=True)
    
    docs_summary = []

    # 1. Process documents by category
    legal_base_dir = os.path.join(PROJECT_ROOT, "docs", "legal")

    for category, files in DOCS_MAPPING.items():
        cat_dir = os.path.join(DRIVE_ROOT, category)
        os.makedirs(cat_dir, exist_ok=True)
        print(f"\n[Categoria] {category}")
        
        for src_name, dest_name, title in files:
            src_path = os.path.normpath(os.path.join(legal_base_dir, src_name))
            if not os.path.exists(src_path):
                print(f"  [AVISO] Archivo no encontrado: {src_path}")
                continue
            
            with open(src_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Save clean markdown
            dest_md_path = os.path.join(cat_dir, dest_name)
            with open(dest_md_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Generate standalone styled HTML
            dest_html_name = os.path.splitext(dest_name)[0] + ".html"
            dest_html_path = os.path.join(cat_dir, dest_html_name)
            html_content = markdown_to_html(content, title)
            with open(dest_html_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
                
            print(f"  [OK] Copiado: {dest_name} y {dest_html_name}")
            docs_summary.append({
                "categoria": category,
                "titulo": title,
                "archivo_md": f"{category}/{dest_name}",
                "archivo_html": f"{category}/{dest_html_name}",
                "tamanio_kb": round(len(content) / 1024, 1)
            })

    # 2. Copy Logos and Visual Assets
    logos_dir = os.path.join(DRIVE_ROOT, "04_Marca_y_Activos_Visuales", "Logos")
    capturas_dir = os.path.join(DRIVE_ROOT, "04_Marca_y_Activos_Visuales", "Capturas_Oficiales")
    os.makedirs(logos_dir, exist_ok=True)
    os.makedirs(capturas_dir, exist_ok=True)

    public_dir = os.path.join(PROJECT_ROOT, "public")
    logos_to_copy = [
        "logo.svg", "logo-dark.svg", "logo-wordmark.svg", "logo-wordmark-dark.svg", 
        "logo.png", "favicon.svg"
    ]
    for logo_name in logos_to_copy:
        p = os.path.join(public_dir, logo_name)
        if os.path.exists(p):
            shutil.copy2(p, os.path.join(logos_dir, logo_name))
            print(f"  [OK] Logo copiado: {logo_name}")

    icons_dir = os.path.join(public_dir, "icons")
    if os.path.exists(icons_dir):
        for icon in ["apple-touch-icon.png", "icon-192.png", "icon-512.png", "logo-512.png"]:
            p = os.path.join(icons_dir, icon)
            if os.path.exists(p):
                shutil.copy2(p, os.path.join(logos_dir, icon))

    # Screenshots
    screenshots_src = os.path.join(PROJECT_ROOT, "docs", "screenshots")
    if os.path.exists(screenshots_src):
        for item in os.listdir(screenshots_src):
            if item.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                shutil.copy2(os.path.join(screenshots_src, item), os.path.join(capturas_dir, item))
        print("  [OK] Capturas oficiales y mockups copiados a Capturas_Oficiales/")

    # 3. Create Master Executive Index (README.md & 00_INDICE_MAESTRO_CORPORATIVO.html)
    index_md = f"""# NutriFit Enterprise · Repositorio Corporativo y Legal

**Organización:** NutriFit Global  
**Contacto Oficial:** nutrifit@trujillomingorance.com  
**Soporte Técnico:** soporte@trujillomingorance.com  
**Plataforma Web:** [https://nutri.trujillomingorance.com](https://nutri.trujillomingorance.com)  
**Portal de Recursos:** [https://nutri.trujillomingorance.com/recursos](https://nutri.trujillomingorance.com/recursos)  
**Fecha de Publicación:** {datetime.now().strftime('%d/%m/%Y')}  

---

## Estructura de Documentación Corporativa

Este repositorio contiene la totalidad de la documentación legal, estratégica, técnica y de marca de NutriFit organizada conforme a estándares empresariales internacionales.

### 1. Legal y Cumplimiento (`01_Legal_y_Cumplimiento/`)
- **Términos y Condiciones de Servicio:** Marco contractual de uso de la plataforma, licencias y obligaciones de las partes.
- **Política de Privacidad y RGPD:** Cumplimiento íntegro del Reglamento General de Protección de Datos (UE 2016/679) y LOPDGDD 3/2018.
- **Acuerdo de Procesamiento de Datos (DPA):** Términos de encargo de tratamiento para usuarios corporativos y profesionales de la nutrición.
- **Acuerdo de Nivel de Servicio (SLA):** Compromiso de disponibilidad del 99.9%, ventanas de mantenimiento y soporte de incidencias.

### 2. Corporativo y Estrategia (`02_Corporativo_y_Estrategia/`)
- **Dossier Corporativo NutriFit:** Visión, misión, ventajas competitivas, modelo de negocio e impacto en el sector HealthTech.
- **Checklist de Lanzamiento y Operaciones:** Protocolos de validación previa al lanzamiento y rutinas de auditoría operativa.

### 3. Seguridad y Arquitectura (`03_Seguridad_y_Arquitectura/`)
- **Seguridad, Cifrado y Arquitectura Local-First:** Mecanismos de cifrado AES-256 en reposo, firmas HMAC-SHA256 y sincronización zero-knowledge.
- **Arquitectura Backend Cloudflare Workers:** Microservicios serverless, bases de datos perimetrales Turso (libsql/D1) e integración Brevo.
- **Arquitectura Frontend y PWA:** Single Page Application (React 19 + TypeScript + Tailwind CSS), almacenamiento local IndexedDB (Dexie).
- **Distribución Android (TWA / APK):** Empaquetado nativo mediante Trusted Web Activity y firma de paquetes para Google Play.
- **Guía de Setup, Git y Despliegue:** Integración continua, control de versiones y entornos de preproducción.

### 4. Marca y Activos Visuales (`04_Marca_y_Activos_Visuales/`)
- **Directrices de Identidad de Marca:** Paleta cromática corporativa, tipografía oficial, zonas de protección del imagotipo y tono de comunicación.
- **Directorio `Logos/`:** Logotipos oficiales en formato vectorial SVG y mapa de bits PNG en resoluciones estándar y alta definición.
- **Directorio `Capturas_Oficiales/`:** Material gráfico oficial para prensa, inversores y tiendas de aplicaciones móviles.

---

> Cada documento se encuentra disponible tanto en formato Markdown (`.md`) para control de versiones técnico, como en formato HTML corporativo maquetado (`.html`) para lectura ejecutiva inmediata.
"""

    index_md_path = os.path.join(DRIVE_ROOT, "README.md")
    with open(index_md_path, 'w', encoding='utf-8') as f:
        f.write(index_md)

    index_html_path = os.path.join(DRIVE_ROOT, "00_INDICE_MAESTRO_CORPORATIVO.html")
    with open(index_html_path, 'w', encoding='utf-8') as f:
        f.write(markdown_to_html(index_md, "Índice Maestro Corporativo"))

    print("\n[OK] Índice maestro README.md y 00_INDICE_MAESTRO_CORPORATIVO.html generados.")
    print("[OK] Todos los documentos, activos y carpetas han sido subidos a Google Drive con éxito.")

if __name__ == "__main__":
    main()
