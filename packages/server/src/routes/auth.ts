import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { users, refreshTokens } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { signAccessToken, signRefreshToken, verifyRefreshToken, authGuard } from "../middleware/auth.js";
import { config } from "../config.js";

export async function authRoutes(app: FastifyInstance) {
  // Google OAuth redirect
  app.get("/api/auth/google", async (request, reply) => {
    const params = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID!,
      redirect_uri: `${config.SERVER_URL}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
    });
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // Google OAuth callback
  app.get("/api/auth/google/callback", async (request, reply) => {
    const { code } = request.query as { code: string };

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${config.SERVER_URL}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();

    // Upsert user (find or create)
    let [existingUser] = await db.select().from(users).where(
      and(eq(users.provider, "google"), eq(users.providerId, profile.id))
    );
    if (!existingUser) {
      [existingUser] = await db
        .insert(users)
        .values({
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.picture,
          provider: "google",
          providerId: profile.id,
        })
        .returning();
    }

    const accessToken = signAccessToken(existingUser.id);
    const refreshToken = signRefreshToken(existingUser.id);

    await db.insert(refreshTokens).values({
      userId: existingUser.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    reply
      .setCookie("access_token", accessToken, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 900 })
      .setCookie("refresh_token", refreshToken, { httpOnly: true, sameSite: "strict", path: "/api/auth", maxAge: 604800 })
      .redirect(config.CLIENT_URL);
  });

  // GitHub OAuth redirect
  app.get("/api/auth/github", async (request, reply) => {
    const params = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID!,
      redirect_uri: `${config.SERVER_URL}/api/auth/github/callback`,
      scope: "user:email",
    });
    return reply.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  // GitHub OAuth callback
  app.get("/api/auth/github/callback", async (request, reply) => {
    const { code } = request.query as { code: string };

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokens = await tokenRes.json();

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userRes.json();

    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const emails = await emailRes.json();
    const primaryEmail = emails.find((e: any) => e.primary)?.email ?? profile.email;

    // Upsert user (find or create)
    let [existingUser] = await db.select().from(users).where(
      and(eq(users.provider, "github"), eq(users.providerId, String(profile.id)))
    );
    if (!existingUser) {
      [existingUser] = await db
        .insert(users)
        .values({
          email: primaryEmail,
          name: profile.name ?? profile.login,
          avatarUrl: profile.avatar_url,
          provider: "github",
          providerId: String(profile.id),
        })
        .returning();
    }

    const accessToken = signAccessToken(existingUser.id);
    const refreshToken = signRefreshToken(existingUser.id);

    await db.insert(refreshTokens).values({
      userId: existingUser.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    reply
      .setCookie("access_token", accessToken, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 900 })
      .setCookie("refresh_token", refreshToken, { httpOnly: true, sameSite: "strict", path: "/api/auth", maxAge: 604800 })
      .redirect(config.CLIENT_URL);
  });

  // Token refresh
  app.post("/api/auth/refresh", async (request, reply) => {
    const token = request.cookies.refresh_token;
    if (!token) return reply.status(401).send({ error: "No refresh token" });

    try {
      const payload = verifyRefreshToken(token);

      const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token));
      if (!stored) {
        await db.delete(refreshTokens).where(eq(refreshTokens.userId, payload.sub));
        return reply.status(401).send({ error: "Token reuse detected" });
      }

      await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
      const newAccessToken = signAccessToken(payload.sub);
      const newRefreshToken = signRefreshToken(payload.sub);

      await db.insert(refreshTokens).values({
        userId: payload.sub,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      reply
        .setCookie("access_token", newAccessToken, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 900 })
        .setCookie("refresh_token", newRefreshToken, { httpOnly: true, sameSite: "strict", path: "/api/auth", maxAge: 604800 })
        .send({ ok: true });
    } catch {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }
  });

  // Dev login (development only)
  app.post("/api/auth/dev", async (request, reply) => {
    if (process.env.NODE_ENV === "production") {
      return reply.status(404).send({ error: "Not found" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.provider, "github"), eq(users.providerId, "dev-user")));

    let userId: string;
    if (user) {
      userId = user.id;
    } else {
      const [newUser] = await db.insert(users).values({
        email: "dev@mercuria.local",
        name: "開発ユーザー",
        avatarUrl: null,
        provider: "github",
        providerId: "dev-user",
      }).returning();
      userId = newUser.id;
    }

    const accessToken = signAccessToken(userId);
    const refreshToken = signRefreshToken(userId);
    await db.insert(refreshTokens).values({
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    reply
      .setCookie("access_token", accessToken, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 900 })
      .setCookie("refresh_token", refreshToken, { httpOnly: true, sameSite: "strict", path: "/api/auth", maxAge: 604800 })
      .send({ ok: true });
  });

  // Get current user
  app.get("/api/auth/me", { preHandler: [authGuard] }, async (request) => {
    const [user] = await db.select().from(users).where(eq(users.id, request.userId));
    if (!user) throw { statusCode: 404, message: "User not found" };
    return user;
  });

  // Logout
  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies.refresh_token;
    if (token) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
    }
    reply
      .clearCookie("access_token", { path: "/" })
      .clearCookie("refresh_token", { path: "/api/auth" })
      .send({ ok: true });
  });
}
