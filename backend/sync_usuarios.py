"""
Verifica e atualiza emails dos usuários do Segundo Cartório de Notas.
Uso:
  python backend/sync_usuarios.py          ← só relatório
  python backend/sync_usuarios.py --apply  ← aplica mudanças
"""
import sys
import unicodedata
import firebase_admin
from firebase_admin import credentials, firestore, auth

APPLY = '--apply' in sys.argv

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

def norm(s):
    """Normaliza string: sem acentos, minúsculas, sem espaços extras."""
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().strip()

def main():
    cred = credentials.Certificate('backend/cartorio-homolog-service-account.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print('\n' + '='*60)
    print('  MODO:', 'APLICAR MUDANÇAS' if APPLY else 'RELATÓRIO (use --apply para aplicar)')
    print('='*60 + '\n')

    # Busca todos os usuários e filtra pelos que têm email @segundocartorionotas
    todos = []
    refs = db.collection('users').stream()
    for doc in refs:
        d = doc.to_dict()
        d['uid'] = doc.id
        todos.append(d)

    print(f'Total de usuários na base: {len(todos)}')

    # Detecta tenantIds do segundo cartório
    tenants_detectados = set(
        u.get('tenantId', '') for u in todos
        if 'segundocartorionotas' in (u.get('email') or '')
    )
    print(f'TenantIds detectados: {tenants_detectados or "(nenhum por email, buscando todos)"}')

    # Filtra usuários do tenant
    if tenants_detectados:
        usuarios = [u for u in todos if u.get('tenantId') in tenants_detectados]
    else:
        # Fallback: tenta buscar por email diretamente
        usuarios = [u for u in todos if 'segundocartorionotas' in (u.get('email') or '')]

    print(f'Usuários do segundo cartório encontrados: {len(usuarios)}\n')

    por_email = {(u.get('email') or '').lower(): u for u in usuarios}
    por_nome  = {norm(u.get('name') or u.get('displayName') or ''): u for u in usuarios}

    ok, atualizar, nao_achado = [], [], []

    for email_oficial, nome_oficial in LISTA_OFICIAL:
        email_key = email_oficial.lower()
        nome_key  = norm(nome_oficial)

        if email_key in por_email:
            ok.append((email_oficial, nome_oficial, por_email[email_key]))
        elif nome_key in por_nome:
            atualizar.append((email_oficial, nome_oficial, por_nome[nome_key]))
        else:
            nao_achado.append((email_oficial, nome_oficial))

    # ── Relatório ──────────────────────────────────────────────────────────
    print(f'✅ Já corretos ({len(ok)}):')
    for email, nome, _ in ok:
        print(f'   {email}  —  {nome}')

    print(f'\n🔄 Email diferente — será atualizado ({len(atualizar)}):')
    for email_novo, nome, usuario in atualizar:
        print(f'   {nome}')
        print(f'      Email atual : {usuario.get("email") or "(vazio)"}')
        print(f'      Novo email  : {email_novo}')
        print(f'      UID         : {usuario["uid"]}')

    print(f'\n❌ Não encontrados na base ({len(nao_achado)}):')
    for email, nome in nao_achado:
        print(f'   {email}  —  {nome}')

    if not APPLY:
        print('\n' + '-'*60)
        print('Relatório concluído. Execute com --apply para atualizar.')
        print('-'*60 + '\n')
        return

    if not atualizar:
        print('\nNada a atualizar.')
        return

    print('\nAplicando atualizações...\n')
    erros = []
    for email_novo, nome, usuario in atualizar:
        uid = usuario['uid']
        try:
            # Atualiza Firestore
            db.collection('users').document(uid).update({'email': email_novo})
            # Atualiza Firebase Auth
            try:
                auth.update_user(uid, email=email_novo)
                print(f'✅ Auth + Firestore OK: {nome} → {email_novo}')
            except Exception as ae:
                print(f'⚠  Auth não atualizado ({ae}), Firestore OK: {nome}')
        except Exception as e:
            print(f'❌ Erro ao atualizar {nome}: {e}')
            erros.append(nome)

    if erros:
        print(f'\n{len(erros)} erro(s): {erros}')
    else:
        print(f'\nTodas as {len(atualizar)} atualizações concluídas com sucesso.')

if __name__ == '__main__':
    main()
