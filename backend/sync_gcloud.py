"""
Usa gcloud access token para chamar a Firestore REST API.
Uso:
  python backend/sync_gcloud.py          ← relatório
  python backend/sync_gcloud.py --apply  ← aplica mudanças
"""
import sys
import json
import subprocess
import unicodedata
import urllib.request
import urllib.error

APPLY = '--apply' in sys.argv
PROJECT = 'cartorio-edu'
FS_BASE = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'

LISTA_OFICIAL = [
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
    r = subprocess.run(['gcloud', 'auth', 'print-access-token'], capture_output=True, text=True)
    return r.stdout.strip()

def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().strip()

def fs_request(method, path, body=None, token=None):
    url = f'{FS_BASE}/{path}'
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        })
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f'HTTP {e.code}: {e.read().decode()[:300]}')
        return None

def query_users(token, tenant_id):
    """Usa runQuery para buscar usuários por tenantId."""
    url = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents:runQuery'
    body = {
        'structuredQuery': {
            'from': [{'collectionId': 'users'}],
            'where': {
                'fieldFilter': {
                    'field': {'fieldPath': 'tenantId'},
                    'op': 'EQUAL',
                    'value': {'stringValue': tenant_id}
                }
            }
        }
    }
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method='POST',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        })
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f'HTTP {e.code}: {e.read().decode()[:500]}')
        return []

def parse_user(doc):
    """Extrai campos de um documento Firestore."""
    fields = doc.get('fields', {})
    name_path = doc.get('name', '')
    uid = name_path.split('/')[-1] if name_path else ''

    def sv(field):
        v = fields.get(field, {})
        return v.get('stringValue', v.get('booleanValue', ''))

    return {
        'uid': uid,
        'email': sv('email'),
        'name': sv('name') or sv('displayName'),
        'tenantId': sv('tenantId'),
        'role': sv('role'),
    }

def update_email_firestore(uid, new_email, token):
    """Atualiza o campo email no Firestore via PATCH."""
    url = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/users/{uid}?updateMask.fieldPaths=email'
    body = {
        'fields': {
            'email': {'stringValue': new_email}
        }
    }
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method='PATCH',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return True
    except urllib.error.HTTPError as e:
        print(f'  HTTP {e.code}: {e.read().decode()[:200]}')
        return False

def main():
    print('Obtendo token gcloud...')
    token = get_token()
    if not token:
        print('ERRO: Não foi possível obter o token. Execute: gcloud auth login')
        sys.exit(1)
    print('Token obtido.\n')

    print('='*60)
    print('MODO:', 'APLICAR MUDANÇAS' if APPLY else 'RELATÓRIO')
    print('='*60 + '\n')

    # Tenta tenantIds candidatos
    tenant_ids_candidatos = [
        'segundocartorionotas',
        'segundo-cartorio-notas',
        'segundo_cartorio_notas',
    ]

    usuarios = []
    tenant_usado = None

    for tid in tenant_ids_candidatos:
        print(f'Consultando tenantId="{tid}"...')
        results = query_users(token, tid)
        docs = [r.get('document') for r in results if r.get('document')]
        parsed = [parse_user(d) for d in docs]
        print(f'  → {len(parsed)} usuários encontrados')
        if parsed:
            usuarios.extend(parsed)
            tenant_usado = tid
            break

    if not usuarios:
        print('\nNenhum usuário encontrado. Verificando amostra de tenantIds...')
        # Lista primeiros 20 usuários para ver tenantIds
        sample_url = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/users?pageSize=20'
        req = urllib.request.Request(sample_url,
            headers={'Authorization': f'Bearer {token}'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
            docs = data.get('documents', [])
            tenants = set()
            for d in docs:
                f = d.get('fields', {})
                tenants.add(f.get('tenantId', {}).get('stringValue', '?'))
            print('TenantIds na amostra:', sorted(tenants))
        except Exception as e:
            print('Erro ao listar amostra:', e)
        return

    print(f'\nTenant: "{tenant_usado}" | {len(usuarios)} usuários\n')

    por_email = {(u['email'] or '').lower(): u for u in usuarios}
    por_nome  = {norm(u['name']): u for u in usuarios if u.get('name')}

    ok, atualizar, nao_achado = [], [], []

    for email_oficial, nome_oficial in LISTA_OFICIAL:
        ek = email_oficial.lower()
        nk = norm(nome_oficial)
        if ek in por_email:
            ok.append((email_oficial, nome_oficial, por_email[ek]))
        elif nk in por_nome:
            atualizar.append((email_oficial, nome_oficial, por_nome[nk]))
        else:
            nao_achado.append((email_oficial, nome_oficial))

    print(f'✅ Já corretos ({len(ok)}):')
    for e, n, _ in ok:
        print(f'   {e}  —  {n}')

    print(f'\n🔄 Serão atualizados ({len(atualizar)}):')
    for email_novo, nome, u in atualizar:
        print(f'   {nome}')
        print(f'      Email atual : {u["email"] or "(vazio)"}')
        print(f'      Novo email  : {email_novo}')
        print(f'      UID         : {u["uid"]}')

    print(f'\n❌ Não encontrados ({len(nao_achado)}):')
    for e, n in nao_achado:
        print(f'   {e}  —  {n}')

    if not APPLY:
        print('\n' + '-'*60)
        print('Relatório concluído. Execute com --apply para aplicar.')
        print('-'*60 + '\n')
        return

    if not atualizar:
        print('\nNada a atualizar.')
        return

    print('\nAplicando atualizações no Firestore...')
    for email_novo, nome, u in atualizar:
        uid = u['uid']
        if update_email_firestore(uid, email_novo, token):
            print(f'  ✅ {nome} → {email_novo}')
        else:
            print(f'  ❌ Falha: {nome}')

    print('\nObs: Firebase Auth (login) não foi atualizado automaticamente.')
    print('Para atualizar o login, acesse Firebase Console > Authentication')
    print('ou gere um novo service account em console.firebase.google.com')
    print('\nConcluído.')

if __name__ == '__main__':
    main()
