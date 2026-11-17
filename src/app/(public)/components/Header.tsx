"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FC } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Menu, X } from "lucide-react";
import { setPreferredLocaleAction } from "@/lib/server/actions/user/locale";
import { LOCALES } from "@/i18n/locales";
import { BrandLockup } from "@/components/brand/Brand";
import classes from "./Chrome.module.css";

const navItems = [
  { key: "howItWorks", href: "/#how-it-works" },
  { key: "features", href: "/features" },
  { key: "vision", href: "/vision", highlight: true },
  { key: "faq", href: "/#faq" },
] as const;

/** EN | ES for everyone; signed-in users also get it saved to their profile. */
function LanguageSwitch() {
  const t = useTranslations("public.nav");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={classes.lang} role="group" aria-label={t("language")}>
      {LOCALES.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={locale === l} disabled={pending}
          onClick={() => locale !== l && start(async () => { await setPreferredLocaleAction(l); router.refresh(); })}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

const Header: FC = () => {
  const t = useTranslations("public.nav");
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
        <Link href="/" className={classes.brand} aria-label={t("home")}>
          <BrandLockup inverse />
        </Link>

        <nav className={classes.nav} aria-label={t("primary")}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={classes.navLink} data-highlight={"highlight" in item || undefined}
              aria-current={pathname === item.href ? "page" : undefined}>
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className={classes.actions}>
          <LanguageSwitch />
          <Link href="/login" className={classes.login}>{t("login")}</Link>
          <Link href="/sign-up" className={classes.cta}>
            {t("start")} <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button ref={toggleRef} type="button" className={classes.menuButton}
            aria-expanded={open} aria-controls="public-mobile-menu" onClick={() => setOpen((value) => !value)}>
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            <span className={classes.srOnly}>{open ? t("closeMenu") : t("openMenu")}</span>
          </button>
        </div>
      </div>

      <nav id="public-mobile-menu" className={classes.mobileMenu} aria-label={t("mobilePrimary")} hidden={!open}>
        <ul>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(false)}
                aria-current={pathname === item.href ? "page" : undefined}>
                {t(item.key)}
              </Link>
            </li>
          ))}
          <li><Link href="/login" onClick={() => setOpen(false)}>{t("login")}</Link></li>
          <li className={classes.menuLang}><LanguageSwitch /></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;
