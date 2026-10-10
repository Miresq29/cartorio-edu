// Configuração global (toda a plataforma, não por tenant) do certificado modelo 2:
// assinatura da instrutora (imagem) + nome/cargo/qualificações. SUPERADMIN only.
import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';

interface ConfigCertificado {
  instrutorNome: string;
  instrutorCargo: string;
  instrutorQualificacoes: string;
  assinaturaUrl?: string;
  emissoraRazaoSocial: string;
  emissoraCnpj: string;
  localEmissaoPadrao: string;
  modalidadePadrao: string;
}

const PADRAO: ConfigCertificado = {
  instrutorNome: 'Mirian Jabur',
  instrutorCargo: 'Instrutora e Responsável Técnica',
  instrutorQualificacoes: 'DPO EXIN · CISM · ISO/IEC 27001 Lead Auditor',
  emissoraRazaoSocial: 'AG Serviços em TI Ltda. (MJ Consultoria)',
  emissoraCnpj: '07.113.086/0001-08',
  localEmissaoPadrao: 'Belo Horizonte/MG',
  modalidadePadrao: 'EAD assíncrona',
};

const ConfigCertificadoPanel: React.FC = () => {
  const { showToast } = useToast();
  const [config, setConfig] = useState<ConfigCertificado>(PADRAO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'config', 'certificado')).then(snap => {
      if (snap.exists()) setConfig({ ...PADRAO, ...snap.data() } as ConfigCertificado);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const salvar = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'certificado'), { ...config, atualizadoEm: serverTimestamp() }, { merge: true });
      showToast('Configuração do certificado salva!', 'success');
    } catch {
      showToast('Erro ao salvar configuração.', 'error');
    }
    setSaving(false);
  };

  const uploadAssinatura = async (file: File) => {
    if (!file.type.includes('png')) {
      showToast('Envie um PNG com fundo transparente.', 'error');
      return;
    }
    setUploading(true);
    try {
      const assinaturaRef = ref(storage, 'config/assinatura.png');
      await uploadBytes(assinaturaRef, file);
      const url = await getDownloadURL(assinaturaRef);
      const novo = { ...config, assinaturaUrl: url };
      setConfig(novo);
      await setDoc(doc(db, 'config', 'certificado'), { ...novo, atualizadoEm: serverTimestamp() }, { merge: true });
      showToast('Assinatura atualizada!', 'success');
    } catch {
      showToast('Erro ao enviar a imagem.', 'error');
    }
    setUploading(false);
  };

  const campo = (k: keyof ConfigCertificado, label: string, placeholder?: string) => (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
      <input value={config[k] || ''} onChange={e => setConfig(c => ({ ...c, [k]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy outline-none focus:border-gold" />
    </div>
  );

  if (loading) return null;

  return (
    <div className="bg-white border border-gold/30 rounded-[32px] shadow-lg overflow-hidden">
      <button type="button" onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between gap-4 p-6 hover:bg-gold/5 transition-all">
        <div className="flex items-center gap-4 text-left">
          <div className="w-12 h-12 rounded-2xl bg-gold/15 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-signature text-gold text-lg"></i>
          </div>
          <div>
            <p className="text-navy font-black text-sm uppercase tracking-widest">Configuração do Certificado</p>
            <p className="text-slate-400 text-[11px]">Assinatura, instrutora e dados da emissora — vale para toda a plataforma</p>
          </div>
        </div>
        <i className={`fa-solid fa-chevron-${aberto ? 'up' : 'down'} text-slate-400`}></i>
      </button>

      {aberto && (
        <div className="p-6 pt-0 space-y-6 border-t border-slate-100">
          <div className="flex items-center gap-4 pt-6">
            {config.assinaturaUrl ? (
              <img src={config.assinaturaUrl} alt="Assinatura atual" className="h-16 bg-slate-50 rounded-xl border border-slate-200 px-4" />
            ) : (
              <div className="h-16 w-40 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 uppercase font-black">
                Sem assinatura
              </div>
            )}
            <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 text-navy px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
              {uploading ? 'Enviando...' : 'Enviar PNG (fundo transparente)'}
              <input type="file" accept="image/png" className="hidden" disabled={uploading}
                onChange={e => e.target.files?.[0] && uploadAssinatura(e.target.files[0])} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campo('instrutorNome', 'Nome da Instrutora')}
            {campo('instrutorCargo', 'Cargo')}
            {campo('instrutorQualificacoes', 'Qualificações', 'Ex: DPO EXIN · CISM · ISO/IEC 27001 Lead Auditor')}
            {campo('emissoraRazaoSocial', 'Emissora (Razão Social)')}
            {campo('emissoraCnpj', 'CNPJ da Emissora')}
            {campo('localEmissaoPadrao', 'Local de Emissão Padrão')}
            {campo('modalidadePadrao', 'Modalidade Padrão')}
          </div>

          <button onClick={salvar} disabled={saving}
            className="bg-navy disabled:opacity-50 text-white px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest">
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ConfigCertificadoPanel;
