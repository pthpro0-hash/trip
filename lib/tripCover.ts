/** 대표 사진을 고를 때 필요한 만큼만 아는 사진의 모양. TripDetail 의 사진이 이 꼴을 갖췄다. */
interface CoverPhoto {
  id: string;
  storagePath: string;
  isCover: boolean;
}

/**
 * 여행 상세의 맨 위에 올릴 대표 사진.
 *
 * 저장할 때 첫 장을 대표로 세워 두고(isCover), 대표를 지우면 남은 첫 장을 세운다. 그래도 표시가 없는 여행(예전 기록,
 * 대표만 지운 경우)이 있을 수 있어 표시가 없으면 첫 방문의 첫 사진으로 물러난다. 사진이 하나도 없으면 null —
 * 그때는 맨 위에 올릴 것이 없다.
 */
export function coverPhotoOf<P extends CoverPhoto>(trip: { visits: { photos: P[] }[] }): P | null {
  const photos = trip.visits.flatMap((visit) => visit.photos);
  return photos.find((photo) => photo.isCover) ?? photos[0] ?? null;
}
