import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   THEME & SETTINGS CONTEXT — 100% repo-accurate layout definitions
   Each layout+theme has exact bg/panel/text/brand/sidebar colors
   from the TRACKER_CLOUDFLARE- source repo.
   ═══════════════════════════════════════════════════════════════════ */

// ── Full theme definition per layout+theme combo ──
export interface ThemeDef {
  bg: string; panel: string; panel2: string; panel3: string;
  text: string; muted: string; muted2: string;
  line: string; line2: string;
  brand: string; brand2: string; brand3: string;
  good: string; bad: string; warn: string;
  sidebarBg: string; topbarBg: string;
  cardBg: string; inputBg: string;
  hoverCard: string; glow: string;
}

export interface LayoutDef {
  id: string;
  name: string;
  desc: string;
  font: string;
  fontMono: string;
  radius: string; radiusSm: string; radiusLg: string;
  shadow: string;
  swatches: string[];
  themes: Record<string, ThemeDef>;
}

// ═══ FLUX — Clean SaaS (LIGHT layout) ═══
const FLUX: LayoutDef = {
  id: 'flux', name: 'Flux', desc: 'Clean SaaS · rounded',
  font: 'Inter', fontMono: 'JetBrains Mono',
  radius: '12px', radiusSm: '8px', radiusLg: '16px',
  shadow: '0 4px 20px rgba(0,0,0,.06)',
  swatches: ['#f8faff','#4f46e5','#7c3aed','#16a34a','#dc2626','#0ea5e9','#e11d48','#d97706'],
  themes: {
    t1: { // Indigo Sky
      bg:'#f8faff', panel:'#ffffff', panel2:'#f0f4ff', panel3:'#e8effe',
      text:'#0f172a', muted:'#64748b', muted2:'#94a3b8',
      line:'rgba(15,23,42,.09)', line2:'rgba(15,23,42,.05)',
      brand:'#4f46e5', brand2:'#7c3aed', brand3:'rgba(79,70,229,.1)',
      good:'#16a34a', bad:'#dc2626', warn:'#d97706',
      sidebarBg:'#ffffff', topbarBg:'rgba(255,255,255,.95)',
      cardBg:'#ffffff', inputBg:'rgba(79,70,229,.05)',
      hoverCard:'rgba(79,70,229,.04)', glow:'rgba(79,70,229,.15)',
    },
    t2: { // Teal Mist
      bg:'#f0fdf9', panel:'#ffffff', panel2:'#f0fdfa', panel3:'#ccfbf1',
      text:'#0f2922', muted:'#4d7c6f', muted2:'#7aada4',
      line:'rgba(15,41,34,.09)', line2:'rgba(15,41,34,.05)',
      brand:'#0d9488', brand2:'#059669', brand3:'rgba(13,148,136,.1)',
      good:'#15803d', bad:'#dc2626', warn:'#d97706',
      sidebarBg:'#ffffff', topbarBg:'rgba(255,255,255,.95)',
      cardBg:'#ffffff', inputBg:'rgba(13,148,136,.05)',
      hoverCard:'rgba(13,148,136,.04)', glow:'rgba(13,148,136,.15)',
    },
    t3: { // Rose Quartz
      bg:'#fff1f5', panel:'#ffffff', panel2:'#fff1f5', panel3:'#ffe4e6',
      text:'#2d0014', muted:'#8b3560', muted2:'#c084a0',
      line:'rgba(45,0,20,.09)', line2:'rgba(45,0,20,.05)',
      brand:'#e11d48', brand2:'#db2777', brand3:'rgba(225,29,72,.1)',
      good:'#15803d', bad:'#b91c1c', warn:'#d97706',
      sidebarBg:'#ffffff', topbarBg:'rgba(255,255,255,.95)',
      cardBg:'#ffffff', inputBg:'rgba(225,29,72,.05)',
      hoverCard:'rgba(225,29,72,.04)', glow:'rgba(225,29,72,.15)',
    },
    t4: { // Amber Pro
      bg:'#fffbf0', panel:'#ffffff', panel2:'#fef9ee', panel3:'#fef3c7',
      text:'#1c1400', muted:'#78600a', muted2:'#a88e45',
      line:'rgba(28,20,0,.09)', line2:'rgba(28,20,0,.05)',
      brand:'#d97706', brand2:'#b45309', brand3:'rgba(217,119,6,.1)',
      good:'#15803d', bad:'#dc2626', warn:'#92400e',
      sidebarBg:'#ffffff', topbarBg:'rgba(255,255,255,.95)',
      cardBg:'#ffffff', inputBg:'rgba(217,119,6,.05)',
      hoverCard:'rgba(217,119,6,.04)', glow:'rgba(217,119,6,.15)',
    },
    t5: { // Slate Premium
      bg:'#f8fafc', panel:'#ffffff', panel2:'#f1f5f9', panel3:'#e2e8f0',
      text:'#0f172a', muted:'#475569', muted2:'#94a3b8',
      line:'rgba(15,23,42,.09)', line2:'rgba(15,23,42,.05)',
      brand:'#334155', brand2:'#1e293b', brand3:'rgba(51,65,85,.1)',
      good:'#15803d', bad:'#dc2626', warn:'#d97706',
      sidebarBg:'#1e293b', topbarBg:'rgba(248,250,252,.95)',
      cardBg:'#ffffff', inputBg:'rgba(51,65,85,.05)',
      hoverCard:'rgba(51,65,85,.04)', glow:'rgba(51,65,85,.15)',
    },
  },
};

