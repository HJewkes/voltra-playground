/**
 * QuickNote — compact, expandable text input for session notes.
 *
 * Collapsed: small tappable pill ("Add note...")
 * Expanded: multiline TextInput with Save button
 */

import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, Keyboard, type ViewStyle, type TextStyle } from 'react-native';
import { alpha, getSemanticColors } from '@titan-design/react-ui';
import { Ionicons } from '@expo/vector-icons';

const t = getSemanticColors('dark');

export interface QuickNoteProps {
  /** Called with the note text when the user taps Save */
  onSave: (text: string) => void;
  /** Placeholder text in collapsed pill */
  placeholder?: string;
}

const pillStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  gap: 4,
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 12,
  backgroundColor: alpha(t['text-disabled'], 0.08),
};

const pillTextStyle: TextStyle = {
  fontSize: 12,
  color: t['text-tertiary'],
};

const inputContainerStyle: ViewStyle = {
  borderRadius: 12,
  backgroundColor: alpha(t['text-disabled'], 0.08),
  padding: 10,
};

const inputStyle: TextStyle = {
  fontSize: 13,
  color: t['text-primary'],
  minHeight: 56,
  textAlignVertical: 'top',
  padding: 0,
};

const saveButtonStyle: ViewStyle = {
  alignSelf: 'flex-end',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 8,
  backgroundColor: alpha(t['brand-primary'], 0.15),
  marginTop: 6,
};

const saveTextStyle: TextStyle = {
  fontSize: 12,
  fontWeight: '600',
  color: t['brand-primary'],
};

export function QuickNote({ onSave, placeholder = 'Add note...' }: QuickNoteProps) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  function handleExpand() {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSave() {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setExpanded(false);
      return;
    }
    onSave(trimmed);
    setText('');
    setExpanded(false);
    Keyboard.dismiss();
  }

  if (!expanded) {
    return (
      <Pressable onPress={handleExpand} style={pillStyle}>
        <Ionicons name="create-outline" size={13} color={t['text-tertiary']} />
        <Text style={pillTextStyle}>{placeholder}</Text>
      </Pressable>
    );
  }

  return (
    <View style={inputContainerStyle}>
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={t['text-disabled']}
        style={inputStyle}
        multiline
        maxLength={500}
        returnKeyType="default"
        blurOnSubmit={false}
      />
      <Pressable onPress={handleSave} style={saveButtonStyle}>
        <Text style={saveTextStyle}>Save</Text>
      </Pressable>
    </View>
  );
}
