// 릴리스 노트 (/release-notes). 주민이 읽는 업데이트 소식이다.
// 운영에 배포되는 변경(main 병합)마다 맨 위 날짜에 한 줄씩 더한다. 그날 묶음이 없으면 새로 만든다.
// - date: 배포한 날(한국 시간) "YYYY-MM-DD", 최신이 맨 위
// - kind: new(새 기능) · improved(바뀐 점) · fixed(고친 문제)
// - text: 주민이 알아듣는 쉬운 말로 한 문장. 파일 이름·함수·마이그레이션 같은 개발 용어는 쓰지 않는다
// - admin: true면 관리자만 쓰는 기능 (화면에 '관리자' 표시)
// 화면에 보이지 않는 배포·DB 작업만 바뀐 날은 적지 않아도 된다.
// 문장은 msg()로 감싸고 일본어를 src/lib/i18n/ja/release-notes.ts에 같이 넣는다 (npm run test:i18n이 확인한다).
import { msg } from "@/lib/i18n";

export type ReleaseChangeKind = "new" | "improved" | "fixed";

export type ReleaseChange = { kind: ReleaseChangeKind; text: string; admin?: boolean };

export type ReleaseNote = {
  date: string;
  /** 그날 업데이트를 한 줄로 */
  title: string;
  changes: ReleaseChange[];
};

