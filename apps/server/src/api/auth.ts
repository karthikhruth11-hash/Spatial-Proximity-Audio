import { Router, Response } from "express";
import { RegisterSchema, LoginSchema } from "@proxispeak/shared";
import { UserModel } from "../models/User.js";
import { hashPassword, comparePassword, generateAuthToken } from "../auth/service.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { env } from "../config/env.js";

export const authRouter: Router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

authRouter.post("/auth/register", async (req, res: Response) => {
  const parseResult = RegisterSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid registration payload",
        details: parseResult.error.flatten(),
      },
    });
    return;
  }

  const { email, password, displayName } = parseResult.data;

  const existing = await UserModel.findOne({ email });
  if (existing) {
    res.status(409).json({
      ok: false,
      error: {
        code: "USER_EXISTS",
        message: "A user with this email address already exists",
      },
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  
  // Pick an avatar color from a curated palette
  const colors = ["#06b6d4", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#3b82f6"];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)] || "#06b6d4";

  const user = await UserModel.create({
    email,
    passwordHash,
    displayName,
    avatarColor,
  });

  const token = generateAuthToken({ userId: user._id.toString(), email: user.email });
  res.cookie("proxispeak_token", token, COOKIE_OPTIONS);

  res.status(201).json({
    ok: true,
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      },
      token,
    },
  });
});

authRouter.post("/auth/login", async (req, res: Response) => {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid login payload",
      },
    });
    return;
  }

  const { email, password } = parseResult.data;
  const user = await UserModel.findOne({ email });
  if (!user) {
    res.status(401).json({
      ok: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      },
    });
    return;
  }

  const passwordValid = await comparePassword(password, user.passwordHash);
  if (!passwordValid) {
    res.status(401).json({
      ok: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      },
    });
    return;
  }

  const token = generateAuthToken({ userId: user._id.toString(), email: user.email });
  res.cookie("proxispeak_token", token, COOKIE_OPTIONS);

  res.status(200).json({
    ok: true,
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      },
      token,
    },
  });
});

authRouter.post("/auth/logout", (_req, res: Response) => {
  res.clearCookie("proxispeak_token", COOKIE_OPTIONS);
  res.status(200).json({
    ok: true,
    data: {
      message: "Logged out successfully",
    },
  });
});

authRouter.get("/auth/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = await UserModel.findById(req.user?.userId).select("-passwordHash");
  if (!user) {
    res.status(404).json({
      ok: false,
      error: {
        code: "USER_NOT_FOUND",
        message: "User account could not be found",
      },
    });
    return;
  }

  res.status(200).json({
    ok: true,
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
        preferences: user.preferences,
      },
    },
  });
});
