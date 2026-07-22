"""
Insere usuários do 2º Ofício de Notas de Montes Claros (tenantId: 2tabmoc).
Uso:
  python backend/inserir_usuarios_2tabmoc.py          ← relatório (não cria nada)
  python backend/inserir_usuarios_2tabmoc.py --apply  ← cria as contas
"""
import sys
import json
import secrets
import subprocess
import urllib.request
import urllib.error
import datetime

# Garante UTF-8 no terminal Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

APPLY     = '--apply' in sys.argv
PROJECT   = 'cartorio-edu'
TENANT_ID = '2tabmoc'
GCLOUD    = r'C:\Users\miria\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
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
    ('escritura1@segundocartorionotas.com.br',        'João Rafael'),
    ('escritura2@segundocartorionotas.com.br',        'Gabriela Rodrigues'),
    ('escritura3@segundocartorionotas.com.br',        'Bruna Lima'),
    ('escritura4@segundocartorionotas.com.br',        'Ellen Maia'),
    ('escritura5@segundocartorionotas.com.br',        'Denysye Rodrigues'),
    ('escritura@segundocartorionotas.com.br',         'Ludimila Alves'),
    ('externo@segundocartorionotas.com.br',           'Roberth Kley'),
    ('financeiro@segundocartorionotas.com.br',        'Gabrielle Rodrigues'),
    ('gestaodaqualidade@segundocartorionotas.com.br', 'Clênio Rezende'),
    ('procuracao2@segundocartorionotas.com.br',       'Lara Silva'),
    ('procuracao3@segundocartorionotas.com.br',       'Barbara Ellen'),
    ('procuracao4@segundocartorionotas.com.br',       'Sofia Oliveira'),
    ('recepcao@segundocartorionotas.com.br',          'Neusrovel Versiani'),
    ('ti@segundocartorionotas.com.br',                'Afonso Henrique'),
    ('vivianne@segundocartorionotas.com.br',          'Vivianne Romanholo'),
]

def get_token():
    r = subprocess.run([GCLOUD, 'auth', 'print-access-token'],
                       capture_output=True, text=True, shell=False)
    return r.stdout.strip()

def http(method, url, body=None, token=None):
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'x-goog-user-project': PROJECT,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read()), None
    except urllib.error.HTTPError as e:
        return None, json.loads(e.read().decode())

def check_auth_user(email, token):
    """Verifica se email já existe no Firebase Auth. Retorna dict|False|None(erro)."""
    url  = f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:lookup'
    body = {'email': [email]}
    resp, err = http('POST', url, body, token)
    if err:
        msg = err.get('error', {}).get('message', '')
        if 'USER_NOT_FOUND' in msg:
            return False  # não existe — OK para criar
        print(f'    [lookup err] {email}: {msg}')
        return None  # erro real
    users = resp.get('users', [])
    return users[0] if users else False

def create_auth_user(email, display_name, password, token):
    """Cria conta no Firebase Auth."""
    url  = f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts'
    body = {
        'email': email,
        'password': password,
        'displayName': display_name,
        'emailVerified': False,
        'disabled': False,
    }
    return http('POST', url, body, token)

def create_firestore_user(uid, email, name, token):
    """Cria documento na coleção users. isFirstLogin forca troca da senha provisoria."""
    url  = (f'https://firestore.googleapis.com/v1/projects/{PROJECT}'
            f'/databases/(default)/documents/users/{uid}')
    now  = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    body = {
        'fields': {
            'uid':          {'stringValue': uid},
            'email':        {'stringValue': email},
            'name':         {'stringValue': name},
            'tenantId':     {'stringValue': TENANT_ID},
            'role':         {'stringValue': 'colaborador'},
            'active':       {'booleanValue': True},
            'isFirstLogin': {'booleanValue': True},
            'createdAt':    {'stringValue': now},
        }
    }
    return http('PATCH', url, body, token)

def get_firestore_user(uid, token):
    url = (f'https://firestore.googleapis.com/v1/projects/{PROJECT}'
           f'/databases/(default)/documents/users/{uid}')
    return http('GET', url, None, token)

