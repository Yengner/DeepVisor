"use client";

import Link from "next/link";
import { ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import { usePathname } from "next/navigation";
import type { FC } from "react";
import { Container } from "@/components/marketing";

const navItems = [
    { label: "Overview", href: "/#top", match: "/" },
    { label: "Workflow", href: "/#how-it-works", match: "/#how-it-works" },
    { label: "Features", href: "/features", match: "/features" },
];

const Header: FC = () => {
    const pathname = usePathname();

    return (
        <header className="dv-public-header sticky top-0 z-40 border-b border-white/15 bg-[#0d0f0d] text-white">
            <Container className="flex h-14 items-center justify-between gap-4">
                <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="DeepVisor home">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#c8ff56]/40 bg-[#c8ff56] text-[#0d0f0d] transition-transform group-hover:-translate-y-px">
                        <ChartNoAxesCombined className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-white">
                        DeepVisor
                    </span>
                </Link>

                <nav className="hidden h-full items-center text-xs font-medium text-white/65 md:flex" aria-label="Primary">
                    {navItems.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            aria-current={pathname === item.match ? "page" : undefined}
                            className="dv-public-nav-link relative flex h-full items-center px-3 transition-colors hover:text-white aria-[current=page]:text-[#c8ff56]"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    <Link
                        href="/login"
                        className="hidden px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:text-white sm:inline-flex"
                    >
                        Log in
                    </Link>
                    <Link
                        href="/sign-up"
                        className="dv-public-header-cta inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#c8ff56] px-3.5 text-xs font-semibold text-[#0d0f0d] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ff56] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f0d]"
                        aria-label="Start free"
                    >
                        <span className="dv-public-header-cta-label">Start free</span>
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                </div>
            </Container>

            <nav className="dv-public-mobile-nav border-t border-white/10 md:hidden" aria-label="Mobile primary">
                <Container className="flex h-10 items-center gap-1 overflow-x-auto">
                    {navItems.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            aria-current={pathname === item.match ? "page" : undefined}
                            className="shrink-0 rounded-sm px-3 py-1.5 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-[#c8ff56]"
                        >
                            {item.label}
                        </Link>
                    ))}
                    <Link href="/login" className="ml-auto shrink-0 rounded-sm px-3 py-1.5 text-[11px] font-medium text-white/60 hover:bg-white/10 hover:text-white sm:hidden">
                        Log in
                    </Link>
                </Container>
            </nav>
        </header>
    );
};

export default Header;
