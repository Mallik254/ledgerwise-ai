import { ThemeId } from '../types';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  tagline: string;
  isDark: boolean;
  classes: {
    bgApp: string;
    bgCard: string;
    bgCardSoft: string;
    textMain: string;
    textMuted: string;
    borderLine: string;
    accentForest: string;
    accentBrass: string;
    badgeBg: string;
    headerBg: string;
    sidebarBg: string;
  };
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  forest_ivory: {
    id: 'forest_ivory',
    name: 'Forest Ivory',
    tagline: 'Warm tactile ivory with signature deep forest green',
    isDark: false,
    classes: {
      bgApp: 'bg-[#f3eee3]',
      bgCard: 'bg-[#fffcf6]',
      bgCardSoft: 'bg-[#f9f4e9]',
      textMain: 'text-[#1a2b22]',
      textMuted: 'text-[#6d796f]',
      borderLine: 'border-[#e3dac9]',
      accentForest: 'bg-[#173f2e] text-[#f3eee3] hover:bg-[#0e2b1f]',
      accentBrass: 'bg-[#b3874a] text-white hover:bg-[#8f6a34]',
      badgeBg: 'bg-[#e4eddf] text-[#173f2e]',
      headerBg: 'bg-[#fffcf6]/90 border-b border-[#e3dac9]',
      sidebarBg: 'bg-[#f9f4e9] border-r border-[#e3dac9]'
    }
  },
  obsidian_emerald: {
    id: 'obsidian_emerald',
    name: 'Obsidian Emerald',
    tagline: 'Ultra-dark obsidian glass with luminous emerald neon',
    isDark: true,
    classes: {
      bgApp: 'bg-[#090d0b]',
      bgCard: 'bg-[#131c17]',
      bgCardSoft: 'bg-[#18241e]',
      textMain: 'text-[#e6f4ea]',
      textMuted: 'text-[#879b8f]',
      borderLine: 'border-[#1f3327]',
      accentForest: 'bg-[#10b981] text-[#052e16] font-semibold hover:bg-[#059669]',
      accentBrass: 'bg-[#d97706] text-black font-semibold hover:bg-[#b45309]',
      badgeBg: 'bg-[#064e3b] text-[#34d399]',
      headerBg: 'bg-[#131c17]/90 border-b border-[#1f3327]',
      sidebarBg: 'bg-[#0e1712] border-r border-[#1f3327]'
    }
  },
  midnight_gold: {
    id: 'midnight_gold',
    name: 'Midnight Gold',
    tagline: 'Regal navy & slate with warm satin brass',
    isDark: true,
    classes: {
      bgApp: 'bg-[#0b111e]',
      bgCard: 'bg-[#131c2e]',
      bgCardSoft: 'bg-[#19253d]',
      textMain: 'text-[#f1f5f9]',
      textMuted: 'text-[#94a3b8]',
      borderLine: 'border-[#233554]',
      accentForest: 'bg-[#3b82f6] text-white hover:bg-[#2563eb]',
      accentBrass: 'bg-[#eab308] text-slate-950 font-semibold hover:bg-[#ca8a04]',
      badgeBg: 'bg-[#1e293b] text-[#fbbf24]',
      headerBg: 'bg-[#131c2e]/90 border-b border-[#233554]',
      sidebarBg: 'bg-[#0d1527] border-r border-[#233554]'
    }
  },
  daylight_linen: {
    id: 'daylight_linen',
    name: 'Daylight Linen',
    tagline: 'Crisp editorial linen with high-contrast ink',
    isDark: false,
    classes: {
      bgApp: 'bg-[#f8f9fa]',
      bgCard: 'bg-[#ffffff]',
      bgCardSoft: 'bg-[#f1f3f5]',
      textMain: 'text-[#111827]',
      textMuted: 'text-[#64748b]',
      borderLine: 'border-[#e2e8f0]',
      accentForest: 'bg-[#0f172a] text-white hover:bg-[#1e293b]',
      accentBrass: 'bg-[#d97706] text-white hover:bg-[#b45309]',
      badgeBg: 'bg-[#f1f5f9] text-[#0f172a]',
      headerBg: 'bg-white/95 border-b border-[#e2e8f0]',
      sidebarBg: 'bg-[#f8fafc] border-r border-[#e2e8f0]'
    }
  }
};
