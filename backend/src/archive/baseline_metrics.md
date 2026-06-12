# Baseline Performance Metrics Report

Recorded on: 2026-06-04T16:29:40Z

## 1. Backend Startup Time
- Nodemon / ts-node cold start to listening state on port 5000: **4.5 seconds**

## 2. Memory Usage (Cold Start)
- Main Node process (ts-node + express + mongoose): **~72 MB - 85 MB**
- Background task processes (compilation / arduino-cli helpers): **~605 MB peak**

## 3. Agent Formulation & Tool execution Times
- Executing the complete `test-agent2-tools.ts` suite (12 core tools): **9.8 seconds**
- Average tool execution latency: **~0.8 seconds / tool**

## 4. API Response Times
- `/health` (plain JSON output, database check skipped): **< 15 ms**
- Database query latency (fetch single session / project): **~35 ms**

## 5. Frontend Bundle Size
### Main Frontend (`frontend/src`)
- `dist/assets/index-jxV4URqA.css`: **106.18 kB** (gzip: 16.25 kB)
- `dist/assets/vendor-CVwccR9_.js`: **1,229.20 kB** (gzip: 341.24 kB)
- `dist/assets/react-DsxelOC0.js`: **181.79 kB** (gzip: 57.19 kB)
- `dist/assets/motion-CGOsD4G5.js`: **134.10 kB** (gzip: 43.96 kB)
- Total bundle build time (Vite): **1.03s**

### Virtual Playground Frontend (`virtual-playground/frontend`)
- `dist/assets/index-En7zlZ9S.css`: **42.85 kB** (gzip: 8.22 kB)
- `dist/assets/index-CQn5dlcu.js`: **1,323.11 kB** (gzip: 369.95 kB)
- Total bundle build time (Vite): **2.87s**
