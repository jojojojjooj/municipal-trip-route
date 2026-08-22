export const allowedTripPhotoMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type TripPhotoMimeType = (typeof allowedTripPhotoMimeTypes)[number];

export function makeTripPhotoDataUrl(mimeType: string, contentBase64: string) {
  if (!allowedTripPhotoMimeTypes.includes(mimeType as TripPhotoMimeType)) throw new Error("지원하지 않는 사진 형식입니다.");
  if (!contentBase64) throw new Error("사진 데이터가 비어 있습니다.");
  return `data:${mimeType};base64,${contentBase64}`;
}
