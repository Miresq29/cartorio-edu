import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  updatePassword as firebaseUpdatePassword
} from "firebase/auth";
import {
  doc, getDoc, updateDoc, arrayUnion, setDoc,
  collection, addDoc, serverTimestamp, increment
} from "firebase/firestore";
import { User } from "../types";

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "cartorio-rag-salt-2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

const logAudit = async (action: string, userId: string, email: string, details: string, severity: "INFO" | "WARNING" | "CRITICAL" = "INFO") => {
  try {
    await addDoc(collection(db, "auditLogs"), { action, userId, email, details, severity, timestamp: serverTimestamp(), userAgent: navigator.userAgent });
  } catch (e) { console.error("Falha ao gravar auditoria:", e); }
};

const BRUTE_FORCE_MAX_ATTEMPTS = 5;
const BRUTE_FORCE_LOCKOUT_MS = 5 * 60 * 1000;

const checkBruteForce = async (email: string): Promise<void> => {
  try {
    const lockRef = doc(db, "loginAttempts", email.toLowerCase().replace(/[.@]/g, "_"));
    const lockDoc = await getDoc(lockRef);
    if (lockDoc.exists()) {
      const { lockedUntil } = lockDoc.data();
      if (lockedUntil) {
        const lockedUntilDate = lockedUntil.toDate ? lockedUntil.toDate() : new Date(lockedUntil);
        if (new Date() < lockedUntilDate) {
          const minutesLeft = Math.ceil((lockedUntilDate.getTime() - Date.now()) / 60000);
          throw new Error(`Conta bloqueada por tentativas invalidas. Tente novamente em ${minutesLeft} minuto(s).`);
        }
      }
    }
  } catch (e: any) {
    if (e.message?.includes("Conta bloqueada")) throw e;
    console.warn("loginAttempts check ignorado:", e.code || e.message);
  }
};

const registerFailedAttempt = async (email: string): Promise<void> => {
  try {
    const key = email.toLowerCase().replace(/[.@]/g, "_");
    const lockRef = doc(db, "loginAttempts", key);
    const lockDoc = await getDoc(lockRef);
    let attempts = lockDoc.exists() ? (lockDoc.data().attempts || 0) + 1 : 1;
    const updateData: any = { attempts, lastAttempt: serverTimestamp() };
    if (attempts >= BRUTE_FORCE_MAX_ATTEMPTS) { updateData.lockedUntil = new Date(Date.now() + BRUTE_FORCE_LOCKOUT_MS); updateData.attempts = 0; }
    await setDoc(lockRef, updateData, { merge: true });
  } catch (e: any) { console.warn("registerFailedAttempt ignorado:", e.code || e.message); }
};

const clearFailedAttempts = async (email: string): Promise<void> => {
  try {
    const key = email.toLowerCase().replace(/[.@]/g, "_");
    await setDoc(doc(db, "loginAttempts", key), { attempts: 0, lockedUntil: null, lastAttempt: serverTimestamp() }, { merge: true });
  } catch (e: any) { console.warn("clearFailedAttempts ignorado:", e.code || e.message); }
};

export const AuthService = {

  login: async (email: string, password: string) => {
    try {
      await checkBruteForce(email);
      await setPersistence(auth, browserSessionPersistence);
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (authError: any) {
        await registerFailedAttempt(email);
        await logAudit("LOGIN_FAILED", "unknown", email, `Tentativa falha: ${authError.code}`, "WARNING");
        const errorMessages: Record<string, string> = {
          "auth/user-not-found": "E-mail nao cadastrado.",
          "auth/wrong-password": "Senha incorreta.",
          "auth/invalid-credential": "Credenciais invalidas.",
          "auth/too-many-requests": "Acesso bloqueado temporariamente pelo Firebase.",
          "auth/network-request-failed": "Sem conexao com o servidor."
        };
        throw new Error(errorMessages[authError.code] || "Falha na autenticacao.");
      }
      const firebaseUser = userCredential.user;
      const token = await firebaseUser.getIdToken();
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (!userDoc.exists()) { await signOut(auth); throw new Error("Perfil nao encontrado no banco de dados."); }
      const userData = userDoc.data();
      if (!userData.active) { await signOut(auth); await logAudit("LOGIN_BLOCKED", firebaseUser.uid, email, "Conta desativada", "WARNING"); throw new Error("Conta desativada. Contate o administrador."); }
      await clearFailedAttempts(email);
      await logAudit("LOGIN_SUCCESS", firebaseUser.uid, email, "Login bem-sucedido", "INFO");
      return { user: { id: firebaseUser.uid, email: firebaseUser.email!, ...userData } as User, token };
    } catch (error: any) { throw new Error(error.message || "Falha na autenticacao."); }
  },

  updatePassword: async (userId: string, newPassword: string) => {
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) throw new Error("Usuario nao encontrado.");
      const userData = userDoc.data();
      const passwordHistory: string[] = userData.passwordHistory || [];
      const newHash = await hashPassword(newPassword);
      const lastThree = passwordHistory.slice(-3);
      if (lastThree.includes(newHash)) throw new Error("Esta senha ja foi utilizada recentemente. Escolha uma senha diferente das ultimas 3.");
      const currentUser = auth.currentUser;
      if (currentUser) await firebaseUpdatePassword(currentUser, newPassword);
      const updatedHistory = [...passwordHistory, newHash].slice(-3);
      await updateDoc(userRef, { isFirstLogin: false, passwordHistory: updatedHistory, passwordUpdatedAt: serverTimestamp() });
      await logAudit("PASSWORD_CHANGED", userId, userData.email || "", "Senha atualizada com sucesso", "INFO");
      return { success: true };
    } catch (error: any) { console.error("Erro ao atualizar senha:", error); return { success: false, message: error.message }; }
  },

  updateFirstPassword: async (userId: string, newPassword: string) => { return AuthService.updatePassword(userId, newPassword); },

  logout: async (userId?: string, email?: string) => {
    try {
      if (userId && email) await logAudit("LOGOUT", userId, email, "Sessao encerrada", "INFO");
      await signOut(auth);
      localStorage.removeItem("user_session");
    } catch (error) { console.error("Erro ao encerrar sessao:", error); }
  },

  onAuthUpdate: (callback: (user: User | null, token: string | null) => void) => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists() && userDoc.data().active) {
            callback({ id: firebaseUser.uid, email: firebaseUser.email!, ...userDoc.data() } as User, token);
          } else { await signOut(auth); callback(null, null); }
        } catch { callback(null, null); }
      } else { callback(null, null); }
    });
  }
};
