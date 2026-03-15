function createIconSet() {
  const Icon = function MockIcon() { return null; };
  Icon.glyphMap = {};
  Icon.getRawGlyphMap = () => ({});
  Icon.hasIcon = () => false;
  Icon.getImageSource = () => Promise.resolve({ uri: '' });
  return Icon;
}

export const Ionicons = createIconSet();
export const MaterialIcons = createIconSet();
export const AntDesign = createIconSet();
export const FontAwesome = createIconSet();
export default createIconSet;
