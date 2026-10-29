import Image from "next/image";
import { dishImage } from "@/lib/dish-images";

/**
 * A dish photograph that fills its (positioned, sized) parent. Dishes without a photo
 * get a warm gradient tile with their emoji, so owner-created dishes still look intentional.
 */
export function DishPhoto({
  name,
  emoji,
  sizes = "(min-width: 1024px) 320px, 50vw",
  className = "",
  emojiClassName = "text-5xl",
  eager = false,
}: {
  name: string;
  emoji?: string | null;
  sizes?: string;
  className?: string;
  emojiClassName?: string;
  eager?: boolean;
}) {
  const src = dishImage(name);
  if (!src) {
    return (
      <div
        className={`absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_25%,var(--color-terra-100),var(--color-cream-200)_70%)] ${className}`}
      >
        <span className={emojiClassName} aria-hidden>
          {emoji || "🍽️"}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={name}
      fill
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      className={`object-cover ${className}`}
    />
  );
}

/** Small round dish thumbnail. */
export function DishThumb({
  name,
  emoji,
  size = "h-12 w-12",
  className = "",
}: {
  name: string;
  emoji?: string | null;
  size?: string;
  className?: string;
}) {
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-cream-200 ${size} ${className}`}>
      <DishPhoto name={name} emoji={emoji} sizes="96px" emojiClassName="text-xl" />
    </span>
  );
}

export function DietMark({ veg, className = "" }: { veg: boolean; className?: string }) {
  return (
    <span
      className={`diet-mark ${veg ? "text-forest-500" : "text-terra-500"} ${className}`}
      role="img"
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
    />
  );
}
