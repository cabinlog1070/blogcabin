// 릴리스 노트 (/release-notes). 주민이 읽는 업데이트 소식이다.
// 운영에 배포되는 변경(main 병합) 하나가 버전 하나다. 오늘(한국 시간) 날짜 묶음의 맨 위에 새 버전을 더하고, 그날 묶음이 없으면 새로 만든다.
// - date: 배포한 날(한국 시간) "YYYY-MM-DD", 최신이 맨 위
// - version: 바로 앞 버전에서 새 기능이 있으면 가운데 숫자를 올리고(1.7.3 → 1.8.0), 바뀐 점·고친 문제뿐이면 끝 숫자를 올린다(1.8.0 → 1.8.1)
// - title: 그 버전을 몇 낱말로
// - kind: new(새 기능) · improved(바뀐 점) · fixed(고친 문제)
// - text: 주민이 알아듣는 쉬운 말로 한 문장. 파일 이름·함수·마이그레이션 같은 개발 용어는 쓰지 않는다
// - admin: true면 관리자만 쓰는 기능 (화면에 '관리자' 표시)
// - images: 바뀐 모습을 보여 주는 화면 사진 (넣고 싶을 때만). 파일은 public/release-notes/<버전>/ 에 webp로 두고(가로 1200px 안쪽),
//   src는 "/release-notes/1.19.0/shop.webp"처럼 쓴다. alt는 사진을 말로 한 줄(msg()로 감싸고 일본어도 넣는다).
//   before에 바뀌기 전 사진을 같이 넣으면 화면에 [전]·[후]로 나란히 보인다
// 화면에 보이지 않는 배포·DB 작업만 바뀐 날은 적지 않아도 된다.
// 문장은 msg()로 감싸고 일본어를 src/lib/i18n/ja/release-notes.ts에 같이 넣는다 (npm run test:i18n이 확인한다).
import { msg } from "@/lib/i18n";

export type ReleaseChangeKind = "new" | "improved" | "fixed";

export type ReleaseImage = {
  /** public 아래 경로, "/release-notes/<버전>/이름.webp" */
  src: string;
  /** 사진을 말로 한 줄 (msg) */
  alt: string;
  /** 바뀌기 전 사진 (있으면 전·후로 나란히) */
  before?: string;
};

export type ReleaseChange = { kind: ReleaseChangeKind; text: string; admin?: boolean; images?: ReleaseImage[] };

export type ReleaseVersion = {
  version: string;
  /** 이 버전을 몇 낱말로 */
  title: string;
  changes: ReleaseChange[];
};

export type ReleaseDay = {
  date: string;
  /** 그날 배포한 버전들, 최신이 맨 위 */
  versions: ReleaseVersion[];
};

export const RELEASE_KIND_LABEL: Record<ReleaseChangeKind, string> = {
  new: msg("새 기능"),
  improved: msg("바뀐 점"),
  fixed: msg("고친 문제"),
};

