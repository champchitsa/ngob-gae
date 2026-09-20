import { useEffect, useState, type RefObject } from 'react'

export function useNearViewport(ref: RefObject<Element | null>, rootMargin = '1000px') {
  const [isNear, setIsNear] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (!('IntersectionObserver' in window)) {
      setIsNear(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setIsNear(true)
      observer.disconnect()
    }, { rootMargin })

    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, rootMargin])

  return isNear
}
