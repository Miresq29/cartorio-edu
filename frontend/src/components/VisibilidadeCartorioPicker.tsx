import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Tenant {
  id: string;
  name: string;
}

interface Props {
  isSuperAdmin: boolean;
  ownTenantId: string;
  value: string[];
  onChange: (tenantIds: string[]) => void;
}

type Modo = 'cartorio' | 'especificos';

// Não existe mais um modo "global" que se aplica sozinho a clientes futuros — toda
// distribuição é uma lista explícita de IDs, escolhida na hora. Um valor antigo ['GLOBAL']
// (de antes dessa mudança) cai em "específicos" como qualquer outra lista, sem efeito especial.
function detectarModo(value: string[], ownTenantId: string): Modo {
  if (value.length === 1 && value[0] === ownTenantId) return 'cartorio';
  return 'especificos';
}

const VisibilidadeCartorioPicker: React.FC<Props> = ({ isSuperAdmin, ownTenantId, value, onChange }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const q = query(collection(db, 'tenants'), orderBy('name'));
    return onSnapshot(q, snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || d.id })));
    });
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  const modo = detectarModo(value, ownTenantId);

  const setModo = (m: Modo) => {
    if (m === 'cartorio') onChange([ownTenantId]);
    else onChange(value.length && modo === 'especificos' ? value : []);
  };

  const toggleTenant = (id: string) => {
    const atual = modo === 'especificos' ? value : [];
    onChange(atual.includes(id) ? atual.filter(t => t !== id) : [...atual, id]);
  };

  const todosMarcados = tenants.length > 0 && tenants.every(t => value.includes(t.id));
  const marcarTodos = () => onChange(todosMarcados ? [] : tenants.map(t => t.id));

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visibilidade</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setModo('cartorio')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase transition-all ${
            modo === 'cartorio' ? 'bg-blue-50 border border-blue-300 text-blue-700' : 'bg-white border border-slate-200 text-slate-500'
          }`}>
          <i className="fa-solid fa-building"></i>Este cartório
        </button>
        <button type="button" onClick={() => setModo('especificos')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase transition-all ${
            modo === 'especificos' ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' : 'bg-white border border-slate-200 text-slate-500'
          }`}>
          <i className="fa-solid fa-list-check"></i>Cartórios específicos
        </button>
      </div>

      {modo === 'especificos' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            {tenants.length === 0 && <span className="text-xs text-slate-500">Nenhum cartório cadastrado.</span>}
            {tenants.map(t => (
              <button key={t.id} type="button" onClick={() => toggleTenant(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  value.includes(t.id) ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}>
                {value.includes(t.id) && <i className="fa-solid fa-check text-[9px]"></i>}
                {t.name}
              </button>
            ))}
          </div>
          {tenants.length > 0 && (
            <button type="button" onClick={marcarTodos}
              className="text-[10px] font-bold uppercase text-slate-400 hover:text-slate-600 flex items-center gap-1.5">
              <i className={`fa-solid ${todosMarcados ? 'fa-square-check' : 'fa-square'}`}></i>
              {todosMarcados ? 'Desmarcar todos' : `Marcar todos os ${tenants.length} clientes atuais`}
            </button>
          )}
          <p className="text-[9px] text-slate-400 leading-relaxed">
            Marca só quem existe agora — um cliente novo criado depois não entra automaticamente;
            direcione pra ele quando quiser.
          </p>
        </div>
      )}
    </div>
  );
};

export default VisibilidadeCartorioPicker;
