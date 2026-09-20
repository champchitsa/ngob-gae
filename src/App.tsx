import { useEffect, useMemo, useRef, useState } from 'react'
import { cases, lawCards, methodology, sourceNotes, themes, type CaseFile, type ThemeId } from './data'
import { bigData, investigationPath, legalActionMap, signalLawMap, signalQuestions, type AnomalyItem, type SignalId } from './bigData'
import BudgetChat from './BudgetChat'
import BudgetDashboard from './BudgetDashboard'
import DataExplorer from './DataExplorer'
import CorpusReader from './CorpusReader'
import CommitteeTracker from './CommitteeTracker'
import GovernmentMap from './GovernmentMap'
import SsoBudgetLab from './SsoBudgetLab'
import SsoItProcurementLab from './SsoItProcurementLab'
import { useModalAccessibility } from './useModalAccessibility'

type PboYear = { year: number; rows: number; act: number; adjusted: number; paid: number; paid_rate: number | null }
type PboHistory = { years: number; row_count: number; series: PboYear[] }
type SignalSort = 'score' | 'amount' | 'movement' | 'execution'

const formatMoney = (value: number) =>
  new Intl.NumberFormat('th-TH', { maximumFractionDigits: value < 100 ? 1 : 0 }).format(value)

const statusIcon: Record<CaseFile['status'], string> = {
  gap: '◌',
  slow: '↘',
  transfer: '↗',
  detail: '≋',
  context: '◎',
}

