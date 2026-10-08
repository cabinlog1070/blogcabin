import Link from "next/link";
import { MiniRoom, type RoomPet } from "@/components/character";
import { PetCard } from "@/components/pet-art";
import { VisitCount } from "@/components/blog/visit-count";
import type { PetShowcase } from "@/server/farm";
import { toggleFollow } from "@/app/blog/actions";
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
};

/** 블로그 상단: 미니룸 + 블로그 정보 */
export function BlogHeader({
  blog,
  furniture = [],
  viewerId,
  following,
  pet,
  card,
  visits,
}: {
  blog: Blog;
  furniture?: PlacedFurniture[];
  pet?: RoomPet | null; // 주인이 데리고 다니는 펫 (미니룸에서 캐릭터 옆)
  card?: (PetShowcase & { grownAt: Date | null }) | null; // 프로필에 전시한 다 키운 동물 카드
  viewerId: string | null;
  following: boolean;
  visits?: { today: number; total: number }; // 방문자 수 (BLOG-06). 블로그 홈에서만
}) {
  const isOwner = viewerId === blog.ownerId;
  return (
    <section className="card overflow-hidden">
      <MiniRoom
        characterAsset={blog.characterAsset}
        backgroundAsset={blog.backgroundAsset}
        nickname={blog.nickname}
        furniture={furniture.map((f) => ({ id: f.itemId, assetKey: f.assetKey, x: f.x, y: f.y }))}
        pet={pet}
        className="h-56 border-b-2 border-line sm:h-64"
      />
      <div className="flex flex-wrap items-end justify-between gap-4 p-5">
        {card && (
          <figure className="-mt-16 shrink-0 sm:-mt-20" data-displayed-card={card.id}>
            <PetCard pet={card} grownAt={card.grownAt} size="sm" className="relative z-20" />
            <figcaption className="mt-1 text-center text-[11px] text-ink-soft">🏅 대표 동물</figcaption>
          </figure>
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/@${blog.slug}`}>
            <h1 className="font-display text-2xl sm:text-3xl">{blog.title}</h1>
          </Link>
          {blog.description && <p className="mt-1 text-ink-soft">{blog.description}</p>}
          {/* 375px에서 줄이 넘치면 다음 줄로 내려간다 (NF-06) */}
          <p className="mt-2 text-sm text-ink-soft">
            @{blog.slug} · 글 {blog.postCount} · 이웃 {blog.followerCount}
            {visits && (
              <>
                {" · "}
                <VisitCount blogId={blog.id} today={visits.today} total={visits.total} isOwner={isOwner} />
              </>
            )}
          </p>
        </div>
        {/* 좁은 화면에서는 버튼 3개를 한 줄에 같은 너비로 놓고, 글자가 두 줄로 깨지지 않게 한다 (이슈 #5) */}
        <div className={isOwner ? "grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto" : "flex gap-2"}>
          {isOwner ? (
            <>
              <Link href="/write" className="btn whitespace-nowrap bg-leaf text-white max-sm:gap-1 max-sm:px-2 max-sm:text-sm">✏️ 글쓰기</Link>
              <Link href="/closet" className="btn whitespace-nowrap bg-paper text-ink max-sm:gap-1 max-sm:px-2 max-sm:text-sm">🎨 꾸미기</Link>
              <Link href="/settings/blog" className="btn whitespace-nowrap bg-paper text-ink max-sm:gap-1 max-sm:px-2 max-sm:text-sm">⚙️ 관리</Link>
            </>
          ) : viewerId ? (
            <form action={toggleFollow.bind(null, blog.ownerId)}>
              <button className={`btn whitespace-nowrap ${following ? "bg-paper text-ink" : "bg-sky text-white"}`}>
                {following ? "✓ 이웃" : "+ 이웃 추가"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
