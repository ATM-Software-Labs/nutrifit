#!/usr/bin/env python3
"""Genera src/data/alimentos.ts a partir de USDA FoodData Central (SR Legacy, 2018-04).

Fuente: U.S. Department of Agriculture, Agricultural Research Service.
FoodData Central — SR Legacy (2018). https://fdc.nal.usda.gov/  (dominio público, CC0)

`mapa.txt` asocia cada alimento habitual en España (nombre, categoría y ración típica
en gramos, que es nuestra) con la descripción exacta del alimento en SR Legacy. De ahí
se toman, por 100 g: energía (kcal, nutriente 1008), proteínas (1003), carbohidratos
por diferencia (1005) y grasas totales (1004).

Uso:  python3 scripts/alimentos/generar.py   (descarga ~6 MB a /tmp la primera vez)
"""
import csv, io, json, os, sys, urllib.request, zipfile

URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip'
CACHE = '/tmp/fdc_sr_legacy_2018-04.zip'
AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, '..', '..', 'src', 'data', 'alimentos.ts')
NUTRIENTES = {'1008': 'kcal', '1003': 'p', '1005': 'c', '1004': 'g'}

if not os.path.exists(CACHE):
    urllib.request.urlretrieve(URL, CACHE)
z = zipfile.ZipFile(CACHE)
leer = lambda nombre: csv.DictReader(io.TextIOWrapper(z.open(next(n for n in z.namelist() if n.endswith('/' + nombre))), 'utf-8'))
descripcion = {r['description']: r['fdc_id'] for r in leer('food.csv')}
valores = {}
for r in leer('food_nutrient.csv'):
    k = NUTRIENTES.get(r['nutrient_id'])
    if k:
        valores.setdefault(r['fdc_id'], {})[k] = float(r['amount'])

def r1(x):
    x = round(x, 1)
    return int(x) if x == int(x) else x

filas, categorias, faltan = [], [], []
for linea in open(os.path.join(AQUI, 'mapa.txt'), encoding='utf-8'):
    if not linea.strip() or linea.startswith('#'):
        continue
    nombre, cat, racion, desc = linea.rstrip('\n').split('|')
    fdc = descripcion.get(desc)
    if not fdc or 'kcal' not in valores.get(fdc, {}):
        faltan.append(desc)
        continue
    v = valores[fdc]
    if cat not in categorias:
        categorias.append(cat)
    filas.append([nombre, categorias.index(cat), round(v['kcal']), r1(v.get('p', 0)), r1(v.get('c', 0)), r1(v.get('g', 0)), int(racion), int(fdc)])

if faltan:
    sys.exit('No encontrados en SR Legacy:\n  ' + '\n  '.join(faltan))

os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
with open(SALIDA, 'w', encoding='utf-8') as f:
    f.write('// GENERADO por scripts/alimentos/generar.py — no editar a mano.\n')
    f.write('// Valores por 100 g de USDA FoodData Central, SR Legacy (2018), dominio público (CC0).\n')
    f.write('// https://fdc.nal.usda.gov/ · El último campo es el FDC ID para trazabilidad.\n')
    f.write('// [nombre, categoría, kcal, proteínas, carbohidratos, grasas, ración típica (g), fdcId]\n')
    f.write('export type FilaAlimento = [string, number, number, number, number, number, number, number]\n')
    f.write('export const CATEGORIAS: string[] = ' + json.dumps(categorias, ensure_ascii=False) + '\n')
    f.write('export const ALIMENTOS: FilaAlimento[] = [\n')
    for fila in filas:
        f.write('  ' + json.dumps(fila, ensure_ascii=False, separators=(',', ':')) + ',\n')
    f.write(']\n')
print(f'{len(filas)} alimentos, {len(categorias)} categorías → {os.path.relpath(SALIDA)}')
