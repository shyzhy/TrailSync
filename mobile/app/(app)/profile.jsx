import { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Banner, Body, Button, Card, Field, Heading, Input, Label, Muted, Screen, Title } from '../../src/components/ui';
import { apiSend, formErrors, toApiError } from '../../src/lib/api';
import { useSession } from '../../src/lib/useSession';
import { COLORS, FONTS } from '../../src/theme/tokens';

function initials(user) {
  return `${(user?.first_name || '')[0] || ''}${(user?.last_name || '')[0] || ''}`.toUpperCase() || '·';
}

export default function Profile() {
  const { user, signOut, refreshUser, saveUser } = useSession();
  const profile = user?.profile || {};
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    middle_name: profile.middle_name || '',
    last_name: user?.last_name || '',
    contact_number: user?.contact_number || '',
    last_semester_attended: profile.last_semester_attended || '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setErrors({});
    setBusy('save');
    try {
      const updated = await apiSend('/api/me/', 'PATCH', {
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim(),
        last_name: form.last_name.trim(),
        contact_number: form.contact_number.trim(),
        last_semester_attended: form.last_semester_attended.trim(),
      });
      await saveUser(updated);
      setEditing(false);
      setNotice('Your profile has been updated.');
    } catch (error) {
      setErrors(formErrors(error, ['first_name', 'middle_name', 'last_name', 'contact_number', 'last_semester_attended']));
    } finally {
      setBusy(null);
    }
  };

  const changePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos are off', 'TrailSync needs permission to use your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'] });
    if (result.canceled || !result.assets?.length) return;
    const photo = result.assets[0];
    setBusy('photo');
    try {
      const body = new FormData();
      body.append('image', { uri: photo.uri, name: 'avatar.jpg', type: photo.mimeType || 'image/jpeg' });
      await apiSend('/api/me/avatar/', 'PATCH', body, { multipart: true });
      await refreshUser();
      setNotice('Profile picture updated.');
    } catch (error) {
      Alert.alert('Your photo wasn’t saved', toApiError(error).message);
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async () => {
    setBusy('photo');
    try {
      await apiSend('/api/me/avatar/', 'DELETE');
      await refreshUser();
      setNotice('Profile picture removed.');
    } catch (error) {
      Alert.alert('It wasn’t removed', toApiError(error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card className="items-center">
        {profile.profile_picture_url ? (
          <Image source={{ uri: profile.profile_picture_url }} style={{ width: 88, height: 88, borderRadius: 44 }} />
        ) : (
          <View className="h-[88px] w-[88px] items-center justify-center rounded-full" style={{ backgroundColor: COLORS.blueSoft }}>
            <Body className="text-[28px]" style={{ fontFamily: FONTS.serif, color: COLORS.blue }}>
              {initials(user)}
            </Body>
          </View>
        )}
        <Title className="mt-3 text-center">
          {user?.first_name} {user?.last_name}
        </Title>
        <Muted className="mt-1 text-center">{user?.email}</Muted>
        <View className="mt-3 flex-row gap-2">
          <Button tone="secondary" loading={busy === 'photo'} onPress={changePhoto}>
            Change photo
          </Button>
          {profile.profile_picture_url ? (
            <Button tone="secondary" onPress={removePhoto}>
              Remove
            </Button>
          ) : null}
        </View>
      </Card>

      <Card className="mt-3">
        <View className="mb-3 flex-row items-center justify-between">
          <Heading>Your details</Heading>
          {!editing ? (
            <Pressable onPress={() => setEditing(true)}>
              <Muted>Edit</Muted>
            </Pressable>
          ) : null}
        </View>

        {editing ? (
          <>
            <Field label="First name" error={errors.first_name}>
              <Input value={form.first_name} onChangeText={set('first_name')} error={errors.first_name} />
            </Field>
            <Field label="Middle name" error={errors.middle_name}>
              <Input value={form.middle_name} onChangeText={set('middle_name')} placeholder="Optional" error={errors.middle_name} />
            </Field>
            <Field label="Last name" error={errors.last_name}>
              <Input value={form.last_name} onChangeText={set('last_name')} error={errors.last_name} />
            </Field>
            <Field label="Contact number" error={errors.contact_number}>
              <Input value={form.contact_number} onChangeText={set('contact_number')} keyboardType="phone-pad" error={errors.contact_number} />
            </Field>
            <Field label="Last semester attended" error={errors.last_semester_attended}>
              <Input value={form.last_semester_attended} onChangeText={set('last_semester_attended')} error={errors.last_semester_attended} />
            </Field>
            {errors.general ? <Banner tone="error">{errors.general}</Banner> : null}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button tone="secondary" onPress={() => setEditing(false)} disabled={busy === 'save'}>
                  Cancel
                </Button>
              </View>
              <View className="flex-1">
                <Button onPress={save} loading={busy === 'save'}>
                  Save
                </Button>
              </View>
            </View>
          </>
        ) : (
          <>
            <Label>School ID</Label>
            <Body className="mb-3">{profile.school_id_number || '—'}</Body>
            <Label>Course</Label>
            <Body className="mb-3">{profile.course || '—'}</Body>
            <Label>Academic status</Label>
            <Body className="mb-3">{(profile.academic_status || []).join(', ') || '—'}</Body>
            <Label>Last semester attended</Label>
            <Body className="mb-3">{profile.last_semester_attended || '—'}</Body>
            <Label>Contact number</Label>
            <Body className="mb-3">{user?.contact_number || '—'}</Body>
            <Muted>
              Your ID number, course and academic status are part of your official record. Window 6 changes those for you once you’ve filed
              a request.
            </Muted>
          </>
        )}
      </Card>

      <View className="mt-5">
        <Button tone="danger" onPress={() => Alert.alert('Sign out?', 'You’ll need to sign in again.', [
          { text: 'Stay', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: signOut },
        ])}>
          Sign out
        </Button>
      </View>
    </Screen>
  );
}
