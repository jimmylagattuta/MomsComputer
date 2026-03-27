import { toE164Us } from "../utils/phone";
import { postJson } from "./api/client";

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

function buildErrorMessage(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return payload.errors.map((item) => String(item)).join(", ");
  }
  if (typeof payload.errors === "string" && payload.errors.trim()) return payload.errors;
  return fallback;
}

function safeJson(value: any) {
  if (value && typeof value === "object") return value;
  return {};
}

export async function requestPhoneCode(
  phone: string
): Promise<
  ApiResult<{
    sent: boolean;
    maskedPhone?: string;
    cooldown?: number;
  }>
> {
  const e164 = toE164Us(phone);

  if (!e164) {
    return {
      ok: false,
      error: "Enter a valid 10-digit phone number",
    };
  }

  try {
    const res = await postJson("/v1/auth/phone/request_code", {
      phone: e164,
    });

    const json = safeJson(res?.json);

    if (!res?.ok) {
      return {
        ok: false,
        error: buildErrorMessage(json, "Could not send verification code"),
      };
    }

    return {
      ok: true,
      data: {
        sent: true,
        maskedPhone: json?.masked_phone || json?.maskedPhone,
        cooldown:
          typeof json?.cooldown === "number"
            ? json.cooldown
            : typeof json?.resend_cooldown === "number"
            ? json.resend_cooldown
            : undefined,
      },
    };
  } catch {
    return {
      ok: false,
      error: "Network error while sending code",
    };
  }
}

export async function verifyPhoneCode(
  phone: string,
  code: string
): Promise<
  ApiResult<{
    verified: boolean;
    verificationToken?: string;
  }>
> {
  const e164 = toE164Us(phone);
  const cleanCode = String(code || "").replace(/\D/g, "").slice(0, 6);

  if (!e164) {
    return { ok: false, error: "Invalid phone number" };
  }

  if (cleanCode.length !== 6) {
    return { ok: false, error: "Enter the 6-digit code" };
  }

  try {
    const res = await postJson("/v1/auth/phone/verify_code", {
      phone: e164,
      code: cleanCode,
    });

    const json = safeJson(res?.json);

    if (!res?.ok) {
      return {
        ok: false,
        error: buildErrorMessage(json, "Invalid or expired code"),
      };
    }

    const verificationToken =
      json?.verification_token || json?.verificationToken || "";

    if (!verificationToken) {
      return {
        ok: false,
        error: "Verification succeeded, but no verification token was returned",
      };
    }

    return {
      ok: true,
      data: {
        verified: true,
        verificationToken,
      },
    };
  } catch {
    return {
      ok: false,
      error: "Network error while verifying",
    };
  }
}

export async function completeSignUp(params: {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  phone: string;
  verificationToken: string;
}): Promise<
  ApiResult<{
    user: any;
    token?: string;
    refreshToken?: string;
  }>
> {
  const e164 = toE164Us(params.phone);

  if (!e164) {
    return { ok: false, error: "Invalid phone number" };
  }

  if (!params.verificationToken) {
    return {
      ok: false,
      error: "Phone must be verified first",
    };
  }

  try {
    const res = await postJson("/v1/auth/signup", {
      user: {
        first_name: params.firstName,
        last_name: params.lastName || "",
        email: params.email,
        password: params.password,
        password_confirmation: params.passwordConfirmation,
        phone: e164,
        phone_verification_token: params.verificationToken,
      },
    });

    const json = safeJson(res?.json);

    if (!res?.ok) {
      return {
        ok: false,
        error: buildErrorMessage(json, "Signup failed"),
      };
    }

    return {
      ok: true,
      data: {
        user: json?.user,
        token: json?.token,
        refreshToken: json?.refresh_token || json?.refreshToken,
      },
    };
  } catch {
    return {
      ok: false,
      error: "Network error during signup",
    };
  }
}