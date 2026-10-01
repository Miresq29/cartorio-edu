// frontend/src/components/AccessWindowGate.tsx
// Bloqueia colaborador/gestor/admin de um cartório fora do horário de acesso
// configurado pelo SUPERADMIN em Gestão de Empresas. Equipe MJ/SUPERADMIN nunca
// são bloqueados, mesmo "dentro" de um cartório em modo preview.

import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Props {
  tenantId: string;
  children: React.ReactNode;
}

function horaAtualMinutos(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const AccessWindowGate: React.FC<Props> = ({ tenantId, children }) => {
  const [config, setConfig] = useState<{ habilitado: boolean; inicio: string; fim: string } | null>(null);
  const [agora, setAgora] = useState(() => horaAtualMinutos());

  useEffect(() => {
    if (!tenantId) return;
    return onSnapshot(doc(db, 'tenants', tenantId), snap => {
      const data = snap.data() as any;
      setConfig({
        habilitado: !!data?.horarioAcessoHabilitado,
        inicio: data?.horarioAcessoInicio || '00:00',
        fim: data?.horarioAcessoFim || '23:59',
      });
    });
  }, [tenantId]);

  useEffect(() => {
    const id = setInterval(() => setAgora(horaAtualMinutos()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!config || !config.habilitado) return <>{children}</>;

  const inicio = paraMinutos(config.inicio);
  const fim = paraMinutos(config.fim);
  const dentroDoHorario = inicio <= fim
    ? (agora >= inicio && agora <= fim)
    : (agora >= inicio || agora <= fim);

  if (dentroDoHorario) return <>{children}</>;

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-[24px] p-8 text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center">
          <i className="fa-solid fa-clock text-amber-500 text-xl"></i>
        </div>
        <h2 className="text-lg font-black text-navy uppercase tracking-tight">Acesso Limitado ao Período</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Esta plataforma está disponível para o seu cartório apenas entre{' '}
          <strong className="text-navy">{config.inicio}</strong> e <strong className="text-navy">{config.fim}</strong>, todos os dias.
          Volte dentro desse horário para acessar.
        </p>
      </div>
    </div>
  );
};

export default AccessWindowGate;
