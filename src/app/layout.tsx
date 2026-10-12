import type { Metadata } from "next";
import { Jua, Kosugi_Maru, Noto_Sans_JP, Noto_Sans_KR } from "next/font/google";
import { LocaleProvider } from "@/components/i18n";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LOCALE_TAGS } from "@/lib/i18n";
import { getLocale, getT } from "@/server/i18n";
import "./globals.css";

// 제목용 동글동글한 글꼴 + 본문용 읽기 편한 글꼴
const jua = Jua({ weight: "400", variable: "--font-jua", preload: false });
const noto = Noto_Sans_KR({ variable: "--font-noto", preload: false });
// 일본어 화면: Jua에는 가나가 없어서 제목은 둥근 Kosugi Maru, 본문은 Noto Sans JP (globals.css의 :lang(ja))
const kosugi = Kosugi_Maru({ weight: "400", variable: "--font-kosugi", preload: false });
const notoJp = Noto_Sans_JP({ variable: "--font-noto-jp", preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { default: "BlogCabin", template: "%s | BlogCabin" },
    description: t("글을 쓰고 꾸미면서 캐릭터와 블로그를 키우는 블로그 마을"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const fonts = locale === "ja" ? ` ${kosugi.variable} ${notoJp.variable}` : "";
  return (
    <html lang={LOCALE_TAGS[locale].slice(0, 2)} className={`${jua.variable} ${noto.variable}${fonts} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <LocaleProvider locale={locale}>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </LocaleProvider>
      </body>
    </html>
  );
}