// ═══ CIPHER — Dark Terminal (DARK layout) ═══
const CIPHER: LayoutDef = {
  id: 'cipher', name: 'Cipher', desc: 'Dark terminal · mono',
  font: 'JetBrains Mono', fontMono: 'JetBrains Mono',
  radius: '4px', radiusSm: '2px', radiusLg: '6px',
  shadow: '0 0 0 1px rgba(255,255,255,.08)',
  swatches: ['#000000','#00ff64','#00d4ff','#ff4040','#ffcc00','#aa44ff','#ff8c00','#6478ff'],
  themes: {
    t1: { // Matrix Green
      bg:'#000000', panel:'#0a0a0a', panel2:'#111111', panel3:'#1a1a1a',
      text:'#e0ffd4', muted:'#5a8c50', muted2:'#3d6035',
      line:'rgba(0,255,100,.1)', line2:'rgba(0,255,100,.05)',
      brand:'#00ff64', brand2:'#00cc50', brand3:'rgba(0,255,100,.1)',
      good:'#00ff64', bad:'#ff4040', warn:'#ffcc00',
      sidebarBg:'#050505', topbarBg:'rgba(0,0,0,.98)',
      cardBg:'#0a0a0a', inputBg:'rgba(0,255,100,.06)',
      hoverCard:'rgba(0,255,100,.05)', glow:'rgba(0,255,100,.2)',
    },
    t2: { // Deep Ocean
      bg:'#000b1a', panel:'#001428', panel2:'#00213d', panel3:'#002e52',
      text:'#b8d8ff', muted:'#4a7fa8', muted2:'#2d5b80',
      line:'rgba(0,150,255,.12)', line2:'rgba(0,150,255,.06)',
      brand:'#0096ff', brand2:'#0064cc', brand3:'rgba(0,150,255,.1)',
      good:'#00d4aa', bad:'#ff4455', warn:'#ffaa00',
      sidebarBg:'#000b1a', topbarBg:'rgba(0,11,26,.98)',
      cardBg:'#001428', inputBg:'rgba(0,150,255,.07)',
      hoverCard:'rgba(0,150,255,.05)', glow:'rgba(0,150,255,.2)',
    },
    t3: { // Neon Purple
      bg:'#0d0015', panel:'#150022', panel2:'#1e0033', panel3:'#280044',
      text:'#e8ccff', muted:'#7a4aa0', muted2:'#5a2880',
      line:'rgba(168,85,247,.12)', line2:'rgba(168,85,247,.06)',
      brand:'#aa44ff', brand2:'#8800ee', brand3:'rgba(168,85,247,.1)',
      good:'#44ff88', bad:'#ff4466', warn:'#ffaa22',
      sidebarBg:'#0d0015', topbarBg:'rgba(13,0,21,.98)',
      cardBg:'#150022', inputBg:'rgba(168,85,247,.07)',
      hoverCard:'rgba(168,85,247,.06)', glow:'rgba(168,85,247,.25)',
    },
    t4: { // Ember
      bg:'#1a0800', panel:'#260c00', panel2:'#331100', panel3:'#401600',
      text:'#ffd4a0', muted:'#a06030', muted2:'#704020',
      line:'rgba(255,140,0,.12)', line2:'rgba(255,140,0,.06)',
      brand:'#ff8c00', brand2:'#ff6600', brand3:'rgba(255,140,0,.1)',
      good:'#44ff88', bad:'#ff3300', warn:'#ffcc00',
      sidebarBg:'#1a0800', topbarBg:'rgba(26,8,0,.98)',
      cardBg:'#260c00', inputBg:'rgba(255,140,0,.07)',
      hoverCard:'rgba(255,140,0,.06)', glow:'rgba(255,140,0,.25)',
    },
    t5: { // Midnight Blue
      bg:'#0a0a14', panel:'#10101e', panel2:'#18182a', panel3:'#202035',
      text:'#c8d0ff', muted:'#5a60a0', muted2:'#3a4080',
      line:'rgba(100,120,255,.1)', line2:'rgba(100,120,255,.05)',
      brand:'#6478ff', brand2:'#4455ee', brand3:'rgba(100,120,255,.1)',
      good:'#44ffaa', bad:'#ff5566', warn:'#ffcc44',
      sidebarBg:'#080814', topbarBg:'rgba(10,10,20,.98)',
      cardBg:'#10101e', inputBg:'rgba(100,120,255,.07)',
      hoverCard:'rgba(100,120,255,.05)', glow:'rgba(100,120,255,.25)',
    },
  },
};

// ═══ AURORA — AI Gradient (DARK layout — uses Flux t1 colors as base) ═══
const AURORA: LayoutDef = {
  id: 'aurora', name: 'Aurora', desc: 'AI gradient · ultra-rounded',
  font: 'Plus Jakarta Sans', fontMono: 'JetBrains Mono',
  radius: '16px', radiusSm: '10px', radiusLg: '20px',
  shadow: '0 8px 32px rgba(0,0,0,.12)',
  swatches: ['#5b21b6','#059669','#e84226','#9333ea','#0284c7','#f43f5e','#3730c8','#16a34a'],
  themes: {
    t1: {
      bg:'#0c0020', panel:'#140030', panel2:'#1c0044', panel3:'#240058',
      text:'#e8d4ff', muted:'#8a6ab0', muted2:'#6a4a90',
      line:'rgba(91,33,182,.15)', line2:'rgba(91,33,182,.08)',
      brand:'#5b21b6', brand2:'#7c3aed', brand3:'rgba(91,33,182,.12)',
      good:'#059669', bad:'#e84226', warn:'#f59e0b',
      sidebarBg:'#0a0018', topbarBg:'rgba(12,0,32,.98)',
      cardBg:'#140030', inputBg:'rgba(91,33,182,.08)',
      hoverCard:'rgba(91,33,182,.06)', glow:'rgba(124,58,237,.25)',
    },
    t2: {
      bg:'#001a12', panel:'#002a1e', panel2:'#003a2a', panel3:'#004a36',
      text:'#c8ffe8', muted:'#4a9070', muted2:'#2a7050',
      line:'rgba(5,150,105,.12)', line2:'rgba(5,150,105,.06)',
      brand:'#059669', brand2:'#0d9488', brand3:'rgba(5,150,105,.1)',
      good:'#34d399', bad:'#ef4444', warn:'#f59e0b',
      sidebarBg:'#00120a', topbarBg:'rgba(0,26,18,.98)',
      cardBg:'#002a1e', inputBg:'rgba(5,150,105,.07)',
      hoverCard:'rgba(5,150,105,.05)', glow:'rgba(13,148,136,.2)',
    },
    t3: {
      bg:'#1a0800', panel:'#280e00', panel2:'#361400', panel3:'#441a00',
      text:'#ffd8c0', muted:'#b06030', muted2:'#904820',
      line:'rgba(232,66,38,.12)', line2:'rgba(232,66,38,.06)',
      brand:'#e84226', brand2:'#f97316', brand3:'rgba(232,66,38,.1)',
      good:'#059669', bad:'#dc2626', warn:'#f59e0b',
      sidebarBg:'#140600', topbarBg:'rgba(26,8,0,.98)',
      cardBg:'#280e00', inputBg:'rgba(232,66,38,.07)',
      hoverCard:'rgba(232,66,38,.06)', glow:'rgba(249,115,22,.25)',
    },
    t4: {
      bg:'#0e0020', panel:'#180032', panel2:'#220044', panel3:'#2c0058',
      text:'#ecc8ff', muted:'#8850b0', muted2:'#6838a0',
      line:'rgba(147,51,234,.12)', line2:'rgba(147,51,234,.06)',
      brand:'#9333ea', brand2:'#c026d3', brand3:'rgba(147,51,234,.1)',
      good:'#059669', bad:'#f43f5e', warn:'#f59e0b',
      sidebarBg:'#0a0018', topbarBg:'rgba(14,0,32,.98)',
      cardBg:'#180032', inputBg:'rgba(147,51,234,.07)',
      hoverCard:'rgba(147,51,234,.06)', glow:'rgba(192,38,211,.25)',
    },
    t5: {
      bg:'#001020', panel:'#001830', panel2:'#002040', panel3:'#002850',
      text:'#c8e8ff', muted:'#4a80a8', muted2:'#2a6088',
      line:'rgba(2,132,199,.12)', line2:'rgba(2,132,199,.06)',
      brand:'#0284c7', brand2:'#0ea5e9', brand3:'rgba(2,132,199,.1)',
      good:'#059669', bad:'#ec4899', warn:'#f59e0b',
      sidebarBg:'#000a18', topbarBg:'rgba(0,16,32,.98)',
      cardBg:'#001830', inputBg:'rgba(2,132,199,.07)',
      hoverCard:'rgba(2,132,199,.05)', glow:'rgba(14,165,233,.2)',
    },
  },
};

