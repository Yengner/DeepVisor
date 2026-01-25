"use client";

import type { FC } from "react";

const Footer: FC = () => {
    return (
        <footer className="mt-16 border-t border-border bg-background">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium tracking-tight">
                        © {new Date().getFullYear()} DeepVisor.
                    </span>
                    <span>Exploring the future of small-business advertising.</span>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <button className="hover:text-foreground">Contact</button>
                    <button className="hover:text-foreground">For investors</button>
                    <button className="hover:text-foreground">Privacy</button>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
