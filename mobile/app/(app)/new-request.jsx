import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { Banner, Body, Button, Card, Field, Heading, Input, Label, Loading, Muted, OptionRow, Screen, Title } from '../../src/components/ui';
import { apiGet, apiSend, formErrors } from '../../src/lib/api';
import { isAlumnus, PROXY_RELATIONSHIPS } from '../../src/lib/academics';
import { CAV_AGENCIES, CERTIFICATION_SUBTYPES, needsCavAgency, needsCertificationSubtypes, PURPOSE_OPTIONS, STEP_LABELS } from '../../src/lib/requestFormOptions';
import { useSession } from '../../src/lib/useSession';
import { COLORS } from '../../src/theme/tokens';

function money(value, unit) {
  if (value === null || value === undefined || value === '') return 'No set fee';
  const n = Number(value);
  if (Number.isNaN(n)) return 'No set fee';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit === 'per_page' ? 'per page' : 'per copy'}`;
}

function Steps({ step }) {
  return (
    <View className="mb-4 flex-row items-center">
      {STEP_LABELS.map((label, i) => (
        <View key={label} className={i < STEP_LABELS.length - 1 ? 'flex-1 flex-row items-center' : 'flex-row items-center'}>
          <View
            className="h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: i <= step ? COLORS.blue : COLORS.hairline }}
          >
            <Body className="text-[12px]" style={{ color: i <= step ? '#FFFFFF' : COLORS.inkSoft }}>
              {i + 1}
            </Body>
          </View>
          {i < STEP_LABELS.length - 1 ? (
            <View className="mx-1 h-[2px] flex-1" style={{ backgroundColor: i < step ? COLORS.blue : COLORS.hairline }} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function NewRequest() {
  const { user } = useSession();
  const profile = user?.profile;
  const [step, setStep] = useState(0);
  const [types, setTypes] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    transaction_type: null,
    purpose: '',
    purpose_other: '',
    number_of_copies: '1',
    semester: profile?.last_semester_attended || '',
    graduation_date: profile?.graduation_date || '',
    cav_agency: '',
    cav_agency_other: '',
    certification_subtypes: [],
    semester_taken: '',
    subject_code: '',
    additional_notes: '',
    board_exam_photo: null,
    attachments: [],
    proxy: { use: false, proxy_full_name: '', relationship: '', contact_number: '' },
  });
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    apiGet('/api/transaction-types/')
      .then((data) => setTypes(data?.results || data || []))
      .catch(() => setTypes([]));
  }, []);

  const selected = useMemo(() => (types || []).find((t) => t.id === form.transaction_type), [types, form.transaction_type]);
  const alumni = isAlumnus(profile?.academic_status);
  const wantsCav = needsCavAgency(selected?.name);
  const wantsSubtypes = needsCertificationSubtypes(selected?.name);

  const toggleSubtype = (value) =>
    set(
      'certification_subtypes',
      form.certification_subtypes.includes(value)
        ? form.certification_subtypes.filter((v) => v !== value)
        : [...form.certification_subtypes, value],
    );

  // Board Exam requests carry a 2x2 photo, the same requirement the website enforces.
  const pickBoardExamPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrors((prev) => ({ ...prev, board_exam_photo: 'TrailSync needs permission to use your photos.' }));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.9, allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'] });
    if (!result.canceled && result.assets?.length) set('board_exam_photo', result.assets[0]);
  };

  const pickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], multiple: true });
    if (!result.canceled) set('attachments', [...form.attachments, ...(result.assets || [])].slice(0, 5));
  };

  const submit = async () => {
    setErrors({});
    setBusy(true);
    try {
      const formData = {
        purpose: form.purpose,
        number_of_copies: Number(form.number_of_copies) || 1,
        semester: form.semester.trim(),
        additional_notes: form.additional_notes.trim(),
      };
      if (form.purpose === 'Others') formData.purpose_other = form.purpose_other.trim();
      if (form.purpose === 'For Completion of INC') {
        formData.semester_taken = form.semester_taken.trim();
        formData.subject_code = form.subject_code.trim();
      }
      if (alumni && form.graduation_date) formData.graduation_date = form.graduation_date.trim();
      if (wantsCav) {
        formData.cav_agency = form.cav_agency;
        if (form.cav_agency === 'Others') formData.cav_agency_other = form.cav_agency_other.trim();
      }
      if (wantsSubtypes) formData.certification_subtypes = form.certification_subtypes;

      const body = new FormData();
      body.append('transaction_type', String(form.transaction_type));
      body.append('form_data', JSON.stringify(formData));
      if (form.proxy.use) {
        body.append(
          'proxy',
          JSON.stringify({
            proxy_full_name: form.proxy.proxy_full_name.trim(),
            relationship: form.proxy.relationship,
            contact_number: form.proxy.contact_number.trim(),
          }),
        );
      }
      if (form.purpose === 'For Board Exam' && form.board_exam_photo) {
        const photo = form.board_exam_photo;
        body.append('board_exam_photo', {
          uri: photo.uri,
          name: photo.fileName || (photo.mimeType === 'image/png' ? 'photo.png' : 'photo.jpg'),
          type: photo.mimeType || 'image/jpeg',
        });
      }
      form.attachments.forEach((file) => {
        body.append('attachments', { uri: file.uri, name: file.name || 'attachment', type: file.mimeType || 'application/octet-stream' });
      });

      const created = await apiSend('/api/form-requests/', 'POST', body, { multipart: true });
      router.replace(`/(app)/requests/${created.id}`);
    } catch (error) {
      const mapped = formErrors(error, [
        'transaction_type',
        'purpose',
        'purpose_other',
        'number_of_copies',
        'semester',
        'graduation_date',
        'cav_agency',
        'certification_subtypes',
        'semester_taken',
        'subject_code',
        'board_exam_photo',
        'proxy_full_name',
        'relationship',
        'contact_number',
      ]);
      setErrors(mapped);
      // Anything the server rejected lives on the details step, so go back to where it can be fixed.
      if (Object.keys(mapped).some((key) => key !== 'general')) setStep(1);
    } finally {
      setBusy(false);
    }
  };

  const canContinue = () => {
    if (step === 0) return Boolean(form.transaction_type);
    if (step === 1) {
      if (!form.purpose || !form.semester.trim()) return false;
      if (form.purpose === 'Others' && !form.purpose_other.trim()) return false;
      if (form.purpose === 'For Completion of INC' && (!form.semester_taken.trim() || !form.subject_code.trim())) return false;
      if (wantsCav && !form.cav_agency) return false;
      if (form.purpose === 'For Board Exam' && !form.board_exam_photo) return false;
      if (wantsSubtypes && form.certification_subtypes.length === 0) return false;
      if (alumni && !form.graduation_date.trim()) return false;
      return true;
    }
    if (step === 2) {
      if (!form.proxy.use) return true;
      return form.proxy.proxy_full_name.trim() && form.proxy.relationship && form.proxy.contact_number.trim();
    }
    return true;
  };

  return (
    <Screen>
      <Steps step={step} />
      <Title className="mb-1">{STEP_LABELS[step]}</Title>

      {errors.general ? (
        <View className="mt-3">
          <Banner tone="error">{errors.general}</Banner>
        </View>
      ) : null}

      {step === 0 ? (
        types === null ? (
          <Loading label="Loading documents…" />
        ) : (
          <View className="mt-3">
            {types
              .filter((t) => t.is_available !== false)
              .map((type) => (
                <Pressable
                  key={type.id}
                  onPress={() => set('transaction_type', type.id)}
                  className="mb-2 rounded-xl border bg-surface px-3.5 py-3"
                  style={{
                    borderColor: form.transaction_type === type.id ? COLORS.blue : COLORS.hairline,
                    backgroundColor: form.transaction_type === type.id ? COLORS.blueSoft : COLORS.surface,
                  }}
                >
                  <Body>{type.name}</Body>
                  <Muted className="mt-1">
                    {money(type.fee_amount, type.pricing_unit)}
                    {type.processing_time ? ` · ${type.processing_time}` : ''}
                  </Muted>
                  {type.required_documents ? <Muted className="mt-1">You’ll need: {type.required_documents}</Muted> : null}
                </Pressable>
              ))}
          </View>
        )
      ) : null}

      {step === 1 ? (
        <Card className="mt-3">
          <Field label="What is it for?" error={errors.purpose}>
            {PURPOSE_OPTIONS.map((option) => (
              <OptionRow key={option} title={option} selected={form.purpose === option} onPress={() => set('purpose', option)} />
            ))}
          </Field>

          {form.purpose === 'Others' ? (
            <Field label="Tell us the purpose" error={errors.purpose_other}>
              <Input value={form.purpose_other} onChangeText={(v) => set('purpose_other', v)} placeholder="Why you need it" error={errors.purpose_other} />
            </Field>
          ) : null}

          {form.purpose === 'For Completion of INC' ? (
            <>
              <Banner tone="warning">Completing an INC adds a ₱175.00 fee, paid at the Cashier.</Banner>
              <Field label="Semester the INC was taken" error={errors.semester_taken}>
                <Input value={form.semester_taken} onChangeText={(v) => set('semester_taken', v)} placeholder="e.g. 2nd Semester, SY 2023-2024" error={errors.semester_taken} />
              </Field>
              <Field label="Subject code" error={errors.subject_code}>
                <Input value={form.subject_code} onChangeText={(v) => set('subject_code', v)} placeholder="e.g. IT 321" error={errors.subject_code} />
              </Field>
            </>
          ) : null}

          {wantsCav ? (
            <Field label="Which agency is it for?" error={errors.cav_agency}>
              {CAV_AGENCIES.map((agency) => (
                <OptionRow
                  key={agency.value}
                  title={agency.label}
                  hint={agency.hint}
                  selected={form.cav_agency === agency.value}
                  onPress={() => set('cav_agency', agency.value)}
                />
              ))}
              {form.cav_agency === 'Others' ? (
                <Input
                  value={form.cav_agency_other}
                  onChangeText={(v) => set('cav_agency_other', v)}
                  placeholder="Name the agency"
                  className="mt-2"
                />
              ) : null}
            </Field>
          ) : null}

          {wantsSubtypes ? (
            <Field label="What should the certification say?" error={errors.certification_subtypes} hint="Choose as many as you need.">
              {CERTIFICATION_SUBTYPES.map((subtype) => (
                <OptionRow
                  key={subtype.value}
                  multi
                  title={subtype.value}
                  hint={subtype.hint}
                  selected={form.certification_subtypes.includes(subtype.value)}
                  onPress={() => toggleSubtype(subtype.value)}
                />
              ))}
            </Field>
          ) : null}

          {form.purpose === 'For Board Exam' ? (
            <Field label="Your 2x2 photo" error={errors.board_exam_photo} hint="A passport-sized photo on a white background, collared top.">
              {form.board_exam_photo ? (
                <View className="mb-2 flex-row items-center">
                  <Image source={{ uri: form.board_exam_photo.uri }} style={{ width: 56, height: 56, borderRadius: 8 }} />
                  <Pressable className="ml-3" onPress={() => set('board_exam_photo', null)}>
                    <Muted>Choose a different one</Muted>
                  </Pressable>
                </View>
              ) : null}
              <Button tone="secondary" onPress={pickBoardExamPhoto}>
                {form.board_exam_photo ? 'Replace photo' : 'Choose your 2x2 photo'}
              </Button>
            </Field>
          ) : null}

          <Field label="How many copies?" error={errors.number_of_copies}>
            <Input
              value={String(form.number_of_copies)}
              onChangeText={(v) => set('number_of_copies', v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              error={errors.number_of_copies}
            />
          </Field>

          <Field label="Last semester you attended" error={errors.semester} hint="Write it like “1st Semester, SY 2024-2025”.">
            <Input value={form.semester} onChangeText={(v) => set('semester', v)} placeholder="1st Semester, SY 2024-2025" error={errors.semester} />
          </Field>

          {alumni ? (
            <Field label="Date you graduated" error={errors.graduation_date} hint="YYYY-MM-DD">
              <Input value={form.graduation_date} onChangeText={(v) => set('graduation_date', v)} placeholder="2019-04-10" error={errors.graduation_date} />
            </Field>
          ) : null}

          <Field label="Anything else we should know?" hint="Optional.">
            <Input
              value={form.additional_notes}
              onChangeText={(v) => set('additional_notes', v)}
              placeholder="Add a note for the Registrar"
              multiline
              style={{ minHeight: 88, textAlignVertical: 'top' }}
            />
          </Field>

          <Field label="Attachments" hint="Optional: PDFs or photos, up to 5 files.">
            {form.attachments.map((file, i) => (
              <View key={`${file.name}-${i}`} className="mb-2 flex-row items-center justify-between rounded-xl border border-hairline px-3 py-2">
                <Body className="flex-1" numberOfLines={1}>
                  {file.name}
                </Body>
                <Pressable onPress={() => set('attachments', form.attachments.filter((_, index) => index !== i))}>
                  <Muted>Remove</Muted>
                </Pressable>
              </View>
            ))}
            <Button tone="secondary" onPress={pickAttachment} disabled={form.attachments.length >= 5}>
              Add a file
            </Button>
          </Field>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="mt-3">
          <Heading>Who will collect it?</Heading>
          <Muted className="mb-3 mt-1">Documents are released at Window 6, from 3:00 to 5:00 PM.</Muted>
          <OptionRow title="I’ll collect it myself" selected={!form.proxy.use} onPress={() => set('proxy', { ...form.proxy, use: false })} />
          <OptionRow
            title="Someone else will collect it"
            hint="They must bring a notarised authorisation letter and both your valid IDs."
            selected={form.proxy.use}
            onPress={() => set('proxy', { ...form.proxy, use: true })}
          />

          {form.proxy.use ? (
            <View className="mt-3">
              <Field label="Their full name" error={errors.proxy_full_name}>
                <Input
                  value={form.proxy.proxy_full_name}
                  onChangeText={(v) => set('proxy', { ...form.proxy, proxy_full_name: v })}
                  placeholder="Full name"
                  error={errors.proxy_full_name}
                />
              </Field>
              <Field label="Relationship" error={errors.relationship}>
                {PROXY_RELATIONSHIPS.map((option) => (
                  <OptionRow
                    key={option}
                    title={option}
                    selected={form.proxy.relationship === option}
                    onPress={() => set('proxy', { ...form.proxy, relationship: option })}
                  />
                ))}
              </Field>
              <Field label="Their contact number" error={errors.contact_number}>
                <Input
                  value={form.proxy.contact_number}
                  onChangeText={(v) => set('proxy', { ...form.proxy, contact_number: v })}
                  placeholder="09XX XXX XXXX"
                  keyboardType="phone-pad"
                  error={errors.contact_number}
                />
              </Field>
            </View>
          ) : null}
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="mt-3">
          <Heading className="mb-3">Check your request</Heading>
          <Label>Document</Label>
          <Body className="mb-3">{selected?.name}</Body>
          <Label>What it’s for</Label>
          <Body className="mb-3">{form.purpose === 'Others' ? form.purpose_other : form.purpose}</Body>
          <Label>Copies</Label>
          <Body className="mb-3">{form.number_of_copies}</Body>
          <Label>Last semester attended</Label>
          <Body className="mb-3">{form.semester}</Body>
          {wantsCav ? (
            <>
              <Label>Agency</Label>
              <Body className="mb-3">{form.cav_agency === 'Others' ? form.cav_agency_other : form.cav_agency}</Body>
            </>
          ) : null}
          {wantsSubtypes ? (
            <>
              <Label>Certification covers</Label>
              <Body className="mb-3">{form.certification_subtypes.join(', ')}</Body>
            </>
          ) : null}
          <Label>Collected by</Label>
          <Body className="mb-3">{form.proxy.use ? `${form.proxy.proxy_full_name} (${form.proxy.relationship})` : 'You'}</Body>
          {form.purpose === 'For Board Exam' ? (
            <>
              <Label>2x2 photo</Label>
              <Body className="mb-3">{form.board_exam_photo ? 'Attached' : 'Not attached'}</Body>
            </>
          ) : null}
          {form.attachments.length ? (
            <>
              <Label>Attachments</Label>
              <Body className="mb-3">{form.attachments.map((f) => f.name).join(', ')}</Body>
            </>
          ) : null}
          <Muted>The fee is worked out when the Registrar approves your request, and you pay it at the Cashier.</Muted>
        </Card>
      ) : null}

      <View className="mt-5 flex-row gap-3">
        {step > 0 ? (
          <View className="flex-1">
            <Button tone="secondary" onPress={() => setStep((s) => s - 1)} disabled={busy}>
              Back
            </Button>
          </View>
        ) : null}
        <View className="flex-1">
          {step < 3 ? (
            <Button onPress={() => setStep((s) => s + 1)} disabled={!canContinue()}>
              Continue
            </Button>
          ) : (
            <Button onPress={submit} loading={busy}>
              {busy ? 'Sending…' : 'Send request'}
            </Button>
          )}
        </View>
      </View>
    </Screen>
  );
}