// ═══ CARBON — Dark Precision (DARK layout) ═══
const CARBON: LayoutDef = {
  id: 'carbon', name: 'Carbon', desc: 'Dark precision · mono',
  font: 'JetBrains Mono', fontMono: 'JetBrains Mono',
  radius: '6px', radiusSm: '4px', radiusLg: '8px',
  shadow: '0 2px 8px rgba(0,0,0,.2)',
  swatches: ['#f59e0b','#22d3ee','#84cc16','#ec4899','#f97316','#a855f7','#0d9488','#6366f1'],
  themes: {
    t1: {
      bg:'#0a0a0a', panel:'#141414', panel2:'#1a1a1a', panel3:'#222222',
      text:'#ffeec8', muted:'#8c7a40', muted2:'#6c5a28',
      line:'rgba(245,158,11,.1)', line2:'rgba(245,158,11,.05)',
      brand:'#f59e0b', brand2:'#fbbf24', brand3:'rgba(245,158,11,.1)',
      good:'#4ade80', bad:'#f87171', warn:'#fbbf24',
      sidebarBg:'#080808', topbarBg:'rgba(10,10,10,.98)',
      cardBg:'#141414', inputBg:'rgba(245,158,11,.06)',
      hoverCard:'rgba(245,158,11,.05)', glow:'rgba(251,191,36,.2)',
    },
    t2: {
      bg:'#0a1014', panel:'#101820', panel2:'#162028', panel3:'#1c2830',
      text:'#c8f0ff', muted:'#4890a8', muted2:'#286880',
      line:'rgba(34,211,238,.1)', line2:'rgba(34,211,238,.05)',
      brand:'#22d3ee', brand2:'#38bdf8', brand3:'rgba(34,211,238,.1)',
      good:'#4ade80', bad:'#f87171', warn:'#fbbf24',
      sidebarBg:'#080e12', topbarBg:'rgba(10,16,20,.98)',
      cardBg:'#101820', inputBg:'rgba(34,211,238,.07)',
      hoverCard:'rgba(34,211,238,.05)', glow:'rgba(56,189,248,.2)',
    },
    t3: {
      bg:'#0a0e08', panel:'#121810', panel2:'#1a2018', panel3:'#222820',
      text:'#e8ffc8', muted:'#6a8c40', muted2:'#4a6c28',
      line:'rgba(132,204,22,.1)', line2:'rgba(132,204,22,.05)',
      brand:'#84cc16', brand2:'#a3e635', brand3:'rgba(132,204,22,.1)',
      good:'#4ade80', bad:'#f87171', warn:'#fbbf24',
      sidebarBg:'#080c06', topbarBg:'rgba(10,14,8,.98)',
      cardBg:'#121810', inputBg:'rgba(132,204,22,.06)',
      hoverCard:'rgba(132,204,22,.05)', glow:'rgba(163,230,53,.2)',
    },
    t4: {
      bg:'#100810', panel:'#1a101a', panel2:'#221822', panel3:'#2a202a',
      text:'#ffc8e8', muted:'#8c4070', muted2:'#6c2850',
      line:'rgba(236,72,153,.1)', line2:'rgba(236,72,153,.05)',
      brand:'#ec4899', brand2:'#f472b6', brand3:'rgba(236,72,153,.1)',
      good:'#4ade80', bad:'#f87171', warn:'#fbbf24',
      sidebarBg:'#0e060e', topbarBg:'rgba(16,8,16,.98)',
      cardBg:'#1a101a', inputBg:'rgba(236,72,153,.07)',
      hoverCard:'rgba(236,72,153,.06)', glow:'rgba(244,114,182,.25)',
    },
    t5: {
      bg:'#0e0800', panel:'#1a1000', panel2:'#221800', panel3:'#2a2000',
      text:'#ffd8a0', muted:'#a07030', muted2:'#805020',
      line:'rgba(249,115,22,.1)', line2:'rgba(249,115,22,.05)',
      brand:'#f97316', brand2:'#fb923c', brand3:'rgba(249,115,22,.1)',
      good:'#4ade80', bad:'#f43f5e', warn:'#fbbf24',
      sidebarBg:'#0c0600', topbarBg:'rgba(14,8,0,.98)',
      cardBg:'#1a1000', inputBg:'rgba(249,115,22,.07)',
      hoverCard:'rgba(249,115,22,.06)', glow:'rgba(251,146,60,.25)',
    },
  },
};

// ═══ PRISM — Bold Fintech (LIGHT layout) ═══
const PRISM: LayoutDef = {
  id: 'prism', name: 'Prism', desc: 'Bold fintech · geometric',
  font: 'Space Grotesk', fontMono: 'JetBrains Mono',
  radius: '6px', radiusSm: '4px', radiusLg: '10px',
  shadow: '0 2px 12px rgba(0,0,0,.08)',
  swatches: ['#1c2a8c','#991b1b','#14532d','#a16207','#0f172a','#182a64','#7e22ce','#7c4614'],
  themes: {
    t1: { // Vector-style light
      bg:'#f0f4f8', panel:'#ffffff', panel2:'#e8eef5', panel3:'#d8e4ee',
      text:'#1a2b3d', muted:'#4a6076', muted2:'#7a94a8',
      line:'rgba(26,43,61,.1)', line2:'rgba(26,43,61,.06)',
      brand:'#1c2a8c', brand2:'#3b4ec8', brand3:'rgba(28,42,140,.1)',
      good:'#166534', bad:'#991b1b', warn:'#a16207',
      sidebarBg:'#1a2b3d', topbarBg:'rgba(255,255,255,.97)',
      cardBg:'#ffffff', inputBg:'rgba(28,42,140,.05)',
      hoverCard:'rgba(28,42,140,.04)', glow:'rgba(59,78,200,.15)',
    },
    t2: {
      bg:'#fef2f2', panel:'#ffffff', panel2:'#fee2e2', panel3:'#fecaca',
      text:'#1c1111', muted:'#6b3030', muted2:'#9c5858',
      line:'rgba(153,27,27,.09)', line2:'rgba(153,27,27,.05)',
      brand:'#991b1b', brand2:'#dc2626', brand3:'rgba(153,27,27,.1)',
      good:'#166534', bad:'#7f1d1d', warn:'#a16207',
      sidebarBg:'#450a0a', topbarBg:'rgba(255,255,255,.97)',
      cardBg:'#ffffff', inputBg:'rgba(153,27,27,.05)',
      hoverCard:'rgba(153,27,27,.04)', glow:'rgba(220,38,38,.15)',
    },
    t3: {
      bg:'#f0fdf4', panel:'#ffffff', panel2:'#dcfce7', panel3:'#bbf7d0',
      text:'#0a2014', muted:'#2d5a3a', muted2:'#5a8a6a',
      line:'rgba(20,83,45,.09)', line2:'rgba(20,83,45,.05)',
      brand:'#14532d', brand2:'#166534', brand3:'rgba(20,83,45,.1)',
      good:'#15803d', bad:'#991b1b', warn:'#a16207',
      sidebarBg:'#052e16', topbarBg:'rgba(255,255,255,.97)',
      cardBg:'#ffffff', inputBg:'rgba(20,83,45,.05)',
      hoverCard:'rgba(20,83,45,.04)', glow:'rgba(22,101,52,.15)',
    },
    t4: {
      bg:'#fffbeb', panel:'#ffffff', panel2:'#fef3c7', panel3:'#fde68a',
      text:'#1c1400', muted:'#6b4e10', muted2:'#a08030',
      line:'rgba(161,98,7,.09)', line2:'rgba(161,98,7,.05)',
      brand:'#a16207', brand2:'#ca8a04', brand3:'rgba(161,98,7,.1)',
      good:'#166534', bad:'#991b1b', warn:'#78350f',
      sidebarBg:'#451a03', topbarBg:'rgba(255,255,255,.97)',
      cardBg:'#ffffff', inputBg:'rgba(161,98,7,.05)',
      hoverCard:'rgba(161,98,7,.04)', glow:'rgba(202,138,4,.15)',
    },
    t5: {
      bg:'#f8fafc', panel:'#ffffff', panel2:'#f1f5f9', panel3:'#e2e8f0',
      text:'#0f172a', muted:'#475569', muted2:'#94a3b8',
      line:'rgba(15,23,42,.09)', line2:'rgba(15,23,42,.05)',
      brand:'#0f172a', brand2:'#1e293b', brand3:'rgba(15,23,42,.08)',
      good:'#166534', bad:'#991b1b', warn:'#a16207',
      sidebarBg:'#0f172a', topbarBg:'rgba(255,255,255,.97)',
      cardBg:'#ffffff', inputBg:'rgba(15,23,42,.05)',
      hoverCard:'rgba(15,23,42,.04)', glow:'rgba(30,41,59,.15)',
    },
  },
};

