import "./globals.css";
export const metadata = {
  title: "Bilim Hub — твой учебный центр",
  description: "Образовательная платформа для подготовки к рубежкам и экзаменам.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
