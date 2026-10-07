'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import classes from './Product.module.css';
export default function Disclosure({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const reveal = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const target = document.getElementById(hash);
      if (target && ref.current?.contains(target)) {
        ref.current.open = true;
        requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
      }
    };
    reveal(); window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, []);
  return <details id={id} ref={ref} className={classes.disclosure}><summary>{title}</summary>{children}</details>;
}