// ═══ PULSE — CoinPulse dark glass (DARK layout) ═══
const PULSE: LayoutDef = {
  id: 'pulse', name: 'Pulse', desc: 'CoinPulse-inspired · dark glass',
  font: 'DM Sans', fontMono: 'JetBrains Mono',
  radius: '10px', radiusSm: '6px', radiusLg: '14px',
  shadow: '0 8px 24px rgba(0,0,0,.3)',
  swatches: ['#071018','#27e0a3','#2bb8ff','#8b7bff','#ff627e','#ffb84d','#0b1d2d','#12283d'],
  themes: {
    t1: {
      bg:'#071018', panel:'#0b1d2d', panel2:'#0f2840', panel3:'#123350',
      text:'#d0f0e8', muted:'#4a9080', muted2:'#2a7060',
      line:'rgba(39,224,163,.1)', line2:'rgba(39,224,163,.05)',
      brand:'#27e0a3', brand2:'#1fb88a', brand3:'rgba(39,224,163,.1)',
      good:'#27e0a3', bad:'#ff627e', warn:'#ffb84d',
      sidebarBg:'#050e14', topbarBg:'rgba(7,16,24,.98)',
      cardBg:'#0b1d2d', inputBg:'rgba(39,224,163,.06)',
      hoverCard:'rgba(39,224,163,.05)', glow:'rgba(39,224,163,.2)',
    },
    t2: {
      bg:'#061020', panel:'#0a1830', panel2:'#0e2040', panel3:'#122850',
      text:'#c8e4ff', muted:'#4888b8', muted2:'#2868a0',
      line:'rgba(43,184,255,.1)', line2:'rgba(43,184,255,.05)',
      brand:'#2bb8ff', brand2:'#1a9de0', brand3:'rgba(43,184,255,.1)',
      good:'#27e0a3', bad:'#ff627e', warn:'#ffb84d',
      sidebarBg:'#040c18', topbarBg:'rgba(6,16,32,.98)',
      cardBg:'#0a1830', inputBg:'rgba(43,184,255,.07)',
      hoverCard:'rgba(43,184,255,.05)', glow:'rgba(43,184,255,.2)',
    },
    t3: {
      bg:'#0c0820', panel:'#140e30', panel2:'#1c1440', panel3:'#241a50',
      text:'#d4c8ff', muted:'#6858b0', muted2:'#4838a0',
      line:'rgba(139,123,255,.1)', line2:'rgba(139,123,255,.05)',
      brand:'#8b7bff', brand2:'#6b5be0', brand3:'rgba(139,123,255,.1)',
      good:'#27e0a3', bad:'#ff627e', warn:'#ffb84d',
      sidebarBg:'#0a0618', topbarBg:'rgba(12,8,32,.98)',
      cardBg:'#140e30', inputBg:'rgba(139,123,255,.07)',
      hoverCard:'rgba(139,123,255,.05)', glow:'rgba(139,123,255,.25)',
    },
    t4: {
      bg:'#180810', panel:'#241018', panel2:'#301820', panel3:'#3c2028',
      text:'#ffc8d8', muted:'#a04860', muted2:'#802840',
      line:'rgba(255,98,126,.1)', line2:'rgba(255,98,126,.05)',
      brand:'#ff627e', brand2:'#e04060', brand3:'rgba(255,98,126,.1)',
      good:'#27e0a3', bad:'#ff4060', warn:'#ffb84d',
      sidebarBg:'#14060c', topbarBg:'rgba(24,8,16,.98)',
      cardBg:'#241018', inputBg:'rgba(255,98,126,.07)',
      hoverCard:'rgba(255,98,126,.06)', glow:'rgba(255,98,126,.25)',
    },
    t5: {
      bg:'#100c00', panel:'#1a1400', panel2:'#241c00', panel3:'#2e2400',
      text:'#ffe8a8', muted:'#a08830', muted2:'#806818',
      line:'rgba(255,184,77,.1)', line2:'rgba(255,184,77,.05)',
      brand:'#ffb84d', brand2:'#e09830', brand3:'rgba(255,184,77,.1)',
      good:'#27e0a3', bad:'#ff627e', warn:'#e09830',
      sidebarBg:'#0e0a00', topbarBg:'rgba(16,12,0,.98)',
      cardBg:'#1a1400', inputBg:'rgba(255,184,77,.07)',
      hoverCard:'rgba(255,184,77,.06)', glow:'rgba(255,184,77,.25)',
    },
  },
};

