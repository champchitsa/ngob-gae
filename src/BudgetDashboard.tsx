import { useMemo, useState } from 'react'
import { bigData } from './bigData'

type PboYear = { year: number; rows: number; act: number; adjusted: number; paid: number; paid_rate: number | null }
type PboHistory = { years: number; row_count: number; series: PboYear[] }
type DashboardView = 'overview' | 'agencies' | 'topics' | 'audit'

const views: { id: DashboardView; label: string; detail: string }[] = [
  { id: 'overview', label: 'ภาพรวมประชาชน', detail: 'เงินทั้งหมด ใช้ไปเท่าไร และต่างจากปีก่อนอย่างไร' },
  { id: 'agencies', label: 'โครงสร้างภาครัฐ', detail: 'หน่วยงานวงเงินสูงและการกระจุกตัวของงบ' },
  { id: 'topics', label: 'หัวข้อกิจกรรม', detail: 'ICT จัดซื้อ ก่อสร้าง ฝึกอบรม AI และประกันสังคม' },
  { id: 'audit', label: 'มุมตรวจสอบ', detail: 'เงื่อนไขคัดกรอง วงเงิน และหลักฐานที่ต้องตาม' },
]

const number = (value: number, digits = 0) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: digits }).format(value)
const trillion = (value: number) => `${number(value / 1_000_000, 3)} ล้านล้านบาท`
const percentChange = (current: number, previous?: number) => previous ? ((current - previous) / previous) * 100 : null

