import re

with open('src/lib/i18n.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add weight page translations for Spanish
content = content.replace("'ajustes.objetivo': 'Objetivo',", "'ajustes.objetivo': 'Objetivo',\n    'peso.titulo': 'Progreso de peso corporal',\n    'peso.estimaciones': 'Estimaciones corporales',\n    'peso.musculo': 'Masa muscular estimada',\n    'peso.grasa': 'Grasa corporal estimada',\n    'peso.nota': 'Nota: Estos valores son estimaciones genéricas basadas en tu peso total. Más adelante podrás sincronizar tu báscula inteligente o importar datos exactos para mayor precisión.',\n    'peso.importar': 'Importar historial de peso y métricas...',")

# Add for Catalan
content = content.replace("'ajustes.objetivo': 'Objectiu',", "'ajustes.objetivo': 'Objectiu',\n    'peso.titulo': 'Progrés de pes corporal',\n    'peso.estimaciones': 'Estimacions corporals',\n    'peso.musculo': 'Massa muscular estimada',\n    'peso.grasa': 'Greix corporal estimat',\n    'peso.nota': 'Nota: Aquests valors són estimacions genèriques basades en el teu pes total. Més endavant podràs sincronitzar la teva bàscula intel·ligent o importar dades exactes per a major precisió.',\n    'peso.importar': 'Importar historial de pes i mètriques...',")

# Add for English
content = content.replace("'ajustes.objetivo': 'Goal',", "'ajustes.objetivo': 'Goal',\n    'peso.titulo': 'Body weight progress',\n    'peso.estimaciones': 'Body estimates',\n    'peso.musculo': 'Estimated muscle mass',\n    'peso.grasa': 'Estimated body fat',\n    'peso.nota': 'Note: These values are generic estimates based on your total weight. Later you can sync your smart scale or import exact data for greater accuracy.',\n    'peso.importar': 'Import weight history and metrics...',")

with open('src/lib/i18n.ts', 'w', encoding='utf-8') as f:
    f.write(content)
