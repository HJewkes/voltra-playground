/**
 * ListItem
 * 
 * A pressable list item with icon, title, subtitle, and trailing content.
 * Used for workout entries, device lists, settings rows, etc.
 */

import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/theme';

export interface ListItemProps {
  /** Ionicon name for the leading icon */
  icon?: string;
  /** Icon color */
  iconColor?: string;
  /** Icon background color */
  iconBgColor?: string;
  /** Primary text */
  title: string;
  /** Secondary text below title */
  subtitle?: string;
  /** Content to render on the right side */
  trailing?: ReactNode;
  /** Press handler - makes the item pressable */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Whether to show bottom border */
  showBorder?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Additional Tailwind classes */
  className?: string;
}

/**
 * ListItem component - icon + content + trailing pattern.
 * 
 * @example
 * ```tsx
 * <ListItem
 *   icon="fitness"
 *   iconColor={colors.primary[500]}
 *   title="Chest Workout"
 *   subtitle="Jan 19, 2026"
 *   trailing={<Text>5 reps</Text>}
 *   onPress={() => viewDetails()}
 * />
 * ```
 */
export function ListItem({
  icon,
  iconColor = colors.primary[500],
  iconBgColor,
  title,
  subtitle,
  trailing,
  onPress,
  onLongPress,
  disabled = false,
  showBorder = false,
  style,
  className,
}: ListItemProps) {
  const defaultIconBg = iconBgColor ?? `${iconColor}20`;
  
  const content = (
    <View 
      style={[
        { 
          flexDirection: 'row', 
          alignItems: 'center',
          padding: spacing.md,
          opacity: disabled ? 0.5 : 1,
        },
        showBorder && {
          borderBottomWidth: 1,
          borderBottomColor: colors.surface.light,
        },
        style,
      ]}
      className={className}
    >
      {/* Leading Icon */}
      {icon && (
        <View 
          style={{
            width: 48,
            height: 48,
            borderRadius: borderRadius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.md,
            backgroundColor: defaultIconBg,
          }}
        >
          <Ionicons 
            name={icon as any} 
            size={24} 
            color={iconColor} 
          />
        </View>
      )}
      
      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text 
          className="font-semibold text-content-primary text-base"
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text 
            className="text-content-tertiary text-sm mt-0.5"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      
      {/* Trailing Content */}
      {trailing && (
        <View style={{ marginLeft: spacing.sm }}>
          {trailing}
        </View>
      )}
      
      {/* Chevron for pressable items without custom trailing */}
      {onPress && !trailing && (
        <Ionicons 
          name="chevron-forward" 
          size={20} 
          color={colors.text.tertiary} 
        />
      )}
    </View>
  );
  
  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }
  
  return content;
}
