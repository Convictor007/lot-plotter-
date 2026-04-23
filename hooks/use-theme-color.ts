import { Colors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? 'dark' : 'light';
  const colorFromProps = theme === 'dark' ? props.dark : props.light;

  if (colorFromProps) {
    return colorFromProps;
  }
  return Colors[theme][colorName];
}
