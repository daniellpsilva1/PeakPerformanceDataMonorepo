import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const oswald = loadOswald("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

const inter = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

export const condensedFont = oswald.fontFamily;
export const bodyFont = inter.fontFamily;
