import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Mapa de senhas por unidade.
 * Lido de process.env (definido em functions/.env).
 * Formato das env vars: UNIT_PASSWORD_ALPHAVILLE=alpha2024
 */
function getUnitPassword(unitKey: string): string | undefined {
  const envKey = `UNIT_PASSWORD_${unitKey.toUpperCase()}`;
  return process.env[envKey];
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "";
}

/**
 * Cloud Function: validateUnitPassword (v2)
 *
 * Recebe { unitId, password } e retorna um custom token com a claim { unitId }.
 * As senhas são armazenadas em functions/.env e NUNCA expostas ao cliente.
 *
 * Uso no client:
 *   const result = await httpsCallable(functions, 'validateUnitPassword')({ unitId, password });
 *   await signInWithCustomToken(auth, result.data.token);
 */
export const validateUnitPassword = onCall(async (request) => {
  const { unitId, password } = request.data;

  if (!unitId || !password) {
    throw new HttpsError(
      "invalid-argument",
      "unitId e password são obrigatórios"
    );
  }

  const unitKey = unitId.toLowerCase();
  const expectedPassword = getUnitPassword(unitKey);
  const adminPassword = getAdminPassword();

  // Valida: senha da unidade OU senha admin
  const isValidUnitPassword = expectedPassword !== undefined && expectedPassword === password;
  const isAdminPassword = adminPassword !== "" && password === adminPassword;

  if (!isValidUnitPassword && !isAdminPassword) {
    throw new HttpsError(
      "permission-denied",
      "Senha incorreta para esta unidade"
    );
  }

  const isAdmin = isAdminPassword;

  // Cria (ou reutiliza) um usuário para esta unidade
  // UID determinístico baseado no unitId
  const uid = `unit-${unitKey}`;

  try {
    await admin.auth().getUser(uid);
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      await admin.auth().createUser({
        uid,
        displayName: `Unidade ${unitId}`,
      });
    } else {
      throw new HttpsError("internal", "Erro ao criar usuário");
    }
  }

  // Define custom claims no usuário
  await admin.auth().setCustomUserClaims(uid, {
    unitId: unitKey,
    isAdmin,
  });

  // Gera custom token
  const token = await admin.auth().createCustomToken(uid, {
    unitId: unitKey,
    isAdmin,
  });

  return { token, unitId: unitKey, isAdmin };
});
