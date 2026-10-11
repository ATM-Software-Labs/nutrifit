import os
import re
import glob
import shutil
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

PROJECT_ROOT = r"C:\Users\Alberto\projects\nutrifit"

def find_drive_target():
    candidates = [
        r"G:\My Drive\NutriFit Enterprise",
    ]
    # Check shortcut targets in G:
    targets = glob.glob(r"G:\.shortcut-targets-by-id\*\NutriFit Enterprise")
    if targets and os.path.isdir(targets[0]):
        return targets[0]
    for c in candidates:
        if os.path.isdir(c):
            return c
    # Fallback create in G:\My Drive\NutriFit Enterprise
    fallback = r"G:\My Drive\NutriFit Enterprise"
    os.makedirs(fallback, exist_ok=True)
    return fallback

DOCS_MAPPING = {
    "01_Legal_y_Cumplimiento": [
        ("02_TERMINOS_Y_CONDICIONES_SERVICIO.md", "01_Terminos_y_Condiciones_de_Servicio.docx", "Términos y Condiciones de Servicio"),
        ("03_POLITICA_PRIVACIDAD_Y_RGPD.md", "02_Politica_de_Privacidad_y_RGPD.docx", "Política de Privacidad y Cumplimiento RGPD"),
        ("04_ACUERDO_PROCESAMIENTO_DATOS_DPA.md", "03_Acuerdo_de_Procesamiento_de_Datos_DPA.docx", "Acuerdo de Procesamiento de Datos (DPA)"),
        ("06_ACUERDO_NIVEL_SERVICIO_SLA.md", "04_Acuerdo_de_Nivel_de_Servicio_SLA.docx", "Acuerdo de Nivel de Servicio (SLA)"),
    ],
    "02_Corporativo_y_Estrategia": [
        ("01_DOSSIER_CORPORATIVO_NUTRIFIT.md", "01_Dossier_Corporativo_NutriFit.docx", "Dossier Corporativo e Información General"),
        (os.path.join("..", "CHECKLIST-LANZAMIENTO.md"), "02_Checklist_Lanzamiento_y_Operaciones.docx", "Checklist de Lanzamiento y Protocolos Operativos"),
    ],
    "03_Seguridad_y_Arquitectura": [
        ("05_SEGURIDAD_CIFRADO_ARQUITECTURA_LOCAL_FIRST.md", "01_Seguridad_Cifrado_y_Arquitectura_Local_First.docx", "Seguridad, Cifrado y Arquitectura Local-First"),
        (os.path.join("..", "BACKEND.md"), "02_Arquitectura_Backend_Cloudflare_Workers.docx", "Arquitectura Backend, Workers y Base de Datos"),
        (os.path.join("..", "FRONTEND.md"), "03_Arquitectura_Frontend_y_PWA.docx", "Arquitectura Frontend, PWA e IndexedDB"),
        (os.path.join("..", "ANDROID.md"), "04_Distribucion_Android_TWA_APK.docx", "Distribución Android, TWA y Paquetes APK"),
        (os.path.join("..", "SETUP-git-y-despliegue.md"), "05_Guia_Setup_Git_y_Despliegue.docx", "Guía de Setup, Git y Despliegue Continuo"),
    ],
    "04_Marca_y_Activos_Visuales": [
        ("07_DIRECTRICES_MARCA_Y_RECURSOS.md", "01_Directrices_de_Identidad_de_Marca.docx", "Directrices de Identidad de Marca y Recursos"),
    ]
}

