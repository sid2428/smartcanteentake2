import Image from "next/image";
import { Logo } from "@/components/logo";
import { SCENES } from "@/lib/dish-images";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      {/* Photography panel */}
      <aside className="relative h-64 shrink-0 overflow-hidden sm:h-80 lg:sticky lg:top-0 lg:h-screen lg:w-[52%]">
        {/* next/image `fill` needs a relative/absolute parent; the aside itself is sticky on desktop. */}
        <div className="absolute inset-0">
          <Image
            src={SCENES.dosaLeaf}
            alt="Crispy dosa with chutney and sambar on a banana leaf"
            fill
            preload
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="animate-fade scale-105 object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/85 via-forest-900/25 to-forest-900/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 lg:p-14">
          <p className="eyebrow mb-3 animate-rise !text-terra-200">The college canteen, reimagined</p>
          <h2 className="max-w-lg animate-rise font-display text-3xl font-light leading-[1.08] text-cream-50 [animation-delay:120ms] sm:text-4xl lg:text-[3.4rem]">
            Skip the queue. <span className="italic text-terra-200">Savour</span> the meal.
          </h2>
          <p className="mt-5 hidden max-w-md animate-rise text-[0.95rem] leading-relaxed text-cream-200 [animation-delay:220ms] lg:block">
            Order ahead, choose a pickup slot, and collect with a QR ticket that refreshes every thirty seconds.
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-1 flex-col px-5 pb-12 pt-8 sm:px-10 lg:px-16 lg:pt-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
