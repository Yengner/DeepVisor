import type { FC } from "react";
import type { IconType } from "react-icons";
import { FaAmazon, FaMicrosoft } from "react-icons/fa6";
import { SiGoogleads, SiLinkedin, SiMeta, SiPinterest, SiSnapchat, SiTiktok } from "react-icons/si";
import { Badge, Card, Container, Section } from "@/components/marketing";
import { cn } from "@/lib/shared/utils/format";

type Platform = {
    name: string;
    status: string;
    icon: IconType;
    iconClassName: string;
    iconSurfaceClassName?: string;
    glowClassName: string;
    statusClassName: string;
};

const metaPlatform: Platform = {
    name: "Meta",
    status: "Active Build",
    icon: SiMeta,
    iconClassName: "text-[#4da3ff]",
    iconSurfaceClassName: "border-white/10 bg-white/10",
    glowClassName: "from-[#1877F2]/30 via-sky-400/12 to-violet-400/18",
    statusClassName: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
};

const plannedPlatforms: Platform[] = [
    {
        name: "Google Ads",
        status: "Planned",
        icon: SiGoogleads,
        iconClassName: "text-[#4285F4]",
        glowClassName: "from-[#4285F4]/20 via-[#34A853]/12 to-[#FBBC05]/18",
        statusClassName: "border-slate-200 bg-white/90 text-slate-500",
    },
    {
        name: "Amazon Ads",
        status: "Planned",
        icon: FaAmazon,
        iconClassName: "text-[#ff9900]",
        glowClassName: "from-[#ff9900]/20 via-[#232f3e]/8 to-[#ff9900]/12",
        statusClassName: "border-slate-200 bg-white/90 text-slate-500",
    },
    {
        name: "TikTok Ads",
        status: "Planned",
        icon: SiTiktok,
        iconClassName: "text-[#111111]",
        glowClassName: "from-[#25F4EE]/18 via-white/10 to-[#FE2C55]/18",
        statusClassName: "border-slate-200 bg-white/90 text-slate-500",
    },
    {
        name: "Microsoft Advertising",
        status: "Planned",
        icon: FaMicrosoft,
        iconClassName: "text-[#00A4EF]",
        glowClassName: "from-[#00A4EF]/18 via-[#7FBA00]/10 to-[#F25022]/18",
        statusClassName: "border-slate-200 bg-white/90 text-slate-500",
    },
    {
        name: "Snapchat Ads",
        status: "Planned",
        icon: SiSnapchat,
        iconClassName: "text-slate-950",
        iconSurfaceClassName: "border-[#f4ea00] bg-[#FFFC00]",
        glowClassName: "from-[#FFFC00]/24 via-white/8 to-[#FFFC00]/12",
        statusClassName: "border-slate-200 bg-white/90 text-slate-500",
    },
    {
        name: "LinkedIn Ads",
        status: "Planned",
        icon: SiLinkedin,
        iconClassName: "text-[#0A66C2]",
        glowClassName: "from-[#0A66C2]/20 via-sky-200/8 to-[#0A66C2]/16",
        statusClassName: "border-slate-200 bg-white/90 text-slate-500",
    },
    {
        name: "Pinterest Ads",
        status: "Planned",
        icon: SiPinterest,
        iconClassName: "text-[#E60023]",
        glowClassName: "from-[#E60023]/18 via-rose-200/8 to-[#E60023]/18",
        statusClassName: "border-slate-200 bg-white/90 text-slate-500",
    },
];

