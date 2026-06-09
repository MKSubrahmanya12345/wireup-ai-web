import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().optional(),
  MONGO_URI: z.string().optional(),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  REGISTRY_OUTPUT_PATH: z.string().min(1).default('./exports/componentRegistry.json'),
  KICAD_LIB_PATHS: z.string().optional().default(''),
})

const raw = envSchema.parse(process.env)

export const env = {
  ...raw,
  MONGODB_URI: raw.MONGODB_URI || raw.MONGO_URI,
}

if (!env.MONGODB_URI) {
  throw new Error('Missing MONGODB_URI (or legacy MONGO_URI)')
}
