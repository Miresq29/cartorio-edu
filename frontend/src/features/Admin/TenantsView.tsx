
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { db, functions } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import {
  collection, onSnapshot, query, orderBy, doc, updateDoc, Timestamp
} from 'firebase/firestore';

const createTenantFn = httpsCallable(functions, 'createTenant');

interface Tenant {
  id: string;
  name: string;
  active: boolean;
  phishingHabilitado?: boolean;
  backupHabilitado?: boolean;
  auditoriaHabilitado?: boolean;
  segurancaHabilitado?: boolean;
  iaAnaliticaHabilitado?: boolean;
  dossieHabilitado?: boolean;
  maturidadeHabilitado?: boolean;
  criarConteudoHabilitado?: boolean;
  demoExpiraEm?: Timestamp | null;
  demoAvisoEnviado?: boolean;
  createdAt: any;
}

// Módulos controláveis por cartório. `padraoLigado: true` = módulo normal, incluso por
// padrão (só desliga se o SUPERADMIN gravar `false`, tipicamente ao ativar uma
// demonstração). `padraoLigado: false` = recurso historicamente vendido à parte
// (phishing, backup): fica desligado até o SUPERADMIN habilitar explicitamente.
const RECURSOS: { campo: keyof Tenant; label: string; icon: string; padraoLigado: boolean }[] = [
  { campo: 'auditoriaHabilitado',   label: 'Auditoria',    icon: 'fa-clock-rotate-left', padraoLigado: true  },
  { campo: 'segurancaHabilitado',   label: 'Segurança',    icon: 'fa-lock',              padraoLigado: true  },
  { campo: 'iaAnaliticaHabilitado', label: 'IA Analítica', icon: 'fa-chart-pie',         padraoLigado: true  },
  { campo: 'dossieHabilitado',      label: 'Dossiê',       icon: 'fa-file-shield',       padraoLigado: true  },
  { campo: 'maturidadeHabilitado',  label: 'Maturidade',   icon: 'fa-gauge-high',        padraoLigado: true  },
  { campo: 'criarConteudoHabilitado', label: 'Criar Conteúdo', icon: 'fa-plus',          padraoLigado: true  },
  { campo: 'phishingHabilitado',    label: 'Phishing',     icon: 'fa-shield-halved',     padraoLigado: false },
  { campo: 'backupHabilitado',      label: 'Backup',       icon: 'fa-database',          padraoLigado: false },
];

function recursoHabilitado(t: Tenant, r: typeof RECURSOS[number]): boolean {
  const valor = t[r.campo] as boolean | undefined;
  return r.padraoLigado ? valor !== false : !!valor;
}

