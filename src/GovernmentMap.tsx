import { useEffect, useMemo, useState } from 'react'

type BudgetLink = {
  rows: number
  act: number
  adjusted: number
  committed: number
  rate: number | null
  candidateCount: number
  candidateAmount: number
}

type Department = {
  id: number
  name: string
  description: string
  type: 'regular' | 'stateEnterprise' | 'publicOrganization' | 'other'
  divisionCount: number
  divisionPreview: string[]
  sourceUrl: string
  pbo2568: BudgetLink | null
}

type Ministry = {
  id: number
  name: string
  departmentCount: number
  divisionCount: number
  totalSubunits: number
  typeCounts: Record<string, number>
  sourceUrl: string
  pbo2568: BudgetLink | null
  departments: Department[]
}

type StructureData = {
  meta: {
    structureSource: string
    structureSourceUrl: string
    structureRetrieved: string
    budgetSource: string
    budgetSourceUrl: string
    budgetYear: number
    method: string
    ministries: number
    departments: number
    divisions: number
    linkedDepartments: number
  }
  issues: {
    slug: string
    title: string
    stats: { ministryCount?: number; departmentCount?: number; divisionCount?: number }
    sourceUrl: string
  }[]
  ministries: Ministry[]
}

type DepartmentSort = 'budget' | 'candidates' | 'structure' | 'name'

const typeLabels: Record<string, string> = {
  regular: 'กรมและสำนักงาน',
  stateEnterprise: 'รัฐวิสาหกิจ',
  publicOrganization: 'องค์การมหาชน',
  other: 'หน่วยงานรูปแบบอื่น',
}

const number = (value: number, digits = 0) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: digits }).format(value)

const money = (value?: number | null) => {
  if (value === undefined || value === null) return 'ยังไม่เชื่อมยอด'
  if (value >= 1_000_000) return `${number(value / 1_000_000, 3)} ล้านล้านบาท`
  if (value >= 1_000) return `${number(value / 1_000, 1)} พันล้านบาท`
  return `${number(value, 1)} ล้านบาท`
}

