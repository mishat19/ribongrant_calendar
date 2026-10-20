import { useColorScheme } from 'react-native';

export interface AppTheme {
  dark: boolean;
  primary: string;
  onPrimary: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  textFaint: string;
  border: string;
  todayAccent: string;
  nowLine: string;
  danger: string;
  overlay: string;
  chipText: string;
  hourLine: string;
}

const light: AppTheme = {
  dark: false,
  primary: '#1A73E8',
  onPrimary: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceVariant: '#F1F3F4',
  text: '#202124',
  textSecondary: '#5F6368',
  textFaint: '#9AA0A6',
  border: '#E8EAED',
  todayAccent: '#1A73E8',
  nowLine: '#EA4335',
  danger: '#D93025',
  overlay: 'rgba(32,33,36,0.4)',
  chipText: '#3C4043',
  hourLine: '#E8EAED',
};

const dark: AppTheme = {
  dark: true,
  primary: '#8AB4F8',
  onPrimary: '#202124',
  background: '#202124',
  surface: '#292A2D',
  surfaceVariant: '#303134',
  text: '#E8EAED',
  textSecondary: '#9AA0A6',
  textFaint: '#70757A',
  border: '#3C4043',
  todayAccent: '#8AB4F8',
  nowLine: '#F28B82',
  danger: '#F28B82',
  overlay: 'rgba(0,0,0,0.5)',
  chipText: '#E8EAED',
  hourLine: '#3C4043',
};

export const EVENT_COLORS = [
  '#1A73E8',
  '#D93025',
  '#188038',
  '#F9AB00',
  '#A142F4',
  '#FA7B17',
  '#00ACC1',
  '#5F6368',
];

export function useTheme(): AppTheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

export { light as lightTheme, dark as darkTheme };
