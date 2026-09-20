import { useEffect, useMemo, useState } from 'react'

type Meeting = {
  id: string
  date: string | null
  dateLabel: string
  weekday: string
  round: number | null
  roundLabel: string
  session: string
  title: string
  description: string
  themes: string[]
  hasSummary: boolean
  summaryUrl: string | null
  summary?: CommitteeSummary | null
}

type SummaryIssue = {
  id?: number | string
  sev?: string
  sevLabel?: string
  title?: string
  desc?: string
  why?: string
  evidence?: string
  public?: string
  q?: string
  ask?: string
  a?: string
  agency?: string
  refer?: string
  ref?: string[]
  details?: { label?: string; text?: string }[]
}

type SummaryObservation = {
  id?: string
  level?: string
  title?: string
  body?: string
  law?: string
  refer?: string
}

type SummaryHomework = {
  task?: string
  detail?: string
  owner?: string
  deadline?: string
  pri?: string
  status?: string
}

type SummaryTurn = {
  name?: string
  roleLabel?: string
  msg?: string
  trk?: boolean
}

type CommitteeSummary = {
  url: string
  title: string
  overview: string
  issues: SummaryIssue[]
  observations: SummaryObservation[]
  homework: SummaryHomework[]
  transcript: { turns: SummaryTurn[]; importantTurns: number }
}

type CommitteeData = {
  meta: {
    sourceUrl: string
    sourceTitle: string
    meetings: number
    days: number
    summaries: number
    uniqueSummaryPages: number
    summaryPagesRead: number
    summaryIssues: number
    summaryObservations: number
    summaryHomework: number
    transcriptTurns: number
    method: string
  }
  themeLabels: Record<string, string>
  meetings: Meeting[]
}

const themeOrder = ['ict', 'procurement', 'construction', 'ai', 'sso', 'health', 'energy', 'training', 'tourism', 'agriculture', 'oversight']

