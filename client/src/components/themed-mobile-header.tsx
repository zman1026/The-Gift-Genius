import { Gift, Cake, Heart, Baby, Sparkles, GraduationCap, Star, TreePine, Snowflake, Circle } from "lucide-react";
import { useEvent } from "@/contexts/EventContext";

interface ThemeConfig {
  MainIcon: typeof Gift;
  AccentIcon: typeof Sparkles;
  decorations: Array<{
    Icon: typeof Sparkles;
    position: string;
    size: string;
    opacity: string;
  }>;
}

const eventThemes: Record<string, ThemeConfig> = {
  christmas: {
    MainIcon: TreePine,
    AccentIcon: Sparkles,
    decorations: [
      { Icon: Snowflake, position: "top-0 left-2", size: "w-3 h-3", opacity: "opacity-40" },
      { Icon: Snowflake, position: "bottom-0 right-4", size: "w-3 h-3", opacity: "opacity-40" },
      { Icon: Star, position: "top-1 right-8", size: "w-2 h-2", opacity: "opacity-30" },
    ],
  },
  birthday: {
    MainIcon: Cake,
    AccentIcon: Sparkles,
    decorations: [
      { Icon: Star, position: "top-0 left-3", size: "w-3 h-3", opacity: "opacity-50" },
      { Icon: Star, position: "bottom-0 right-3", size: "w-3 h-3", opacity: "opacity-50" },
      { Icon: Sparkles, position: "top-1 right-6", size: "w-2 h-2", opacity: "opacity-40" },
      { Icon: Circle, position: "bottom-1 left-6", size: "w-2 h-2", opacity: "opacity-30" },
    ],
  },
  wedding: {
    MainIcon: Heart,
    AccentIcon: Sparkles,
    decorations: [
      { Icon: Heart, position: "top-0 left-2", size: "w-3 h-3", opacity: "opacity-40" },
      { Icon: Heart, position: "bottom-0 right-2", size: "w-3 h-3", opacity: "opacity-40" },
      { Icon: Star, position: "top-1 right-8", size: "w-2 h-2", opacity: "opacity-30" },
      { Icon: Star, position: "bottom-1 left-8", size: "w-2 h-2", opacity: "opacity-30" },
    ],
  },
  baby_shower: {
    MainIcon: Baby,
    AccentIcon: Star,
    decorations: [
      { Icon: Star, position: "top-0 left-3", size: "w-3 h-3", opacity: "opacity-50" },
      { Icon: Star, position: "bottom-0 right-3", size: "w-3 h-3", opacity: "opacity-50" },
      { Icon: Circle, position: "top-1 right-6", size: "w-2 h-2", opacity: "opacity-40" },
      { Icon: Sparkles, position: "bottom-1 left-6", size: "w-2 h-2", opacity: "opacity-40" },
    ],
  },
  hanukkah: {
    MainIcon: Sparkles,
    AccentIcon: Star,
    decorations: [
      { Icon: Star, position: "top-0 left-2", size: "w-4 h-4", opacity: "opacity-40" },
      { Icon: Star, position: "bottom-0 right-2", size: "w-3 h-3", opacity: "opacity-30" },
      { Icon: Sparkles, position: "top-1 right-6", size: "w-2 h-2", opacity: "opacity-30" },
    ],
  },
  graduation: {
    MainIcon: GraduationCap,
    AccentIcon: Star,
    decorations: [
      { Icon: Star, position: "top-0 left-3", size: "w-3 h-3", opacity: "opacity-50" },
      { Icon: Star, position: "bottom-0 right-3", size: "w-3 h-3", opacity: "opacity-50" },
      { Icon: Sparkles, position: "top-1 right-8", size: "w-2 h-2", opacity: "opacity-40" },
      { Icon: Sparkles, position: "bottom-1 left-8", size: "w-2 h-2", opacity: "opacity-30" },
    ],
  },
  other: {
    MainIcon: Gift,
    AccentIcon: Sparkles,
    decorations: [
      { Icon: Sparkles, position: "top-0 left-2", size: "w-3 h-3", opacity: "opacity-40" },
      { Icon: Sparkles, position: "bottom-0 right-2", size: "w-3 h-3", opacity: "opacity-40" },
      { Icon: Star, position: "top-1 right-6", size: "w-2 h-2", opacity: "opacity-30" },
    ],
  },
};

// Validate and normalize hex color
function normalizeHexColor(color: string | null | undefined): string {
  if (!color) return '#DC2626'; // Default red
  
  const hex = color.trim();
  
  // Remove # if present
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
  
  // Validate hex format (3 or 6 characters)
  if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return '#DC2626'; // Default red for invalid format
  }
  
  // Expand 3-digit hex to 6-digit
  if (cleanHex.length === 3) {
    return `#${cleanHex[0]}${cleanHex[0]}${cleanHex[1]}${cleanHex[1]}${cleanHex[2]}${cleanHex[2]}`;
  }
  
  return `#${cleanHex}`;
}

