'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * `seen` turns true the first time the element scrolls into view (entrance plays once);
 * `visible` follows the viewport so looping motion can pause off-screen.
 */
export function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    }, { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, seen, visible };
}
