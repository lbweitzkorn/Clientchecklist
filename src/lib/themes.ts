import themesData from '../assets/themes.json';

export type ThemeKey = 'wedding' | 'bat_mitzvah' | 'bar_mitzvah' | 'party';

const themes = themesData as Record<ThemeKey, string>;

export default themes;
