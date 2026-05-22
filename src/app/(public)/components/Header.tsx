import Link from "next/link";
import type { FC } from "react";
import { Button, Container } from "@/components/marketing";

const navItems = [
    { label: "Overview", href: "/#top" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Features", href: "/features" },
];

const Header: FC = () => {
    return (
        <header className="sticky top-0 z-40 border-b border-blue-100/80 bg-white/90 shadow-[0_10px_34px_rgba(15,23,42,0.07)] backdrop-blur-xl">
            <Container className="flex items-center justify-between py-4">
                <Link href="/" className="flex items-center gap-2 text-slate-950">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-emerald-500 text-xs font-semibold text-white shadow-[0_12px_26px_rgba(37,99,235,0.22)]">
                        DV
                    </span>
                    <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-800">
                        DeepVisor
                    </span>
                </Link>

                <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 lg:flex" aria-label="Primary">
                    {navItems.map((item) => (
                        <Link key={item.label} href={item.href} className="transition hover:text-blue-700">
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-3">
                    <Link
                        href="/login"
                        className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-blue-700 sm:inline-flex"
                    >
                        Log in
                    </Link>
                    <Button
                        asChild
                        size="sm"
                        variant="primary"
                        className="from-blue-600 via-blue-500 to-emerald-500 text-white shadow-[0_14px_32px_rgba(37,99,235,0.2)]"
                    >
                        <Link href="/sign-up">Sign up</Link>
                    </Button>
                </div>
            </Container>
        </header>
    );
};

export default Header;
