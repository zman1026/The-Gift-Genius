export interface EventTheme {
  name: string;
  eventType: string;
  themePrimary: string; // Primary color (hex)
  themeAccent: string; // Accent color (hex)
  description: string;
}

export const EVENT_THEMES: Record<string, EventTheme> = {
  christmas: {
    name: "Christmas",
    eventType: "christmas",
    themePrimary: "#DC2626", // Festive Red
    themeAccent: "#15803D", // Christmas Green
    description: "Traditional Christmas colors - red and green",
  },
  birthday: {
    name: "Birthday",
    eventType: "birthday",
    themePrimary: "#9333EA", // Purple
    themeAccent: "#F59E0B", // Gold
    description: "Celebration colors - purple and gold",
  },
  wedding: {
    name: "Wedding",
    eventType: "wedding",
    themePrimary: "#F8FAFC", // White (light)
    themeAccent: "#F59E0B", // Gold
    description: "Elegant wedding colors - white and gold",
  },
  baby_shower: {
    name: "Baby Shower",
    eventType: "baby_shower",
    themePrimary: "#EC4899", // Pink
    themeAccent: "#3B82F6", // Blue
    description: "Baby shower pastels - pink and blue",
  },
  hanukkah: {
    name: "Hanukkah",
    eventType: "hanukkah",
    themePrimary: "#3B82F6", // Blue
    themeAccent: "#94A3B8", // Silver
    description: "Hanukkah colors - blue and silver",
  },
  graduation: {
    name: "Graduation",
    eventType: "graduation",
    themePrimary: "#1E40AF", // Navy Blue
    themeAccent: "#F59E0B", // Gold
    description: "Academic achievement - navy and gold",
  },
  anniversary: {
    name: "Anniversary",
    eventType: "anniversary",
    themePrimary: "#DC2626", // Red
    themeAccent: "#F8FAFC", // White
    description: "Romantic colors - red and white",
  },
  holiday: {
    name: "Holiday Celebration",
    eventType: "holiday",
    themePrimary: "#DC2626", // Festive Red (default to Christmas theme)
    themeAccent: "#15803D", // Green
    description: "General holiday festivities",
  },
  other: {
    name: "Custom Event",
    eventType: "other",
    themePrimary: "#8B5CF6", // Violet
    themeAccent: "#EC4899", // Pink
    description: "Custom occasion colors",
  },
};

export const EVENT_TYPE_OPTIONS = [
  { value: "christmas", label: "Christmas" },
  { value: "birthday", label: "Birthday" },
  { value: "wedding", label: "Wedding" },
  { value: "baby_shower", label: "Baby Shower" },
  { value: "hanukkah", label: "Hanukkah" },
  { value: "graduation", label: "Graduation" },
  { value: "anniversary", label: "Anniversary" },
  { value: "holiday", label: "Holiday Celebration" },
  { value: "other", label: "Custom Event" },
];

// Helper function to get theme by event type
export function getThemeByType(eventType: string): EventTheme {
  return EVENT_THEMES[eventType] || EVENT_THEMES.other;
}
