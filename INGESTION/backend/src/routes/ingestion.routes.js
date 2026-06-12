import { Router } from 'express'
import {
  ingestionSearch,
  ingestionImport,
  ingestionValidate,
  ingestionGenerateRegistry,
  ingestionJobs,
  ingestionComponents,
  ingestionComponentById,
  ingestionScan,
  ingestionExportRegistry,
  ingestionCandidates,
  ingestionApproveCandidate,
  ingestionRejectCandidate,
  ingestionGetSettings,
  ingestionSetScanPaused,
} from '../controllers/ingestion.controller.js'

export const ingestionRouter = Router()

ingestionRouter.post('/search', ingestionSearch)
ingestionRouter.post('/import', ingestionImport)
ingestionRouter.post('/validate', ingestionValidate)
ingestionRouter.post('/generate-registry', ingestionGenerateRegistry)
ingestionRouter.get('/jobs', ingestionJobs)
ingestionRouter.get('/components', ingestionComponents)
ingestionRouter.get('/components/:id', ingestionComponentById)
ingestionRouter.post('/scan', ingestionScan)
ingestionRouter.post('/export-registry', ingestionExportRegistry)
ingestionRouter.get('/candidates', ingestionCandidates)
ingestionRouter.post('/candidates/:id/approve', ingestionApproveCandidate)
ingestionRouter.post('/candidates/:id/reject', ingestionRejectCandidate)
ingestionRouter.get('/settings', ingestionGetSettings)
ingestionRouter.post('/settings/scan-paused', ingestionSetScanPaused)
