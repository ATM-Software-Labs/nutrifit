"""Genera los ficheros de carga del catálogo de Supabase (JSONL, una fila por línea).
  python3 generar_catalogo.py <off_eu.jsonl> <genericos.jsonl> <salida_dir> [max_off]
Fuentes: Open Food Facts (ODbL), USDA FoodData Central (CC0), CIQUAL (Etalab 2.0) y
la tabla de ingredientes de NutriFit (ingredientes.py, valores medios BEDCA/USDA)."""
import json, re, sys, os, unicodedata
sys.path.insert(0, os.path.dirname(__file__))
from ingredientes import I
from recetas import todas

off_path, gen_path, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
MAX_OFF = int(sys.argv[4]) if len(sys.argv) > 4 else 300_000
os.makedirs(out_dir, exist_ok=True)

def norm(t):
    t = unicodedata.normalize('NFD', (t or '').lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn').replace('ñ', 'n')
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]+', ' ', t)).strip()

r1 = lambda x: None if x is None else round(float(x), 1)
def rng(x, lo, hi):
    return r1(x) if x is not None and lo <= x <= hi else None

# ---------------------------------------------------------------- OFF (Spain/EU)
filas = []
for l in open(off_path, encoding='utf-8'):
    o = json.loads(l)
    pri = 0 if any(p in ('es', 'pt', 'ad') for p in o['pa']) else 1
    filas.append((pri, -(o.get('co') or 0), o))
filas.sort(key=lambda x: (x[0], x[1]))
vistos = set(); n_off = 0
with open(f'{out_dir}/alimentos_off.jsonl', 'w', encoding='utf-8') as f:
    for pri, _, o in filas:
        if n_off >= MAX_OFF: break
        if o['code'] in vistos: continue
        vistos.add(o['code'])
        q = (o.get('q') or '').lower()
        ml = bool(re.search(r'\d\s*(ml|cl|l)\b', q))
        f.write(json.dumps({
            'clave': f"ean:{o['code']}", 'codigo_barras': o['code'], 'nombre': o['n'][:160], 'marca': (o.get('b') or None) and o['b'][:80],
            'categoria': o.get('cat') or None, 'unidad': 'ml' if ml else 'g',
            'kcal_100': r1(o['k']), 'proteinas_100': r1(o['p']), 'carbohidratos_100': r1(o['c']), 'grasas_100': r1(o['g']),
            'azucares_100': rng(o.get('az'), 0, 100), 'saturadas_100': rng(o.get('sa'), 0, 100), 'fibra_100': rng(o.get('fi'), 0, 100), 'sal_100': rng(o.get('sl'), 0, 100),
            'envase': rng(o.get('pq'), 1, 10000), 'porcion': rng(o.get('sq'), 1, 2000), 'fuente': 'openfoodfacts', 'completitud': round(o.get('co') or 0, 3),
        }, ensure_ascii=False) + '\n')
        n_off += 1

# ---------------------------------------------------------------- genéricos USDA/CIQUAL (ya traducidos al español)
CATS = ['Frutas', 'Verduras', 'Dulces y snacks', 'Legumbres', 'Cereales y pan', 'Lácteos', 'Aceites y grasas', 'Huevos', 'Carnes', 'Embutidos', 'Pescados y mariscos',
        'Frutos secos', 'Salsas y condimentos', 'Platos', 'Bebidas', 'Suplementos', 'Patatas y tubérculos', 'Especias y hierbas']
