
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { AuthService } from '../../services/authService';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';

const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Mantemos os estados apenas para não quebrar o restante do código, 
  // mas eles não bloquearão mais o acesso.
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);

  const { login } = useApp();
  const { showToast } = useToast();

  // Efeito de timer mantido apenas para referência visual se necessário
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLocked && lockTimer > 0) {
      interval = setInterval(() => {
        setLockTimer((prev) => prev - 1);
      }, 1000);
    } else if (lockTimer === 0) {
      setIsLocked(false);
      setAttempts(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLocked, lockTimer]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🔓 BLOQUEIO REMOVIDO: Agora só exige e-mail e senha preenchidos
    if (!email || !password) return;

    setIsLoading(true);

    try {
      // 🚀 Tenta a conexão com o Firebase
      const result = await AuthService.login(email, password);
      
      if (result.user.isFirstLogin) {
        showToast("Primeiro acesso detectado. Redirecionando para troca de senha...", "info");
      } else {
        showToast(`Bem-vinda, ${result.user.name || 'ao sistema'}!`, "success");
      }

      // Salva a sessão
      login(result.user, result.token);

    } catch (error: any) {
      // 🔓 TRAVA DESATIVADA: Apenas exibe o erro sem bloquear por tentativas
      console.error("Erro no login:", error);
      showToast(error.message || "E-mail ou senha incorretos. Verifique suas credenciais.", "error");
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05080f] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-[440px] z-10">
        <div className="bg-[#0a111f] border border-slate-800 rounded-[40px] p-10 shadow-2xl backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              MJ <span className="text-blue-500">Consultoria</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Segurança Notarial Avançada</p>
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full font-black py-4 rounded-2xl uppercase text-[11px] tracking-widest transition-all duration-300 bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? "Autenticando..." : "Entrar no Sistema"}
            </button>
          </form>

          {/* O aviso visual só aparecerá se você manualmente setar o isLocked, 
              mas o formulário acima não o impedirá mais de tentar. */}
        </div>

        <p className="text-center mt-8 text-slate-600 text-[10px] uppercase tracking-widest">
          © {new Date().getFullYear()} MJ Consultoria - Todos os direitos reservados
        </p>
      </div>
    </div>
  );
};

export default LoginView;