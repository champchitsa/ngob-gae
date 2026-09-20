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
  if (value === undefined || value === null) return 'ยังไม่พบยอดที่เชื่อมโยง'
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
      <div><span className="section-no">01 / STATE RESPONSIBILITY MAP</span><h2>จากงบประมาณ<br />ถึงผู้รับผิดชอบ</h2></div>
      <p>เลือกกระทรวงเพื่อดูหน่วยงานรับผิดชอบ วงเงิน ผลการใช้จ่าย และรายการที่ควรตรวจสอบต่อจากข้อมูล PBO ปี 2568</p>
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
        <div className="ministry-list-key"><span>จำนวนด้านขวา</span><strong>รายการที่ผ่านเกณฑ์คัดกรอง</strong></div>
      </aside>

      <article className="ministry-dossier">
        <header>
          <div><span>กระทรวงที่กำลังเปิด</span><h3>{selected.name}</h3></div>
          <button type="button" onClick={() => onInspectMinistry(selected.name)}>ดูรายการที่ผ่านเกณฑ์คัดกรอง <span>↓</span></button>
        </header>

        <div className="ministry-budget-cards">
          <div className="money-card"><span>วงเงินหลังโอน</span><strong>{money(selectedBudget?.adjusted)}</strong><small>PBO ปี 2568</small></div>
          <div><span>เบิกจ่ายรวมยอดผูกพัน (PO)</span><strong>{selectedBudget?.rate === null || selectedBudget?.rate === undefined ? 'ไม่พบข้อมูล' : `${number(selectedBudget.rate, 1)}%`}</strong><small>{selectedBudget ? money(selectedBudget.committed) : 'ยังไม่พบยอดที่เชื่อมโยง'}</small></div>
          <div><span>รายการที่ผ่านเกณฑ์คัดกรอง</span><strong>{number(selectedBudget?.candidateCount ?? 0)}</strong><small>วงเงินรวม {money(selectedBudget?.candidateAmount ?? 0)}</small></div>
          <div><span>เชื่อมหน่วยงานได้</span><strong>{linkedInMinistry}/{selected.departments.length}</strong><small>จับคู่จากชื่อที่ตรงกันหลังปรับ Unicode</small></div>
        </div>

        <div className="ministry-structure-band">
          <div className="structure-total"><span>ขนาดโครงสร้าง</span><strong>{number(selected.departmentCount)} หน่วยงาน</strong><b>{number(selected.divisionCount)} กองหรือหน่วยย่อย</b></div>
          {Object.entries(selected.typeCounts).filter(([, value]) => value > 0).map(([type, value]) => <div key={type}><strong>{number(value)}</strong><span>{typeLabels[type] ?? type}</span></div>)}
        </div>

        <div className="department-tools">
          <label><span>ค้นในกระทรวงนี้</span><input value={departmentQuery} onChange={(event) => { setDepartmentQuery(event.target.value); setDepartmentLimit(12) }} placeholder="ชื่อหน่วยงาน ภารกิจ หรือกอง" /></label>
          <label><span>เรียงตาม</span><select value={departmentSort} onChange={(event) => setDepartmentSort(event.target.value as DepartmentSort)}><option value="budget">วงเงินสูงสุด</option><option value="candidates">รายการคัดกรองมากที่สุด</option><option value="structure">จำนวนหน่วยย่อยมากที่สุด</option><option value="name">ชื่อหน่วยงาน</option></select></label>
          <div><strong>{number(departments.length)}</strong><span>หน่วยงานที่พบ</span></div>
        </div>

        <div className="department-list">
          {departments.slice(0, departmentLimit).map((department, index) => <article key={department.id}>
            <span className="department-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="department-copy"><div><small>{typeLabels[department.type]}</small><h4>{department.name}</h4></div><p>{department.description || 'เปิดหน้าต้นทางเพื่อดูภารกิจและโครงสร้างย่อย'}</p>{department.divisionPreview.length > 0 && <div className="division-preview">{department.divisionPreview.slice(0, 3).map((item) => <span key={item}>{item}</span>)}{department.divisionCount > 3 && <b>และอีก {number(department.divisionCount - 3)} หน่วยย่อย</b>}</div>}</div>
            <div className="department-budget">
              {department.pbo2568 ? <><strong>{money(department.pbo2568.adjusted)}</strong><span>เบิกจ่ายรวมยอดผูกพัน (PO) {department.pbo2568.rate === null ? 'ไม่พบข้อมูล' : `${number(department.pbo2568.rate, 1)}%`}</span><b>{number(department.pbo2568.candidateCount)} รายการที่ผ่านเกณฑ์คัดกรอง</b></> : <><strong>ยังไม่พบชื่อหน่วยงานที่ตรงกัน</strong><span>ระบบไม่รวมยอดจากชื่อที่ใกล้เคียงโดยอัตโนมัติ</span></>}
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
      <div><span>02</span><strong>ระบุผู้รับผิดชอบ</strong><p>แยกหน่วยงานหลัก หน่วยงานสนับสนุน ผู้กำกับ และผู้ประสานงาน</p></div>
      <div><span>03</span><strong>ตรวจเส้นทางงบประมาณ</strong><p>ดูวงเงินตั้งต้น หลังโอน ยอดผูกพัน การเบิกจ่าย และยอดคงเหลือ</p></div>
      <div><span>04</span><strong>ติดตามการจัดซื้อจัดจ้าง</strong><p>เชื่อม TOR ราคากลาง ผู้เสนอราคา สัญญา งวดงาน และผลตรวจรับ</p></div>
      <div><span>05</span><strong>ตรวจสอบผลลัพธ์</strong><p>เปรียบเทียบเงินที่ใช้กับบริการและประโยชน์ที่เกิดขึ้นจริง</p></div>
    </div>

    <div className="problem-lenses">
      <div><span>PROBLEM TO RESPONSIBILITY</span><h3>หนึ่งปัญหา<br />อาจเกี่ยวข้องหลายหน่วยงาน</h3><p>เริ่มจากปัญหาที่ประชาชนพบ ระบุหน่วยงานที่เกี่ยวข้อง แล้วตรวจเส้นทางงบประมาณ สัญญา และผลลัพธ์ที่เกิดขึ้นจริง</p></div>
      <div className="problem-cards">{data.issues.map((issue) => <a href={issue.sourceUrl} target="_blank" rel="noreferrer" key={issue.slug}><small>ตัวอย่างเส้นทางความรับผิดชอบ</small><strong>{issue.title}</strong><p>{issue.stats.ministryCount ? `${number(issue.stats.ministryCount)} กระทรวง` : 'เปิดดูหน่วยงานที่เกี่ยวข้อง'}{issue.stats.departmentCount ? ` • ${number(issue.stats.departmentCount)} กรมหรือสำนักงาน` : ''}</p><span>ดูหน่วยงานที่เกี่ยวข้อง ↗</span></a>)}</div>
    </div>

    <footer className="state-map-source">
      <p><strong>ที่มาและวิธีเชื่อม:</strong> {data.meta.method} ยอดงบประมาณและรายการคัดกรองคำนวณจาก PBO ปี 2568 ส่วนโครงสร้างหน่วยงานใช้ข้อมูลสาธารณะจาก Bureaucrazy Lab ตามวันที่ดึงข้อมูล</p>
      <div><a href={data.meta.structureSourceUrl} target="_blank" rel="noreferrer">ที่มาโครงสร้าง ↗</a><a href={data.meta.budgetSourceUrl} target="_blank" rel="noreferrer">ที่มางบประมาณ ↗</a><a href="/data/government-structure.json" download>ดาวน์โหลดข้อมูลเชื่อมโยง .JSON</a></div>
    </footer>
  </section>
}

export default GovernmentMap