function App() {
  const [activeTheme, setActiveTheme] = useState<ThemeId>('all')
  const [activeSignal, setActiveSignal] = useState<SignalId>('all')
  const [activeAnomalyId, setActiveAnomalyId] = useState(bigData.items[0].id)
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState(cases[0].id)
  const [panel, setPanel] = useState<'method' | 'law' | 'sources' | null>(null)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<PboHistory | null>(null)
  const [fullAnomalies, setFullAnomalies] = useState<AnomalyItem[]>([])
  const [anomalyQuery, setAnomalyQuery] = useState('')
  const [anomalySort, setAnomalySort] = useState<SignalSort>('score')
  const [anomalyLimit, setAnomalyLimit] = useState(100)
  const [anomalyCopied, setAnomalyCopied] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const anomalySearchRef = useRef<HTMLInputElement>(null)
  const infoPanelRef = useRef<HTMLElement>(null)
  const infoPanelCloseRef = useRef<HTMLButtonElement>(null)

  useModalAccessibility(Boolean(panel), infoPanelRef, infoPanelCloseRef, () => setPanel(null))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    fetch('/data/pbo-history.json').then((response) => response.json()).then(setHistory).catch(() => undefined)
    fetch('/data/big-data-findings.json').then((response) => response.json()).then((data) => setFullAnomalies(data.items ?? [])).catch(() => undefined)
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th')
    return cases
      .filter((item) => activeTheme === 'all' || item.themes.includes(activeTheme))
      .filter((item) => !needle || [item.title, item.agency, item.ministry, item.eyebrow, item.lead].join(' ').toLocaleLowerCase('th').includes(needle))
      .sort((a, b) => b.priority - a.priority)
  }, [activeTheme, query])

  useEffect(() => {
    if (filtered.length && !filtered.some((item) => item.id === activeId)) setActiveId(filtered[0].id)
  }, [filtered, activeId])

  const active = cases.find((item) => item.id === activeId) ?? filtered[0] ?? cases[0]

  const analysisItems = fullAnomalies.length ? fullAnomalies : bigData.items
  const anomalyItems = useMemo(() => {
    const needle = anomalyQuery.trim().toLocaleLowerCase('th')
    const items = analysisItems
      .filter((item) => activeSignal === 'all' || item.signals.includes(activeSignal))
      .filter((item) => !needle || [item.item, item.agency, item.ministry, item.project].join(' ').toLocaleLowerCase('th').includes(needle))
    return [...items].sort((a, b) => {
      if (anomalySort === 'amount') return b.adjusted - a.adjusted
      if (anomalySort === 'movement') return Math.abs(b.delta) - Math.abs(a.delta)
      if (anomalySort === 'execution') return (a.rate ?? Number.POSITIVE_INFINITY) - (b.rate ?? Number.POSITIVE_INFINITY)
      return b.score - a.score
    })
  }, [activeSignal, analysisItems, anomalyQuery, anomalySort])

  useEffect(() => {
    setAnomalyLimit(100)
  }, [activeSignal, anomalyQuery, anomalySort])

  const visibleAnomalyItems = anomalyItems.slice(0, anomalyLimit)

  useEffect(() => {
    if (anomalyItems.length && !anomalyItems.some((item) => item.id === activeAnomalyId)) {
      setActiveAnomalyId(anomalyItems[0].id)
    }
  }, [anomalyItems, activeAnomalyId])

  const activeAnomaly = analysisItems.find((item) => item.id === activeAnomalyId) ?? anomalyItems[0] ?? bigData.items[0]
  const activeAnomalyQuestions = [...new Set(activeAnomaly.signals.flatMap((signal) => signalQuestions[signal]))].slice(0, 6)
  const activeAnomalyLaws = [...new Set(activeAnomaly.signals.flatMap((signal) => signalLawMap[signal]))]

  const maxHistoryBudget = Math.max(...(history?.series.map((item) => item.adjusted) ?? [1]))

  const copyBrief = async () => {
    const text = `${active.title}\nหน่วยงาน: ${active.agency}\nข้อสังเกต: ${active.lead}\n\nคำถามตรวจต่อ\n${active.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nเอกสารที่ควรขอ\n${active.requestDocs.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nที่มา: ${active.sourceUrl}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const copyAnomalyBrief = async () => {
    const text = `${activeAnomaly.item}\nหน่วยงาน: ${activeAnomaly.agency}\nโครงการ: ${activeAnomaly.project}\nตาม พ.ร.บ.: ${formatMoney(activeAnomaly.act)} ล้านบาท\nหลังโอน: ${formatMoney(activeAnomaly.adjusted)} ล้านบาท\nเปลี่ยนแปลง: ${formatMoney(activeAnomaly.delta)} ล้านบาท\nเบิกจ่ายรวมยอดผูกพัน (PO): ${activeAnomaly.rate === null ? 'ไม่พบข้อมูลระดับรายการ' : `${formatMoney(activeAnomaly.committed)} ล้านบาท (${activeAnomaly.rate}%)`}\n\nเงื่อนไขคัดกรอง\n${activeAnomaly.signals.map((signal) => `- ${bigData.flags.find((flag) => flag.id === signal)?.label}`).join('\n')}\n\nคำถามตรวจต่อ\n${activeAnomalyQuestions.map((question, index) => `${index + 1}. ${question}`).join('\n')}\n\nกฎหมายที่เกี่ยวข้อง\n${activeAnomalyLaws.map((law) => `- ${law}`).join('\n')}\n\nที่มา: ${bigData.meta.sourceUrl}`
    await navigator.clipboard.writeText(text)
    setAnomalyCopied(true)
    window.setTimeout(() => setAnomalyCopied(false), 1600)
  }

  const downloadData = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ngob-gae-${activeTheme}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="งบแกะ หน้าหลัก">
          <span className="brand-mark">งบ</span><span>แกะ</span>
        </a>
        <nav className="topnav" aria-label="เมนูหลัก">
          <button onClick={() => document.getElementById('budget-dashboard')?.scrollIntoView()}>ภาพรวม</button>
          <button onClick={() => document.getElementById('signals')?.scrollIntoView()}>ตรวจรายการ</button>
          <button onClick={() => document.getElementById('sso-it')?.scrollIntoView()}>ประกันสังคม</button>
          <button onClick={() => document.getElementById('archive')?.scrollIntoView()}>ค้นหลักฐาน</button>
          <button onClick={() => document.getElementById('committee')?.scrollIntoView()}>ติดตาม กมธ.</button>
          <button className="nav-chat" onClick={() => setChatOpen(true)}>ถามน้องเพนกวิน</button>
        </nav>
        <div className="data-stamp"><i /> ประมวลผล 20.09.69</div>
        <select className="mobile-section-nav" defaultValue="" aria-label="ไปยังส่วนต่างๆ ของเว็บ" onChange={(event) => {
          const targetId = event.currentTarget.value
          document.getElementById(targetId)?.scrollIntoView()
          event.currentTarget.value = ''
        }}>
          <option value="" disabled>เลือกส่วน</option>
          <option value="budget-dashboard">ภาพรวมงบ</option>
          <option value="signals">ตรวจรายการ</option>
          <option value="sso-it">ประกันสังคม</option>
          <option value="archive">ค้นหลักฐาน</option>
          <option value="committee">ติดตาม กมธ.</option>
        </select>
        <button className="mobile-chat-button" onClick={() => setChatOpen(true)}>ถามน้องเพนกวิน</button>
      </header>

      <main id="top">
        <section className="masthead">
          <div className="mast-copy">
            <div className="kicker"><span>PUBLIC BUDGET WORKBENCH</span><span>ทดลองใช้</span></div>
            <h1><span>งบก้อนนี้</span><mark>ใช้ทำอะไร</mark><span>ได้ผลแค่ไหน</span></h1>
            <p>แพลตฟอร์มตรวจสอบงบประมาณภาครัฐที่เชื่อมรายการ หน่วยงาน การจัดซื้อ สัญญา เอกสาร กฎหมาย และผลลัพธ์ไว้ในที่เดียว พร้อมเหตุผลและหลักฐานสำหรับตรวจสอบต่อ</p>
            <div className="hero-actions">
              <a className="primary-action" href="#signals" onClick={() => window.setTimeout(() => anomalySearchRef.current?.focus(), 500)}>เริ่มตรวจรายการ <span>↓</span></a>
              <a className="secondary-action" href="#sso-it">เจาะงบ IT ประกันสังคม</a>
            </div>
            <div className="hero-proof" role="list" aria-label="จุดเด่นเครื่องมือ"><span role="listitem"><b>{bigData.meta.candidateCount.toLocaleString('th-TH')}</b> รายการจัดอันดับ</span><span role="listitem"><b>417</b> หน่วยงานเชื่อมโครงสร้าง</span><span role="listitem"><b>7</b> เงื่อนไขคัดกรอง</span><span role="listitem"><b>5</b> ขั้นตามหลักฐาน</span></div>
          </div>
          <div className="evidence-board" role="region" aria-label="สรุปชุดข้อมูล">
            <div className="board-label">คลังหลักฐาน / สำรวจครบทั้ง Drive</div>
            <div className="big-number">694</div>
            <div className="number-caption">ไฟล์ใน 113 โฟลเดอร์ รวม 6.67 GB</div>
            <div className="tape tape-one">ไล่จากยอดรวมถึงเอกสารต้นทาง</div>
            <div className="board-grid">
              <div><strong>124</strong><span>workbook<br />เปิดอ่านครบ</span></div>
              <div><strong>{cases.length}</strong><span>แฟ้มวิเคราะห์<br />พร้อมคำถาม</span></div>
              <div><strong>7</strong><span>มาตรากฎหมาย<br />ฉบับประกาศใช้จริง</span></div>
              <div><strong>11</strong><span>ปี PBO<br />2558 ถึง 2568</span></div>
            </div>
            <div className="scribble">ทุกตัวเลขมีที่มา<br />ทุกคำถามมีทางไปต่อ</div>
          </div>
        </section>

        <section className="principles" aria-label="หลักการใช้งาน">
          <div><span>01</span><strong>เห็นความต่าง</strong><p>เทียบตั้งต้น หลังโอน และผลเบิกจ่าย</p></div>
          <div><span>02</span><strong>เห็นช่องว่าง</strong><p>แยกข้อมูลไม่ครบออกจากยอดศูนย์</p></div>
          <div><span>03</span><strong>ตามเอกสาร</strong><p>ไปต่อถึง TOR สัญญา งวดงาน และผลลัพธ์</p></div>
          <div><span>04</span><strong>ส่งต่อให้ตรวจได้</strong><p>ทุกข้อสังเกตมีคำถาม เอกสาร และลิงก์ต้นทาง</p></div>
        </section>

        <section className="task-launcher" aria-labelledby="task-launcher-title">
          <header>
            <span>เริ่มใช้งาน</span>
            <h2 id="task-launcher-title">วันนี้คุณต้องการตรวจอะไร</h2>
            <p>เลือกงานหนึ่งอย่าง ระบบจะพาไปยังข้อมูล เครื่องมือ และหลักฐานที่เกี่ยวข้องโดยตรง</p>
          </header>
          <div className="task-grid">
            <a href="#signals"><b>01</b><strong>หารายการที่ควรตรวจต่อ</strong><span>ค้นและจัดอันดับจากวงเงิน การโอน และผลเบิกจ่าย</span><i>เปิดรายการ →</i></a>
            <a href="#sso-it"><b>02</b><strong>เจาะงบ IT ประกันสังคม</strong><span>ดูโครงการ ผู้ชนะ คู่แข่ง สัญญา และโครงข่ายบริษัท</span><i>เปิดแฟ้มเฉพาะทาง →</i></a>
            <a href="#archive"><b>03</b><strong>ค้นเอกสารและหลักฐาน</strong><span>ค้น 694 ไฟล์ อ่าน OCR และกลับไปเทียบต้นฉบับ</span><i>เปิดคลังหลักฐาน →</i></a>
            <a href="#committee"><b>04</b><strong>ติดตามคำถามของกรรมาธิการ</strong><span>ดูคำถาม เอกสารที่ขอ ผู้รับผิดชอบ และสถานะคำตอบ</span><i>เปิดตัวติดตาม →</i></a>
          </div>
        </section>

        <BudgetDashboard history={history} />

        <GovernmentMap onInspectMinistry={(ministry) => {
          setActiveSignal('all')
          setAnomalyQuery(ministry)
          window.setTimeout(() => {
            document.getElementById('signals')?.scrollIntoView()
            anomalySearchRef.current?.focus()
          }, 50)
        }} />

        <SsoItProcurementLab onAsk={() => setChatOpen(true)} />
        <SsoBudgetLab onAsk={() => setChatOpen(true)} />

        <section className="signal-lab" id="signals">
          <div className="workspace-head inverse">
            <div>
              <span className="section-no">02 / BIG DATA SIGNALS</span>
              <h2>สแกน 241,159 แถว</h2>
            </div>
            <p>มองทั้งการกระจุกตัว การเปลี่ยนวงเงิน และการใช้จ่าย แล้วเปิดลงไปถึงรายการที่ต้องถามต่อ</p>
          </div>

          <div className="overview-grid" role="group" aria-label="ภาพรวมข้อมูล PBO ปี 2568">
            <div className="overview-lead"><span>วงเงินหลังโอนรวม</span><strong>3.753</strong><b>ล้านล้านบาท</b><p>ตรงกับยอดรวมในชุด PBO ปี 2568</p></div>
            <div><span>แถวที่มีวงเงิน</span><strong>{bigData.overview.positiveRows.toLocaleString('th-TH')}</strong><b>จาก {bigData.meta.rows.toLocaleString('th-TH')} แถว</b></div>
            <div><span>ตั้งแต่ 20 ล้านบาท</span><strong>{bigData.overview.rowsOver20m.toLocaleString('th-TH')}</strong><b>รายการ</b></div>
            <div><span>มัธยฐานต่อรายการ</span><strong>{formatMoney(bigData.overview.median)}</strong><b>ล้านบาท</b></div>
            <div className="hot-stat"><span>วงเงินของ 1% แรก</span><strong>{bigData.overview.topOnePercentShare}%</strong><b>ของวงเงินทั้งหมด</b></div>
            <div><span>Gini ระดับรายการ</span><strong>{bigData.overview.gini}</strong><b>ยิ่งใกล้ 1 ยิ่งกระจุก</b></div>
          </div>

          <div className="reading-note">
            <strong>ข้อค้นพบหลัก</strong>
            <p>รายการที่มีวงเงินสูงสุด 1% แรกคิดเป็น 80.3% ของวงเงินทั้งหมด ขณะที่ครึ่งหนึ่งของรายการมีวงเงินไม่เกิน 0.499 ล้านบาท ระบบจึงจัดลำดับการตรวจด้วยมูลค่า การเปลี่ยนแปลงวงเงิน ความคืบหน้าการใช้จ่าย และความชัดเจนของชื่อรายการ</p>
          </div>

          <div className="flag-rack" role="group" aria-label="เงื่อนไขคัดกรอง">
            <button className={activeSignal === 'all' ? 'active' : ''} onClick={() => setActiveSignal('all')} aria-pressed={activeSignal === 'all'}>
              <span>ทุกเงื่อนไข</span><strong>{analysisItems.length}</strong><small>รายการจัดอันดับที่เปิดดูได้</small>
            </button>
            {bigData.flags.map((flag) => <button key={flag.id} className={activeSignal === flag.id ? 'active' : ''} onClick={() => setActiveSignal(flag.id)} aria-pressed={activeSignal === flag.id} title={flag.definition}>
              <span>{flag.label}</span><strong>{flag.count.toLocaleString('th-TH')}</strong><small>{formatMoney(flag.amount)} ล้านบาท</small>
            </button>)}
          </div>
          <div className="flag-tools"><p className="flag-note">รายการหนึ่งอาจเข้าได้หลายเงื่อนไข จำนวนจึงนำมาบวกกันตรงๆ ไม่ได้</p><a href="/data/big-data-findings.json" download>ดาวน์โหลดผลเต็ม {analysisItems.length} รายการ .JSON</a></div>

          <div className="anomaly-controls">
            <label className="anomaly-search"><span aria-hidden="true">⌕</span><input ref={anomalySearchRef} aria-label="ค้นรายการคัดกรอง" value={anomalyQuery} onChange={(event) => setAnomalyQuery(event.target.value)} placeholder="ค้นชื่อรายการ หน่วยงาน กระทรวง หรือโครงการ" /></label>
            <label className="anomaly-sort"><span>เรียงตาม</span><select value={anomalySort} onChange={(event) => setAnomalySort(event.target.value as SignalSort)}><option value="score">คะแนนคัดกรอง</option><option value="amount">วงเงินหลังโอน</option><option value="movement">มูลค่าที่เปลี่ยน</option><option value="execution">อัตราใช้จ่ายต่ำก่อน</option></select></label>
            <div className="anomaly-count" aria-live="polite"><strong>{anomalyItems.length.toLocaleString('th-TH')}</strong><span>รายการที่ตรงเงื่อนไข</span></div>
          </div>

          <div className="signal-desk">
            <aside className="anomaly-list" aria-label="รายการผิดสังเกตจากข้อมูลขนาดใหญ่">
              <div className="list-head"><span>รายการสำหรับเปิดหลักฐาน</span><strong>{anomalyItems.length} รายการ</strong></div>
              {visibleAnomalyItems.map((item) => <button key={item.id} className={`anomaly-row ${activeAnomaly.id === item.id ? 'active' : ''}`} onClick={() => setActiveAnomalyId(item.id)}>
                <span className="anomaly-score">{item.score}</span>
                <span className="anomaly-copy"><strong>{item.item}</strong><small>{item.agency}</small></span>
                <span className="anomaly-money">{formatMoney(item.adjusted)}<small>ล้าน</small></span>
              </button>)}
              {visibleAnomalyItems.length < anomalyItems.length && <button className="anomaly-more" onClick={() => setAnomalyLimit((value) => value + 100)}>แสดงเพิ่มอีก {Math.min(100, anomalyItems.length - visibleAnomalyItems.length).toLocaleString('th-TH')} รายการ</button>}
              {anomalyItems.length === 0 && <div className="anomaly-empty"><strong>ไม่พบรายการที่ตรงกัน</strong><button onClick={() => { setAnomalyQuery(''); setActiveSignal('all') }}>ล้างคำค้นและเงื่อนไข</button></div>}
            </aside>

            {anomalyItems.length > 0 ? <article className="anomaly-file" key={activeAnomaly.id}>
              <div className="anomaly-topline">
                <span>ANOMALY #{activeAnomaly.id.slice(0, 6).toUpperCase()}</span>
                <div className="anomaly-actions"><button onClick={copyAnomalyBrief} aria-live="polite">{anomalyCopied ? 'คัดลอกแล้ว' : 'คัดลอกใบตรวจ'}</button><button onClick={() => document.getElementById('law-workbench')?.scrollIntoView()}>ดูกฎหมาย</button><strong>{activeAnomaly.score}<small>/100</small></strong></div>
              </div>
              <div className="signal-tags">{activeAnomaly.signals.map((signal) => <span key={signal}>{bigData.flags.find((flag) => flag.id === signal)?.label}</span>)}</div>
              <h3>{activeAnomaly.item}</h3>
              <p className="anomaly-agency">{activeAnomaly.agency}<span>/</span>{activeAnomaly.ministry}</p>
              <p className="anomaly-project">{activeAnomaly.project}</p>

              <div className="anomaly-numbers">
                <div><span>ตาม พ.ร.บ.</span><strong>{formatMoney(activeAnomaly.act)}</strong><small>ล้านบาท</small></div>
                <div><span>หลังโอน</span><strong>{formatMoney(activeAnomaly.adjusted)}</strong><small>ล้านบาท</small></div>
                <div className={activeAnomaly.delta >= 0 ? 'delta-up' : 'delta-down'}><span>เปลี่ยนแปลง</span><strong>{activeAnomaly.delta > 0 ? '+' : ''}{formatMoney(activeAnomaly.delta)}</strong><small>ล้านบาท</small></div>
                <div><span>เบิกจ่ายรวมยอดผูกพัน (PO)</span><strong>{activeAnomaly.rate === null ? 'ไม่พบข้อมูล' : `${formatMoney(activeAnomaly.committed)}`}</strong><small>{activeAnomaly.rate === null ? 'ในระดับรายการ' : `${activeAnomaly.rate}% ของวงเงินหลังโอน`}</small></div>
              </div>

              <div className="anomaly-reading">
                <strong>สิ่งที่ควรเปิดดูต่อ</strong>
                <ol>{activeAnomalyQuestions.map((question) => <li key={question}>{question}</li>)}</ol>
              </div>
              <div className="anomaly-law-row"><strong>กฎหมายที่ใช้เดินต่อ</strong><div>{activeAnomalyLaws.map((law) => <button key={law} onClick={() => document.getElementById('law-workbench')?.scrollIntoView()}>{law}</button>)}</div></div>
              <div className="anomaly-source"><span>แหล่งข้อมูล PBO ปี 2568</span><a href={bigData.meta.sourceUrl} target="_blank" rel="noreferrer">เปิดไฟล์ต้นทาง ↗</a></div>
            </article> : <article className="anomaly-file anomaly-file-empty"><span>NO MATCH</span><h3>ยังไม่มีรายการที่ตรงทั้งคำค้นและเงื่อนไข</h3><p>ลองล้างคำค้นหรือเลือกทุกเงื่อนไข แล้วเริ่มจากรายการที่คะแนนสูงสุด</p><button onClick={() => { setAnomalyQuery(''); setActiveSignal('all') }}>แสดงรายการทั้งหมด</button></article>}
          </div>

          <section className="evidence-path" aria-labelledby="evidence-path-title">
            <div className="path-head"><span className="panel-kicker">NUMBER TO ACCOUNTABILITY</span><h3 id="evidence-path-title">จากตัวเลขหนึ่งแถว ไปถึงคำตอบที่ตรวจได้</h3><p>ตัวเลขผิดสังเกตมีค่าเมื่อพาไปถึงการอนุมัติ การจัดซื้อ การส่งมอบ และผลที่ประชาชนได้รับ</p></div>
            <div className="path-grid">{investigationPath.map((stage) => <article key={stage.step}><span>{stage.step}</span><h4>{stage.title}</h4><strong>{stage.question}</strong><p>{stage.evidence}</p><small>{stage.law}</small></article>)}</div>
          </section>

          <div className="deep-grid">
            <article className="deep-card theme-card">
              <span className="panel-kicker">6 WORKSTREAMS</span><h3>งบตามหัวข้อที่ใช้ในวันงาน</h3>
              {bigData.themes.map((theme) => <div className="theme-line" key={theme.id}>
                <div><strong>{theme.label}</strong><small>{theme.rows.toLocaleString('th-TH')} แถว</small></div>
                <div><b>{formatMoney(theme.adjusted)} ลบ.</b><span>{theme.rate}%</span></div>
                <i><em style={{ width: `${Math.min(theme.rate, 100)}%` }} /></i>
              </div>)}
            </article>
            <article className="deep-card agency-card">
              <span className="panel-kicker">CONCENTRATION</span><h3>12 หน่วยงานวงเงินสูงสุด</h3>
              {bigData.agencies.map((agency, index) => <div className="agency-bar" key={agency.agency}>
                <span>{String(index + 1).padStart(2, '0')}</span><strong>{agency.agency}</strong><i><em style={{ width: `${agency.share / bigData.agencies[0].share * 100}%` }} /></i><b>{agency.share}%</b>
              </div>)}
            </article>
            <article className="deep-card repeated-card">
              <span className="panel-kicker">REPEATED LABELS</span><h3>ชื่อรวมที่ซ่อนรายการย่อยจำนวนมาก</h3>
              <p>ชื่อซ้ำไม่ได้แปลว่าผิด แต่บอกว่าควรขอรายละเอียดระดับหน่วยงานและรายการย่อยเพิ่ม</p>
              {bigData.repeatedPatterns.map((pattern) => <div className="pattern-row" key={pattern.pattern}><strong>{pattern.pattern}</strong><span>{pattern.count.toLocaleString('th-TH')} แถว</span><b>{formatMoney(pattern.adjusted)} ล้านบาท</b></div>)}
            </article>
          </div>

          <section className="legal-workbench" id="law-workbench" aria-labelledby="law-workbench-title">
            <div className="legal-head"><div><span className="panel-kicker">LAW TO ACTION</span><h3 id="law-workbench-title">กฎหมายที่เปลี่ยนข้อสงสัยเป็นรายการเอกสาร</h3></div><p>เลือกตัวบทตามลักษณะสัญญาณ แล้วขอหลักฐานที่ทำให้หน่วยงานตอบได้เป็นข้อ ไม่หยุดแค่คำอธิบายกว้างๆ</p></div>
            <div className="legal-grid">{legalActionMap.map((law, index) => <article key={law.code}><span>{String(index + 1).padStart(2, '0')}</span><h4>{law.code}</h4><strong>{law.title}</strong><div><b>ใช้เมื่อ</b><p>{law.trigger}</p></div><div><b>เอกสารที่ควรขอ</b><p>{law.request}</p></div><a href={law.url} target="_blank" rel="noreferrer">เปิดตัวบทจากหน่วยงานทางการ ↗</a></article>)}</div>
          </section>
        </section>

        <section className="workspace" id="workspace">
          <div className="workspace-head">
            <div>
              <span className="section-no">03 / CASE DESK</span>
              <h2>โต๊ะแกะงบ</h2>
            </div>
            <p>เลือกประเด็นจากงาน แล้วไล่จากรายการที่ควรอ่านก่อน</p>
          </div>

          <div className="command-row">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input ref={searchRef} aria-label="ค้นแฟ้มตรวจสอบ" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหน่วยงาน โครงการ หรือคำสำคัญ" />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <button className="download-button" onClick={downloadData}>ดาวน์โหลด {filtered.length} เคส .JSON</button>
          </div>

          <div className="theme-tabs" role="group" aria-label="กลุ่มประเด็น">
            {themes.map((theme) => {
              const count = theme.id === 'all' ? cases.length : cases.filter((item) => item.themes.includes(theme.id)).length
              return <button key={theme.id} className={activeTheme === theme.id ? 'active' : ''} onClick={() => setActiveTheme(theme.id)} aria-pressed={activeTheme === theme.id}><span>{theme.short}</span><small>{count}</small></button>
            })}
          </div>

          <div className="desk-grid">
            <aside className="case-list" aria-label="รายการแฟ้มตรวจสอบ">
              <div className="list-head"><span>เรียงตามลำดับควรอ่าน</span><strong>{filtered.length} แฟ้ม</strong></div>
              {filtered.length ? filtered.map((item) => (
                <button key={item.id} className={`case-row ${active.id === item.id ? 'active' : ''}`} onClick={() => setActiveId(item.id)}>
                  <div className={`status-glyph ${item.status}`}>{statusIcon[item.status]}</div>
                  <div className="case-row-copy">
                    <small>{item.eyebrow}</small>
                    <strong>{item.title}</strong>
                    <span>{item.agency}</span>
                  </div>
                  <div className="priority"><b>{item.priority}</b><small>/100</small></div>
                </button>
              )) : <div className="empty-state"><strong>ยังไม่พบแฟ้มที่ตรงคำค้น</strong><button onClick={() => { setQuery(''); setActiveTheme('all') }}>ล้างตัวกรอง</button></div>}
            </aside>

            <article className="case-file" key={active.id}>
              <div className="file-topline">
                <div><span className={`signal ${active.status}`}>{statusIcon[active.status]} {active.statusLabel}</span><span>{active.dataLevel}</span></div>
                <div className="file-actions"><button onClick={copyBrief}>{copied ? 'คัดลอกแล้ว' : 'คัดลอกใบคำถาม'}</button><button onClick={() => window.print()}>พิมพ์</button></div>
              </div>

              <div className="file-title">
                <p>{active.eyebrow}</p>
                <h3>{active.title}</h3>
                <div className="agency-line">{active.agency}<span>/</span>{active.ministry}</div>
              </div>

              <div className="money-strip">
                <div><small>วงเงินที่กำลังดู</small><strong>{formatMoney(active.budget)}</strong><span>ล้านบาท</span></div>
                {active.paid !== undefined && <div><small>เบิกจ่ายหรือใช้จ่ายที่รายงาน</small><strong>{formatMoney(active.paid)}</strong><span>ล้านบาท</span></div>}
                <div className="score-box"><small>ลำดับควรอ่าน</small><strong>{active.priority}</strong><span>จาก 100</span></div>
              </div>

              {active.rate !== undefined && <div className="rate-track" aria-label={`อัตราที่รายงาน ${active.rate}%`}><div style={{ width: `${Math.min(active.rate, 100)}%` }} /><span>{active.rate}%</span></div>}

              <div className="lead-note"><span>ข้อสังเกตตั้งต้น</span><p>{active.lead}</p></div>

              <div className="file-columns">
                <section>
                  <h4>สิ่งที่ข้อมูลบอก</h4>
                  <p>{active.finding}</p>
                  <ul className="evidence-list">{active.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
                <section className="caution-box">
                  <h4>ข้อมูลที่ต้องเชื่อมเพิ่ม</h4>
                  <p>{active.caution}</p>
                </section>
              </div>

              <section className="question-section">
                <div className="section-title"><span>ถามต่อให้ถึงหลักฐาน</span><small>QUESTION CARD</small></div>
                <ol>{active.questions.map((question) => <li key={question}>{question}</li>)}</ol>
              </section>

              <div className="file-columns lower">
                <section>
                  <h4>เอกสารที่ควรขอ</h4>
                  <ul className="document-list">{active.requestDocs.map((doc) => <li key={doc}><span>□</span>{doc}</li>)}</ul>
                </section>
                <section>
                  <h4>ฐานกฎหมายที่เกี่ยวข้อง</h4>
                  <div className="law-tags">{active.laws.map((law) => <button key={law} onClick={() => setPanel('law')}>{law}</button>)}</div>
                </section>
              </div>

              <section className="score-method">
                <div className="score-head"><h4>ที่มาคะแนนคัดกรอง</h4><span>คะแนนสำหรับจัดลำดับการตรวจ</span></div>
                {Object.entries({ 'มูลค่า': active.score.value, 'การใช้จ่าย': active.score.execution, 'การโอน': active.score.movement, 'ความชัดเจน': active.score.clarity }).map(([label, value]) => <div className="score-line" key={label}><span>{label}</span><div><i style={{ width: `${value * 4}%` }} /></div><b>{value}/25</b></div>)}
              </section>

              <footer className="file-footer">
                <div><small>ความพร้อมของข้อมูล</small><strong>{active.completeness}</strong></div>
                <a href={active.sourceUrl} target="_blank" rel="noreferrer">เปิดหลักฐานต้นทาง ↗<small>{active.sourceLabel}</small></a>
              </footer>
            </article>
          </div>
        </section>

        <DataExplorer />

        <CommitteeTracker />

        <section className="archive" id="archive">
          <div className="workspace-head">
            <div><span className="section-no">06 / EVIDENCE ARCHIVE</span><h2>คลังหลักฐาน 694 ไฟล์</h2></div>
            <p>ค้นจากชื่อไฟล์ เส้นทาง และหมวดข้อมูลได้ทันที ทุกผลลัพธ์เปิดกลับไปยังไฟล์ต้นทางใน Drive</p>
          </div>

          <div className="corpus-stats" role="group" aria-label="ภาพรวมคลังข้อมูล">
            <div><strong>694</strong><span>ไฟล์ทั้งหมด</span></div>
            <div><strong>113</strong><span>โฟลเดอร์ที่สำรวจ</span></div>
            <div><strong>560</strong><span>เอกสาร PDF</span></div>
            <div><strong>124</strong><span>workbook ที่อ่านได้</span></div>
            <div><strong>856</strong><span>ชีตที่ตรวจโครงสร้าง</span></div>
            <div><strong>6.67 GB</strong><span>ขนาดรวมทั้งคลัง</span></div>
          </div>

          <CorpusReader />

          <div className="archive-layout archive-insights-layout">
            <aside className="archive-analysis">
              <div className="analysis-card history-card">
                <span className="panel-kicker">PBO / 11 YEAR SERIES</span>
                <h3>งบและการเบิกจ่าย 2558 ถึง 2568</h3>
                <p>รวม 2,887,730 แถวจากไฟล์ PBO 11 ปี แล้วตรวจยอดรายปีกับ Grand Total ในไฟล์ต้นทาง</p>
                <div className="history-chart" role="img" aria-label="กราฟวงเงิน PBO รายปี 2558 ถึง 2568 พร้อมอัตราเบิกจ่าย">
                  {history?.series.map((item) => (
                    <div className="history-year" key={item.year} title={`${item.year}: ${(item.adjusted / 1_000_000).toFixed(2)} ล้านล้านบาท`}>
                      <div className="history-bar"><i style={{ height: `${Math.max(8, item.adjusted / maxHistoryBudget * 100)}%` }}><b>{item.paid_rate ?? 0}%</b></i></div>
                      <span>{String(item.year).slice(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="chart-legend"><span><i />วงเงินหลังโอน</span><span>ตัวเลขบนแท่งคืออัตราเบิกจ่าย</span></div>
              </div>

              <div className="analysis-card">
                <span className="panel-kicker">CROSS DATA FINDINGS</span>
                <h3>ประเด็นที่เห็นเมื่ออ่านข้ามชุด</h3>
                <ol className="insight-list">
                  <li><b>กรุงเทพฯ</b><span>งบรวม 93,918.9 ล้านบาท และงานสำนักงานเขต 21,842.9 ล้านบาท มีตารางแยกรายหน่วยงานให้เทียบราคาต่อหน่วยต่อได้</span></li>
                  <li><b>เชียงใหม่</b><span>จ้างเก็บและกำจัดขยะสองรายการรวม 287.9 ล้านบาท หรือ 14.4% ของร่างงบเทศบาลนคร</span></li>
                  <li><b>ราชาเทวะ</b><span>ขยะและงานก่อสร้างสองกลุ่มรวม 187.2 ล้านบาท หรือ 30.4% ของยอดสรุป</span></li>
                  <li><b>กองทุนพลังงาน</b><span>267 โครงการ 1,177.0 ล้านบาท มี 8 โครงการยกเลิกวงเงินรวม 70.5 ล้านบาท</span></li>
                </ol>
              </div>
            </aside>
          </div>
        </section>

        <section className="method-preview">
          <div className="workspace-head inverse">
            <div><span className="section-no">07 / METHOD</span><h2>กฎต้องอธิบายได้</h2></div>
            <p>เปิดสูตรคัดกรอง นิยามข้อมูล และทางกลับไปยังต้นฉบับทุกขั้น</p>
          </div>
          <div className="method-grid">{methodology.map((item) => <div key={item.step}><span>{item.step}</span><h3>{item.title}</h3><p>{item.text}</p></div>)}</div>
          <button className="outline-action" onClick={() => setPanel('method')}>ดูสูตรและข้อจำกัดทั้งหมด</button>
        </section>

        <section className="closing">
          <p>งบประมาณไม่ควรจบที่ไฟล์ดาวน์โหลด</p>
          <h2>มันควรพาเราไปถึง<br />คนตัดสินใจ สัญญา และผลลัพธ์</h2>
          <div className="closing-links"><a href="#workspace">กลับไปเลือกแฟ้ม ↑</a><button onClick={() => setPanel('sources')}>เปิดบัญชีแหล่งข้อมูล</button></div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="brand"><span className="brand-mark">งบ</span><span>แกะ</span></div>
        <p>โต๊ะทำงานสาธารณะสำหรับค้นงบ ตั้งคำถาม<br />และย้อนกลับไปยังหลักฐานต้นทาง</p>
        <div><a href="https://github.com/champchitsa/ngob-gae" target="_blank" rel="noreferrer">GitHub ↗</a><span>สร้างสำหรับ OPEN DATA HACK 2569</span></div>
      </footer>

      <BudgetChat
        activeItem={activeAnomaly}
        items={analysisItems}
        open={chatOpen}
        onOpen={() => setChatOpen(true)}
        onClose={() => setChatOpen(false)}
        onSelectItem={(id) => {
          setActiveSignal('all')
          setAnomalyQuery('')
          setActiveAnomalyId(id)
        }}
      />

      {panel && <div className="panel-backdrop" role="presentation" onMouseDown={() => setPanel(null)}>
        <aside ref={infoPanelRef} className="info-panel" role="dialog" aria-modal="true" aria-label={panel === 'method' ? 'วิธีแกะ' : panel === 'law' ? 'ตัวบทกฎหมาย' : 'แหล่งข้อมูล'} tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
          <button ref={infoPanelCloseRef} className="panel-close" onClick={() => setPanel(null)} aria-label="ปิด">×</button>
          {panel === 'method' && <>
            <span className="panel-kicker">OPEN METHOD</span><h2>คะแนนใช้จัดลำดับการตรวจ</h2>
            <p className="panel-intro">คะแนน 100 แบ่งเป็น 4 มิติ มิติละ 25 คะแนน ได้แก่ มูลค่า อัตราใช้จ่าย ขนาดการโอนเปลี่ยนแปลง และความชัดเจนของข้อมูล ใช้เรียงแฟ้มที่ควรเปิดก่อน</p>
            <div className="formula"><span>PRIORITY</span><b>มูลค่า + การใช้จ่าย + การโอน + ความชัดเจน</b><small>สูงสุด 25 + 25 + 25 + 25 = 100</small></div>
            <h3>นิยามที่ใช้คำนวณ</h3>
            <ul className="panel-list"><li>ยอดว่างแยกจากยอดศูนย์ เพื่อรักษาความหมายของข้อมูลต้นทาง</li><li>กลุ่ม ICT ก่อสร้าง และอบรมใช้พจนานุกรมคำสำคัญ และแสดงจำนวนแถวที่เข้าเงื่อนไข</li><li>อัตราใช้จ่ายคำนวณจากยอดเบิกจ่ายหารวงเงินหลังโอนในระดับที่ระบุ</li><li>ยอดรวมเชื่อมต่อไปยัง TOR ผู้ชนะ สัญญา การส่งมอบ และผลลัพธ์ในใบคำถามแต่ละแฟ้ม</li></ul>
            <h3>แบบแผนจากเครื่องมือตรวจสอบสากล</h3>
            <p>ใช้แนวคิด red flags ของ Open Contracting ร่วมกับการเจาะจากภาพรวมสู่รายการ การค้นทั้งคลัง และการดาวน์โหลดข้อมูลแบบที่พอร์ทัลการใช้จ่ายสาธารณะใช้กัน</p>
            <a className="panel-link" href="https://www.open-contracting.org/resources/red-flags-in-public-procurement-a-guide-to-using-data-to-detect-and-mitigate-risks/" target="_blank" rel="noreferrer">อ่านคู่มือ Open Contracting ↗</a>
          </>}
          {panel === 'law' && <>
            <span className="panel-kicker">LEGAL LENS</span><h2>ตัวบทสำหรับเดินจากงบไปถึงความรับผิดชอบ</h2>
            <p className="panel-intro">รวมตัวบทของมาตราที่อ้างไว้บนเว็บแบบครบถ้วนตามฉบับประกาศใช้จริง ส่วน “ใช้ตรวจเรื่อง” เป็นคำอธิบายของระบบและแยกออกจากตัวบทอย่างชัดเจน</p>
            <div className="law-verification"><strong>ตรวจแหล่งแล้ว 20 กันยายน 2569</strong><p>ทุกลิงก์ด้านล่างชี้ไปยังไฟล์ประกาศในราชกิจจานุเบกษา ไม่ใช้ร่างกฎหมาย บทความ หรือเอกสารความเห็นแทนตัวบท</p></div>
            <div className="law-card-list">{lawCards.map((law, index) => <details className="law-provision" key={law.id} open={index === 0}>
              <summary><span>{String(index + 1).padStart(2, '0')}</span><div><small>{law.code}</small><strong>{law.title}</strong><p>{law.publication}</p></div><b>อ่านตัวบท</b></summary>
              <div className="law-analysis"><small>ใช้ตรวจเรื่อง</small><p>{law.analysis}</p><strong>เอกสารที่เชื่อมต่อ</strong><p>{law.documents.join(' • ')}</p></div>
              <div className="law-exact"><div><span>ตัวบทตามประกาศ</span><small>แสดงครบทั้งมาตราที่อ้าง โดยไม่เรียบเรียงใหม่</small></div><pre>{law.exactText}</pre></div>
              <a className="law-source-link" href={law.sourceUrl} target="_blank" rel="noreferrer">เปิดฉบับประกาศในราชกิจจานุเบกษา ↗</a>
            </details>)}</div>
          </>}
          {panel === 'sources' && <>
            <span className="panel-kicker">SOURCE LEDGER</span><h2>ทุกข้อสังเกตต้องย้อนกลับได้</h2>
            <p className="panel-intro">สำรวจ Drive ครบ 694 ไฟล์ เปิดอ่าน workbook ทั้ง 124 เล่ม และเก็บลิงก์ต้นทางไว้ในบัญชีค้นหา</p>
            <div className="source-list">{sourceNotes.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.label}><small>{source.label}</small><strong>{source.value}</strong><p>{source.detail}</p><span>เปิดต้นทาง ↗</span></a>)}</div>
            <div className="source-warning"><strong>เวอร์ชันข้อมูล</strong><p>บัญชีไฟล์และผลวิเคราะห์ชุดนี้จัดทำ ณ 20 กันยายน 2569 ตัวเลขแสดงความละเอียดเต็มในแฟ้มและปัดเฉพาะส่วนติดต่อผู้ใช้</p></div>
          </>}
        </aside>
      </div>}
    </div>
  )
}

export default App
