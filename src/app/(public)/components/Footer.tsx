import Link from "next/link";
import type { FC } from "react";
import { Container } from "@/components/marketing";

const Footer: FC = () => {
    return (
        <footer className="border-t border-blue-100 bg-[radial-gradient(circle_at_12%_0%,rgba(37,99,235,0.1),transparent_30%),radial-gradient(circle_at_84%_0%,rgba(16,185,129,0.09),transparent_24%),linear-gradient(180deg,#ffffff_0%,#f7f9fc_100%)] text-slate-600">
            <Container className="flex flex-col gap-6 py-4 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-950">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 via-blue-500 to-emerald-500 text-[10px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)]">
                            DV
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-800">
                            <a href="https://deepvisor.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-blue-700">
                            DeepVisor
                            </a>
                        </span>
                    </div>
              
                    <p className="text-[11px] text-slate-400">
                        © {new Date().getFullYear()} DeepVisor. All rights reserved.
                    </p>
                </div>

                <div className="flex flex-wrap gap-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Link href="/#top" className="transition hover:text-blue-700">
                        Overview
                    </Link>
                    <Link href="/#how-it-works" className="transition hover:text-blue-700">
                        How it works
                    </Link>
                    <Link href="/features" className="transition hover:text-blue-700">
                        Features
                    </Link>
                    <Link href="/login" className="transition hover:text-blue-700">
                        Login
                    </Link>
                    <Link href="/sign-up" className="transition hover:text-blue-700">
                        Sign up
                    </Link>
                    <Link href="/privacy-policy" className="transition hover:text-blue-700">
                        Privacy
                    </Link>
                    <Link href="/terms-of-service" className="transition hover:text-blue-700">
                        Terms
                    </Link>
                </div>
            </Container>
        </footer>
    );
};

export default Footer;