// ═══ SOLID ADVISORY — Clean structured consulting ═══
const SOLID_ADVISORY: LayoutDef = {
  id: 'solid_advisory', name: 'Solid Advisory', desc: 'Structured consulting · professional',
  font: 'DM Sans', fontMono: 'JetBrains Mono',
  radius: '8px', radiusSm: '4px', radiusLg: '12px',
  shadow: '0 1px 3px rgba(0,0,0,.06), 0 6px 16px rgba(0,0,0,.04)',
  swatches: ['#f7f8fa','#1a365d','#2b6cb0','#276749','#c53030','#dd6b20','#2c5282','#2d3748'],
  themes: {
    t1: { // Navy Professional
      bg:'#f7f8fa', panel:'#ffffff', panel2:'#edf2f7', panel3:'#e2e8f0',
      text:'#1a202c', muted:'#4a5568', muted2:'#a0aec0',
      line:'rgba(26,54,93,.08)', line2:'rgba(26,54,93,.04)',
      brand:'#1a365d', brand2:'#2b6cb0', brand3:'rgba(26,54,93,.08)',
      good:'#276749', bad:'#c53030', warn:'#dd6b20',
      sidebarBg:'#1a365d', topbarBg:'rgba(247,248,250,.97)',
      cardBg:'#ffffff', inputBg:'rgba(26,54,93,.03)',
      hoverCard:'rgba(26,54,93,.03)', glow:'rgba(43,108,176,.12)',
    },
    t2: { // Warm Stone
      bg:'#faf9f7', panel:'#ffffff', panel2:'#f5f0eb', panel3:'#ebe0d5',
      text:'#2d2319', muted:'#6b5c4d', muted2:'#a89b8c',
      line:'rgba(45,35,25,.08)', line2:'rgba(45,35,25,.04)',
      brand:'#7b5e3b', brand2:'#a37840', brand3:'rgba(123,94,59,.08)',
      good:'#2f6846', bad:'#c53030', warn:'#b7791f',
      sidebarBg:'#3d2e1e', topbarBg:'rgba(250,249,247,.97)',
      cardBg:'#ffffff', inputBg:'rgba(123,94,59,.03)',
      hoverCard:'rgba(123,94,59,.03)', glow:'rgba(163,120,64,.12)',
    },
    t3: { // Forest Advisory
      bg:'#f4f7f5', panel:'#ffffff', panel2:'#e6f0ea', panel3:'#d0e4d8',
      text:'#1a2e22', muted:'#3d6b50', muted2:'#7aab90',
      line:'rgba(26,46,34,.08)', line2:'rgba(26,46,34,.04)',
      brand:'#1e5a3a', brand2:'#2f8a5a', brand3:'rgba(30,90,58,.08)',
      good:'#276749', bad:'#c53030', warn:'#dd6b20',
      sidebarBg:'#1a3328', topbarBg:'rgba(244,247,245,.97)',
      cardBg:'#ffffff', inputBg:'rgba(30,90,58,.03)',
      hoverCard:'rgba(30,90,58,.03)', glow:'rgba(47,138,90,.12)',
    },
    t4: { // Slate Corp
      bg:'#f8f9fb', panel:'#ffffff', panel2:'#eef1f6', panel3:'#dde3ed',
      text:'#1e2a3a', muted:'#506278', muted2:'#8a9ab0',
      line:'rgba(30,42,58,.08)', line2:'rgba(30,42,58,.04)',
      brand:'#3a506b', brand2:'#5a7aa0', brand3:'rgba(58,80,107,.08)',
      good:'#276749', bad:'#c53030', warn:'#dd6b20',
      sidebarBg:'#283848', topbarBg:'rgba(248,249,251,.97)',
      cardBg:'#ffffff', inputBg:'rgba(58,80,107,.03)',
      hoverCard:'rgba(58,80,107,.03)', glow:'rgba(90,122,160,.12)',
    },
    t5: { // Charcoal
      bg:'#f5f5f5', panel:'#ffffff', panel2:'#ebebeb', panel3:'#d9d9d9',
      text:'#1a1a1a', muted:'#555555', muted2:'#999999',
      line:'rgba(0,0,0,.07)', line2:'rgba(0,0,0,.04)',
      brand:'#333333', brand2:'#555555', brand3:'rgba(51,51,51,.08)',
      good:'#276749', bad:'#c53030', warn:'#dd6b20',
      sidebarBg:'#1a1a1a', topbarBg:'rgba(245,245,245,.97)',
      cardBg:'#ffffff', inputBg:'rgba(0,0,0,.02)',
      hoverCard:'rgba(0,0,0,.02)', glow:'rgba(85,85,85,.1)',
    },
  },
};

// ═══ EDITORIAL FINANCE — Report-like editorial style ═══
const EDITORIAL_FINANCE: LayoutDef = {
  id: 'editorial_finance', name: 'Editorial Finance', desc: 'Editorial report · narrative',
  font: 'Space Grotesk', fontMono: 'JetBrains Mono',
  radius: '3px', radiusSm: '2px', radiusLg: '6px',
  shadow: '0 1px 2px rgba(0,0,0,.05)',
  swatches: ['#fefdfb','#1b1b1b','#8b0000','#004d40','#bf360c','#1a237e','#4a148c','#e65100'],
  themes: {
    t1: { // Classic Editorial
      bg:'#fefdfb', panel:'#ffffff', panel2:'#f8f5f0', panel3:'#f0ebe3',
      text:'#1b1b1b', muted:'#5c5c5c', muted2:'#9a9a9a',
      line:'rgba(27,27,27,.1)', line2:'rgba(27,27,27,.05)',
      brand:'#1b1b1b', brand2:'#3a3a3a', brand3:'rgba(27,27,27,.06)',
      good:'#004d40', bad:'#8b0000', warn:'#bf360c',
      sidebarBg:'#1b1b1b', topbarBg:'rgba(254,253,251,.98)',
      cardBg:'#ffffff', inputBg:'rgba(27,27,27,.03)',
      hoverCard:'rgba(27,27,27,.02)', glow:'rgba(58,58,58,.08)',
    },
    t2: { // Burgundy Report
      bg:'#fdf8f6', panel:'#ffffff', panel2:'#f5ebe6', panel3:'#ecddd5',
      text:'#2a1515', muted:'#6b4040', muted2:'#a87878',
      line:'rgba(139,0,0,.08)', line2:'rgba(139,0,0,.04)',
      brand:'#8b0000', brand2:'#b71c1c', brand3:'rgba(139,0,0,.06)',
      good:'#004d40', bad:'#6d0000', warn:'#bf360c',
      sidebarBg:'#3c1010', topbarBg:'rgba(253,248,246,.98)',
      cardBg:'#ffffff', inputBg:'rgba(139,0,0,.03)',
      hoverCard:'rgba(139,0,0,.02)', glow:'rgba(183,28,28,.1)',
    },
    t3: { // Teal Journal
      bg:'#f5faf9', panel:'#ffffff', panel2:'#e0f2f0', panel3:'#c8e6e0',
      text:'#0a2820', muted:'#2e6b5a', muted2:'#6aab98',
      line:'rgba(0,77,64,.08)', line2:'rgba(0,77,64,.04)',
      brand:'#004d40', brand2:'#00796b', brand3:'rgba(0,77,64,.06)',
      good:'#1b5e20', bad:'#8b0000', warn:'#bf360c',
      sidebarBg:'#002820', topbarBg:'rgba(245,250,249,.98)',
      cardBg:'#ffffff', inputBg:'rgba(0,77,64,.03)',
      hoverCard:'rgba(0,77,64,.02)', glow:'rgba(0,121,107,.1)',
    },
    t4: { // Deep Indigo
      bg:'#f8f8fc', panel:'#ffffff', panel2:'#eeedf8', panel3:'#dddcf0',
      text:'#111330', muted:'#4040a0', muted2:'#8080c0',
      line:'rgba(26,35,126,.08)', line2:'rgba(26,35,126,.04)',
      brand:'#1a237e', brand2:'#3949ab', brand3:'rgba(26,35,126,.06)',
      good:'#004d40', bad:'#8b0000', warn:'#e65100',
      sidebarBg:'#111340', topbarBg:'rgba(248,248,252,.98)',
      cardBg:'#ffffff', inputBg:'rgba(26,35,126,.03)',
      hoverCard:'rgba(26,35,126,.02)', glow:'rgba(57,73,171,.1)',
    },
    t5: { // Sepia Warm
      bg:'#faf7f2', panel:'#ffffff', panel2:'#f2ece2', panel3:'#e8dfd0',
      text:'#2a2015', muted:'#6b5840', muted2:'#a89878',
      line:'rgba(42,32,21,.08)', line2:'rgba(42,32,21,.04)',
      brand:'#5d4037', brand2:'#795548', brand3:'rgba(93,64,55,.06)',
      good:'#2e7d32', bad:'#c62828', warn:'#e65100',
      sidebarBg:'#3e2723', topbarBg:'rgba(250,247,242,.98)',
      cardBg:'#ffffff', inputBg:'rgba(93,64,55,.03)',
      hoverCard:'rgba(93,64,55,.02)', glow:'rgba(121,85,72,.1)',
    },
  },
};

