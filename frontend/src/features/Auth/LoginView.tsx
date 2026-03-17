
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
    <div className="min-h-screen bg-[#05080f] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-[440px] z-10">
        <div className="bg-[#0a111f] border border-slate-800 rounded-[40px] p-10 shadow-2xl backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              MJ <span className="text-blue-500">Consultoria</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Plataforma de Treinamento Corporativo</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-4 text-slate-500 w-5 h-5" />
              <input
                type="email"
                placeholder="E-mail funcional"
                className="w-full bg-[#05080f] border border-slate-800 rounded-2xl p-4 pl-12 text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-slate-700"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-4 text-slate-500 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                className="w-full bg-[#05080f] border border-slate-800 rounded-2xl p-4 pl-12 pr-12 text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-slate-700"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
              >
                {resetLoading ? "Enviando..." : "Esqueceu a senha?"}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full font-black py-4 rounded-2xl uppercase text-[11px] tracking-widest transition-all duration-300 bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? "Autenticando..." : "Entrar no Sistema"}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-slate-600 text-[10px] uppercase tracking-widest">
          © {new Date().getFullYear()} MJ Consultoria - Todos os direitos reservados
        </p>
      </div>
    </div>
  );
};

export default LoginView;
