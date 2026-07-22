"""
Gera o JSON para firebase auth:import com SHA256.
Executar: python backend/gerar_import_auth.py
Depois: firebase auth:import backend/users_2tabmoc.json --hash-algo=SHA256 --rounds=1 --hash-input-order=PASSWORD_FIRST --project=cartorio-edu
"""
import json
import hashlib
import base64
import secrets

LISTA = [
    ('administrativo@segundocartorionotas.com.br',    'Dayane Noronha'),
    ('apoioescritura2@segundocartorionotas.com.br',   'Ana Luzia'),
    ('arquivo2@segundocartorionotas.com.br',          'Rayanne Santos'),
    ('arquivo@segundocartorionotas.com.br',           'Ester Mirian'),
    ('assessora@segundocartorionotas.com.br',         'Jane Piranga'),
    ('atendimento@segundocartorionotas.com.br',       'Lorena Romanholo'),
    ('balcao1@segundocartorionotas.com.br',           'Brenda Prates'),
    ('balcao2@segundocartorionotas.com.br',           'Warley Martins'),
    ('balcao3@segundocartorionotas.com.br',           'Emanuelle Leite'),
    ('balcao4@segundocartorionotas.com.br',           'Clarissa Leila'),
    ('balcao5@segundocartorionotas.com.br',           'Jhuly Gabriele'),
    ('balcao6@segundocartorionotas.com.br',           'Beatriz Ferreira'),
    ('balcao8@segundocartorionotas.com.br',           'Adwaney Mendes'),
    ('caixa@segundocartorionotas.com.br',             'Erick Luan'),
    ('escritura1@segundocartorionotas.com.br',        'Joao Rafael'),
    ('escritura2@segundocartorionotas.com.br',        'Gabriela Rodrigues'),
    ('escritura3@segundocartorionotas.com.br',        'Bruna Lima'),
    ('escritura4@segundocartorionotas.com.br',        'Ellen Maia'),
    ('escritura5@segundocartorionotas.com.br',        'Denysye Rodrigues'),
    ('escritura@segundocartorionotas.com.br',         'Ludimila Alves'),
    ('externo@segundocartorionotas.com.br',           'Roberth Kley'),
    ('financeiro@segundocartorionotas.com.br',        'Gabrielle Rodrigues'),
    ('gestaodaqualidade@segundocartorionotas.com.br', 'Clenio Rezende'),
    ('procuracao2@segundocartorionotas.com.br',       'Lara Silva'),
    ('procuracao3@segundocartorionotas.com.br',       'Barbara Ellen'),
    ('procuracao4@segundocartorionotas.com.br',       'Sofia Oliveira'),
    ('recepcao@segundocartorionotas.com.br',          'Neusrovel Versiani'),
    ('ti@segundocartorionotas.com.br',                'Afonso Henrique'),
    ('vivianne@segundocartorionotas.com.br',          'Vivianne Romanholo'),
]

# Senha aleatoria e unica por usuario — nunca reaproveitar a mesma senha entre contas.
# SHA256/rounds=1 e o unico formato aceito por auth:import sem depender dos parametros
# scrypt do projeto; por isso a senha e apenas uma credencial de embarque de uso unico
# (o usuario e obrigado a troca-la no primeiro login via isFirstLogin, ver docs Firestore).
def gerar_senha():
    return 'Cart@' + secrets.token_urlsafe(9)

users = []
senhas = []  # so para distribuicao — apagar o arquivo apos comunicar aos usuarios
for email, nome in LISTA:
    senha = gerar_senha()
    password_hash = base64.b64encode(
        hashlib.sha256(senha.encode('utf-8')).digest()
    ).decode('utf-8')
    users.append({
        'localId': '',  # Firebase gera automaticamente se vazio
        'email': email,
        'displayName': nome,
        'passwordHash': password_hash,
        'emailVerified': False,
        'disabled': False,
    })
    senhas.append({'email': email, 'nome': nome, 'senha_provisoria': senha})

output = {'users': users}
path = 'backend/users_2tabmoc.json'
with open(path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

senhas_path = 'backend/SENHAS_PROVISORIAS_2tabmoc.json'
with open(senhas_path, 'w', encoding='utf-8') as f:
    json.dump(senhas, f, ensure_ascii=False, indent=2)

print(f'\nArquivo de import gerado: {path}')
print(f'Senhas provisorias (uma por usuario): {senhas_path}')
print(f'Total: {len(users)} usuarios')
print()
print('IMPORTANTE:')
print('  - Cada usuario recebeu uma senha unica e aleatoria (nunca a mesma senha para todos).')
print(f'  - Apague {senhas_path} do disco assim que comunicar as senhas aos usuarios.')
print('  - O documento Firestore de cada usuario precisa de isFirstLogin=true para forcar troca no 1o acesso.')
print()
print('Proximos passos:')
print('  1. firebase auth:import backend/users_2tabmoc.json --hash-algo=SHA256 --rounds=1 --hash-input-order=PASSWORD_FIRST --project=cartorio-edu')
print('  2. python backend/criar_docs_firestore.py --apply')
