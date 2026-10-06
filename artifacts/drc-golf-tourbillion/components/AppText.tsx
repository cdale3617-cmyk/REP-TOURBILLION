import React from 'react';
import { Platform, Text, TextInput, type TextInputProps, type TextProps } from 'react-native';

/** Accessibility scaling stays on, but is bounded on native so layouts cannot break. */
export const NATIVE_MAX_FONT_MULTIPLIER = 1.3;
const limit = Platform.OS === 'web' ? undefined : NATIVE_MAX_FONT_MULTIPLIER;

export function AppText({ maxFontSizeMultiplier, ...rest }: TextProps) {
  return <Text allowFontScaling maxFontSizeMultiplier={maxFontSizeMultiplier ?? limit} {...rest} />;
}

export const AppTextInput = React.forwardRef<TextInput, TextInputProps>(function AppTextInput({ maxFontSizeMultiplier, ...rest }, ref) {
  return <TextInput ref={ref} allowFontScaling maxFontSizeMultiplier={maxFontSizeMultiplier ?? limit} {...rest} />;
});
