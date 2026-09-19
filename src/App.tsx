import { useEffect, useMemo, useRef, useState } from 'react'
import { cases, corpusCollections, lawCards, methodology, sourceNotes, themes, type CaseFile, type ThemeId } from './data'

type DriveFile = {
  id: string
  title: string
  path: string
  category: string
  url: string
  size: number
  mimeType: string
}

type DriveInventory = {
  scannedAt: string
  rootUrl: string
  fileCount: number
  folderCount: number
  totalBytes: number
  files: DriveFile[]
}

type PboYear = { year: number; rows: number; act: number; adjusted: number; paid: number; paid_rate: number | null }
type PboHistory = { years: number; row_count: number; series: PboYear[] }

const formatMoney = (value: number) =>
  new Intl.NumberFormat('th-TH', { maximumFractionDigits: value < 100 ? 1 : 0 }).format(value)

const formatBytes = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} GB`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(value / 1000))} KB`
}

const statusIcon: Record<CaseFile['status'], string> = {
  gap: '◌',
  slow: '↘',
  transfer: '↗',
  detail: '≋',
  context: '◎',
}

function App() {
  const [activeTheme, setActiveTheme] = useState<ThemeId>('all')
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState(cases[0].id)
  const [panel, setPanel] = useState<'method' | 'law' | 'sources' | null>(null)
  const [copied, setCopied] = useState(false)
  const [inventory, setInventory] = useState<DriveInventory | null>(null)
  const [history, setHistory] = useState<PboHistory | null>(null)
  const [archiveQuery, setArchiveQuery] = useState('')
  const [archiveCategory, setArchiveCategory] = useState('all')
  const [archiveLimit, setArchiveLimit] = useState(18)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    fetch('/data/drive-inventory.json').then((response) => response.json()).then(setInventory).catch(() => undefined)
    fetch('/data/pbo-history.json').then((response) => response.json()).then(setHistory).catch(() => undefined)
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

  const archiveFiles = useMemo(() => {
    if (!inventory) return []
    const needle = archiveQuery.trim().toLocaleLowerCase('th')
    return inventory.files.filter((file) => {
      const categoryMatch = archiveCategory === 'all' || file.category === archiveCategory
      const queryMatch = !needle || `${file.title} ${file.path} ${file.category}`.toLocaleLowerCase('th').includes(needle)
      return categoryMatch && queryMatch
    })
  }, [inventory, archiveCategory, archiveQuery])

  useEffect(() => setArchiveLimit(18), [archiveCategory, archiveQuery])

  const maxHistoryBudget = Math.max(...(history?.series.map((item) => item.adjusted) ?? [1]))

  const copyBrief = async () => {
    const text = `${active.title}\nหน่วยงาน: ${active.agency}\nข้อสังเกต: ${active.lead}\n\nคำถามตรวจต่อ\n${active.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nเอกสารที่ควรขอ\n${active.requestDocs.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nที่มา: ${active.sourceUrl}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
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
          <button onClick={() => setPanel('method')}>วิธีแกะ</button>
          <button onClick={() => document.getElementById('archive')?.scrollIntoView()}>คลัง 694 ไฟล์</button>
          <button onClick={() => setPanel('law')}>ตัวบทกฎหมาย</button>
          <button onClick={() => setPanel('sources')}>แหล่งข้อมูล</button>
        </nav>
        <div className="data-stamp"><i /> DATA CUT 19.09.69</div>
      </header>

      <main id="top">
        <section className="masthead">
          <div className="mast-copy">
            <div className="kicker"><span>PUBLIC BUDGET WORKBENCH</span><span>ทดลองใช้</span></div>
            <h1>อย่าเริ่มจาก<br /><mark>“ผิดไหม”</mark><br />เริ่มจาก “หลักฐานอยู่ไหน”</h1>
            <p>เครื่องมือคัดกรองงบประมาณเพื่อเปลี่ยนตัวเลขก้อนใหญ่ให้เป็นคำถามที่ตรวจต่อได้ พร้อมร่องรอยข้อมูล เอกสารที่ควรขอ และขอบเขตทางกฎหมาย</p>
            <div className="hero-actions">
              <a className="primary-action" href="#workspace">เปิดโต๊ะแกะงบ <span>↓</span></a>
              <button className="text-action" onClick={() => setPanel('method')}>อ่านหลักคิด 4 ขั้น</button>
            </div>
          </div>
          <div className="evidence-board" role="region" aria-label="สรุปชุดข้อมูล">
            <div className="board-label">คลังหลักฐาน / สำรวจครบทั้ง Drive</div>
            <div className="big-number">694</div>
            <div className="number-caption">ไฟล์ใน 113 โฟลเดอร์ รวม 6.67 GB</div>
            <div className="tape tape-one">ไล่จากยอดรวมถึงเอกสารต้นทาง</div>
            <div className="board-grid">
              <div><strong>124</strong><span>workbook<br />เปิดอ่านครบ</span></div>
              <div><strong>{cases.length}</strong><span>แฟ้มวิเคราะห์<br />พร้อมคำถาม</span></div>
              <div><strong>5</strong><span>ฐานกฎหมาย<br />สำหรับตรวจต่อ</span></div>
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

        <section className="workspace" id="workspace">
          <div className="workspace-head">
            <div>
              <span className="section-no">01 / CASE DESK</span>
              <h2>โต๊ะแกะงบ</h2>
            </div>
            <p>เลือกประเด็นจากงาน แล้วไล่จากรายการที่ควรอ่านก่อน</p>
          </div>

          <div className="command-row">
            <label className="search-box">
              <span>⌕</span>
              <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหน่วยงาน โครงการ หรือคำสำคัญ" />
              <kbd>/</kbd>
            </label>
            <button className="download-button" onClick={downloadData}>ดาวน์โหลด {filtered.length} เคส .JSON</button>
          </div>

          <div className="theme-tabs" role="tablist" aria-label="กลุ่มประเด็น">
            {themes.map((theme) => {
              const count = theme.id === 'all' ? cases.length : cases.filter((item) => item.themes.includes(theme.id)).length
              return <button key={theme.id} className={activeTheme === theme.id ? 'active' : ''} onClick={() => setActiveTheme(theme.id)} role="tab" aria-selected={activeTheme === theme.id}><span>{theme.short}</span><small>{count}</small></button>
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
                <div className="score-head"><h4>ที่มาคะแนนคัดกรอง</h4><span>คะแนนสำหรับจัดคิวอ่าน</span></div>
                {Object.entries({ 'มูลค่า': active.score.value, 'การใช้จ่าย': active.score.execution, 'การโอน': active.score.movement, 'ความชัดเจน': active.score.clarity }).map(([label, value]) => <div className="score-line" key={label}><span>{label}</span><div><i style={{ width: `${value * 4}%` }} /></div><b>{value}/25</b></div>)}
              </section>

              <footer className="file-footer">
                <div><small>ความพร้อมของข้อมูล</small><strong>{active.completeness}</strong></div>
                <a href={active.sourceUrl} target="_blank" rel="noreferrer">เปิดหลักฐานต้นทาง ↗<small>{active.sourceLabel}</small></a>
              </footer>
            </article>
          </div>
        </section>

        <section className="archive" id="archive">
          <div className="workspace-head">
            <div><span className="section-no">02 / EVIDENCE ARCHIVE</span><h2>คลังหลักฐาน 694 ไฟล์</h2></div>
            <p>ค้นจากชื่อไฟล์ เส้นทาง และหมวดข้อมูลได้ทันที ทุกผลลัพธ์เปิดกลับไปยังไฟล์ต้นทางใน Drive</p>
          </div>

          <div className="corpus-stats" role="group" aria-label="ภาพรวมคลังข้อมูล">
            <div><strong>694</strong><span>ไฟล์ทั้งหมด</span></div>
            <div><strong>113</strong><span>โฟลเดอร์ที่สำรวจ</span></div>
            <div><strong>559</strong><span>เอกสาร PDF</span></div>
            <div><strong>124</strong><span>workbook ที่อ่านได้</span></div>
            <div><strong>856</strong><span>ชีตที่ตรวจโครงสร้าง</span></div>
            <div><strong>6.67 GB</strong><span>ขนาดรวมทั้งคลัง</span></div>
          </div>

          <div className="collection-grid">
            {corpusCollections.slice(1).map((collection) => (
              <button key={collection.id} className={archiveCategory === collection.id ? 'active' : ''} onClick={() => setArchiveCategory(collection.id)}>
                <small>{collection.label}</small><strong>{collection.files}</strong><span>ไฟล์ / ตาราง {collection.machine}</span><p>{collection.detail}</p><i>{collection.size}</i>
              </button>
            ))}
          </div>

          <div className="archive-layout">
            <div className="archive-browser">
              <div className="archive-toolbar">
                <label className="archive-search"><span>⌕</span><input value={archiveQuery} onChange={(event) => setArchiveQuery(event.target.value)} placeholder="ค้นชื่อไฟล์ หน่วยงาน พื้นที่ หรือปีงบประมาณ" /></label>
                <button className={archiveCategory === 'all' ? 'active' : ''} onClick={() => setArchiveCategory('all')}>ทุกหมวด</button>
                <a href="/data/drive-inventory.json" download>ดาวน์โหลดบัญชี .JSON</a>
              </div>
              <div className="archive-result-head"><strong>{archiveFiles.length.toLocaleString('th-TH')} ไฟล์</strong><span>สำรวจข้อมูล ณ 19 ก.ย. 2569</span></div>
              <div className="file-ledger">
                {inventory ? archiveFiles.slice(0, archiveLimit).map((file) => (
                  <a href={file.url} target="_blank" rel="noreferrer" key={file.id}>
                    <span className="file-type">{file.title.split('.').pop()?.slice(0, 5).toUpperCase() || 'FILE'}</span>
                    <span className="file-ledger-copy"><strong>{file.title}</strong><small>{file.path || file.category}</small></span>
                    <span className="file-size">{formatBytes(file.size)}<i>↗</i></span>
                  </a>
                )) : <div className="archive-loading">กำลังเปิดบัญชีหลักฐาน...</div>}
                {inventory && archiveFiles.length === 0 && <div className="archive-loading">ไม่พบไฟล์ที่ตรงคำค้น</div>}
              </div>
              {archiveLimit < archiveFiles.length && <button className="load-more" onClick={() => setArchiveLimit((value) => value + 30)}>แสดงเพิ่มอีก 30 ไฟล์</button>}
            </div>

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
            <div><span className="section-no">03 / METHOD</span><h2>กฎต้องอธิบายได้</h2></div>
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

      {panel && <div className="panel-backdrop" role="presentation" onMouseDown={() => setPanel(null)}>
        <aside className="info-panel" role="dialog" aria-modal="true" aria-label={panel === 'method' ? 'วิธีแกะ' : panel === 'law' ? 'ตัวบทกฎหมาย' : 'แหล่งข้อมูล'} onMouseDown={(event) => event.stopPropagation()}>
          <button className="panel-close" onClick={() => setPanel(null)} aria-label="ปิด">×</button>
          {panel === 'method' && <>
            <span className="panel-kicker">OPEN METHOD</span><h2>คะแนนเอาไว้จัดคิวอ่าน</h2>
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
            <p className="panel-intro">เปิดตัวบททางการพร้อมประเด็นที่ใช้ตรวจเรื่องความคุ้มค่า ความโปร่งใส การติดตามผล และสิทธิขอข้อมูล</p>
            <div className="law-card-list">{lawCards.map((law) => <a href={law.url} target="_blank" rel="noreferrer" key={law.code}><small>{law.code}</small><strong>{law.title}</strong><p>{law.note}</p><span>เปิดแหล่งทางการ ↗</span></a>)}</div>
          </>}
          {panel === 'sources' && <>
            <span className="panel-kicker">SOURCE LEDGER</span><h2>ทุกข้อสังเกตต้องย้อนกลับได้</h2>
            <p className="panel-intro">สำรวจ Drive ครบ 694 ไฟล์ เปิดอ่าน workbook ทั้ง 124 เล่ม และเก็บลิงก์ต้นทางไว้ในบัญชีค้นหา</p>
            <div className="source-list">{sourceNotes.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.label}><small>{source.label}</small><strong>{source.value}</strong><p>{source.detail}</p><span>เปิดต้นทาง ↗</span></a>)}</div>
            <div className="source-warning"><strong>เวอร์ชันข้อมูล</strong><p>บัญชีไฟล์และผลวิเคราะห์ชุดนี้จัดทำ ณ 19 กันยายน 2569 ตัวเลขแสดงความละเอียดเต็มในแฟ้มและปัดเฉพาะส่วนติดต่อผู้ใช้</p></div>
          </>}
        </aside>
      </div>}
    </div>
  )
}

export default App
