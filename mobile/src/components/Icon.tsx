import { memo } from 'react';
import { SvgXml } from 'react-native-svg';
import { ICON_PATHS } from './iconPaths';

// The website's line icons, so app and site look like one thing.
export const Icon = memo(function Icon({ name, size = 22, color = '#f5f5f5', stroke = 1.8 }: { name: string; size?: number; color?: string; stroke?: number }) {
  const xml = '<svg viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + stroke +
    '" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">' + (ICON_PATHS[name] || '') + '</svg>';
  return <SvgXml xml={xml} width={size} height={size} />;
});
