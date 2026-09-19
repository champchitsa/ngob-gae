import { useEffect, useMemo, useRef, useState } from 'react'
import { cases, lawCards, methodology, sourceNotes, themes, type CaseFile, type ThemeId } from './data'

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
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState(cases[0].id)
  const [panel, setPanel] = useState<'method' | 'law' | 'sources' | null>(null)
  const [copied, setCopied] = useState(false)
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
            <div className="board-label">แฟ้มตั้งต้น / FY 2568</div>
            <div className="big-number">241,159</div>
            <div className="number-caption">แถวที่อ่านจากฐาน PBO</div>
            <div className="tape tape-one">ต้องตรวจต่อ ≠ พบการทุจริต</div>
            <div className="board-grid">
              <div><strong>3.7527</strong><span>ล้านล้านบาท<br />วงเงินตาม พ.ร.บ.</span></div>
              <div><strong>15</strong><span>แฟ้มตัวอย่าง<br />พร้อมคำถาม</span></div>
              <div><strong>5</strong><span>ฐานกฎหมาย<br />สำหรับตรวจต่อ</span></div>
              <div><strong>2</strong><span>ชุดหลัก<br />PBO + สปส.</span></div>
            </div>
            <div className="scribble">ตัวเลขเป็นจุดเริ่ม<br />ไม่ใช่คำตัดสิน</div>
          </div>
        </section>

        <section className="principles" aria-label="หลักการใช้งาน">
          <div><span>01</span><strong>เห็นความต่าง</strong><p>เทียบตั้งต้น หลังโอน และผลเบิกจ่าย</p></div>
          <div><span>02</span><strong>เห็นช่องว่าง</strong><p>แยกข้อมูลไม่ครบออกจากยอดศูนย์</p></div>
          <div><span>03</span><strong>ตามเอกสาร</strong><p>ไปต่อถึง TOR สัญญา งวดงาน และผลลัพธ์</p></div>
          <div><span>04</span><strong>ถามอย่างเป็นธรรม</strong><p>ธงความเสี่ยงเป็นจุดเริ่ม ไม่ใช่ข้อกล่าวหา</p></div>
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
                  <h4>อย่าเพิ่งสรุปว่า</h4>
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
                <div className="score-head"><h4>ที่มาคะแนนคัดกรอง</h4><span>ใช้จัดคิวอ่าน ไม่ใช่คะแนนทุจริต</span></div>
                {Object.entries({ 'มูลค่า': active.score.value, 'การใช้จ่าย': active.score.execution, 'การโอน': active.score.movement, 'ความชัดเจน': active.score.clarity }).map(([label, value]) => <div className="score-line" key={label}><span>{label}</span><div><i style={{ width: `${value * 4}%` }} /></div><b>{value}/25</b></div>)}
              </section>

              <footer className="file-footer">
                <div><small>ความพร้อมของข้อมูล</small><strong>{active.completeness}</strong></div>
                <a href={active.sourceUrl} target="_blank" rel="noreferrer">เปิดหลักฐานต้นทาง ↗<small>{active.sourceLabel}</small></a>
              </footer>
            </article>
          </div>
        </section>

        <section className="method-preview">
          <div className="workspace-head inverse">
            <div><span className="section-no">02 / METHOD</span><h2>กฎต้องอธิบายได้</h2></div>
            <p>เครื่องมือสาธารณะควรเปิดทั้งสูตร ข้อจำกัด และทางกลับไปยังต้นฉบับ</p>
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
        <p>ต้นแบบเพื่อการเรียนรู้และตรวจสอบเชิงสาธารณะ<br />ข้อมูลชี้เป้าคำถาม ไม่ใช่ข้อวินิจฉัยทางกฎหมาย</p>
        <div><a href="https://github.com/champchitsa/ngob-gae" target="_blank" rel="noreferrer">GitHub ↗</a><span>สร้างสำหรับ OPEN DATA HACK 2569</span></div>
      </footer>

      {panel && <div className="panel-backdrop" role="presentation" onMouseDown={() => setPanel(null)}>
        <aside className="info-panel" role="dialog" aria-modal="true" aria-label={panel === 'method' ? 'วิธีแกะ' : panel === 'law' ? 'ตัวบทกฎหมาย' : 'แหล่งข้อมูล'} onMouseDown={(event) => event.stopPropagation()}>
          <button className="panel-close" onClick={() => setPanel(null)} aria-label="ปิด">×</button>
          {panel === 'method' && <>
            <span className="panel-kicker">OPEN METHOD</span><h2>คะแนนเอาไว้จัดคิวอ่าน</h2>
            <p className="panel-intro">คะแนน 100 แบ่งเป็น 4 มิติ มิติละ 25 คะแนน ได้แก่ มูลค่า ความผิดปกติของอัตราใช้จ่าย ขนาดการโอนเปลี่ยนแปลง และความชัดเจนของข้อมูล กฎแต่ละข้อเป็นสัญญาณให้ตรวจต่อเท่านั้น</p>
            <div className="formula"><span>PRIORITY</span><b>มูลค่า + การใช้จ่าย + การโอน + ความชัดเจน</b><small>สูงสุด 25 + 25 + 25 + 25 = 100</small></div>
            <h3>ข้อจำกัดที่ต้องเห็นพร้อมผล</h3>
            <ul className="panel-list"><li>ยอดว่างหรือศูนย์ในแถว PBO อาจเป็นช่องว่างของการรายงาน ไม่ยืนยันว่าไม่มีการเบิกจ่าย</li><li>กลุ่ม ICT ก่อสร้าง และอบรมเกิดจากคำสำคัญ อาจมีทั้งการนับเกินและนับขาด</li><li>อัตราเบิกจ่ายต่ำอาจอธิบายได้ด้วยงวดงาน สัญญาหลายปี การอุทธรณ์ หรือการประหยัดงบ</li><li>ตัวเลขรวมต้องเชื่อม TOR ผู้ชนะ สัญญา การส่งมอบ และผลลัพธ์ก่อนประเมินความคุ้มค่า</li></ul>
            <h3>แนวคิดจากงานตรวจสอบข้อมูลสากล</h3>
            <p>ออกแบบตามหลัก red flags ของ Open Contracting ที่ย้ำว่าธงคือเหตุให้ตรวจต่อ ไม่ใช่หลักฐานการทุจริต และตามแนวทางของ USAspending ที่ให้ผู้ใช้เจาะจากภาพรวมไปถึงรายการและดาวน์โหลดข้อมูลได้</p>
            <a className="panel-link" href="https://www.open-contracting.org/resources/red-flags-in-public-procurement-a-guide-to-using-data-to-detect-and-mitigate-risks/" target="_blank" rel="noreferrer">อ่านคู่มือ Open Contracting ↗</a>
          </>}
          {panel === 'law' && <>
            <span className="panel-kicker">LEGAL LENS</span><h2>กฎหมายคือกรอบถาม ไม่ใช่เครื่องตัดสินอัตโนมัติ</h2>
            <p className="panel-intro">สรุปต่อไปนี้ใช้ช่วยวางแนวตรวจสอบ ควรเปิดตัวบทและข้อเท็จจริงเต็มก่อนให้ความเห็นทางกฎหมาย</p>
            <div className="law-card-list">{lawCards.map((law) => <a href={law.url} target="_blank" rel="noreferrer" key={law.code}><small>{law.code}</small><strong>{law.title}</strong><p>{law.note}</p><span>เปิดแหล่งทางการ ↗</span></a>)}</div>
          </>}
          {panel === 'sources' && <>
            <span className="panel-kicker">SOURCE LEDGER</span><h2>ทุกข้อสังเกตต้องย้อนกลับได้</h2>
            <p className="panel-intro">ต้นแบบใช้ข้อมูลที่ผู้จัดงานรวบรวมและแหล่งทางการของรัฐ โดยเก็บตัวเลขดิบไว้ครบความละเอียดก่อนปัดเพื่อแสดงผล</p>
            <div className="source-list">{sourceNotes.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.label}><small>{source.label}</small><strong>{source.value}</strong><p>{source.detail}</p><span>เปิดต้นทาง ↗</span></a>)}</div>
            <div className="source-warning"><strong>เวอร์ชันข้อมูล</strong><p>วิเคราะห์ ณ 19 กันยายน 2569 จากไฟล์ PBO ปี 2568 และรายงาน สปส. ปี 2567 ที่อยู่ในโฟลเดอร์ OPEN Data ของงาน ผลอาจเปลี่ยนเมื่อเจ้าของข้อมูลปรับปรุงไฟล์</p></div>
          </>}
        </aside>
      </div>}
    </div>
  )
}

export default App
