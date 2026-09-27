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
  assuranceFramework: {
    title: string
    detail: string
    sourceStatus: string
    steps: { code: string; title: string; detail: string; evidence: string }[]
  }
  publicRecord: { date: string; title: string; detail: string; status: string; sourceUrl: string }[]
  sources: { label: string; detail: string; url: string; accessedAt: string }[]
}

type CatalogueProject = {
  id: string; title: string; category: string; year: number; department: string; method: string
  budget: number; referencePrice: number | null; contractPrice: number
  announcedWinnerPrice: number | null
  winnerInCsv: string | null; verifiedWinner: string | null
  verifiedMode: 'direct' | 'consortium' | 'other-consortium' | null; verifiedMembers: string[]; documentChecked: boolean
  winnerDocumentUrl: string | null
  sourceUrl: string; datasetUrl: string; projectUrl: string
}
type Catalogue = {
  meta: { selection: string; limits: string; accessedAt: string; sources: { year: number; url: string }[] }
  metrics: { projects: number; contractPrice: number; aitLabelProjects: number; aitLabelContractPrice: number; aitWinnerDocumentProjects: number; aitWinnerDocumentContractPrice: number; aitDirectProjects: number; aitDirectContractPrice: number; aitConsortiumProjects: number; aitConsortiumContractPrice: number; otherConsortiumProjects: number; documentCheckedProjects: number; winnerNoticeProjects: number; winnerPriceComparedProjects: number; winnerPriceDiscrepancyProjects: number; withinOnePercentOfReference: number }
  winners: { name: string; projects: number; contractPrice: number }[]
  projects: CatalogueProject[]
}

type View = 'overview' | 'catalogue' | 'projects' | 'network' | 'review'
type CatalogueFocus = 'all' | 'ait' | 'consortium' | 'all-consortia' | 'close' | 'price-gap' | 'missing-notice'

