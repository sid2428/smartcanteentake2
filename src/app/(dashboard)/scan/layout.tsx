import { guardPage } from "@/lib/server/page-guard";

export default async function ScanLayout({ children }: { children: React.ReactNode }) {
  await guardPage("/scan", "staff");
  return children;
}
