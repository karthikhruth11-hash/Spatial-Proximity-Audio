import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load root .env or local .env if available
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/proxispeak"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16).default("proxispeak_jwt_secret_dev_32characters_min"),
  COOKIE_SECRET: z.string().min(16).default("proxispeak_cookie_secret_dev_32chars_min"),
  HEARING_RADIUS: z.coerce.number().default(100),
  HYSTERESIS_MARGIN: z.coerce.number().default(10),
  MAX_ACTIVE_PEERS: z.coerce.number().default(8),
  MOVEMENT_TICK_HZ: z.coerce.number().default(20),
  MAX_SPEED_PX_PER_SEC: z.coerce.number().default(220),
  STUN_URL: z.string().default("stun:stun.l.google.com:19302"),
  TURN_URL: z.string().default("turn:localhost:3478"),
  TURN_SHARED_SECRET: z.string().default("proxispeak_coturn_secret_key_12345"),
  TURN_CREDENTIAL_TTL_SECONDS: z.coerce.number().default(600),
  INSTANCE_ID: z.string().default("server-1"),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

let parsedEnv: EnvConfig;
try {
  parsedEnv = EnvSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Invalid environment configuration:", JSON.stringify(error.format(), null, 2));
  }
  throw new Error("Failed to validate server environment variables");
}

export const env = parsedEnv;
