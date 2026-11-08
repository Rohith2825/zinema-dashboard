import { ogAlt, ogCard, ogSize } from "./og-card";

export const alt = ogAlt;
export const size = ogSize;
export const contentType = "image/png";

export default async function Image() {
  return ogCard();
}
