import "./globals.css";

export const metadata = {
  title: "Chatbot Data BPS Tanjung Jabung Barat",
  description:
    "Tanya jawab data statistik Kabupaten Tanjung Jabung Barat, bersumber dari situs BPS Kabupaten Tanjung Jabung Barat.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
