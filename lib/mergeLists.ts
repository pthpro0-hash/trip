/*
  기기에 있던 목록과 계정에 있던 목록을 합친다.

  이 파일의 유일한 규칙: **한 건도 잃지 않는다.**

  로그인하는 순간이 가장 위험하다. "로그인했더니 담아둔 게 사라졌다"는
  한 번으로 신뢰를 잃고, 사용자는 그걸 복구할 방법이 없다. 그래서 어느
  쪽이 맞는지 따지지 않고 양쪽을 모두 남긴다. 중복만 지운다.

  흔한 경우는 셋이다.
    처음 로그인      계정이 비어 있다 → 기기 것이 그대로 올라간다
    다른 기기에서    기기가 비어 있다 → 계정 것이 그대로 내려온다
    둘 다 쓰던 경우  계정 순서를 지키고, 기기에만 있던 것을 뒤에 붙인다
*/
export function mergeLists(local: string[], remote: string[]): string[] {
  // 계정 쪽 순서를 앞세운다. 여러 기기에서 쓰는 사람에게는 계정이 기준이다.
  const merged = [...remote];
  const seen = new Set(remote);

  for (const id of local) {
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged;
}

/** 합친 결과가 계정에 있던 것과 같은지. 같으면 굳이 저장하지 않는다. */
export function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
