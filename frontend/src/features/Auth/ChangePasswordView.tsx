
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { AuthService } from '../../services/authService';

const ChangePasswordView: React.FC = () => {
  const { state, login, logout } = useApp();
  const { showToast } = useToast();
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const user = state.user;

  // Validação de senha forte (mínimo 12 caracteres conforme PasswordSchema)
  const validateStrongPassword = (pass: string) => {
    const checks = [
      { ok: pass.length >= 12, msg: 'Mínimo de 12 caracteres' },
      { ok: /[A-Z]/.test(pass), msg: 'Uma letra maiúscula' },
      { ok: /[a-z]/.test(pass), msg: 'Uma letra minúscula' },
      { ok: /[0-9]/.test(pass), msg: 'Um número' },
      { ok: /[!@#$%^&*(),.?":{}|<>_\-]/.test(pass), msg: 'Um caractere especial (!@#$%...)' },
    ];
    return {
      isValid: checks.every(c => c.ok),
      checks
    };
  };

  const validation = validateStrongPassword(newPass);
  const strength = validation.checks.filter(c => c.ok).length;
  const strengthColor = strength <= 2 ? 'bg-red-500' : strength <= 3 ? 'bg-yellow-500' : strength === 4 ? 'bg-blue-500' : 'bg-emerald-500';
  const strengthLabel = strength <= 2 ? 'Fraca' : strength <= 3 ? 'Moderada' : strength === 4 ? 'Boa' : 'Forte';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      if (!validation.isValid) {
        const firstFail = validation.checks.find(c => !c.ok);
        throw new Error(`Senha inválida: ${firstFail?.msg}`);
      }

      if (newPass !== confirmPass) {
        throw new Error('As senhas digitadas não coincidem.');
      }

      const result = await AuthService.updatePassword(user.id, newPass);

      if (result.success) {
        showToast('Senha atualizada com sucesso!', 'success');
        login({ ...user, isFirstLogin: false }, state.token || '');
      } else {
        throw new Error(result.message || 'Erro ao salvar no banco de dados.');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-slate-50 w-full max-w-md rounded-[40px] shadow-2xl p-12 border border-blue-500/20 space-y-8">

        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-amber-500 mx-auto">
            <span className="text-3xl">🔑</span>
          </div>
          <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Troca de Senha Obrigatória</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
            Crie uma senha forte. Não poderá reutilizar as últimas 3 senhas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Nova senha */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nova Senha</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-800 focus:border-blue-500 outline-none pr-12"
                placeholder="••••••••••••"
                required
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <i className={`fa-solid ${showNew ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
              </button>
            </div>

            {/* Barra de força */}
            {newPass && (
              <div className="space-y-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Força da senha</span>
                  <span className={`text-[9px] font-black uppercase ${strength <= 2 ? 'text-red-500' : strength <= 3 ? 'text-yellow-500' : strength === 4 ? 'text-blue-500' : 'text-emerald-500'}`}>
                    {strengthLabel}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${strengthColor}`}
                    style={{ width: `${(strength / 5) * 100}%` }} />
                </div>
                {/* Checklist visual */}
                <div className="space-y-1 mt-2">
                  {validation.checks.map((check, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <i className={`fa-solid ${check.ok ? 'fa-circle-check text-emerald-500' : 'fa-circle-xmark text-slate-700'} text-[10px]`}></i>
                      <span className={`text-[10px] font-bold ${check.ok ? 'text-emerald-400' : 'text-slate-600'}`}>{check.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirmar senha */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confirmar Senha</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                className={`w-full bg-slate-50 border rounded-2xl p-4 text-xs font-bold text-slate-800 focus:border-blue-500 outline-none pr-12 ${confirmPass && confirmPass !== newPass ? 'border-red-500/50' : 'border-slate-200'}`}
                placeholder="••••••••••••"
                required
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
              </button>
            </div>
            {confirmPass && confirmPass !== newPass && (
              <p className="text-[10px] text-red-400 font-bold">Senhas não coincidem</p>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => logout()}
              className="flex-1 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !validation.isValid || newPass !== confirmPass}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all disabled:opacity-40 text-[10px] uppercase tracking-widest"
            >
              {loading ? <><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>Salvando...</> : 'Salvar e Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordView;
