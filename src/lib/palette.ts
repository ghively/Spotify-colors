import { load, save } from "./storage";

export type Color = {
  id: string;
  name: string;
  hex: string;
};

const KEY = "sc.palette.v1";

export const DEFAULT_PALETTE: Color[] = [
  { id: "red", name: "Red", hex: "#e53935" },
  { id: "orange", name: "Orange", hex: "#fb8c00" },
  { id: "yellow", name: "Yellow", hex: "#fdd835" },
  { id: "green", name: "Green", hex: "#43a047" },
  { id: "blue", name: "Blue", hex: "#1e88e5" },
  { id: "purple", name: "Purple", hex: "#8e24aa" },
  { id: "pink", name: "Pink", hex: "#ec407a" },
  { id: "brown", name: "Brown", hex: "#6d4c41" },
  { id: "black", name: "Black", hex: "#212121" },
  { id: "white", name: "White", hex: "#fafafa" },
];

export function loadPalette(): Color[] {
  const p = load<Color[]>(KEY, DEFAULT_PALETTE);
  return Array.isArray(p) && p.length > 0 ? p : DEFAULT_PALETTE;
}

export function savePalette(palette: Color[]): void {
  save(KEY, palette);
}

export function newColorId(): string {
  return `c_${Math.random().toString(36).slice(2, 9)}`;
}
