import { BrandLockup } from '@/components/brand/Brand';
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { FC } from "react";
import { Container } from "@/components/marketing";

const Footer: FC = () => {
    return (
        <footer className="border-t border-white/10 bg-[#07182d] text-white">
            <Container className="py-8 sm:py-10">
                <div className="grid gap-8 border-b border-white/10 pb-8 md:grid-cols-[1.4fr_0.6fr_0.6fr]">
                    <div className="max-w-sm">
                        <a href="https://deepvisor.com" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2.5">
                            <BrandLockup inverse />
                            <ArrowUpRight className="h-3.5 w-3.5 text-white/65" aria-hidden="true" />
                        </a>
                        <p className="mt-4 text-sm leading-6 text-white/70">
                            Clearer Meta ad decisions for busy salon owners.
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase text-white/65">Product</p>
                        <div className="mt-3 grid gap-2.5 text-xs text-white/65">
                            <Link href="/#top" className="w-fit transition-colors hover:text-[#bdceff]">Overview</Link>
                            <Link href="/#how-it-works" className="w-fit transition-colors hover:text-[#bdceff]">Workflow</Link>
                            <Link href="/features" className="w-fit transition-colors hover:text-[#bdceff]">Features</Link>
                            <Link href="/sign-up" className="w-fit transition-colors hover:text-[#bdceff]">Start free</Link>
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase text-white/65">Company</p>
                        <div className="mt-3 grid gap-2.5 text-xs text-white/65">
                            <Link href="/login" className="w-fit transition-colors hover:text-[#bdceff]">Log in</Link>
                            <Link href="/privacy-policy" className="w-fit transition-colors hover:text-[#bdceff]">Privacy</Link>
                            <Link href="/terms-of-service" className="w-fit transition-colors hover:text-[#bdceff]">Terms</Link>
                            <a href="mailto:info@deepvisor.com" className="w-fit transition-colors hover:text-[#bdceff]">Contact</a>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-5 text-[11px] text-white/65 sm:flex-row sm:items-center sm:justify-between">
                    <p>© {new Date().getFullYear()} DeepVisor. All rights reserved.</p>
                    <p>Built for decisions, not dashboard noise.</p>
                </div>
            </Container>
        </footer>
    );
};

export default Footer;