// Calculate relative luminance for WCAG contrast
function getRelativeLuminance(hex: string): number {
  const rgb = hex.replace('#', '');
  const r = parseInt(rgb.substr(0, 2), 16) / 255;
  const g = parseInt(rgb.substr(2, 2), 16) / 255;
  const b = parseInt(rgb.substr(4, 2), 16) / 255;
  
  // Check for NaN
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return 0.5; // Return mid-value for invalid colors
  }
  
  // Apply gamma correction
  const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  
  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

// Calculate WCAG contrast ratio between two colors
function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

// Darken a color by a percentage (0-1)
function darkenColor(hex: string, amount: number): string {
  const rgb = hex.replace('#', '');
  let r = parseInt(rgb.substr(0, 2), 16);
  let g = parseInt(rgb.substr(2, 2), 16);
  let b = parseInt(rgb.substr(4, 2), 16);
  
  r = Math.round(r * (1 - amount));
  g = Math.round(g * (1 - amount));
  b = Math.round(b * (1 - amount));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Get WCAG-compliant text colors with overlay if needed
function getAccessibleTextColors(primaryColor: string, accentColor: string) {
  const WHITE = '#FFFFFF';
  const BLACK = '#000000';
  const MIN_CONTRAST = 4.5; // WCAG AA standard for normal text
  
  // Check contrast ratios for both colors
  const whiteVsPrimary = getContrastRatio(WHITE, primaryColor);
  const whiteVsAccent = getContrastRatio(WHITE, accentColor);
  const blackVsPrimary = getContrastRatio(BLACK, primaryColor);
  const blackVsAccent = getContrastRatio(BLACK, accentColor);
  
  // If white works for both, use white
  if (whiteVsPrimary >= MIN_CONTRAST && whiteVsAccent >= MIN_CONTRAST) {
    return {
      text: 'text-white',
      icon: 'text-white',
      needsOverlay: false,
    };
  }
  
  // If black works for both, use black
  if (blackVsPrimary >= MIN_CONTRAST && blackVsAccent >= MIN_CONTRAST) {
    return {
      text: 'text-gray-900',
      icon: 'text-gray-800',
      needsOverlay: false,
    };
  }
  
  // Neither works perfectly - apply semi-transparent dark overlay and use white text
  // This ensures contrast across the entire gradient
  return {
    text: 'text-white',
    icon: 'text-white',
    needsOverlay: true,
    overlayOpacity: 0.3, // 30% dark overlay
  };
}

export function ThemedMobileHeader() {
  const { selectedEvent } = useEvent();
  
  if (!selectedEvent) {
    return (
      <div className="flex items-center gap-2" data-testid="mobile-header-logo">
        <Gift className="w-5 h-5 text-primary" aria-hidden="true" />
        <span className="font-serif text-lg font-semibold text-foreground">
          The Gift Genius
        </span>
      </div>
    );
  }

  const eventType = selectedEvent.eventType;
  const theme = eventThemes[eventType] || eventThemes.other;
  const { MainIcon, AccentIcon, decorations } = theme;

  // Normalize and validate theme colors
  const primaryColor = normalizeHexColor(selectedEvent.themePrimary);
  const accentColor = normalizeHexColor(selectedEvent.themeAccent);

  // Create gradient from theme colors
  const gradientStyle = {
    background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 50%, ${primaryColor} 100%)`,
  };

  // Get WCAG-compliant text colors
  const { text: textColorClass, icon: iconColorClass, needsOverlay, overlayOpacity } = 
    getAccessibleTextColors(primaryColor, accentColor);

  return (
    <div 
      className="relative flex items-center gap-2 px-4 py-1.5 rounded-lg overflow-hidden"
      style={gradientStyle}
      data-testid="mobile-header-logo"
    >
      {needsOverlay && (
        <div 
          className="absolute inset-0 bg-black" 
          style={{ opacity: overlayOpacity }}
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0" aria-hidden="true">
        {decorations.map((decoration, index) => {
          const { Icon, position, size, opacity } = decoration;
          return (
            <Icon
              key={index}
              className={`absolute ${position} ${size} ${opacity} ${iconColorClass}`}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <MainIcon className={`w-5 h-5 ${iconColorClass} relative z-10`} aria-hidden="true" />
      <span className={`font-serif text-lg font-semibold ${textColorClass} relative z-10`}>
        {selectedEvent.name}
      </span>
      <AccentIcon className={`w-4 h-4 ${iconColorClass} relative z-10`} aria-hidden="true" />
    </div>
  );
}