const LogoChip = ({ platform, featured = false }: { platform: Platform; featured?: boolean }) => {
    const Icon = platform.icon;

    if (featured) {
        return (
            <Card className="relative overflow-hidden border-white/10 bg-ink p-0 shadow-card-strong">
                <div
                    className={cn(
                        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
                        platform.glowClassName
                    )}
                    aria-hidden="true"
                />
                <div className="pointer-events-none absolute -left-12 top-4 h-40 w-40 rounded-full bg-[#1877F2]/25 blur-3xl motion-safe:animate-float-slow" aria-hidden="true" />

                <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex items-center gap-4">
                        <div
                            className={cn(
                                "relative flex h-16 w-16 items-center justify-center rounded-2xl border shadow-inner-glow",
                                platform.iconSurfaceClassName
                            )}
                        >
                            <div className="absolute inset-2 rounded-2xl bg-[#1877F2]/20 blur-xl" aria-hidden="true" />
                            <Icon className={cn("relative h-8 w-8", platform.iconClassName)} aria-hidden="true" />
                        </div>

                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Current integration</p>
                            <h3 className="mt-1 text-2xl font-semibold text-white">{platform.name}</h3>
                        </div>
                    </div>

                    <span
                        className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                            platform.statusClassName
                        )}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        {platform.status}
                    </span>
                </div>
            </Card>
        );
    }

    return (
        <div className="group relative min-w-max overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-card backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:shadow-card-strong">
            <div
                className={cn(
                    "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition duration-300 group-hover:opacity-100",
                    platform.glowClassName
                )}
                aria-hidden="true"
            />

            <div className="relative flex items-center gap-3">
                <div
                    className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/95 shadow-inner-glow",
                        platform.iconSurfaceClassName
                    )}
                >
                    <Icon className={cn("h-6 w-6", platform.iconClassName)} aria-hidden="true" />
                </div>

                <div>
                    <p className="text-sm font-semibold text-slate-950">{platform.name}</p>
                    <span
                        className={cn(
                            "mt-1 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                            platform.statusClassName
                        )}
                    >
                        {platform.status}
                    </span>
                </div>
            </div>
        </div>
    );
};

const IntegrationsSection: FC = () => {
    return (
        <Section tone="gradient" id="integrations" className="overflow-hidden py-12 sm:py-section-sm md:py-section">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.10),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.10),transparent_35%)]" aria-hidden="true" />

            <Container className="relative">
                <div className="mx-auto max-w-3xl text-center">
                    <Badge variant="accent" className="w-fit">
                        Platform integrations
                    </Badge>
                    <h2 className="mt-4 text-balance text-3xl font-semibold text-slate-950 sm:text-4xl">
                        Meta first. Unified advertising across every major channel next.
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                        DeepVisor is building on Meta now, with Google Ads, Amazon Ads, TikTok Ads, Microsoft Advertising,
                        Snapchat Ads, LinkedIn Ads, and Pinterest Ads planned next.
                    </p>
                </div>

                <div className="mx-auto mt-8 max-w-2xl">
                    <LogoChip platform={metaPlatform} featured />
                </div>

                <div className="mt-8">
                    <div className="flex items-center gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Planned next</p>
                    </div>

                    <div className="mt-4 flex gap-3 overflow-x-auto pb-2 md:hidden">
                        {plannedPlatforms.map((platform) => (
                            <LogoChip key={platform.name} platform={platform} />
                        ))}
                    </div>

                    <div className="group relative mt-4 hidden overflow-hidden md:block">
                        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white via-white/90 to-transparent" aria-hidden="true" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white via-white/90 to-transparent" aria-hidden="true" />

                        <div className="flex min-w-max gap-4 motion-safe:animate-[logo-strip_28s_linear_infinite] group-hover:[animation-play-state:paused]">
                            <div className="flex min-w-max gap-4 pr-4">
                                {plannedPlatforms.map((platform) => (
                                    <LogoChip key={platform.name} platform={platform} />
                                ))}
                            </div>
                            <div className="flex min-w-max gap-4 pr-4" aria-hidden="true">
                                {plannedPlatforms.map((platform) => (
                                    <LogoChip key={`${platform.name}-duplicate`} platform={platform} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <p className="mt-6 text-center text-sm text-slate-500">
                    DeepVisor is becoming one operating layer across the ad platforms modern businesses use.
                </p>
            </Container>

            <style>{`
                @keyframes logo-strip {
                    from {
                        transform: translateX(0);
                    }

                    to {
                        transform: translateX(-50%);
                    }
                }
            `}</style>
        </Section>
    );
};

export default IntegrationsSection;
