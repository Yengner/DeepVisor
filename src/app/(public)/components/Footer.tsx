import Link from "next/link";
import type { FC } from "react";
import { BrandLockup } from "@/components/brand/Brand";
import SpiderMascot from "@/components/brand/SpiderMascot";
import classes from "./Chrome.module.css";

const groups = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/features" },
      { label: "Vision", href: "/vision" },
      { label: "FAQ", href: "/#faq" },
      { label: "Start free beta", href: "/sign-up" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Service", href: "/terms-of-service" },
      { label: "Contact", href: "mailto:info@deepvisor.com" },
    ],
  },
];

const Footer: FC = () => (
  <footer className={classes.footer}>
    <div className={classes.footerInner}>
      <div className={classes.footerBrand}>
        <Link href="/" className={classes.brand} aria-label="DeepVisor home"><BrandLockup inverse /></Link>
        <p>Advertising, made simpler for every business.</p>
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
      <p>© {new Date().getFullYear()} DeepVisor LLC. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
