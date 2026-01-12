const tierBackgroundMap = {
  "Great Match": "#ede9fe",
  "Good Match": "#dcfce7",
  "Match": "#F1F5F9",
};

const tierColorMap = {
  "Great Match": { color: "#7c3aed", borderColor: "rgba(124, 58, 237, 0.35)" },
  "Good Match": { color: "#166534", borderColor: "rgba(16, 185, 129, 0.55)" },
  "Match": { color: "#334155", borderColor: "rgba(15, 23, 42, 0.35)" },
};

const parseHexColor = (value) => {
  if (typeof value !== "string") return null;
  let hex = value.trim();
  if (hex.startsWith("#")) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return null;
  return { r, g, b };
};

const rgbaFromHex = (value, alpha) => {
  const rgb = parseHexColor(value);
  if (!rgb) return null;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

export const computeConfidenceChipStyle = (label, color) => {
  const trimmed = label?.trim();
  if (trimmed && tierColorMap[trimmed]) {
    return {
      color: tierColorMap[trimmed].color,
      borderColor: tierColorMap[trimmed].borderColor,
      background: tierBackgroundMap[trimmed] || "#f3f4f6",
    };
  }
  const background =
    (trimmed && tierBackgroundMap[trimmed]) ||
    rgbaFromHex(color, 0.12) ||
    "rgba(4, 120, 87, 0.08)";
  const borderColor =
    rgbaFromHex(color, 0.35) || "rgba(4, 120, 87, 0.35)";
  return {
    color: color || "#047857",
    borderColor,
    background,
  };
};
