import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const ALLOWED_ROLES = ['SUPERADMIN', 'TENANT_ADMIN', 'gestor', 'admin'];

const ConfiguracaoView: React.FC = () => {
  const { state } = useApp();
  const { showToast } = useToast();
  const user = state.user;

  const [geminiKey, setGeminiKey]       = useState('');
  const [savedKey, setSavedKey]         = useState<string | null>(null);
  const [showKey, setShowKey]           = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [isLoading, setIsLoading]       = useState(true);

  const canEdit = user && ALLOWED_ROLES.includes(user.role);
  const tenantId = user?.tenantId;

  // Carrega config atual do Firestore
  useEffect(() => {
    if (!tenantId) { setIsLoading(false); return; }
    getDoc(doc(db, 'tenants', tenantId)).then(snap => {
      const key = snap.exists() ? (snap.data()?.geminiApiKey || null) : null;
      setSavedKey(key);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId || !geminiKey.trim()) return;
    if (!geminiKey.trim().startsWith('AIza')) {
      showToast('Chave inválida. Chaves Gemini começam com "AIza".', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'tenants', tenantId), {
        geminiApiKey: geminiKey.trim(),
        geminiKeyUpdatedAt: serverTimestamp(),
        geminiKeyUpdatedBy: user?.id,
      }, { merge: true });
      setSavedKey(geminiKey.trim());
      setGeminiKey('');
      showToast('Chave Gemini salva com sucesso!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar a chave. Tente novamente.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!tenantId) return;
    if (!window.confirm('Remover a chave Gemini do cartório? As funcionalidades de IA usarão a chave padrão da plataforma.')) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'tenants', tenantId), {
        geminiApiKey: null,
        geminiKeyUpdatedAt: serverTimestamp(),
        geminiKeyUpdatedBy: user?.id,
      }, { merge: true });
      setSavedKey(null);
      setGeminiKey('');
      showToast('Chave removida. Usando chave padrão da plataforma.', 'success');
    } catch (e) {
      showToast('Erro ao remover a chave.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const maskKey = (key: string) =>
    key.substring(0, 8) + '•'.repeat(Math.max(0, key.length - 12)) + key.substring(key.length - 4);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <i className="fa-solid fa-circle-notch animate-spin text-blue-500 text-2xl"></i>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-[#0A1628] font-black uppercase italic text-lg tracking-wide">
          Configurações do <span className="text-blue-500">Cartório</span>
        </h2>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
          Ambiente: {tenantId || '—'}
        </p>
      </div>

      {/* Card: Chave Gemini */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Cabeçalho do card */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <i className="fa-solid fa-key text-blue-500 text-sm"></i>
          </div>
          <div>
            <h3 className="text-sm font-black text-[#0A1628]">Chave de API Gemini</h3>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">
              Cobrança de tokens por conta do cartório
            </p>
          </div>
          {/* Badge de status */}
          {savedKey ? (
            <span className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-black uppercase tracking-widest text-emerald-600">
              <i className="fa-solid fa-circle-check text-xs"></i> Chave Ativa
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[9px] font-black uppercase tracking-widest text-amber-600">
              <i className="fa-solid fa-triangle-exclamation text-xs"></i> Usando Chave da Plataforma
            </span>
          )}
        </div>

        <div className="p-6 space-y-5">

          {/* Chave atual */}
          {savedKey && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Chave configurada</p>
                <p className="text-sm font-mono text-emerald-800 mt-0.5">
                  {showKey ? savedKey : maskKey(savedKey)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowKey(v => !v)}
                  className="text-emerald-600 hover:text-emerald-800 p-1.5 rounded-lg hover:bg-emerald-100 transition-all"
                  title={showKey ? 'Ocultar' : 'Mostrar'}
                >
                  <i className={`fa-solid ${showKey ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                </button>
                {canEdit && (
                  <button
                    onClick={handleRemove}
                    disabled={isSaving}
                    className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                    title="Remover chave"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Formulário para nova chave */}
          {canEdit && (
            <div className="space-y-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {savedKey ? 'Substituir chave' : 'Inserir chave Gemini'}
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#0A1628] outline-none focus:border-blue-500 font-mono transition-colors"
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  autoComplete="off"
                />
                <button
                  onClick={handleSave}
                  disabled={isSaving || !geminiKey.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  {isSaving
                    ? <i className="fa-solid fa-circle-notch animate-spin"></i>
                    : <i className="fa-solid fa-floppy-disk"></i>}
                  Salvar
                </button>
              </div>
            </div>
          )}

          {!canEdit && (
            <p className="text-xs text-slate-500 italic">
              Apenas gestores e administradores podem configurar a chave de API.
            </p>
          )}

          {/* Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-info text-blue-400"></i>
              Como obter a chave
            </p>
            <ol className="space-y-1">
              {[
                'Acesse aistudio.google.com',
                'Faça login com sua conta Google',
                'Clique em "Get API key" → "Create API key"',
                'Copie a chave gerada (começa com AIza…)',
                'Cole acima e clique em Salvar',
              ].map((step, i) => (
                <li key={i} className="text-[10px] text-slate-600 flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[8px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Aviso de segurança */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <i className="fa-solid fa-triangle-exclamation text-amber-500 text-xs mt-0.5"></i>
            <p className="text-[10px] text-amber-700 leading-relaxed">
              A chave é armazenada de forma segura no banco de dados e usada apenas para chamadas de IA desta organização.
              Nunca compartilhe sua chave com terceiros. Se houver uso indevido, regenere a chave no Google AI Studio.
            </p>
          </div>
        </div>
      </div>

      {/* Card: Info da plataforma */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <i className="fa-solid fa-circle-info text-slate-500 text-sm"></i>
          </div>
          <h3 className="text-sm font-black text-[#0A1628]">Sobre a Cobrança de IA</h3>
        </div>
        <div className="space-y-2 text-[11px] text-slate-600 leading-relaxed">
          <p>
            <strong className="text-[#0A1628]">Sem chave configurada:</strong> as funcionalidades de IA usam a cota da plataforma CartórioEDU (sujeita a limite compartilhado).
          </p>
          <p>
            <strong className="text-[#0A1628]">Com chave própria:</strong> todas as chamadas de IA do seu cartório usam diretamente sua conta Google AI Studio. A cobrança é feita no seu projeto Google Cloud.
          </p>
          <p>
            <strong className="text-[#0A1628]">Plano gratuito Gemini:</strong> 1.500 requisições/dia por modelo (gemini-2.0-flash-lite e gemini-2.0-flash com cotas independentes). Suficiente para uso normal.
          </p>
        </div>
      </div>

    </div>
  );
};

export default ConfiguracaoView;