export const RELEASE_NOTES: ReleaseDay[] = [
  {
    date: "2026-10-15",
    versions: [
      {
        version: "1.32.11",
        title: msg("맥 사파리 표 칸 한글 입력 고침"),
        changes: [
          { kind: "fixed", text: msg("맥 사파리에서 글쓰기 표의 빈 칸에 한글을 치면 글자 순서가 뒤집히고 굵은 글씨가 되던 문제를 고쳤어요.") },
        ],
      },
    ],
  },
  {
    date: "2026-10-14",
    versions: [
      {
        version: "1.32.10",
        title: msg("표 칸 한글 입력 고침"),
        changes: [
          { kind: "fixed", text: msg("사파리(맥·아이폰)에서 글쓰기 표 칸에 한글을 치면 두 번째 글자부터 순서가 뒤집혀 들어가던 문제를 고쳤어요.") },
        ],
      },
      {
        version: "1.32.9",
        title: msg("삼성 인터넷 다크 모드 안내"),
        changes: [
          { kind: "improved", text: msg("삼성 인터넷으로 처음 들어오면, 화면이 어둡게 보일 때 다크 모드를 끄는 방법을 한 번 알려 줘요.") },
        ],
      },
      {
        version: "1.32.8",
        title: msg("블로그 주소 오류"),
        changes: [
          { kind: "fixed", text: msg("블로그 주소(@아이디)로 들어가면 \"Internal Server Error\"가 뜨던 문제를 고쳤어요.") },
        ],
      },
      {
        version: "1.32.7",
        title: msg("알 둥지 넘침"),
        changes: [
          { kind: "fixed", text: msg("선물로 알을 많이 받으면 둥지에 다 못 들어간 알이 풀밭과 울타리 위로 줄지어 그려지던 문제를 고쳤어요. 둥지에는 알이 10개까지 보이고, 나머지는 둥지의 [+개수] 표시로 알려 줘요.") },
        ],
      },
    ],
  },
  {
    date: "2026-10-13",
    versions: [
      {
        version: "1.32.6",
        title: msg("삼성 인터넷 광장 색"),
        changes: [
          { kind: "fixed", text: msg("삼성 인터넷에서 광장 그림이 뿌옇고 흐리게 보이던 문제를 고쳤어요.") },
          { kind: "fixed", text: msg("일부 안드로이드 휴대폰에서 광장의 주민이 깜빡이거나 이웃 집이 사라지던 문제를 고쳤어요.") },
        ],
      },
      {
        version: "1.32.5",
        title: msg("갤럭시에서 어두워지던 화면"),
        changes: [
          {
            kind: "fixed",
            text: msg("갤럭시 휴대폰 등에서 브라우저가 화면을 멋대로 어둡게 바꿔 색이 이상하게 보이던 문제를 고쳤어요. 이제 원래 밝은 색으로 보여요."),
            images: [{ src: "/release-notes/1.32.5/pet-light-after.webp", alt: msg("밝은 색으로 보이는 농장 펫 상태창"), before: "/release-notes/1.32.5/pet-light-before.webp" }],
          },
        ],
      },
      {
        version: "1.32.4",
        title: msg("선물 받은 알에서 농장으로"),
        changes: [
          { kind: "improved", text: msg("받은 선물 화면과 선물 팝업에서 펫 알을 누르면 동물 농장으로 바로 가요. 펫 알을 받은 선물 팝업에는 [농장으로 가기] 버튼도 있어요.") },
        ],
      },
      {
        version: "1.32.3",
        title: msg("저녁 광장 캐릭터 밝기"),
        changes: [
          { kind: "fixed", text: msg("저녁·밤에 광장에 들어가면 캐릭터와 이웃이 잠깐 낮처럼 밝다가 어두워지던 문제를 고쳤어요. 이제 처음부터 광장과 같은 밤빛이에요.") },
        ],
      },
      {
        version: "1.32.2",
        title: msg("불꽃놀이 구경 자리"),
        changes: [
          { kind: "improved", text: msg("저녁에 불꽃놀이를 구경하는 이웃이 광장 맨 위 덤불 바로 아래, 가운데 길 끝 둘레에 서요. 집과 겹치지 않아요.") },
        ],
      },
      {
        version: "1.32.1",
        title: msg("미니룸·농장 끝자리 크기"),
        changes: [
          {
            kind: "fixed",
            text: msg("미니룸 오른쪽 끝에 세운 캐릭터와 펫, 농장 오른쪽 울타리 쪽으로 간 동물이 갑자기 작아지던 문제를 고쳤어요. 이제 어디에 있어도 크기가 같아요."),
            images: [{ src: "/release-notes/1.32.1/miniroom-edge-after.webp", alt: msg("미니룸 오른쪽 끝에서도 같은 크기로 서 있는 캐릭터와 펫"), before: "/release-notes/1.32.1/miniroom-edge-before.webp" }],
          },
          { kind: "fixed", text: msg("아이폰에서 광장의 [이웃집] 버튼에 ▶와 ▾ 표시가 함께 보이던 문제를 고쳤어요.") },
          { kind: "fixed", text: msg("미니룸 끝에 선 캐릭터의 닉네임이 잘리지 않고, 컴퓨터 화면의 [미니룸 꾸미기] 버튼은 바닥을 가리지 않게 위 오른쪽으로 옮겼어요.") },
          {
            kind: "fixed",
            text: msg("휴대폰에서 즐겨찾기가 꽉 찼을 때 나오는 안내 글씨가 잘리던 문제를 고쳤어요. 이제 버튼 아래에 보여요."),
            images: [{ src: "/release-notes/1.32.1/favorite-message-after.webp", alt: msg("즐겨찾기 버튼 아래에 다 보이는 안내 글씨"), before: "/release-notes/1.32.1/favorite-message-before.webp" }],
          },
        ],
      },
      {
        version: "1.32.0",
        title: msg("꾸미기 머리 색과 펫 알 선물"),
        changes: [
          { kind: "new", text: msg("꾸미기의 헤어 칸에서도 머리 색을 고를 수 있어요. 고른 색은 [저장하기]를 누르면 광장과 미니룸에 보여요."), images: [{ src: "/release-notes/1.32.0/closet-hair-color.webp", alt: msg("꾸미기 헤어 칸 위의 머리 색 10가지") }] },
          { kind: "new", text: msg("나올 펫이 정해진 알은 농장에서 어떤 펫 알인지 보여요."), images: [{ src: "/release-notes/1.32.0/farm-egg.webp", alt: msg("고양이가 나오는 알이라고 알려 주는 농장 알 창") }] },
          { kind: "new", text: msg("선물 보내기에서 펫도 골라 보낼 수 있어요. 고른 펫이 태어나는 알이 주민의 농장 둥지에 들어가요."), admin: true, images: [{ src: "/release-notes/1.32.0/admin-gift-pets.webp", alt: msg("선물 보내기의 펫 탭에서 고른 펫 알") }] },
          { kind: "improved", text: msg("예전에 상점에서 팔던 캐릭터(모험가·고양이·강아지·토끼·여우·판다·로봇·드래곤·유니콘)를 없앴어요. 가지고 있던 주민에게는 그 동물이 태어나는 펫 알을 선물로 드려요(판다는 곰, 로봇은 공룡, 모험가는 강아지). 이 캐릭터를 쓰던 주민은 기본 주민 모습으로 바뀌고, 꾸미기의 캐릭터 칸도 없어졌어요. 모습은 헤어로 바꿔요."), images: [{ src: "/release-notes/1.32.0/pet-egg-gift.webp", alt: msg("예전 캐릭터 대신 고양이 알을 받은 선물 팝업") }] },
          { kind: "fixed", text: msg("선물 보내기의 아이템 목록에는 상점에서 파는 아이템만 나오고, 다른 탭으로 옮겨도 고른 아이템이 그대로 보내져요."), admin: true },
        ],
      },
      {
        version: "1.31.1",
        title: msg("펫 꾸미기 자리"),
        changes: [
          {
            kind: "improved",
            text: msg("펫 꾸미기의 꽃이 펫마다 머리 위 귀나 뿔 옆에 꽂혀요. 거북이의 리본·스카프는 얼굴을 가리지 않게 턱 밑으로, 알 속 아기 병아리의 리본은 머리 위로 옮겼어요."),
            images: [{ src: "/release-notes/1.31.1/pet-accessory-after.webp", alt: msg("거북이·원숭이·여우가 리본·꽃·스카프를 한 모습"), before: "/release-notes/1.31.1/pet-accessory-before.webp" }],
          },
        ],
      },
      {
        version: "1.31.0",
        title: msg("물가에서 낚시하는 이웃"),
        changes: [
          { kind: "new", text: msg("광장을 돌아다니는 이웃이 가끔 아래 물가에 서서 낚시를 해요. 운이 좋으면 물고기를 낚아요."), images: [{ src: "/release-notes/1.31.0/fishing.webp", alt: msg("물가에서 낚싯대를 드리운 이웃") }] },
          { kind: "new", text: msg("저녁에 불꽃놀이가 터지면 이웃 한두 명이 광장 위쪽으로 가서 하늘을 올려다보며 구경해요."), images: [{ src: "/release-notes/1.31.0/fireworks.webp", alt: msg("불꽃놀이를 올려다보는 이웃") }] },
          { kind: "improved", text: msg("캠프파이어에서 마시멜로를 굽는 이웃은 한 번에 두 명까지예요.") },
        ],
      },
      {
        version: "1.30.0",
        title: msg("휴대폰 조이스틱"),
        changes: [
          { kind: "new", text: msg("휴대폰·태블릿 광장에서 화면을 누르면 그 자리에 반투명 조이스틱이 나타나요. 누른 채 밀면 그쪽으로 걷고, 손을 떼면 조이스틱이 사라져요."), images: [{ src: "/release-notes/1.30.0/joystick.webp", alt: msg("누른 자리에 나타난 반투명 조이스틱") }] },
          { kind: "improved", text: msg("끌지 않고 톡 치면 예전처럼 그곳으로 걸어가거나 건물에 들어가요. 태블릿 왼쪽 아래에 늘 떠 있던 조이스틱은 없어졌어요.") },
        ],
      },
      {
        version: "1.29.2",
        title: msg("상점 저장하기 다듬기"),
        changes: [{ kind: "improved", text: msg("상점에서 [저장하기]를 눌러도 광장으로 나가지 않고 상점에 그대로 있어요. 입어 보거나 머리 색을 골라 본 것은 [저장하기]를 눌러야 저장되고, 누르지 않고 나가면 원래 모습 그대로예요."), images: [{ src: "/release-notes/1.29.2/shop-saved.webp", alt: msg("저장한 뒤 상점에 그대로 있는 화면") }] }],
      },
      {
        version: "1.29.1",
        title: msg("알림 3초 뒤 사라짐"),
        changes: [
          { kind: "improved", text: msg("상점에서 산 뒤, 꾸미기·즐겨찾기·이웃 저장·초대 링크 복사 뒤에 뜨는 알림도 농장처럼 3초 뒤에 저절로 사라져요.") },
        ],
      },
      {
        version: "1.29.0",
        title: msg("관리자 선물"),
        changes: [
          { kind: "new", text: msg("관리자가 보낸 선물이 도착하면 알림과 함께 선물 팝업이 떠요. 관리자가 적은 말과 받은 코인·아이템을 보여 주고, 받은 아이템은 바로 내 것이 돼요."), images: [{ src: "/release-notes/1.29.0/gift-popup.webp", alt: msg("선물이 도착하면 뜨는 팝업") }] },
          { kind: "new", text: msg("관리자 화면에서 주민을 한 명 이상(또는 모든 주민) 골라 코인과 아이템을 선물하고, 보낼 때마다 함께 보낼 말을 적을 수 있어요."), admin: true, images: [{ src: "/release-notes/1.29.0/gift-admin.webp", alt: msg("관리자 화면의 선물 보내기") }] },
        ],
      },
      {
        version: "1.28.0",
        title: msg("관리자 글 관리"),
        changes: [
          { kind: "new", text: msg("관리자 화면에 글 관리가 생겼어요. 기간 제한 없이 모든 글과 댓글을 탭으로 나눠 최신순으로 보고, 찾고, 지울 수 있어요."), admin: true, images: [{ src: "/release-notes/1.28.0/admin-posts.webp", alt: msg("관리자 화면의 글 관리") }] },
        ],
      },
      {
        version: "1.27.0",
        title: msg("반딧불이가 날아다니는 저녁 광장"),
        changes: [
          { kind: "new", text: msg("저녁부터 밤까지 광장과 숲 위로 반딧불이가 은은하게 깜빡이며 떠다녀요."), images: [{ src: "/release-notes/1.27.0/fireflies.webp", alt: msg("저녁 광장에 떠다니는 반딧불이") }] },
          { kind: "improved", text: msg("밤 광장의 가로등 불빛을 연하게 바꿨어요.") },
        ],
      },
      {
        version: "1.26.3",
        title: msg("상태 메시지 이모티콘"),
        changes: [
          { kind: "fixed", text: msg("광장 말풍선에서 이모티콘이 네모로 깨져 보이던 문제를 고쳤어요. 이제 상태 메시지에는 이모티콘을 쓸 수 없고, 이미 적어 둔 이모티콘은 말풍선에서 빼고 보여 줘요.") },
        ],
      },
      {
        version: "1.26.2",
        title: msg("블로그 카테고리 한 번에 바뀌게"),
        changes: [{ kind: "fixed", text: msg("블로그 홈에서 [전체 글]을 보다가 다른 카테고리를 누르면 주소만 바뀌고 글 목록은 그대로라서 두 번 눌러야 하던 문제를 고쳤어요.") }],
      },
      {
        version: "1.26.1",
        title: msg("광장으로 돌아오면 있던 자리에"),
        changes: [
          { kind: "improved", text: msg("광장에서 건물에 들어갔다가 뒤로 가기나 [광장으로 나가기]로 돌아오면, 캐릭터가 떠나기 전 자리에 그대로 서 있어요. 사이트를 새로 열면 처음처럼 캠프파이어 앞에서 시작해요.") },
        ],
      },
      {
        version: "1.26.0",
        title: msg("댓글 고치기"),
        changes: [
          { kind: "new", text: msg("내가 남긴 댓글과 답글을 [수정]으로 고칠 수 있어요. 고친 댓글에는 작은 '수정됨' 표시가 붙어요."), images: [{ src: "/release-notes/1.26.0/comment-edit.webp", alt: msg("'수정됨' 표시가 붙은 댓글과 답글") }] },
        ],
      },
      {
        version: "1.25.0",
        title: msg("새 머리 스타일과 머리 색"),
        changes: [
          { kind: "new", text: msg("상점 헤어에 새 머리 스타일 8가지가 들어왔어요: 스포츠 머리, 바가지 머리, 단발, 삐죽 머리, 양갈래, 포니테일, 곱슬 머리, 양쪽 똥머리.") },
          { kind: "new", text: msg("상점 헤어 탭에서 머리 색을 무료로 바꿀 수 있어요. 검정, 갈색, 밝은 갈색, 금발, 빨강, 분홍, 파랑, 보라, 민트 중에서 고르면 바로 광장 캐릭터에도 보여요."), images: [{ src: "/release-notes/1.25.0/hair-shop.webp", alt: msg("상점 헤어 탭의 머리 색과 새 머리 스타일") }] },
        ],
      },
      {
        version: "1.24.0",
        title: msg("새로워진 꾸미기 화면"),
        changes: [
          { kind: "new", text: msg("꾸미기 화면이 캐릭터 꾸미기, 미니룸 꾸미기, 집 테마 세 칸으로 나뉘었어요. 컴퓨터에서는 왼쪽에 미니룸을 보면서 오른쪽에서 골라요."), images: [{ src: "/release-notes/1.24.0/closet.webp", alt: msg("세 칸으로 나뉜 꾸미기 화면") }] },
          { kind: "new", text: msg("캐릭터 꾸미기는 상점처럼 헤어·모자·상의·하의·신발로 나뉘어 있어요.") },
          { kind: "new", text: msg("미니룸에서 가구를 누르면 바로 그 가구의 색을 바꿀 수 있어요. 가구는 바닥 가구와 벽 장식으로 나뉘어 있어요.") },
          { kind: "improved", text: msg("이것저것 골라 입어 보고 꾸며 본 뒤, 저장하기를 눌러야 저장돼요. 마음에 안 들면 되돌리기를 누르세요.") },
        ],
      },
      {
        version: "1.23.0",
        title: msg("머리 바꾸기"),
        changes: [
          { kind: "new", text: msg("캐릭터 꾸미기에 헤어가 생겼어요. 처음 고른 머리를 그대로 갖고 시작하고, 짧은 머리와 긴 머리는 상점에서 0코인에 받아 언제든 바꿔 쓸 수 있어요."), images: [{ src: "/release-notes/1.23.0/hair.webp", alt: msg("캐릭터 꾸미기의 헤어 칸") }] },
        ],
      },
      {
        version: "1.22.1",
        title: msg("광장 하늘 다듬기"),
        changes: [
          { kind: "fixed", text: msg("광장을 돌아다닐 때 산 앞 덤불 위에 검은 가로줄이 깜빡이던 문제를 고쳤어요.") },
          { kind: "improved", text: msg("구름이 산 근처에만 모여 있지 않고 하늘 전체에 고루 떠 있어요.") },
        ],
      },
      {
        version: "1.22.0",
        title: msg("글 예약 발행"),
        changes: [
          { kind: "new", text: msg("글쓰기에서 [⏰ 예약하기]를 누르고 날짜와 시간(한국 시간)을 정하면, 그 시간에 글이 올라가요. 올라가기 전까지는 내 블로그에서 나만 볼 수 있고, 시간을 바꾸거나 바로 올릴 수도 있어요."), images: [{ src: "/release-notes/1.22.0/schedule.webp", alt: msg("글쓰기 화면의 예약하기") }] },
          { kind: "new", text: msg("공지 글을 올릴 때 광장 게시판 맨 위에 몇 시간 걸어 둘지 고를 수 있어요. 걸지 않기부터 7일까지 고를 수 있어요."), admin: true },
        ],
      },
      {
        version: "1.21.0",
        title: msg("옷 종류별로 보는 상점"),
        changes: [
          { kind: "new", text: msg("상점의 아바타 꾸미기를 헤어, 모자, 상의, 하의, 신발로 나눠서 볼 수 있어요. 기모노처럼 한 벌로 된 옷은 상의에 있어요."), images: [{ src: "/release-notes/1.21.0/shop-tabs.webp", alt: msg("옷 종류별로 나뉜 상점") }] },
          { kind: "new", text: msg("미리 입어 본 옷을 [저장하기]로 바로 입고 광장에 나갈 수 있어요. 아직 없는 옷은 그때 한꺼번에 사요.") },
        ],
      },
      {
        version: "1.20.0",
        title: msg("내 마음대로 꾸미는 미니룸"),
        changes: [
          { kind: "new", text: msg("꾸미기 화면의 미니룸에서 내 캐릭터를 끌어 원하는 자리에 세울 수 있어요.") },
          { kind: "new", text: msg("데리고 다니는 펫을 미니룸에 놓으면 방 안을 자유롭게 돌아다녀요. 미니룸 밖으로 끌어내면 다시 캐릭터 옆으로 와요."), images: [{ src: "/release-notes/1.20.0/miniroom-pet.webp", alt: msg("미니룸을 돌아다니는 펫") }] },
          { kind: "improved", text: msg("미니룸에 놓을 수 있는 가구 수 제한(5개)이 없어졌어요. 가진 가구를 모두 꺼내 방을 꾸며 보세요.") },
          { kind: "improved", text: msg("우주선·구름·무지개는 벽에만 붙고, 창문과 액자를 가리지 않는 자리로 놓여요.") },
        ],
      },
      {
        version: "1.19.0",
        title: msg("펫 골라서 꾸미기"),
        changes: [
          { kind: "new", text: msg("펫 꾸미기 창에서 농장 펫이나 다 자란 동물 카드를 하나 골라 꾸미기, 색, 이름을 한곳에서 바꿀 수 있어요. 상태창의 [꾸미기 · 이름 · 색 바꾸기] 버튼으로도 바로 열려요."), images: [{ src: "/release-notes/1.19.0/pet-decorate.webp", alt: msg("펫 꾸미기 창") }] },
          { kind: "improved", text: msg("다 자란 동물 카드가 카드 도감 칸에 바로 들어가요. 같은 동물 카드가 여러 장이면 칸에 장수가 붙고, 누르면 골라 볼 수 있어요."), images: [{ src: "/release-notes/1.19.0/card-book.webp", alt: msg("카드 도감") }] },
          { kind: "new", text: msg("알 받기 칸 오른쪽 위의 i 버튼을 누르면 알에서 어떤 펫이 몇 % 확률로 나오는지 볼 수 있어요."), images: [{ src: "/release-notes/1.19.0/hatch-odds.webp", alt: msg("알에서 나오는 펫 확률") }] },
          { kind: "new", text: msg("펫 색이 6가지 더 생겼어요: 주황색, 민트색, 하늘색, 보라색, 회색, 초록색.") },
          { kind: "improved", text: msg("농장 위쪽에 뜨는 알림은 3초 뒤에 저절로 사라져요.") },
          { kind: "improved", text: msg("알 둥지에 삐져나와 있던 갈색 나뭇가지를 치워 깔끔한 짚 둥지로 바꿨어요.") },
        ],
      },
      {
        version: "1.18.2",
        title: msg("간결해진 첫 화면과 시작 캐릭터"),
        changes: [
          { kind: "improved", text: msg("휴대폰 첫 화면이 간결해졌어요. 소개 글 없이 로그인이 맨 위에 있고, 두 주민 사이에 BlogCabin 로고가 있어요."), images: [{ src: "/release-notes/1.18.2/landing-phone.webp", alt: msg("간결해진 휴대폰 첫 화면") }] },
          { kind: "improved", text: msg("로그인 전 화면 위쪽의 [시작하기] 버튼을 없앴어요.") },
          { kind: "improved", text: msg("처음 고르는 캐릭터 이름이 남자·여자 주민에서 짧은 머리·긴 머리로 바뀌었어요.") },
          { kind: "fixed", text: msg("긴 머리 주민 얼굴에 머리색이 비쳐 얼굴이 어둡게 보이던 문제를 고쳤어요.") },
        ],
      },
      {
        version: "1.18.1",
        title: msg("공지사항 블로그 이름 고정"),
        changes: [
          { kind: "improved", text: msg("공지사항 블로그 이름은 이제 고정돼서 블로그 관리에서 바꿀 수 없어요."), admin: true, images: [{ src: "/release-notes/1.18.1/admin-title.webp", alt: msg("바꿀 수 없게 된 공지사항 블로그 이름") }] },
          { kind: "fixed", text: msg("관리자가 블로그 관리 기본 정보를 저장할 때 블로그 이름이 12자를 넘는다며 저장되지 않던 문제를 고쳤어요."), admin: true },
        ],
      },
      {
        version: "1.18.0",
        title: msg("더 넓어진 동물 농장"),
        changes: [
          { kind: "new", text: msg("새 동물 14종이 알에서 나와요: 강아지, 호랑이, 드래곤, 너구리, 원숭이, 고양이, 곰, 여우, 햄스터, 유니콘, 늑대, 거북이, 공룡, 두더지. 드래곤과 유니콘은 아주 드물게 나와요.") },
          { kind: "new", text: msg("펫 꾸미기에서 펫 색을 고를 수 있어요. 기본 색, 갈색, 노란색, 빨간색, 검정색, 흰색, 분홍색 중에서 무료로 바꿔요.") },
          { kind: "new", text: msg("알 둥지에 [모두 부화시키기] 버튼이 생겨서 둥지의 알을 한 번에 부화시킬 수 있어요.") },
          { kind: "improved", text: msg("알 둥지에 알을 10개까지 놓을 수 있고, 풀밭에서는 동물을 한 번에 10마리까지 키울 수 있어요.") },
        ],
      },
      {
        version: "1.17.0",
        title: msg("광장을 돌아다니는 이웃"),
        changes: [
          { kind: "new", text: msg("즐겨찾기한 이웃이 데리고 다니는 펫과 함께 광장을 돌아다녀요. 캠프파이어 의자에 앉아 쉬거나 기타를 치고, 그 옆에서 노래를 부르고, 펫을 쓰다듬고, 꽃에 물을 주고, 마시멜로를 구워 먹기도 해요.") },
          { kind: "new", text: msg("블로그 관리에서 상태 메시지를 적어 두면, 이웃이 광장에서 내 캐릭터에게 다가왔을 때 머리 위에 말풍선으로 떠올라요.") },
        ],
      },
      {
        version: "1.16.0",
        title: msg("바다 모험 옷, 공룡 옷, 한복과 기모노"),
        changes: [
          { kind: "new", text: msg("상점에 바다 모험 옷 6가지가 들어왔어요. 모험 조끼, 선장 코트, 선원 바지, 샌들, 해적 모자, 반다나를 밀짚모자와 같이 입어 보세요.") },
          { kind: "new", text: msg("공룡 모자, 공룡 옷, 공룡 바지, 공룡 발도 들어왔어요. 네 가지를 다 입으면 꼬리 달린 공룡 점프수트가 돼요.") },
          { kind: "new", text: msg("한복 저고리, 한복 치마, 한복 바지, 꽃신과 기모노, 게타도 들어왔어요.") },
        ],
      },
      {
        version: "1.15.0",
        title: msg("새 가구 9가지와 가구 색"),
        changes: [
          { kind: "new", text: msg("상점에 새 가구 9가지가 들어왔어요. 책장, 티비, 곰인형, 러그, 게임기, 우주선, 꽃바구니, 구름, 무지개로 방을 꾸며 보세요. 러그는 바닥에 깔리고, 구름과 무지개는 방 안에 둥실 떠 있어요.") },
          { kind: "new", text: msg("꾸미기 화면에서 가진 가구마다 색을 고를 수 있어요. 나무, 분홍, 하늘, 민트, 노랑, 보라, 하양, 남색 중에서 방 테마에 맞춰 골라 보세요. 무료예요.") },
        ],
      },
      {
        version: "1.14.0",
        title: msg("크레용으로 다시 그린 마을"),
        changes: [
          { kind: "new", text: msg("광장 위쪽에 하늘과 산이 열리고, 내 집 아래쪽은 선착장이 있는 호숫가가 되었어요. 밤에는 별이 뜨고 하늘 여기저기서 불꽃놀이가 터져요. 가끔 토끼나 고양이 얼굴 불꽃도 나와요.") },
          { kind: "improved", text: msg("마을 그림 전체를 부드러운 파스텔 크레용 그림체로 바꿨어요. 나무, 꽃, 상점, 동물 농장, 주민, 가구, 방 배경, 펫이 모두 새 그림이에요.") },
        ],
      },
      {
        version: "1.13.1",
        title: msg("숲으로 둘러싸인 광장"),
        changes: [
          { kind: "fixed", text: msg("큰 컴퓨터 화면에서 광장 오른쪽에 길이 끊긴 빈 잔디가 남던 문제를 고쳤어요. 이제 걸을 수 있는 곳 바깥을 숲이 빙 둘러싸서, 광장이 숲 속 빈터처럼 보여요.") },
        ],
      },
    ],
  },
  {
    date: "2026-10-12",
    versions: [
      {
        version: "1.13.0",
        title: msg("다른 말로 쓴 글 번역하기"),
        changes: [
          { kind: "new", text: msg("일본어로 쓴 글을 한국어 화면에서 열면(또는 그 반대) 본문 위에 번역 버튼이 생겨요. 컴퓨터의 크롬에서는 그 자리에서 번역되고 원문과 오갈 수 있고, 다른 브라우저에서는 파파고에서 번역해 보여 줘요.") },
        ],
      },
      {
        version: "1.12.0",
        title: msg("서로 이웃과 나를 이웃한 사람 보기"),
        changes: [
          { kind: "new", text: msg("내 블로그 홈의 이웃 칸이 내 이웃 · 서로 이웃 · 나를 이웃한 사람 세 탭으로 나뉘었어요. 나를 이웃한 사람 옆의 「+ 이웃」을 누르면 바로 서로 이웃이 돼요.") },
        ],
      },
      {
        version: "1.11.1",
        title: msg("마을 소식에서 이전 글·다음 글"),
        changes: [
          { kind: "improved", text: msg("마을 소식에서 연 글은 [이전 글]·[다음 글]이 같은 사람의 글이 아니라 마을 소식 목록 순서대로 넘어가요.") },
        ],
      },
      {
        version: "1.11.0",
        title: msg("글에 표 넣기"),
        changes: [
          { kind: "new", text: msg("글쓰기 도구에 ▦ 표 버튼이 생겼어요. 행과 열 수를 골라 표를 넣고, 표 안을 누르면 행·열 넣기와 지우기, 칸 합치기, 제목 행 켜기를 할 수 있어요.") },
          { kind: "new", text: msg("글 읽는 화면에서 표가 깔끔한 칸으로 보이고, 휴대폰에서 표가 넓으면 표만 옆으로 밀어서 볼 수 있어요.") },
        ],
      },
      {
        version: "1.10.0",
        title: msg("사진 슬라이드·나란히 놓기"),
        changes: [
          { kind: "new", text: msg("글쓰기에서 🎞 슬라이드 버튼으로 사진 여러 장을 한 번에 넣으면, 읽을 때 컴퓨터는 화살표로, 휴대폰은 손가락으로 옆으로 넘겨 볼 수 있어요.") },
          { kind: "new", text: msg("글쓰기에서 ▥ 나란히 버튼으로 사진을 한 줄에 5장까지 나란히 놓을 수 있어요.") },
        ],
      },
      {
        version: "1.9.5",
        title: msg("일본어 화면 글쓰기 이름"),
        changes: [
          { kind: "improved", text: msg("일본어 화면에서 「記事を書く」라고 보이던 글쓰기 버튼과 안내를 「ブログを書く」로 바꿨어요.") },
        ],
      },
      {
        version: "1.9.4",
        title: msg("글 본문 칸 넘침 고침, 줄 간격 좁게"),
        changes: [
          { kind: "fixed", text: msg("글 읽는 화면에서 붙여 넣은 글 등의 띄어쓰기에서 줄이 안 바뀌어 본문이 칸 밖으로 넘치던 문제를 고쳤어요.") },
          { kind: "improved", text: msg("글 본문의 기본 줄 간격을 1.2로 좁혔어요. 글쓰기에서 더 좁은 간격(1.0)도 고를 수 있어요.") },
        ],
      },
      {
        version: "1.9.3",
        title: msg("보상 못 받은 이유 알려 주기"),
        changes: [
          { kind: "improved", text: msg("글을 발행했는데 보상을 못 받았으면, 비공개 글인지·본문이 짧은지·오늘 보상을 다 받았는지 중 실제 이유 하나만 알려 줘요.") },
        ],
      },
      {
        version: "1.9.2",
        title: msg("릴리스 노트를 버전별로"),
        changes: [
          { kind: "improved", text: msg("릴리스 노트를 업데이트(버전)마다 나눠 적고, 날짜를 누르면 그날 업데이트가 펼쳐지게 바꿨어요.") },
        ],
      },
      {
        version: "1.9.1",
        title: msg("공지 글 눈에 띄게"),
        changes: [
          { kind: "improved", text: msg("마을 소식에서 공지사항 글은 진한 나무색 카드에 📢 공지 표시가 붙어 다른 글과 한눈에 구분돼요.") },
        ],
      },
      {
        version: "1.9.0",
        title: msg("줄 간격 고르기"),
        changes: [
          { kind: "new", text: msg("글쓰기에서 문단마다 줄 간격을 고를 수 있어요. 글을 읽는 화면에도 고른 간격 그대로 보여요.") },
        ],
      },
      {
        version: "1.8.1",
        title: msg("회원 관리 표 고침"),
        changes: [
          { kind: "fixed", text: msg("휴대폰이나 좁은 창에서 회원 관리의 전체 회원 표 글씨가 한 자씩 쪼개지던 문제를 고쳤어요. 좁은 화면에서는 회원마다 카드로 보여요."), admin: true },
        ],
      },
      {
        version: "1.8.0",
        title: msg("공지사항 블로그와 기본 이웃"),
        changes: [
          { kind: "new", text: msg("모든 주민이 공지사항 블로그와 기본으로 이웃이 돼요. 공지는 쓴 뒤 일주일 동안 마을 소식 맨 위에 보여요.") },
        ],
      },
      {
        version: "1.7.3",
        title: msg("일본어 화면 글씨 넘침 고침"),
        changes: [
          { kind: "fixed", text: msg("일본어 화면에서 광장 게시판 간판과 출석 체크·릴리스 노트 같은 화면의 글씨가 칸 밖으로 넘치던 문제를 고쳤어요.") },
        ],
      },
      {
        version: "1.7.2",
        title: msg("글쓰기 도구 모음 정리"),
        changes: [
          { kind: "improved", text: msg("글쓰기 도구 모음을 정리했어요. 컴퓨터에서는 두 줄로, 휴대폰에서는 글자·정렬·목록 버튼을 누르면 그 도구가 아랫줄에 펼쳐져요.") },
        ],
      },
      {
        version: "1.7.1",
        title: msg("관리자 캐릭터 바꾸기"),
        changes: [
          { kind: "improved", text: msg("관리자 캐릭터가 여자 주민으로 바뀌었어요."), admin: true },
        ],
      },
      {
        version: "1.7.0",
        title: msg("일본어 화면"),
        changes: [
          { kind: "new", text: msg("화면 아래나 내 정보 메뉴에서 언어를 한국어·일본어 중에 고를 수 있어요. 메뉴·버튼·안내가 바뀌고, 주민이 쓴 글과 이름은 쓴 그대로예요.") },
        ],
      },
      {
        version: "1.6.0",
        title: msg("릴리스 노트"),
        changes: [
          { kind: "new", text: msg("내 정보 메뉴의 문의하기 아래에 릴리스 노트가 생겼어요. 업데이트될 때마다 여기에 소식을 올려요.") },
        ],
      },
      {
        version: "1.5.0",
        title: msg("닉네임 바꾸기, 아이폰 그림 선명하게"),
        changes: [
          { kind: "new", text: msg("환경 설정의 기본 정보에서 닉네임을 바꿀 수 있어요. 2~12자이고, 다른 주민이 쓰는 닉네임은 쓸 수 없어요.") },
          { kind: "fixed", text: msg("아이폰(사파리)에서 크레용 그림이 뭉개져 보이던 문제를 고쳤어요.") },
          { kind: "improved", text: msg("비공개 글도 언제나 볼 수 있어요."), admin: true },
        ],
      },
    ],
  },
  {
    date: "2026-10-11",
    versions: [
      {
        version: "1.4.1",
        title: msg("광장 준비 안내, 오늘의 퀘스트 바뀜"),
        changes: [
          { kind: "improved", text: msg("오늘의 퀘스트가 30자 이상 글 쓰기, 이웃 글 공감 5개, 이웃에게 댓글 3개로 바뀌었고, 출석 체크 화면에서 몇 번 했는지와 어디서 하면 되는지 보여 줘요.") },
          { kind: "improved", text: msg("광장이 처음 열릴 때 빈 화면으로 오래 멈추지 않고, 준비 중이라고 알려 줘요.") },
        ],
      },
      {
        version: "1.4.0",
        title: msg("크레용 그림체"),
        changes: [
          { kind: "new", text: msg("광장 건물·주민·농장 동물·가구·미니룸 배경·아이콘까지 그림 전체를 크레용으로 그린 그림체로 바꿨어요.") },
        ],
      },
      {
        version: "1.3.1",
        title: msg("소셜 계정 연동 고침"),
        changes: [
          { kind: "improved", text: msg("네이버 로그인은 네이버 검수가 끝날 때까지 잠시 쉬어요. 쓸 수 있는 로그인 버튼만 보여요.") },
          { kind: "fixed", text: msg("카카오·네이버 계정 연동이 실패하던 문제를 고쳤어요.") },
        ],
      },
      {
        version: "1.3.0",
        title: msg("블로그 홈 새 배치, 글쓰기 툴바, 소셜 로그인 연동"),
        changes: [
          { kind: "new", text: msg("블로그 홈을 새로 배치했어요. 머리 카드 왼쪽에 블로그 정보, 오른쪽에 미니룸과 꾸미기 버튼이 있고, 글 목록을 정렬하거나 목록·바둑판으로 볼 수 있어요.") },
          { kind: "new", text: msg("글쓰기에 티스토리 같은 툴바가 생겼어요. 본문·제목·부제목, 글자 크기, 정렬, 글자색·배경색을 고를 수 있어요.") },
          { kind: "new", text: msg("카카오·구글 계정을 내 아이디에 연동할 수 있어요. 처음 연동하면 소셜 계정마다 코인 100을 받아요.") },
          { kind: "new", text: msg("소셜로 처음 로그인하면 새 아이디를 만들거나 이미 있는 아이디에 합칠 수 있어요. 한 사람은 아이디 하나로 지내요.") },
          { kind: "new", text: msg("이웃인 남의 블로그 헤더에서 ☆을 눌러 즐겨찾기할 수 있어요.") },
          { kind: "improved", text: msg("비공개 글은 주인과 서로 이웃만 볼 수 있어요.") },
          { kind: "improved", text: msg("휴대폰 블로그 홈 순서를 마을 검색 → 내 이웃 → 카테고리 → 글 목록으로 바꾸고, 친구 초대는 맨 아래로 옮겼어요.") },
          { kind: "improved", text: msg("미니룸 캐릭터·펫을 조금 작게 하고 가만히 서 있게 했어요. 꾸미기 화면의 미니룸도 블로그 미니룸과 같은 모양이에요.") },
          { kind: "fixed", text: msg("휴대폰에서 광장 글씨와 그림이 흐릿하게 보이던 문제를 고쳤어요.") },
          { kind: "fixed", text: msg("내 정보 창 위로 미니룸 가구가 올라오고, 창을 누르면 광장 캐릭터가 걸어가던 문제를 고쳤어요.") },
          { kind: "fixed", text: msg("휴대폰에서 스크롤하면 미니룸 꾸미기 버튼이 위 헤더를 덮던 문제를 고쳤어요.") },
          { kind: "new", text: msg("회원을 검색하고, 회원별로 글·댓글을 지우거나 강제 탈퇴시킬 수 있어요."), admin: true },
        ],
      },
    ],
  },
  {
    date: "2026-10-09",
    versions: [
      {
        version: "1.2.2",
        title: msg("새 아이콘"),
        changes: [
          { kind: "improved", text: msg("화면 곳곳의 이모지를 직접 그린 아이콘 33개로 바꾸고, 가구 5종과 배경 6종도 새로 그렸어요.") },
        ],
      },
      {
        version: "1.2.1",
        title: msg("새 그림"),
        changes: [
          { kind: "improved", text: msg("광장 오두막·상점·농장·게시판, 남녀 주민, 농장 동물을 새 그림으로 바꿨어요. 광장에서 주민이 걷는 방향대로 앞·옆·뒤 모습이 보여요.") },
          { kind: "improved", text: msg("광장에 우체통·빨래대·바위·꽃·이정표 같은 소품이 생겼어요.") },
        ],
      },
    ],
  },
  {
    date: "2026-10-08",
    versions: [
      {
        version: "1.2.0",
        title: msg("관리자 지급, 블로그 주소·이름 규칙"),
        changes: [
          { kind: "improved", text: msg("블로그 주소는 3~12자, 블로그 이름은 12자까지 쓸 수 있어요.") },
          { kind: "improved", text: msg("광장 바닥을 흙길로, 잔디와 나무 색을 차분하게, 카드·버튼 테두리를 얇게 바꿨어요.") },
          { kind: "fixed", text: msg("[다음 글]이 지금 보고 있는 글을 가리키던 문제와, 카테고리 글 수가 늘 0으로 보이던 문제를 고쳤어요.") },
          { kind: "new", text: msg("주민에게 코인·경험치를 줄 수 있어요."), admin: true },
        ],
      },
      {
        version: "1.1.0",
        title: msg("휴대폰 광장, 내 정보 메뉴, 오늘의 퀘스트"),
        changes: [
          { kind: "new", text: msg("헤더의 내 얼굴을 누르면 내 정보 메뉴(내 블로그·환경 설정·문의하기·로그아웃)가, Lv 배지를 누르면 다음 레벨까지 남은 경험치가 보여요.") },
          { kind: "new", text: msg("출석 체크 화면에서 오늘의 퀘스트 완료 현황을 볼 수 있어요.") },
          { kind: "improved", text: msg("휴대폰에서도 광장을 넓게 볼 수 있어요.") },
          { kind: "improved", text: msg("광장을 누르면 나무와 건물을 비켜서 걸어가요. 오전·오후 6시를 기준으로 낮과 밤이 바뀌고, 밤에는 랜턴과 창문에 불이 켜져요.") },
        ],
      },
      {
        version: "1.0.1",
        title: msg("로그아웃 고침"),
        changes: [
          { kind: "fixed", text: msg("로그아웃이 되지 않던 문제를 고쳤어요.") },
        ],
      },
      {
        version: "1.0.0",
        title: msg("BlogCabin 문을 열었어요"),
        changes: [
          { kind: "new", text: msg("Blogville이 통나무 오두막 마을 BlogCabin으로 새로 문을 열었어요. 광장 가운데에는 통나무 의자를 두른 캠프파이어가 있어요.") },
          { kind: "new", text: msg("상점이 아바타 꾸미기·가구·배경 세 구역으로 바뀌었어요. 옷은 상의·하의·모자·신발이고, 사기 전에 입어 볼 수 있어요.") },
          { kind: "new", text: msg("광장의 내 집은 레벨에 따라 3단계로 커지고, 지붕 색은 꾸미기에서 무료로 골라요.") },
          { kind: "new", text: msg("동물 농장에서 알을 받아 펫을 키워요. 다 키운 동물은 카드 도감에 모이고, 한 마리는 광장에서 나를 따라다녀요.") },
          { kind: "new", text: msg("헤더에 쪽지 알림함이 생겼어요. 댓글·답글·공감·레벨업 알림이 오고, 레벨이 오르면 새로 풀린 아이템을 보여 줘요.") },
          { kind: "new", text: msg("문의하기 화면에 자주 묻는 질문을 모았어요.") },
          { kind: "new", text: msg("친구 초대 코드·링크, 블로그 방문자 수, 내 블로그 검색, 글 임시 저장, 회원 탈퇴가 생겼어요.") },
          { kind: "new", text: msg("즐겨찾는 이웃(최대 10명)의 집이 광장에 보여요.") },
          { kind: "new", text: msg("로그인을 5번 연속 틀리면 5분 동안 막아 계정을 지켜요.") },
        ],
      },
    ],
  },
];

/** 지금 운영 중인 버전 (맨 위) */
export const CURRENT_VERSION = RELEASE_NOTES[0].versions[0].version;
