import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

type LegalSection = {
  title: string;
  body: string[];
};

type LegalDocumentProps = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

const sectionId = (title: string) =>
  `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

export default function LegalDocument({ title, lastUpdated, intro, sections }: LegalDocumentProps) {
  return (
    <div className="dv-legal-page bg-[#f4f7fc]">
      <header className="border-b border-[#d2d7dd] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#004fc7] transition-colors hover:text-[#082d56]">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to DeepVisor
          </Link>
          <div className="mt-8 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase text-[#004fc7]">Legal / DeepVisor</p>
              <h1 className="mt-2 text-4xl font-semibold leading-none text-[#082d56] sm:text-5xl">{title}</h1>
            </div>
            <div className="border-l-2 border-[#004fc7] pl-3 text-xs text-[#5b6674]">
              <p className="font-semibold text-[#082d56]">Current version</p>
              <p className="mt-1">Updated {lastUpdated}</p>
            </div>
          </div>
          <p className="mt-7 max-w-3xl text-sm leading-7 text-[#4c5561] sm:text-base">{intro}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8 lg:py-14">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <p className="text-[10px] font-semibold uppercase text-[#6a7787]">In this document</p>
            <nav className="mt-4 max-h-[calc(100vh-8rem)] overflow-y-auto border-l border-[#c5cad1]" aria-label={`${title} sections`}>
              {sections.map((section) => (
                <a
                  key={section.title}
                  href={`#${sectionId(section.title)}`}
                  className="block border-l border-transparent px-3 py-1.5 text-xs leading-5 text-[#5b6674] transition-colors hover:border-[#004fc7] hover:text-[#004fc7]"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <article className="min-w-0 border-t border-[#c5cad1]">
          {sections.map((section, index) => (
            <section id={sectionId(section.title)} key={section.title} className="scroll-mt-24 border-b border-[#c5cad1] py-7 sm:grid sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-4 sm:py-9">
              <span className="mb-2 block font-mono text-[11px] font-semibold text-[#004fc7] sm:mb-0">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[#082d56] sm:text-xl">{section.title.replace(/^\d+\.\s*/, "")}</h2>
                <div className="mt-3 space-y-3">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-7 text-[#4c5561] sm:text-[15px]">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </section>
          ))}

          <div className="mt-8 flex items-center gap-3 rounded-md border border-[#bcc8d8] bg-white p-4 text-sm text-[#4c5561]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eaf2ff] text-[#004fc7]">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </span>
            <p>
              Questions about this document?{" "}
              <a href="mailto:info@deepvisor.com" className="font-semibold text-[#004fc7] underline decoration-[#004fc7]/30 underline-offset-4 hover:text-[#082d56]">
                info@deepvisor.com
              </a>
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
