import { useCallback, useEffect, useMemo, useState } from 'react';
import StudentShell from '../../../components/layout/StudentShell.jsx';
import { ErrorState, SuccessSeal } from '../../../components/ui/index.js';
import { FONT_SERIF } from '../../../styles/fonts.js';
import { errorFromResponse, toApiError } from '../../../lib/api.js';
import {
  authFetch,
  clearSession,
  getAccessToken,
  getStoredUser,
  STUDENT_LOGIN_PATH,
} from '../../../lib/auth.js';
import ChooseDocumentStep from './ChooseDocumentStep.jsx';
import DetailsStep from './DetailsStep.jsx';
import PickupStep from './PickupStep.jsx';
import {
  BOARD_EXAM_PHOTO_MAX_BYTES,
  BOARD_EXAM_PHOTO_TYPES,
  getSemesterOptions,
  INLINE_FIELDS,
  stepForField,
} from './requestFormOptions.js';
import { Stepper } from './RequestFormParts.jsx';
import ReviewStep from './ReviewStep.jsx';

const LOGIN_PATH = STUDENT_LOGIN_PATH;
const DASHBOARD_PATH = '/portal';

export default function RequestFormPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [step, setStep] = useState(1);

  // Step 1
  const [transactionTypeId, setTransactionTypeId] = useState('');
  // Open by default: "what you'll need" is exactly what a first-timer is missing.
  const [guideOpen, setGuideOpen] = useState(true);

  // Step 2
  const [purpose, setPurpose] = useState('');
  const [purposeOther, setPurposeOther] = useState('');
  const [numberOfCopies, setNumberOfCopies] = useState(1);
  const [numberOfPages, setNumberOfPages] = useState('');
  const [cavAgency, setCavAgency] = useState('');
  const [certificationSubtypes, setCertificationSubtypes] = useState([]);
  const [semesterTaken, setSemesterTaken] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [semester, setSemester] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [graduationDate, setGraduationDate] = useState('');
  const [boardExamPhoto, setBoardExamPhoto] = useState(null);

  // Step 3
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyFullName, setProxyFullName] = useState('');
  const [proxyRelationship, setProxyRelationship] = useState('');
  const [proxyContactNumber, setProxyContactNumber] = useState('');

  // Step 4
  const [confirmAccurate, setConfirmAccurate] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [deepLinkUnavailable, setDeepLinkUnavailable] = useState(false);
  const [photoError, setPhotoError] = useState('');
  // Server errors with the answers they were about: a message stays on a field only until that answer changes.
  const [serverErrors, setServerErrors] = useState({ messages: {}, answers: {} });

  const semesterOptions = useMemo(() => getSemesterOptions(), []);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const [meRes, typesRes] = await Promise.all([authFetch('/api/me/'), authFetch('/api/transaction-types/')]);
      const failed = [meRes, typesRes].find((r) => !r.ok);
      if (failed) throw await errorFromResponse(failed);

      const [meData, typesData] = await Promise.all([meRes.json(), typesRes.json()]);
      setMe(meData);
      setTransactionTypes(typesData);

      // A deep link pre-selects the document and skips to Step 2, but only for a type that exists and is available.
      const deepLinkId = new URLSearchParams(window.location.search).get('transaction_type');
      const deepLinked = deepLinkId && typesData.find((t) => String(t.id) === deepLinkId);
      if (deepLinked && deepLinked.is_available !== false) {
        setTransactionTypeId(deepLinkId);
        setStep(2);
      } else if (deepLinked) {
        setDeepLinkUnavailable(true);
      }

      setStatus('ready');
    } catch (error) {
      setLoadError(toApiError(error));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = LOGIN_PATH;
      return;
    }
    load();
  }, [load]);

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  const profile = me?.profile;
  const isAlumni = profile?.user_category === 'Alumni';
  const selectedType = transactionTypes.find((t) => String(t.id) === String(transactionTypeId));
  const requestingAsLine = [me?.first_name && me?.last_name ? `${me.first_name} ${me.last_name}` : null, profile?.course, profile?.user_category === 'Student' ? profile?.year_level : null]
    .filter(Boolean)
    .join(' · ');

  // What the chosen document implies: per-page pricing and its own sub-selections.
  const isPerPage = selectedType?.pricing_unit === 'per_page';
  const needsCavAgency = selectedType?.name === 'CAV Certification';
  const needsCertificationSubtypes = selectedType?.name === 'Certification';
  const isIncCompletion = purpose === 'For Completion of INC';

  // What each step still needs; Next is disabled from these same lists, so the hint never disagrees with the button.
  const step1Missing = transactionTypeId && selectedType?.is_available !== false ? [] : ['choose a document'];
  const step2Missing = [
    !purpose && 'what you need it for',
    purpose === 'Others' && !purposeOther.trim() && 'your reason',
    // In the order the fields appear on screen.
    needsCavAgency && !cavAgency && 'the agency',
    needsCertificationSubtypes && certificationSubtypes.length === 0 && 'what the certification should say',
    !(Number(numberOfCopies) >= 1) && 'how many copies',
    !semester && 'the semester',
    isAlumni && !graduationDate && 'your graduation date',
    purpose === 'For Board Exam' && !boardExamPhoto && 'your 2x2 photo',
    isPerPage && !(Number(numberOfPages) >= 1) && 'the number of pages',
    isIncCompletion && !semesterTaken.trim() && 'the semester you took the subject',
    isIncCompletion && !subjectCode.trim() && 'the subject code',
  ].filter(Boolean);
  const step3Missing = proxyEnabled
    ? [
        !proxyFullName.trim() && "the person's full name",
        !proxyRelationship && 'how they are related to you',
        !proxyContactNumber.trim() && 'their contact number',
      ].filter(Boolean)
    : [];

  const answers = {
    transaction_type: transactionTypeId,
    purpose,
    purpose_other: purposeOther,
    number_of_copies: String(numberOfCopies),
    number_of_pages: String(numberOfPages),
    semester,
    graduation_date: graduationDate,
    board_exam_photo: boardExamPhoto,
    cav_agency: cavAgency,
    certification_subtypes: certificationSubtypes.join('|'),
    semester_taken: semesterTaken,
    subject_code: subjectCode,
    proxy_full_name: proxyFullName,
    relationship: proxyRelationship,
    contact_number: proxyContactNumber,
  };
  // The server's message for one answer, while that answer is unchanged.
  const errorFor = (key) => {
    const message = serverErrors.messages[key];
    return message && serverErrors.answers[key] === answers[key] ? message : '';
  };
  const invalidProps = (key, id) =>
    errorFor(key) ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {};
  const errorClass = (key) => (errorFor(key) ? 'ts-input-error' : '');
  // Problems to list at the top of one step: those with no field of their own.
  const problemsFor = (n) => {
    // A problem tied to an answer drops out as soon as that answer changes.
    const open = Object.keys(serverErrors.messages).filter(
      (k) => stepForField(k) === n && (!(k in answers) || errorFor(k)),
    );
    return {
      loose: open.filter((k) => !INLINE_FIELDS.has(k)).map((k) => serverErrors.messages[k]),
      hasInline: open.some((k) => INLINE_FIELDS.has(k)),
    };
  };

  const pickBoardExamPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!BOARD_EXAM_PHOTO_TYPES.includes(file.type)) {
      setBoardExamPhoto(null);
      setPhotoError(`“${file.name}” isn’t a JPG or PNG file. Please choose a JPG or PNG photo.`);
      return;
    }
    if (file.size > BOARD_EXAM_PHOTO_MAX_BYTES) {
      setBoardExamPhoto(null);
      setPhotoError(`That photo is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is 5 MB.`);
      return;
    }
    setPhotoError('');
    setBoardExamPhoto(file);
  };

  // Re-read the catalogue, so a document paused while this form was open shows as unavailable.
  const refreshTypes = () =>
    authFetch('/api/transaction-types/')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => Array.isArray(data) && setTransactionTypes(data))
      .catch(() => {});

  const step1Valid = step1Missing.length === 0;
  const step2Valid = step2Missing.length === 0;
  const step3Valid = step3Missing.length === 0;
  const step4Valid = confirmAccurate;

  // Later steps slide in from the right and earlier ones from the left, matching the stepper.
  const [stepDirection, setStepDirection] = useState('fwd');

  const goToStep = (n) => {
    setGeneralError('');
    setPhotoError('');
    setStepDirection(n >= step ? 'fwd' : 'back');
    setStep(n);
  };

  // The key remounts the panel so the animation replays; passed explicitly, since React warns about key in a spread.
  const stepKey = `step-${step}`;
  const stepMotion = { className: `ts-step-enter-${stepDirection}` };

  const handleSubmit = async () => {
    setGeneralError('');
    setSubmitting(true);
    try {
      const formData = {
        purpose,
        purpose_other: purpose === 'Others' ? purposeOther.trim() : '',
        number_of_copies: Number(numberOfCopies),
        semester,
        additional_notes: additionalNotes.trim(),
      };
      if (isAlumni) formData.graduation_date = graduationDate;
      // Only sent when the document or purpose asks for it.
      if (isPerPage) formData.number_of_pages = Number(numberOfPages);
      if (needsCavAgency) formData.cav_agency = cavAgency;
      if (needsCertificationSubtypes) formData.certification_subtypes = certificationSubtypes;
      if (isIncCompletion) {
        formData.semester_taken = semesterTaken.trim();
        formData.subject_code = subjectCode.trim();
      }

      const fd = new FormData();
      fd.append('transaction_type', transactionTypeId);
      fd.append('form_data', JSON.stringify(formData));
      if (boardExamPhoto) fd.append('board_exam_photo', boardExamPhoto);
      if (proxyEnabled) {
        fd.append(
          'proxy',
          JSON.stringify({
            proxy_full_name: proxyFullName.trim(),
            relationship: proxyRelationship,
            contact_number: proxyContactNumber.trim(),
          })
        );
      }

      // No Content-Type header: the browser sets the multipart boundary.
      const response = await authFetch('/api/form-requests/', { method: 'POST', body: fd });
      if (!response.ok) throw await errorFromResponse(response);
      setServerErrors({ messages: {}, answers: {} });
      setResult(await response.json());
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.kind !== 'validation') {
        // Nothing is cleared, the photo included, so sending again is one press.
        const kept = boardExamPhoto ? 'Your answers and photo are still here' : 'Your answers are still here';
        const retryable = ['network', 'server', 'rate_limited'].includes(apiError.kind);
        setGeneralError(
          `Your request wasn’t sent. ${apiError.message}${retryable ? ` ${kept}, so you can press Send request again.` : ''}`,
        );
        return;
      }
      const { general, ...fields } = apiError.fieldErrors;
      setServerErrors({ messages: fields, answers });
      if (fields.transaction_type) refreshTypes();
      const steps = Object.keys(fields).map(stepForField);
      if (steps.length) goToStep(Math.min(...steps));
      setGeneralError(general || '');
    } finally {
      setSubmitting(false);
    }
  };

  // Everything the step components read or change, in one object.
  const form = {
    additionalNotes,
    boardExamPhoto,
    cavAgency,
    certificationSubtypes,
    confirmAccurate,
    deepLinkUnavailable,
    errorClass,
    errorFor,
    generalError,
    goToStep,
    graduationDate,
    guideOpen,
    handleSubmit,
    invalidProps,
    isAlumni,
    isIncCompletion,
    isPerPage,
    needsCavAgency,
    needsCertificationSubtypes,
    numberOfCopies,
    numberOfPages,
    photoError,
    pickBoardExamPhoto,
    problemsFor,
    proxyContactNumber,
    proxyEnabled,
    proxyFullName,
    proxyRelationship,
    purpose,
    purposeOther,
    requestingAsLine,
    selectedType,
    semester,
    semesterOptions,
    semesterTaken,
    setAdditionalNotes,
    setCavAgency,
    setCertificationSubtypes,
    setConfirmAccurate,
    setGraduationDate,
    setGuideOpen,
    setNumberOfCopies,
    setNumberOfPages,
    setProxyContactNumber,
    setProxyEnabled,
    setProxyFullName,
    setProxyRelationship,
    setPurpose,
    setPurposeOther,
    setSemester,
    setSemesterTaken,
    setSubjectCode,
    setTransactionTypeId,
    step1Missing,
    step1Valid,
    step2Missing,
    step2Valid,
    step3Missing,
    step3Valid,
    step4Valid,
    subjectCode,
    submitting,
    transactionTypeId,
    transactionTypes,
  };

  // Success screen
  if (result) {
    return (
      <StudentShell active="request" title="Request a document" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-8 pt-4 sm:pb-10 sm:pt-6 lg:pt-3 lg:px-10">
          <div className="ts-card p-8 text-center sm:p-10">
            <div className="flex justify-center">
              <SuccessSeal />
            </div>
            <h1 className="ts-ink mt-5 text-2xl font-semibold" style={FONT_SERIF}>
              Your request has been sent!
            </h1>
            <p className="ts-soft mt-3 text-base">
              {result.transaction_type} &middot; Tracking number{' '}
              <strong className="ts-ink">{result.request_code}</strong>
            </p>

            <div className="ts-well mx-auto mt-6 max-w-md px-5 py-4 text-left">
              <p className="ts-ink text-sm font-semibold">What happens next</p>
              <ol className="ts-soft mt-2 list-decimal space-y-1.5 pl-5 text-sm">
                <li>The Registrar&rsquo;s office checks your request.</li>
                <li>Once it&rsquo;s approved, you&rsquo;ll print your form and pay at the Cashier.</li>
                <li>We&rsquo;ll tell you when your document is ready to pick up at Window 6.</li>
              </ol>
              <p className="ts-soft mt-3 text-sm">
                Watch the bell at the top of the page &mdash; we&rsquo;ll notify you at every step.
              </p>
            </div>

            <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
              <a href={DASHBOARD_PATH} className="ts-btn-glass flex items-center justify-center px-6 py-2.5 text-sm font-medium">
                Back to home
              </a>
              <a
                href={`/track-requests?search=${encodeURIComponent(result.request_code)}`}
                className="ts-btn-primary flex items-center justify-center px-6 py-2.5 text-sm font-medium"
              >
                See my request
              </a>
            </div>
          </div>
        </main>
      </StudentShell>
    );
  }

  return (
    <StudentShell active="request" title="Request a document" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-8 pt-4 sm:pb-10 sm:pt-6 lg:pt-3 lg:px-10">
        <Stepper current={step} />

        {status === 'error' && (
          <ErrorState error={loadError} title="We couldn&rsquo;t load the form" onRetry={load} />
        )}

        {status === 'loading' && (
          <div className="ts-card space-y-4 p-6 sm:p-8">
            <div className="ts-skeleton h-6 w-64" />
            <div className="ts-skeleton h-4 w-96" />
            {/* One card per row on a phone, where two cards can't hold a name and description. */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="ts-skeleton h-28 w-full" />
              <div className="ts-skeleton h-28 w-full" />
              <div className="ts-skeleton h-28 w-full" />
              <div className="ts-skeleton h-28 w-full" />
            </div>
          </div>
        )}

        {status === 'ready' && (
          <>
            {step === 1 && (
              <div key={stepKey} {...stepMotion}>
                <ChooseDocumentStep form={form} />
              </div>
            )}

            {step === 2 && (
              <div key={stepKey} {...stepMotion}>
                <DetailsStep form={form} />
              </div>
            )}

            {step === 3 && (
              <div key={stepKey} {...stepMotion}>
                <PickupStep form={form} />
              </div>
            )}

            {step === 4 && (
              <div key={stepKey} {...stepMotion}>
                <ReviewStep form={form} />
              </div>
            )}
          </>
        )}
      </main>
    </StudentShell>
  );
}