const views: { id: View; label: string }[] = [
  { id: 'catalogue', label: 'ค้นโครงการทั้งหมด' },
  { id: 'overview', label: 'ภาพรวมและรูปแบบ' },
  { id: 'projects', label: 'แฟ้มหลักฐาน 8 โครงการ' },
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
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [view, setView] = useState<View>('overview')
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'all' | 'direct' | 'consortium'>('all')
  const [year, setYear] = useState('all')
  const [catalogueQuery, setCatalogueQuery] = useState('')
  const [catalogueYear, setCatalogueYear] = useState('all')
  const [catalogueWinner, setCatalogueWinner] = useState('all')
  const [catalogueCategory, setCatalogueCategory] = useState('all')
  const [catalogueFocus, setCatalogueFocus] = useState<CatalogueFocus>('all')
  const [catalogueLimit, setCatalogueLimit] = useState(20)

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

  useEffect(() => {
    fetch('/data/sso-egp-it.json')
      .then((response) => {
        if (!response.ok) throw new Error('เปิดทะเบียนโครงการไม่สำเร็จ')
        return response.json()
      })
      .then((payload: Catalogue) => setCatalogue(payload))
      .catch(() => setCatalogue(null))
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

  const catalogueRows = useMemo(() => {
    if (!catalogue) return []
    const terms = catalogueQuery.trim().toLocaleLowerCase('th').split(/\s+/).filter(Boolean)
    return catalogue.projects.filter((project) => {
      const haystack = [project.id, project.title, project.department, project.winnerInCsv, project.verifiedWinner].join(' ').toLocaleLowerCase('th')
      return terms.every((term) => haystack.includes(term))
        && (catalogueYear === 'all' || String(project.year) === catalogueYear)
        && (catalogueWinner === 'all' || project.winnerInCsv === catalogueWinner)
        && (catalogueCategory === 'all' || project.category === catalogueCategory)
        && (catalogueFocus === 'all'
          || (catalogueFocus === 'ait' && (project.verifiedMode === 'direct' || project.verifiedMode === 'consortium'))
          || (catalogueFocus === 'consortium' && project.verifiedMode === 'consortium')
          || (catalogueFocus === 'all-consortia' && (project.verifiedMode === 'consortium' || project.verifiedMode === 'other-consortium'))
          || (catalogueFocus === 'close' && project.referencePrice !== null && project.referencePrice > 0 && project.contractPrice <= project.referencePrice && (project.referencePrice - project.contractPrice) / project.referencePrice < 0.01)
          || (catalogueFocus === 'price-gap' && project.announcedWinnerPrice !== null && project.announcedWinnerPrice !== project.contractPrice)
          || (catalogueFocus === 'missing-notice' && !project.winnerDocumentUrl))
    })
  }, [catalogue, catalogueQuery, catalogueYear, catalogueWinner, catalogueCategory, catalogueFocus])

  useEffect(() => { setCatalogueLimit(20) }, [catalogueQuery, catalogueYear, catalogueWinner, catalogueCategory, catalogueFocus])

  if (!data) return <section className="itlab itlab-loading" id="sso-it"><strong>กำลังเปิดแฟ้มจัดซื้อ IT ประกันสังคม</strong><span>กำลังเชื่อมโครงการกับหลักฐาน e-GP</span></section>

  const selected = data.projects.find((project) => project.id === selectedId) ?? data.projects[0]
  const maxEstimate = Math.max(...data.projects.map((project) => project.estimatePrice))
  const years = [...new Set(data.projects.map((project) => project.budgetYear))].sort()

  const chooseProject = (id: string) => {
    setSelectedId(id)
    window.setTimeout(() => document.getElementById(`it-project-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 10)
  }

  const focusView = (next: View) => {
    setView(next)
    window.requestAnimationFrame(() => document.querySelector('.itlab-tabs')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }))
  }

  return <section className="itlab" id="sso-it" aria-labelledby="sso-it-title">
    <div className="itlab-hero">
      <div className="itlab-hero-copy">
        <span>SSO IT PROCUREMENT / EVIDENCE NETWORK</span>
        <h2 id="sso-it-title">เจาะงบ IT ประกันสังคม</h2>
        <p>ค้นทะเบียนโครงการ IT จากข้อมูลจัดซื้อภาครัฐ แล้วเจาะแฟ้มหลักฐานผู้รับงาน ราคาที่เสนอ และสมาชิกกิจการร่วมค้า</p>
        <div className="itlab-actions">
          <button onClick={() => focusView('catalogue')}>ค้นทะเบียน {catalogue?.metrics.projects ?? ''} โครงการ</button>
          <button onClick={() => focusView('projects')}>ดูแฟ้มหลักฐาน 8 โครงการ</button>
          <button onClick={onAsk}>ถามน้องเพนกวิน</button>
          <a href="/data/sso-it-procurement.json" download>ดาวน์โหลด JSON</a>
        </div>
      </div>
      <div className="itlab-total">
        <span>มูลค่าสัญญารวมที่ AIT รับตรงหรือร่วมค้า และพบประกาศผู้ชนะ</span>
        <strong>{money(catalogue?.metrics.aitWinnerDocumentContractPrice ?? data.metrics.totalContract)}</strong>
        <b>ล้านบาท</b>
        <small>{catalogue?.metrics.aitWinnerDocumentProjects ?? data.metrics.linkedProjects} โครงการที่ยืนยันจากประกาศผู้ชนะ กิจการร่วมค้าไม่นับเป็นรายได้ AIT ทั้งหมด</small>
      </div>
    </div>

    <div className="itlab-scope"><strong>ขอบเขตข้อมูล</strong><p>ทะเบียนจากข้อมูลจัดซื้อรัฐ {catalogue?.metrics.projects ?? '…'} โครงการ ปี 2560 ถึง 2568 และแฟ้มประมูลที่อ่านเชิงลึก 8 โครงการ</p><span>เข้าถึงข้อมูล {catalogue ? new Date(catalogue.meta.accessedAt).toLocaleDateString('th-TH') : data.meta.accessedAtThai}</span></div>

    <div className="itlab-tabs" role="group" aria-label="มุมวิเคราะห์จัดซื้อ IT">
      {views.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
    </div>

    {view === 'overview' && <div className="itlab-view">
      {catalogue && <button className="itlab-catalogue-callout" onClick={() => focusView('catalogue')}>
        <span><b>เปิดทะเบียนโครงการ</b><strong>{catalogue.metrics.projects} โครงการ IT และบริการข้อมูลดิจิทัล</strong><small>งบตั้งแต่ 10 ล้านบาท คัดจากตารางรัฐปี 2560 ถึง 2568 • มูลค่าสัญญาที่พบ {money(catalogue.metrics.contractPrice)} ล้านบาท</small></span>
        <em>ค้นและกรองรายชื่อ →</em>
      </button>}
      <p className="itlab-overview-scope">ยอดรับงานตรงและกิจการร่วมค้าอ้างจากประกาศผู้ชนะ 11 สัญญา ส่วนกราฟและรูปแบบการแข่งขันอ้างจากแฟ้มที่อ่านละเอียด 8 โครงการ</p>
      <div className="itlab-metrics">
        <article><span>AIT รับงานตรง</span><strong>{money(catalogue?.metrics.aitDirectContractPrice ?? data.metrics.directContract)}</strong><b>ล้านบาท</b><small>{catalogue?.metrics.aitDirectProjects ?? data.metrics.directProjects} สัญญาที่พบประกาศผู้ชนะ</small></article>
        <article><span>สัญญากิจการร่วมค้า</span><strong>{money(catalogue?.metrics.aitConsortiumContractPrice ?? data.metrics.consortiumContract)}</strong><b>ล้านบาท</b><small>{catalogue?.metrics.aitConsortiumProjects ?? data.metrics.consortiumProjects} สัญญา มูลค่านี้ไม่ใช่รายได้ AIT ทั้งหมด</small></article>
        <article><span>ประกวดราคาอิเล็กทรอนิกส์</span><strong>{data.metrics.eBiddingProjects}</strong><b>โครงการ</b><small>จาก 8 แฟ้มละเอียด อีก 1 โครงการใช้วิธีเฉพาะเจาะจง</small></article>
        <article><span>AIT ร่วมไชยกาญจน์</span><strong>{data.metrics.chaiyakarnProjects}</strong><b>โครงการ</b><small>จาก 8 แฟ้มละเอียด ต้องนับสมาชิกแม้ชื่อกิจการร่วมค้าต่างกัน</small></article>
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

    {view === 'catalogue' && <div className="itlab-view">
      {!catalogue ? <p role="status">กำลังเปิดทะเบียนจากข้อมูลภาครัฐ กรุณาลองใหม่อีกครั้งหากยังไม่แสดง</p> : <>
        <div className="itlab-section-intro"><div><span>DGA / E-GP CONTRACT REGISTER</span><h3>ค้นโครงการ IT ในตารางรัฐ</h3></div><p>เลือกปีหรือชื่อผู้รับงาน และดูราคาได้บนหน้านี้ รายการที่มีแฟ้มหลักฐานเปิดอ่านรายละเอียดผู้เสนอราคาได้ทันที</p></div>
        <div className="itlab-catalogue-summary">
          <div><span>โครงการที่คัดได้</span><strong>{catalogue.metrics.projects}</strong><small>รายการ งบตั้งแต่ 10 ล้านบาท</small></div>
          <div><span>มูลค่าสัญญารวม</span><strong>{money(catalogue.metrics.contractPrice)}</strong><small>ล้านบาท เฉพาะรายการที่คัดได้</small></div>
          <div><span>AIT ยืนยันจากประกาศผู้ชนะ</span><strong>{catalogue.metrics.aitWinnerDocumentProjects}</strong><small>รายการ มูลค่าสัญญารวม {money(catalogue.metrics.aitWinnerDocumentContractPrice)} ล้านบาท</small></div>
          <div><span>พบสำเนาประกาศผู้ชนะ e-GP</span><strong>{catalogue.metrics.winnerNoticeProjects}</strong><small>รายการ โดยอ่านแฟ้มประมูลละเอียดแล้ว {catalogue.metrics.documentCheckedProjects} โครงการ</small></div>
        </div>
        <div className="itlab-catalogue-breakdown"><p><strong>จาก 11 ประกาศที่ยืนยัน</strong> AIT รับงานตรง {catalogue.metrics.aitDirectProjects} สัญญา รวม {money(catalogue.metrics.aitDirectContractPrice)} ล้านบาท และเป็นสมาชิกกิจการร่วมค้า {catalogue.metrics.aitConsortiumProjects} สัญญา มูลค่าสัญญารวม {money(catalogue.metrics.aitConsortiumContractPrice)} ล้านบาท ส่วนแบ่งของ AIT ในกิจการร่วมค้ายังไม่ทราบ</p><p>ตาราง CSV ระบุชื่อ AIT {catalogue.metrics.aitLabelProjects} รายการ รวม {money(catalogue.metrics.aitLabelContractPrice)} ล้านบาท มี 1 รายการที่ยังไม่พบประกาศผู้ชนะในคลังสำเนาที่ตรวจ</p><p>เทียบยอดในประกาศกับ CSV ได้ {catalogue.metrics.winnerPriceComparedProjects} โครงการ พบยอดต่างกัน {catalogue.metrics.winnerPriceDiscrepancyProjects} โครงการ ต้องตรวจขอบเขตสัญญาและการบันทึกข้อมูลก่อนอธิบายสาเหตุ</p></div>
        <details className="itlab-catalogue-note"><summary>วิธีคัดรายการและข้อจำกัดของข้อมูล</summary><p>{catalogue.meta.selection}</p><p>{catalogue.meta.limits}</p></details>
        <div className="itlab-focus" role="group" aria-label="เลือกชุดโครงการที่สนใจ">
          {([
            ['all', 'ทั้งหมด', catalogue.metrics.projects],
            ['ait', 'AIT ที่ยืนยันแล้ว', catalogue.metrics.aitWinnerDocumentProjects],
            ['consortium', 'กิจการร่วมค้า AIT', catalogue.metrics.aitConsortiumProjects],
            ['all-consortia', 'กิจการร่วมค้าทุกกลุ่ม', catalogue.metrics.aitConsortiumProjects + catalogue.metrics.otherConsortiumProjects],
            ['close', 'ราคาสัญญาใกล้ราคากลาง', catalogue.metrics.withinOnePercentOfReference],
            ['price-gap', 'ยอดประกาศกับ CSV ต่างกัน', catalogue.metrics.winnerPriceDiscrepancyProjects],
            ['missing-notice', 'รอตรวจประกาศผู้ชนะ', catalogue.projects.filter((project) => !project.winnerDocumentUrl).length],
          ] as const).map(([focus, label, count]) => <button key={focus} type="button" aria-pressed={catalogueFocus === focus} onClick={() => setCatalogueFocus(focus)}>{label} <b>{count.toLocaleString('th-TH')}</b></button>)}
        </div>
        <div className="itlab-filters itlab-catalogue-filters">
          <label><span>ค้นชื่อโครงการ เลข e-GP หรือผู้ชนะ</span><input value={catalogueQuery} onChange={(event) => setCatalogueQuery(event.target.value)} placeholder="เช่น เครือข่าย 2567" /></label>
          <label><span>ชื่อผู้ชนะตาม CSV</span><select value={catalogueWinner} onChange={(event) => setCatalogueWinner(event.target.value)}><option value="all">ทุกราย</option>{catalogue.winners.map((winner) => <option key={winner.name} value={winner.name}>{winner.name} ({winner.projects})</option>)}</select></label>
          <label><span>ปีงบประมาณ</span><select value={catalogueYear} onChange={(event) => setCatalogueYear(event.target.value)}><option value="all">ทุกปี</option>{[...new Set(catalogue.projects.map((item) => item.year))].sort().map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>ประเภทงาน</span><select value={catalogueCategory} onChange={(event) => setCatalogueCategory(event.target.value)}><option value="all">ทุกประเภท</option>{[...new Set(catalogue.projects.map((item) => item.category))].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        {(catalogueQuery || catalogueYear !== 'all' || catalogueWinner !== 'all' || catalogueCategory !== 'all' || catalogueFocus !== 'all') && <button className="itlab-clear" type="button" onClick={() => { setCatalogueQuery(''); setCatalogueYear('all'); setCatalogueWinner('all'); setCatalogueCategory('all'); setCatalogueFocus('all') }}>ล้างตัวกรองทั้งหมด</button>}
        <p className="itlab-result-count" role="status">พบ {catalogueRows.length.toLocaleString('th-TH')} โครงการ • มูลค่าสัญญารวม {money(catalogueRows.reduce((sum, row) => sum + row.contractPrice, 0))} ล้านบาท • แสดง {Math.min(catalogueLimit, catalogueRows.length).toLocaleString('th-TH')} รายการ</p>
        {catalogueRows.length === 0 && <p className="itlab-empty">ไม่พบโครงการตามเงื่อนไขนี้ ลองเปลี่ยนคำค้นหรือกดล้างตัวกรอง</p>}
        <div className="itlab-table-wrap itlab-catalogue-table"><table>
          <caption>ทะเบียนโครงการจากข้อมูลภาครัฐ ราคาหน่วยล้านบาท</caption>
          <thead><tr><th>ปี / e-GP</th><th>โครงการ</th><th>วิธีจัดซื้อ</th><th>ราคากลาง</th><th>ราคาสัญญา</th><th>ต่ำกว่าราคากลาง</th><th>ผู้ชนะ</th><th>หลักฐาน</th></tr></thead>
          <tbody>{catalogueRows.slice(0, catalogueLimit).map((project) => <tr key={project.id}>
            <td data-label="ปี / e-GP"><b>{project.year}</b><small>{project.id}</small></td>
            <td data-label="โครงการ"><strong>{project.title}</strong><small>{project.category} • {project.department}</small></td>
            <td data-label="วิธีจัดซื้อ">{project.method}</td>
            <td data-label="ราคากลาง">{money(project.referencePrice)}</td>
            <td data-label="ราคาสัญญา"><b>{money(project.contractPrice)}</b>{project.announcedWinnerPrice !== null && project.announcedWinnerPrice !== project.contractPrice && <small>ประกาศผู้ชนะ {money(project.announcedWinnerPrice)} ลบ.</small>}</td>
            <td data-label="ต่ำกว่าราคากลาง">{project.announcedWinnerPrice !== null && project.announcedWinnerPrice !== project.contractPrice ? 'รอตรวจฐานยอด' : project.referencePrice && project.referencePrice > 0 ? `${((project.referencePrice - project.contractPrice) * 100 / project.referencePrice).toLocaleString('th-TH', { maximumFractionDigits: 2 })}%` : 'ไม่พบราคากลาง'}</td>
            <td data-label="ผู้ชนะ">{project.verifiedWinner ?? project.winnerInCsv ?? 'ไม่พบชื่อผู้ชนะ'}{(project.verifiedMode === 'consortium' || project.verifiedMode === 'other-consortium') && <><small>กิจการร่วมค้าที่ระบุในประกาศ</small>{project.verifiedMembers.length > 0 && <details className="itlab-members"><summary>สมาชิก {project.verifiedMembers.length} ราย</summary><p>{project.verifiedMembers.join(' / ')}</p></details>}{project.winnerInCsv !== project.verifiedWinner && <small>CSV ระบุ: {project.winnerInCsv}</small>}</>}{!project.verifiedWinner && <small>{project.winnerDocumentUrl ? 'ชื่อจาก CSV โปรดเทียบประกาศ' : 'ชื่อจาก CSV ยังไม่พบประกาศให้เทียบ'}</small>}</td>
            <td data-label="หลักฐาน">{project.documentChecked && <button onClick={() => { setView('projects'); chooseProject(project.id) }}>เปิดแฟ้มละเอียด</button>}{project.winnerDocumentUrl && <small><a href={project.winnerDocumentUrl} target="_blank" rel="noreferrer">ประกาศผู้ชนะ ↗</a></small>}<small><a href={project.projectUrl} target="_blank" rel="noreferrer">หน้ารวมเอกสาร ↗</a></small><small><a href={project.sourceUrl} target="_blank" rel="noreferrer">CSV ต้นทาง ↗</a></small></td>
          </tr>)}</tbody>
        </table></div>
        {catalogueRows.length > catalogueLimit && <button className="itlab-more" type="button" onClick={() => setCatalogueLimit((limit) => limit + 20)}>แสดงเพิ่มอีก {Math.min(20, catalogueRows.length - catalogueLimit)} โครงการ ↓</button>}
        <div className="itlab-catalogue-sources"><strong>ชุดข้อมูลรายปี</strong>{catalogue.meta.sources.map((source) => <a key={source.year} href={source.url} target="_blank" rel="noreferrer">{source.year} ↗</a>)}<small>เข้าถึง {new Date(catalogue.meta.accessedAt).toLocaleDateString('th-TH')}</small></div>
      </>}
    </div>}

    {view === 'projects' && <div className="itlab-view">
      <div className="itlab-quick-select">
        <label htmlFor="itlab-project-select"><span>เลือกหนึ่งใน 8 แฟ้มที่อ่านละเอียด</span>
          <select id="itlab-project-select" value={selected.id} onChange={(event) => chooseProject(event.target.value)}>
            {data.projects.map((project) => <option key={project.id} value={project.id}>{project.budgetYear} / {project.id} / {project.title}</option>)}
          </select>
        </label>
        <div><span>โครงการที่เลือก</span><strong>{selected.title}</strong><small>ราคาสัญญา {money(selected.contractPrice)} ล้านบาท</small></div>
        <button onClick={() => chooseProject(selected.id)}>เปิดหลักฐานโครงการ</button>
      </div>
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
      <div className="itlab-assurance">
        <div className="itlab-section-intro"><div><span>CONTRACT TO OUTCOME</span><h3>{data.assuranceFramework.title}</h3></div><p>{data.assuranceFramework.detail}</p></div>
        <div className="itlab-assurance-steps">
          {data.assuranceFramework.steps.map((step) => <article key={step.code}><span>{step.code}</span><div><h4>{step.title}</h4><p>{step.detail}</p><small>หลักฐานที่ควรขอ</small><b>{step.evidence}</b></div></article>)}
        </div>
        <p className="itlab-assurance-status"><strong>สถานะข้อมูลจากไฟล์ประกอบ</strong>{data.assuranceFramework.sourceStatus}</p>
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