export const RELEASE_KIND_LABEL: Record<ReleaseChangeKind, string> = {
  new: msg("새 기능"),
  improved: msg("바뀐 점"),
  fixed: msg("고친 문제"),
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: "2026-10-12",
    title: msg("일본어 화면, 닉네임 바꾸기, 릴리스 노트, 아이폰 그림 선명하게"),
    changes: [
      { kind: "new", text: msg("화면 아래나 내 정보 메뉴에서 언어를 한국어·일본어 중에 고를 수 있어요. 메뉴·버튼·안내가 바뀌고, 주민이 쓴 글과 이름은 쓴 그대로예요.") },
      { kind: "new", text: msg("내 정보 메뉴의 문의하기 아래에 릴리스 노트가 생겼어요. 업데이트될 때마다 여기에 소식을 올려요.") },
      { kind: "new", text: msg("환경 설정의 기본 정보에서 닉네임을 바꿀 수 있어요. 2~12자이고, 다른 주민이 쓰는 닉네임은 쓸 수 없어요.") },
      { kind: "fixed", text: msg("아이폰(사파리)에서 크레용 그림이 뭉개져 보이던 문제를 고쳤어요.") },
      { kind: "improved", text: msg("글쓰기 도구 모음을 두 줄로 정리했어요. 컴퓨터에서는 목록부터 다음 줄에 있고, 휴대폰에서는 글꼴·정렬·목록·링크와 사진 네 줄로 나눴어요.") },
      { kind: "improved", text: msg("비공개 글도 언제나 볼 수 있어요."), admin: true },
    ],
  },
  {
    date: "2026-10-11",
    title: msg("크레용 그림체, 블로그 홈 새 배치, 소셜 로그인 연동"),
    changes: [
      { kind: "new", text: msg("광장 건물·주민·농장 동물·가구·미니룸 배경·아이콘까지 그림 전체를 크레용으로 그린 그림체로 바꿨어요.") },
      { kind: "new", text: msg("블로그 홈을 새로 배치했어요. 머리 카드 왼쪽에 블로그 정보, 오른쪽에 미니룸과 꾸미기 버튼이 있고, 글 목록을 정렬하거나 목록·바둑판으로 볼 수 있어요.") },
      { kind: "new", text: msg("글쓰기에 티스토리 같은 툴바가 생겼어요. 본문·제목·부제목, 글자 크기, 정렬, 글자색·배경색을 고를 수 있어요.") },
      { kind: "new", text: msg("카카오·구글 계정을 내 아이디에 연동할 수 있어요. 처음 연동하면 소셜 계정마다 코인 100을 받아요.") },
      { kind: "new", text: msg("소셜로 처음 로그인하면 새 아이디를 만들거나 이미 있는 아이디에 합칠 수 있어요. 한 사람은 아이디 하나로 지내요.") },
      { kind: "new", text: msg("이웃인 남의 블로그 헤더에서 ☆을 눌러 즐겨찾기할 수 있어요.") },
      { kind: "improved", text: msg("비공개 글은 주인과 서로 이웃만 볼 수 있어요.") },
      { kind: "improved", text: msg("오늘의 퀘스트가 30자 이상 글 쓰기, 이웃 글 공감 5개, 이웃에게 댓글 3개로 바뀌었고, 출석 체크 화면에서 몇 번 했는지와 어디서 하면 되는지 보여 줘요.") },
      { kind: "improved", text: msg("휴대폰 블로그 홈 순서를 마을 검색 → 내 이웃 → 카테고리 → 글 목록으로 바꾸고, 친구 초대는 맨 아래로 옮겼어요.") },
      { kind: "improved", text: msg("미니룸 캐릭터·펫을 조금 작게 하고 가만히 서 있게 했어요. 꾸미기 화면의 미니룸도 블로그 미니룸과 같은 모양이에요.") },
      { kind: "improved", text: msg("광장이 처음 열릴 때 빈 화면으로 오래 멈추지 않고, 준비 중이라고 알려 줘요.") },
      { kind: "improved", text: msg("네이버 로그인은 네이버 검수가 끝날 때까지 잠시 쉬어요. 쓸 수 있는 로그인 버튼만 보여요.") },
      { kind: "fixed", text: msg("휴대폰에서 광장 글씨와 그림이 흐릿하게 보이던 문제를 고쳤어요.") },
      { kind: "fixed", text: msg("내 정보 창 위로 미니룸 가구가 올라오고, 창을 누르면 광장 캐릭터가 걸어가던 문제를 고쳤어요.") },
      { kind: "fixed", text: msg("휴대폰에서 스크롤하면 미니룸 꾸미기 버튼이 위 헤더를 덮던 문제를 고쳤어요.") },
      { kind: "fixed", text: msg("카카오·네이버 계정 연동이 실패하던 문제를 고쳤어요.") },
      { kind: "new", text: msg("회원을 검색하고, 회원별로 글·댓글을 지우거나 강제 탈퇴시킬 수 있어요."), admin: true },
    ],
  },
  {
    date: "2026-10-09",
    title: msg("새 그림과 아이콘"),
    changes: [
      { kind: "improved", text: msg("광장 오두막·상점·농장·게시판, 남녀 주민, 농장 동물을 새 그림으로 바꿨어요. 광장에서 주민이 걷는 방향대로 앞·옆·뒤 모습이 보여요.") },
      { kind: "improved", text: msg("광장에 우체통·빨래대·바위·꽃·이정표 같은 소품이 생겼어요.") },
      { kind: "improved", text: msg("화면 곳곳의 이모지를 직접 그린 아이콘 33개로 바꾸고, 가구 5종과 배경 6종도 새로 그렸어요.") },
    ],
  },
  {
    date: "2026-10-08",
    title: msg("BlogCabin 문을 열었어요"),
    changes: [
      { kind: "new", text: msg("Blogville이 통나무 오두막 마을 BlogCabin으로 새로 문을 열었어요. 광장 가운데에는 통나무 의자를 두른 캠프파이어가 있어요.") },
      { kind: "new", text: msg("상점이 아바타 꾸미기·가구·배경 세 구역으로 바뀌었어요. 옷은 상의·하의·모자·신발이고, 사기 전에 입어 볼 수 있어요.") },
      { kind: "new", text: msg("광장의 내 집은 레벨에 따라 3단계로 커지고, 지붕 색은 꾸미기에서 무료로 골라요.") },
      { kind: "new", text: msg("동물 농장에서 알을 받아 펫을 키워요. 다 키운 동물은 카드 도감에 모이고, 한 마리는 광장에서 나를 따라다녀요.") },
      { kind: "new", text: msg("헤더에 쪽지 알림함이 생겼어요. 댓글·답글·공감·레벨업 알림이 오고, 레벨이 오르면 새로 풀린 아이템을 보여 줘요.") },
      { kind: "new", text: msg("헤더의 내 얼굴을 누르면 내 정보 메뉴(내 블로그·환경 설정·문의하기·로그아웃)가, Lv 배지를 누르면 다음 레벨까지 남은 경험치가 보여요.") },
      { kind: "new", text: msg("문의하기 화면에 자주 묻는 질문을 모았어요.") },
      { kind: "new", text: msg("출석 체크 화면에서 오늘의 퀘스트 완료 현황을 볼 수 있어요.") },
      { kind: "new", text: msg("친구 초대 코드·링크, 블로그 방문자 수, 내 블로그 검색, 글 임시 저장, 회원 탈퇴가 생겼어요.") },
      { kind: "new", text: msg("즐겨찾는 이웃(최대 10명)의 집이 광장에 보여요.") },
      { kind: "improved", text: msg("휴대폰에서도 광장을 넓게 볼 수 있어요.") },
      { kind: "improved", text: msg("광장을 누르면 나무와 건물을 비켜서 걸어가요. 오전·오후 6시를 기준으로 낮과 밤이 바뀌고, 밤에는 랜턴과 창문에 불이 켜져요.") },
      { kind: "improved", text: msg("블로그 주소는 3~12자, 블로그 이름은 12자까지 쓸 수 있어요.") },
      { kind: "improved", text: msg("광장 바닥을 흙길로, 잔디와 나무 색을 차분하게, 카드·버튼 테두리를 얇게 바꿨어요.") },
      { kind: "fixed", text: msg("로그아웃이 되지 않던 문제를 고쳤어요.") },
      { kind: "fixed", text: msg("[다음 글]이 지금 보고 있는 글을 가리키던 문제와, 카테고리 글 수가 늘 0으로 보이던 문제를 고쳤어요.") },
      { kind: "new", text: msg("로그인을 5번 연속 틀리면 5분 동안 막아 계정을 지켜요.") },
      { kind: "new", text: msg("주민에게 코인·경험치를 줄 수 있어요."), admin: true },
    ],
  },
];
