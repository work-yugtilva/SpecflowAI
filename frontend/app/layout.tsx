import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpecFlow — AI-powered product discovery",
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
        <meta
          content="SpecFlow turns customer signals into product briefs in under 12 minutes."
          name="description"
        />
        <meta content="SpecFlow — AI-powered product discovery" property="og:title" />
        <meta
          content="From 4 days to 12 minutes. SpecFlow synthesizes customer signals into complete feature briefs."
          property="og:description"
        />
        <meta content="/og-image.png" property="og:image" />
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
