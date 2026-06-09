import { useEffect, useMemo, useState } from 'react'
import {
  ingestionComponents,
  ingestionCandidates,
  ingestionApproveCandidate,
  ingestionExportRegistry,
  ingestionGetSettings,
  ingestionScan,
  ingestionSetScanPaused,
  ingestionGenerateRegistry,
  ingestionImport,
  ingestionJobs,
  ingestionSearch,
  ingestionValidate,
} from '../api/ingestionApi.js'
import { getErrorMessage } from '../api/http.js'
import { COMPONENT_FAMILIES } from '../domain/families.js'
import './AdminIngestionPage.css'

const PIN_TYPES = [
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
]

export default function AdminIngestionPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('Draft')

  const [searchForm, setSearchForm] = useState({ partNumber: '', datasheetUrl: '' })
  const [searchResult, setSearchResult] = useState(null)

  const [draft, setDraft] = useState({
    provider: 'manual',
    partNumber: '',
    datasheetUrl: '',
    manufacturer: '',
    name: '',
    description: '',
    family: '',
    category: '',
    imageUrl: '',
    wokwiType: '',
    pins: [],
    configDefaults: {},
    runtimeDefaults: {},
    metadata: {},
  })

  const [configText, setConfigText] = useState('{}')
  const [runtimeText, setRuntimeText] = useState('{}')
  const [metadataText, setMetadataText] = useState('{}')

  const [registryEntry, setRegistryEntry] = useState(null)
  const [validation, setValidation] = useState(null)

  const [jobs, setJobs] = useState([])
  const [components, setComponents] = useState([])
  const [candidates, setCandidates] = useState([])
  const [scanSummary, setScanSummary] = useState(null)
  const [exportResult, setExportResult] = useState(null)
  const [scanPaused, setScanPausedState] = useState(false)

  const canGenerate = Boolean(draft.family)

  const draftSummary = useMemo(() => {
    const pn = draft.partNumber || '(partNumber)'
    const fam = draft.family || '(family)'
    return `${pn} · ${fam}`
  }, [draft.family, draft.partNumber])

  useEffect(() => {
    refreshLists()
  }, [])

  async function refreshLists() {
    try {
      const [jobsRes, compsRes, candsRes, settingsRes] = await Promise.all([
        ingestionJobs(),
        ingestionComponents(),
        ingestionCandidates(),
        ingestionGetSettings(),
      ])
      setJobs(jobsRes.jobs ?? [])
      setComponents(compsRes.components ?? [])
      setCandidates(candsRes.candidates ?? [])
      setScanPausedState(Boolean(settingsRes.settings?.scanPaused ?? false))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function onTogglePause() {
    setBusy(true)
    setError('')
    try {
      const next = !scanPaused
      const res = await ingestionSetScanPaused(next)
      setScanPausedState(Boolean(res.settings?.scanPaused ?? next))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onScanNow() {
    setBusy(true)
    setError('')
    try {
      if (scanPaused) return
      const res = await ingestionScan()
      setScanSummary(res.summary ?? null)
      await refreshLists()
      setTab('Review')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onExportRegistry() {
    setBusy(true)
    setError('')
    try {
      const res = await ingestionExportRegistry()
      setExportResult(res.result ?? null)
      await refreshLists()
      setTab('History')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onApproveCandidate(id) {
    setBusy(true)
    setError('')
    try {
      await ingestionApproveCandidate(id)
      await refreshLists()
      setTab('Review')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onSearch() {
    setBusy(true)
    setError('')
    setRegistryEntry(null)
    setValidation(null)
    try {
      const payload = {
        partNumber: searchForm.partNumber.trim(),
        datasheetUrl: searchForm.datasheetUrl.trim() || undefined,
        provider: 'manual',
      }
      const res = await ingestionSearch(payload)
      setSearchResult(res.result)

      const extracted = res.result?.extracted ?? {}
      const pins = extracted.pins ?? []
      const family = extracted.family ?? ''
      const category = extracted.category ?? ''

      const nextDraft = {
        provider: res.result?.provider ?? 'manual',
        partNumber: res.result?.partNumber ?? payload.partNumber,
        datasheetUrl: res.result?.datasheetUrl ?? payload.datasheetUrl ?? '',
        manufacturer: res.result?.manufacturer ?? '',
        name: res.result?.name ?? '',
        description: res.result?.description ?? '',
        family,
        category,
        imageUrl: res.result?.imageUrl ?? '',
        wokwiType: '',
        pins,
        configDefaults: {},
        runtimeDefaults: {},
        metadata: res.result?.metadata ?? {},
      }

      setDraft(nextDraft)
      setConfigText(JSON.stringify(nextDraft.configDefaults ?? {}, null, 2))
      setRuntimeText(JSON.stringify(nextDraft.runtimeDefaults ?? {}, null, 2))
      setMetadataText(JSON.stringify(nextDraft.metadata ?? {}, null, 2))
      setTab('Draft')

      await refreshLists()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onGenerateRegistry() {
    setBusy(true)
    setError('')
    setValidation(null)
    try {
      const payload = {
        entry: normalizeDraft(),
      }
      const res = await ingestionGenerateRegistry(payload)
      setRegistryEntry(res.entry)
      setValidation(res.validation)
      setTab('Registry')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onValidate() {
    setBusy(true)
    setError('')
    try {
      const entry = registryEntry ?? normalizeDraft()
      const res = await ingestionValidate({ entry })
      setValidation(res.validation)
      setTab('Validation')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onImport() {
    setBusy(true)
    setError('')
    try {
      const payload = normalizeDraft()
      const res = await ingestionImport(payload)
      if (!res.ok) {
        setValidation(res.validation ?? null)
        setTab('Validation')
        return
      }
      setRegistryEntry(res.entry)
      await refreshLists()
      setTab('History')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function normalizeDraft() {
    const configDefaults = safeJsonParse(configText, {})
    const runtimeDefaults = safeJsonParse(runtimeText, {})
    const metadata = safeJsonParse(metadataText, {})

    const pins = Array.isArray(draft.pins) ? draft.pins : []

    return {
      provider: draft.provider,
      partNumber: String(draft.partNumber ?? '').trim(),
      datasheetUrl: draft.datasheetUrl ? String(draft.datasheetUrl).trim() : undefined,
      manufacturer: String(draft.manufacturer ?? '').trim(),
      name: String(draft.name ?? '').trim(),
      description: String(draft.description ?? '').trim(),
      family: draft.family || undefined,
      category: String(draft.category ?? '').trim() || undefined,
      imageUrl: draft.imageUrl ? String(draft.imageUrl).trim() : undefined,
      wokwiType: String(draft.wokwiType ?? '').trim(),
      pins: pins.map((p) => ({
        number: String(p.number ?? '').trim(),
        name: String(p.name ?? '').trim(),
        type: String(p.type ?? 'OTHER'),
        description: String(p.description ?? ''),
        busCapabilities: Array.isArray(p.busCapabilities) ? p.busCapabilities : [],
      })),
      configDefaults,
      runtimeDefaults,
      metadata,
    }
  }

  function updatePin(idx, patch) {
    setDraft((prev) => {
      const nextPins = (prev.pins ?? []).slice()
      nextPins[idx] = { ...(nextPins[idx] ?? {}), ...patch }
      return { ...prev, pins: nextPins }
    })
  }

  function addPin() {
    setDraft((prev) => ({
      ...prev,
      pins: [...(prev.pins ?? []), { number: '', name: '', type: 'GPIO', description: '', busCapabilities: [] }],
    }))
  }

  function removePin(idx) {
    setDraft((prev) => {
      const nextPins = (prev.pins ?? []).slice()
      nextPins.splice(idx, 1)
      return { ...prev, pins: nextPins }
    })
  }

  return (
    <div className="ingestionLayout">
      <section className="card">
        <h2 className="cardTitle">Ingestion</h2>
        <div className="stack">
          <label>
            Part Number
            <input
              value={searchForm.partNumber}
              onChange={(e) => setSearchForm((p) => ({ ...p, partNumber: e.target.value }))}
              placeholder="MG90S / HC-SR04 / ESP32 / A4988"
            />
          </label>
          <label>
            Datasheet URL (optional)
            <input
              value={searchForm.datasheetUrl}
              onChange={(e) => setSearchForm((p) => ({ ...p, datasheetUrl: e.target.value }))}
              placeholder="https://…"
            />
          </label>
          <div className="row">
            <button className="primary" disabled={busy || scanPaused} onClick={onScanNow}>
              Scan Now
            </button>
            <button disabled={busy} onClick={onTogglePause}>
              {scanPaused ? 'Resume Scans' : 'Pause Scans'}
            </button>
            <button disabled={busy} onClick={onExportRegistry}>
              Export Registry
            </button>
          </div>
          <div className="row">
            <button className="primary" disabled={busy || !searchForm.partNumber.trim()} onClick={onSearch}>
              Search
            </button>
            <button disabled={busy || !canGenerate} onClick={onGenerateRegistry}>
              Generate Registry
            </button>
            <button disabled={busy} onClick={onValidate}>
              Validate
            </button>
            <button className="primary" disabled={busy || !draft.partNumber.trim()} onClick={onImport}>
              Import
            </button>
          </div>
          {error ? <div className="muted">{error}</div> : null}
          <div className="muted">{draftSummary}</div>
          {scanSummary ? <div className="muted">Scan: {JSON.stringify(scanSummary)}</div> : null}
          {exportResult ? <div className="muted">Export: {JSON.stringify(exportResult)}</div> : null}
        </div>

        <div style={{ height: 12 }} />

        <h2 className="cardTitle">History</h2>
        <div className="list">
          {(jobs ?? []).slice(0, 12).map((j) => {
            const ok = j.status === 'success'
            const label = `${j.type} · ${new Date(j.createdAt).toLocaleString()}`
            const pn = j.input?.partNumber ?? ''
            return (
              <div key={j._id} className="listItem" onClick={() => setTab('History')}>
                <div className="listItemTitle">
                  <div>{label}</div>
                  <div className={ok ? 'statusOk' : j.status === 'error' ? 'statusErr' : ''}>{j.status}</div>
                </div>
                <div className="muted">{pn}</div>
              </div>
            )
          })}
        </div>

        <div style={{ height: 12 }} />

        <h2 className="cardTitle">Components</h2>
        <div className="list">
          {(components ?? []).slice(0, 12).map((c) => (
            <div key={c._id} className="listItem">
              <div className="listItemTitle">
                <div>{c.partNumber}</div>
                <div className="pill">{c.family || 'UNKNOWN'}</div>
              </div>
              <div className="muted">{c.manufacturer || 'Unknown'}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="tabs">
          {['Draft', 'Datasheet', 'Pins', 'Config', 'Runtime', 'Registry', 'Validation', 'Review', 'History'].map(
            (t) => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ),
          )}
        </div>

        {tab === 'Draft' ? (
          <div className="stack">
            <label>
              Manufacturer
              <input
                value={draft.manufacturer}
                onChange={(e) => setDraft((p) => ({ ...p, manufacturer: e.target.value }))}
              />
            </label>
            <label>
              Name
              <input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label>
              Description
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                style={{ minHeight: 90 }}
              />
            </label>
            <div className="row">
              <label style={{ flex: 1 }}>
                Family
                <select value={draft.family} onChange={(e) => setDraft((p) => ({ ...p, family: e.target.value }))}>
                  <option value="">(unassigned)</option>
                  {COMPONENT_FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1 }}>
                Category
                <input
                  value={draft.category}
                  onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Datasheet URL
              <input
                value={draft.datasheetUrl}
                onChange={(e) => setDraft((p) => ({ ...p, datasheetUrl: e.target.value }))}
              />
            </label>
            <label>
              Wokwi Type
              <input
                value={draft.wokwiType}
                onChange={(e) => setDraft((p) => ({ ...p, wokwiType: e.target.value }))}
                placeholder="(optional)"
              />
            </label>
            <label>
              Metadata (JSON)
              <textarea value={metadataText} onChange={(e) => setMetadataText(e.target.value)} />
            </label>
          </div>
        ) : null}

        {tab === 'Datasheet' ? (
          <div className="stack">
            <div className="muted">
              {searchResult?.datasheet?.kind ? (
                <>
                  <span className="pill">{searchResult.datasheet.kind}</span> <span>{searchResult.datasheet.title}</span>
                </>
              ) : (
                'No datasheet processed yet.'
              )}
            </div>
            {draft.datasheetUrl ? (
              <div className="row">
                <a href={draft.datasheetUrl} target="_blank" rel="noreferrer" className="pill">
                  Open datasheet
                </a>
              </div>
            ) : null}
            <textarea
              readOnly
              value={String(searchResult?.datasheet?.text ?? '').slice(0, 40000)}
              placeholder="Datasheet text will appear here after a Search or Import with a URL."
            />
          </div>
        ) : null}

        {tab === 'Pins' ? (
          <div className="stack">
            <div className="row">
              <button onClick={addPin}>Add Pin</button>
              <div className="muted">{(draft.pins ?? []).length} pins</div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>#</th>
                  <th style={{ width: 140 }}>Name</th>
                  <th style={{ width: 110 }}>Type</th>
                  <th>Description</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {(draft.pins ?? []).map((p, idx) => (
                  <tr key={`${idx}`}>
                    <td>
                      <input
                        value={p.number ?? ''}
                        onChange={(e) => updatePin(idx, { number: e.target.value })}
                      />
                    </td>
                    <td>
                      <input value={p.name ?? ''} onChange={(e) => updatePin(idx, { name: e.target.value })} />
                    </td>
                    <td>
                      <select value={p.type ?? 'OTHER'} onChange={(e) => updatePin(idx, { type: e.target.value })}>
                        {PIN_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={p.description ?? ''}
                        onChange={(e) => updatePin(idx, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <button className="danger" onClick={() => removePin(idx)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'Config' ? (
          <div className="stack">
            <div className="muted">configDefaults (JSON)</div>
            <textarea value={configText} onChange={(e) => setConfigText(e.target.value)} />
          </div>
        ) : null}

        {tab === 'Runtime' ? (
          <div className="stack">
            <div className="muted">runtimeDefaults (JSON)</div>
            <textarea value={runtimeText} onChange={(e) => setRuntimeText(e.target.value)} />
          </div>
        ) : null}

        {tab === 'Registry' ? (
          <div className="stack">
            <div className="muted">Registry entry preview</div>
            <textarea readOnly value={registryEntry ? JSON.stringify(registryEntry, null, 2) : ''} />
          </div>
        ) : null}

        {tab === 'Validation' ? (
          <div className="stack">
            <div className="muted">Validation results</div>
            <textarea readOnly value={validation ? JSON.stringify(validation, null, 2) : ''} />
          </div>
        ) : null}

        {tab === 'History' ? (
          <div className="stack">
            <div className="muted">Latest ingestion jobs</div>
            <textarea readOnly value={jobs ? JSON.stringify(jobs.slice(0, 50), null, 2) : ''} />
          </div>
        ) : null}

        {tab === 'Review' ? (
          <div className="stack">
            <div className="muted">Registry candidates (review queue)</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Family</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(candidates ?? []).slice(0, 200).map((c) => (
                  <tr key={c._id}>
                    <td>{c.partNumber}</td>
                    <td>{c.source}</td>
                    <td>{c.status}</td>
                    <td>{c.draft?.family ?? ''}</td>
                    <td>
                      {c.status === 'pending' ? (
                        <button className="primary" disabled={busy} onClick={() => onApproveCandidate(c._id)}>
                          Approve
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <textarea readOnly value={candidates ? JSON.stringify(candidates.slice(0, 20), null, 2) : ''} />
          </div>
        ) : null}
      </section>
    </div>
  )
}

function safeJsonParse(text, fallback) {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}
