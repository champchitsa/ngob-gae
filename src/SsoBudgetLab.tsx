import { useEffect, useMemo, useState } from 'react'
import './ssoBudget.css'

type PboItem = {
  row: number
  item: string
  project: string
  act: number
  adjusted: number
  delta: number
  committed: number
  rate: number | null
  flags: string[]
}

type HistoryRow = {
  year: string
  title: string
  sourceUrl: string
  allocated: number
  committed: number
  remaining: number
}

type EvidenceRow = {
  year: string
  page: number
  label: string
  allocated: number
  committed: number
  remaining: number
  reconciliationGap: number
  sourceUrl: string
}

type RecurringGroup = {
  id: string
  label: string
  years: string[]
  yearCount: number
  allocated: number
  committed: number
  rows: EvidenceRow[]
}

type Finding = {
  id: string
  kind: 'fact' | 'reconcile' | 'trace' | 'repeat' | 'scope' | 'agency-response'
  title: string
  fact: string
  observation: string
  documents: string[]
  sourceUrl?: string
}

type NewsItem = {
  id: string
  date: string
  title: string
  fact: string
  source: string
  url: string
  status: string
}

type SsoData = {
  meta: { dataCut: string; unit: string; pboSource: string; method: string; artifactSource: string }
  ledgers: { id: string; label: string; period: string; description: string }[]
  pbo: {
    rows: number
    agencyRows: number
    crossAgencyRows: number
    agencyAct: number
    agencyAdjusted: number
    agencyCommitted: number
    agencyRate: number
    agencyItems: PboItem[]
  }
  administration: {
    history: HistoryRow[]
    recurring: RecurringGroup[]
    reconciliation: EvidenceRow[]
    reconciliationMethod: string
  }
  assets: {
    sourceUrl: string
    pages: number
    parsedRows: number
    unmatchedRows: number
    uniqueKeys: number
    duplicateKeys: number
    acquisitionCost: number
    bookValue: number
    oneBahtRows: number
    oneBahtAcquisitionCost: number
    method: string
    caution: string
  }
  findings: Finding[]
  newsContext: NewsItem[]
  questions: string[]
  documents: string[]
}

type ViewId = 'overview' | 'findings' | 'patterns' | 'assets' | 'news'

const views: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'ภาพรวมเงิน 3 ชั้น' },
  { id: 'findings', label: 'ข้อสังเกต' },
  { id: 'patterns', label: 'รายการเกิดซ้ำ' },
  { id: 'assets', label: 'ทะเบียนสินทรัพย์' },
  { id: 'news', label: 'ข่าวและสถานะ' },
]

const kindLabel: Record<Finding['kind'], string> = {
  fact: 'ตัวเลขจากงบ',
  reconcile: 'ต้องกระทบยอด',
  trace: 'ตามเส้นทางเงิน',
  repeat: 'เกิดซ้ำหลายปี',
  scope: 'ควรเทียบขอบเขต',
  'agency-response': 'คำชี้แจงหน่วยงาน',
}

const money = (value: number, digits = 1) => new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
}).format(value)

const pct = (part: number, total: number) => total ? Math.round(part * 1000 / total) / 10 : 0

