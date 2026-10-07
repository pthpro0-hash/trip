import type { SupabaseClient } from "@supabase/supabase-js";
import { writeCollections } from "@/lib/collections";
import { forgetSignedUrls } from "@/lib/supabase/photos";

/*
  로그아웃. 나가는 것만이 아니라 앞사람의 흔적을 이 기기에서 걷어 낸다.

  받아 둔 내 사진 주소를 이 탭에서 지우고, 이 기기의 목록도 비운다. CollectionSync 도 로그아웃을 듣고 비우지만
  새로고침이 그 처리보다 먼저 일어나면 앞사람의 목록이 남아 다음 사람이 로그인할 때 그 사람 계정으로 합쳐진다 —
  두 번 비우는 편이 낫다. router.refresh() 가 아니라 통째로 새로고침하는 것도 같은 이유다(앞사람의 화면 상태가
  조금도 남지 않는다).
*/
export async function signOutAndReload(supabase: SupabaseClient, reload: () => void = () => window.location.reload()): Promise<void> {
  await supabase.auth.signOut();
  forgetSignedUrls();
  writeCollections({ wishlist: [], trip: [] });
  reload();
}