// ═══ DARK LEDGER — Premium dark finance dashboard ═══
const DARK_LEDGER: LayoutDef = {
  id: 'dark_ledger', name: 'Dark Ledger', desc: 'Premium dark · high-contrast data',
  font: 'Inter', fontMono: 'JetBrains Mono',
  radius: '6px', radiusSm: '3px', radiusLg: '10px',
  shadow: '0 2px 8px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.04)',
  swatches: ['#0d1117','#58a6ff','#3fb950','#f85149','#d29922','#bc8cff','#79c0ff','#e3b341'],
  themes: {
    t1: { // GitHub Dark
      bg:'#0d1117', panel:'#161b22', panel2:'#21262d', panel3:'#30363d',
      text:'#c9d1d9', muted:'#8b949e', muted2:'#6e7681',
      line:'rgba(240,246,252,.06)', line2:'rgba(240,246,252,.03)',
      brand:'#58a6ff', brand2:'#79c0ff', brand3:'rgba(88,166,255,.1)',
      good:'#3fb950', bad:'#f85149', warn:'#d29922',
      sidebarBg:'#010409', topbarBg:'rgba(13,17,23,.98)',
      cardBg:'#161b22', inputBg:'rgba(88,166,255,.06)',
      hoverCard:'rgba(88,166,255,.04)', glow:'rgba(88,166,255,.15)',
    },
    t2: { // Violet Night
      bg:'#0f0b1a', panel:'#1a1428', panel2:'#241e38', panel3:'#2e2848',
      text:'#d8ccf0', muted:'#8a78b0', muted2:'#6a58a0',
      line:'rgba(188,140,255,.08)', line2:'rgba(188,140,255,.04)',
      brand:'#bc8cff', brand2:'#a855f7', brand3:'rgba(188,140,255,.1)',
      good:'#3fb950', bad:'#f85149', warn:'#e3b341',
      sidebarBg:'#0a0612', topbarBg:'rgba(15,11,26,.98)',
      cardBg:'#1a1428', inputBg:'rgba(188,140,255,.06)',
      hoverCard:'rgba(188,140,255,.04)', glow:'rgba(168,85,247,.2)',
    },
    t3: { // Emerald Terminal
      bg:'#0a1210', panel:'#0f1c18', panel2:'#142620', panel3:'#1a3028',
      text:'#c8f0d8', muted:'#58a878', muted2:'#388858',
      line:'rgba(63,185,80,.08)', line2:'rgba(63,185,80,.04)',
      brand:'#3fb950', brand2:'#56d364', brand3:'rgba(63,185,80,.1)',
      good:'#3fb950', bad:'#f85149', warn:'#d29922',
      sidebarBg:'#06100c', topbarBg:'rgba(10,18,16,.98)',
      cardBg:'#0f1c18', inputBg:'rgba(63,185,80,.06)',
      hoverCard:'rgba(63,185,80,.04)', glow:'rgba(86,211,100,.15)',
    },
    t4: { // Amber Trading
      bg:'#12100a', panel:'#1c1810', panel2:'#262018', panel3:'#302820',
      text:'#f0dca8', muted:'#b09848', muted2:'#907828',
      line:'rgba(227,179,65,.08)', line2:'rgba(227,179,65,.04)',
      brand:'#e3b341', brand2:'#d29922', brand3:'rgba(227,179,65,.1)',
      good:'#3fb950', bad:'#f85149', warn:'#d29922',
      sidebarBg:'#100e06', topbarBg:'rgba(18,16,10,.98)',
      cardBg:'#1c1810', inputBg:'rgba(227,179,65,.06)',
      hoverCard:'rgba(227,179,65,.04)', glow:'rgba(210,153,34,.2)',
    },
    t5: { // Ice Steel
      bg:'#0c1016', panel:'#121820', panel2:'#18202a', panel3:'#1e2834',
      text:'#c0d4e8', muted:'#6890b0', muted2:'#487098',
      line:'rgba(121,192,255,.08)', line2:'rgba(121,192,255,.04)',
      brand:'#79c0ff', brand2:'#58a6ff', brand3:'rgba(121,192,255,.1)',
      good:'#3fb950', bad:'#f85149', warn:'#e3b341',
      sidebarBg:'#080c12', topbarBg:'rgba(12,16,22,.98)',
      cardBg:'#121820', inputBg:'rgba(121,192,255,.06)',
      hoverCard:'rgba(121,192,255,.04)', glow:'rgba(88,166,255,.15)',
    },
  },
};

export const LAYOUTS: LayoutDef[] = [FLUX, CIPHER, PRISM, PULSE, SOLID_ADVISORY, EDITORIAL_FINANCE, DARK_LEDGER];
export const THEME_NAMES: Record<string, string> = { t1: 'Theme 1', t2: 'Theme 2', t3: 'Theme 3', t4: 'Theme 4', t5: 'Theme 5' };
export const FONTS = ['Inter','JetBrains Mono','Space Grotesk','Sora','Plus Jakarta Sans','DM Sans','Outfit','Fira Code','IBM Plex Mono','Roboto'];
export const FONT_SIZES = [9,10,11,12,13,14];
export const VISION_PROFILES = ['standard','large','xlarge','compact'] as const;

// ── FONT_CONFIG — exact match from TRACKER_CLOUDFLARE- repo ──
export const FONT_CONFIG = {
  baseSize: 11, minSize: 9, maxSize: 18,
  breakpoints: { mobile: 480, tablet: 900, desktop: 1366, wide: 1920 },
  scaleFactors: { mobile: 0.9, tablet: 1.0, desktop: 1.05, wide: 1.1 },
  visionProfiles: { standard: 1.0, large: 1.15, xlarge: 1.3, compact: 0.9 } as Record<string, number>,
};