def set_cell_background(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=180, right=180):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def add_inline_runs(paragraph, text, base_color=RGBColor(51, 65, 85)):
    # Simple markdown inline tokenizer for **bold**, *italic*, `code`, and [link](url)
    tokens = re.split(r'(\*\*.+?\*\*|\*.+?\*|`.+?`|\[.+?\]\(.+?\))', text)
    for token in tokens:
        if not token:
            continue
        if token.startswith('**') and token.endswith('**') and len(token) > 4:
            run = paragraph.add_run(token[2:-2])
            run.bold = True
            run.font.color.rgb = RGBColor(15, 23, 42)
        elif token.startswith('*') and token.endswith('*') and len(token) > 2:
            run = paragraph.add_run(token[1:-1])
            run.italic = True
            run.font.color.rgb = base_color
        elif token.startswith('`') and token.endswith('`') and len(token) > 2:
            run = paragraph.add_run(token[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(15, 23, 42)
        elif token.startswith('[') and ']' in token and '(' in token and token.endswith(')'):
            m = re.match(r'\[(.+?)\]\((.+?)\)', token)
            if m:
                run = paragraph.add_run(m.group(1))
                run.font.color.rgb = RGBColor(5, 150, 105) # Emerald
                run.underline = True
            else:
                run = paragraph.add_run(token)
                run.font.color.rgb = base_color
        else:
            run = paragraph.add_run(token)
            run.font.color.rgb = base_color

def convert_markdown_to_docx(md_content, title, output_path):
    doc = docx.Document()

    # Set page margins (1 inch)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        # Header / Footer
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("NutriFit Enterprise · Documento Oficial")
        hrun.font.name = "Arial"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(148, 163, 184)

        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        frun = fp.add_run("NutriFit Enterprise · nutrifit@trujillomingorance.com · https://nutri.trujillomingorance.com")
        frun.font.name = "Arial"
        frun.font.size = Pt(8.5)
        frun.font.color.rgb = RGBColor(148, 163, 184)

    # Document Header Badge
    badge_p = doc.add_paragraph()
    badge_p.paragraph_format.space_before = Pt(0)
    badge_p.paragraph_format.space_after = Pt(4)
    run_badge = badge_p.add_run("NUTRIFIT GLOBAL · GESTIÓN CORPORATIVA & LEGAL")
    run_badge.font.name = "Arial"
    run_badge.font.size = Pt(9)
    run_badge.font.bold = True
    run_badge.font.color.rgb = RGBColor(5, 150, 105)

    # Document Main Title
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(4)
    title_p.paragraph_format.space_after = Pt(12)
    run_title = title_p.add_run(title)
    run_title.font.name = "Arial"
    run_title.font.size = Pt(22)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(15, 23, 42)

    # Metadata Box (Table 2x2)
    meta_table = doc.add_table(rows=2, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        [("Organización:", " NutriFit Enterprise"), ("Contacto:", " nutrifit@trujillomingorance.com")],
        [("Clasificación:", " Documentación Oficial"), ("Sede:", " Barcelona, España")]
    ]
    for row_idx, row_content in enumerate(meta_data):
        for col_idx, (k, v) in enumerate(row_content):
            cell = meta_table.cell(row_idx, col_idx)
            set_cell_background(cell, "F8FAFC")
            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            rk = p.add_run(k)
            rk.font.name = "Arial"
            rk.font.size = Pt(9)
            rk.font.bold = True
            rk.font.color.rgb = RGBColor(71, 85, 105)
            rv = p.add_run(v)
            rv.font.name = "Arial"
            rv.font.size = Pt(9)
            rv.font.color.rgb = RGBColor(15, 23, 42)

    # Divider space
    sep_p = doc.add_paragraph()
    sep_p.paragraph_format.space_before = Pt(12)
    sep_p.paragraph_format.space_after = Pt(6)

    # Parse body
    lines = md_content.split('\n')
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        stripped = line.strip()

        if not stripped:
            idx += 1
            continue

        # Skip main markdown H1 if identical or redundant with title
        if stripped.startswith('# '):
            text = stripped[2:].strip()
            if text.lower() != title.lower():
                h = doc.add_paragraph()
                h.paragraph_format.space_before = Pt(20)
                h.paragraph_format.space_after = Pt(8)
                h.paragraph_format.keep_with_next = True
                run = h.add_run(text)
                run.font.name = "Arial"
                run.font.size = Pt(17)
                run.font.bold = True
                run.font.color.rgb = RGBColor(15, 23, 42)
            idx += 1
            continue

        if stripped.startswith('## '):
            text = stripped[3:].strip()
            h = doc.add_paragraph()
            h.paragraph_format.space_before = Pt(16)
            h.paragraph_format.space_after = Pt(6)
            h.paragraph_format.keep_with_next = True
            run = h.add_run(text)
            run.font.name = "Arial"
            run.font.size = Pt(13.5)
            run.font.bold = True
            run.font.color.rgb = RGBColor(5, 150, 105) # Emerald
            idx += 1
            continue

        if stripped.startswith('### '):
            text = stripped[4:].strip()
            h = doc.add_paragraph()
            h.paragraph_format.space_before = Pt(12)
            h.paragraph_format.space_after = Pt(4)
            h.paragraph_format.keep_with_next = True
            run = h.add_run(text)
            run.font.name = "Arial"
            run.font.size = Pt(11.5)
            run.font.bold = True
            run.font.color.rgb = RGBColor(30, 41, 59)
            idx += 1
            continue

        if stripped.startswith('#### '):
            text = stripped[5:].strip()
            h = doc.add_paragraph()
            h.paragraph_format.space_before = Pt(10)
            h.paragraph_format.space_after = Pt(3)
            h.paragraph_format.keep_with_next = True
            run = h.add_run(text)
            run.font.name = "Arial"
            run.font.size = Pt(10.5)
            run.font.bold = True
            run.font.color.rgb = RGBColor(71, 85, 105)
            idx += 1
            continue

        # Blockquote / Callout
        if stripped.startswith('> '):
            text = stripped[2:].strip()
            # Accumulate multi-line blockquotes
            while idx + 1 < len(lines) and lines[idx + 1].strip().startswith('> '):
                idx += 1
                text += " " + lines[idx].strip()[2:].strip()
            qp = doc.add_paragraph()
            qp.paragraph_format.left_indent = Inches(0.25)
            qp.paragraph_format.right_indent = Inches(0.25)
            qp.paragraph_format.space_before = Pt(8)
            qp.paragraph_format.space_after = Pt(8)
            add_inline_runs(qp, text, base_color=RGBColor(6, 95, 70))
            for r in qp.runs:
                r.italic = True
                r.font.name = "Arial"
                r.font.size = Pt(10)
            idx += 1
            continue

        # Bullet list
        if stripped.startswith('- ') or stripped.startswith('* '):
            text = stripped[2:].strip()
            lp = doc.add_paragraph(style='List Bullet')
            lp.paragraph_format.space_before = Pt(1)
            lp.paragraph_format.space_after = Pt(3)
            lp.paragraph_format.line_spacing = 1.15
            add_inline_runs(lp, text)
            for r in lp.runs:
                r.font.name = "Arial"
                r.font.size = Pt(10)
            idx += 1
            continue

        # Numbered list
        if re.match(r'^\d+\.\s+', stripped):
            text = re.sub(r'^\d+\.\s+', '', stripped)
            np = doc.add_paragraph(style='List Number')
            np.paragraph_format.space_before = Pt(1)
            np.paragraph_format.space_after = Pt(3)
            np.paragraph_format.line_spacing = 1.15
            add_inline_runs(np, text)
            for r in np.runs:
                r.font.name = "Arial"
                r.font.size = Pt(10)
            idx += 1
            continue

        # Table
        if stripped.startswith('|') and stripped.endswith('|'):
            table_lines = []
            while idx < len(lines) and lines[idx].strip().startswith('|') and lines[idx].strip().endswith('|'):
                table_lines.append(lines[idx].strip())
                idx += 1
            
            # Process table
            parsed_rows = []
            for tl in table_lines:
                cells = [c.strip() for c in tl.strip('|').split('|')]
                # Skip separator row like |:---|:---|
                if all(re.match(r'^[\:\-\s]+$', c) for c in cells if c):
                    continue
                parsed_rows.append(cells)

            if parsed_rows:
                num_cols = max(len(r) for r in parsed_rows)
                t = doc.add_table(rows=len(parsed_rows), cols=num_cols)
                t.alignment = WD_TABLE_ALIGNMENT.CENTER
                
                for r_i, row in enumerate(parsed_rows):
                    is_header = (r_i == 0)
                    for c_i in range(num_cols):
                        val = row[c_i] if c_i < len(row) else ""
                        cell = t.cell(r_i, c_i)
                        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
                        
                        if is_header:
                            set_cell_background(cell, "059669") # Emerald header
                        else:
                            if r_i % 2 == 1:
                                set_cell_background(cell, "F8FAFC") # Soft zebra
                            else:
                                set_cell_background(cell, "FFFFFF")
                                
                        cp = cell.paragraphs[0]
                        cp.paragraph_format.space_before = Pt(0)
                        cp.paragraph_format.space_after = Pt(0)
                        
                        if is_header:
                            crun = cp.add_run(val)
                            crun.font.name = "Arial"
                            crun.font.size = Pt(9.5)
                            crun.font.bold = True
                            crun.font.color.rgb = RGBColor(255, 255, 255)
                        else:
                            add_inline_runs(cp, val)
                            for r in cp.runs:
                                r.font.name = "Arial"
                                r.font.size = Pt(9)
                
                # Space after table
                post_t = doc.add_paragraph()
                post_t.paragraph_format.space_before = Pt(4)
                post_t.paragraph_format.space_after = Pt(6)
            continue

        # Code block
        if stripped.startswith('```'):
            code_lines = []
            idx += 1
            while idx < len(lines) and not lines[idx].strip().startswith('```'):
                code_lines.append(lines[idx])
                idx += 1
            if idx < len(lines) and lines[idx].strip().startswith('```'):
                idx += 1
            
            cp = doc.add_paragraph()
            cp.paragraph_format.left_indent = Inches(0.2)
            cp.paragraph_format.space_before = Pt(6)
            cp.paragraph_format.space_after = Pt(8)
            crun = cp.add_run('\n'.join(code_lines))
            crun.font.name = "Consolas"
            crun.font.size = Pt(9)
            crun.font.color.rgb = RGBColor(15, 23, 42)
            continue

        # Regular paragraph
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.2
        add_inline_runs(p, stripped)
        for r in p.runs:
            r.font.name = "Arial"
            r.font.size = Pt(10.5)
        idx += 1

    doc.save(output_path)

def main():
    target_dir = find_drive_target()
    print(f"Destino oficial de Google Drive: {target_dir}")

    legal_base_dir = os.path.join(PROJECT_ROOT, "docs", "legal")

    # 1. Clean previous .html and .md files in the drive directory
    print("\nLimpiando archivos .html y .md incompatibles de Google Drive...")
    for root, dirs, files in os.walk(target_dir):
        # Don't touch Logos or Capturas_Oficiales
        for f in files:
            if f.endswith(('.html', '.md')):
                full_path = os.path.join(root, f)
                try:
                    os.remove(full_path)
                    print(f"  - Eliminado formato no compatible: {os.path.basename(full_path)}")
                except Exception as e:
                    print(f"  [AVISO] No se pudo eliminar {full_path}: {e}")

    # 2. Generate .docx documents
    print("\nGenerando documentos nativos de Word / Google Docs (.docx)...")
    doc_entries = []

    for category, files in DOCS_MAPPING.items():
        cat_dir = os.path.join(target_dir, category)
        os.makedirs(cat_dir, exist_ok=True)
        print(f"\n[Categoria] {category}")

        for src_name, dest_docx_name, title in files:
            src_path = os.path.normpath(os.path.join(legal_base_dir, src_name))
            if not os.path.exists(src_path):
                print(f"  [AVISO] Archivo fuente no encontrado: {src_path}")
                continue

            with open(src_path, 'r', encoding='utf-8') as f:
                md_content = f.read()

            dest_docx_path = os.path.join(cat_dir, dest_docx_name)
            convert_markdown_to_docx(md_content, title, dest_docx_path)
            print(f"  [OK] Documento creado: {dest_docx_name}")
            doc_entries.append((category, title, dest_docx_name))

    # 3. Create Master Index in Word / Google Docs (00_INDICE_MAESTRO_CORPORATIVO.docx)
    master_index_path = os.path.join(target_dir, "00_INDICE_MAESTRO_CORPORATIVO.docx")
    index_md = """# NutriFit Enterprise · Repositorio Corporativo y Legal

Bienvenido al repositorio documental oficial de **NutriFit Global** organizado conforme a los más altos estándares empresariales de gobernanza, cumplimiento RGPD, seguridad y desarrollo de software.

Todos los documentos adjuntos están en formato nativo **Microsoft Word (.docx)** y son completamente editables y visualizables con un solo clic en **Google Docs**, sin necesidad de herramientas externas ni visores de código.

---

## 1. Documentación Legal y Cumplimiento (`01_Legal_y_Cumplimiento/`)
- **01_Terminos_y_Condiciones_de_Servicio.docx:** Marco contractual de uso de la plataforma, licencias, condiciones y obligaciones de las partes.
- **02_Politica_de_Privacidad_y_RGPD.docx:** Cumplimiento íntegro del Reglamento General de Protección de Datos (UE 2016/679) y Ley Orgánica 3/2018 (LOPDGDD).
- **03_Acuerdo_de_Procesamiento_de_Datos_DPA.docx:** Términos de encargo de tratamiento de datos para usuarios corporativos y clínicas asociadas.
- **04_Acuerdo_de_Nivel_de_Servicio_SLA.docx:** Garantías de disponibilidad del 99.9%, ventanas de mantenimiento y protocolos de atención de incidencias.

---

## 2. Corporativo y Estrategia (`02_Corporativo_y_Estrategia/`)
- **01_Dossier_Corporativo_NutriFit.docx:** Misión, propuesta de valor, modelo tecnológico local-first e impacto en salud digital.
- **02_Checklist_Lanzamiento_y_Operaciones.docx:** Protocolos de aseguramiento de calidad, checklist pre-lanzamiento y auditorías operativas.

---

## 3. Seguridad y Arquitectura (`03_Seguridad_y_Arquitectura/`)
- **01_Seguridad_Cifrado_y_Arquitectura_Local_First.docx:** Cifrado en reposo AES-256, firmas HMAC-SHA256 y privacidad zero-knowledge en el dispositivo.
- **02_Arquitectura_Backend_Cloudflare_Workers.docx:** Microservicios serverless perimetrales, base de datos Turso (libsql/D1) e integración transaccional Brevo.
- **03_Arquitectura_Frontend_y_PWA.docx:** Single Page Application (React 19 + TypeScript + Tailwind CSS), almacenamiento local IndexedDB (Dexie).
- **04_Distribucion_Android_TWA_APK.docx:** Empaquetado nativo para Android mediante Trusted Web Activity y firma de APKs para Google Play.
- **05_Guia_Setup_Git_y_Despliegue.docx:** Flujo de integración continua, variables de entorno y despliegues automáticos a producción.

---

## 4. Marca y Activos Visuales (`04_Marca_y_Activos_Visuales/`)
- **01_Directrices_de_Identidad_de_Marca.docx:** Paleta cromática corporativa (Verde Esmeralda #059669 / Menta #10b981), tipografía oficial y reglas de uso del imagotipo.
- **Carpeta Logos/:** Logotipos oficiales vectoriales y en mapa de bits de alta resolución.
- **Carpeta Capturas_Oficiales/:** Material gráfico oficial para prensa, inversores y tiendas de aplicaciones.

---

> Para consultas corporativas o soporte legal: nutrifit@trujillomingorance.com / soporte@trujillomingorance.com
"""
    convert_markdown_to_docx(index_md, "Índice Maestro Corporativo", master_index_path)
    print(f"\n[OK] Índice maestro generado con éxito: 00_INDICE_MAESTRO_CORPORATIVO.docx")
    print(f"[OK] Sincronización en Google Drive completada. Todos los documentos están listos en formato Word / Google Docs.")

if __name__ == "__main__":
    main()
