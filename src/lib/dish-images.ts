/** Photography for the seeded dishes, served from /public. Unmatched dishes fall back by category, then to their emoji. */

const BY_NAME: Record<string, string> = {
  "masala dosa": "/images/dishes/masala-dosa.jpg",
  "idli sambar": "/images/dishes/idli-sambar.jpg",
  "veg thali": "/images/dishes/veg-thali.jpg",
  "paneer butter masala": "/images/dishes/paneer-butter-masala.jpg",
  "chicken biryani": "/images/dishes/chicken-biryani.jpg",
  "veg hakka noodles": "/images/dishes/hakka-noodles.jpg",
  "samosa (2 pcs)": "/images/dishes/samosa.jpg",
  "vada pav": "/images/dishes/vada-pav.jpg",
  "gulab jamun (2 pcs)": "/images/dishes/gulab-jamun.jpg",
  "filter coffee": "/images/dishes/filter-coffee.jpg",
  "masala chai": "/images/dishes/masala-chai.jpg",
  "mango lassi": "/images/dishes/mango-lassi.jpg",
};

/** Loose keyword matches, so owner-created dishes like "Cheese Dosa" still get a photo. */
const BY_KEYWORD: [string, string][] = [
  ["dosa", BY_NAME["masala dosa"]],
  ["idli", BY_NAME["idli sambar"]],
  ["thali", BY_NAME["veg thali"]],
  ["paneer", BY_NAME["paneer butter masala"]],
  ["biryani", BY_NAME["chicken biryani"]],
  ["noodle", BY_NAME["veg hakka noodles"]],
  ["samosa", BY_NAME["samosa (2 pcs)"]],
  ["pav", BY_NAME["vada pav"]],
  ["jamun", BY_NAME["gulab jamun (2 pcs)"]],
  ["coffee", BY_NAME["filter coffee"]],
  ["chai", BY_NAME["masala chai"]],
  ["tea", BY_NAME["masala chai"]],
  ["lassi", BY_NAME["mango lassi"]],
];

export function dishImage(name: string | undefined | null): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (BY_NAME[key]) return BY_NAME[key];
  for (const [word, src] of BY_KEYWORD) {
    if (key.includes(word)) return src;
  }
  return null;
}

export const SCENES = {
  dosaLeaf: "/images/scenes/dosa-leaf.jpg",
  thaliSpread: "/images/scenes/thali-spread.jpg",
  chaiPour: "/images/scenes/chai-pour.jpg",
} as const;
