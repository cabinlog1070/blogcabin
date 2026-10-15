import Link from "next/link";
import { MiniRoom, type RoomPet } from "@/components/character";
import { PetCard } from "@/components/pet-art";
import { FavoriteStar } from "@/components/blog/favorite-star";
import { FollowButton } from "@/components/blog/follow-button";
import { VisitCount } from "@/components/blog/visit-count";
import type { PetShowcase } from "@/server/farm";
import { getLocale, getT } from "@/server/i18n";
import type { PlacedFurniture } from "@/server/look";

type Blog = {
  id: number;
  slug: string;
  title: string;
  description: string;
  ownerId: string;
  nickname: string;
  characterAsset: string;
  backgroundAsset: string;
  followerCount: number;
  postCount: number;
  roomCharX?: number | null;
  roomCharY?: number | null;
  roomPetX?: number | null;
  roomPetY?: number | null;
};

/** 블로그 상단: 미니룸 + 블로그 정보 */
export async function BlogHeader({
  blog,
  furniture = [],
  viewerId,
  following,
  favorite = false,
  pet,
  card,
  visits,
}: {
  blog: Blog;
  furniture?: PlacedFurniture[];
  pet?: RoomPet | null; // 주인이 데리고 다니는 펫 (미니룸에 놓았으면 돌아다니고, 아니면 캐릭터 옆)
  card?: (PetShowcase & { grownAt: Date | null }) | null; // 프로필에 전시한 다 키운 동물 카드
  viewerId: string | null;
  following: boolean;
  favorite?: boolean; // 이웃으로 추가한 블로그를 즐겨찾기했는지 (TOWN-08)
  visits?: { today: number; total: number }; // 방문자 수 (BLOG-06). 블로그 홈에서만
}) {
  const t = await getT();
  const locale = await getLocale();
  const isOwner = viewerId === blog.ownerId;
  return (
    // 넓은 화면: 왼쪽 블로그 정보, 오른쪽 미니룸. 좁은 화면에서는 미니룸이 위로 올라간다
    <section className="card flex flex-col-reverse overflow-hidden md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-4 p-5 sm:p-7">
        <div className="flex items-end gap-4">
          {card && (
            <figure className="shrink-0" data-displayed-card={card.id}>
              <PetCard pet={card} grownAt={card.grownAt} size="sm" locale={locale} />
              <figcaption className="mt-1 text-center text-[11px] text-ink-soft">{t("🏅 대표 동물")}</figcaption>
            </figure>
          )}
          <div className="min-w-0 flex-1">
            {/* 블로그 태그와 큰 이름은 컴퓨터 화면에서만, 휴대폰은 예전 크기 그대로 */}
            <span className="hidden rounded-full bg-honey px-3 py-1 text-sm font-bold text-sun-dark md:inline-block">{t("🏠 블로그")}</span>
            <Link href={`/@${blog.slug}`}>
              <h1 className="break-words font-display text-2xl leading-tight sm:text-3xl md:mt-2 md:text-5xl">{blog.title}</h1>
            </Link>
            {blog.description && <p className="mt-1 text-ink-soft">{blog.description}</p>}
            {/* 375px에서 줄이 넘치면 다음 줄로 내려간다 (NF-06) */}
            <p className="mt-2 text-sm text-ink-soft md:text-base">
              @{blog.slug} · {t("글 {n}", { n: blog.postCount })} · {t("이웃 {n}", { n: blog.followerCount })}
              {visits && (
                <>
                  {" · "}
                  <VisitCount blogId={blog.id} today={visits.today} total={visits.total} isOwner={isOwner} />
                </>
              )}
            </p>
          </div>
        </div>
        {/* 좁은 화면에서는 버튼 3개를 한 줄에 같은 너비로 놓고, 글자가 두 줄로 깨지지 않게 한다 (이슈 #5) */}
        <div className={isOwner ? "grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto" : "flex flex-wrap gap-2"}>
          {isOwner ? (
            <>
              <Link href="/write" className="btn whitespace-nowrap bg-leaf text-white max-sm:gap-1 max-sm:px-2 max-sm:text-sm">{t("✏️ 글쓰기")}</Link>
              <Link href="/closet" className="btn whitespace-nowrap bg-paper text-ink max-sm:gap-1 max-sm:px-2 max-sm:text-sm">{t("🎨 꾸미기")}</Link>
              <Link href="/settings/blog" className="btn whitespace-nowrap bg-paper text-ink max-sm:gap-1 max-sm:px-2 max-sm:text-sm">{t("⚙️ 관리")}</Link>
            </>
          ) : viewerId ? (
            <>
              {/* 이웃이면 이웃 버튼 왼쪽에 ☆ 즐겨찾기 (이웃 끊으면 즐겨찾기도 함께 사라진다) */}
              {following && <FavoriteStar key={blog.ownerId} followeeId={blog.ownerId} nickname={blog.nickname} favorite={favorite} />}
              <FollowButton ownerId={blog.ownerId} following={following} />
            </>
          ) : null}
        </div>
      </div>
      {/* isolate: 미니룸 안의 z-index(가구·버튼)가 위에 고정된 헤더를 넘어 올라오지 않게 */}
      <div className="relative isolate shrink-0 md:w-[46%] md:self-center md:p-3">
        <MiniRoom
          characterAsset={blog.characterAsset}
          backgroundAsset={blog.backgroundAsset}
          nickname={blog.nickname}
          furniture={furniture.map((f) => ({ id: f.itemId, assetKey: f.assetKey, x: f.x, y: f.y }))}
          pet={pet}
          characterSpot={blog.roomCharX != null && blog.roomCharY != null ? { x: blog.roomCharX, y: blog.roomCharY } : null}
          petSpot={blog.roomPetX != null && blog.roomPetY != null ? { x: blog.roomPetX, y: blog.roomPetY } : null}
          locale={locale}
          className="border-b-2 border-line md:rounded-2xl md:border-2"
        />
        {/* 미니룸 가구 배치는 꾸미기 화면 위쪽 미니룸에서 한다. 버튼은 위 오른쪽 구석에 (아래에 두면 바닥에 선 캐릭터·펫·닉네임을 가렸다) */}
        {isOwner && (
          <Link
            href="/closet?tab=room"
            className="btn absolute right-3 top-3 z-30 bg-paper/90 px-3 py-1 text-sm text-ink backdrop-blur-sm md:right-6 md:top-6"
            data-miniroom-edit
          >
            {t("미니룸 꾸미기 >")}
          </Link>
        )}
      </div>
    </section>
  );
}
