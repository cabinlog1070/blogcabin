import Link from "next/link";
import { getT } from "@/server/i18n";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <p className="text-7xl">🧭</p>
      <h1 className="mt-4 font-display text-3xl">{t("길을 잃었어요")}</h1>
      <p className="mt-2 text-ink-soft">{t("찾는 블로그나 글이 없거나, 서로 이웃만 볼 수 있는 비공개 글이에요.")}</p>
      <Link href="/town" className="btn mt-6 bg-leaf text-white">
        {t("광장으로 돌아가기")}
      </Link>
    </div>
  );
}