def main():
    print('Obtendo token gcloud...')
    token = get_token()
    if not token:
        print('ERRO: Token não obtido. Execute: gcloud auth login')
        sys.exit(1)
    print('Token OK.\n')

    print('=' * 60)
    print('TENANT:', TENANT_ID, '(2º Ofício de Notas de Montes Claros)')
    print('MODO  :', 'CRIAR CONTAS' if APPLY else 'RELATÓRIO (sem alterações)')
    print('=' * 60 + '\n')

    ja_existem = []
    criar       = []
    erros_check = []

    print('Verificando emails existentes no Firebase Auth...')
    for email, nome in LISTA:
        existing = check_auth_user(email, token)
        if existing is None:
            # Erro de rede/permissão — coloca em "criar" mesmo assim (será tratado no --apply)
            erros_check.append((email, nome))
            criar.append((email, nome))
        elif existing:
            ja_existem.append((email, nome, existing.get('localId', '')))
        else:
            criar.append((email, nome))

    print(f'\n✅ Já existem no Auth ({len(ja_existem)}):')
    for e, n, uid in ja_existem:
        print(f'   {e}  —  {n}  (uid: {uid})')

    print(f'\n➕ Serão criados ({len(criar)}):')
    for e, n in criar:
        print(f'   {e}  —  {n}')

    if erros_check:
        print(f'\n⚠  Erro ao verificar ({len(erros_check)}):')
        for e, n in erros_check:
            print(f'   {e}  —  {n}')

    if not APPLY:
        print('\n' + '-' * 60)
        print('Relatório concluído. Execute com --apply para criar as contas.')
        print('-' * 60 + '\n')
        return

    if not criar:
        print('\nNada a criar.')
        return

    print(f'\nCriando {len(criar)} conta(s)...\n')
    ok_list   = []
    fail_list = []
    senhas_geradas = []

    for email, nome in criar:
        senha = gerar_senha()
        resp, err = create_auth_user(email, nome, senha, token)
        if err:
            codigo = err.get('error', {}).get('message', str(err))
            if 'EMAIL_EXISTS' in str(codigo):
                print(f'  ⚠  Já existia (race condition): {nome}')
            else:
                print(f'  ❌ Auth falhou ({codigo}): {nome}')
                fail_list.append((email, nome, str(codigo)))
            continue

        uid = resp.get('localId', '')
        if not uid:
            print(f'  ❌ UID não retornado: {nome}')
            fail_list.append((email, nome, 'sem UID'))
            continue

        _, fs_err = create_firestore_user(uid, email, nome, token)
        senhas_geradas.append({'email': email, 'nome': nome, 'senha_provisoria': senha})
        if fs_err:
            msg = fs_err.get('error', {}).get('message', str(fs_err))
            print(f'  ⚠  Auth OK mas Firestore falhou ({msg}): {nome}')
            ok_list.append((email, nome, uid, 'Auth OK / Firestore FALHOU'))
        else:
            print(f'  ✅ {nome}  →  {email}  (uid: {uid})')
            ok_list.append((email, nome, uid, 'OK'))

    if senhas_geradas:
        with open(SENHAS_PATH, 'w', encoding='utf-8') as f:
            json.dump(senhas_geradas, f, ensure_ascii=False, indent=2)

    print(f'\n{"─"*60}')
    print(f'Criados com sucesso : {len([x for x in ok_list if x[3]=="OK"])}')
    print(f'Falhas              : {len(fail_list)}')
    if fail_list:
        for e, n, msg in fail_list:
            print(f'  ❌ {n}: {msg}')
    print(f'{"─"*60}\n')
    if senhas_geradas:
        print(f'Senhas provisorias (unicas por usuario): {SENHAS_PATH}')
        print(f'Apague {SENHAS_PATH} apos comunicar as senhas aos usuarios.')
        print('Cada usuario tem isFirstLogin=true e sera obrigado a trocar a senha no 1o acesso.')

if __name__ == '__main__':
    main()
