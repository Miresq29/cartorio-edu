// Editor da "Marca própria" de um cliente (só SUPERADMIN, em Gestão de Empresas): duas cores,
// logo e nome de exibição, com prévia ao vivo já com os ajustes automáticos de contraste que a
// plataforma aplica (utils/tema.ts). O logo é reduzido no navegador e guardado no próprio
// documento do cliente (data URL) — sem custo de armazenamento extra.
import React, { useMemo, useState } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { CORES_PADRAO, MarcaCliente, calcularTema, contraste, hexParaRgb, rgbParaHex } from '../../utils/tema';

interface Props {
  tenant: { id: string; name: string; marca?: MarcaCliente; marcaHabilitada?: boolean };
  onClose: () => void;
}

const LOGO_MAX_L = 480, LOGO_MAX_A = 160, LOGO_MAX_BYTES = 250_000;

function reduzirLogo(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const escala = Math.min(1, LOGO_MAX_L / (img.width || LOGO_MAX_L), LOGO_MAX_A / (img.height || LOGO_MAX_A));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.width || LOGO_MAX_L) * escala));
        canvas.height = Math.max(1, Math.round((img.height || LOGO_MAX_A) * escala));
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        let url = canvas.toDataURL('image/png');
        if (url.length > LOGO_MAX_BYTES) url = canvas.toDataURL('image/webp', 0.9);
        if (url.length > LOGO_MAX_BYTES) { reject(new Error('Logo grande demais mesmo após reduzir. Use um PNG mais simples.')); return; }
        resolve(url);
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}

const rgb = (canais: string) => `rgb(${canais.split(' ').join(',')})`;
const hexDe = (canais: string) => rgbParaHex(canais.split(' ').map(Number) as [number, number, number]);

