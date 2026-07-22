"""
Versão rápida — usa query direta por tenantId.
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

# TenantIds possíveis para o Segundo Cartório de Notas
TENANT_IDS_CANDIDATOS = [
    'segundocartorionotas',
    'segundo-cartorio-notas',
    'segundo_cartorio_notas',
    '2cartorionotas',
]

def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().strip()

def main():
    print('Iniciando Firebase Admin...')
    cred = credentials.Certificate('backend/cartorio-homolog-service-account.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print('Conectado.\n')

    print('='*60)
    print('MODO:', 'APLICAR MUDANÇAS' if APPLY else 'RELATÓRIO')
    print('='*60 + '\n')

    # Tenta cada tenantId candidato
    usuarios = []
    tenant_usado = None
    for tid in TENANT_IDS_CANDIDATOS:
        print(f'Buscando tenantId="{tid}"...')
        snap = db.collection('users').where('tenantId', '==', tid).get()
        docs = [{**d.to_dict(), 'uid': d.id} for d in snap]
        print(f'  → {len(docs)} usuários')
        if docs:
            usuarios.extend(docs)
            tenant_usado = tid

    if not usuarios:
        print('\nNenhum usuário encontrado nos tenantIds candidatos.')
        print('Listando uma amostra dos tenantIds existentes...')
        sample = db.collection('users').limit(20).get()
        tenants = set(d.to_dict().get('tenantId', '?') for d in sample)
        print('TenantIds encontrados:', sorted(tenants))
        return

    print(f'\nTenant usado: "{tenant_usado}" | Usuários: {len(usuarios)}\n')

    por_email = {(u.get('email') or '').lower(): u for u in usuarios}
    por_nome  = {norm(u.get('name') or u.get('displayName') or ''): u for u in usuarios}

    ok, atualizar, nao_achado = [], [], []

    for email_oficial, nome_oficial in LISTA_OFICIAL:
        if email_oficial.lower() in por_email:
            ok.append((email_oficial, nome_oficial, por_email[email_oficial.lower()]))
        elif norm(nome_oficial) in por_nome:
            atualizar.append((email_oficial, nome_oficial, por_nome[norm(nome_oficial)]))
        else:
            nao_achado.append((email_oficial, nome_oficial))

    print(f'✅ Já corretos ({len(ok)}):')
    for email, nome, _ in ok:
        print(f'   {email}  —  {nome}')

    print(f'\n🔄 Serão atualizados ({len(atualizar)}):')
    for email_novo, nome, u in atualizar:
        print(f'   {nome}')
        print(f'      Email atual : {u.get("email") or "(vazio)"}')
        print(f'      Novo email  : {email_novo}')

    print(f'\n❌ Não encontrados ({len(nao_achado)}):')
    for email, nome in nao_achado:
        print(f'   {email}  —  {nome}')

    if not APPLY:
        print('\n' + '-'*60)
        print('Relatório concluído. Use --apply para aplicar as mudanças.')
        print('-'*60 + '\n')
        return

    print('\nAplicando...')
    for email_novo, nome, u in atualizar:
        uid = u['uid']
        try:
            db.collection('users').document(uid).update({'email': email_novo})
            try:
                auth.update_user(uid, email=email_novo)
                print(f'✅ {nome} → {email_novo}')
            except Exception as ae:
                print(f'⚠  Firestore OK, Auth falhou ({ae.code if hasattr(ae,"code") else ae}): {nome}')
        except Exception as e:
            print(f'❌ Erro {nome}: {e}')

    print('\nConcluído.')

if __name__ == '__main__':
    main()
