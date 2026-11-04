import React, { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Button, Screen, TextField } from '@/components/ui';
import { Avatar, Display, SectionHead, TallyTopBar } from '@/components/pack';
import { useAuth } from '@/providers/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

function errorDetail(error: unknown): string {
  const response = (error as { response?: { data?: { detail?: unknown } } })?.response;
  return typeof response?.data?.detail === 'string'
    ? response.data.detail
    : 'Please try again.';
}

export default function AccountScreen() {
  const t = useTheme();
  const { user, logout, changePassword, deleteAccount } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');
  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setPasswordMessage('Enter your current and new passwords.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match.');
      return;
    }
    setChanging(true);
    setPasswordMessage('');
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password changed. Other devices have been signed out.');
    } catch (error) {
      setPasswordMessage(errorDetail(error));
    } finally {
      setChanging(false);
    }
  };

  const confirmDelete = () => {
    if (!deletePassword) {
      setDeleteMessage('Enter your password before deleting your account.');
      return;
    }
    const remove = async () => {
      setDeleting(true);
      setDeleteMessage('');
      try {
        await deleteAccount(deletePassword);
      } catch (error) {
        setDeleteMessage(errorDetail(error));
        setDeleting(false);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Permanently delete your account? This cannot be undone.')) {
        void remove();
      }
    } else {
      Alert.alert('Delete account?', 'This permanently deletes your account and cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => { void remove(); } },
      ]);
    }
  };

  return (
    <Screen header={false}>
      <TallyTopBar eyebrow="YOUR SHARED FLAT" title="Account" />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 14 }}>
        <Avatar name={user?.email ?? 'Flatmate'} />
        <View style={{ flex: 1 }}>
          <Display size={22}>Your account</Display>
          <Text style={[t.typography.caption, { color: t.palette.textMuted, marginTop: 2 }]}>{user?.email}</Text>
        </View>
      </View>

      <SectionHead title="Security" />
      <View style={{ gap: 12, marginTop: 16 }}>
        <TextField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" />
        <TextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
        <TextField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
        {passwordMessage ? <Text style={[t.typography.caption, { color: t.palette.textMuted }]}>{passwordMessage}</Text> : null}
        <Button title="Change password" onPress={() => { void handleChangePassword(); }} loading={changing} />
      </View>

      <SectionHead title="Account actions" />
      <View style={{ gap: 12, marginTop: 16 }}>
        <Button title="Sign out" variant="secondary" onPress={() => { void logout(); }} />
        <TextField label="Password to delete account" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry autoCapitalize="none" />
        {deleteMessage ? <Text style={[t.typography.caption, { color: t.palette.danger }]}>{deleteMessage}</Text> : null}
        <Button title="Delete account" variant="destructive" onPress={confirmDelete} loading={deleting} />
      </View>
    </Screen>
  );
}
