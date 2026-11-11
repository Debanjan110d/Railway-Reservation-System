import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RailDSA Engine | Railway Reservation & Priority Allocation",
  description: "Academic Railway Reservation System with Custom DSA & Waiting-List Prioritization",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