const EditorMarca: React.FC<Props> = ({ tenant, onClose }) => {
  const { showToast } = useToast();
  const [corPrimaria, setCorPrimaria] = useState(tenant.marca?.corPrimaria || CORES_PADRAO.corPrimaria);
  const [corDestaque, setCorDestaque] = useState(tenant.marca?.corDestaque || CORES_PADRAO.corDestaque);
  const [logo, setLogo] = useState(tenant.marca?.logo || '');
  const [nome, setNome] = useState(tenant.marca?.nomeExibicao || tenant.name);
  const [salvando, setSalvando] = useState(false);

  const validas = !!hexParaRgb(corPrimaria) && !!hexParaRgb(corDestaque);
  const v = useMemo(() => calcularTema({ corPrimaria, corDestaque }), [corPrimaria, corDestaque]);
  const primariaAjustada = validas && hexDe(v['c-navy']).toLowerCase() !== corPrimaria.toLowerCase();
  const destaqueAjustado = validas && hexDe(v['c-gold']).toLowerCase() !== corDestaque.toLowerCase();

  const enviarLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setLogo(await reduzirLogo(f)); } catch (err: any) { showToast(err?.message || 'Não foi possível usar este logo.', 'error'); }
  };

  const salvar = async () => {
    if (!validas) { showToast('Informe as cores no formato #RRGGBB.', 'error'); return; }
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'tenants', tenant.id), {
        marca: { corPrimaria, corDestaque, logo, nomeExibicao: nome.trim() || tenant.name },
      });
      showToast(tenant.marcaHabilitada ? 'Marca salva e aplicada.' : 'Marca salva. Ligue o recurso "Marca própria" para aplicar ao cliente.', 'success');
      onClose();
    } catch {
      showToast('Erro ao salvar a marca.', 'error');
    } finally { setSalvando(false); }
  };

  const remover = async () => {
    if (!confirm(`Remover a marca de ${tenant.name}? O cliente volta ao visual padrão.`)) return;
    await updateDoc(doc(db, 'tenants', tenant.id), { marca: deleteField(), marcaHabilitada: false });
    showToast('Marca removida.', 'success');
    onClose();
  };

  const campoCor = (rotulo: string, valor: string, setValor: (s: string) => void, ajuda: string) => (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-navy">{rotulo}</label>
      <div className="flex items-center gap-3">
        <input type="color" value={hexParaRgb(valor) ? valor : '#000000'} onChange={e => setValor(e.target.value)}
          className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer bg-white p-1" aria-label={rotulo} />
        <input value={valor} onChange={e => setValor(e.target.value)} maxLength={7}
          className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-navy outline-none focus:border-blue-500" />
      </div>
      <p className="text-xs text-slate-500">{ajuda}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-5xl max-h-[94vh] overflow-auto rounded-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-black text-navy">Marca própria — {tenant.name}</h3>
            <p className="text-sm text-slate-500">Cores e logo aplicados em toda a plataforma para este cliente.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="w-10 h-10 rounded-xl hover:bg-slate-100 text-slate-500"><i className="fa-solid fa-xmark"></i></button>
        </div>

        <div className="grid md:grid-cols-2 gap-8 p-7">
          {/* Configuração */}
          <div className="space-y-6">
            {campoCor('Cor principal', corPrimaria, setCorPrimaria, 'Menu lateral, cabeçalhos e botões principais (texto branco por cima).')}
            {campoCor('Cor de destaque', corDestaque, setCorDestaque, 'Realces, ícones, selos e botões secundários.')}
            {(primariaAjustada || destaqueAjustado) && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <i className="fa-solid fa-circle-info mr-1.5"></i>
                Para manter tudo legível (contraste de acessibilidade), a plataforma usará
                {primariaAjustada && <> a cor principal <b className="font-mono">{hexDe(v['c-navy'])}</b></>}
                {primariaAjustada && destaqueAjustado && ' e'}
                {destaqueAjustado && <> o destaque <b className="font-mono">{hexDe(v['c-gold'])}</b></>}
                {' '}— tons próximos dos escolhidos.
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-navy">Logo</label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="h-16 min-w-[120px] bg-white border border-slate-200 rounded-xl flex items-center justify-center px-3">
                  {logo ? <img src={logo} alt="Logo" className="max-h-12 max-w-[200px] object-contain" /> : <span className="text-xs text-slate-400">Sem logo</span>}
                </div>
                <label className="cursor-pointer bg-navy text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:opacity-90">
                  <i className="fa-solid fa-upload mr-2"></i>Enviar logo
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={enviarLogo} className="hidden" />
                </label>
                {logo && <button onClick={() => setLogo('')} className="text-sm text-red-600 font-bold">Remover logo</button>}
              </div>
              <p className="text-xs text-slate-500">PNG com fundo transparente funciona melhor. A imagem é reduzida automaticamente.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-navy" htmlFor="nome-marca">Nome exibido</label>
              <input id="nome-marca" value={nome} onChange={e => setNome(e.target.value)} maxLength={60}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy outline-none focus:border-blue-500" />
              <p className="text-xs text-slate-500">Aparece no topo do menu quando não há logo.</p>
            </div>
          </div>

          {/* Prévia ao vivo */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-navy">Prévia</p>
            <div className="rounded-2xl overflow-hidden border border-slate-200 flex h-[380px]">
              <div className="w-[42%] p-3 space-y-2" style={{ background: rgb(v['c-bg-base']) }}>
                <div className="flex items-center gap-2 pb-2" style={{ borderBottom: `1px solid ${rgb(v['c-bg-elevated'])}` }}>
                  {logo
                    ? <div className="bg-white rounded-lg px-2 py-1"><img src={logo} alt="" className="max-h-7 max-w-[110px] object-contain" /></div>
                    : <span className="font-bold text-sm truncate" style={{ color: rgb(v['c-text-primary']) }}>{nome}</span>}
                </div>
                <p className="text-[9px] font-black tracking-widest" style={{ color: rgb(v['c-text-secondary']) }}>CAPACITAÇÃO</p>
                <div className="rounded-lg px-2.5 py-2 text-xs font-bold" style={{ background: rgb(v['c-blue-500']), color: '#fff' }}>Trilhas</div>
                {['Exames', 'Meu Progresso', 'Certificados'].map(i => (
                  <div key={i} className="px-2.5 py-1.5 text-xs" style={{ color: rgb(v['c-text-muted']) }}>{i}</div>
                ))}
              </div>
              <div className="flex-1 bg-slate-50 p-4 space-y-3">
                <p className="text-[10px] font-black tracking-widest" style={{ color: rgb(v['c-gold-strong']) }}>MÓDULO 1 DE 6</p>
                <p className="text-lg font-black" style={{ color: rgb(v['c-navy']) }}>Título da tela</p>
                <p className="text-xs" style={{ color: rgb(v['c-gold-body']) }}>Texto de apoio com a cor de destaque escurecida para leitura.</p>
                <span className="inline-block text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: rgb(v['c-gold-bg']), color: rgb(v['c-gold-strong']) }}>Selo</span>
                <div className="flex gap-2 pt-1">
                  <span className="text-xs font-bold px-3 py-2 rounded-lg" style={{ background: rgb(v['c-navy']), color: '#fff' }}>Botão principal</span>
                  <span className="text-xs font-bold px-3 py-2 rounded-lg" style={{ background: rgb(v['c-gold']), color: rgb(v['c-on-gold']) }}>Destaque</span>
                </div>
                <span className="inline-block text-xs font-bold px-3 py-2 rounded-lg" style={{ background: rgb(v['c-blue-600']), color: '#fff' }}>Ação</span>
                <p className="text-[10px] text-slate-500 pt-2">
                  Contraste do texto branco na cor principal: {contraste([255, 255, 255], v['c-navy'].split(' ').map(Number) as [number, number, number]).toFixed(1)}:1 (mínimo 4,5)
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-7 py-5 border-t border-slate-100">
          {tenant.marca ? <button onClick={remover} className="text-sm font-bold text-red-600">Remover marca</button> : <span />}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600">Cancelar</button>
            <button onClick={salvar} disabled={salvando || !validas}
              className="px-6 py-2.5 rounded-xl bg-navy text-white text-sm font-bold disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar marca'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorMarca;
