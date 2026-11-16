import "./globals.css";

export const metadata = {
  title: "Chatbot Data BPS Tanjung Jabung Barat",
  description:
    "Layanan Tanya Jawab Data Statistik Kabupaten Tanjung Jabung Barat bersumber dari situs resmi BPS (tanjabbarkab.bps.go.id).",
  icons: {
    icon: "/logo_bps.png",
    shortcut: "/logo_bps.png",
    apple: "/logo_bps.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#025492",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" type="image/png" href="/logo_bps.png" />
        <link rel="apple-touch-icon" href="/logo_bps.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
