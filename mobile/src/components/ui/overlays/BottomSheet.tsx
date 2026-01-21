/**
 * BottomSheet
 *
 * A modal that slides up from the bottom of the screen.
 * Used for workout summaries, detail views, and confirmations.
 */

import React, { type ReactNode } from 'react';
import { View, Text, Modal, type StyleProp, type ViewStyle } from 'react-native';
import { Surface } from '../layout/Surface';
import { colors, spacing } from '@/theme';

export interface BottomSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Called when the sheet should close */
  onClose: () => void;
  /** Optional title displayed at top */
  title?: string;
  /** Content to render in the sheet */
  children: ReactNode;
  /** Additional styles for the content container */
  style?: StyleProp<ViewStyle>;
}

/**
 * BottomSheet component - slides up from the bottom.
 *
 * @example
 * ```tsx
 * <BottomSheet
 *   visible={showSummary}
 *   onClose={() => setShowSummary(false)}
 *   title="Set Complete!"
 * >
 *   <StatDisplay value={10} label="Reps" />
 * </BottomSheet>
 * ```
 */
export function BottomSheet({ visible, onClose, title, children, style }: BottomSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <Surface
          elevation={2}
          radius="xxl"
          border={false}
          style={{
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          }}
        >
          <View style={[{ padding: spacing.lg }, style]}>
            {/* Drag handle */}
            <View className="mb-4 items-center">
              <View
                className="h-1 w-12 rounded-full"
                style={{ backgroundColor: colors.surface.light }}
              />
            </View>

            {/* Title */}
            {title && (
              <Text
                className="text-center text-2xl font-bold text-content-primary"
                style={{ marginBottom: spacing.lg }}
              >
                {title}
              </Text>
            )}

            {/* Content */}
            {children}
          </View>
        </Surface>
      </View>
    </Modal>
  );
}