function GovernmentMap({ onInspectMinistry }: { onInspectMinistry: (ministry: string) => void }) {
  const [data, setData] = useState<StructureData | null>(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [ministryQuery, setMinistryQuery] = useState('')
  const [departmentQuery, setDepartmentQuery] = useState('')
  const [departmentSort, setDepartmentSort] = useState<DepartmentSort>('budget')
  const [departmentLimit, setDepartmentLimit] = useState(12)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/data/government-structure.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('เปิดแผนที่โครงสร้างรัฐไม่สำเร็จ')
        return response.json()
      })
      .then((payload: StructureData) => {
        setData(payload)
        setSelectedId(payload.ministries[0]?.id ?? null)
      })
      .catch((requestError) => {
        if ((requestError as Error).name !== 'AbortError') setError(requestError instanceof Error ? requestError.message : 'เปิดข้อมูลไม่สำเร็จ')
      })
    return () => controller.abort()
  }, [])

  const ministries = useMemo(() => {
    const needle = ministryQuery.trim().toLocaleLowerCase('th')
    return (data?.ministries ?? []).filter((item) => !needle || item.name.toLocaleLowerCase('th').includes(needle))
  }, [data, ministryQuery])

  const selected = data?.ministries.find((item) => item.id === selectedId) ?? data?.ministries[0]
  const departments = useMemo(() => {
    const needle = departmentQuery.trim().toLocaleLowerCase('th')
    const matches = (selected?.departments ?? []).filter((item) => !needle || [item.name, item.description, ...item.divisionPreview].join(' ').toLocaleLowerCase('th').includes(needle))
    return [...matches].sort((a, b) => {
      if (departmentSort === 'candidates') return (b.pbo2568?.candidateCount ?? -1) - (a.pbo2568?.candidateCount ?? -1) || (b.pbo2568?.adjusted ?? -1) - (a.pbo2568?.adjusted ?? -1)
      if (departmentSort === 'structure') return b.divisionCount - a.divisionCount || a.name.localeCompare(b.name, 'th')
      if (departmentSort === 'name') return a.name.localeCompare(b.name, 'th')
      return (b.pbo2568?.adjusted ?? -1) - (a.pbo2568?.adjusted ?? -1) || a.name.localeCompare(b.name, 'th')
    })
  }, [departmentQuery, departmentSort, selected])

  useEffect(() => {
    setDepartmentQuery('')
    setDepartmentLimit(12)
  }, [selectedId])

  if (error) return <section className="state-map state-map-error" id="state-map"><strong>แผนที่โครงสร้างรัฐยังเปิดไม่ได้</strong><p>{error}</p></section>
  if (!data || !selected) return <section className="state-map state-map-loading" id="state-map">กำลังเชื่อมโครงสร้างรัฐกับข้อมูลงบประมาณ</section>

  const linkedInMinistry = selected.departments.filter((item) => item.pbo2568).length
  const selectedBudget = selected.pbo2568

  return <section className="state-map" id="state-map">
    <div className="state-map-heading">
      <div><span className="section-no">01 / STATE RESPONSIBILITY MAP</span><h2>เงินอยู่ที่ไหน<br />ใครต้องตอบ</h2></div>
      <p>เลือกกระทรวงเพื่อดูโครงสร้างหน่วยงานจาก Bureaucrazy Lab ควบคู่กับวงเงิน ผลใช้จ่าย และรายการที่ระบบจัดคิวตรวจจาก PBO ปี 2568</p>
    </div>

    <div className="state-map-proof" role="group" aria-label="ขอบเขตแผนที่โครงสร้างรัฐ">
      <div><strong>{number(data.meta.ministries)}</strong><span>กลุ่มระดับกระทรวง</span></div>
      <div><strong>{number(data.meta.departments)}</strong><span>หน่วยงานในโครงสร้าง</span></div>
      <div><strong>{number(data.meta.divisions)}</strong><span>กองหรือหน่วยย่อย</span></div>
      <div><strong>{number(data.meta.linkedDepartments)}</strong><span>หน่วยงานที่เชื่อมยอด PBO ได้ตรงชื่อ</span></div>
    </div>

    <div className="state-map-grid">
      <aside className="ministry-picker">
        <label><span>ค้นและเลือกกระทรวง</span><input value={ministryQuery} onChange={(event) => setMinistryQuery(event.target.value)} placeholder="พิมพ์ชื่อกระทรวง" /></label>
        <div className="ministry-list" role="listbox" aria-label="รายชื่อกระทรวง">
          {ministries.map((item) => <button key={item.id} type="button" role="option" aria-selected={selected.id === item.id} className={selected.id === item.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>
            <span>{item.name}</span><small>{item.pbo2568 ? money(item.pbo2568.adjusted) : `${number(item.departmentCount)} หน่วยงาน`}</small><b>{number(item.pbo2568?.candidateCount ?? 0)}</b>
          </button>)}
          {!ministries.length && <p>ไม่พบชื่อกระทรวงที่ค้น</p>}
        </div>
        <div className="ministry-list-key"><span>ตัวเลขขวา</span><strong>รายการที่ถูกจัดคิวตรวจ</strong></div>
      </aside>

      <article className="ministry-dossier">
        <header>
          <div><span>กระทรวงที่กำลังเปิด</span><h3>{selected.name}</h3></div>
          <button type="button" onClick={() => onInspectMinistry(selected.name)}>เปิดรายการที่ควรตรวจ <span>↓</span></button>
        </header>

        <div className="ministry-budget-cards">
          <div className="money-card"><span>วงเงินหลังโอน</span><strong>{money(selectedBudget?.adjusted)}</strong><small>PBO ปี 2568</small></div>
          <div><span>เบิกจ่ายรวม PO</span><strong>{selectedBudget?.rate === null || selectedBudget?.rate === undefined ? 'ไม่มีค่า' : `${number(selectedBudget.rate, 1)}%`}</strong><small>{selectedBudget ? money(selectedBudget.committed) : 'ยังไม่เชื่อมยอด'}</small></div>
          <div><span>รายการจัดคิวตรวจ</span><strong>{number(selectedBudget?.candidateCount ?? 0)}</strong><small>วงเงินรวม {money(selectedBudget?.candidateAmount ?? 0)}</small></div>
          <div><span>เชื่อมหน่วยงานได้</span><strong>{linkedInMinistry}/{selected.departments.length}</strong><small>จับคู่จากชื่อที่ตรงกันหลังปรับ Unicode</small></div>
        </div>

        <div className="ministry-structure-band">
          <div className="structure-total"><span>ขนาดโครงสร้าง</span><strong>{number(selected.departmentCount)} หน่วยงาน</strong><b>{number(selected.divisionCount)} กองหรือหน่วยย่อย</b></div>
          {Object.entries(selected.typeCounts).filter(([, value]) => value > 0).map(([type, value]) => <div key={type}><strong>{number(value)}</strong><span>{typeLabels[type] ?? type}</span></div>)}
        </div>

        <div className="department-tools">
          <label><span>ค้นในกระทรวงนี้</span><input value={departmentQuery} onChange={(event) => { setDepartmentQuery(event.target.value); setDepartmentLimit(12) }} placeholder="ชื่อหน่วยงาน ภารกิจ หรือกอง" /></label>
          <label><span>เรียงตาม</span><select value={departmentSort} onChange={(event) => setDepartmentSort(event.target.value as DepartmentSort)}><option value="budget">วงเงินสูงก่อน</option><option value="candidates">รายการจัดคิวมากก่อน</option><option value="structure">หน่วยย่อยมากก่อน</option><option value="name">ชื่อหน่วยงาน</option></select></label>
          <div><strong>{number(departments.length)}</strong><span>หน่วยงานที่พบ</span></div>
        </div>

        <div className="department-list">
          {departments.slice(0, departmentLimit).map((department, index) => <article key={department.id}>
            <span className="department-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="department-copy"><div><small>{typeLabels[department.type]}</small><h4>{department.name}</h4></div><p>{department.description || 'เปิดหน้าต้นทางเพื่อดูภารกิจและโครงสร้างย่อย'}</p>{department.divisionPreview.length > 0 && <div className="division-preview">{department.divisionPreview.slice(0, 3).map((item) => <span key={item}>{item}</span>)}{department.divisionCount > 3 && <b>และอีก {number(department.divisionCount - 3)} หน่วยย่อย</b>}</div>}</div>
            <div className="department-budget">
              {department.pbo2568 ? <><strong>{money(department.pbo2568.adjusted)}</strong><span>เบิกจ่ายรวม PO {department.pbo2568.rate === null ? 'ไม่มีค่า' : `${number(department.pbo2568.rate, 1)}%`}</span><b>{number(department.pbo2568.candidateCount)} รายการจัดคิวตรวจ</b></> : <><strong>ยังไม่พบชื่อคู่ตรง</strong><span>ไม่รวมยอดด้วยการเดาจากชื่อคล้าย</span></>}
              <a href={department.sourceUrl} target="_blank" rel="noreferrer">ดูโครงสร้างต้นทาง ↗</a>
            </div>
          </article>)}
          {!departments.length && <div className="department-empty">ไม่พบหน่วยงานหรือภารกิจที่ค้น</div>}
        </div>
        {departments.length > departmentLimit && <button className="department-more" type="button" onClick={() => setDepartmentLimit((value) => value + 12)}>แสดงเพิ่มอีก {Math.min(12, departments.length - departmentLimit)} หน่วยงาน</button>}
      </article>
    </div>

    <div className="responsibility-route">
      <div><span>01</span><strong>เริ่มจากปัญหา</strong><p>ระบุเหตุการณ์ พื้นที่ หรือบริการที่ประชาชนได้รับผล</p></div>
      <div><span>02</span><strong>หาเจ้าภาพ</strong><p>แยกหน่วยงานหลัก ผู้สนับสนุน ผู้กำกับ และผู้ประสาน</p></div>
      <div><span>03</span><strong>เปิดเส้นเงิน</strong><p>ดูตั้งต้น หลังโอน PO เบิกจ่าย และยอดคงเหลือ</p></div>
      <div><span>04</span><strong>ตามสัญญา</strong><p>เชื่อม TOR ราคากลาง ผู้เสนอราคา งวดงาน และผลตรวจรับ</p></div>
      <div><span>05</span><strong>ถามผลลัพธ์</strong><p>เทียบสิ่งที่จ่ายกับบริการและประโยชน์ที่เกิดขึ้นจริง</p></div>
    </div>

    <div className="problem-lenses">
      <div><span>PROBLEM TO POWER</span><h3>ปัญหาหนึ่งเรื่อง<br />อาจมีหลายเจ้าภาพ</h3><p>ตัวอย่างจาก Bureaucrazy Lab ช่วยชี้ว่าการตรวจงบต้องมองความเชื่อมโยงระหว่างหน่วยงาน ไม่หยุดที่ชื่อกระทรวงเดียว</p></div>
      <div className="problem-cards">{data.issues.map((issue) => <a href={issue.sourceUrl} target="_blank" rel="noreferrer" key={issue.slug}><small>กรณีศึกษาโครงสร้างรัฐ</small><strong>{issue.title}</strong><p>{issue.stats.ministryCount ? `${number(issue.stats.ministryCount)} กระทรวง` : 'เปิดดูหน่วยงานที่เกี่ยวข้อง'}{issue.stats.departmentCount ? ` • ${number(issue.stats.departmentCount)} กรมหรือสำนักงาน` : ''}</p><span>เปิดแผนผังต้นทาง ↗</span></a>)}</div>
    </div>

    <footer className="state-map-source">
      <p><strong>วิธีเชื่อมข้อมูล:</strong> {data.meta.method} ยอดงบประมาณและรายการคัดกรองคำนวณจาก PBO ปี 2568 ส่วนจำนวนหน่วยงานและหน่วยย่อยมาจาก Bureaucrazy Lab ตามวันที่ดึงข้อมูล</p>
      <div><a href={data.meta.structureSourceUrl} target="_blank" rel="noreferrer">Bureaucrazy Lab ↗</a><a href={data.meta.budgetSourceUrl} target="_blank" rel="noreferrer">PBO 2568 ↗</a><a href="/data/government-structure.json" download>ดาวน์โหลดข้อมูลเชื่อมโยง .JSON</a></div>
    </footer>
  </section>
}

export default GovernmentMap
