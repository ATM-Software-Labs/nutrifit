#!/usr/bin/env python3
"""
Base de alimentos genéricos de NutriFit (BD D1 aparte: nutrifit-alimentos).

Fuentes (abiertas, con atribución):
  · USDA FoodData Central — Foundation Foods (2026-04) y SR Legacy (2018-04).
    U.S. Department of Agriculture, Agricultural Research Service. Dominio público (CC0 1.0).
  · Ciqual 2025 — Anses. Table de composition nutritionnelle des aliments Ciqual.
    https://ciqual.anses.fr · doi:10.57745/RDMHWY · Licence Ouverte / Etalab 2.0.

Nombres en español: los de src/data/alimentos.ts (revisados a mano) y, para el
resto, traducciones automáticas guardadas en traducciones.tsv (clave ⇥ español).
Lo que no tiene traducción se guarda con su nombre original (inglés/francés),
que sigue siendo buscable.

Uso:
  python3 construir.py pendientes   → /tmp/nfdata/pendientes.tsv (textos sin traducir)
  python3 construir.py sql          → /tmp/nfdata/sql/NNN.sql (esquema + datos por lotes)
  python3 construir.py json         → /tmp/nfdata/alimentos.json (para tests locales)
Los archivos de origen se descargan a /tmp/nfdata la primera vez.
"""
import csv, io, json, os, re, sys, unicodedata, urllib.request, zipfile

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
DATOS = '/tmp/nfdata'
os.makedirs(DATOS, exist_ok=True)

ORIGENES = {
    'sr': ('https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip', 'fdc_sr_legacy_2018-04.zip'),
    'fnd': ('https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip', 'foundation.zip'),
    'ciqual': ('https://entrepot.recherche.data.gouv.fr/api/access/datafile/:persistentId?persistentId=doi:10.57745/RPWYZD', 'ciqual2025.xlsx'),
}


def archivo(clave):
    url, nombre = ORIGENES[clave]
    ruta = os.path.join(DATOS, nombre)
    if not os.path.exists(ruta):
        print('descargando', url, file=sys.stderr)
        req = urllib.request.Request(url, headers={'User-Agent': 'NutriFit/1.0 (soporte@trujillomingorance.com)'})
        with urllib.request.urlopen(req) as r, open(ruta, 'wb') as f:
            f.write(r.read())
    return ruta


def leer_zip(ruta, nombre):
    z = zipfile.ZipFile(ruta)
    n = next(x for x in z.namelist() if x.endswith('/' + nombre))
    return csv.DictReader(io.TextIOWrapper(z.open(n), 'utf-8'))


def r1(x):
    return None if x is None else round(float(x), 1)