export function detectOptimalFontSize(baseSize: number, visionProfile: string): number {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1366;
  const base = Number(baseSize || FONT_CONFIG.baseSize) || FONT_CONFIG.baseSize;

  let scale = 1.0;
  if (width < FONT_CONFIG.breakpoints.mobile) scale = FONT_CONFIG.scaleFactors.mobile;
  else if (width < FONT_CONFIG.breakpoints.tablet) scale = FONT_CONFIG.scaleFactors.tablet;
  else if (width < FONT_CONFIG.breakpoints.desktop) scale = FONT_CONFIG.scaleFactors.desktop;
  else scale = FONT_CONFIG.scaleFactors.wide;

  const vm = FONT_CONFIG.visionProfiles[String(visionProfile || 'standard')] || 1.0;
  let finalSize = Math.round(base * scale * vm);
  finalSize = Math.max(FONT_CONFIG.minSize, Math.min(FONT_CONFIG.maxSize, finalSize));
  return finalSize;
}

// ── Settings shape ──
export interface AppSettings {
  layout: string;
  theme: string;
  range: 'today' | '7d' | '30d' | 'all';
  currency: 'QAR' | 'USDT';
  language: 'en' | 'ar';
  searchQuery: string;
  lowStockThreshold: number;
  priceAlertThreshold: number;
  allowInvalidTrades: boolean;
  ledgerFont: string;
  ledgerFontSize: number;
  fontVisionProfile: string;
  autoFontDisable: boolean;
  autoBackup: boolean;
  logsEnabled: boolean;
  logLevel: 'error' | 'warn' | 'info';
}

const DEFAULT_SETTINGS: AppSettings = {
  layout: 'flux', theme: 't1',
  range: '7d', currency: 'QAR', language: 'en', searchQuery: '',
  lowStockThreshold: 5000, priceAlertThreshold: 2,
  allowInvalidTrades: true,
  ledgerFont: 'Inter', ledgerFontSize: 11,
  fontVisionProfile: 'standard', autoFontDisable: false,
  autoBackup: false, logsEnabled: true, logLevel: 'info',
};

// ── Log entry ──
export interface LogEntry {
  id: string;
  ts: number;
  level: 'error' | 'warn' | 'info';
  message: string;
  detail?: string;
}

// ── Context shape ──
interface ThemeContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  save: () => void;
  discard: () => void;
  isDirty: boolean;
  currentLayout: LayoutDef;
  currentTheme: ThemeDef;
  logs: LogEntry[];
  addLog: (level: LogEntry['level'], message: string, detail?: string) => void;
  clearLogs: () => void;
  downloadLogs: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── Hex to HSL converter ──
