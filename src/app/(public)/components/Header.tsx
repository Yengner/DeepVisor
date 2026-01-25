"use client";

import type { FC } from "react";

const Header: FC = () => {
    return (
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary">
                        <span className="text-xs font-semibold tracking-tight">DV</span>
                    </div>
                    <span className="text-sm font-semibold tracking-tight">
                        DeepVisor
                    </span>
                </div>

                {/* Nav */}
                <nav className="hidden items-center gap-6 text-xs font-medium text-muted-foreground md:flex">
                    <button className="hover:text-foreground">Vision</button>
                    <button className="hover:text-foreground">For Businesses</button>
                    <button className="hover:text-foreground">For Supporters</button>
                    <button className="hover:text-foreground">FAQ</button>
                    <button className="rounded-full border border-border bg-secondary px-3 py-1 text-[11px] hover:bg-muted">
                        Join Early Access
                    </button>
                </nav>
            </div>
        </header>
    );
};

export default Header;