def normalizar(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


# --------------------------------------------------------------- categorías
CATEGORIAS = ['Frutas', 'Verduras', 'Dulces y snacks', 'Legumbres', 'Cereales y pan', 'Lácteos', 'Aceites y grasas', 'Huevos', 'Carnes',
              'Embutidos', 'Pescados y mariscos', 'Frutos secos', 'Salsas y condimentos', 'Platos', 'Bebidas', 'Suplementos',
              'Patatas y tubérculos', 'Especias y hierbas']
C = {n: i for i, n in enumerate(CATEGORIAS)}

CAT_USDA = {
    'Fruits and Fruit Juices': 'Frutas', 'Vegetables and Vegetable Products': 'Verduras', 'Sweets': 'Dulces y snacks', 'Snacks': 'Dulces y snacks',
    'Legumes and Legume Products': 'Legumbres', 'Baked Products': 'Cereales y pan', 'Cereal Grains and Pasta': 'Cereales y pan',
    'Breakfast Cereals': 'Cereales y pan', 'Dairy and Egg Products': 'Lácteos', 'Fats and Oils': 'Aceites y grasas', 'Beef Products': 'Carnes',
    'Pork Products': 'Carnes', 'Poultry Products': 'Carnes', 'Lamb, Veal, and Game Products': 'Carnes', 'Sausages and Luncheon Meats': 'Embutidos',
    'Finfish and Shellfish Products': 'Pescados y mariscos', 'Nut and Seed Products': 'Frutos secos', 'Soups, Sauces, and Gravies': 'Salsas y condimentos',
    'Meals, Entrees, and Side Dishes': 'Platos', 'Beverages': 'Bebidas', 'Spices and Herbs': 'Especias y hierbas',
}
EXCLUIR_USDA = {'Baby Foods', 'Fast Foods', 'Restaurant Foods', 'American Indian/Alaska Native Foods'}


def cat_ciqual(grp, sub):
    g, s = grp or '', sub or ''
    if 'infantiles' in g:
        return None
    reglas = [
        ('fruits à coque', 'Frutos secos'), ('légumineuses', 'Legumbres'), ('pommes de terre', 'Patatas y tubérculos'), ('légumes', 'Verduras'),
        ('fruits', 'Frutas'), ('oeufs', 'Huevos'), ('charcuteries', 'Embutidos'), ('poisson', 'Pescados y mariscos'), ('mollusques', 'Pescados y mariscos'),
        ('viandes', 'Carnes'), ('fromages', 'Lácteos'), ('laits', 'Lácteos'), ('laitiers', 'Lácteos'), ('crèmes', 'Lácteos'),
        ('herbes', 'Especias y hierbas'), ('épices', 'Especias y hierbas'), ('sauces', 'Salsas y condimentos'), ('condiments', 'Salsas y condimentos'),
        ('sels', 'Salsas y condimentos'), ('aides culinaires', 'Salsas y condimentos'), ('algues', 'Verduras'), ('végétariens', 'Platos'),
        ('denrées', 'Suplementos'), ('boisson', 'Bebidas'), ('eaux', 'Bebidas'), ('matières grasses', 'Aceites y grasas'), ('beurres', 'Aceites y grasas'),
        ('huiles', 'Aceites y grasas'), ('margarines', 'Aceites y grasas'), ('céréales de petit', 'Cereales y pan'), ('biscuits apéritifs', 'Dulces y snacks'),
        ('produits céréaliers', 'Cereales y pan'), ('glaces', 'Dulces y snacks'), ('produits sucrés', 'Dulces y snacks'), ('plats', 'Platos'),
        ('entrées', 'Platos'), ('soupes', 'Platos'), ('sandwichs', 'Platos'), ('pizzas', 'Platos'), ('salades', 'Platos'),
    ]
    for clave, cat in reglas:
        if clave in s:
            return cat
    for clave, cat in reglas:
        if clave in g:
            return cat
    return 'Platos'


# ------------------------------------------------------ sinónimos en español
# Se añaden a la columna «sinonimos» (buscable) si el nombre contiene la clave.
SINONIMOS = [
    ('platano', 'banana'), ('banana', 'platano'), ('patata', 'papa'), ('patatas', 'papas'), ('melocoton', 'durazno'), ('zumo', 'jugo'),
    ('gamba', 'camaron langostino'), ('langostino', 'gamba camaron'), ('judias verdes', 'ejotes vainas'), ('maiz', 'choclo elote'),
    ('aguacate', 'palta'), ('fresa', 'frutilla'), ('alubia', 'judia frijol'), ('judia blanca', 'alubia frijol'), ('guisante', 'arveja chicharo'),
    ('calabacin', 'zucchini'), ('remolacha', 'betabel'), ('nata', 'crema de leche'), ('bacon', 'beicon panceta'), ('beicon', 'bacon panceta'),
    ('pimiento', 'aji morron'), ('cacahuete', 'mani'), ('albaricoque', 'damasco'), ('pomelo', 'toronja'), ('frijol', 'alubia judia'),
    ('garbanzo', 'chickpea'), ('lenteja', 'lentil'), ('atun', 'tuna'), ('pollo', 'chicken'), ('ternera', 'vacuno res'), ('vacuno', 'ternera res'),
    ('cerdo', 'porcino chancho'), ('azucar', 'sugar'), ('mantequilla', 'manteca butter'), ('hamburguesa', 'burger'), ('refresco', 'soda gaseosa'),
    ('yogur', 'yogurt yoghurt'), ('pan de molde', 'pan lactal sandwich'), ('magdalena', 'muffin'), ('bizcocho', 'pastel queque'),
    ('requeson', 'ricotta'), ('calabaza', 'zapallo auyama'), ('boniato', 'batata camote'), ('batata', 'boniato camote'), ('chirimoya', 'anona'),
    ('pechuga', 'filete'), ('merluza', 'pescadilla'), ('pescadilla', 'merluza'), ('mejillon', 'choro'), ('berenjena', 'aubergine'),
    ('col ', 'repollo berza'), ('repollo', 'col berza'), ('lechuga', 'ensalada'), ('fideo', 'pasta'), ('macarron', 'pasta'), ('espagueti', 'pasta spaghetti'),
    ('sandia', 'patilla'), ('pina', 'anana'), ('cerveza', 'birra'), ('tomate', 'jitomate'), ('huevo', 'egg'),
]


def sinonimos(nombre):
    n = ' ' + normalizar(nombre) + ' '
    extra = []
    for clave, alias in SINONIMOS:
        if (' ' + clave) in n:
            extra.append(alias)
    return ' '.join(dict.fromkeys(' '.join(extra).split()))


# ----------------------------------------------------------- traducciones
def cargar_traducciones():
    t = {}
    ruta = os.path.join(AQUI, 'traducciones.tsv')
    if os.path.exists(ruta):
        for linea in open(ruta, encoding='utf-8'):
            if '\t' in linea and not linea.startswith('#'):
                k, v = linea.rstrip('\n').split('\t', 1)
                if v.strip():
                    t[k] = v.strip()
    return t


def cargar_locales():
    """Nombres revisados a mano de src/data/alimentos.ts → {fdcId: (nombre, racion)}."""
    s = open(os.path.join(RAIZ, 'src', 'data', 'alimentos.ts'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r'\["([^"]+)",(\d+),[\d.]+,[\d.]+,[\d.]+,[\d.]+,([\d.]+),(\d+)\]', s):
        out.setdefault(m.group(4), (m.group(1), float(m.group(3))))
    return out


# -------------------------------------------------------------------- USDA
NUT = {'1008': 'kcal', '2048': 'kcal2', '2047': 'kcal3', '1003': 'p', '1004': 'g', '1085': 'g2', '1005': 'c', '1050': 'c2',
       '2000': 'az', '1063': 'az2', '1079': 'fibra', '1258': 'sat', '1093': 'na'}
UNIDADES_FUERA = re.compile(r'^(oz|lb|fl oz|cubic inch|quart|pint|gallon|gal|kg|g|ml|liter|l)\b|yield|refuse|nlea serving|\(.*oz.*\)', re.I)


def nutrientes_usda(ruta, ids):
    v = {}
    for r in leer_zip(ruta, 'food_nutrient.csv'):
        k = NUT.get(r['nutrient_id'])
        if k and r['fdc_id'] in ids:
            try:
                v.setdefault(r['fdc_id'], {})[k] = float(r['amount'])
            except ValueError:
                pass
    return v


def macros_usda(n):
    p = n.get('p')
    g = n.get('g', n.get('g2'))
    c = n.get('c', n.get('c2'))
    if p is None or g is None or c is None:
        return None
    kcal = n.get('kcal', n.get('kcal2', n.get('kcal3')))
    if kcal is None:
        kcal = 4 * p + 4 * c + 9 * g
    sal = n['na'] * 2.5 / 1000 if 'na' in n else None
    return dict(kcal=r1(kcal), p=r1(p), c=r1(c), g=r1(g), az=r1(n.get('az', n.get('az2'))), sat=r1(n.get('sat')), fibra=r1(n.get('fibra')), sal=r1(sal))


def porciones_usda(ruta, ids, unidades=None):
    mu = {r['id']: r['name'] for r in leer_zip(ruta, 'measure_unit.csv')}
    out = {}
    for r in leer_zip(ruta, 'food_portion.csv'):
        if r['fdc_id'] not in ids:
            continue
        try:
            cant, gr = float(r['amount'] or 1), float(r['gram_weight'])
        except ValueError:
            continue
        if cant <= 0 or gr <= 0:
            continue
        unidad = mu.get(r['measure_unit_id'], 'undetermined')
        mod = (r.get('modifier') or '').strip()
        desc = (r.get('portion_description') or '').strip()
        texto = mod if unidad == 'undetermined' else ' '.join(x for x in [unidad, mod] if x)
        if not texto and desc:
            texto = desc
        texto = re.sub(r'\s+', ' ', texto).strip()
        if not texto or UNIDADES_FUERA.search(texto) or len(texto) > 70:
            continue
        g1 = gr / cant
        if g1 < 1 or g1 > 2500:
            continue
        out.setdefault(r['fdc_id'], []).append((texto, round(g1, 1)))
    # sin duplicados, máx. 6 por alimento
    return {k: list(dict.fromkeys(v))[:6] for k, v in out.items()}


MARCA = re.compile(r"\b[A-Z][A-Z'&\.]{2,}\b")


def usda():
    sr, fnd = archivo('sr'), archivo('fnd')
    cat_sr = {r['id']: r['description'] for r in leer_zip(sr, 'food_category.csv')}
    cat_fn = {r['id']: r['description'] for r in leer_zip(fnd, 'food_category.csv')}
    filas = []
    vistos = set()
    f_fnd = [f for f in leer_zip(fnd, 'food.csv') if f['data_type'] == 'foundation_food']
    ids = {f['fdc_id'] for f in f_fnd}
    nut = nutrientes_usda(fnd, ids)
    por = porciones_usda(fnd, ids)
    for f in f_fnd:
        cat = CAT_USDA.get(cat_fn.get(f['food_category_id'], ''))
        m = macros_usda(nut.get(f['fdc_id'], {}))
        if not cat or not m:
            continue
        vistos.add(f['description'].lower())
        filas.append(dict(fuente='usda-fnd', fid=f['fdc_id'], orig=f['description'], cat=cat, porciones=por.get(f['fdc_id'], []), **m))
    f_sr = [f for f in leer_zip(sr, 'food.csv') if cat_sr.get(f['food_category_id']) not in EXCLUIR_USDA]
    f_sr = [f for f in f_sr if not MARCA.search(f['description'].replace('NFS', '')) and f['description'].lower() not in vistos]
    ids = {f['fdc_id'] for f in f_sr}
    nut = nutrientes_usda(sr, ids)
    por = porciones_usda(sr, ids)
    for f in f_sr:
        cat = CAT_USDA.get(cat_sr.get(f['food_category_id'], ''))
        m = macros_usda(nut.get(f['fdc_id'], {}))
        if not cat or not m:
            continue
        filas.append(dict(fuente='usda-sr', fid=f['fdc_id'], orig=f['description'], cat=cat, porciones=por.get(f['fdc_id'], []),
                          usda_cat=cat_sr.get(f['food_category_id'], ''), **m))
    return filas


def a_traducir_usda(f):
    """¿Merece nombre en español? (los ~3 000 más habituales)."""
    d = f['orig']
    if f['fuente'] == 'usda-fnd':
        return True
    if d.count(',') <= 3 and len(d) <= 60:
        return True
    if f.get('usda_cat') in ('Beef Products', 'Pork Products', 'Poultry Products', 'Lamb, Veal, and Game Products', 'Breakfast Cereals'):
        return d.count(',') <= 5 and len(d) <= 80 and not re.search(r'trimmed to 1/4|select|prime|imported|new zealand|australian', d, re.I)
    return False


# ------------------------------------------------------------------ Ciqual
def num_ciqual(v):
    if v is None:
        return None
    s = str(v).strip().replace(',', '.')
    if s in ('-', ''):
        return None
    if s.startswith('<') or s.lower() == 'traces':
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


def ciqual():
    import openpyxl, warnings
    warnings.filterwarnings('ignore')
    wb = openpyxl.load_workbook(archivo('ciqual'), read_only=True)
    ws = wb.worksheets[0]
    filas = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        nombre = re.sub(r'\s+', ' ', str(row[7] or '')).strip()
        cat = cat_ciqual((row[3] or '').replace('\n', ' '), (row[4] or '').replace('\n', ' '))
        if not nombre or not cat or 'aliment moyen' in nombre.lower():
            continue
        kcal, p, c, g = (num_ciqual(row[k]) for k in (10, 14, 16, 17))
        if p is None or c is None or g is None:
            continue
        if kcal is None:
            kcal = 4 * p + 4 * c + 9 * g
        filas.append(dict(fuente='ciqual', fid=str(row[6]), orig=nombre, cat=cat, porciones=[], kcal=r1(kcal), p=r1(p), c=r1(c), g=r1(g),
                          az=r1(num_ciqual(row[18])), sat=r1(num_ciqual(row[31])), fibra=r1(num_ciqual(row[26])), sal=r1(num_ciqual(row[51]))))
    return filas


# ------------------------------------------------------------------- todo
def construir():
    trad = cargar_traducciones()
    locales = cargar_locales()
    filas = usda() + ciqual()
    pendientes = []
    for f in filas:
        k = ('usda:' if f['fuente'].startswith('usda') else 'ciqual:') + f['fid']
        f['clave'] = k
        f['prioridad'] = 0
        if f['fuente'].startswith('usda') and f['fid'] in locales:
            f['nombre'], racion = locales[f['fid']]
            f['traducido'] = 2
            f['prioridad'] = 3
            f['porciones'] = [('ración', racion)] + f['porciones']
        elif k in trad:
            f['nombre'] = trad[k]
            f['traducido'] = 1
            f['prioridad'] = 2 if f['fuente'] == 'ciqual' else 1
        else:
            f['nombre'] = f['orig']
            f['traducido'] = 0
            if f['fuente'] == 'ciqual' or a_traducir_usda(f):
                pendientes.append((k, 'fr' if f['fuente'] == 'ciqual' else 'en', f['orig']))
        # porciones en español
        nuevas = []
        for texto, g in f['porciones']:
            if texto == 'ración':
                nuevas.append((texto, g))
                continue
            kp = 'por:' + texto.lower()
            if kp in trad:
                nuevas.append((trad[kp], g))
            elif f['traducido']:
                pendientes.append((kp, 'en', texto.lower()))
        f['porciones'] = list(dict.fromkeys(nuevas))[:6]
        f['sinonimos'] = sinonimos(f['nombre']) if f['traducido'] else ''
    vistos = set()
    pendientes = [p for p in pendientes if not (p[0] in vistos or vistos.add(p[0]))]
    return filas, pendientes


def sql_texto(s):
    return 'NULL' if s is None else "'" + str(s).replace("'", "''") + "'"


def sql_num(x):
    return 'NULL' if x is None else repr(float(x)).rstrip('0').rstrip('.') if '.' in repr(float(x)) else repr(x)


ESQUEMA = """-- BD nutrifit-alimentos (datos de referencia; se regenera con scripts/alimentos-db/construir.py)
DROP TABLE IF EXISTS alimentos_fts;
DROP TABLE IF EXISTS porciones;
DROP TABLE IF EXISTS vocabulario;
DROP TABLE IF EXISTS alimentos;
DROP TABLE IF EXISTS fuentes;
CREATE TABLE fuentes (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, licencia TEXT NOT NULL, url TEXT NOT NULL, version TEXT NOT NULL);
CREATE TABLE alimentos (
  id INTEGER PRIMARY KEY,
  fuente TEXT NOT NULL,
  fuente_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  nombre_orig TEXT NOT NULL,
  sinonimos TEXT NOT NULL DEFAULT '',
  categoria INTEGER NOT NULL,
  kcal REAL NOT NULL, proteinas REAL NOT NULL, carbohidratos REAL NOT NULL, grasas REAL NOT NULL,
  azucares REAL, saturadas REAL, fibra REAL, sal REAL,
  traducido INTEGER NOT NULL DEFAULT 0,
  prioridad INTEGER NOT NULL DEFAULT 0,
  UNIQUE (fuente, fuente_id)
);
CREATE TABLE porciones (alimento_id INTEGER NOT NULL REFERENCES alimentos(id), nombre TEXT NOT NULL, gramos REAL NOT NULL);
CREATE INDEX idx_porciones_alimento ON porciones(alimento_id);
CREATE TABLE vocabulario (termino TEXT PRIMARY KEY, n INTEGER NOT NULL) WITHOUT ROWID;
CREATE VIRTUAL TABLE alimentos_fts USING fts5(nombre, sinonimos, nombre_orig, content='alimentos', content_rowid='id', tokenize='unicode61 remove_diacritics 2');
INSERT INTO fuentes VALUES
 ('usda-fnd','USDA FoodData Central — Foundation Foods','CC0 1.0 (dominio público)','https://fdc.nal.usda.gov/','2026-04-30'),
 ('usda-sr','USDA FoodData Central — SR Legacy','CC0 1.0 (dominio público)','https://fdc.nal.usda.gov/','2018-04'),
 ('ciqual','Anses. Table de composition nutritionnelle des aliments Ciqual','Licence Ouverte / Etalab 2.0','https://ciqual.anses.fr/','2025');
"""


def escribir_sql(filas):
    destino = os.path.join(DATOS, 'sql')
    os.makedirs(destino, exist_ok=True)
    for f in os.listdir(destino):
        os.remove(os.path.join(destino, f))
    open(os.path.join(destino, '000_esquema.sql'), 'w').write(ESQUEMA)
    lineas_a, lineas_p = [], []
    vocab = {}
    for i, f in enumerate(filas, start=1):
        lineas_a.append('(' + ','.join([str(i), sql_texto(f['fuente']), sql_texto(f['fid']), sql_texto(f['nombre']), sql_texto(f['orig']), sql_texto(f['sinonimos']),
                                        str(C[f['cat']]), sql_num(f['kcal']), sql_num(f['p']), sql_num(f['c']), sql_num(f['g']), sql_num(f['az']), sql_num(f['sat']),
                                        sql_num(f['fibra']), sql_num(f['sal']), str(f['traducido']), str(f['prioridad'])]) + ')')
        for nombre, g in f['porciones']:
            lineas_p.append(f'({i},{sql_texto(nombre)},{sql_num(g)})')
        if f['traducido']:
            for w in (normalizar(f['nombre']) + ' ' + f['sinonimos']).split():
                if len(w) >= 3 and not w.isdigit():
                    vocab[w] = vocab.get(w, 0) + 1
    n = 1

    def volcar(prefijo, cabecera, lineas, por_lote):
        nonlocal n
        for j in range(0, len(lineas), por_lote):
            # Varias sentencias INSERT de 50 filas por archivo (límite de D1 ~100 KB por sentencia).
            trozo = lineas[j:j + por_lote]
            sent = [cabecera + ',\n'.join(trozo[k:k + 50]) + ';' for k in range(0, len(trozo), 50)]
            open(os.path.join(destino, f'{n:03d}_{prefijo}.sql'), 'w').write('\n'.join(sent) + '\n')
            n += 1

    volcar('alimentos', 'INSERT INTO alimentos (id,fuente,fuente_id,nombre,nombre_orig,sinonimos,categoria,kcal,proteinas,carbohidratos,grasas,azucares,saturadas,fibra,sal,traducido,prioridad) VALUES\n', lineas_a, 2000)
    volcar('porciones', 'INSERT INTO porciones (alimento_id,nombre,gramos) VALUES\n', lineas_p, 4000)
    lv = [f'({sql_texto(w)},{c})' for w, c in sorted(vocab.items())]
    volcar('vocabulario', 'INSERT INTO vocabulario (termino,n) VALUES\n', lv, 6000)
    open(os.path.join(destino, f'{n:03d}_fts.sql'), 'w').write("INSERT INTO alimentos_fts(alimentos_fts) VALUES('rebuild');\n")
    print(f'{len(filas)} alimentos · {len(lineas_p)} porciones · {len(vocab)} términos → {destino}', file=sys.stderr)


if __name__ == '__main__':
    modo = sys.argv[1] if len(sys.argv) > 1 else 'sql'
    filas, pendientes = construir()
    if modo == 'pendientes':
        with open(os.path.join(DATOS, 'pendientes.tsv'), 'w', encoding='utf-8') as out:
            for k, idioma, texto in pendientes:
                out.write(f'{k}\t{idioma}\t{texto}\n')
        from collections import Counter
        print(len(pendientes), 'pendientes', Counter(k.split(':')[0] for k, _, _ in pendientes), file=sys.stderr)
    elif modo == 'json':
        json.dump(filas, open(os.path.join(DATOS, 'alimentos.json'), 'w'), ensure_ascii=False)
    else:
        escribir_sql(filas)
        from collections import Counter
        print(Counter(f['fuente'] for f in filas), Counter(f['traducido'] for f in filas), file=sys.stderr)
