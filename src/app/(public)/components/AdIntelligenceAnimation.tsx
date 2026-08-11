"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CircleDollarSign,
  ImageIcon,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  PlayCircle,
} from "lucide-react";
import type { IconType } from "react-icons";
import { SiMeta } from "react-icons/si";

type StatCard = {
  label: string;
  end: string;
  lift: string;
  icon: LucideIcon;
};

type CreativeMedia = {
  title: string;
  kind: "image" | "video";
  src: string;
  poster?: string;
};

type CreativeRow = {
  id: string;
  platform: string;
  format: string;
  Icon: IconType;
  brandColor: string;
  surfaceColor: string;
  budgetEnd: string;
  leadsEnd: string;
  clicksEnd: string;
  lift: string;
};

const statCards: StatCard[] = [
  { label: "Budget", end: "$608", lift: "+44%", icon: CircleDollarSign },
  { label: "Leads", end: "81", lift: "+76%", icon: MessageCircle },
  { label: "Clicks", end: "1,048", lift: "+71%", icon: MousePointerClick },
];

const creativeAssets: CreativeMedia[] = [
  {
    title: "Stylist combing client hair",
    kind: "video",
    src: "https://assets.mixkit.co/videos/33257/33257-720.mp4",
    poster: "https://assets.mixkit.co/videos/33257/33257-thumb-720-0.jpg",
  },
  {
    title: "Curly hair portrait",
    kind: "video",
    src: "https://assets.mixkit.co/videos/51997/51997-720.mp4",
    poster: "https://assets.mixkit.co/videos/51997/51997-thumb-720-0.jpg",
  },
  {
    title: "Hair movement reel",
    kind: "video",
    src: "https://assets.mixkit.co/videos/16189/16189-720.mp4",
    poster: "https://assets.mixkit.co/videos/16189/16189-thumb-720-0.jpg",
  },
  {
    title: "Shampoo service",
    kind: "video",
    src: "https://assets.mixkit.co/videos/33766/33766-720.mp4",
    poster: "https://assets.mixkit.co/videos/33766/33766-thumb-720-0.jpg",
  },
  {
    title: "Barber tools",
    kind: "video",
    src: "https://assets.mixkit.co/videos/271/271-720.mp4",
    poster: "https://assets.mixkit.co/videos/271/271-thumb-720-0.jpg",
  },
  {
    title: "Scissors and comb",
    kind: "video",
    src: "https://assets.mixkit.co/videos/43232/43232-720.mp4",
    poster: "https://assets.mixkit.co/videos/43232/43232-thumb-720-0.jpg",
  },
  {
    title: "Balayage chair",
    kind: "image",
    src: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=520&q=80",
  },
  {
    title: "Color service",
    kind: "image",
    src: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=520&q=80",
  },
  {
    title: "Fresh cut close-up",
    kind: "image",
    src: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=520&q=80",
  },
  {
    title: "Salon styling",
    kind: "image",
    src: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=520&q=80",
  },
  {
    title: "Beauty booking",
    kind: "image",
    src: "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=520&q=80",
  },
  {
    title: "Treatment room",
    kind: "image",
    src: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=520&q=80",
  },
];

const creativeRows: CreativeRow[] = [
  {
    id: "meta-reels",
    platform: "Meta",
    format: "Reels creative",
    Icon: SiMeta,
    brandColor: "#1877f2",
    surfaceColor: "#eff6ff",
    budgetEnd: "$214",
    leadsEnd: "32",
    clicksEnd: "511",
    lift: "+256%",
  },
  {
    id: "meta-message",
    platform: "Meta",
    format: "Message ad",
    Icon: SiMeta,
    brandColor: "#1877f2",
    surfaceColor: "#eff6ff",
    budgetEnd: "$236",
    leadsEnd: "37",
    clicksEnd: "392",
    lift: "+54%",
  },
  {
    id: "meta-lead-form",
    platform: "Meta",
    format: "Lead form creative",
    Icon: SiMeta,
    brandColor: "#1877f2",
    surfaceColor: "#eef7ff",
    budgetEnd: "$158",
    leadsEnd: "12",
    clicksEnd: "145",
    lift: "-8%",
  },
];

const dateFrames = ["Jun 17", "Jun 18", "Jun 19", "Jun 20"];
const CARD_ANIMATION_MS = 10_800;
const cardAnimationDelays = ["0ms", "-3600ms", "-7200ms"];
const hiddenMediaUpdateDelays = [9_100, 5_500, 1_900];

