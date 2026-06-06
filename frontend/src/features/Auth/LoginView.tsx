
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { AuthService } from '../../services/authService';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const { login } = useApp();
  const { showToast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    try {
      const result = await AuthService.login(email, password);
      if (result.user.isFirstLogin) {
        showToast("Primeiro acesso detectado. Redirecionando para troca de senha...", "info");
      } else {
        showToast(`Bem-vinda, ${result.user.name || 'ao sistema'}!`, "success");
      }
      login(result.user, result.token);
    } catch (error: any) {
      console.error("Erro no login:", error);
      showToast(error.message || "E-mail ou senha incorretos.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      showToast("Digite seu e-mail no campo acima para redefinir a senha.", "error");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showToast(`Se este e-mail estiver cadastrado, voce receberá o link de redefinição em breve.`, "success");
    } catch (error: any) {
      console.warn("Reset password error:", error.code, error.message);
      const msgs: Record<string, string> = {
        "auth/user-not-found":        "E-mail nao encontrado no sistema.",
        "auth/invalid-email":         "Formato de e-mail invalido.",
        "auth/too-many-requests":     "Muitas tentativas. Aguarde alguns minutos.",
        "auth/network-request-failed":"Sem conexao com o servidor.",
        "auth/missing-email":         "Digite seu e-mail no campo acima.",
        "auth/invalid-api-key":       "Configuracao do sistema invalida. Contate o suporte.",
      };
      showToast(msgs[error.code] || `Se este e-mail estiver cadastrado, voce receberá o link em breve.`, "success");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-brand-blue/5 blur-[140px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-brand-blue/5 blur-[140px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-[420px] z-10">
        {/* Card */}
        <div className="bg-bg-surface border border-border rounded-3xl p-10 shadow-card-hover">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-blue/15 mb-4">
              <i className="fa-solid fa-graduation-cap text-2xl text-brand-blue"></i>
            </div>
            <h1 className="text-3xl font-black text-text-primary italic uppercase tracking-tighter">
              MJ <span className="text-brand-blue">Consultoria</span>
            </h1>
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-[0.25em] mt-2">
              Plataforma de Treinamento Corporativo
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* E-mail field */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4 pointer-events-none" />
              <input
                type="email"
                placeholder="E-mail funcional"
                className="w-full bg-bg-elevated border border-border rounded-2xl py-3.5 pl-11 pr-4 text-text-primary placeholder:text-text-muted outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {/* Password field */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                className="w-full bg-bg-elevated border border-border rounded-2xl py-3.5 pl-11 pr-12 text-text-primary placeholder:text-text-muted outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="text-[11px] text-brand-blue hover:text-blue-300 font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
              >
                {resetLoading ? "Enviando..." : "Esqueceu a senha?"}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full font-black py-3.5 rounded-2xl uppercase text-[11px] tracking-widest transition-all duration-200 bg-brand-blue text-white hover:brightness-110 shadow-glow-blue active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Autenticando..." : "Entrar no Sistema"}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-text-disabled text-[10px] uppercase tracking-widest">
          © {new Date().getFullYear()} MJ Consultoria — Todos os direitos reservados
        </p>
      </div>
    </div>
  );
};

export default LoginView;
