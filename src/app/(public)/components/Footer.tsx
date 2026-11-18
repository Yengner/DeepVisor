import Link from "next/link";
import type { FC } from "react";
import { useTranslations } from "next-intl";
import { BrandLockup } from "@/components/brand/Brand";
import SpiderMascot from "@/components/brand/SpiderMascot";
import classes from "./Chrome.module.css";

const Footer: FC = () => {
  const t = useTranslations("public");
  const groups = [
    {
      title: t("footer.product"),
      links: [
        { label: t("nav.howItWorks"), href: "/#how-it-works" },
        { label: t("nav.features"), href: "/features" },
        { label: t("nav.vision"), href: "/vision" },
        { label: t("nav.faq"), href: "/#faq" },
        { label: t("nav.start"), href: "/sign-up" },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { label: t("nav.login"), href: "/login" },
        { label: t("footer.privacy"), href: "/privacy-policy" },
        { label: t("footer.terms"), href: "/terms-of-service" },
        { label: t("footer.contact"), href: "mailto:info@deepvisor.com" },
      ],
    },
  ];
  return (
    <footer className={classes.footer}>
      <div className={classes.footerInner}>
        <div className={classes.footerBrand}>
          <Link href="/" className={classes.brand} aria-label={t("nav.home")}><BrandLockup inverse /></Link>
          <p>{t("footer.tagline")}</p>
          <SpiderMascot state="sleep" size={64} tone="dark" className={classes.footerSpider} />
        </div>
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title} className={classes.footerGroup}>
            <h2>{group.title}</h2>
            <ul>
              {group.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("mailto:")
                    ? <a href={link.href}>{link.label}</a>
                    : <Link href={link.href}>{link.label}</Link>}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className={classes.footerBase}>
        <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
};

export default Footer;