export default function AdIntelligenceAnimation() {
  const nextAssetIndex = useRef(creativeRows.length);
  const [shouldRenderAnimation, setShouldRenderAnimation] = useState(false);
  const [slotMedia, setSlotMedia] = useState(() =>
    creativeRows.map((_, index) => creativeAssets[index % creativeAssets.length])
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateRenderState = () => setShouldRenderAnimation(mediaQuery.matches);

    updateRenderState();
    mediaQuery.addEventListener("change", updateRenderState);

    return () => mediaQuery.removeEventListener("change", updateRenderState);
  }, []);

  useEffect(() => {
    if (!shouldRenderAnimation) {
      return undefined;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const timeouts: number[] = [];
    const intervals: number[] = [];

    const updateSlotMedia = (slotIndex: number) => {
      setSlotMedia((current) => {
        const next = [...current];
        next[slotIndex] = creativeAssets[nextAssetIndex.current % creativeAssets.length];
        nextAssetIndex.current += 1;
        return next;
      });
    };

    hiddenMediaUpdateDelays.forEach((delay, slotIndex) => {
      const timeout = window.setTimeout(() => {
        updateSlotMedia(slotIndex);
        const interval = window.setInterval(() => updateSlotMedia(slotIndex), CARD_ANIMATION_MS);
        intervals.push(interval);
      }, delay);

      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      intervals.forEach((interval) => window.clearInterval(interval));
    };
  }, [shouldRenderAnimation]);

  if (!shouldRenderAnimation) {
    return null;
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="overflow-hidden rounded-[1.35rem] border border-blue-100 bg-white p-3 shadow-[0_18px_48px_rgba(37,99,235,0.13)] sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-50 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-700 text-white shadow-[0_12px_26px_rgba(37,99,235,0.18)]">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-500">Creative intelligence</p>
              <h2 className="truncate text-lg font-semibold text-slate-950">Budget follows the winner</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            <div className="relative h-5 w-14 overflow-hidden text-xs font-semibold text-blue-950">
              <div className="dv-date-track">
                {[...dateFrames, "Jun 21"].map((date) => (
                  <span key={date}>{date}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                    {stat.lift}
                  </span>
                </div>
                <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">{stat.label}</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-950">{stat.end}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-[1.1rem] border border-blue-100 bg-blue-50/60 p-2.5 sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-500">Creative rank</p>
            <p className="text-[10px] font-semibold text-slate-500">12 rotating creative assets</p>
          </div>

          <div className="relative h-[326px] overflow-hidden rounded-2xl bg-white p-2 sm:h-[334px]">
            {creativeRows.map((row, index) => {
              const Icon = row.Icon;
              const media = slotMedia[index];
              return (
                <div
                  key={row.id}
                  className="dv-rank-card absolute left-2 right-2 top-2 h-[96px] rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:h-[98px]"
                  style={{ animationDelay: cardAnimationDelays[index] }}
                >
                  <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[82px_minmax(0,1fr)]">
                    <div className="relative h-[72px] overflow-hidden rounded-xl bg-blue-50 sm:h-[76px]">
                      {media.kind === "video" ? (
                        <video
                          key={media.src}
                          className="h-full w-full object-cover"
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          poster={media.poster}
                          aria-label={`${media.title} stock ad creative preview`}
                        >
                          <source src={media.src} type="video/mp4" />
                        </video>
                      ) : (
                        <img
                          key={media.src}
                          src={media.src}
                          alt={`${media.title} stock ad creative preview`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-slate-900 shadow-sm backdrop-blur">
                        {media.kind === "video" ? (
                          <PlayCircle className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ImageIcon className="h-3 w-3" aria-hidden="true" />
                        )}
                        {media.kind === "video" ? "Video" : "Image"}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-slate-200"
                            style={{ background: row.surfaceColor, color: row.brandColor }}
                          >
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-950">{media.title}</p>
                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                              {row.platform} · {row.format}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            row.lift.startsWith("-")
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {row.lift}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-1">
                        {[
                          { label: "Budget", value: row.budgetEnd },
                          { label: "Leads", value: row.leadsEnd },
                          { label: "Clicks", value: row.clicksEnd },
                        ].map((metric) => (
                          <div key={metric.label} className="min-w-0 rounded-lg bg-slate-50 px-1.5 py-1">
                            <p className="truncate text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                              {metric.label}
                            </p>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-950">{metric.value}</p>
                          </div>
                        ))}
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .dv-rank-card {
          animation-duration: 10.8s;
          animation-iteration-count: infinite;
          animation-name: dv-rank-card-cycle;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform, opacity;
        }

        .dv-date-track {
          animation: dv-date-track 10.8s linear infinite;
          will-change: transform;
        }

        .dv-date-track span {
          display: block;
          height: 1.25rem;
          line-height: 1.25rem;
        }

        @keyframes dv-rank-card-cycle {
          0%,
          12% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 1;
          }

          28%,
          40% {
            transform: translate3d(0, 110px, 0) scale(0.995);
            opacity: 0.98;
          }

          56%,
          72% {
            transform: translate3d(0, 220px, 0) scale(0.99);
            opacity: 0.96;
          }

          84% {
            transform: translate3d(0, 334px, 0) scale(0.985);
            opacity: 0;
          }

          84.001% {
            transform: translate3d(0, -112px, 0) scale(0.985);
            opacity: 0;
          }

          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 1;
          }
        }

        @keyframes dv-date-track {
          100% {
            transform: translateY(-5rem);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dv-rank-card,
          .dv-date-track {
            animation: none;
          }

          .dv-rank-card:nth-child(1) {
            transform: translate3d(0, 0, 0);
          }

          .dv-rank-card:nth-child(2) {
            transform: translate3d(0, 110px, 0);
          }

          .dv-rank-card:nth-child(3) {
            transform: translate3d(0, 220px, 0);
          }

        }
      `}</style>
    </div>
  );
}
