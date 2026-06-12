import { z } from 'zod'
import { COMPONENT_FAMILIES } from '../domain/families.js'

export const PinTypeSchema = z.enum([
  'GPIO',
  'PWM',
  'UART',
  'SPI',
  'I2C',
  'ADC',
  'DAC',
  'GND',
  'VCC',
  'RST',
  'EN',
  'CLK',
  'NC',
  'OTHER',
])

export const PinSchema = z.object({
  number: z.string().min(1),
  name: z.string().min(1),
  type: PinTypeSchema,
  description: z.string().optional().default(''),
  busCapabilities: z.array(z.string()).default([]),
})

export const RegistryEntrySchema = z.object({
  id: z.string().min(1),
  family: z.enum(COMPONENT_FAMILIES),
  category: z.string().min(1),
  name: z.string().min(1),
  manufacturer: z.string().min(1),
  partNumber: z.string().min(1),
  wokwiType: z.string().optional().default(''),
  pins: z.array(PinSchema).default([]),
  configDefaults: z.record(z.unknown()).default({}),
  runtimeDefaults: z.record(z.unknown()).default({}),
  version: z.number().int().positive(),
  timestamp: z.string().min(1),
  checksumSha256: z.string().min(1),
})

export const SearchRequestSchema = z.object({
  partNumber: z.string().min(1),
  datasheetUrl: z.string().url().optional(),
  provider: z.string().min(1).default('manual'),
})

export const ImportRequestSchema = z.object({
  partNumber: z.string().min(1),
  datasheetUrl: z.string().url().optional(),
  manufacturer: z.string().optional().default(''),
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  family: z.enum(COMPONENT_FAMILIES).optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  wokwiType: z.string().optional().default(''),
  pins: z.array(PinSchema).optional(),
  configDefaults: z.record(z.unknown()).optional(),
  runtimeDefaults: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const GenerateRegistryRequestSchema = z.object({
  entry: ImportRequestSchema.partial(),
})

export const ValidateRequestSchema = z.object({
  entry: RegistryEntrySchema.partial(),
})