function SsoBudgetLab({ onAsk }: { onAsk: () => void }) {
  const [data, setData] = useState<SsoData | null>(null)
  const [view, setView] = useState<ViewId>('overview')
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/data/sso-budget-analysis.json')
      .then((response) => {
        if (!response.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ')
        return response.json()
      })
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const filteredReconciliation = useMemo(() => {
    if (!data) return []
    const needle = query.trim().toLocaleLowerCase('th')
    return data.administration.reconciliation.filter((row) => !needle || `${row.year} ${row.label}`.toLocaleLowerCase('th').includes(needle))
  }, [data, query])

  const copyQuestions = async () => {
    if (!data) return
    const text = `คำถามตรวจงบสำนักงานประกันสังคม\n\n${data.questions.map((question, index) => `${index + 1}. ${question}`).join('\n')}\n\nเอกสารที่ควรขอ\n${data.documents.map((document, index) => `${index + 1}. ${document}`).join('\n')}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (!data) {
    return <section className="sso-lab sso-loading" id="sso-lab" aria-live="polite"><strong>กำลังเปิดแฟ้มงบประกันสังคม</strong><span>กำลังอ่านข้อมูลจากรายงานใน Drive</span></section>
  }

  const fiveYearAllocated = data.administration.history.reduce((sum, row) => sum + row.allocated, 0)
  const fiveYearCommitted = data.administration.history.reduce((sum, row) => sum + row.committed, 0)
  const latest = data.administration.history.at(-1)!
  const oneBahtShare = pct(data.assets.oneBahtRows, data.assets.parsedRows)

  return (
    <section className="sso-lab" id="sso-lab" aria-labelledby="sso-title">
      <div className="sso-hero">
        <div>
          <span className="sso-kicker">SOCIAL SECURITY MONEY TRAIL / OPEN SSO</span>
          <h2 id="sso-title">ประกันสังคม: เงิน 3 ชั้นที่ต้องมองพร้อมกัน</h2>
          <p>แยกงบแผ่นดิน เงินกองทุนบริหารงาน และเงินลงทุนก่อน แล้วค่อยตรวจว่ายอดใดเชื่อมกัน รายการใดเกิดซ้ำ และเอกสารใดยังขาด</p>
          <div className="sso-hero-actions">
            <button onClick={() => setView('findings')}>เปิดข้อสังเกต <span>↓</span></button>
            <button onClick={onAsk}>ถามน้องเพนกวิน</button>
            <a href="/data/sso-budget-analysis.json" download>ดาวน์โหลดข้อมูลวิเคราะห์</a>
          </div>
        </div>
        <div className="sso-lead-number" aria-label="งบแผ่นดินสำนักงานประกันสังคมโดยตรง ปี 2568">
          <span>งบแผ่นดิน สปส. โดยตรง ปี 2568</span>
          <strong>{money(data.pbo.agencyAdjusted / 1000, 3)}</strong>
          <b>พันล้านบาท</b>
          <small>{data.pbo.agencyRows} แถวใน PBO แยกจากงบกลางและกองทุนบริหารงาน</small>
        </div>
      </div>

      <div className="sso-ledgers" aria-label="เงินประกันสังคม 3 ชั้น">
        {data.ledgers.map((ledger, index) => <article key={ledger.id}>
          <span>0{index + 1}</span><div><strong>{ledger.label}</strong><b>{ledger.period}</b><p>{ledger.description}</p></div>
        </article>)}
      </div>

      <div className="sso-tabs" role="group" aria-label="มุมวิเคราะห์ประกันสังคม">
        {views.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
      </div>

      {view === 'overview' && <div className="sso-view">
        <div className="sso-metrics">
          <article className="accent"><span>งบ สปส. โดยตรง ปี 2568</span><strong>{money(data.pbo.agencyAdjusted, 1)}</strong><b>ล้านบาท</b><small>ยอดก่อนและหลังโอนรวมเท่ากัน</small></article>
          <article><span>งบกลางเกิดหลัง พ.ร.บ.</span><strong>10,000</strong><b>ล้านบาท</b><small>สินเชื่อส่งเสริมการจ้างงาน ระยะที่ 3</small></article>
          <article><span>กองทุนบริหารงาน ปี 2567</span><strong>{money(latest.allocated, 1)}</strong><b>ล้านบาท</b><small>คงเหลือ {money(latest.remaining, 1)} ล้านบาท ณ วันตัดยอด</small></article>
          <article><span>ทะเบียนสินทรัพย์ที่อ่านได้</span><strong>{data.assets.parsedRows.toLocaleString('th-TH')}</strong><b>รายการ</b><small>จากเอกสาร {data.assets.pages.toLocaleString('th-TH')} หน้า</small></article>
        </div>

        <div className="sso-transfer-pair">
          <div><span>เงินสมทบรายการหลัก</span><strong>+634.2214</strong><small>ล้านบาท</small></div>
          <div className="sso-transfer-arrow" aria-hidden="true">→</div>
          <div><span>เงินสมทบมาตรา 40</span><strong>−634.2214</strong><small>ล้านบาท</small></div>
          <p><b>ยอดรวมไม่ลด</b> แต่เงินย้ายระหว่าง 2 รายการพอดี จุดตรวจคือคำสั่งโอน สมมติฐานผู้ประกันตน และผลต่อเป้าหมายมาตรา 40</p>
        </div>

        <div className="sso-history-panel">
          <div className="sso-panel-head"><div><span>ADMINISTRATION FUND / 5 YEARS</span><h3>กองทุนบริหารงาน 2563 ถึง 2567</h3></div><p>จัดสรรรวม {money(fiveYearAllocated, 1)} ล้านบาท ใช้จ่ายรวมก่อหนี้ {money(fiveYearCommitted, 1)} ล้านบาท หรือ {pct(fiveYearCommitted, fiveYearAllocated)}%</p></div>
          <div className="sso-year-bars">
            {data.administration.history.map((row) => <a href={row.sourceUrl} target="_blank" rel="noreferrer" key={row.year} aria-label={`เปิดรายงานปี ${row.year}`}>
              <span>{row.year}</span><i style={{ height: `${Math.max(15, pct(row.committed, Math.max(...data.administration.history.map((item) => item.allocated))))}%` }} /><strong>{money(row.allocated, 0)}</strong><small>ใช้ {pct(row.committed, row.allocated)}%</small>
            </a>)}
          </div>
        </div>
        <div className="sso-reading-rule"><strong>กติกาการอ่าน</strong><p>ยอดต่างปีมีวันตัดข้อมูลไม่ตรงกัน จึงใช้ดูแนวโน้มและตั้งคำถาม ไม่ใช้บวกเป็นยอดเดียวกับงบแผ่นดินหรือเงินลงทุน</p></div>
      </div>}

      {view === 'findings' && <div className="sso-view">
        <div className="sso-section-intro"><div><span>FACT / OBSERVATION / DOCUMENTS</span><h3>7 จุดที่ควรเปิดเอกสารต่อ</h3></div><p>ข้อสังเกตทุกใบแยกตัวเลขที่พบ เหตุผลที่ควรตรวจ และเอกสารที่ใช้ตอบคำถาม</p></div>
        <div className="sso-findings">
          {data.findings.map((finding, index) => <article key={finding.id}>
            <div className="sso-finding-top"><span>{String(index + 1).padStart(2, '0')}</span><b data-kind={finding.kind}>{kindLabel[finding.kind]}</b></div>
            <h4>{finding.title}</h4>
            <div className="sso-fact"><span>ข้อเท็จจริง</span><p>{finding.fact}</p></div>
            <div className="sso-observation"><span>ข้อสังเกต</span><p>{finding.observation}</p></div>
            <details><summary>เอกสารที่ใช้ตอบคำถาม</summary><ul>{finding.documents.map((document) => <li key={document}>{document}</li>)}</ul></details>
            {finding.sourceUrl && <a className="sso-source-link" href={finding.sourceUrl} target="_blank" rel="noreferrer">เปิดเอกสารต้นทาง ↗</a>}
          </article>)}
        </div>
        <div className="sso-question-box">
          <div><span>ACTION LIST</span><h3>คำถามพร้อมใช้ในห้องประชุม</h3></div>
          <ol>{data.questions.map((question) => <li key={question}>{question}</li>)}</ol>
          <button onClick={copyQuestions} aria-live="polite">{copied ? 'คัดลอกแล้ว' : 'คัดลอกคำถามและรายการเอกสาร'}</button>
        </div>
      </div>}

      {view === 'patterns' && <div className="sso-view">
        <div className="sso-section-intro"><div><span>RECURRING / SCOPE MATCHING</span><h3>เกิดซ้ำได้ แต่ต้องรู้ว่าได้ผลอะไร</h3></div><p>ชื่อคล้ายกันและเกิดทุกปีเป็นเพียงจุดเริ่มต้น ต้องเทียบ TOR ผู้รับจ้าง ราคา หน่วยนับ และผลลัพธ์ก่อนใช้คำว่า “ซ้ำซ้อน”</p></div>
        <div className="sso-pattern-grid">
          {data.administration.recurring.map((group) => <details key={group.id}>
            <summary><span><b>{group.yearCount} ปี</b><strong>{group.label}</strong></span><span><b>{money(group.allocated, 1)}</b><small>ล้านบาทที่จัดสรร</small></span></summary>
            <div className="sso-detail-table"><table><caption>รายการ {group.label} จากรายงานกองทุนบริหารงาน</caption><thead><tr><th scope="col">ปี</th><th scope="col">รายการ</th><th scope="col">จัดสรร</th><th scope="col">ใช้จ่ายรวมก่อหนี้</th><th scope="col">ต้นทาง</th></tr></thead><tbody>{group.rows.map((row, index) => <tr key={`${row.year}-${row.page}-${index}`}><td>{row.year}</td><td>{row.label}</td><td>{money(row.allocated, 3)}</td><td>{money(row.committed, 3)}</td><td><a href={row.sourceUrl} target="_blank" rel="noreferrer">หน้า {row.page} ↗</a></td></tr>)}</tbody></table></div>
          </details>)}
        </div>

        <div className="sso-reconcile">
          <div className="sso-panel-head"><div><span>RECONCILIATION QUEUE</span><h3>40 แถวที่สมการสามคอลัมน์ไม่ลงตัว</h3></div><p>{data.administration.reconciliationMethod}</p></div>
          <label className="sso-search"><span>ค้นรายการ</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="เช่น เดินทาง คอมพิวเตอร์ ค่าธรรมเนียม" /></label>
          <div className="sso-detail-table"><table><caption>แถวที่ควรขอทะเบียนปรับวงเงิน</caption><thead><tr><th scope="col">ปี / หน้า</th><th scope="col">รายการ</th><th scope="col">จัดสรร</th><th scope="col">ใช้จ่าย</th><th scope="col">คงเหลือ</th><th scope="col">ผลต่าง</th></tr></thead><tbody>{filteredReconciliation.map((row, index) => <tr key={`${row.year}-${row.page}-${index}`}><td><a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.year} / {row.page}</a></td><td>{row.label}</td><td>{money(row.allocated, 3)}</td><td>{money(row.committed, 3)}</td><td>{money(row.remaining, 3)}</td><td className={Math.abs(row.reconciliationGap) >= 5 ? 'hot' : ''}>{money(row.reconciliationGap, 3)}</td></tr>)}</tbody></table></div>
        </div>
      </div>}

      {view === 'assets' && <div className="sso-view">
        <div className="sso-section-intro"><div><span>1,909 PAGES / ASSET REGISTER</span><h3>จาก PDF สู่ยอดที่ตรวจย้อนกลับได้</h3></div><p>อ่านทะเบียนรายบรรทัด แล้วตรวจรหัสสินทรัพย์กับเลขย่อยก่อนสรุปภาพรวม</p></div>
        <div className="sso-asset-grid">
          <article><span>อ่านได้</span><strong>{data.assets.parsedRows.toLocaleString('th-TH')}</strong><b>รายการ</b><small>เหลือบรรทัดที่อ่านไม่ครบ {data.assets.unmatchedRows} บรรทัด</small></article>
          <article><span>รหัสซ้ำแบบตรงตัว</span><strong>{data.assets.duplicateKeys.toLocaleString('th-TH')}</strong><b>รายการ</b><small>จับคู่รหัสสินทรัพย์กับเลขย่อย</small></article>
          <article><span>ราคาทุนที่คำนวณได้</span><strong>{money(data.assets.acquisitionCost, 1)}</strong><b>ล้านบาท</b><small>คำนวณจากมูลค่าตามบัญชีและค่าเสื่อมสะสม</small></article>
          <article><span>มูลค่าตามบัญชี</span><strong>{money(data.assets.bookValue, 1)}</strong><b>ล้านบาท</b><small>ณ วันที่รายงาน 30 กันยายน 2567</small></article>
        </div>
        <div className="sso-one-baht">
          <div className="sso-donut" style={{ '--share': `${oneBahtShare * 3.6}deg` } as React.CSSProperties}><strong>{oneBahtShare}%</strong><span>ของจำนวนรายการ</span></div>
          <div><span>สินทรัพย์มูลค่าตามบัญชี 1 บาท</span><h3>{data.assets.oneBahtRows.toLocaleString('th-TH')} รายการ</h3><p>ราคาทุนเดิมรวม {money(data.assets.oneBahtAcquisitionCost, 1)} ล้านบาท รายการเหล่านี้ตัดค่าเสื่อมเกือบหมดและยังอยู่ในทะเบียน จุดตรวจคือยังใช้งานอยู่ อยู่ที่ใคร อยู่ที่ไหน หรือควรจำหน่าย</p><a href={data.assets.sourceUrl} target="_blank" rel="noreferrer">เปิดทะเบียนสินทรัพย์ต้นทาง ↗</a></div>
        </div>
        <div className="sso-reconcile-flow" aria-label="เส้นทางกระทบยอดสินทรัพย์"><span>บัญชี GFMIS</span><i>→</i><span>ทะเบียนคุม</span><i>→</i><span>ผลตรวจนับ</span><i>→</i><span>สถานที่และผู้ครอบครอง</span><i>→</i><span>ตัดจำหน่าย</span></div>
        <div className="sso-reading-rule warning"><strong>ยังหักยอดข้ามปีตรง ๆ ไม่ได้</strong><p>{data.assets.caution} ทะเบียนปี 2567 และตัวเลขจากคำชี้แจงปี 2569 มีฐานเวลาไม่ตรงกัน ต้องขอไฟล์กระทบยอดระดับรายการ</p></div>
      </div>}

      {view === 'news' && <div className="sso-view">
        <div className="sso-section-intro"><div><span>PUBLIC RECORD / STATUS</span><h3>ข่าวใช้ชี้เอกสารที่ต้องตาม</h3></div><p>ข่าวและคำชี้แจงช่วยชี้ประเด็น แต่ข้อสรุปต้องกลับไปที่ TOR สัญญา มติ รายงานตรวจรับ และผลตรวจสอบทางการ</p></div>
        <div className="sso-news-grid">
          {data.newsContext.map((item) => <article key={item.id}>
            <div><time>{item.date}</time><span>{item.source}</span></div>
            <h4>{item.title}</h4><p>{item.fact}</p>
            <strong>สถานะ: {item.status}</strong>
            <a href={item.url} target="_blank" rel="noreferrer">อ่านแหล่งข่าว ↗</a>
          </article>)}
        </div>
        <div className="sso-source-stack">
          <h3>แหล่งที่ใช้ประกอบการวิเคราะห์</h3>
          <a href={data.meta.pboSource} target="_blank" rel="noreferrer"><span>01</span><b>PBO ปี 2568</b><small>งบตาม พ.ร.บ. หลังโอน และผลใช้จ่าย</small></a>
          <a href={latest.sourceUrl} target="_blank" rel="noreferrer"><span>02</span><b>OPEN SSO ปี 2563 ถึง 2567</b><small>ผลเบิกจ่ายกองทุนบริหารงาน</small></a>
          <a href={data.assets.sourceUrl} target="_blank" rel="noreferrer"><span>03</span><b>ทะเบียนสินทรัพย์ 1,909 หน้า</b><small>รหัส วันที่ ราคาทุน ค่าเสื่อม และมูลค่าตามบัญชี</small></a>
          <a href={data.meta.artifactSource} target="_blank" rel="noreferrer"><span>04</span><b>งานวิเคราะห์เบื้องต้นที่ผู้ใช้ส่งมา</b><small>ใช้เป็นแนวทางตั้งคำถาม แล้วตรวจซ้ำกับไฟล์ต้นทาง</small></a>
        </div>
      </div>}
    </section>
  )
}

export default SsoBudgetLab
