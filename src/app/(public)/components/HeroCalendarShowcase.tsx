"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PhoneCall, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/marketing";

type CalendarEntry = {
  id: string;
  day: number;
  title: string;
  time: string;
  kind: "timed" | "all_day";
  tone: string;
};

type CalendarMonth = {
  key: string;
  monthLabel: string;
  business: string;
  account: string;
  icon: LucideIcon;
  year: number;
  month: number;
  entries: CalendarEntry[];
};

type CalendarCell = {
  key: string;
  label: number;
  isCurrentMonth: boolean;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ENTRY_ADVANCE_MS = 1100;
const MONTH_HOLD_STEPS = 3;

const calendarMonths: CalendarMonth[] = [
  {
    key: "april-2026",
    monthLabel: "April 2026",
    business: "Summit Roofing Co.",
    account: "Meta operations queue",
    icon: Wrench,
    year: 2026,
    month: 3,
    entries: [
      { id: "apr-1", day: 2, title: "Monthly Meta ads report", time: "All day", kind: "all_day", tone: "bg-slate-900" },
      { id: "apr-2", day: 4, title: "Created storm-damage ad set test", time: "2:10 PM", kind: "timed", tone: "bg-cyan-500" },
      { id: "apr-3", day: 7, title: "Decreased roofing quote budget 12%", time: "11:30 AM", kind: "timed", tone: "bg-emerald-500" },
      { id: "apr-4", day: 7, title: "Audience 1 created in Meta", time: "3:20 PM", kind: "timed", tone: "bg-blue-500" },
      { id: "apr-5", day: 13, title: "Paused weak gutter repair ad set", time: "8:40 AM", kind: "timed", tone: "bg-amber-500" },
      { id: "apr-6", day: 15, title: "Lead-form question update queued", time: "3:30 PM", kind: "timed", tone: "bg-fuchsia-500" },
      { id: "apr-7", day: 18, title: "Raised missed-call retargeting cap", time: "10:15 AM", kind: "timed", tone: "bg-emerald-500" },
      { id: "apr-8", day: 22, title: "Created hail lead lookalike", time: "12:20 PM", kind: "timed", tone: "bg-cyan-500" },
      { id: "apr-9", day: 22, title: "Monthly pacing review", time: "All day", kind: "all_day", tone: "bg-orange-500" },
      { id: "apr-10", day: 28, title: "New creative test pushed to Meta", time: "9:20 AM", kind: "timed", tone: "bg-fuchsia-500" },
      { id: "apr-11", day: 30, title: "End-of-month budget rollup", time: "All day", kind: "all_day", tone: "bg-slate-900" },
    ],
  },
  {
    key: "may-2026",
    monthLabel: "May 2026",
    business: "BlueOak Tile & Stone",
    account: "Meta operations queue",
    icon: Wrench,
    year: 2026,
    month: 4,
    entries: [
      { id: "may-1", day: 1, title: "Monthly Meta ads report", time: "All day", kind: "all_day", tone: "bg-slate-900" },
      { id: "may-2", day: 5, title: "Reduced kitchen quote CPA budget", time: "12:10 PM", kind: "timed", tone: "bg-blue-500" },
      { id: "may-3", day: 8, title: "Created luxury tile audience test", time: "9:35 AM", kind: "timed", tone: "bg-emerald-500" },
      { id: "may-4", day: 12, title: "New ad set launched for backsplashes", time: "1:45 PM", kind: "timed", tone: "bg-amber-500" },
      { id: "may-5", day: 12, title: "Creative fatigue review", time: "All day", kind: "all_day", tone: "bg-cyan-500" },
      { id: "may-6", day: 19, title: "Paused low-intent remodel audience", time: "11:20 AM", kind: "timed", tone: "bg-fuchsia-500" },
      { id: "may-7", day: 21, title: "Lookalike audience pushed to Meta", time: "3:30 PM", kind: "timed", tone: "bg-blue-500" },
      { id: "may-8", day: 24, title: "Weekly account change log", time: "All day", kind: "all_day", tone: "bg-orange-500" },
      { id: "may-9", day: 24, title: "Retargeting budget raised 8%", time: "1:05 PM", kind: "timed", tone: "bg-amber-500" },
      { id: "may-10", day: 30, title: "Month-end performance summary", time: "All day", kind: "all_day", tone: "bg-slate-900" },
    ],
  },
  {
    key: "june-2026",
    monthLabel: "June 2026",
    business: "Peak Dental Studio",
    account: "Meta operations queue",
    icon: PhoneCall,
    year: 2026,
    month: 5,
    entries: [
      { id: "jun-1", day: 3, title: "Monthly Meta ads report", time: "All day", kind: "all_day", tone: "bg-slate-900" },
      { id: "jun-2", day: 6, title: "Created implant consult audience", time: "11:00 AM", kind: "timed", tone: "bg-amber-500" },
      { id: "jun-3", day: 9, title: "New smile-test ad set launched", time: "1:25 PM", kind: "timed", tone: "bg-emerald-500" },
      { id: "jun-4", day: 11, title: "Decreased whitening campaign spend", time: "4:05 PM", kind: "timed", tone: "bg-cyan-500" },
      { id: "jun-5", day: 14, title: "Lead quality audit", time: "All day", kind: "all_day", tone: "bg-fuchsia-500" },
      { id: "jun-6", day: 17, title: "Before/after creative test pushed", time: "12:15 PM", kind: "timed", tone: "bg-emerald-500" },
      { id: "jun-7", day: 20, title: "Retargeting audience refreshed", time: "3:10 PM", kind: "timed", tone: "bg-blue-500" },
      { id: "jun-8", day: 23, title: "Phone-call lead form updated", time: "9:50 AM", kind: "timed", tone: "bg-amber-500" },
      { id: "jun-9", day: 23, title: "Weekly automation summary", time: "All day", kind: "all_day", tone: "bg-orange-500" },
      { id: "jun-10", day: 29, title: "Month-end Meta performance summary", time: "All day", kind: "all_day", tone: "bg-slate-900" },
    ],
  },
];

function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    if (index < firstDayIndex) {
      const label = daysInPreviousMonth - firstDayIndex + index + 1;
      return { key: `prev-${label}-${index}`, label, isCurrentMonth: false };
    }

    const currentMonthDay = index - firstDayIndex + 1;
    if (currentMonthDay <= daysInMonth) {
      return { key: `current-${currentMonthDay}`, label: currentMonthDay, isCurrentMonth: true };
    }

    return { key: `next-${currentMonthDay - daysInMonth}-${index}`, label: currentMonthDay - daysInMonth, isCurrentMonth: false };
  });
}

