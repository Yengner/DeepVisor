import Link from "next/link";
import type { FC } from "react";
import { Container } from "@/components/marketing";

const Footer: FC = () => {
    return (
        <footer className="border-t border-white/10 bg-ink text-white/70">
            <Container className="flex flex-col gap-6 py-10 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[10px] font-semibold">
                            DV
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                            DeepVisor
                        </span>
                    </div>
                    <p className="max-w-xs text-white/60">
                        Account intelligence for business owners who need clear ad performance decisions.
                    </p>
                    <p className="text-[11px] text-white/40">
                        © {new Date().getFullYear()} DeepVisor. All rights reserved.
                    </p>
                </div>

                <div className="flex flex-wrap gap-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                    <Link href="#product-system" className="transition hover:text-white">
                        Product
                    </Link>
                    <Link href="#use-cases" className="transition hover:text-white">
                        Use cases
                    </Link>
                    <Link href="#cta" className="transition hover:text-white">
                        Contact
                    </Link>
                    <Link href="/privacy-policy" className="transition hover:text-white">
                        Privacy
                    </Link>
                </div>
            </Container>
        </footer>
    );
};

export default Footer;
