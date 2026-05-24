import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "TheWorks — Your future, all six paths",
  description: "Student planning platform for college, trade school, apprenticeship, workforce, military, and entrepreneurship. Built for every student.",
  openGraph: {
    title: "TheWorks — Your future, all six paths",
    description: "The only student planning platform that treats all 6 paths equally. Free to start.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
