// Expande as 4 trilhas oficiais de segurança/cyber-higiene (seed-trilhas-seguranca.mjs)
// de 2 para 6+ módulos cada, com conteúdo substantivo, e preenche instrutor/formato/
// cargaHoraria (campos adicionados depois do seed original). Idempotente: só adiciona
// os módulos cujo título ainda não existe na trilha.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const key = JSON.parse(readFileSync(new URL('./key-cartorio-edu.json', import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();

function modulo(titulo, descricao, conteudo, { tipo = 'obrigatorio', temQuiz = true, notaMinima = 7 } = {}) {
  return { id: randomUUID(), titulo, descricao, tipo, conteudo, temQuiz, notaMinima };
}

const NOVOS_MODULOS = {
  'Segurança de Senhas e Autenticação': {
    instrutor: 'Equipe de Segurança da Informação — MJ Consultoria',
    formato: 'ead',
    cargaHoraria: 2,
    modulos: [
      modulo(
        'Gerenciadores de senha: uso seguro',
        'Como usar um cofre de senhas em vez de decorar ou anotar.',
        `Ter uma senha forte e única para cada sistema é inviável de memorizar sem ajuda — é exatamente para isso que existem os gerenciadores de senha (também chamados de "cofres de senha").

Como funcionam: você memoriza apenas UMA senha mestra forte, e o gerenciador guarda (de forma criptografada) todas as outras, podendo até gerá-las automaticamente com alta complexidade.

Opções aceitáveis para uso no cartório:
- Gerenciador embutido no navegador (Chrome, Edge, Firefox) — melhor que nada, mas menos robusto.
- Aplicativos dedicados (Bitwarden, 1Password, KeePass) — recomendados quando o gestor autorizar a instalação.

Boas práticas:
- A senha mestra do gerenciador deve ser a mais forte de todas as suas senhas e nunca deve ser reutilizada em nenhum outro lugar.
- Ative a autenticação em duas etapas no próprio gerenciador, se disponível.
- Nunca exporte a lista de senhas em texto puro (arquivo .csv, por exemplo) e deixe salva no computador ou enviada por e-mail.
- Ao desligar-se do cartório, todas as senhas guardadas em um gerenciador pessoal usado para sistemas corporativos devem ser trocadas imediatamente pelo gestor.

Evite: anotar senhas em post-it, cadernos, arquivos "senhas.txt" no desktop ou mensagens fixadas no WhatsApp — são os locais mais comuns de vazamento interno.`
      ),
      modulo(
        'Sinais de que uma conta foi comprometida',
        'Como perceber cedo um acesso indevido e o que fazer nos primeiros minutos.',
        `Quanto mais rápido um acesso indevido é identificado, menor o estrago. Fique atento a estes sinais:

- Notificação de login que você não reconhece (local, dispositivo ou horário incomum).
- E-mails de "redefinição de senha" que você não solicitou.
- Contatos avisando que receberam mensagens suas que você não enviou.
- Arquivos, e-mails enviados ou configurações alteradas sem você ter feito isso.
- Impossibilidade repentina de entrar com sua senha habitual.

Ação imediata (nesta ordem):
1. Se ainda conseguir acessar a conta, troque a senha na hora, usando um dispositivo diferente e confiável.
2. Encerre todas as sessões ativas (a maioria dos sistemas tem a opção "sair de todos os dispositivos").
3. Avise o gestor/TI imediatamente, mesmo que ache que já resolveu — pode haver acesso residual ou dados já copiados.
4. Verifique se a mesma senha foi usada em outros sistemas e troque-a em todos eles também.
5. Registre o ocorrido para fins de auditoria: data, hora, o que foi observado.

Demorar para avisar "para não incomodar" é o erro mais comum e o que mais amplia o dano — não existe constrangimento em reportar um incidente, existe risco em escondê-lo.`
      ),
      modulo(
        'Política de senhas do cartório e responsabilidade individual',
        'O que a plataforma exige e por que essas regras existem.',
        `A plataforma aplica uma política mínima de senha, mas ela só funciona se cada colaborador entender o motivo de cada regra:

- Comprimento mínimo de 10 caracteres: senhas curtas podem ser quebradas por força bruta em minutos com ferramentas comuns; a cada caractere a mais, o tempo necessário cresce exponencialmente.
- Bloqueio após tentativas malsucedidas: impede ataques automatizados que tentam milhares de combinações por minuto (aumenta o tempo de defesa, não pune erro de digitação ocasional).
- Troca periódica recomendada: reduz a janela de exposição caso uma senha tenha vazado sem que ninguém tenha percebido ainda.
- Histórico de senhas (impedir reutilização): evita o hábito de "trocar e voltar" para a mesma senha antiga já potencialmente exposta.

Responsabilidade individual: mesmo com toda a política técnica em vigor, a senha continua sendo pessoal e intransferível. Compartilhar credenciais — mesmo com um colega de confiança, mesmo "só hoje" — quebra a cadeia de responsabilidade: se algo for feito com aquele login, não há como comprovar quem realmente agiu, e isso pode gerar prejuízo tanto para o cartório quanto para quem emprestou a senha.

Conformidade: o controle de acesso individualizado é exigido pelo Provimento CNJ nº 213/2026 (art. 10 e 11) como parte da política de segurança da informação de toda serventia.`
      ),
      modulo(
        'Reconhecendo tentativas de recuperação de senha fraudulentas',
        'Como golpistas exploram o fluxo de "esqueci minha senha" para invadir contas.',
        `Um dos ataques mais eficazes contra senhas não tenta adivinhá-las — engana a vítima para que ela mesma entregue o código de recuperação.

Como o golpe geralmente acontece:
1. O golpista já sabe seu e-mail ou telefone (obtido em vazamentos públicos ou redes sociais) e solicita a redefinição de senha de uma conta sua em um sistema real.
2. Você recebe um código de verificação legítimo, do sistema real.
3. Logo em seguida, o golpista liga ou manda mensagem se passando por "suporte técnico" ou "segurança da plataforma", dizendo que detectou uma tentativa de invasão na sua conta e pedindo que você "confirme" informando o código que acabou de receber.
4. Ao informar o código, você mesmo entrega ao golpista o acesso à sua conta.

Como se proteger:
- Nenhuma equipe de suporte legítima jamais pede o código de verificação que você recebeu por SMS, e-mail ou aplicativo — o código existe exatamente para você usar, e só você.
- Se receber um código de recuperação que você não solicitou, isso já é um sinal de que alguém está tentando acessar sua conta — troque a senha imediatamente e avise o gestor, mesmo sem ter informado nada a ninguém.
- Desconfie de qualquer contato (ligação, mensagem) que mencione esse código e peça para você "ler em voz alta" ou "colar aqui".`
      ),
    ],
  },

  'Engenharia Social e Phishing': {
    instrutor: 'Equipe de Segurança da Informação — MJ Consultoria',
    formato: 'ead',
    cargaHoraria: 2,
    modulos: [
      modulo(
        'Vishing e Smishing: golpes por telefone e SMS',
        'Engenharia social não acontece só por e-mail.',
        `Phishing por e-mail é o mais conhecido, mas os golpistas usam qualquer canal de contato disponível:

Vishing (voice + phishing): ligações telefônicas em que o golpista se passa por banco, órgão público, "suporte da plataforma" ou até por um colega/superior (às vezes usando voz clonada por IA). Costuma criar urgência para que a vítima não tenha tempo de verificar a informação com calma.

Smishing (SMS + phishing): mensagens de texto ou WhatsApp com links maliciosos, frequentemente fingindo ser entregas, bancos, ou notificações de sistemas que o cartório usa.

Sinais de alerta em ambos os casos:
- Pedido de ação imediata ("responda em 10 minutos ou sua conta será bloqueada").
- Solicitação de dados sensíveis (senha, código de verificação, dados de clientes) por telefone ou mensagem.
- Números desconhecidos ou links encurtados que escondem o destino real.
- Tom de urgência combinado com autoridade ("aqui é da diretoria", "aqui é do suporte técnico da MJ Consultoria").

Como reagir: desligue ou não responda, e verifique a informação por um canal que você mesmo já conhece e confia (ligue de volta para o número oficial já salvo, não o que ligou; acesse o sistema digitando o endereço manualmente, não pelo link recebido).`
      ),
      modulo(
        'Golpes específicos contra cartórios',
        'Padrões de ataque observados especificamente contra serventias notariais.',
        `Cartórios são alvos atrativos porque lidam com atos de alto valor financeiro e prazos legais rígidos — características que os golpistas exploram diretamente:

Falso cliente urgente: alguém liga ou escreve dizendo estar "no meio de uma escritura" ou "prestes a perder um prazo", pedindo que dados de um processo sejam confirmados ou alterados (como dados bancários de repasse de valores) por telefone ou e-mail, sem os canais formais de verificação de identidade.

Falsa autoridade interna: e-mails ou mensagens que parecem vir do tabelião, de um sócio ou da MJ Consultoria, pedindo alteração emergencial de cadastro, envio de documentos sigilosos ou aprovação de um pagamento fora do processo normal.

Fraude de e-mail comprometido (BEC — Business E-mail Compromise): o golpista invade ou falsifica o e-mail de uma parte real do processo (comprador, vendedor, advogado) e, no meio de uma negociação legítima já em andamento, insere uma mensagem pedindo que o pagamento de um ato notarial seja feito para uma conta bancária diferente da combinada originalmente.

Regra prática: qualquer alteração de dados bancários, de cadastro ou pedido de urgência fora do fluxo normal do ato deve ser confirmado por telefone, usando um número já conhecido e cadastrado — nunca o que veio na própria mensagem suspeita.`
      ),
      modulo(
        'Simulações de phishing e cultura de segurança',
        'Por que a plataforma testa periodicamente a equipe com e-mails simulados.',
        `Periodicamente, a plataforma pode incluir colaboradores em simulações internas de phishing: e-mails de teste, sem qualquer risco real, que imitam táticas reais de golpe para medir e treinar a capacidade da equipe de identificar tentativas de fraude.

Por que isso é feito:
- Treinamento teórico sozinho não garante reação correta sob pressão real — a simulação testa o comportamento de fato, no dia a dia.
- Os resultados (taxa de clique, tempo de resposta) ajudam o gestor a identificar onde reforçar o treinamento, nunca para punir individualmente quem clicar.
- Quem clica em uma simulação recebe, na hora, uma tela educativa explicando o que aconteceria em um ataque real e como o sinal deveria ter sido identificado.

O que fazer ao suspeitar de um e-mail (seja ele um teste ou um ataque real):
- Não clique em links nem baixe anexos.
- Não responda ao remetente.
- Avise o gestor ou o canal de segurança do cartório, informando de qual e-mail se trata.

Importante: os detalhes de como e quando as simulações acontecem não são divulgados previamente aos colaboradores — isso preservaria o "fator surpresa" necessário para o teste refletir uma reação genuína, do jeito que aconteceria em um ataque real.`
      ),
      modulo(
        'Estudo de caso: anatomia de um golpe real contra serventia',
        'Como um ataque de engenharia social se desenrola na prática, passo a passo.',
        `Caso ilustrativo (baseado em padrões reais reportados por serventias, sem dados de nenhum cartório específico):

Um funcionário recebe um e-mail que parece vir de um cliente com quem o cartório já vinha trocando mensagens sobre uma escritura de compra e venda de imóvel. O e-mail tem a mesma assinatura, o mesmo tom e até cita detalhes reais da negociação — porque a conta de e-mail do cliente havia sido comprometida dias antes, e o golpista está lendo toda a conversa anterior.

No momento em que o pagamento das custas e do valor do imóvel seria feito, chega uma mensagem "do cliente" avisando que houve um "problema no banco" e pedindo que o valor seja depositado em uma conta bancária diferente da combinada, "por segurança".

Onde o golpe poderia ter sido interrompido:
1. Qualquer mudança de dados bancários no meio de um processo já em andamento deveria acionar uma verificação obrigatória por telefone, usando o número já cadastrado do cliente — não um número informado na própria mensagem suspeita.
2. Pequenas inconsistências no domínio do e-mail (uma letra trocada, um domínio parecido) muitas vezes passam despercebidas quando o conteúdo parece familiar — por isso a verificação não pode depender só da leitura atenta, precisa ser um procedimento formal.
3. A pressa ("problema no banco", "hoje é o último dia") é sempre um sinal de alerta, mesmo vindo de alguém que parece ser quem diz ser.

Esse tipo de fraude já causou perdas reais de milhões de reais em transações imobiliárias em todo o mundo — a prevenção não depende de tecnologia, depende de procedimento seguido à risca mesmo sob pressão de prazo.`
      ),
    ],
  },

  'Segurança em Dispositivos Móveis e Trabalho Remoto': {
    instrutor: 'Equipe de Segurança da Informação — MJ Consultoria',
    formato: 'hibrida',
    cargaHoraria: 2,
    modulos: [
      modulo(
        'Trabalho remoto: acesso seguro a sistemas do cartório',
        'Cuidados específicos ao trabalhar de casa ou em trânsito.',
        `Trabalhar fora do ambiente físico do cartório (home office, atendimento externo, viagens) exige cuidados adicionais para manter o mesmo nível de proteção dos dados dos clientes.

Antes de começar a trabalhar remotamente:
- Confirme com o gestor qual é o método de acesso autorizado (VPN corporativa, acesso remoto supervisionado, ou sistemas em nuvem com autenticação multifator).
- Nunca improvise soluções alternativas de acesso "para facilitar" sem validação da equipe de segurança/TI.

Durante o trabalho remoto:
- Use uma rede confiável (a internet de casa ou dados móveis, nunca Wi-Fi público sem VPN).
- Mantenha a tela bloqueada sempre que se afastar do computador, mesmo dentro de casa.
- Evite imprimir documentos com dados de clientes em impressoras domésticas ou compartilhadas — se for indispensável, descarte o papel de forma segura (picotado), nunca no lixo comum.
- Não use e-mail pessoal para enviar ou receber documentos de trabalho, mesmo temporariamente.

Ao encerrar o expediente remoto: feche todas as sessões ativas nos sistemas do cartório e, se possível, não deixe o notebook de trabalho com sessões abertas por longos períodos sem uso.`
      ),
      modulo(
        'Aplicativos, permissões e vazamento de dados por apps',
        'Como aplicativos aparentemente inofensivos podem expor dados do cartório.',
        `Muitos aplicativos pedem permissões de acesso muito além do que sua função exige — acesso a contatos, câmera, microfone, arquivos e localização — e podem coletar e repassar essas informações sem que o usuário perceba.

Riscos específicos em um dispositivo que também acessa dados do cartório:
- Um app com acesso a "todos os arquivos" pode ler documentos sensíveis salvos ou sincronizados no dispositivo.
- Apps com acesso a contatos podem expor a lista de clientes e parceiros do cartório armazenada na agenda do celular.
- Extensões de navegador desnecessárias podem capturar tudo o que é digitado, inclusive senhas.

Boas práticas:
- Antes de instalar qualquer aplicativo em um dispositivo usado para trabalho, avalie se a permissão solicitada faz sentido para a função do app (um aplicativo de lanterna não precisa de acesso a contatos, por exemplo).
- Revise periodicamente as permissões já concedidas nas configurações do dispositivo e remova o que não for necessário.
- Prefira, sempre que possível, separar o dispositivo de uso pessoal do dispositivo usado para acessar sistemas do cartório.
- Desinstale aplicativos que não são mais usados — cada app instalado é uma superfície de risco a menos para monitorar quando é removido.`
      ),
      modulo(
        'Backup e sincronização segura de dados em dispositivos móveis',
        'Cuidados ao usar nuvem pessoal e sincronização automática.',
        `É comum que celulares e notebooks sincronizem automaticamente fotos, documentos e arquivos com serviços de nuvem pessoal (Google Drive, iCloud, OneDrive pessoal). Isso se torna um risco quando o dispositivo também é usado para tirar fotos de documentos, salvar anexos de e-mail corporativo ou baixar arquivos de sistemas do cartório.

O problema: um documento de cliente fotografado "rapidinho" no celular para consulta pode ser sincronizado automaticamente para uma nuvem pessoal, fora do controle e da segurança da plataforma do cartório — e permanecer lá indefinidamente, mesmo depois de apagado do celular.

Boas práticas:
- Nunca fotografe documentos de clientes com o celular pessoal como atalho — utilize sempre os sistemas oficiais de digitalização do cartório.
- Verifique se a sincronização automática de fotos e arquivos está desativada para pastas que possam conter capturas de tela ou documentos de trabalho.
- Ao usar um notebook de trabalho, confirme com o gestor qual é o sistema de backup oficial autorizado (evite serviços de nuvem pessoal não homologados).
- Em caso de desligamento do colaborador, os backups pessoais em nuvem que porventura contenham dados do cartório devem ser identificados e removidos como parte do processo de desligamento.`
      ),
      modulo(
        'Descarte seguro de dispositivos e mídias antigas',
        'O que fazer antes de vender, doar ou descartar um aparelho usado para o trabalho.',
        `Formatar um celular ou computador pela opção padrão de "restaurar configurações de fábrica" nem sempre apaga os dados de forma irrecuperável — ferramentas de recuperação de dados conseguem, em muitos casos, restaurar arquivos "apagados" dessa forma.

Antes de descartar, vender, doar ou trocar qualquer dispositivo (celular, notebook, pen drive, HD externo) que já tenha acessado e-mail corporativo, sistemas do cartório ou documentos de clientes:

1. Avise o gestor/TI para que o dispositivo seja avaliado antes do descarte.
2. Remova o acesso a contas corporativas e sistemas do cartório antes de qualquer outra etapa.
3. Sempre que possível, utilize ferramentas de apagamento seguro (sobrescrita de dados), não apenas a formatação padrão.
4. Mídias físicas como pen drives e HDs antigos que não puderem ser apagados com segurança devem ser fisicamente destruídos, nunca simplesmente jogados no lixo.
5. Documentos impressos com dados pessoais devem ser descartados picotados ou por serviço de destruição certificada — nunca no lixo comum.

Essa etapa é exigida pela política de segurança da informação da serventia (Provimento CNJ nº 213/2026) como parte do ciclo de vida seguro dos ativos de tecnologia, e evita que dados de clientes continuem acessíveis muito depois de um equipamento ter sido descartado.`
      ),
    ],
  },

  'LGPD no Dia a Dia do Cartório': {
    instrutor: 'Equipe de Compliance e Proteção de Dados — MJ Consultoria',
    formato: 'ead',
    cargaHoraria: 2.5,
    modulos: [
      modulo(
        'Bases legais aplicáveis aos atos notariais',
        'Por que o cartório pode tratar dados pessoais sem pedir consentimento a cada ato.',
        `Diferente do que muita gente pensa, a LGPD não exige consentimento do titular para todo e qualquer tratamento de dados — existem 10 bases legais previstas no art. 7º da lei, e a atividade notarial se apoia principalmente em três delas:

Cumprimento de obrigação legal ou regulatória (art. 7º, II): o cartório é obrigado por lei a coletar e registrar determinados dados para lavrar escrituras, procurações e demais atos — essa obrigação legal já autoriza o tratamento, sem necessidade de consentimento adicional do titular.

Execução de contrato ou de procedimentos preliminares (art. 7º, V): quando o dado é necessário para a realização do próprio ato solicitado pelo cliente (ex.: dados para lavrar uma escritura de compra e venda).

Exercício regular de direitos em processo (art. 7º, VI): aplica-se, por exemplo, a dados necessários para atender a uma ordem judicial ou fiscalização da corregedoria.

Por que isso importa no atendimento: como a base legal já está definida pela própria natureza do ato notarial, não é correto pedir ao cliente para "assinar um termo de consentimento" para dados que são obrigatórios para o ato — isso pode até confundir o cliente sobre o caráter obrigatório do fornecimento daquela informação. O que deve ser feito é informar de forma transparente por que aquele dado está sendo coletado, quando perguntado.`
      ),
      modulo(
        'Direitos dos titulares de dados e como atendê-los',
        'O que fazer quando um cliente pergunta sobre seus dados pessoais no cartório.',
        `A LGPD (art. 18) garante aos titulares de dados uma série de direitos que podem ser exercidos a qualquer momento, inclusive por pessoas que não estão em atendimento presencial naquele momento — ex-clientes, ou terceiros mencionados em um ato antigo.

Principais direitos que podem chegar ao balcão ou por e-mail:
- Confirmação da existência de tratamento: o cliente quer saber se o cartório tem dados dele.
- Acesso aos dados: o cliente quer saber quais dados especificamente estão armazenados.
- Correção de dados incompletos, inexatos ou desatualizados.
- Informação sobre com quem os dados foram compartilhados (ex.: órgãos de registro, cartório de imóveis).
- Eliminação de dados tratados com consentimento (não se aplica a dados que o cartório é legalmente obrigado a guardar pelo prazo legal — isso deve ser explicado com transparência ao titular).

O que o colaborador deve fazer ao receber uma solicitação desse tipo:
1. Nunca ignorar ou tratar como "reclamação genérica" — é um direito legal com prazo de resposta.
2. Encaminhar imediatamente ao gestor ou ao canal formal de atendimento a titulares, mesmo que a resposta pareça óbvia.
3. Registrar data e conteúdo do pedido, para controle do prazo de resposta.

Nunca prometa um prazo de resposta ao cliente sem confirmar com o gestor — o cartório tem um procedimento formal e prazos legais específicos para cada tipo de solicitação.`
      ),
      modulo(
        'Documentação obrigatória: ROPA e RIPD na prática',
        'O que são esses documentos e por que a corregedoria pode exigi-los.',
        `Duas siglas aparecem com frequência em auditorias de conformidade LGPD e merecem ser conhecidas por toda a equipe, mesmo que o preenchimento seja responsabilidade da gestão:

ROPA (Registro das Operações de Tratamento de Dados Pessoais): um documento que lista, de forma organizada, quais dados pessoais o cartório trata, para qual finalidade, com que base legal, por quanto tempo são guardados e com quem são compartilhados. Funciona como um "mapa" completo de como os dados circulam dentro da serventia — exigido pelo Provimento CNJ nº 213/2026.

RIPD (Relatório de Impacto à Proteção de Dados, também chamado de DPIA): um documento mais aprofundado, exigido para operações de tratamento consideradas de maior risco aos titulares — por exemplo, tratamento de grande volume de dados sensíveis (como dados de saúde em inventários) ou uso de novas tecnologias de análise de dados.

Por que isso afeta o dia a dia: quando um novo tipo de atendimento, sistema ou processo é criado no cartório, a equipe deve avisar o gestor/encarregado de dados antes de colocá-lo em prática, para que seja avaliado se é necessário atualizar o ROPA ou elaborar um RIPD — criar um processo novo "por fora" da documentação oficial é uma das causas mais comuns de não conformidade encontrada em fiscalizações.

Na prática do balcão: se você perceber que está coletando ou usando um dado de um jeito que não é feito rotineiramente, é um bom sinal para avisar o gestor e verificar se isso já está mapeado.`
      ),
      modulo(
        'O papel do Encarregado de Dados (DPO) e quando acioná-lo',
        'Quem é essa pessoa na estrutura do cartório e por que ela existe.',
        `O Encarregado de Dados (também chamado de DPO, Data Protection Officer) é a pessoa formalmente designada pelo cartório para ser o canal de comunicação entre a serventia, os titulares de dados e a Autoridade Nacional de Proteção de Dados (ANPD) — exigência do art. 41 da LGPD e do Provimento CNJ nº 213/2026 (art. 4º).

Responsabilidades do Encarregado:
- Receber e encaminhar solicitações de titulares de dados.
- Orientar colaboradores e a gestão sobre práticas de proteção de dados.
- Avaliar e coordenar a resposta a incidentes de segurança que envolvam dados pessoais.
- Ser o ponto de contato oficial em caso de fiscalização ou notificação à ANPD.

Quando um colaborador deve acionar o Encarregado, diretamente ou por meio do gestor:
- Ao receber qualquer solicitação formal de um titular sobre seus dados (acesso, correção, exclusão).
- Ao identificar ou suspeitar de um incidente de segurança envolvendo dados pessoais (mesmo pequeno, como um e-mail mal endereçado).
- Ao ter dúvidas sobre se determinado tratamento de dados está de acordo com a LGPD, antes de simplesmente seguir em frente.
- Ao ser contatado por qualquer órgão fiscalizador em relação a dados pessoais.

Ter um canal claro e conhecido por toda a equipe para essas situações é, em si, um dos itens avaliados em fiscalizações — não basta o cartório ter um Encarregado nomeado no papel, a equipe precisa saber quem é essa pessoa e como acioná-la.`
      ),
    ],
  },
};

async function main() {
  const snap = await db.collection('trilhas').where('oficial', '==', true).get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const plano = NOVOS_MODULOS[data.titulo];
    if (!plano) continue;

    const existentes = new Set((data.modulos || []).map(m => m.titulo));
    const aAdicionar = plano.modulos.filter(m => !existentes.has(m.titulo));

    const update = {};
    if (aAdicionar.length > 0) {
      update.modulos = FieldValue.arrayUnion(...aAdicionar);
    }
    if (!data.instrutor) update.instrutor = plano.instrutor;
    if (!data.formato) update.formato = plano.formato;
    if (!data.cargaHoraria) update.cargaHoraria = plano.cargaHoraria;

    if (Object.keys(update).length === 0) {
      console.log(`Sem alterações: "${data.titulo}"`);
      continue;
    }

    await doc.ref.update(update);
    console.log(`Atualizada "${data.titulo}": +${aAdicionar.length} módulo(s), total final ${
      (data.modulos || []).length + aAdicionar.length
    } módulos.`);
  }

  console.log('Concluído.');
}

main().catch(e => { console.error(e); process.exit(1); });