function hexToHSL(hex: string): string {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Is a color "dark"? (luminance < 0.4)
function isDark(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.4;
}

function loadSavedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('tracker_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function loadLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem('tracker_logs');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

// visionMultiplier removed — now using detectOptimalFontSize from FONT_CONFIG

function getTheme(layoutId: string, themeId: string): { layout: LayoutDef; theme: ThemeDef } {
  const layout = LAYOUTS.find(l => l.id === layoutId) || LAYOUTS[0];
  const theme = layout.themes[themeId] || layout.themes.t1;
  return { layout, theme };
}

// ── Apply CSS variables to :root ──
function applyThemeToDOM(settings: AppSettings) {
  const root = document.documentElement;
  const { layout, theme } = getTheme(settings.layout, settings.theme);
  const dark = isDark(theme.bg);

  // Toggle dark class based on actual background luminance
  if (dark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Background & foreground
  root.style.setProperty('--background', hexToHSL(theme.bg));
  root.style.setProperty('--foreground', hexToHSL(theme.text));

  // Card
  root.style.setProperty('--card', hexToHSL(theme.cardBg));
  root.style.setProperty('--card-foreground', hexToHSL(theme.text));

  // Popover
  root.style.setProperty('--popover', hexToHSL(theme.panel));
  root.style.setProperty('--popover-foreground', hexToHSL(theme.text));

  // Primary
  root.style.setProperty('--primary', hexToHSL(theme.brand));
  root.style.setProperty('--primary-foreground', dark ? hexToHSL(theme.bg) : '0 0% 100%');

  // Secondary
  root.style.setProperty('--secondary', hexToHSL(theme.panel2));
  root.style.setProperty('--secondary-foreground', hexToHSL(theme.text));

  // Muted
  root.style.setProperty('--muted', hexToHSL(theme.panel3));
  root.style.setProperty('--muted-foreground', hexToHSL(theme.muted));

  // Accent (good/success)
  root.style.setProperty('--accent', hexToHSL(theme.panel2));
  root.style.setProperty('--accent-foreground', hexToHSL(theme.text));

  // Destructive
  root.style.setProperty('--destructive', hexToHSL(theme.bad));
  root.style.setProperty('--destructive-foreground', '0 0% 100%');

  // Warning & Success semantic colors
  root.style.setProperty('--warning', hexToHSL(theme.warn));
  root.style.setProperty('--warning-foreground', '0 0% 100%');
  root.style.setProperty('--success', hexToHSL(theme.good));
  root.style.setProperty('--success-foreground', '0 0% 100%');

  // Border / Input / Ring
  root.style.setProperty('--border', hexToHSL(theme.panel3));
  root.style.setProperty('--input', hexToHSL(theme.panel3));
  root.style.setProperty('--ring', hexToHSL(theme.brand));

  // Radius
  root.style.setProperty('--radius', layout.radius);

  // Sidebar — use sidebar-specific bg or derive from theme
  const sidebarDark = isDark(theme.sidebarBg);
  root.style.setProperty('--sidebar-background', hexToHSL(theme.sidebarBg));
  root.style.setProperty('--sidebar-foreground', sidebarDark ? '210 40% 92%' : hexToHSL(theme.text));
  root.style.setProperty('--sidebar-primary', hexToHSL(theme.brand));
  root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
  root.style.setProperty('--sidebar-accent', sidebarDark ? hexToHSL(theme.panel2) : hexToHSL(theme.panel3));
  root.style.setProperty('--sidebar-accent-foreground', sidebarDark ? '210 40% 92%' : hexToHSL(theme.text));
  root.style.setProperty('--sidebar-border', hexToHSL(theme.panel3));
  root.style.setProperty('--sidebar-ring', hexToHSL(theme.brand));

  // Chart colors
  root.style.setProperty('--chart-1', hexToHSL(theme.brand));
  root.style.setProperty('--chart-2', hexToHSL(theme.good));
  root.style.setProperty('--chart-3', hexToHSL(theme.warn));
  root.style.setProperty('--chart-4', hexToHSL(theme.brand2));
  root.style.setProperty('--chart-5', hexToHSL(theme.bad));

  // Tracker palette (for tracker.css pages)
  root.style.setProperty('--tracker-bg', theme.bg);
  root.style.setProperty('--tracker-panel', theme.panel);
  root.style.setProperty('--tracker-panel2', theme.panel2);
  root.style.setProperty('--tracker-panel3', theme.panel3);
  root.style.setProperty('--tracker-text', theme.text);
  root.style.setProperty('--tracker-muted', theme.muted);
  root.style.setProperty('--tracker-muted2', theme.muted2);
  root.style.setProperty('--tracker-line', theme.line);
  root.style.setProperty('--tracker-line2', theme.line2);
  root.style.setProperty('--tracker-brand', theme.brand);
  root.style.setProperty('--tracker-brand2', theme.brand2);
  root.style.setProperty('--tracker-brand3', theme.brand3);
  root.style.setProperty('--tracker-good', theme.good);
  root.style.setProperty('--tracker-bad', theme.bad);
  root.style.setProperty('--tracker-warn', theme.warn);
  root.style.setProperty('--tracker-sidebar-bg', theme.sidebarBg);
  root.style.setProperty('--tracker-topbar-bg', theme.topbarBg);
  root.style.setProperty('--tracker-card-bg', theme.cardBg);
  root.style.setProperty('--tracker-input-bg', theme.inputBg);
  root.style.setProperty('--tracker-hover-card', theme.hoverCard);
  root.style.setProperty('--tracker-glow', theme.glow);
  root.style.setProperty('--tracker-kpi-accent', `linear-gradient(135deg, ${theme.brand}, ${theme.brand2})`);
  root.style.setProperty('--tracker-t1', theme.brand);
  root.style.setProperty('--tracker-t2', theme.brand2);
  root.style.setProperty('--tracker-t3', theme.good);
  root.style.setProperty('--tracker-t4', theme.bad);
  root.style.setProperty('--tracker-t5', layout.themes.t5?.brand ?? theme.warn);

  // Tracker layout geometry
  root.style.setProperty('--lt-radius', layout.radius);
  root.style.setProperty('--lt-radius-sm', layout.radiusSm);
  root.style.setProperty('--lt-radius-lg', layout.radiusLg);
  root.style.setProperty('--lt-shadow', layout.shadow);
  root.style.setProperty('--lt-shadow2', dark ? '0 2px 8px rgba(0,0,0,.2)' : '0 2px 8px rgba(0,0,0,.08)');

  // Fonts
  root.style.setProperty('--font-display', `'${layout.font}', ${layout.font === layout.fontMono ? 'monospace' : 'sans-serif'}`);
  root.style.setProperty('--font-body', `'${layout.font}', sans-serif`);
  root.style.setProperty('--font-ledger', `'${settings.ledgerFont}', sans-serif`);
  root.style.setProperty('--lt-font', `'${settings.ledgerFont}', sans-serif`);
  root.style.setProperty('--lt-font-mono', `'${layout.fontMono}', 'Fira Code', monospace`);

  // Font size — exact replica of detectOptimalFontSize_ from source repo
  const base = Number(settings.ledgerFontSize || FONT_CONFIG.baseSize) || FONT_CONFIG.baseSize;
  const computed = settings.autoFontDisable ? base : detectOptimalFontSize(base, settings.fontVisionProfile);
  const lfsClamped = Math.max(FONT_CONFIG.minSize, Math.min(FONT_CONFIG.maxSize, computed));
  const uiScale = Number((lfsClamped / FONT_CONFIG.baseSize).toFixed(4));
  root.style.setProperty('--app-font', `'${settings.ledgerFont}', sans-serif`);
  root.style.setProperty('--ui-fs', `${lfsClamped}px`);
  root.style.setProperty('--ui-scale', String(uiScale));
  root.style.setProperty('--ledger-font', `'${settings.ledgerFont}', sans-serif`);
  root.style.setProperty('--ledger-fs', `${lfsClamped}px`);
  root.style.setProperty('--ledger-font-size', `${lfsClamped}px`);

  // Global font application
  document.body.style.fontFamily = `'${settings.ledgerFont}', sans-serif`;
  document.body.style.fontSize = `${lfsClamped}px`;
}

// ── Provider ──
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<AppSettings>(loadSavedSettings);
  const [draft, setDraft] = useState<AppSettings>(loadSavedSettings);
  const [dirty, setDirty] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(loadLogs);
  const logsRef = useRef(logs);
  const settingsRef = useRef(draft);
  logsRef.current = logs;
  settingsRef.current = draft;

  const pushLog = useCallback((level: LogEntry['level'], message: string, detail?: string) => {
    const settingsNow = settingsRef.current;
    if (!settingsNow.logsEnabled) return;
    const levels: Record<LogEntry['level'], number> = { error: 0, warn: 1, info: 2 };
    if (levels[level] > levels[settingsNow.logLevel]) return;

    const entry: LogEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      level,
      message,
      detail,
    };

    setLogs(prev => {
      const next = [entry, ...prev].slice(0, 500);
      localStorage.setItem('tracker_logs', JSON.stringify(next));
      return next;
    });
  }, []);

  // Apply theme on every draft change (live preview)
  useEffect(() => {
    applyThemeToDOM(draft);
  }, [draft]);

  // Auto-refresh font size on resize (matching source repo)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        // Only re-apply if auto-font is enabled
        if (!settingsRef.current.autoFontDisable) {
          applyThemeToDOM(settingsRef.current);
        }
      }, 250);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (t) clearTimeout(t);
    };
  }, []);

  // Runtime error capture
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      pushLog('error', event.message || 'Runtime error', String(event.error?.stack || event.error || 'Unknown error'));
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      pushLog('error', 'Unhandled promise rejection', String(event.reason ?? 'Unknown reason'));
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [pushLog]);

  // Load all Google Fonts on mount
  useEffect(() => {
    applyThemeToDOM(saved);
    const fonts = [...new Set(LAYOUTS.map(l => l.font).concat(FONTS))];
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${fonts.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700;800`).join('&')}&display=swap`;
    document.head.appendChild(link);
  }, []);

  // Auto-save timer ref
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((patch: Partial<AppSettings>) => {
    const changed = (Object.keys(patch) as (keyof AppSettings)[]).filter((key) => draft[key] !== patch[key]);
    if (changed.length === 0) return;

    const next = { ...draft, ...patch };
    setDraft(next);
    setDirty(true);

    const isTypingOnly = changed.length === 1 && changed[0] === 'searchQuery';
    if (!(patch.logsEnabled === false && changed.length === 1) && !isTypingOnly) {
      pushLog('info', `Settings updated: ${changed.join(', ')}`);
    }

    // Auto-save after 800ms debounce
    if (!isTypingOnly) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        localStorage.setItem('tracker_settings', JSON.stringify(next));
        setSaved(next);
        setDirty(false);
        pushLog('info', 'Auto-saved settings');
      }, 800);
    }
  }, [draft, pushLog]);

  const save = useCallback(() => {
    localStorage.setItem('tracker_settings', JSON.stringify(draft));
    setSaved(draft);
    setDirty(false);
    pushLog('info', 'Settings saved');
  }, [draft, pushLog]);

  const discard = useCallback(() => {
    setDraft(saved);
    setDirty(false);
    pushLog('warn', 'Pending settings changes discarded');
  }, [saved, pushLog]);

  const addLog = useCallback((level: LogEntry['level'], message: string, detail?: string) => {
    pushLog(level, message, detail);
  }, [pushLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    localStorage.setItem('tracker_logs', '[]');
  }, []);

  const downloadLogs = useCallback(() => {
    const content = JSON.stringify(logsRef.current, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tracker-logs-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }, []);

  const { layout: currentLayout, theme: currentTheme } = getTheme(draft.layout, draft.theme);

  return (
    <ThemeContext.Provider value={{
      settings: draft, update, save, discard, isDirty: dirty,
      currentLayout, currentTheme,
      logs, addLog, clearLogs, downloadLogs,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
