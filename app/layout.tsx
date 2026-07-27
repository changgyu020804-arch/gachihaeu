import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "gachihaeu-uos.changgyu020804.chatgpt.site";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description =
    "서울시립대학교 안에서 축구, 농구, 러닝, 테니스, 배드민턴을 함께할 친구를 찾아보세요.";

  return {
    metadataBase: new URL(origin),
    title: "같이해U | 서울시립대 운동 메이트",
    description,
    openGraph: {
      title: "같이해U",
      description,
      type: "website",
      url: origin,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1792,
          height: 1024,
          alt: "같이해U - 운동하고 싶은 순간, 같이해U",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "같이해U",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

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
