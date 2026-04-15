import * as SecureStore from "expo-secure-store";
import { toE164Us } from "../utils/phone";
import { postJson } from "./api/client";

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

function buildErrorMessage(payload: any, fallback: string) {
  if (!payload) return fallback;

  const detailedMessages: string[] = [];

  if (Array.isArray(payload.details) && payload.details.length > 0) {
    detailedMessages.push(...payload.details.map((item) => String(item)));
  }

  if (typeof payload.details === "string" && payload.details.trim()) {
    detailedMessages.push(payload.details.trim());
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    detailedMessages.push(...payload.errors.map((item) => String(item)));
  }

  if (typeof payload.errors === "string" && payload.errors.trim()) {
    detailedMessages.push(payload.errors.trim());
  }

  if (payload.errors && typeof payload.errors === "object" && !Array.isArray(payload.errors)) {
    for (const [field, value] of Object.entries(payload.errors)) {
      if (Array.isArray(value)) {
        for (const msg of value) {
          detailedMessages.push(`${field} ${String(msg)}`);
        }
      } else if (value != null) {
        detailedMessages.push(`${field} ${String(value)}`);
      }
    }
  }

  if (detailedMessages.length > 0) {
    if (
      typeof payload.error === "string" &&
      payload.error.trim() &&
      payload.error.trim().toLowerCase() !== "validation error" &&
      payload.error.trim().toLowerCase() !== "validation_error"
    ) {
      return `${payload.error.trim()}: ${detailedMessages.join(", ")}`;
    }

    if (
      typeof payload.message === "string" &&
      payload.message.trim() &&
      payload.message.trim().toLowerCase() !== "validation error" &&
      payload.message.trim().toLowerCase() !== "validation_error"
    ) {
      return `${payload.message.trim()}: ${detailedMessages.join(", ")}`;
    }

    return detailedMessages.join(", ");
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  return fallback;
}

function safeJson(value: any) {
  if (value && typeof value === "object") return value;
  return {};
}

async function patchJson(path: string, body: any, token?: string) {
  const API_BASE =
    process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  console.log("[auth.patchJson] request", {
    path,
    body,
    hasToken: !!token,
    apiBase: API_BASE,
  });

  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });

  let json: any = {};
  try {
    json = await response.json();
  } catch (error) {
    console.log("[auth.patchJson] failed to parse json", error);
    json = {};
  }

  console.log("[auth.patchJson] response", {
    path,
    ok: response.ok,
    status: response.status,
    json,
  });

  return {
    ok: response.ok,
    status: response.status,
    json,
  };
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
  console.log("[auth.requestPhoneCode] raw phone", phone);

  const e164 = toE164Us(phone);

  console.log("[auth.requestPhoneCode] e164", e164);

  if (!e164) {
    console.log("[auth.requestPhoneCode] blocked before request - invalid phone");
    return {
      ok: false,
      error: "Enter a valid 10-digit phone number",
    };
  }

  try {
    console.log("[auth.requestPhoneCode] POST /v1/auth/phone/request_code");

    const res = await postJson("/v1/auth/phone/request_code", {
      phone: e164,
    });

    console.log("[auth.requestPhoneCode] raw response", res);

    const json = safeJson(res?.json);

    console.log("[auth.requestPhoneCode] parsed json", json);

    if (!res?.ok) {
      const errorMessage = buildErrorMessage(
        json,
        "Could not send verification code"
      );

      console.log("[auth.requestPhoneCode] request failed", {
        errorMessage,
        json,
      });

      return {
        ok: false,
        error: errorMessage,
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
  } catch (error) {
    console.log("[auth.requestPhoneCode] network error", error);
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
  console.log("[auth.verifyPhoneCode] raw input", { phone, code });

  const e164 = toE164Us(phone);
  const cleanCode = String(code || "").replace(/\D/g, "").slice(0, 6);

  console.log("[auth.verifyPhoneCode] normalized", {
    e164,
    cleanCode,
  });

  if (!e164) {
    console.log("[auth.verifyPhoneCode] blocked before request - invalid phone");
    return { ok: false, error: "Invalid phone number" };
  }

  if (cleanCode.length !== 6) {
    console.log("[auth.verifyPhoneCode] blocked before request - invalid code length");
    return { ok: false, error: "Enter the 6-digit code" };
  }

  try {
    console.log("[auth.verifyPhoneCode] POST /v1/auth/phone/verify_code");

    const res = await postJson("/v1/auth/phone/verify_code", {
      phone: e164,
      code: cleanCode,
    });

    console.log("[auth.verifyPhoneCode] raw response", res);

    const json = safeJson(res?.json);

    console.log("[auth.verifyPhoneCode] parsed json", json);

    if (!res?.ok) {
      const errorMessage = buildErrorMessage(json, "Invalid or expired code");

      console.log("[auth.verifyPhoneCode] request failed", {
        errorMessage,
        json,
      });

      return {
        ok: false,
        error: errorMessage,
      };
    }

    const verificationToken =
      json?.verification_token || json?.verificationToken || "";

    if (!verificationToken) {
      console.log(
        "[auth.verifyPhoneCode] verification token missing from successful response",
        json
      );

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
  } catch (error) {
    console.log("[auth.verifyPhoneCode] network error", error);
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
  verificationToken?: string;
}): Promise<
  ApiResult<{
    user: any;
    token?: string;
    refreshToken?: string;
  }>
> {
  console.log("[auth.completeSignUp] raw params", params);

  const e164 = toE164Us(params.phone);

  console.log("[auth.completeSignUp] normalized phone", e164);

  if (!e164) {
    console.log("[auth.completeSignUp] blocked before request - invalid phone");
    return { ok: false, error: "Invalid phone number" };
  }

  const payload = {
    user: {
      first_name: params.firstName,
      last_name: params.lastName || "",
      email: params.email,
      password: params.password,
      password_confirmation: params.passwordConfirmation,
      phone: e164,
      phone_verification_token: params.verificationToken,
    },
  };

  console.log("[auth.completeSignUp] POST /v1/auth/signup payload", payload);

  try {
    const res = await postJson("/v1/auth/signup", payload);

    console.log("[auth.completeSignUp] raw response", res);

    const json = safeJson(res?.json);

    console.log("[auth.completeSignUp] parsed json", json);

    if (!res?.ok) {
      const errorMessage = buildErrorMessage(json, "Signup failed");

      console.log("[auth.completeSignUp] signup failed", {
        errorMessage,
        json,
      });

      return {
        ok: false,
        error: errorMessage,
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
  } catch (error) {
    console.log("[auth.completeSignUp] network error", error);
    return {
      ok: false,
      error: "Network error during signup",
    };
  }
}

export async function changePassword(params: {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
}): Promise<
  ApiResult<{
    success: boolean;
    message?: string;
  }>
> {
  const currentPassword = String(params.currentPassword || "");
  const newPassword = String(params.newPassword || "");
  const newPasswordConfirmation = String(params.newPasswordConfirmation || "");

  if (!currentPassword) {
    return { ok: false, error: "Enter your current password" };
  }

  if (!newPassword) {
    return { ok: false, error: "Enter a new password" };
  }

  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters" };
  }

  if (!newPasswordConfirmation) {
    return { ok: false, error: "Confirm your new password" };
  }

  if (newPassword !== newPasswordConfirmation) {
    return { ok: false, error: "New password and confirmation do not match" };
  }

  try {
    const token = await SecureStore.getItemAsync("auth_token");

    if (!token) {
      return { ok: false, error: "You are not signed in" };
    }

    const res = await patchJson(
      "/v1/auth/change_password",
      {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: newPasswordConfirmation,
      },
      token
    );

    const json = safeJson(res?.json);

    if (!res?.ok) {
      const errorMessage = buildErrorMessage(json, "Could not change password");

      console.log("[auth.changePassword] failed", {
        errorMessage,
        json,
      });

      return {
        ok: false,
        error: errorMessage,
      };
    }

    return {
      ok: true,
      data: {
        success: true,
        message:
          json?.message ||
          json?.notice ||
          "Your password has been updated",
      },
    };
  } catch (error) {
    console.log("[auth.changePassword] network error", error);
    return {
      ok: false,
      error: "Network error while changing password",
    };
  }
}