import "./globals.css";

export const metadata = {
  title: "Dromocob",
  description: "Dromocob web uygulaması",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
