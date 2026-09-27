import { Component, type PropsWithChildren } from 'react'

type State = { failed: boolean }

export default class LoadErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    if (!/dynamically imported module|module script failed|ChunkLoadError/i.test(error.message)) return
    try {
      const key = 'ngob-gae-last-chunk-reload'
      const lastReload = Number(sessionStorage.getItem(key) || 0)
      if (Date.now() - lastReload < 60_000) return
      sessionStorage.setItem(key, String(Date.now()))
      window.location.reload()
    } catch {
      // The visible reload button remains available when storage is disabled.
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <main className="load-error" role="alert">
      <span>งบแกะ</span>
      <h1>เปิดส่วนนี้ไม่สำเร็จ</h1>
      <p>อาจมีเว็บรุ่นใหม่ระหว่างที่เปิดหน้านี้อยู่ กรุณาโหลดหน้าใหม่</p>
      <button type="button" onClick={() => window.location.reload()}>โหลดหน้าใหม่</button>
    </main>
  }
}
