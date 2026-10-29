import { guardPage } from "@/lib/server/page-guard";

export default async function TicketsLayout({ children }: { children: React.ReactNode }) {
  await guardPage("/tickets", "student");
  return children;
}
