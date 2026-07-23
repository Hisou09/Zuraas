import { Hono } from "hono";
import { env } from "cloudflare:workers";
import { authenticateRequest, clearSessionCookie, createSession, deleteSession, hashPassword, newUsercode, sessionCookie, verifyPassword } from "../../../../db/auth";
import { database, ensureSchema, isAdminEmail } from "../../../../db/runtime";

const auth = new Hono().basePath("/api/auth");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleStateCookieName = "zuraas_google_oauth_state";

type GoogleEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
};

type GoogleProfile = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function cookieValue(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function googleConfig(request: Request) {
  const bindings = env as unknown as GoogleEnv;
  return {
    clientId: bindings.GOOGLE_CLIENT_ID?.trim() || "",
    clientSecret: bindings.GOOGLE_CLIENT_SECRET?.trim() || "",
    redirectUri: bindings.GOOGLE_REDIRECT_URI?.trim() || `${new URL(request.url).origin}/api/auth/google/callback`,
  };
}

function googleStateCookie(value: string, request: Request, maxAge = 600) {
  return `${googleStateCookieName}=${encodeURIComponent(value)}; Path=/api/auth/google/callback; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secureRequest(request) ? "; Secure" : ""}`;
}

function authErrorRedirect(request: Request, code: string) {
  const redirect = new URL("/", request.url);
  redirect.searchParams.set("authError", code);
  return redirect.toString();
}

function secureRequest(request: Request) {
  return new URL(request.url).protocol === "https:";
}

auth.get("/google", c => {
  const config = googleConfig(c.req.raw);
  if (!config.clientId || !config.clientSecret) return c.redirect(authErrorRedirect(c.req.raw, "google_config"));

  const state = randomState();
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();

  c.header("Set-Cookie", googleStateCookie(state, c.req.raw));
  return c.redirect(authorize.toString());
});

auth.get("/google/callback", async c => {
  const request = c.req.raw;
  const callback = new URL(request.url);
  const expectedState = cookieValue(request, googleStateCookieName);
  const state = callback.searchParams.get("state");
  const code = callback.searchParams.get("code");
  const config = googleConfig(request);

  if (!expectedState || !state || state !== expectedState) return c.redirect(authErrorRedirect(request, "google_state"));
  if (callback.searchParams.get("error") || !code) return c.redirect(authErrorRedirect(request, "google_cancelled"));
  if (!config.clientId || !config.clientSecret) return c.redirect(authErrorRedirect(request, "google_config"));

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
    const tokens = await tokenResponse.json() as { access_token?: string };
    if (!tokens.access_token) throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) throw new Error("GOOGLE_PROFILE_FAILED");
    const profile = await profileResponse.json() as GoogleProfile;
    const email = String(profile.email || "").trim().toLowerCase();
    if (!profile.sub || !profile.email_verified || !emailPattern.test(email)) throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");

    await ensureSchema();
    const existing = await database().prepare("SELECT email FROM users WHERE lower(email)=? LIMIT 1").bind(email).first<{ email: string }>();
    const displayName = String(profile.name || email.split("@")[0] || "Google хэрэглэгч").trim().slice(0, 50);
    const role = isAdminEmail(email) ? "admin" : "member";
    if (existing) {
      await database().prepare("UPDATE users SET role=CASE WHEN ?='admin' THEN 'admin' ELSE role END,contact_email=COALESCE(NULLIF(contact_email,''),email) WHERE email=?").bind(role, existing.email).run();
    } else {
      await database().prepare("INSERT INTO users (email,display_name,role,usercode,contact_email,password_hash) VALUES (?,?,?,?,?,NULL)").bind(email, displayName, role, newUsercode(), email).run();
    }

    const token = await createSession(email, c.req.header("user-agent") || "");
    const headers = new Headers({ Location: "/" });
    headers.append("Set-Cookie", sessionCookie(token, secureRequest(request)));
    headers.append("Set-Cookie", googleStateCookie("", request, 0));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error("Google authentication failed", error);
    const headers = new Headers({ Location: authErrorRedirect(request, "google_failed") });
    headers.append("Set-Cookie", googleStateCookie("", request, 0));
    return new Response(null, { status: 302, headers });
  }
});

auth.get("/session", async c => {
  const user = await authenticateRequest(c.req.raw);
  return c.json({ authenticated: Boolean(user), user });
});

