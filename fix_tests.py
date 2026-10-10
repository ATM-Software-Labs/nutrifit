import os

files = [
    'tests/gateway.test.ts',
    'tests/urlApi.test.ts',
    'tests/avatar.test.ts',
    'tests/escanearOAuth.test.ts',
    'gateway/src/env.ts',
    'gateway/src/proxy.ts',
    'gateway/src/vision.ts',
    'src/lib/api.ts'
]

for f in files:
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        content = content.replace('/v1/nutrifit/vision', '/nutrifit/vision')
        content = content.replace('/v1/auth', '/nutrifit/auth')
        content = content.replace('/v1/mail', '/nutrifit/mail')
        content = content.replace('/v1/comidas', '/nutrifit/comidas')
        content = content.replace('/v1/archivos', '/nutrifit/archivos')
        content = content.replace('\'/v1\'', '\'/nutrifit\'')
        content = content.replace('/v1 ', '/nutrifit ')
        content = content.replace('/v1\n', '/nutrifit\n')
        content = content.replace('/v1*', '/nutrifit*')
        content = content.replace('https://api.trujillomingorance.com/v1', 'https://api.trujillomingorance.com/nutrifit')
        
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f'Updated {f}')
    except Exception as e:
        print(f'Error {f}: {e}')