function diasRestantes(ts?: Timestamp | null): number | null {
  if (!ts) return null;
  const ms = ts.toDate().getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

const TenantsView: React.FC = () => {
  const { setActiveTenant, setActiveTab } = useApp();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [diasDemo, setDiasDemo] = useState<Record<string, number>>({});

  useEffect(() => {
    const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      setLoading(false);
    });
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    const tenantId = slug.toLowerCase().trim().replace(/\s+/g, '-');
    if (!tenantId || !name.trim()) return;
    setSaving(true);
    try {
      await createTenantFn({ name: name.trim(), slug: tenantId });
      showToast(`Cartório "${name.trim()}" ativado com sucesso!`, 'success');
      setName('');
      setSlug('');
    } catch (err: any) {
      const msg = err.code === 'functions/already-exists'
        ? `Já existe um cartório com o ID "${tenantId}".`
        : err.message || 'Erro ao criar cartório.';
      showToast(msg, 'error');
    }
    setSaving(false);
  };

  const toggleRecurso = async (t: Tenant, r: typeof RECURSOS[number]) => {
    const atual = recursoHabilitado(t, r);
    await updateDoc(doc(db, 'tenants', t.id), { [r.campo]: !atual });
    showToast(`${r.label} ${!atual ? 'habilitado' : 'desabilitado'} para "${t.name}".`, 'success');
  };

  // Durante a demonstração, só a Capacitação (Trilhas/Exames/Treinamentos) fica disponível —
  // todos os módulos controláveis (inclusive os "padrão ligado") são desligados aqui.
  const ativarDemo = async (t: Tenant) => {
    const dias = diasDemo[t.id] || 14;
    const expira = Timestamp.fromDate(new Date(Date.now() + dias * 86_400_000));
    const desligarTudo = Object.fromEntries(RECURSOS.map(r => [r.campo, false]));
    await updateDoc(doc(db, 'tenants', t.id), {
      active: true,
      demoExpiraEm: expira,
      demoAvisoEnviado: false,
      ...desligarTudo,
    });
    showToast(`Demonstração de ${dias} dia(s) ativada para "${t.name}" — só a Capacitação fica liberada.`, 'success');
  };

  // Ao converter em cliente pleno, os módulos "padrão ligado" voltam a ficar disponíveis;
  // os historicamente vendidos à parte (Phishing/Backup) continuam exigindo habilitação manual.
  const religarModulosBase = () => Object.fromEntries(RECURSOS.filter(r => r.padraoLigado).map(r => [r.campo, true]));

  const encerrarDemo = async (t: Tenant) => {
    await updateDoc(doc(db, 'tenants', t.id), { demoExpiraEm: null, demoAvisoEnviado: false, ...religarModulosBase() });
    showToast(`"${t.name}" convertido para acesso pleno (sem prazo de demonstração).`, 'success');
  };

  const reativarAposDemo = async (t: Tenant) => {
    await updateDoc(doc(db, 'tenants', t.id), { active: true, demoExpiraEm: null, demoAvisoEnviado: false, ...religarModulosBase() });
    showToast(`"${t.name}" reativado com acesso pleno.`, 'success');
  };

  return (
    <div className="p-12 min-h-full bg-slate-50 animate-in fade-in space-y-12">
      <header>
        <h2 className="text-4xl font-black text-navy italic uppercase tracking-tighter">
          Gestão de <span className="text-blue-500">Cartórios</span>
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
          Ativação de Novas Instâncias // MJ Consultoria Master
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <form onSubmit={handleCreateTenant} className="bg-white border border-slate-200 rounded-[40px] p-12 space-y-6 shadow-2xl">
          <h3 className="text-navy font-bold uppercase text-sm italic">Ativar Novo Cartório Cliente</h3>
          <div className="space-y-4">
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nome da Serventia (Ex: 1º Ofício de Notas)"
              className="w-full bg-white border border-slate-200 rounded-3xl p-5 text-navy outline-none focus:border-blue-600 transition-all" required
            />
            <input
              type="text" value={slug} onChange={e => setSlug(e.target.value)}
              placeholder="ID do Sistema (Ex: cartorio-bh-01)"
              className="w-full bg-white border border-slate-200 rounded-3xl p-5 text-blue-400 font-mono outline-none focus:border-blue-600 transition-all" required
            />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">
              O ID será usado como <code className="bg-slate-100 px-1 rounded">tenantId</code> de todos os usuários deste cartório.
            </p>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 disabled:opacity-50 text-navy font-black py-6 rounded-3xl uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-500 transition-all">
            {saving ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Criando...</> : 'Criar Ambiente Isolado'}
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-[40px] p-10 space-y-6 shadow-lg">
          <p className="text-[10px] text-slate-400 px-2">
            <i className="fa-solid fa-circle-info mr-1"></i>
            Cada módulo abaixo pode ser ligado/desligado por cartório — aparecem no menu, mas travados, quando desligados.
            "Criar Conteúdo" trava só a criação (Repositório, Vídeos, Comunicados, Banners, Base Legal, Nova Trilha) — o consumo
            (fazer as trilhas já cadastradas, assistir vídeos, etc.) continua liberado mesmo desligado.
            "Ativar Demonstração" desliga todos por N dias, deixando só a Capacitação disponível;
            ao expirar, o cartório é suspenso automaticamente e um e-mail é enviado ao gestor sugerindo a compra.
          </p>
          <div className="flex items-center justify-between">
            <h3 className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] px-2">Instâncias Ativas</h3>
            <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
              {loading ? '...' : `${tenants.filter(t => t.active).length} cartório${tenants.filter(t => t.active).length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {loading && (
              <p className="text-slate-500 text-xs font-bold uppercase text-center py-10 animate-pulse">Carregando...</p>
            )}
            {!loading && tenants.length === 0 && (
              <p className="text-slate-700 text-xs font-bold uppercase text-center py-10 italic">Nenhum cartório cadastrado</p>
            )}
            {tenants.map(t => {
              const restantes = diasRestantes(t.demoExpiraEm);
              const emDemo = restantes !== null && restantes >= 0 && t.active;
              const demoExpirada = restantes !== null && !t.active && !!t.demoExpiraEm;
              return (
              <div key={t.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-col gap-3 group hover:border-blue-500/30 transition-all">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                    <div>
                      <span className="text-navy font-bold italic uppercase text-sm">{t.name}</span>
                      <p className="text-[10px] font-mono text-slate-400">{t.id}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setActiveTenant(t.id, t.name); setActiveTab('unit'); }}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 transition-all"
                    title={`Acessar ${t.name}`}
                  >
                    <i className="fa-solid fa-arrow-right-to-bracket text-[9px]"></i>
                    Acessar
                  </button>
                </div>

                {/* Módulos habilitáveis */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {RECURSOS.map(r => {
                    const ligado = recursoHabilitado(t, r);
                    return (
                      <button
                        key={String(r.campo)}
                        type="button"
                        onClick={() => toggleRecurso(t, r)}
                        className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all ${
                          ligado
                            ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={ligado ? `${r.label} habilitado — clique para desabilitar` : `${r.label} desabilitado — clique para habilitar`}
                      >
                        <i className={`fa-solid ${r.icon} text-[9px]`}></i>
                        {r.label} {ligado ? 'ON' : 'OFF'}
                      </button>
                    );
                  })}
                </div>

                {/* Relógio de demonstração */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  {emDemo ? (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-hourglass-half text-amber-500 text-xs"></i>
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                        Demo — expira em {restantes} dia{restantes !== 1 ? 's' : ''}
                      </span>
                      <button type="button" onClick={() => encerrarDemo(t)}
                        className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 underline ml-2">
                        Converter em cliente pleno
                      </button>
                    </div>
                  ) : demoExpirada ? (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-triangle-exclamation text-red-500 text-xs"></i>
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
                        Demonstração expirada — acesso suspenso
                      </span>
                      <button type="button" onClick={() => reativarAposDemo(t)}
                        className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 underline ml-2">
                        Reativar (venda concluída)
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sem prazo de demonstração</span>
                  )}
                  {!emDemo && !demoExpirada && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min={1} max={90}
                        value={diasDemo[t.id] ?? 14}
                        onChange={e => setDiasDemo(prev => ({ ...prev, [t.id]: Number(e.target.value) }))}
                        className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-navy outline-none focus:border-amber-500"
                      />
                      <span className="text-[9px] text-slate-400 font-bold uppercase">dias</span>
                      <button type="button" onClick={() => ativarDemo(t)}
                        className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 transition-all">
                        <i className="fa-solid fa-hourglass-start mr-1"></i>Ativar Demonstração
                      </button>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantsView;
