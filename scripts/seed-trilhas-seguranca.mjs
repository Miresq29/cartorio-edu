// Script de seed único — cria as trilhas oficiais de segurança/cyber-higiene
// da MJ Consultoria, publicadas globalmente (tenantIds: ['GLOBAL']) e
// marcadas como "oficial: true" (badge "Modelo MJ Consultoria" no TrailsView).
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const key = JSON.parse(readFileSync('./key-cartorio-edu.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const PERFIS = ['colaborador', 'gestor', 'admin'];

function modulo(titulo, descricao, conteudo, { tipo = 'obrigatorio', temQuiz = true, notaMinima = 7 } = {}) {
  return { id: randomUUID(), titulo, descricao, tipo, conteudo, temQuiz, notaMinima };
}

const TRILHAS = [
  {
    titulo: 'Segurança de Senhas e Autenticação',
    descricao: 'Como criar, guardar e proteger senhas e contas de acesso do cartório.',
    modulos: [
      modulo(
        'Por que a senha do cartório é um alvo',
        'O que torna uma senha fraca e por que isso importa aqui.',
        `Cartórios lidam com dados extremamente sensíveis: escrituras, procurações, informações de inventários e negócios imobiliários. Uma senha fraca ou reutilizada é hoje a porta de entrada mais comum para vazamento de dados e fraude documental — não é um problema "de TI", é um problema de responsabilidade civil e regulatória (LGPD, Provimento CNJ 149/213).

O que torna uma senha fraca:
- Ter menos de 10 caracteres.
- Usar dados pessoais (nome, data de nascimento, nome do cartório, "123456", "senha123").
- Ser reaproveitada em vários sistemas — se um vazar (mesmo um site pessoal), todos os outros ficam vulneráveis.
- Nunca ser trocada.

Boas práticas obrigatórias na plataforma:
- Mínimo de 10 caracteres, misturando letras, números e símbolos.
- Uma senha única por sistema — nunca reutilize a senha do e-mail pessoal na plataforma de treinamento ou em sistemas do cartório.
- Trocar a senha imediatamente se suspeitar de qualquer acesso indevido.
- Nunca compartilhar sua senha com colegas, "para agilizar", nem por telefone, chat ou e-mail — nenhum gestor ou suporte legítimo pede sua senha.

Um gerenciador de senhas (mesmo gratuito, como os embutidos no navegador) é preferível a anotar senhas em papel ou em arquivos de texto no computador.`
      ),
      modulo(
        'Autenticação em duas etapas (2FA)',
        'Por que ativar 2FA sempre que disponível.',
        `A autenticação em duas etapas (2FA) exige, além da senha, um segundo fator — um código enviado por SMS, um aplicativo autenticador ou biometria. Mesmo que sua senha seja descoberta, o invasor não consegue entrar sem esse segundo fator.

Onde ativar prioritariamente:
- E-mail corporativo e pessoal (o e-mail costuma ser a porta de recuperação de todas as outras contas).
- Sistemas de assinatura eletrônica e certificação digital.
- Acesso à plataforma de treinamento, quando o gestor habilitar essa opção.

Cuidados com 2FA:
- Nunca informe o código recebido por SMS ou app a quem te ligar "confirmando" seu cadastro — isso é o próprio ataque (interceptação de 2FA).
- Guarde os códigos de recuperação/backup em local seguro, não em um post-it na mesa.`
      ),
    ],
  },
  {
    titulo: 'Engenharia Social e Phishing',
    descricao: 'Como reconhecer tentativas de fraude por e-mail, telefone e mensagens.',
    modulos: [
      modulo(
        'O que é engenharia social',
        'Táticas comuns usadas para manipular funcionários de cartórios.',
        `Engenharia social é a manipulação psicológica para obter informações ou acesso indevido — o alvo não é o sistema, é a pessoa. É a técnica mais usada em fraudes contra cartórios, porque contorna qualquer proteção técnica.

Táticas mais comuns:
- Urgência falsa: "sua conta será bloqueada em 24h", "documento pendente de assinatura urgente".
- Falsa autoridade: mensagens que parecem vir da diretoria, de um tabelião ou até da própria MJ Consultoria pedindo uma ação imediata.
- Pretexto plausível: um "cliente" liga pedindo confirmação de dados de uma escritura em andamento, testando o que o atendente vai revelar.
- Curiosidade/recompensa: "você foi selecionado", convites e promoções falsas.

Regra de ouro: sempre que uma mensagem cria pressa ou medo, pare e verifique por um canal diferente do usado para te contatar (ligue de volta para o número oficial, não o que veio na mensagem).`
      ),
      modulo(
        'Identificando um e-mail de phishing',
        'Sinais práticos para checar antes de clicar em qualquer link.',
        `Antes de clicar em qualquer link ou abrir qualquer anexo, verifique:

1. Remetente: o domínio do e-mail é exatamente o oficial? Pequenas variações ("@mjconsultoria-suporte.com" em vez do domínio real) são um sinal claro de fraude.
2. Link: passe o mouse sobre o link (sem clicar) e veja para onde ele realmente aponta — muitas vezes o texto exibido não corresponde ao endereço real.
3. Urgência e erros: prazos apertados, erros de português e formatação estranha são sinais de alerta.
4. Pedido de dado sensível: nenhum sistema legítimo pede senha, código de 2FA ou dados de cartão por e-mail.

Na nossa plataforma, você pode ser incluído periodicamente em simulações internas de phishing — e-mails de teste, sem risco real, que ajudam a medir e treinar essa percepção. Se identificar um e-mail suspeito de verdade (não um teste), avise seu gestor imediatamente e não responda nem clique em nada.`
      ),
    ],
  },
  {
    titulo: 'Segurança em Dispositivos Móveis e Trabalho Remoto',
    descricao: 'Cuidados ao acessar sistemas do cartório fora do ambiente de trabalho.',
    modulos: [
      modulo(
        'Uso seguro de celular e notebook',
        'Configurações mínimas para proteger dispositivos que acessam dados do cartório.',
        `Sempre que um dispositivo pessoal ou móvel acessa e-mail corporativo, sistemas do cartório ou a plataforma de treinamento, ele passa a ser um ponto de risco para dados sensíveis.

Cuidados obrigatórios:
- Bloqueio de tela com senha, PIN ou biometria — nunca deixe o aparelho desbloqueado sobre a mesa.
- Manter o sistema operacional e aplicativos atualizados (atualizações corrigem falhas de segurança conhecidas).
- Nunca instalar aplicativos fora das lojas oficiais (Google Play / App Store).
- Ativar localização remota e apagamento remoto, para casos de perda ou roubo.
- Nunca acessar sistemas do cartório em computadores públicos (lan houses, hotéis, bibliotecas).

Se o dispositivo for perdido ou roubado, avise o gestor imediatamente para que as senhas e sessões ativas sejam revogadas.`
      ),
      modulo(
        'Redes Wi-Fi públicas e VPN',
        'Por que evitar redes abertas ao acessar sistemas sensíveis.',
        `Redes Wi-Fi públicas (aeroportos, cafés, shoppings) não são criptografadas de forma confiável — outras pessoas na mesma rede podem, com ferramentas simples, capturar dados trafegados.

Recomendações:
- Evite acessar sistemas do cartório em Wi-Fi público. Prefira a rede de dados do celular (4G/5G) ou uma VPN corporativa, se disponível.
- Se precisar usar Wi-Fi público, evite qualquer operação que envolva login, assinatura de documentos ou dados de clientes.
- Desative o compartilhamento automático de arquivos e a conexão automática a redes conhecidas no celular/notebook.`
      ),
    ],
  },
  {
    titulo: 'LGPD no Dia a Dia do Cartório',
    descricao: 'Como aplicar a Lei Geral de Proteção de Dados nas rotinas de atendimento.',
    modulos: [
      modulo(
        'Dados pessoais que passam pelo cartório',
        'O que a LGPD considera dado pessoal e por que isso é crítico na atividade notarial.',
        `A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) se aplica integralmente à atividade cartorária: CPF, RG, estado civil, filiação, patrimônio, dados de saúde (em inventários, por exemplo) e até dados de terceiros mencionados em escrituras são dados pessoais protegidos.

Princípios que valem para o dia a dia:
- Finalidade: só colete e use o dado para o que foi informado ao cliente (o ato notarial em questão).
- Necessidade: não peça ou guarde mais informação do que o necessário para o ato.
- Minimização de exposição: não deixe documentos com dados pessoais visíveis na mesa, tela ou impressora compartilhada.
- Confidencialidade: informações de um cliente nunca devem ser comentadas com terceiros, nem informalmente ("fulano está fazendo um inventário de tal valor").`
      ),
      modulo(
        'O que fazer diante de um incidente',
        'Passos imediatos se um dado pessoal for exposto, extraviado ou enviado ao destinatário errado.',
        `Incidente de segurança é qualquer evento que comprometa a confidencialidade, integridade ou disponibilidade de dados pessoais — um e-mail enviado ao destinatário errado, um documento impresso esquecido em local público, um pen drive perdido, ou um acesso indevido a sistemas.

Passos imediatos:
1. Não tente "esconder" ou apagar evidências — isso agrava a responsabilidade.
2. Comunique o gestor/encarregado de dados (DPO) imediatamente, com data, hora e o que aconteceu.
3. Preserve qualquer evidência (e-mail, log, foto) para a apuração.
4. O cartório tem prazo legal para avaliar se o incidente exige comunicação à ANPD e aos titulares afetados — por isso a velocidade do aviso interno é crítica.

Comunicar rápido um erro é sempre melhor, para você e para o cartório, do que ele ser descoberto depois por um cliente ou pela fiscalização.`
      ),
    ],
  },
];

async function main() {
  for (const t of TRILHAS) {
    const existing = await db.collection('trilhas')
      .where('titulo', '==', t.titulo)
      .where('oficial', '==', true)
      .limit(1)
      .get();
    if (!existing.empty) {
      console.log(`Já existe, pulando: "${t.titulo}"`);
      continue;
    }
    const ref = await db.collection('trilhas').add({
      titulo: t.titulo,
      descricao: t.descricao,
      perfis: PERFIS,
      modulos: t.modulos,
      ativa: true,
      oficial: true,
      tenantIds: ['GLOBAL'],
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`Criada: "${t.titulo}" -> ${ref.id}`);
  }
  console.log('Concluído.');
}

main().catch(e => { console.error(e); process.exit(1); });
