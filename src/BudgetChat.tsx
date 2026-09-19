import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { AnomalyItem } from './bigData'

type Source = { label: string; detail: string; url: string }
type Message = { role: 'assistant' | 'user'; content: string; sources?: Source[] }

type BudgetChatProps = {
  activeItem: AnomalyItem
  open: boolean
  onOpen: () => void
  onClose: () => void
}

const suggestions = [
  'งบ ICT รายการใดควรเปิดตรวจสอบก่อน',
  'กลุ่มงานก่อสร้างมีภาพรวมและจุดที่ควรถามต่ออย่างไร',
  'อธิบายรายการที่มีวงเงินเกิดใหม่หลัง พ.ร.บ.',
  'หากชื่อรายการกว้าง ควรขอเอกสารอะไรบ้าง',
]

const welcome: Message = {
  role: 'assistant',
  content: 'สอบถามข้อมูลจากงบแกะได้ทั้งภาพรวม หน่วยงาน โครงการ ตัวเลขผิดสังเกต เอกสารที่ควรขอ และกฎหมายที่เกี่ยวข้อง คำตอบจะอ้างกลับไปยังข้อมูลที่ใช้ทุกครั้ง',
}

function BudgetChat({ activeItem, open, onOpen, onClose }: BudgetChatProps) {
  const [messages, setMessages] = useState<Message[]>([welcome])
  const [question, setQuestion] = useState('')
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

  return <>
    <button className="chat-launcher" onClick={onOpen} aria-label="เปิดผู้ช่วยถามตอบงบประมาณ"><span>AI</span><strong>ถามงบแกะ</strong></button>
    {open && <div className="chat-backdrop" onMouseDown={onClose}>
      <aside className="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="chat-head">
          <div><span>PATHUMMA / BUDGET RAG</span><h2 id="chat-title">ผู้ช่วยค้นคว้างบประมาณ</h2><p>ค้นคำตอบจากข้อมูลในงบแกะและแสดงหลักฐานที่เกี่ยวข้อง</p></div>
          <button onClick={onClose} aria-label="ปิดผู้ช่วยถามตอบ">×</button>
        </header>
        <div className="chat-focus"><span>รายการที่กำลังเปิด</span><strong>{activeItem.item}</strong><small>{activeItem.agency}</small></div>
        <div className="chat-messages" aria-live="polite">
          {messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
            <span>{message.role === 'assistant' ? 'ปทุมมา' : 'คำถาม'}</span>
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
        <footer className="chat-foot"><span>ประมวลผลด้วย Pathumma โดย NECTEC</span><span>อ้างอิงข้อมูล ณ 19 ก.ย. 2569</span></footer>
      </aside>
    </div>}
  </>
}

export default BudgetChat
