import { connectDb } from '../src/config/db.js'
import { runDiscoveryScan } from '../src/services/discoveryScanService.js'
import { exportRegistryToFile } from '../src/services/registryExportService.js'

async function main() {
  await connectDb()
  const scan = await runDiscoveryScan()
  const exported = await exportRegistryToFile()
  process.stdout.write(
    JSON.stringify({ ok: true, scan, exported }, null, 2) + '\n',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