function BudgetDashboard({ history }: { history: PboHistory | null }) {
  const [view, setView] = useState<DashboardView>('overview')
  const [year, setYear] = useState(2568)
  const series = history?.series ?? []
  const selected = series.find((item) => item.year === year) ?? series.at(-1)
  const selectedIndex = selected ? series.findIndex((item) => item.year === selected.year) : -1
  const previous = selectedIndex > 0 ? series[selectedIndex - 1] : undefined
  const yearChange = selected ? percentChange(selected.adjusted, previous?.adjusted) : null
  const unspent = selected ? Math.max(0, selected.adjusted - selected.paid) : 0
  const maxAgency = Math.max(...bigData.agencies.map((item) => item.adjusted))
  const maxTheme = Math.max(...bigData.themes.map((item) => item.adjusted))
  const maxHistory = Math.max(...series.map((item) => item.adjusted), 1)
  const viewInfo = views.find((item) => item.id === view) ?? views[0]

  const yearContext = useMemo(() => {
    if (!selected) return 'กำลังอ่านอนุกรมเวลา PBO'
    if (!previous || yearChange === null) return `ปี ${selected.year} เป็นปีแรกในชุดเปรียบเทียบ`
    const direction = yearChange >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'
    return `วงเงินหลังโอน${direction} ${number(Math.abs(yearChange), 1)}% จากปี ${previous.year}`
  }, [previous, selected, yearChange])

  return <section className="budget-dashboard" id="budget-dashboard">
    <div className="dashboard-title">
      <div><span className="section-no">00 / BUDGET DASHBOARD</span><h2>งบทั้งระบบ อ่านจบในหน้าเดียว</h2></div>
      <p>เปลี่ยนมุมมองและปีได้ทันที ตัวเลขสำคัญอยู่บนเว็บ พร้อมทางลงไปถึงรายการคัดกรองและหลักฐาน</p>
    </div>

    <div className="dashboard-switcher" role="tablist" aria-label="มุมมองแดชบอร์ด">
      {views.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)} role="tab" aria-selected={view === item.id}>
        <strong>{item.label}</strong><small>{item.detail}</small>
      </button>)}
    </div>

    <div className="dashboard-total">
      <label><span>ปีงบประมาณ</span><select value={selected?.year ?? year} onChange={(event) => setYear(Number(event.target.value))}>{series.map((item) => <option key={item.year} value={item.year}>{item.year}</option>)}</select></label>
      <div><span>วงเงินหลังโอน</span><strong>{selected ? trillion(selected.adjusted) : 'กำลังอ่านข้อมูล'}</strong><small>{yearContext}</small></div>
    </div>

    <div className="dashboard-view-head"><span>{viewInfo.label}</span><p>{viewInfo.detail}</p></div>

    {view === 'overview' && <div className="dashboard-overview">
      <div className="dashboard-kpis">
        <article><span>วงเงินตาม พ.ร.บ.</span><strong>{selected ? trillion(selected.act) : '-'}</strong><small>กรอบงบก่อนการโอนเปลี่ยนแปลง</small></article>
        <article className="accent"><span>เบิกจ่ายรวม</span><strong>{selected ? trillion(selected.paid) : '-'}</strong><small>{selected?.paid_rate ?? '-'}% ของวงเงินหลังโอน</small></article>
        <article><span>ส่วนต่างที่ยังไม่เบิก</span><strong>{selected ? `${number(unspent)} ล้านบาท` : '-'}</strong><small>คำนวณจากวงเงินหลังโอนลบยอดเบิกจ่าย</small></article>
        <article><span>ความละเอียดข้อมูล</span><strong>{selected ? number(selected.rows) : '-'}</strong><small>แถวในไฟล์ PBO ปีที่เลือก</small></article>
      </div>
      <div className="dashboard-story">
        <div><span>ภาพใหญ่ปี {selected?.year}</span><strong>{selected?.paid_rate ?? '-'}%</strong><p>อัตราเบิกจ่ายจากข้อมูล PBO</p></div>
        <div><span>ปี 2568 ลงลึกได้ถึง</span><strong>{bigData.meta.rows.toLocaleString('th-TH')}</strong><p>แถว พร้อมหน่วยงาน แผนงาน โครงการ และรายการ</p></div>
        <div><span>การกระจุกตัวปี 2568</span><strong>{bigData.overview.topOnePercentShare}%</strong><p>วงเงินอยู่ในรายการ 1% แรก</p></div>
      </div>
      <div className="history-ribbon" aria-label="งบประมาณย้อนหลัง">
        {series.map((item) => <button key={item.year} className={item.year === selected?.year ? 'active' : ''} onClick={() => setYear(item.year)}>
          <span>{item.year}</span><i style={{ height: `${Math.max(14, item.adjusted / maxHistory * 100)}%` }} /><strong>{number(item.adjusted / 1_000_000, 2)}</strong><small>ล้านล้าน</small>
        </button>)}
      </div>
    </div>}

    {view === 'agencies' && <div className="dashboard-split">
      <div className="dashboard-bars"><div className="dashboard-panel-label">หน่วยงานวงเงินสูง ปี 2568</div>{bigData.agencies.map((item, index) => <div className="dashboard-bar" key={item.agency}>
        <span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.agency}</strong><i><b style={{ width: `${Math.max(2, item.adjusted / maxAgency * 100)}%` }} /></i></div><p>{number(item.adjusted)}<small>ล้านบาท</small></p>
      </div>)}</div>
      <aside className="dashboard-sidefacts">
        <div><span>งบกลาง</span><strong>22.09%</strong><p>ของวงเงินทั้งชุด หรือ {number(829001.7117)} ล้านบาท</p></div>
        <div><span>5 หน่วยงานแรก</span><strong>50.28%</strong><p>สะท้อนว่าการตรวจหน่วยงานวงเงินสูงครอบคลุมงบได้รวดเร็วกว่าไล่ทุกแถวเท่ากัน</p></div>
        <div><span>รายการ 1% แรก</span><strong>80.3%</strong><p>ของวงเงินทั้งหมด จึงควรเปิดรายการก้อนใหญ่ก่อนแล้วค่อยขยายวง</p></div>
      </aside>
    </div>}

    {view === 'topics' && <div className="topic-dashboard">
      {bigData.themes.map((item) => <article key={item.id}>
        <header><span>{item.label}</span><strong>{number(item.rate, 1)}%</strong></header>
        <div className="topic-money"><b>{number(item.adjusted)}</b><small>ล้านบาท</small></div>
        <div className="topic-track"><i style={{ width: `${Math.max(2, item.adjusted / maxTheme * 100)}%` }} /></div>
        <footer><span>{number(item.rows)} แถว</span><a href={`#signals`} onClick={() => window.setTimeout(() => document.querySelector<HTMLInputElement>('.anomaly-search input')?.focus(), 400)}>ค้นรายการ ↓</a></footer>
      </article>)}
      <div className="topic-reading"><strong>วิธีอ่าน</strong><p>อัตรารวมสูงไม่ได้แปลว่าทุกรายการเดินดี และอัตรารวมต่ำไม่ได้สรุปว่าเกิดความเสียหาย ให้เปิดดูรายการย่อย การโอนวงเงิน PO สัญญา และผลตรวจรับประกอบกัน</p></div>
    </div>}

    {view === 'audit' && <div className="audit-dashboard">
      <div className="audit-matrix">{bigData.flags.map((flag, index) => <a href="#signals" key={flag.id}>
        <span>{String(index + 1).padStart(2, '0')}</span><div><strong>{flag.label}</strong><p>{flag.definition}</p></div><b>{number(flag.count)}</b><small>{number(flag.amount)} ล้านบาท</small>
      </a>)}</div>
      <aside className="audit-sequence">
        <span>ลำดับเปิดหลักฐาน</span>
        <ol><li><b>01</b>ยืนยันนิยามและช่วงตัดข้อมูล</li><li><b>02</b>เปิดคำอนุมัติและรายการโอน</li><li><b>03</b>เชื่อม TOR ราคากลาง และผู้ยื่นข้อเสนอ</li><li><b>04</b>เชื่อมสัญญา งวดงาน และการแก้ไขสัญญา</li><li><b>05</b>ตรวจผลส่งมอบ ตรวจรับ และผลลัพธ์</li></ol>
        <a href="#signals">เปิด {bigData.meta.candidateCount.toLocaleString('th-TH')} รายการที่จัดคิวแล้ว ↓</a>
      </aside>
    </div>}
  </section>
}

export default BudgetDashboard
