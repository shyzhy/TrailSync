import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { Banner, Body, Button, Card, Field, Heading, Input, Muted, OptionRow, Screen, Title } from '../../src/components/ui';
import { apiSend, formErrors } from '../../src/lib/api';
import { ACADEMIC_STATUS_OPTIONS, COURSES, isAlumnus } from '../../src/lib/academics';
import { useSession } from '../../src/lib/useSession';
import { COLORS } from '../../src/theme/tokens';

const STEPS = ['Your name', 'Your studies', 'Contact details'];

/**
 * The profile the official form is printed from. A request can't be filed until this is complete, so the app sends
 * students here straight after signing in when anything is missing.
 */
export default function Onboarding() {
  const { user, refreshUser } = useSession();
  const profile = user?.profile || {};
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    middle_name: profile.middle_name || '',
    last_name: user?.last_name || '',
    school_id_number: profile.school_id_number || '',
    course: profile.course || '',
    academic_status: profile.academic_status || [],
    last_semester_attended: profile.last_semester_attended || '',
    graduation_date: profile.graduation_date || '',
    birth_date: profile.birth_date || '',
    contact_number: user?.contact_number || '',
  });
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleStatus = (value) =>
    set('academic_status')(form.academic_status.includes(value) ? form.academic_status.filter((v) => v !== value) : [...form.academic_status, value]);

  const send = async (stepName, payload, onDone) => {
    setErrors({});
    setBusy(true);
    try {
      await apiSend('/api/me/onboarding/', 'PATCH', { step: stepName, ...payload });
      await refreshUser();
      onDone();
    } catch (error) {
      setErrors(formErrors(error, Object.keys(payload)));
    } finally {
      setBusy(false);
    }
  };

  const saveName = () =>
    send('name', { first_name: form.first_name.trim(), middle_name: form.middle_name.trim(), last_name: form.last_name.trim() }, () => setStep(1));

  const saveAcademic = () =>
    send(
      'academic',
      {
        school_id_number: form.school_id_number.trim(),
        course: form.course,
        academic_status: form.academic_status,
        last_semester_attended: form.last_semester_attended.trim(),
        ...(isAlumnus(form.academic_status) ? { graduation_date: form.graduation_date.trim() } : {}),
      },
      () => setStep(2),
    );

  const saveContact = () =>
    send('contact', { birth_date: form.birth_date.trim(), contact_number: form.contact_number.trim() }, () => router.replace('/(app)/dashboard'));

  return (
    <Screen>
      <Title>Finish your profile</Title>
      <Muted className="mb-4 mt-1">
        Your request form is printed from these details, so Window 6 needs them before you can file one.
      </Muted>

      <View className="mb-4 flex-row items-center">
        {STEPS.map((label, i) => (
          <View key={label} className={i < STEPS.length - 1 ? 'flex-1 flex-row items-center' : 'flex-row items-center'}>
            <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: i <= step ? COLORS.blue : COLORS.hairline }}>
              <Body className="text-[12px]" style={{ color: i <= step ? '#FFFFFF' : COLORS.inkSoft }}>
                {i + 1}
              </Body>
            </View>
            {i < STEPS.length - 1 ? <View className="mx-1 h-[2px] flex-1" style={{ backgroundColor: i < step ? COLORS.blue : COLORS.hairline }} /> : null}
          </View>
        ))}
      </View>

      {errors.general ? <Banner tone="error">{errors.general}</Banner> : null}

      <Card>
        <Heading className="mb-3">{STEPS[step]}</Heading>

        {step === 0 ? (
          <>
            <Field label="First name" error={errors.first_name}>
              <Input value={form.first_name} onChangeText={set('first_name')} error={errors.first_name} />
            </Field>
            <Field label="Middle name" error={errors.middle_name} hint="Optional.">
              <Input value={form.middle_name} onChangeText={set('middle_name')} error={errors.middle_name} />
            </Field>
            <Field label="Last name" error={errors.last_name}>
              <Input value={form.last_name} onChangeText={set('last_name')} error={errors.last_name} />
            </Field>
            <Button onPress={saveName} loading={busy} disabled={!form.first_name.trim() || !form.last_name.trim()}>
              Continue
            </Button>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label="School ID number" error={errors.school_id_number}>
              <Input value={form.school_id_number} onChangeText={set('school_id_number')} autoCapitalize="characters" error={errors.school_id_number} />
            </Field>
            <Field label="Course" error={errors.course}>
              {COURSES.map((course) => (
                <OptionRow key={course} title={course} selected={form.course === course} onPress={() => set('course')(course)} />
              ))}
            </Field>
            <Field label="Academic status" error={errors.academic_status} hint="Tick everything that applies.">
              {ACADEMIC_STATUS_OPTIONS.map((option) => (
                <OptionRow
                  key={option.value}
                  multi
                  title={option.value}
                  hint={option.hint}
                  selected={form.academic_status.includes(option.value)}
                  onPress={() => toggleStatus(option.value)}
                />
              ))}
            </Field>
            <Field label="Last semester attended" error={errors.last_semester_attended} hint="Write it like “1st Semester, SY 2024-2025”.">
              <Input value={form.last_semester_attended} onChangeText={set('last_semester_attended')} error={errors.last_semester_attended} />
            </Field>
            {isAlumnus(form.academic_status) ? (
              <Field label="Date you graduated" error={errors.graduation_date} hint="YYYY-MM-DD">
                <Input value={form.graduation_date} onChangeText={set('graduation_date')} placeholder="2019-04-10" error={errors.graduation_date} />
              </Field>
            ) : null}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button tone="secondary" onPress={() => setStep(0)} disabled={busy}>
                  Back
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  onPress={saveAcademic}
                  loading={busy}
                  disabled={!form.school_id_number.trim() || !form.course || form.academic_status.length === 0 || !form.last_semester_attended.trim()}
                >
                  Continue
                </Button>
              </View>
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field label="Date of birth" error={errors.birth_date} hint="YYYY-MM-DD">
              <Input value={form.birth_date} onChangeText={set('birth_date')} placeholder="2003-04-05" error={errors.birth_date} />
            </Field>
            <Field label="Contact number" error={errors.contact_number}>
              <Input value={form.contact_number} onChangeText={set('contact_number')} keyboardType="phone-pad" placeholder="09XX XXX XXXX" error={errors.contact_number} />
            </Field>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button tone="secondary" onPress={() => setStep(1)} disabled={busy}>
                  Back
                </Button>
              </View>
              <View className="flex-1">
                <Button onPress={saveContact} loading={busy} disabled={!form.birth_date.trim() || !form.contact_number.trim()}>
                  Finish
                </Button>
              </View>
            </View>
          </>
        ) : null}
      </Card>
    </Screen>
  );
}