export default function CommitteeTracker() {
  const [data, setData] = useState<CommitteeData | null>(null)
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState('all')
  const [onlySummaries, setOnlySummaries] = useState(false)
  const [limit, setLimit] = useState(12)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Meeting | null>(null)

  useEffect(() => {
    fetch('/data/committee-meetings.json')
      .then((response) => {
        if (!response.ok) throw new Error('ยังเปิดดัชนีการประชุมไม่ได้')
        return response.json() as Promise<CommitteeData>
      })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'เปิดดัชนีการประชุมไม่สำเร็จ'))
  }, [])

  const meetings = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th')
    return (data?.meetings ?? []).filter((meeting) => {
      if (theme !== 'all' && !meeting.themes.includes(theme)) return false
      if (onlySummaries && !meeting.hasSummary) return false
      if (!needle) return true
      const searchable = `${meeting.title} ${meeting.description} ${meeting.dateLabel} ${meeting.roundLabel} ${JSON.stringify(meeting.summary ?? '')}`
      return searchable.toLocaleLowerCase('th').includes(needle)
    })
  }, [data, query, theme, onlySummaries])

  useEffect(() => setLimit(12), [query, theme, onlySummaries])

  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', close)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', close)
    }
  }, [selected])

  return <section className="committee-tracker" id="committee">
    <div className="committee-heading">
      <div><span className="section-no">05 / COMMITTEE FOLLOW THROUGH</span><h2>ตามวาระให้ไปถึง<br />คำตอบหลังประชุม</h2></div>
      <p>เชื่อมรายการงบกับประเด็นที่คณะกรรมาธิการเปิดตรวจแล้ว ค้นวันประชุม วาระ และสรุปหลังประชุมได้จากหน้าเดียว</p>
    </div>

    {data && <>
      <div className="committee-metrics" role="group" aria-label="ภาพรวมการประชุมคณะกรรมาธิการ">
        <div><strong>{data.meta.meetings}</strong><span>นัดประชุม</span></div>
        <div><strong>{data.meta.summaries}</strong><span>นัดที่มีสรุป</span></div>
        <div><strong>{data.meta.days}</strong><span>วันประชุม</span></div>
        <div><strong>{data.meta.uniqueSummaryPages}</strong><span>หน้าสรุปไม่ซ้ำ</span></div>
      </div>

      <div className="committee-path" aria-label="วิธีใช้ข้อมูลหลังประชุม">
        <div><i>01</i><strong>เริ่มจากวาระ</strong><span>รู้ว่าใครถูกเชิญมาชี้แจงเรื่องใด</span></div>
        <div><i>02</i><strong>อ่านสิ่งที่ตอบ</strong><span>เปิดสรุปหลังประชุมของแหล่งต้นทาง</span></div>
        <div><i>03</i><strong>เทียบกับตัวเลข</strong><span>ค้นรายการ PBO และหลักฐานในคลัง</span></div>
        <div><i>04</i><strong>ตามการบ้าน</strong><span>ขอเอกสารและตรวจความคืบหน้ารอบถัดไป</span></div>
      </div>

      <div className="committee-controls">
        <label className="committee-search"><span>ค้นวาระ</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="โครงการ หน่วยงาน งบประมาณ หรือวันที่" /></label>
        <label><span>กลุ่มประเด็น</span><select value={theme} onChange={(event) => setTheme(event.target.value)}><option value="all">ทุกประเด็น</option>{themeOrder.filter((id) => data.themeLabels[id]).map((id) => <option key={id} value={id}>{data.themeLabels[id]}</option>)}</select></label>
        <label className="committee-check"><input type="checkbox" checked={onlySummaries} onChange={(event) => setOnlySummaries(event.target.checked)} /><span>เฉพาะที่มีสรุป</span></label>
      </div>

      <div className="committee-result"><strong>{meetings.length} นัด</strong><span>เรียงจากการประชุมล่าสุด</span><a href={data.meta.sourceUrl} target="_blank" rel="noreferrer">เปิดหน้ารวมของกรรมาธิการ ↗</a></div>
      <div className="committee-grid">
        {meetings.slice(0, limit).map((meeting) => <article key={meeting.id}>
          <header><span>{meeting.roundLabel} / {meeting.session}</span><time dateTime={meeting.date ?? undefined}>{meeting.dateLabel}</time></header>
          <h3>{meeting.title}</h3>
          <p>{meeting.description}</p>
          <div className="committee-tags">{meeting.themes.filter((id) => id !== 'oversight').slice(0, 3).map((id) => <span key={id}>{data.themeLabels[id]}</span>)}</div>
          <footer>{meeting.summary ? <button onClick={() => setSelected(meeting)}>อ่านสาระบนเว็บ</button> : meeting.summaryUrl ? <a href={meeting.summaryUrl} target="_blank" rel="noreferrer">อ่านสรุปหลังประชุม ↗</a> : <span>ยังไม่มีสรุปหลังประชุม</span>}<a href="#archive">ค้นหลักฐานในคลัง ↓</a></footer>
        </article>)}
      </div>
      {meetings.length === 0 && <div className="committee-empty">ไม่พบวาระที่ตรงกับเงื่อนไข</div>}
      {limit < meetings.length && <button className="committee-more" onClick={() => setLimit((value) => value + 12)}>แสดงเพิ่มอีก {Math.min(12, meetings.length - limit)} นัด</button>}
      <p className="committee-source-note">อ่านหน้าสรุปครบ {data.meta.summaryPagesRead} หน้า พบสาระรายประเด็น {data.meta.summaryIssues.toLocaleString('th-TH')} ข้อ ข้อสังเกต {data.meta.summaryObservations.toLocaleString('th-TH')} ข้อ งานติดตามต่อ {data.meta.summaryHomework.toLocaleString('th-TH')} รายการ และบันทึกถ้อยคำ {data.meta.transcriptTurns.toLocaleString('th-TH')} ช่วง ข้อความทั้งหมดระบุแหล่งต้นทางชัดเจน และแยกจากตัวบทกฎหมายฉบับประกาศใช้จริงของงบแกะ</p>
    </>}
    {!data && !error && <div className="committee-empty">กำลังเปิดดัชนีการประชุม...</div>}
    {error && <div className="committee-empty">{error}</div>}
    {selected?.summary && <div className="committee-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
      <article className="committee-modal" role="dialog" aria-modal="true" aria-labelledby="committee-modal-title">
        <header><div><span>ข้อมูลจากหน้าสรุปหลังประชุม</span><h3 id="committee-modal-title">{selected.summary.title || selected.title}</h3><p>{selected.dateLabel} / {selected.roundLabel} {selected.session}</p></div><button onClick={() => setSelected(null)} aria-label="ปิดหน้าสรุป">×</button></header>
        <div className="committee-modal-body">
          <section className="committee-summary-overview"><span>ภาพรวมจากแหล่งต้นทาง</span><p>{selected.summary.overview || selected.description}</p></section>
          <section><div className="committee-modal-section-title"><span>สาระรายประเด็น</span><strong>{selected.summary.issues.length} ข้อ</strong></div><div className="committee-detail-list">{selected.summary.issues.map((issue, index) => <article key={String(issue.id ?? index)}><div><small>{issue.sevLabel || issue.sev || `ประเด็น ${index + 1}`}</small><b>{issue.title}</b></div>{issue.desc && <p>{issue.desc}</p>}{issue.public && <p><strong>สิ่งที่หน้าสรุประบุ:</strong> {issue.public}</p>}{issue.details?.map((detail, detailIndex) => detail.text && <p key={`${detail.label}-${detailIndex}`}><strong>{detail.label || 'รายละเอียด'}:</strong> {detail.text}</p>)}{!issue.details?.length && issue.why && <p><strong>เหตุที่แหล่งต้นทางให้ความสำคัญ:</strong> {issue.why}</p>}{issue.evidence && <p><strong>หลักฐานที่หน้าสรุประบุ:</strong> {issue.evidence}</p>}{!issue.details?.length && (issue.q || issue.ask) && <p><strong>คำถามติดตาม:</strong> {issue.q || issue.ask}</p>}{!issue.details?.length && (issue.a || issue.agency) && <p><strong>คำชี้แจงที่บันทึกไว้:</strong> {issue.a || issue.agency}</p>}{issue.refer && <p><strong>ปลายทางที่แหล่งต้นทางเสนอ:</strong> {issue.refer}</p>}{issue.ref && issue.ref.length > 0 && <p className="committee-law-reference"><strong>หน่วยงานหรือกฎหมายที่หน้าสรุประบุ:</strong> {issue.ref.join(' / ')}</p>}</article>)}</div></section>
          <section><div className="committee-modal-section-title"><span>ข้อสังเกตที่แหล่งต้นทางบันทึก</span><strong>{selected.summary.observations.length} ข้อ</strong></div><div className="committee-detail-list compact">{selected.summary.observations.map((observation, index) => <article key={observation.id ?? index}><div><small>{observation.id || observation.level}</small><b>{observation.title}</b></div><p>{observation.body}</p>{observation.law && <p className="committee-law-reference"><strong>กฎหมายที่หน้าสรุปอ้าง:</strong> {observation.law}</p>}{observation.refer && <p><strong>ปลายทางที่แหล่งต้นทางเสนอ:</strong> {observation.refer}</p>}</article>)}</div></section>
          <section><div className="committee-modal-section-title"><span>งานติดตามต่อที่บันทึกไว้</span><strong>{selected.summary.homework.length} รายการ</strong></div><div className="committee-homework-list">{selected.summary.homework.map((item, index) => <article key={`${item.task}-${index}`}><i>{String(index + 1).padStart(2, '0')}</i><div><b>{item.task}</b>{item.detail && <p>{item.detail}</p>}<small>{[item.owner && `ผู้รับผิดชอบ: ${item.owner}`, item.deadline && `กำหนด: ${item.deadline}`, item.pri && `ระดับ: ${item.pri}`, item.status && `สถานะ: ${item.status}`].filter(Boolean).join(' / ')}</small></div></article>)}</div></section>
          {selected.summary.transcript.importantTurns > 0 && <section><div className="committee-modal-section-title"><span>ถ้อยคำที่ต้นทางทำเครื่องหมายว่าสำคัญ</span><strong>{selected.summary.transcript.importantTurns} ช่วง</strong></div><div className="committee-quotes">{selected.summary.transcript.turns.filter((turn) => turn.trk).map((turn, index) => <blockquote key={`${turn.name}-${index}`}><p>{turn.msg}</p><footer>{turn.name}<span>{turn.roleLabel}</span></footer></blockquote>)}</div></section>}
        </div>
        <footer className="committee-modal-footer"><p>เนื้อหาในหน้าต่างนี้ถอดจากหน้าสรุปของแหล่งต้นทาง การอ้างกฎหมายในสรุปแสดงตามที่แหล่งนั้นระบุ</p><div><a href="#law-workbench" onClick={() => setSelected(null)}>ตรวจตัวบทกฎหมายจริง</a><a href={selected.summary.url} target="_blank" rel="noreferrer">เปิดหน้าสรุปต้นทาง ↗</a></div></footer>
      </article>
    </div>}
  </section>
}
