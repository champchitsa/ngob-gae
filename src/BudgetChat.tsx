import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { AnomalyItem } from './bigData'

type Source = { label: string; detail: string; url: string }
type Message = { role: 'assistant' | 'user'; content: string; sources?: Source[] }

type BudgetChatProps = {
  activeItem: AnomalyItem
  items: AnomalyItem[]
  open: boolean
  onOpen: () => void
  onClose: () => void
  onSelectItem: (id: string) => void
}

const suggestions = [
  'งบ ICT รายการใดควรเปิดตรวจสอบก่อน',
  'กลุ่มงานก่อสร้างมีภาพรวมและจุดที่ควรถามต่ออย่างไร',
  'อธิบายรายการที่มีวงเงินเกิดใหม่หลัง พ.ร.บ.',
  'หากชื่อรายการกว้าง ควรขอเอกสารอะไรบ้าง',
]

const welcome: Message = {
  role: 'assistant',
  content: 'น้องเพนกวินช่วยค้นข้อมูลได้ทั้งภาพรวม หน่วยงาน โครงการ ตัวเลขที่ควรตรวจต่อ เอกสารที่ควรขอ และกฎหมายที่เกี่ยวข้อง โดยคำตอบจะเชื่อมกลับไปยังข้อมูลที่ใช้ทุกครั้ง',
}

function BudgetChat({ activeItem, items, open, onOpen, onClose, onSelectItem }: BudgetChatProps) {
  const [messages, setMessages] = useState<Message[]>([welcome])
  const [question, setQuestion] = useState('')
  const [itemQuery, setItemQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120)
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const matchingItems = useMemo(() => {
    const needle = itemQuery.trim().toLocaleLowerCase('th')
    return items
      .filter((item) => !needle || `${item.item} ${item.agency} ${item.ministry} ${item.project}`.toLocaleLowerCase('th').includes(needle))
      .slice(0, 200)
  }, [itemQuery, items])
  const activeItemIsListed = matchingItems.some((item) => item.id === activeItem.id)

  const ask = async (value = question) => {
    const nextQuestion = value.trim()
    if (!nextQuestion || loading) return
    const userMessage: Message = { role: 'user', content: nextQuestion }
    const history = [...messages, userMessage].slice(-6).map(({ role, content }) => ({ role, content }))
    setMessages((current) => [...current, userMessage])
    setQuestion('')
    setLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: nextQuestion,
          history,
          focusId: activeItem.id,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'ไม่สามารถประมวลผลคำถามได้')
      setMessages((current) => [...current, { role: 'assistant', content: payload.answer, sources: payload.sources }])
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อระบบถามตอบได้ กรุณาลองใหม่' }])
    } finally {
      setLoading(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void ask()
  }

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void ask()
    }
  }

  const selectItem = (id: string) => {
    onSelectItem(id)
    setMessages([welcome])
    setQuestion('')
    setItemQuery('')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  return <>
    <button className="chat-launcher" onClick={onOpen} aria-label="เปิดน้องเพนกวิน ผู้ช่วยถามตอบงบประมาณ"><span>AI</span><strong>ถามน้องเพนกวิน</strong></button>
    {open && <div className="chat-backdrop" onMouseDown={onClose}>
      <aside className="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="chat-head">
          <div><span>น้องเพนกวิน / BUDGET RESEARCH</span><h2 id="chat-title">ผู้ช่วยค้นคว้างบประมาณ</h2><p>ค้นคำตอบจากข้อมูลในงบแกะและแสดงหลักฐานที่เกี่ยวข้อง</p></div>
          <button onClick={onClose} aria-label="ปิดผู้ช่วยถามตอบ">×</button>
        </header>
        <div className="chat-focus">
          <label htmlFor="chat-budget-search">ค้นและเลือกรายการงบ ({items.length.toLocaleString('th-TH')} รายการ)</label>
          <input id="chat-budget-search" value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="พิมพ์ชื่อรายการ หน่วยงาน หรือโครงการ" />
          <select id="chat-budget-item" value={activeItem.id} onChange={(event) => selectItem(event.target.value)}>
            {!activeItemIsListed && <optgroup label="รายการที่เลือกอยู่"><option value={activeItem.id}>{activeItem.score} คะแนน | {activeItem.item} | {activeItem.agency}</option></optgroup>}
            <optgroup label={itemQuery ? `ผลค้นหา ${matchingItems.length.toLocaleString('th-TH')} รายการ` : 'รายการคะแนนสูงสุด 200 รายการ'}>
              {matchingItems.map((item) => <option value={item.id} key={item.id}>{item.score} คะแนน | {item.item} | {item.agency}</option>)}
            </optgroup>
          </select>
          <small>{itemQuery ? `พบและแสดงไม่เกิน 200 รายการ | ` : ''}{activeItem.agency} | หลังโอน {activeItem.adjusted.toLocaleString('th-TH')} ล้านบาท | คะแนน {activeItem.score}/100</small>
        </div>
        <div className="chat-messages" aria-live="polite">
          {messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
            <span>{message.role === 'assistant' ? 'น้องเพนกวิน' : 'คำถาม'}</span>
            <p>{message.content}</p>
            {!!message.sources?.length && <div className="chat-sources"><strong>หลักฐานที่ระบบค้นคืน</strong>{message.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={`${source.label}-${source.url}`}><span>{source.label}</span><small>{source.detail}</small><b>เปิดต้นทาง ↗</b></a>)}</div>}
          </article>)}
          {loading && <div className="chat-loading"><i /><span>กำลังค้นข้อมูลและเรียบเรียงคำตอบ</span></div>}
          <div ref={endRef} />
        </div>
        {messages.length === 1 && <div className="chat-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>}
        <form className="chat-form" onSubmit={submit}>
          <label htmlFor="budget-question">คำถามเกี่ยวกับงบประมาณ</label>
          <textarea id="budget-question" ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={handleKey} placeholder="เช่น งบสำนักงานประกันสังคมมีจุดใดที่ควรกระทบยอด" rows={3} maxLength={1800} />
          <div><small>Enter เพื่อส่งคำถาม และ Shift + Enter เพื่อขึ้นบรรทัดใหม่</small><button disabled={!question.trim() || loading} type="submit">{loading ? 'กำลังตอบ' : 'ส่งคำถาม'} <span>↗</span></button></div>
        </form>
        <footer className="chat-foot"><span>เทคโนโลยีภาษา Pathumma โดย NECTEC</span><span>ประมวลผลคลังเมื่อ 20 ก.ย. 2569</span></footer>
      </aside>
    </div>}
  </>
}

export default BudgetChat
