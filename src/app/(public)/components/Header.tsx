"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FC } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLockup } from "@/components/brand/Brand";
import classes from "./Chrome.module.css";

const navItems = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Features", href: "/features" },
  { label: "Vision", href: "/vision" },
  { label: "FAQ", href: "/#faq" },
];

const Header: FC = () => {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((value: boolean) => boolean)) =>
    setOpenOn((typeof next === 'function' ? next(open) : next) ? pathname : null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenOn(null);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={classes.header}>
      <div className={classes.bar}>
        <Link href="/" className={classes.brand} aria-label="DeepVisor home">
          <BrandLockup inverse />
        </Link>

        <nav className={classes.nav} aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={classes.navLink}
              aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={classes.actions}>
          <Link href="/login" className={classes.login}>Log in</Link>
          <Link href="/sign-up" className={classes.cta}>
            Start free beta <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button ref={toggleRef} type="button" className={classes.menuButton}
            aria-expanded={open} aria-controls="public-mobile-menu" onClick={() => setOpen((value) => !value)}>
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            <span className={classes.srOnly}>{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <nav id="public-mobile-menu" className={classes.mobileMenu} aria-label="Mobile primary" hidden={!open}>
        <ul>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(false)}
                aria-current={pathname === item.href ? "page" : undefined}>
                {item.label}
              </Link>
            </li>
          ))}
          <li><Link href="/login" onClick={() => setOpen(false)}>Log in</Link></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;