auth.post("/register", async c => {
  await ensureSchema();
  const body = await c.req.json<{ displayName?: string; email?: string; password?: string; confirmPassword?: string; adult?: boolean; terms?: boolean }>();
  const displayName = String(body.displayName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (displayName.length < 2 || displayName.length > 50) return c.json({ error: "Хэрэглэгчийн нэр 2–50 тэмдэгт байна." }, 400);
  if (!emailPattern.test(email)) return c.json({ error: "Имэйл хаяг буруу байна." }, 400);
  if (password.length < 8) return c.json({ error: "Нууц үг хамгийн багадаа 8 тэмдэгт байна." }, 400);
  if (password !== body.confirmPassword) return c.json({ error: "Нууц үгийн баталгаажуулалт таарахгүй байна." }, 400);
  if (!body.adult || !body.terms) return c.json({ error: "Нас болон үйлчилгээний нөхцөлийг зөвшөөрнө үү." }, 400);
  const existing = await database().prepare("SELECT password_hash AS passwordHash FROM users WHERE email=?").bind(email).first<{ passwordHash: string | null }>();
  if (existing?.passwordHash) return c.json({ error: "Энэ имэйлээр бүртгэл үүссэн байна." }, 409);
  const passwordHash = await hashPassword(password);
  const role = isAdminEmail(email) ? "admin" : "member";
  if (existing) {
    await database().prepare("UPDATE users SET display_name=?,contact_email=?,password_hash=?,role=CASE WHEN ?='admin' THEN 'admin' ELSE role END WHERE email=?").bind(displayName, email, passwordHash, role, email).run();
  } else {
    await database().prepare("INSERT INTO users (email,display_name,role,usercode,contact_email,password_hash) VALUES (?,?,?,?,?,?)").bind(email, displayName, role, newUsercode(), email, passwordHash).run();
  }
  const token = await createSession(email, c.req.header("user-agent") || "");
  c.header("Set-Cookie", sessionCookie(token, secureRequest(c.req.raw)));
  return c.json({ ok: true });
});

auth.post("/login", async c => {
  await ensureSchema();
  const body = await c.req.json<{ identifier?: string; password?: string; remember?: boolean }>();
  const identifier = String(body.identifier || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = await database().prepare("SELECT email,password_hash AS passwordHash FROM users WHERE lower(email)=? OR lower(display_name)=? LIMIT 1").bind(identifier, identifier).first<{ email: string; passwordHash: string | null }>();
  if (!user || !await verifyPassword(password, user.passwordHash)) return c.json({ error: "Имэйл, хэрэглэгчийн нэр эсвэл нууц үг буруу байна." }, 401);
  const token = await createSession(user.email, c.req.header("user-agent") || "");
  c.header("Set-Cookie", sessionCookie(token, secureRequest(c.req.raw)));
  return c.json({ ok: true });
});

auth.post("/password", async c => {
  const current = await authenticateRequest(c.req.raw);
  if (!current) return c.json({ error: "Нэвтрэх шаардлагатай." }, 401);
  const body = await c.req.json<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>();
  const row = await database().prepare("SELECT password_hash AS passwordHash FROM users WHERE email=?").bind(current.email).first<{ passwordHash: string | null }>();
  if (!row?.passwordHash) return c.json({ error: "Google бүртгэлд тусдаа нууц үг солих шаардлагагүй." }, 403);
  if (!await verifyPassword(String(body.currentPassword || ""), row?.passwordHash || null)) return c.json({ error: "Одоогийн нууц үг буруу байна." }, 400);
  const next = String(body.newPassword || "");
  if (next.length < 8) return c.json({ error: "Шинэ нууц үг хамгийн багадаа 8 тэмдэгт байна." }, 400);
  if (next !== body.confirmPassword) return c.json({ error: "Шинэ нууц үгийн баталгаажуулалт таарахгүй байна." }, 400);
  await database().prepare("UPDATE users SET password_hash=? WHERE email=?").bind(await hashPassword(next), current.email).run();
  return c.json({ ok: true });
});

const logout = async (c: any) => {
  await ensureSchema();
  await deleteSession(c.req.header("cookie"));
  c.header("Set-Cookie", clearSessionCookie(secureRequest(c.req.raw)));
  return c.redirect("/");
};
auth.get("/logout", logout);
auth.post("/logout", logout);

export const GET = (request: Request) => auth.fetch(request);
export const POST = (request: Request) => auth.fetch(request);
