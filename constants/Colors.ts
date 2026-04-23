export const lightColors = {
  primary: '#3b5998',
  accent: '#f39c12',
  background: '#f3f6f9',
  surface: '#ffffff',
  /** Card / elevated panels */
  cardBg: '#ffffff',
  text: '#333333',
  textMuted: '#666666',
  border: '#ebedf3',
  success: '#2ecc71',
  danger: '#e74c3c',
  warning: '#f1c40f',
  info: '#3498db',
  
  // Sidebar specific
  sidebarBg: '#1e1e2d',
  sidebarText: '#a2a3b7',
  sidebarTextActive: '#ffffff',
  activeBg: '#3b5998',
  hoverBg: 'rgba(59, 89, 152, 0.5)',
  headerBg: '#ffffff',
  /** Main content / panel background (inputs, expanded rows) */
  contentBg: '#f3f6f9',
};

export const darkColors = {
  primary: '#4a6ea9',
  accent: '#f39c12',
  background: '#121212',
  surface: '#1e1e1e',
  cardBg: '#252525',
  text: '#ffffff',
  textMuted: '#a0a0a0',
  border: '#333333',
  success: '#2ecc71',
  danger: '#e74c3c',
  warning: '#f1c40f',
  info: '#3498db',

  sidebarBg: '#15151f',
  sidebarText: '#a2a3b7',
  sidebarTextActive: '#ffffff',
  activeBg: '#3b5998',
  hoverBg: 'rgba(59, 89, 152, 0.5)',
  headerBg: '#1e1e1e',
  contentBg: '#181818',
} as const satisfies Record<keyof typeof lightColors, string>;
