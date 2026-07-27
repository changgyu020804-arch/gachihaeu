import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "같이해U | 서울시립대 운동 메이트",
  description:
    "서울시립대학교 안에서 축구, 농구, 러닝, 테니스를 함께할 친구를 찾아보세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={geistSans.variable}>{children}</body>
    </html>
  );
}
