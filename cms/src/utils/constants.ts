import type {
  cameraMovementsSchema,
  moodSchema,
  textPlacementSchema,
} from "@videofy/types";
import type { z } from "zod";

export const moods: Array<z.infer<typeof moodSchema>> = [
  { id: "mellow", name: "Lugn" },
  { id: "sad", name: "Allvarlig" },
  { id: "dramatic", name: "Dramatisk" },
  { id: "neutral", name: "Neutral" },
  { id: "hopeful", name: "Hoppfull" },
  { id: "upbeat", name: "Positiv" },
];

export const textPlacements: Array<z.infer<typeof textPlacementSchema>> = [
  { id: "bottom", name: "Nederkant", icon: "TextBottom" },
  { id: "middle", name: "Mitten", icon: "TextMiddle" },
  { id: "top", name: "Överkant", icon: "TextTop" },
];

export const cameraMovements: Array<z.infer<typeof cameraMovementsSchema>> = [
  { id: "none", name: "Ingen rörelse" },
  { id: "pan-left", name: "Panorera vänster" },
  { id: "pan-right", name: "Panorera höger" },
  { id: "pan-up", name: "Panorera uppåt" },
  { id: "pan-down", name: "Panorera nedåt" },
  { id: "zoom-in", name: "Zooma in" },
  { id: "zoom-out", name: "Zooma ut" },
  { id: "zoom-rotate-left", name: "Zooma in och rotera vänster" },
  { id: "zoom-rotate-right", name: "Zooma in och rotera höger" },
  { id: "zoom-out-rotate-left", name: "Zooma ut och rotera vänster" },
  { id: "zoom-out-rotate-right", name: "Zooma ut och rotera höger" },
];
