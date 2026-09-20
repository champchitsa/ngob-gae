import { useEffect, useMemo, useState } from 'react'
import './ssoItProcurement.css'

type Bidder = { name: string; price: number | null; status: string }
type EvidenceLink = { label: string; url: string }
type Project = {
  id: string
  title: string
  budgetYear: number
  announcementDate: string
  contractDate: string | null
  method: string
  procurementType: string
  budget: number | null
  estimatePrice: number
  winningBid: number | null
  contractPrice: number
  winner: string
  mode: 'direct' | 'consortium' | 'comparison'
  members: string[]
  contractId: string | null
  contractControlNumber: string | null
  documentBuyerCount: number | null
  submittedCount: number
  bidders: Bidder[]
  discountAmount: number
  discountPct: number
  concerns: string[]
  documents: EvidenceLink[]
  projectUrl: string
  dataUrl: string
}

type SsoItData = {
  meta: { title: string; accessedAtThai: string; coverage: string; method: string; scopeLimit: string }
  metrics: {
    linkedProjects: number
    totalContract: number
    directProjects: number
    directContract: number
    consortiumProjects: number
    consortiumContract: number
    eBiddingProjects: number
    chaiyakarnProjects: number
  }
  projects: Project[]
  comparison: Project
  patterns: { title: string; value: string; detail: string }[]
  network: {
    relationships: { from: string; to: string; label: string; date: string; sourceUrl: string }[]
    note: string
  }
  timeline: { date: string; title: string; detail: string }[]
  legalChecks: { section: string; title: string; action: string; sourceUrl: string }[]
  conclusions: { facts: string[]; patterns: string[]; next: string[] }
  answers: { question: string; answer: string; status: string }[]
  publicRecord: { date: string; title: string; detail: string; status: string; sourceUrl: string }[]
  sources: { label: string; detail: string; url: string; accessedAt: string }[]
}

type View = 'overview' | 'projects' | 'network' | 'review'

const views: { id: View; label: string }[] = [
  { id: 'overview', label: 'ภาพรวมและรูปแบบ' },
  { id: 'projects', label: 'ตารางทุกโครงการ' },
  { id: 'network', label: 'เครือข่ายและเส้นเวลา' },
  { id: 'review', label: 'ข้อเท็จจริงและตรวจต่อ' },
]

const money = (value: number | null, digits = 3) => value === null
  ? 'ไม่พบในข้อมูลโครงสร้าง'
  : new Intl.NumberFormat('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value / 1_000_000)

const shortMoney = (value: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 3 }).format(value / 1_000_000)

const thaiDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00+07:00`))
  : 'ยังไม่พบในข้อมูลโครงสร้าง'

const importantDocuments = (documents: EvidenceLink[]) => {
  const order = ['ร่างเอกสารประกวดราคา', 'ประกาศราคากลาง', 'ข้อมูลรายชื่อผู้ยื่นเอกสาร', 'ข้อมูลรายชื่อผู้ผ่านการพิจารณาคุณสมบัติและเทคนิค', 'ประกาศรายชื่อผู้ชนะการเสนอราคา', 'ข้อมูลสาระสำคัญในสัญญา']
  return [...documents].sort((a, b) => order.findIndex((item) => a.label.includes(item)) - order.findIndex((item) => b.label.includes(item)))
}

function ProjectEvidence({ project }: { project: Project }) {
  return <article className="itlab-project-focus" id={`it-project-${project.id}`}>
    <div className="itlab-project-title">
      <div><span>e-GP {project.id}</span><h4>{project.title}</h4></div>
      <b data-mode={project.mode}>{project.mode === 'direct' ? 'AIT รับงานตรง' : project.mode === 'consortium' ? 'AIT ในกิจการร่วมค้า' : 'โครงการเปรียบเทียบ'}</b>
    </div>
    <div className="itlab-project-numbers">
      <div><span>ราคากลาง</span><strong>{money(project.estimatePrice)}</strong><small>ล้านบาท</small></div>
      <div><span>ราคาสัญญา</span><strong>{money(project.contractPrice)}</strong><small>ล้านบาท</small></div>
      <div><span>ต่ำกว่าราคากลาง</span><strong>{project.discountPct.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%</strong><small>{shortMoney(project.discountAmount)} ล้านบาท</small></div>
      <div><span>ผู้ซื้อเอกสาร / ยื่นข้อเสนอ</span><strong>{project.documentBuyerCount ?? 'ไม่พบ'} / {project.submittedCount}</strong><small>ราย</small></div>
    </div>
    <div className="itlab-project-grid">
      <div>
        <h5>สัญญาและผู้รับงาน</h5>
        <dl>
          <div><dt>ปีงบประมาณ</dt><dd>{project.budgetYear}</dd></div>
          <div><dt>วิธีจัดซื้อจัดจ้าง</dt><dd>{project.method}</dd></div>
          <div><dt>ผู้ชนะ</dt><dd>{project.winner}</dd></div>
          <div><dt>สมาชิก</dt><dd>{project.members.join(' + ')}</dd></div>
          <div><dt>เลขที่สัญญา</dt><dd>{project.contractId ?? 'ยังไม่พบ'} / {project.contractControlNumber ?? 'ยังไม่พบ'}</dd></div>
          <div><dt>วันที่ลงนาม</dt><dd>{thaiDate(project.contractDate)}</dd></div>
        </dl>
      </div>
      <div>
        <h5>ผู้เสนอราคา</h5>
        <ol className="itlab-bidders">
          {project.bidders.map((bidder) => <li key={`${project.id}-${bidder.name}`}>
            <div><strong>{bidder.name}</strong><span>{bidder.status}</span></div>
            <b>{bidder.price === null ? 'ไม่พบราคา' : `${money(bidder.price)} ลบ.`}</b>
          </li>)}
        </ol>
      </div>
    </div>
    <div className="itlab-observations">
      <strong>ประเด็นที่ควรตรวจสอบเพิ่มเติม</strong>
      <ul>{project.concerns.map((concern) => <li key={concern}>{concern}</li>)}</ul>
    </div>
    <div className="itlab-docs" aria-label={`หลักฐานโครงการ ${project.id}`}>
      {importantDocuments(project.documents).map((document) => <a href={document.url} target="_blank" rel="noreferrer" key={`${project.id}-${document.label}`}><span>{document.label}</span><b>เปิด ↗</b></a>)}
      <a className="primary" href={project.projectUrl} target="_blank" rel="noreferrer"><span>หน้ารวมหลักฐาน ACT Ai</span><b>เปิด ↗</b></a>
    </div>
  </article>
}

function SsoItProcurementLab({ onAsk }: { onAsk: () => void }) {
  const [data, setData] = useState<SsoItData | null>(null)
  const [view, setView] = useState<View>('overview')
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'all' | 'direct' | 'consortium'>('all')
  const [year, setYear] = useState('all')

  useEffect(() => {
    fetch('/data/sso-it-procurement.json')
      .then((response) => {
        if (!response.ok) throw new Error('เปิดชุดข้อมูลไม่สำเร็จ')
        return response.json()
      })
      .then((payload: SsoItData) => {
        setData(payload)
        setSelectedId(payload.projects[0]?.id ?? '')
      })
      .catch(() => setData(null))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const needle = query.trim().toLocaleLowerCase('th')
    return data.projects.filter((project) => {
      const matchesText = !needle || [project.id, project.title, project.winner, ...project.members].join(' ').toLocaleLowerCase('th').includes(needle)
      const matchesMode = mode === 'all' || project.mode === mode
      const matchesYear = year === 'all' || String(project.budgetYear) === year
      return matchesText && matchesMode && matchesYear
    })
  }, [data, mode, query, year])

  if (!data) return <section className="itlab itlab-loading" id="sso-it"><strong>กำลังเปิดแฟ้มจัดซื้อ IT ประกันสังคม</strong><span>กำลังเชื่อมโครงการกับหลักฐาน e-GP</span></section>

  const selected = data.projects.find((project) => project.id === selectedId) ?? data.projects[0]
  const maxEstimate = Math.max(...data.projects.map((project) => project.estimatePrice))
  const years = [...new Set(data.projects.map((project) => project.budgetYear))].sort()

  const chooseProject = (id: string) => {
    setSelectedId(id)
    window.setTimeout(() => document.getElementById(`it-project-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 10)
  }

  return <section className="itlab" id="sso-it" aria-labelledby="sso-it-title">
    <div className="itlab-hero">
      <div className="itlab-hero-copy">
        <span>SSO IT PROCUREMENT / EVIDENCE NETWORK</span>
        <h2 id="sso-it-title">เจาะงบ IT ประกันสังคม</h2>
        <p>นับผู้รับงานถึงระดับสมาชิกกิจการร่วมค้า เปิดราคาของผู้เสนอทุกราย และเชื่อมทุกข้อสังเกตกลับไปยังเอกสารโครงการ</p>
        <div className="itlab-actions">
          <button onClick={() => setView('projects')}>เปิดตาราง 8 โครงการ</button>
          <button onClick={onAsk}>ถามน้องเพนกวิน</button>
          <a href="/data/sso-it-procurement.json" download>ดาวน์โหลด JSON</a>
        </div>
      </div>
      <div className="itlab-total">
        <span>มูลค่าสัญญาที่ AIT เกี่ยวข้องในชุดยืนยัน</span>
        <strong>1,854.672</strong>
        <b>ล้านบาท</b>
        <small>8 โครงการ ปีงบประมาณ 2564 ถึง 2567</small>
      </div>
    </div>

    <div className="itlab-scope"><strong>ขอบเขตที่นับ</strong><p>{data.meta.coverage}</p><span>ตรวจข้อมูลเมื่อ {data.meta.accessedAtThai}</span></div>

    <div className="itlab-quick-select">
      <label htmlFor="itlab-project-select"><span>เลือกโครงการเพื่อเปิดรายละเอียดทันที</span>
        <select id="itlab-project-select" value={selected.id} onChange={(event) => chooseProject(event.target.value)}>
          {data.projects.map((project) => <option key={project.id} value={project.id}>{project.budgetYear} / {project.id} / {project.title}</option>)}
        </select>
      </label>
      <div><span>โครงการที่เลือก</span><strong>{selected.title}</strong><small>ราคาสัญญา {money(selected.contractPrice)} ล้านบาท</small></div>
      <button onClick={() => chooseProject(selected.id)}>เปิดหลักฐานโครงการ</button>
    </div>

    <div className="itlab-tabs" role="group" aria-label="มุมวิเคราะห์จัดซื้อ IT">
      {views.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
    </div>

    {view === 'overview' && <div className="itlab-view">
      <div className="itlab-metrics">
        <article><span>AIT รับงานตรง</span><strong>{money(data.metrics.directContract)}</strong><b>ล้านบาท</b><small>{data.metrics.directProjects} โครงการ</small></article>
        <article><span>สัญญากิจการร่วมค้า</span><strong>{money(data.metrics.consortiumContract)}</strong><b>ล้านบาท</b><small>{data.metrics.consortiumProjects} โครงการ มูลค่านี้ไม่ใช่รายได้ AIT ทั้งหมด</small></article>
        <article><span>ประกวดราคาอิเล็กทรอนิกส์</span><strong>{data.metrics.eBiddingProjects}</strong><b>โครงการ</b><small>อีก 1 โครงการใช้วิธีเฉพาะเจาะจง</small></article>
        <article><span>AIT ร่วมไชยกาญจน์</span><strong>{data.metrics.chaiyakarnProjects}</strong><b>โครงการ</b><small>ต้องนับสมาชิก แม้ชื่อกิจการร่วมค้าต่างกัน</small></article>
      </div>
      <div className="itlab-chart-panel">
        <div className="itlab-panel-head"><div><span>CONTRACT VALUE / BID FUNNEL</span><h3>มูลค่าและจำนวนผู้ยื่นข้อเสนอ</h3></div><p>ความกว้างคือราคากลาง ตัวเลขด้านขวาคือผู้ซื้อเอกสารต่อผู้ยื่นข้อเสนอ</p></div>
        <div className="itlab-bars">
          {data.projects.map((project) => <button key={project.id} onClick={() => { setView('projects'); chooseProject(project.id) }}>
            <span>{project.budgetYear}<b>{project.id}</b></span>
            <i style={{ width: `${Math.max(18, project.estimatePrice * 100 / maxEstimate)}%` }} data-mode={project.mode}><em>{project.title}</em></i>
            <strong>{shortMoney(project.contractPrice)} ลบ.</strong>
            <small>{project.documentBuyerCount ?? 'ไม่พบ'} → {project.submittedCount} ราย</small>
          </button>)}
        </div>
      </div>
      <div className="itlab-patterns">
        {data.patterns.map((pattern, index) => <article key={pattern.title}><span>{String(index + 1).padStart(2, '0')}</span><strong>{pattern.value}</strong><h4>{pattern.title}</h4><p>{pattern.detail}</p></article>)}
      </div>
      <div className="itlab-comparison">
        <div><span>กรณีเปรียบเทียบ / SSO CORE</span><h3>{data.comparison.title}</h3><p>ราคากลาง {money(data.comparison.estimatePrice)} ล้านบาท สัญญา {money(data.comparison.contractPrice)} ล้านบาท ผู้ขอรับเอกสาร {data.comparison.documentBuyerCount} ราย และยื่นข้อเสนอ {data.comparison.submittedCount} ราย</p></div>
        <a href={data.comparison.projectUrl} target="_blank" rel="noreferrer">เปิดหลักฐานโครงการ {data.comparison.id} ↗</a>
      </div>
    </div>}

    {view === 'projects' && <div className="itlab-view">
      <div className="itlab-filters">
        <label><span>ค้นชื่อ เลขโครงการ หรือบริษัท</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="เช่น เครือข่าย AIT ไชยกาญจน์" /></label>
        <label><span>รูปแบบผู้รับงาน</span><select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="all">ทั้งหมด</option><option value="direct">AIT รับงานตรง</option><option value="consortium">กิจการร่วมค้า</option></select></label>
        <label><span>ปีงบประมาณ</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">ทุกปี</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="itlab-table-wrap"><table>
        <caption>โครงการที่พบ {filtered.length.toLocaleString('th-TH')} รายการ หน่วย ล้านบาท</caption>
        <thead><tr><th>ปี / เลขโครงการ</th><th>โครงการ</th><th>ราคากลาง</th><th>ราคาสัญญา</th><th>ส่วนต่าง</th><th>ผู้ซื้อ / ยื่น</th><th>ผู้ชนะ</th><th>หลักฐาน</th></tr></thead>
        <tbody>{filtered.map((project) => <tr key={project.id}>
          <td><b>{project.budgetYear}</b><small>{project.id}</small></td>
          <td><button onClick={() => chooseProject(project.id)}>{project.title}</button><small>{project.mode === 'direct' ? 'AIT รับงานตรง' : 'AIT ในกิจการร่วมค้า'}</small></td>
          <td>{money(project.estimatePrice)}</td><td>{money(project.contractPrice)}</td><td>{project.discountPct.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%</td>
          <td>{project.documentBuyerCount ?? 'ไม่พบ'} / {project.submittedCount}</td><td>{project.winner}</td><td><a href={project.projectUrl} target="_blank" rel="noreferrer">เปิด ↗</a></td>
        </tr>)}</tbody>
      </table></div>
      <ProjectEvidence project={selected} />
    </div>}

    {view === 'network' && <div className="itlab-view">
      <div className="itlab-section-intro"><div><span>EVIDENCE EDGES</span><h3>เครือข่ายที่ทุกเส้นมีหลักฐาน</h3></div><p>{data.network.note}</p></div>
      <div className="itlab-network">
        {data.network.relationships.map((edge) => <a href={edge.sourceUrl} target="_blank" rel="noreferrer" key={`${edge.from}-${edge.to}-${edge.date}`}>
          <strong>{edge.from}</strong><span><i>→</i><b>{edge.label}</b><small>{edge.date}</small></span><strong>{edge.to}</strong>
        </a>)}
      </div>
      <div className="itlab-timeline">
        {data.timeline.map((item, index) => <article key={`${item.date}-${item.title}`}><span>{String(index + 1).padStart(2, '0')}</span><time>{item.date}</time><div><h4>{item.title}</h4><p>{item.detail}</p></div></article>)}
      </div>
    </div>}

    {view === 'review' && <div className="itlab-view">
      <div className="itlab-core-answers">
        <div className="itlab-section-intro"><div><span>FIVE CORE QUESTIONS</span><h3>คำตอบหลักโดยไม่ตัดสินแทนผู้อ่าน</h3></div><p>แต่ละคำตอบบอกขอบเขตข้อมูลและสถานะของหลักฐาน</p></div>
        {data.answers.map((item, index) => <article key={item.question}><span>{String(index + 1).padStart(2, '0')}</span><div><h4>{item.question}</h4><p>{item.answer}</p><b>{item.status}</b></div></article>)}
      </div>
      <div className="itlab-three-levels">
        <article><span>A</span><h3>ข้อเท็จจริงที่ยืนยันได้</h3><ol>{data.conclusions.facts.map((item) => <li key={item}>{item}</li>)}</ol></article>
        <article><span>B</span><h3>รูปแบบที่พบ</h3><ol>{data.conclusions.patterns.map((item) => <li key={item}>{item}</li>)}</ol></article>
        <article><span>C</span><h3>ประเด็นที่ควรตรวจสอบต่อ</h3><ol>{data.conclusions.next.map((item) => <li key={item}>{item}</li>)}</ol></article>
      </div>
      <div className="itlab-legal">
        <div className="itlab-section-intro"><div><span>LAW TO ACTION</span><h3>ตัวบทที่แปลงเป็นงานตรวจ</h3></div><p>ลิงก์ไปยังฐานกฎหมายของกรมบัญชีกลาง ใช้มาตราและข้อเป็นดัชนีเปิดตัวบทฉบับจริง</p></div>
        {data.legalChecks.map((law) => <a href={law.sourceUrl} target="_blank" rel="noreferrer" key={law.section}><span>{law.section}</span><div><strong>{law.title}</strong><p>{law.action}</p></div><b>เปิดตัวบท ↗</b></a>)}
      </div>
      <div className="itlab-public-record">
        <div><span>PUBLIC RECORD STATUS</span><h3>ข้อร้องเรียนและสถานะ</h3></div>
        {data.publicRecord.map((item) => <a href={item.sourceUrl} target="_blank" rel="noreferrer" key={item.title}><time>{item.date}</time><div><strong>{item.title}</strong><p>{item.detail}</p><b>สถานะ: {item.status}</b></div><span>เปิดแหล่งข่าว ↗</span></a>)}
      </div>
      <div className="itlab-method"><strong>วิธีอ่านผล</strong><p>{data.meta.method} {data.meta.scopeLimit}</p></div>
    </div>}

    <div className="itlab-sources">
      <div><span>SOURCE LEDGER</span><h3>แหล่งที่มาและวันเข้าถึง</h3></div>
      {data.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={`${source.label}-${source.url}`}><strong>{source.label}</strong><span>{source.detail}</span><small>เข้าถึง {source.accessedAt}</small></a>)}
    </div>
  </section>
}

export default SsoItProcurementLab
