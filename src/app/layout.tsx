import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Smart Canteen", template: "%s · Smart Canteen" },
  description: "College canteen ordering with QR pickup tickets",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff8f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col bg-canteen-50 text-ink-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
