"""
Ajusta roles do tenant 2tabmoc:
- Afonso Henrique (ti@) -> admin (manter)
- Clenio (gestaodaqualidade@) -> admin (era gestor)
- Todos os outros que estiverem como admin -> colaborador
Uso:
  python backend/ajustar_roles_2tabmoc.py          <- relatorio
  python backend/ajustar_roles_2tabmoc.py --apply  <- aplica
"""
import sys
import json
import urllib.request
import urllib.error

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

APPLY      = '--apply' in sys.argv
PROJECT    = 'cartorio-edu'
TENANT_ID  = '2tabmoc'
TOKEN_FILE = r'C:\Users\miria\.config\configstore\firebase-tools.json'

ADMINS_PERMITIDOS = {
    'ti@segundocartorionotas.com.br',
    'gestaodaqualidade@segundocartorionotas.com.br',
}

def get_token():
    with open(TOKEN_FILE) as f:
        return json.load(f)['tokens']['access_token']

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

def query_tenant_users(token):
    url  = (f'https://firestore.googleapis.com/v1/projects/{PROJECT}'
            f'/databases/(default)/documents:runQuery')
    body = {
        'structuredQuery': {
            'from': [{'collectionId': 'users'}],
            'where': {
                'fieldFilter': {
                    'field': {'fieldPath': 'tenantId'},
                    'op': 'EQUAL',
                    'value': {'stringValue': TENANT_ID}
                }
            }
        }
    }
    resp, err = http('POST', url, body, token)
    if err:
        print('Erro na query:', err)
        return []
    return [r['document'] for r in resp if r.get('document')]

def patch_role(uid, role, token):
    url  = (f'https://firestore.googleapis.com/v1/projects/{PROJECT}'
            f'/databases/(default)/documents/users/{uid}'
            f'?updateMask.fieldPaths=role')
    body = {'fields': {'role': {'stringValue': role}}}
    _, err = http('PATCH', url, body, token)
    return err

def main():
    print('Carregando token...')
    token = get_token()
    print('OK.\n')

    print('=' * 60)
    print('TENANT:', TENANT_ID)
    print('MODO  :', 'APLICAR' if APPLY else 'RELATORIO')
    print('=' * 60 + '\n')

    docs = query_tenant_users(token)
    if not docs:
        print('Nenhum usuario encontrado.')
        return

    print(f'Usuarios encontrados: {len(docs)}\n')

    virar_admin       = []  # precisa ser admin (era gestor/colaborador)
    virar_colaborador = []  # precisa virar colaborador (era admin)
    ja_ok             = []  # role ja correto

    for doc in docs:
        fields = doc.get('fields', {})
        uid    = doc['name'].split('/')[-1]
        email  = fields.get('email', {}).get('stringValue', '')
        name   = fields.get('name', {}).get('stringValue', '')
        role   = fields.get('role', {}).get('stringValue', '')

        email_lower = email.lower()
        deve_ser_admin = email_lower in ADMINS_PERMITIDOS

        if deve_ser_admin and role != 'admin':
            virar_admin.append({'uid': uid, 'email': email, 'name': name, 'role_atual': role})
        elif not deve_ser_admin and role == 'admin':
            virar_colaborador.append({'uid': uid, 'email': email, 'name': name, 'role_atual': role})
        else:
            ja_ok.append({'uid': uid, 'email': email, 'name': name, 'role': role})

    print(f'--- ADMINS AUTORIZADOS ({len(ADMINS_PERMITIDOS)}) ---')
    for doc in docs:
        email = doc['fields'].get('email', {}).get('stringValue', '').lower()
        if email in ADMINS_PERMITIDOS:
            role = doc['fields'].get('role', {}).get('stringValue', '')
            name = doc['fields'].get('name', {}).get('stringValue', '')
            status = 'ja admin' if role == 'admin' else f'MUDAR {role} -> admin'
            print(f'  {email}  ({name})  [{status}]')

    print(f'\n--- VIRAR ADMIN ({len(virar_admin)}) ---')
    for u in virar_admin:
        print(f'  {u["email"]}  ({u["name"]})  {u["role_atual"]} -> admin')

    print(f'\n--- VIRAR COLABORADOR ({len(virar_colaborador)}) ---')
    for u in virar_colaborador:
        print(f'  {u["email"]}  ({u["name"]})  admin -> colaborador')

    print(f'\n--- JA CORRETOS ({len(ja_ok)}) ---')
    for u in ja_ok:
        print(f'  {u["email"]}  [{u["role"]}]')

    if not APPLY:
        print('\n' + '-' * 60)
        print('Execute com --apply para aplicar.')
        print('-' * 60)
        return

    total = len(virar_admin) + len(virar_colaborador)
    if total == 0:
        print('\nNada a alterar.')
        return

    print(f'\nAplicando {total} alteracoes...')

    for u in virar_admin:
        err = patch_role(u['uid'], 'admin', token)
        if err:
            print(f'  ERRO: {u["email"]} - {err}')
        else:
            print(f'  OK: {u["name"]} -> admin')

    for u in virar_colaborador:
        err = patch_role(u['uid'], 'colaborador', token)
        if err:
            print(f'  ERRO: {u["email"]} - {err}')
        else:
            print(f'  OK: {u["name"]} -> colaborador')

    print('\nConcluido.')

if __name__ == '__main__':
    main()
