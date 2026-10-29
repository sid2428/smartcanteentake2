import { guardPage } from "@/lib/server/page-guard";

export default async function MenuLayout({ children }: { children: React.ReactNode }) {
  await guardPage("/menu", "student");
  return children;
}