function getAllDayTextClass(tone: string) {
  switch (tone) {
    case "bg-orange-500":
    case "bg-amber-500":
    case "bg-cyan-500":
      return "text-slate-950";
    default:
      return "text-white";
  }
}

const HeroCalendarShowcase = () => {
  const [monthIndex, setMonthIndex] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((currentStep) => {
        const activeMonth = calendarMonths[monthIndex];
        const lastStep = activeMonth.entries.length + MONTH_HOLD_STEPS;

        if (currentStep + 1 >= lastStep) {
          setMonthIndex((currentMonthIndex) => (currentMonthIndex + 1) % calendarMonths.length);
          return 0;
        }

        return currentStep + 1;
      });
    }, ENTRY_ADVANCE_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [monthIndex]);

  const activeMonth = calendarMonths[monthIndex];
  const ActiveIcon = activeMonth.icon;
  const calendarCells = useMemo(() => buildCalendarCells(activeMonth.year, activeMonth.month), [activeMonth.month, activeMonth.year]);
  const visibleEntries = activeMonth.entries.slice(0, Math.min(step, activeMonth.entries.length));
  const latestEntry =
    visibleEntries.length > 0 ? visibleEntries[visibleEntries.length - 1] : activeMonth.entries[0];
  const visibleEntriesByDay = visibleEntries.reduce<Record<number, CalendarEntry[]>>((entriesByDay, entry) => {
    entriesByDay[entry.day] = [...(entriesByDay[entry.day] ?? []), entry];
    return entriesByDay;
  }, {});
  const activeDay = step > 0 && step <= activeMonth.entries.length ? latestEntry.day : null;

  return (
    <Card className="relative overflow-hidden rounded-[2rem] border-slate-200/80 bg-white/95 p-0 shadow-[0_30px_80px_rgba(15,23,42,0.14)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(14,165,233,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,250,252,0.96)_100%)]"
        aria-hidden="true"
      />

      <div className="relative border-b border-slate-200 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              DeepVisor calendar
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {activeMonth.business} · {activeMonth.account}
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex h-[620px] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <ActiveIcon className="h-5 w-5" aria-hidden="true" />
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Rolling month
              </p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={activeMonth.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.24 }}
                  className="mt-1 text-xl font-semibold text-slate-950"
                >
                  {activeMonth.monthLabel}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="min-w-[220px] flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm sm:max-w-[360px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Latest queue added
            </p>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeMonth.key}-${latestEntry.id}-${step}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="mt-2 flex items-start gap-3"
              >
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${latestEntry.tone}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">{latestEntry.title}</p>
                  <p className="text-xs font-semibold text-slate-500">{latestEntry.time}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

   

        <div className="grid grid-cols-7 gap-1 px-4 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-1.5">
              {label}
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 px-4 pb-4 pt-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMonth.key}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="grid h-full grid-cols-7 grid-rows-6 gap-1"
            >
              {calendarCells.map((cell) => {
                const cellEntries = cell.isCurrentMonth ? visibleEntriesByDay[cell.label] ?? [] : [];
                const displayEntries = [
                  ...cellEntries.filter((entry) => entry.kind === "all_day").slice(0, 1),
                  ...cellEntries.filter((entry) => entry.kind === "timed").slice(0, 2),
                ];
                const isActiveCell = activeDay === cell.label;

                return (
                  <div
                    key={`${activeMonth.key}-${cell.key}`}
                    className={`flex min-h-0 flex-col rounded-[1rem] border px-1.5 py-1.5 transition-colors ${
                      cell.isCurrentMonth
                        ? isActiveCell
                          ? "border-blue-300 bg-blue-50/70 shadow-[0_10px_22px_rgba(59,130,246,0.14)]"
                          : "border-slate-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
                        : "border-slate-200/70 bg-slate-50 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold ${cell.isCurrentMonth ? "text-slate-700" : "text-slate-400"}`}>
                        {cell.label}
                      </span>
                      {cell.isCurrentMonth && cellEntries.length > 0 ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                      <AnimatePresence>
                        {displayEntries.map((entry) => {
                          if (entry.kind === "all_day") {
                            return (
                              <motion.div
                                key={entry.id}
                                initial={{ opacity: 0, y: 10, scaleX: 0.6 }}
                                animate={{ opacity: 1, y: 0, scaleX: 1 }}
                                exit={{ opacity: 0, y: -6, scaleX: 0.6 }}
                                transition={{ duration: 0.22 }}
                                className={`rounded-md ${entry.tone} px-2 py-1 text-[9px] font-semibold leading-[1.15] shadow-sm ${getAllDayTextClass(entry.tone)}`}
                              >
                                <span className="block truncate">{entry.title}</span>
                              </motion.div>
                            );
                          }

                          return (
                            <motion.div
                              key={entry.id}
                              initial={{ opacity: 0, y: 10, scaleX: 0.6 }}
                              animate={{ opacity: 1, y: 0, scaleX: 1 }}
                              exit={{ opacity: 0, y: -6, scaleX: 0.6 }}
                              transition={{ duration: 0.22 }}
                              className="flex items-start gap-1.5 rounded-md px-1 py-0.5"
                            >
                              <span className={`mt-[0.28rem] h-1.5 w-1.5 rounded-full ${entry.tone}`} />
                              <span className="min-w-0 text-[9px] leading-[1.15] text-slate-700">
                                <span className="font-semibold text-slate-950">{entry.time}</span>{" "}
                                <span className="inline-block max-w-full truncate align-bottom">{entry.title}</span>
                              </span>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
};

export default HeroCalendarShowcase;
