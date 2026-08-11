import Link from "next/link";
import { ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import type { FC } from "react";
import { Container } from "@/components/marketing";

const Footer: FC = () => {
    return (
        <footer className="border-t border-white/10 bg-[#0d0f0d] text-white">
            <Container className="py-8 sm:py-10">
                <div className="grid gap-8 border-b border-white/10 pb-8 md:grid-cols-[1.4fr_0.6fr_0.6fr]">
                    <div className="max-w-sm">
                        <a href="https://deepvisor.com" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#c8ff56] text-[#0d0f0d] transition-transform group-hover:-translate-y-px">
                                <ChartNoAxesCombined className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="text-sm font-semibold text-white">DeepVisor</span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-white/40" aria-hidden="true" />
                        </a>
                        <p className="mt-4 text-sm leading-6 text-white/55">
                            Clearer Meta ad decisions for busy salon owners.
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase text-white/35">Product</p>
                        <div className="mt-3 grid gap-2.5 text-xs text-white/65">
                            <Link href="/#top" className="w-fit transition-colors hover:text-[#c8ff56]">Overview</Link>
                            <Link href="/#how-it-works" className="w-fit transition-colors hover:text-[#c8ff56]">Workflow</Link>
                            <Link href="/features" className="w-fit transition-colors hover:text-[#c8ff56]">Features</Link>
                            <Link href="/sign-up" className="w-fit transition-colors hover:text-[#c8ff56]">Start free</Link>
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase text-white/35">Company</p>
                        <div className="mt-3 grid gap-2.5 text-xs text-white/65">
                            <Link href="/login" className="w-fit transition-colors hover:text-[#c8ff56]">Log in</Link>
                            <Link href="/privacy-policy" className="w-fit transition-colors hover:text-[#c8ff56]">Privacy</Link>
                            <Link href="/terms-of-service" className="w-fit transition-colors hover:text-[#c8ff56]">Terms</Link>
                            <a href="mailto:info@deepvisor.com" className="w-fit transition-colors hover:text-[#c8ff56]">Contact</a>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-5 text-[11px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
                    <p>© {new Date().getFullYear()} DeepVisor. All rights reserved.</p>
                    <p>Built for decisions, not dashboard noise.</p>
                </div>
            </Container>
        </footer>
    );
};

export default Footer;
