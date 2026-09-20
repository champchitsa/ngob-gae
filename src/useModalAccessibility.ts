import { useEffect, useRef, type RefObject } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type ElementState = {
  element: HTMLElement
  ariaHidden: string | null
  hadInert: boolean
}

function visibleFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false
    return window.getComputedStyle(element).display !== 'none' && window.getComputedStyle(element).visibility !== 'hidden'
  })
}

function isolateModal(container: HTMLElement) {
  const changed: ElementState[] = []
  let current: HTMLElement | null = container

  while (current?.parentElement) {
    const parentElement: HTMLElement = current.parentElement
    for (const sibling of Array.from(parentElement.children)) {
      if (sibling === current || !(sibling instanceof HTMLElement)) continue
      changed.push({
        element: sibling,
        ariaHidden: sibling.getAttribute('aria-hidden'),
        hadInert: sibling.hasAttribute('inert'),
      })
      sibling.setAttribute('aria-hidden', 'true')
      sibling.setAttribute('inert', '')
    }
    current = parentElement
    if (parentElement === document.body) break
  }

  return () => {
    for (const state of changed.reverse()) {
      if (state.ariaHidden === null) state.element.removeAttribute('aria-hidden')
      else state.element.setAttribute('aria-hidden', state.ariaHidden)
      if (!state.hadInert) state.element.removeAttribute('inert')
    }
  }
}

export function useModalAccessibility(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTarget = initialFocusRef.current ?? visibleFocusableElements(container)[0] ?? container
    focusTarget.focus({ preventScroll: true })
    const restoreIsolation = isolateModal(container)

    const keepFocusInside = (event: FocusEvent) => {
      if (event.target instanceof Node && !container.contains(event.target)) {
        const target = initialFocusRef.current ?? visibleFocusableElements(container)[0] ?? container
        target.focus({ preventScroll: true })
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = visibleFocusableElements(container)
      if (focusable.length === 0) {
        event.preventDefault()
        container.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('focusin', keepFocusInside)
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('focusin', keepFocusInside)
      document.removeEventListener('keydown', handleKeyDown, true)
      restoreIsolation()
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => previouslyFocused?.focus({ preventScroll: true }))
    }
  }, [containerRef, initialFocusRef, open])
}
