import { Request, Response, NextFunction } from "express";
import { verifyAuthToken, TokenPayload } from "../auth/service.js";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  let token: string | undefined = req.cookies?.proxispeak_token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  if (!token) {
    res.status(401).json({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
    return;
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({
      ok: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired session token",
      },
    });
    return;
  }

  req.user = payload;
  next();
}
