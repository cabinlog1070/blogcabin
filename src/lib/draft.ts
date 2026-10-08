// 새 글 임시 저장 키 (POST-08): 회원마다 따로, 이 브라우저의 localStorage에만
export const draftStorageKey = (userId: string) => `blogcabin:draft:${userId}`;
