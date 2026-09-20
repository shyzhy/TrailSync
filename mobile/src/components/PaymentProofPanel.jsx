import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Banner, Body, Button, Card, Field, Heading, Input, Muted } from './ui';
import { apiSend, formErrors } from '../lib/api';

function when(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Offered from the start, not held back as the consolation prize after a failed upload.
function WindowSixLine({ afterRejection = false }) {
  return (
    <Muted className="mt-3">
      {afterRejection
        ? 'Rather not try another photo? You can bring your printed receipt straight to Window 6 instead.'
        : 'Prefer not to upload a photo? You can also bring your printed receipt directly to Window 6.'}
    </Muted>
  );
}

/** The student's own way to have a Cashier payment recorded: the O.R. number and a photo of the receipt. */
export default function PaymentProofPanel({ request, onUpdated }) {
  const proof = request.payment_proof;
  const pending = proof && proof.verification_status === 'Pending';
  const rejected = proof && proof.verification_status === 'Rejected';

  const [orNumber, setOrNumber] = useState('');
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const pick = async (fromCamera) => {
    setErrors({});
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrors({ general: `TrailSync needs permission to use your ${fromCamera ? 'camera' : 'photos'}.` });
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ['images'] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
    if (!result.canceled && result.assets?.length) setPhoto(result.assets[0]);
  };

  const submit = async () => {
    setErrors({});
    setBusy(true);
    try {
      const body = new FormData();
      body.append('student_entered_or_number', orNumber.trim());
      body.append('receipt_image', {
        uri: photo.uri,
        // The server checks the bytes, but a name and type are still needed for the multipart part.
        name: photo.fileName || (photo.mimeType === 'image/png' ? 'receipt.png' : 'receipt.jpg'),
        type: photo.mimeType || 'image/jpeg',
      });
      const updated = await apiSend(`/api/form-requests/${request.id}/payment-proof/`, 'POST', body, { multipart: true });
      setOrNumber('');
      setPhoto(null);
      onUpdated(updated);
    } catch (error) {
      setErrors(formErrors(error, ['student_entered_or_number', 'receipt_image']));
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <Card className="mt-3">
        <Heading>Payment proof under review</Heading>
        <Muted className="mt-1">
          We’ll notify you once it’s confirmed. You sent O.R. {proof.student_entered_or_number}
          {when(proof.uploaded_at) ? ` on ${when(proof.uploaded_at)}` : ''}.
        </Muted>
        <WindowSixLine />
      </Card>
    );
  }

  if (!request.can_upload_payment_proof) return null;

  return (
    <Card className="mt-3">
      {rejected ? (
        <Banner tone="error" title="We couldn’t confirm your last payment proof">
          {proof.rejection_reason}
        </Banner>
      ) : null}

      <Heading>{rejected ? 'Upload a clearer photo' : 'Already paid at the Cashier?'}</Heading>
      <Muted className="mb-4 mt-1">
        Send us your receipt and we’ll record your payment, so you don’t have to bring the printed form back to Window 6.
      </Muted>

      <Field label="O.R. number" error={errors.student_entered_or_number}>
        <Input
          value={orNumber}
          onChangeText={setOrNumber}
          placeholder="As printed on your receipt"
          autoCapitalize="characters"
          error={errors.student_entered_or_number}
        />
      </Field>

      <Field label="Photo of your receipt" error={errors.receipt_image}>
        {photo ? (
          <View className="mb-2 flex-row items-center">
            <Image source={{ uri: photo.uri }} style={{ width: 64, height: 84, borderRadius: 8 }} resizeMode="cover" />
            <View className="ml-3 flex-1">
              <Body numberOfLines={1}>Photo ready to send</Body>
              <Pressable onPress={() => setPhoto(null)}>
                <Muted className="mt-1">Choose a different one</Muted>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button tone="secondary" onPress={() => pick(true)}>
              Take photo
            </Button>
          </View>
          <View className="flex-1">
            <Button tone="secondary" onPress={() => pick(false)}>
              Choose photo
            </Button>
          </View>
        </View>
      </Field>

      <Muted>Please make sure your photo is clear and readable — this helps us verify and process your request faster.</Muted>

      {errors.general ? (
        <View className="mt-3">
          <Banner tone="error">{errors.general}</Banner>
        </View>
      ) : null}

      <View className="mt-4">
        <Button onPress={submit} loading={busy} disabled={!orNumber.trim() || !photo}>
          {busy ? 'Submitting…' : 'Submit Payment Proof'}
        </Button>
      </View>
      <WindowSixLine afterRejection={rejected} />
    </Card>
  );
}
