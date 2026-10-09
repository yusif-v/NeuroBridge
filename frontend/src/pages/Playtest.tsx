import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Bot, Check, Cpu, FileArchive, LoaderCircle, MonitorPlay, Square, Upload } from 'lucide-react'
import { api } from '../api'
import { ErrorNote } from '../components/ui'
import type { Playtest } from '../types'

const ACTIVE = ['queued', 'starting', 'playing', 'verifying']
const STAGES = ['Upload', 'Sandbox', 'Laya plays', 'Recheck', 'Report']
const stage = (status: string) => ({ queued: 0, starting: 1, playing: 2, verifying: 3, completed: 4, inconclusive: 4, environment_error: 4, cancelled: 4 }[status] ?? 0)

export function PlaytestPage() {
  const cache = useQueryClient()
  const [search, setSearch] = useSearchParams()
  const [file, setFile] = useState<File | null>(null)
  const [project, setProject] = useState('')
  const [version, setVersion] = useState('build-1')
  const [objective, setObjective] = useState('')
  const [entrypoint, setEntrypoint] = useState('')
  const [budget, setBudget] = useState(90)
  const [rule, setRule] = useState('none')
  const selected = search.get('job')
  const setSelected = (id: string) => setSearch({job: id}, {replace: true})
  const [frameError, setFrameError] = useState(false)
  const [validation, setValidation] = useState('')
  const caps = useQuery({ queryKey: ['sandbox'], queryFn: api.sandbox, refetchInterval: 5000 })
  const jobs = useQuery({ queryKey: ['playtests'], queryFn: api.playtests, refetchInterval: 3000 })
  const job = useQuery({ queryKey: ['playtest', selected], queryFn: () => api.playtest(selected!), enabled: !!selected, refetchInterval: 2000 })
  useEffect(() => { setFrameError(false) }, [job.dataUpdatedAt])
  const upload = useMutation({
    mutationFn: api.uploadBuild,
    onSuccess: (created) => { setSelected(created.id); setFrameError(false); cache.invalidateQueries({ queryKey: ['playtests'] }); cache.invalidateQueries({ queryKey: ['stats'] }) },
  })
  const cancel = useMutation({ mutationFn: () => api.cancelPlaytest(selected!), onSuccess: () => cache.invalidateQueries({ queryKey: ['playtest', selected] }) })
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) { setValidation('Choose a Linux/Windows executable or build ZIP.'); return }
    if (file.size > 200 * 1024 * 1024) { setValidation('Maximum build size is 200 MB.'); return }
    setValidation('')
    const body = new FormData()
    body.append('file', file); body.append('project', project); body.append('version', version)
    body.append('objective', objective || 'Explore the game using A/D, W/S, Space, E and Enter. Check for runtime errors.')
    body.append('entrypoint', entrypoint); body.append('budget', String(budget)); body.append('rule', rule)
    upload.mutate(body)
  }
  const current = job.data
  const live = !!current && ACTIVE.includes(current.status)
  const events = current?.events ?? []
  const latestDecision = events.find(e => e.data?.probabilities)
  const probabilities = latestDecision?.data?.probabilities as Record<string, number> | undefined
  const done = current ? [true, current.decision_count > 0, current.decision_count > 0, !!current.result?.bug_id, !!current.result] : []
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Laya / Build lab</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Upload a build. Watch the test.</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Laya controls the real game, records evidence and replays a finding before confirming it.</p></div>
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-amber-200"><Cpu className="size-4" />{caps.data?.gpu ?? 'CUDA Laya worker'}</div>
          <div className="mt-1 text-zinc-400">{caps.data?.sandbox_ready ? 'Sandbox ready' : caps.data?.worker_online ? 'Sandbox needs setup' : 'Worker offline · uploads remain queued'}</div>
        </div>
      </div>
      {(caps.error || jobs.error) && <ErrorNote error={caps.error || jobs.error} />}
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={submit} className={`glass space-y-4 p-5 ${current ? 'order-2 xl:order-1' : 'order-1'}`}>
          <div className="flex items-center gap-2 font-semibold text-white"><Upload className="size-4 text-amber-300" />New playtest</div>
          <label className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-amber-300/30 bg-amber-300/[0.025] p-6 text-center transition hover:bg-amber-300/5">
            <FileArchive className="mb-3 size-8 text-amber-300" /><span className="max-w-full truncate text-sm text-zinc-200">{file?.name ?? 'Choose Linux / Windows build ZIP'}</span>
            <span className="mt-1 text-xs text-zinc-500">x86_64 · 200 MB max · include all game data</span>
            <input type="file" accept=".exe,.zip,.x86_64,.bin" className="mt-3 w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200" onChange={e => { setFile(e.target.files?.[0] ?? null); setValidation('') }} />
          </label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-zinc-400">Project<input className="input mt-1" required maxLength={120} value={project} onChange={e => setProject(e.target.value)} placeholder="My game" /></label>
            <label className="text-xs text-zinc-400">Build<input className="input mt-1" required maxLength={80} value={version} onChange={e => setVersion(e.target.value)} /></label></div>
          <label className="block text-xs text-zinc-400">Goal and controls<textarea className="input mt-1 min-h-24" maxLength={3000} value={objective} onChange={e => setObjective(e.target.value)} placeholder="What should the player do? A/D to move, Space to jump, E to interact…" /></label>
          <label className="block text-xs text-zinc-400">Executable path inside ZIP <span className="text-zinc-600">(if multiple)</span><input className="input mt-1" value={entrypoint} onChange={e => setEntrypoint(e.target.value)} placeholder="Game/MyGame.x86_64" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-zinc-400">Decision budget<input className="input mt-1" type="number" min={5} max={300} value={budget} onChange={e => setBudget(Number(e.target.value))} /></label>
            <label className="text-xs text-zinc-400">Gameplay assertion<select className="input mt-1" value={rule} onChange={e => setRule(e.target.value)}><option value="none">Runtime errors</option><option value="key-gated-exit">Key required for exit</option></select></label></div>
          {rule === 'key-gated-exit' && <p className="text-xs leading-relaxed text-zinc-400">For builds displaying “KEY MISSING” and “DUNGEON CLEARED”. Seeing both in one frame violates the rule.</p>}
          {validation && <p className="text-sm text-red-300" role="alert">{validation}</p>}{upload.error && <ErrorNote error={upload.error} />}
          <button type="submit" disabled={upload.isPending || !file} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40">
            {upload.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <MonitorPlay className="size-4" />}{upload.isPending ? 'Uploading and validating…' : 'Upload & start test'}
          </button>
          <p className="text-xs leading-relaxed text-zinc-500">Linux builds run directly in offline Docker. Windows requires the optional Wine image. Laya uses OCR text and screen changes; unsupported builds are reported as environment issues.</p>
        </form>
        <div className={`space-y-4 ${current ? 'order-1 xl:order-2' : 'order-2'}`}>
          <div className="glass overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3"><span className="flex items-center gap-2 text-sm font-medium"><Bot className="size-4 text-amber-300" />Live sandbox{current && <span className="text-xs text-zinc-500">· {current.entrypoint.endsWith('.exe') ? 'Windows / Wine' : 'Linux native'}</span>}</span>
              <span className="font-mono text-xs text-amber-200">{current?.status.replace('_', ' ') ?? 'No build selected'}</span></div>
            <div className="relative aspect-video bg-black/50">
              {current && current.status !== 'queued' && !frameError ? <img src={`/api/v1/playtests/${current.id}/frame?t=${job.dataUpdatedAt}`} className="h-full w-full object-contain" alt="Real screenshot of the uploaded game inside its sandbox" onError={() => setFrameError(true)} onLoad={() => setFrameError(false)} /> :
                <div className="absolute inset-0 grid place-items-center text-center"><div><MonitorPlay className="mx-auto mb-3 size-10 text-zinc-700" /><p className="text-sm text-zinc-500">{current ? 'Waiting for the first captured frame' : 'The uploaded game will appear here'}</p></div></div>}
              {frameError && current && live && <button className="absolute bottom-3 right-3 text-xs text-zinc-400" onClick={() => setFrameError(false)}>Retry frame</button>}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-3"><span className="font-mono text-xs text-zinc-300">{current?.latest_action ? `→ ${current.latest_action}` : 'Waiting for a model action'} <span className="ml-3 text-zinc-600">{current?.decision_count ?? 0} / {current?.budget ?? '—'} decisions</span></span>
              {live && <button className="btn" disabled={cancel.isPending} onClick={() => cancel.mutate()}><Square className="size-3" />Stop</button>}</div>
          </div>
          {current && <>
            <div className="grid grid-cols-5 gap-2">{STAGES.map((name, index) => <div key={name} className={`rounded-lg border px-2 py-2.5 text-center text-xs ${done[index] || live && index === stage(current.status) ? 'border-amber-300/20 bg-amber-300/5 text-amber-200' : 'border-white/5 text-zinc-600'}`}><span className="mr-1 font-mono">{done[index] ? <Check className="inline size-3" /> : `0${index+1}`}</span>{name}</div>)}</div>
            {current.error && <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{current.error}</div>}
            {current.decision_count > 0 && <a className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-200" href={`/api/v1/playtests/${current.id}/runtime-log`}>Download runtime output<ArrowUpRight className="size-3" /></a>}
            {current.result && <div className="glass p-4"><p className="text-sm text-zinc-200">{current.result.summary ?? current.result.coverage}</p><Link className="mt-3 inline-flex items-center gap-1 text-sm text-amber-300" to={`/app/runs/${current.run_id}`}>Open evidence & report<ArrowUpRight className="size-4" /></Link></div>}
            <div className="grid gap-4 md:grid-cols-2"><div className="glass p-4"><h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Actual model probabilities</h2>
              {probabilities ? Object.entries(probabilities).sort((a,b) => b[1]-a[1]).slice(0,5).map(([action,p]) => <div key={action} className="mb-2"><div className="mb-1 flex justify-between font-mono text-xs"><span>{action}</span><span className="text-amber-200">{(p*100).toFixed(1)}%</span></div><div className="h-1 bg-white/5"><div className="h-full bg-amber-300/70" style={{width: `${p*100}%`}} /></div></div>) : <p className="text-xs text-zinc-600">Available after the first CUDA inference.</p>}</div>
              <div className="glass p-4"><h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Observed screen text</h2><pre className="max-h-36 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-400">{current.latest_observation || 'Waiting for OCR…'}</pre></div></div>
            <div className="glass max-h-52 overflow-auto p-4"><h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Live event log</h2>{events.map(e => <div key={e.id} className="mb-2 flex gap-3 font-mono text-xs"><span className="shrink-0 text-zinc-600">{e.ts.slice(11,19)}</span><span className="text-zinc-300">{e.message}</span></div>)}</div>
          </>}
          {job.error && <ErrorNote error={job.error} />}
        </div>
      </div>
      <div className="glass overflow-hidden"><div className="border-b border-white/5 px-5 py-3 text-sm font-semibold">Uploaded builds</div>
        {jobs.data?.length === 0 && <p className="p-5 text-sm text-zinc-500">No uploads yet.</p>}
        {jobs.data?.map((item: Playtest) => <button key={item.id} onClick={() => { setSelected(item.id); setFrameError(false) }} className="flex w-full items-center justify-between gap-4 border-b border-white/5 px-5 py-3 text-left transition hover:bg-white/[0.03]"><span className="min-w-0 truncate text-sm text-zinc-300">{item.project} / {item.filename}</span><span className="shrink-0 font-mono text-xs text-amber-200">{item.status.replace('_',' ')} · {item.decision_count} actions</span></button>)}
      </div>
    </div>
  )
}
