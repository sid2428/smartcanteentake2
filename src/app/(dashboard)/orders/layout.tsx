import { guardPage } from "@/lib/server/page-guard";

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  await guardPage("/orders", "student");
  return children;
}
