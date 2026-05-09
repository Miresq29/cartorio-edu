
import React from 'react';

const SupportView: React.FC = () => {
  return (
    <div className="p-12 bg-slate-50 min-h-screen flex flex-col items-center justify-center text-center space-y-8">
      <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-500 text-5xl">
        <i className="fa-solid fa-headset"></i>
      </div>
      <div className="space-y-4">
        <h2 className="text-3xl font-black text-[#0D1B3E] uppercase italic">Suporte MJ Consultoria</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Precisa de ajuda com a IA ou configuração de novos cartórios? Nossa equipe técnica está disponível.
        </p>
      </div>
      <button className="bg-blue-600 text-[#0A1628] px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all">
        Abrir Chamado via WhatsApp
      </button>
    </div>
  );
};

export default SupportView;