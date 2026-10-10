// Página pública (sem login) de verificação de certificado — acessível em /verificar.
// Qualquer pessoa (ex: auditor do CNJ) digita o código impresso no certificado e o
// sistema confirma autenticidade chamando a cloud function verificarCertificado, que
// recalcula o hash a partir dos dados gravados e confere se bate com o código informado.
import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';

interface Resultado {
  valido: boolean;
  adulterado?: boolean;
  versaoModelo?: number;
  colaboradorNome?: string;
  cpf?: string;
  cargo?: string;
  cartorio?: string;
  trilhaTitulo?: string;
  tipo?: string;
  notaFinal?: number;
  cargaHoraria?: number;
  instrutor?: string;
  emitidoEm?: string | null;
  validoAte?: string | null;
}

const verificarCertificadoFn = httpsCallable<{ codigo: string }, Resultado>(functions, 'verificarCertificado');

const VerificarCertificadoView: React.FC = () => {
  const paramsCodigo = new URLSearchParams(window.location.search).get('codigo') || '';
  const [codigo, setCodigo] = useState(paramsCodigo);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState('');

  const verificar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!codigo.trim()) return;
    setLoading(true);
    setErro('');
    setResultado(null);
    try {
      const { data } = await verificarCertificadoFn({ codigo: codigo.trim() });
      setResultado(data);
    } catch (err: any) {
      setErro(err.message || 'Erro ao verificar o código.');
    }
    setLoading(false);
  };

  React.useEffect(() => { if (paramsCodigo) verificar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 4, color: '#C9A84C', textTransform: 'uppercase' }}>Integra-Academy</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 6, textTransform: 'uppercase', letterSpacing: -0.5 }}>
            Verificação de Certificado
          </h1>
          <p style={{ fontSize: 12, color: '#8A9BB0', marginTop: 6 }}>Digite o código impresso no certificado para confirmar sua autenticidade.</p>
        </div>

        <form onSubmit={verificar} style={{ background: '#ffffff', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            placeholder="MJ-XXXX-XXXX-XXXX"
            style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', fontSize: 16, fontWeight: 700, color: '#0A1628', textAlign: 'center', letterSpacing: 2, fontFamily: 'monospace' }}
          />
          <button type="submit" disabled={loading || !codigo.trim()}
            style={{ background: '#0A1628', color: '#ffffff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer', opacity: loading || !codigo.trim() ? 0.6 : 1 }}>
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </form>

        {erro && (
          <div style={{ marginTop: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: 16, color: '#991b1b', fontSize: 13, textAlign: 'center' }}>
            {erro}
          </div>
        )}

        {resultado && !resultado.valido && (
          <div style={{ marginTop: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✗</div>
            <p style={{ fontWeight: 900, color: '#991b1b', fontSize: 14, textTransform: 'uppercase' }}>
              {resultado.adulterado ? 'Certificado adulterado' : 'Código não encontrado'}
            </p>
            <p style={{ fontSize: 12, color: '#7f1d1d', marginTop: 6 }}>
              {resultado.adulterado
                ? 'O código existe, mas os dados do certificado foram alterados após a emissão.'
                : 'Não existe nenhum certificado emitido com esse código. Confira se digitou corretamente.'}
            </p>
          </div>
        )}

        {resultado?.valido && (
          <div style={{ marginTop: 16, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>✓</span>
              <span style={{ fontWeight: 900, color: '#166534', fontSize: 14, textTransform: 'uppercase' }}>Certificado válido e autêntico</span>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, fontSize: 13 }}>
              <Campo label="Colaborador" valor={resultado.colaboradorNome} />
              {resultado.cpf && <Campo label="CPF" valor={resultado.cpf} />}
              {resultado.cargo && <Campo label="Cargo" valor={resultado.cargo} />}
              {resultado.cartorio && <Campo label="Cliente" valor={resultado.cartorio} />}
              <Campo label="Treinamento" valor={resultado.trilhaTitulo} />
              <Campo label="Aproveitamento" valor={`${resultado.notaFinal}%`} />
              {resultado.cargaHoraria != null && <Campo label="Carga horária" valor={`${resultado.cargaHoraria}h`} />}
              {resultado.instrutor && <Campo label="Instrutor(a)" valor={resultado.instrutor} />}
              {resultado.emitidoEm && <Campo label="Emitido em" valor={new Date(resultado.emitidoEm).toLocaleDateString('pt-BR')} />}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
};

const Campo: React.FC<{ label: string; valor?: string }> = ({ label, valor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #dcfce7', paddingBottom: 8 }}>
    <dt style={{ color: '#166534', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</dt>
    <dd style={{ color: '#14532d', fontWeight: 900, textAlign: 'right' }}>{valor}</dd>
  </div>
);

export default VerificarCertificadoView;
