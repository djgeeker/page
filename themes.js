export const PHOTO_THEMES = [
  {
    id: "ink-glass",
    label: "Morandi Glass",
    family: "blue",
    match: { hue: [175, 245], saturation: [0.08, 0.55], lightness: [0.18, 0.82] },
    colors: {
      bg: "#141727",
      bgSoft: "#1C2033",
      text: "#F0E5D7",
      muted: "#9EA6AE",
      accent: "#F25C78",
      accentAlt: "#7898A8",
      line: "#EADBCB",
      shadow: "rgba(5, 5, 8, 0.42)"
    }
  },
  {
    id: "moss-field",
    label: "Muted Moss",
    family: "green",
    match: { hue: [75, 165], saturation: [0.08, 0.5], lightness: [0.18, 0.76] },
    colors: {
      bg: "#28332D",
      bgSoft: "#34443B",
      text: "#ECE5D3",
      muted: "#AAB1A1",
      accent: "#B7A55A",
      accentAlt: "#6D8A75",
      line: "#D8D0B8",
      shadow: "rgba(9, 15, 11, 0.4)"
    }
  },
  {
    id: "brandy-cappuccino",
    label: "Brandy Cappuccino",
    family: "warm",
    match: { hue: [18, 52], saturation: [0.08, 0.55], lightness: [0.22, 0.86] },
    colors: {
      bg: "#4B3932",
      bgSoft: "#5F493F",
      text: "#EFE1D0",
      muted: "#BDAE9F",
      accent: "#C78363",
      accentAlt: "#A9947E",
      line: "#E7D1BC",
      shadow: "rgba(22, 12, 7, 0.42)"
    }
  },
  {
    id: "oxide-red",
    label: "Soft Oxide",
    family: "red",
    match: { hue: [340, 18], saturation: [0.08, 0.58], lightness: [0.2, 0.78] },
    colors: {
      bg: "#3A2026",
      bgSoft: "#4B2A31",
      text: "#F0DED2",
      muted: "#BEA0A0",
      accent: "#D96868",
      accentAlt: "#8F6C76",
      line: "#E8CEC5",
      shadow: "rgba(19, 5, 8, 0.42)"
    }
  },
  {
    id: "ochre-noon",
    label: "Muted Ochre",
    family: "yellow",
    match: { hue: [48, 74], saturation: [0.08, 0.48], lightness: [0.28, 0.86] },
    colors: {
      bg: "#5B5031",
      bgSoft: "#6E6240",
      text: "#F2E9D7",
      muted: "#C9BE9B",
      accent: "#D1B75F",
      accentAlt: "#918C70",
      line: "#F0DFBA",
      shadow: "rgba(20, 17, 7, 0.4)"
    }
  },
  {
    id: "porcelain-white",
    label: "Porcelain White",
    family: "white",
    match: { hue: [0, 360], saturation: [0, 0.12], lightness: [0.64, 1] },
    colors: {
      bg: "#E8E4DC",
      bgSoft: "#D8D3CB",
      text: "#1B1C1F",
      muted: "#6F716E",
      accent: "#A35F55",
      accentAlt: "#8A9A9B",
      line: "#242628",
      shadow: "rgba(30, 28, 24, 0.18)"
    }
  }
];

export const DEFAULT_THEME = PHOTO_THEMES[0];

export function getThemeById(id) {
  return PHOTO_THEMES.find((theme) => theme.id === id) || DEFAULT_THEME;
}

export function getThemeSwatches(theme) {
  const { bg, text, accent, accentAlt, line, muted } = theme.colors;
  return [bg, text, accent, accentAlt, line, muted];
}

export function classifyTheme(sample) {
  if (!sample) return DEFAULT_THEME;
  const { hue, saturation, lightness, shares = {} } = sample;

  if (saturation < 0.11 && lightness > 0.58) return getThemeById("porcelain-white");
  if ((shares.blue || 0) > 0.18 && (shares.white || 0) > 0.25) return getThemeById("ink-glass");
  if ((shares.blue || 0) + (shares.green || 0) > 0.42 && (shares.blue || 0) > 0.16) return getThemeById("ink-glass");
  if ((shares.green || 0) > 0.34 && (shares.blue || 0) < 0.2) return getThemeById("moss-field");
  if ((shares.warm || 0) > 0.46 && (shares.green || 0) < 0.2) return getThemeById("brandy-cappuccino");
  if ((shares.red || 0) > 0.28) return getThemeById("oxide-red");
  if ((shares.yellow || 0) > 0.32) return getThemeById("ochre-noon");

  const scored = PHOTO_THEMES.map((theme) => {
    const { match } = theme;
    const hueScore = scoreHue(hue, match.hue[0], match.hue[1]);
    const saturationScore = scoreRange(saturation, match.saturation[0], match.saturation[1]);
    const lightnessScore = scoreRange(lightness, match.lightness[0], match.lightness[1]);
    return {
      theme,
      score: hueScore * 0.62 + saturationScore * 0.2 + lightnessScore * 0.18
    };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.theme || DEFAULT_THEME;
}

function scoreRange(value, min, max) {
  if (value >= min && value <= max) return 1;
  const distance = value < min ? min - value : value - max;
  return Math.max(0, 1 - distance * 3);
}

function scoreHue(hue, start, end) {
  if (start <= end) {
    if (hue >= start && hue <= end) return 1;
    return Math.max(0, 1 - Math.min(Math.abs(hue - start), Math.abs(hue - end)) / 80);
  }

  if (hue >= start || hue <= end) return 1;
  return Math.max(0, 1 - Math.min(Math.abs(hue - start), Math.abs(hue - end)) / 80);
}
