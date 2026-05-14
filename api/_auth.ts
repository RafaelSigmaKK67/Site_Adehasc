import { getHeader, sendJson, type ApiRequest, type ApiResponse } from "./_http";

export function authorizeAdmin(req: ApiRequest, res: ApiResponse, feature = "painel ADM") {
  const configuredPassword = process.env.ADMIN_PASSWORD || "";

  if (!configuredPassword) {
    sendJson(res, 503, {
      error: `ADMIN_PASSWORD ainda não foi configurada no Vercel. Defina a variável de ambiente para ativar ${feature}.`,
    });
    return false;
  }

  if (getHeader(req, "x-admin-password") !== configuredPassword) {
    sendJson(res, 401, { error: "Senha ADM inválida." });
    return false;
  }

  return true;
}

