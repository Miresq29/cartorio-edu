import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

export { notificarComunicado, notificarTrilha, verificarExpiracoes, testarEnvioEmail, notificarReforco } from "./email";
export { notificarSimulacaoPhishing, phishClick } from "./phishing";
export { verificarDemoExpirada } from "./demo";

const db = admin.firestore();

const GESTOR_ROLES = ["SUPERADMIN", "gestor", "admin", "equipe_mj"];
const CREATABLE_ROLES = ["gestor", "admin", "colaborador", "curador", "equipe_mj"];

interface CallerProfile {
  uid: string;
  role: string;
  tenantId: string;
  active: boolean;
}

async function getCallerProfile(uid: string): Promise<CallerProfile> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Perfil do usuário autenticado não encontrado.");
  }
  const data = snap.data()!;
  if (data.active !== true) {
    throw new HttpsError("permission-denied", "Conta desativada.");
  }
  return { uid, role: data.role || "", tenantId: data.tenantId || "", active: true };
}

export const createTenant = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  if (caller.role !== "SUPERADMIN") {
    throw new HttpsError("permission-denied", "Apenas SUPERADMIN pode criar cartórios.");
  }

  const rawName = String(request.data?.name || "").trim();
  const rawSlug = String(request.data?.slug || "").trim();
  if (!rawName || !rawSlug) {
    throw new HttpsError("invalid-argument", "Nome e ID do cartório são obrigatórios.");
  }

  const slug = rawSlug.toLowerCase().replace(/\s+/g, "-");
  const tenantRef = db.collection("tenants").doc(slug);
  const existing = await tenantRef.get();
  if (existing.exists) {
    throw new HttpsError("already-exists", `Já existe um cartório com o ID "${slug}".`);
  }

  await tenantRef.set({
    name: rawName,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: caller.uid,
  });

  return { id: slug };
});

export const createCollaborator = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  if (!GESTOR_ROLES.includes(caller.role)) {
    throw new HttpsError("permission-denied", "Sem permissão para criar colaboradores.");
  }

  const name = String(request.data?.name || "").trim();
  const email = String(request.data?.email || "").trim().toLowerCase();
  const role = String(request.data?.role || "");
  const cargo = String(request.data?.cargo || "");
  const tenantId = String(request.data?.tenantId || "").trim();
  const password = String(request.data?.password || "");

  if (!name || !email || !password) {
    throw new HttpsError("invalid-argument", "Nome, e-mail e senha são obrigatórios.");
  }
  if (!CREATABLE_ROLES.includes(role)) {
    throw new HttpsError("invalid-argument", "Perfil de acesso inválido.");
  }
  // Curador e equipe_mj são equipe interna da MJ Consultoria — não pertencem a nenhum
  // cartório específico, então não exigem tenantId. Só o SUPERADMIN de verdade (nunca outro
  // curador/equipe_mj) pode criar essas contas, para não se autorreplicarem.
  if (role === "curador" || role === "equipe_mj") {
    if (caller.role !== "SUPERADMIN") {
      throw new HttpsError(
        "permission-denied",
        role === "curador"
          ? "Apenas SUPERADMIN pode criar contas de curador."
          : "Apenas SUPERADMIN pode criar contas da equipe MJ."
      );
    }
  } else {
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "Cartório (tenantId) é obrigatório.");
    }
    if (!["SUPERADMIN", "equipe_mj"].includes(caller.role) && tenantId !== caller.tenantId) {
      throw new HttpsError("permission-denied", "Só é possível criar colaboradores do próprio cartório.");
    }
  }

  let uid: string;
  let reused = false;
  try {
    const created = await admin.auth().createUser({ email, password, displayName: name });
    uid = created.uid;
  } catch (err: any) {
    if (err.code === "auth/email-already-exists") {
      const existingUser = await admin.auth().getUserByEmail(email);
      uid = existingUser.uid;
      reused = true;
    } else if (err.code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Senha inválida — mínimo 6 caracteres.");
    } else {
      throw new HttpsError("internal", err.message || "Erro ao criar conta de acesso.");
    }
  }

  try {
    await db.collection("users").doc(uid).set(
      {
        name,
        email,
        role,
        cargo,
        tenantId,
        active: true,
        ativo: true,
        isFirstLogin: true,
        mustChangePassword: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: caller.uid,
      },
      { merge: true }
    );
  } catch (err: any) {
    if (!reused) {
      await admin.auth().deleteUser(uid).catch(() => {});
    }
    throw new HttpsError("internal", "Conta criada, mas falha ao salvar perfil. Tente novamente.");
  }

  return { uid, reused };
});

function isStrongPassword(pass: string): boolean {
  return (
    pass.length >= 12 &&
    /[A-Z]/.test(pass) &&
    /[a-z]/.test(pass) &&
    /\d/.test(pass) &&
    /[!@#$%^&*(),.?":{}|<>_-]/.test(pass)
  );
}

// Redefine a senha de TODOS os colaboradores de um cartorio de uma vez (ex.: apos suspeita de
// vazamento, ou para padronizar acesso inicial de um grupo). Forca troca no proximo login
// (isFirstLogin/mustChangePassword) — igual ao fluxo de criacao de colaborador.
export const resetTenantPasswords = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  const caller = await getCallerProfile(request.auth.uid);
  if (!["SUPERADMIN", "equipe_mj"].includes(caller.role)) {
    throw new HttpsError("permission-denied", "Sem permissão para redefinir senhas em massa.");
  }

  const tenantId = String(request.data?.tenantId || "").trim();
  const password = String(request.data?.password || "");
  if (!tenantId) {
    throw new HttpsError("invalid-argument", "Cartório (tenantId) é obrigatório.");
  }
  if (!isStrongPassword(password)) {
    throw new HttpsError(
      "invalid-argument",
      "Senha fraca. Mínimo 12 caracteres, com maiúscula, minúscula, número e caractere especial."
    );
  }

  const usersSnap = await db.collection("users").where("tenantId", "==", tenantId).get();
  if (usersSnap.empty) {
    throw new HttpsError("not-found", "Nenhum colaborador encontrado para este cartório.");
  }

  let updated = 0;
  const failed: string[] = [];
  for (const doc of usersSnap.docs) {
    try {
      await admin.auth().updateUser(doc.id, { password });
      await doc.ref.update({
        isFirstLogin: true,
        mustChangePassword: true,
        passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      updated++;
    } catch (err: any) {
      failed.push(doc.data().email || doc.id);
    }
  }

  return { total: usersSnap.size, updated, failed };
});
