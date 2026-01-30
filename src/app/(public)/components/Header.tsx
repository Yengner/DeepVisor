import Link from "next/link";
import type { FC } from "react";
import { Button, Container } from "@/components/marketing";

const navItems = [
    { label: "Platform", href: "#platform" },
    { label: "Outcomes", href: "#outcomes" },
    { label: "Use cases", href: "#use-cases" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Support", href: "#support" },
];

const Header: FC = () => {
    return (
        <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/80 backdrop-blur">
            <Container className="flex items-center justify-between py-4">
                <Link href="/" className="flex items-center gap-2 text-white">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-semibold">
                        DV
                    </span>
                    <span className="text-sm font-semibold tracking-[0.08em] uppercase text-white/80">
                        DeepVisor
                    </span>
                </Link>

                <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-white/60 lg:flex" aria-label="Primary">
                    {navItems.map((item) => (
                        <Link key={item.label} href={item.href} className="transition hover:text-white">
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-3">
                    <Link
                        href="#cta"
                        className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:text-white md:inline-flex"
                    >
                        Contact
                    </Link>
                    <Button asChild size="sm" variant="primary">
                        <Link href="#support">Support</Link>
                    </Button>
                </div>
            </Container>
        </header>
    );
};

export default Header;