n_gen = 0
with open(f'{out_dir}/alimentos_genericos.jsonl', 'w', encoding='utf-8') as f:
    claves = set()
    for l in open(gen_path, encoding='utf-8'):
        g = json.loads(l)
        if not g.get('traducido') or g['kcal'] is None or not (0 <= g['kcal'] <= 950): continue
        fuente = 'ciqual' if g['fuente'] == 'ciqual' else 'usda'
        clave = f"{g['fuente']}:{g['fuente_id']}"
        if clave in claves: continue
        claves.add(clave)
        f.write(json.dumps({
            'clave': clave, 'codigo_barras': None, 'nombre': g['nombre'][:160], 'nombre_orig': g.get('nombre_orig'), 'marca': None,
            'categoria': CATS[g['categoria']] if isinstance(g['categoria'], int) and 0 <= g['categoria'] < len(CATS) else None, 'unidad': 'ml' if g['categoria'] == 14 else 'g',
            'kcal_100': r1(g['kcal']), 'proteinas_100': rng(g['proteinas'], 0, 100) or 0, 'carbohidratos_100': rng(g['carbohidratos'], 0, 100) or 0, 'grasas_100': rng(g['grasas'], 0, 100) or 0,
            'azucares_100': rng(g.get('azucares'), 0, 100), 'saturadas_100': rng(g.get('saturadas'), 0, 100), 'fibra_100': rng(g.get('fibra'), 0, 100), 'sal_100': rng(g.get('sal'), 0, 100),
            'envase': None, 'porcion': rng(g.get('porcion'), 1, 2000), 'fuente': fuente, 'completitud': None,
        }, ensure_ascii=False) + '\n')
        n_gen += 1
    for nombre, (k, p, c, gr, fi) in I.items():
        if nombre in ('sal', 'agua de cocción') or k == 0 and p == 0: continue
        f.write(json.dumps({
            'clave': f'nf:{norm(nombre)}', 'codigo_barras': None, 'nombre': nombre[0].upper() + nombre[1:], 'nombre_orig': None, 'marca': None, 'categoria': 'Ingrediente',
            'unidad': 'g', 'kcal_100': k, 'proteinas_100': p, 'carbohidratos_100': c, 'grasas_100': gr, 'azucares_100': None, 'saturadas_100': None, 'fibra_100': fi, 'sal_100': None,
            'envase': None, 'porcion': None, 'fuente': 'nutrifit', 'completitud': None,
        }, ensure_ascii=False) + '\n')
        n_gen += 1

# ---------------------------------------------------------------- platos / recetas
FUENTES = 'Ingredientes: valores medios BEDCA y USDA FoodData Central SR Legacy (por 100 g); receta y cálculo NutriFit'
n_com = 0
with open(f'{out_dir}/comidas.jsonl', 'w', encoding='utf-8') as f:
    for nombre, emoji, cat, ing in todas():
        items, tot = [], dict(kcal=0, p=0, c=0, g=0, fi=0, peso=0)
        for ni, gramos in ing:
            if gramos <= 0: continue
            k, p, c, gr, fi = I[ni]
            q = gramos / 100
            items.append({'nombre': ni, 'gramos': gramos, 'kcal': round(k * q, 1), 'proteinas': round(p * q, 1), 'carbohidratos': round(c * q, 1), 'grasas': round(gr * q, 1)})
            tot['kcal'] += k * q; tot['p'] += p * q; tot['c'] += c * q; tot['g'] += gr * q; tot['fi'] += fi * q; tot['peso'] += gramos
        peso = tot['peso']
        if peso <= 0: continue
        nn = norm(nombre)[:80]
        f.write(json.dumps({
            'nombre_norm': nn, 'nombre': nombre[:80], 'emoji': emoji, 'categoria': cat, 'porcion_g': round(peso),
            'kcal': round(tot['kcal']), 'proteinas': round(tot['p'], 1), 'carbohidratos': round(tot['c'], 1), 'grasas': round(tot['g'], 1),
            'kcal_100': round(tot['kcal'] * 100 / peso, 1), 'proteinas_100': round(tot['p'] * 100 / peso, 1), 'carbohidratos_100': round(tot['c'] * 100 / peso, 1),
            'grasas_100': round(tot['g'] * 100 / peso, 1), 'fibra_100': round(tot['fi'] * 100 / peso, 1), 'ingredientes': items,
            'cantidad': 1, 'unidad': 'racion', 'fuente': 'receta', 'fuentes_datos': FUENTES, 'usos': 0,
        }, ensure_ascii=False) + '\n')
        n_com += 1
print(json.dumps({'off': n_off, 'genericos': n_gen, 'comidas': n_com}))
