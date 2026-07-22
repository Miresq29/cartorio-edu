"""
Cria usuarios no Firebase Auth e Firestore para o 2tabmoc.
Usa o token do Firebase CLI (que tem permissao comprovada).
Uso:
  python backend/criar_usuarios_completo.py          <- relatorio
  python backend/criar_usuarios_completo.py --apply  <- cria/atualiza
"""
import sys
import json
import secrets
import urllib.request
import urllib.error
import datetime

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

APPLY     = '--apply' in sys.argv
PROJECT   = 'cartorio-edu'
TENANT_ID = '2tabmoc'
TOKEN_FILE = r'C:\Users\miria\.config\configstore\firebase-tools.json'
SENHAS_PATH = 'backend/SENHAS_PROVISORIAS_2tabmoc.json'

def gerar_senha():
    # Senha aleatoria e unica por usuario — nunca reaproveitar entre contas.
    return 'Cart@' + secrets.token_urlsafe(9)

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

def get_fb_token():
    with open(TOKEN_FILE, 'r') as f:
        cfg = json.load(f)
    return cfg['tokens']['access_token']

def http(method, url, body=None, token=None):
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read()), None
    except urllib.error.HTTPError as e:
        return None, json.loads(e.read().decode())

def lookup_auth(email, token):
    """Verifica se email existe no Auth. Retorna (localId, displayName) ou None."""
    url  = f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:lookup'
    resp, err = http('POST', url, {'email': [email]}, token)
    if err:
        return None
    users = resp.get('users', [])
    return (users[0]['localId'], users[0].get('displayName', '')) if users else None

def create_auth(email, name, password, token):
    """Cria conta no Firebase Auth. Retorna localId ou None."""
    url  = f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts'
    body = {'email': email, 'password': password, 'displayName': name,
            'emailVerified': False, 'disabled': False}
    resp, err = http('POST', url, body, token)
    if err:
        msg = err.get('error', {}).get('message', str(err))
        return None, msg
    return resp.get('localId'), None

def upsert_firestore(uid, email, name, token):
    """Cria/atualiza documento users/{uid} no Firestore. isFirstLogin forca troca da senha provisoria."""
    url  = (f'https://firestore.googleapis.com/v1/projects/{PROJECT}'
            f'/databases/(default)/documents/users/{uid}'
            f'?updateMask.fieldPaths=uid&updateMask.fieldPaths=email'
            f'&updateMask.fieldPaths=name&updateMask.fieldPaths=tenantId'
            f'&updateMask.fieldPaths=role&updateMask.fieldPaths=active'
            f'&updateMask.fieldPaths=isFirstLogin')
    now  = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    body = {'fields': {
        'uid':          {'stringValue': uid},
        'email':        {'stringValue': email},
        'name':         {'stringValue': name},
        'tenantId':     {'stringValue': TENANT_ID},
        'role':         {'stringValue': 'colaborador'},
        'active':       {'booleanValue': True},
        'isFirstLogin': {'booleanValue': True},
    }}
    _, err = http('PATCH', url, body, token)
    return err

def check_firestore(uid, token):
    """Verifica se documento existe no Firestore."""
    url  = (f'https://firestore.googleapis.com/v1/projects/{PROJECT}'
            f'/databases/(default)/documents/users/{uid}')
    resp, err = http('GET', url, None, token)
    return resp is not None

def main():
    print('Carregando token Firebase CLI...')
    token = get_fb_token()
    print('Token OK.\n')

    print('=' * 60)
    print('TENANT:', TENANT_ID, '(2o Oficio de Notas de Montes Claros)')
    print('MODO  :', 'CRIAR/ATUALIZAR' if APPLY else 'RELATORIO')
    print('=' * 60 + '\n')

    print('Verificando status de cada usuario...')
    results = []
    for email, nome in LISTA:
        auth_info = lookup_auth(email, token)
        if auth_info:
            uid, display = auth_info
            fs_exists = check_firestore(uid, token) if uid else False
            results.append({
                'email': email, 'nome': nome, 'uid': uid,
                'auth': 'OK', 'firestore': 'OK' if fs_exists else 'FALTANDO'
            })
        else:
            results.append({
                'email': email, 'nome': nome, 'uid': None,
                'auth': 'FALTANDO', 'firestore': 'FALTANDO'
            })

    auth_ok     = [r for r in results if r['auth'] == 'OK']
    auth_falta  = [r for r in results if r['auth'] == 'FALTANDO']
    fs_falta    = [r for r in results if r['firestore'] == 'FALTANDO']

    print(f'\nAuth OK ({len(auth_ok)}):')
    for r in auth_ok:
        fs = r['firestore']
        print(f'  {r["email"]}  [{r["uid"][:8]}...]  Firestore: {fs}')

    print(f'\nAuth FALTANDO ({len(auth_falta)}):')
    for r in auth_falta:
        print(f'  {r["email"]}  —  {r["nome"]}')

    if not APPLY:
        print('\n' + '-' * 60)
        print('Execute com --apply para criar as contas faltantes.')
        print('-' * 60 + '\n')
        return

    # Cria contas Auth que faltam — senha unica e aleatoria por usuario
    senhas_geradas = []
    if auth_falta:
        print(f'\nCriando {len(auth_falta)} conta(s) no Auth...')
        for r in auth_falta:
            senha = gerar_senha()
            uid, err = create_auth(r['email'], r['nome'], senha, token)
            if err:
                print(f'  ERRO Auth: {r["email"]} - {err}')
            else:
                r['uid'] = uid
                r['auth'] = 'CRIADO'
                senhas_geradas.append({'email': r['email'], 'nome': r['nome'], 'senha_provisoria': senha})
                print(f'  OK Auth: {r["nome"]} -> uid={uid[:12]}...')

    if senhas_geradas:
        with open(SENHAS_PATH, 'w', encoding='utf-8') as f:
            json.dump(senhas_geradas, f, ensure_ascii=False, indent=2)

    # Cria/atualiza Firestore para todos que têm UID e Firestore faltando
    fs_pendente = [r for r in results if r.get('uid') and r['firestore'] == 'FALTANDO']
    if fs_pendente:
        print(f'\nCriando {len(fs_pendente)} doc(s) no Firestore...')
        for r in fs_pendente:
            err = upsert_firestore(r['uid'], r['email'], r['nome'], token)
            if err:
                msg = err.get('error', {}).get('message', str(err))
                print(f'  ERRO Firestore: {r["email"]} - {msg}')
            else:
                print(f'  OK Firestore: {r["nome"]}')

    # Resumo final
    ok_final   = len([r for r in results if r['auth'] in ('OK', 'CRIADO') and r['firestore'] != 'FALTANDO']) + \
                 len([r for r in results if r['auth'] == 'CRIADO'])
    erros_auth = len([r for r in results if r['auth'] == 'FALTANDO'])
    print(f'\n{"="*60}')
    print('Concluido.')
    if senhas_geradas:
        print(f'Senhas provisorias (uma por usuario, unicas): {SENHAS_PATH}')
        print(f'Apague {SENHAS_PATH} apos comunicar as senhas aos usuarios.')
        print('Cada usuario tem isFirstLogin=true e sera obrigado a trocar a senha no 1o acesso.')
    if erros_auth:
        print(f'ATENCAO: {erros_auth} conta(s) nao foram criadas no Auth.')
    print(f'{"="*60}\n')

if __name__ == '__main__':
    main()
