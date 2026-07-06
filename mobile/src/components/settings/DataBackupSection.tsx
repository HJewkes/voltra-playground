/**
 * DataBackupSection
 *
 * Settings section for exporting and importing user data backups.
 * Uses expo-file-system, expo-sharing, and expo-document-picker.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Button, ButtonText, VStack, Surface, getSemanticColors } from '@titan-design/react-ui';
import {
  getSessionRepository,
  getExerciseRepository,
  getRecordingRepository,
  getAdapter,
} from '@/data/provider';
import { createBackup, serializeBackup, parseBackup, restoreBackup } from '@/data/backup';

const t = getSemanticColors('dark');

/**
 * DataBackupSection - export and import data backups from settings.
 */
export function DataBackupSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const backup = await createBackup({
        sessionRepo: getSessionRepository(),
        exerciseRepo: getExerciseRepository(),
        recordingRepo: getRecordingRepository(),
        adapter: getAdapter(),
      });

      const json = serializeBackup(backup);
      const fileName = `voltra-backup-${formatDate(new Date())}.json`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Export Voltra Backup',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Export Complete', `Backup saved to ${fileName}`);
      }
    } catch (err: unknown) {
      Alert.alert('Export Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;

      const fileUri = result.assets[0].uri;
      const json = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = parseBackup(json);
      if (!parsed.valid || !parsed.data) {
        Alert.alert('Invalid Backup', parsed.errors.join('\n'));
        return;
      }

      const summary = buildImportSummary(parsed.data);

      Alert.alert('Restore Backup?', summary, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => performRestore(parsed.data!),
        },
      ]);
    } catch (err: unknown) {
      Alert.alert('Import Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const performRestore = async (data: NonNullable<ReturnType<typeof parseBackup>['data']>) => {
    setIsImporting(true);
    try {
      const result = await restoreBackup(data, {
        sessionRepo: getSessionRepository(),
        exerciseRepo: getExerciseRepository(),
        recordingRepo: getRecordingRepository(),
        adapter: getAdapter(),
      });

      Alert.alert(
        'Restore Complete',
        `Restored ${result.sessionsRestored} sessions, ${result.exercisesRestored} exercises, and ${result.recordingsRestored} recordings.`
      );
    } catch (err: unknown) {
      Alert.alert('Restore Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Surface elevation={0} className="rounded-xl bg-surface-input" style={{ marginBottom: 16 }}>
      <View className="p-4">
        <View className="mb-4 flex-row items-center">
          <Ionicons name="cloud-upload" size={20} color={t['brand-primary']} />
          <Text className="ml-2 text-lg font-bold text-text-primary">Data Backup</Text>
        </View>

        <Text className="mb-4 text-sm text-text-secondary">
          Export your sessions, exercises, and preferences to a file. Import on a new device to
          restore your data.
        </Text>

        <VStack gap={3}>
          <Button
            variant="outline"
            color="primary"
            fullWidth
            onPress={handleExport}
            isDisabled={isExporting}
            isLoading={isExporting}
            loadingText="Exporting..."
          >
            <Ionicons
              name="download-outline"
              size={20}
              color={t['brand-primary']}
              style={{ marginRight: 8 }}
            />
            <ButtonText className="text-brand-primary">Export Backup</ButtonText>
          </Button>

          <Button
            variant="outline"
            color="primary"
            fullWidth
            onPress={handleImport}
            isDisabled={isImporting}
            isLoading={isImporting}
            loadingText="Importing..."
          >
            <Ionicons
              name="push-outline"
              size={20}
              color={t['brand-primary']}
              style={{ marginRight: 8 }}
            />
            <ButtonText className="text-brand-primary">Import Backup</ButtonText>
          </Button>
        </VStack>
      </View>
    </Surface>
  );
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildImportSummary(data: {
  sessions: unknown[];
  exercises: unknown[];
  recordings: unknown[];
}): string {
  const parts: string[] = [];
  if (data.sessions.length > 0) parts.push(`${data.sessions.length} sessions`);
  if (data.exercises.length > 0) parts.push(`${data.exercises.length} exercises`);
  if (data.recordings.length > 0) parts.push(`${data.recordings.length} recordings`);

  if (parts.length === 0) return 'This backup contains no data.';
  return `This will restore ${parts.join(', ')} and your preferences. Existing data will be merged.`;
}
