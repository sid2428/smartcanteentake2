import { guardPage } from "@/lib/server/page-guard";

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  await guardPage("/kitchen", "staff");
  return children;
}
