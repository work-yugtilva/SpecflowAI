import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpecFlow AI — AI-Powered Product Management",
  description:
    "SpecFlow AI helps product managers go from raw research to a full PRD in minutes. Your AI-powered PM co-pilot.",
  openGraph: {
    title: "SpecFlow AI — AI-Powered Product Management",
    description: "Go from research to PRD in minutes with AI.",
    url: "https://www.specflowai.com",
    siteName: "SpecFlow AI",
    images: [
      {
        url: "https://www.specflowai.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "SpecFlow AI",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SpecFlow AI",
    description: "Go from research to PRD in minutes with AI.",
    images: ["https://www.specflowai.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=instrument-serif@400&display=swap"
          rel="stylesheet"
        />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300..700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var d=localStorage.getItem('specflow-theme');if(d==='dark'||(!d&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.setAttribute('data-dark','true')}}catch(e){}})()",
          }}
        />
        <script async src="https://elu.dev/v1/elu_pk_live_Di0rBYtHgCRqqs4wm6FXGVG4jk.js"></script>
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
