import { BusyLabel } from '../../../components/ui/index.js';
import { FONT_SERIF } from '../../../styles/fonts.js';
import { CAV_AGENCIES } from './requestFormOptions.js';
import { SubmitProblems } from './RequestFormParts.jsx';

// Step 4: review every answer, confirm, and send.
export default function ReviewStep({ form }) {
  const {
    additionalNotes,
    boardExamPhoto,
    cavAgency,
    certificationSubtypes,
    confirmAccurate,
    generalError,
    goToStep,
    graduationDate,
    handleSubmit,
    isAlumni,
    isIncCompletion,
    isPerPage,
    needsCavAgency,
    needsCertificationSubtypes,
    numberOfCopies,
    numberOfPages,
    problemsFor,
    proxyContactNumber,
    proxyEnabled,
    proxyFullName,
    proxyRelationship,
    purpose,
    purposeOther,
    selectedType,
    semester,
    semesterTaken,
    setConfirmAccurate,
    step4Valid,
    subjectCode,
    submitting,
  } = form;

  return (
    <>
      <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
        Check your request
      </h1>
      <p className="ts-soft mt-1.5 text-base">
        Look over everything below. Tap <strong className="ts-ink">Edit</strong> to change anything, then send
        it to the Registrar.
      </p>

      <div className="ts-card mt-6 p-6 sm:p-8">
        <h2 className="ts-ink text-sm font-semibold">Your request</h2>

        <div className="mt-2">
          <div className="ts-review-row flex items-start justify-between gap-4">
            <div>
              <p className="ts-review-label">Document</p>
              <p className="ts-review-value">{selectedType?.name}</p>
            </div>
            <button type="button" onClick={() => goToStep(1)} className="ts-link shrink-0 text-sm font-medium">
              Edit
            </button>
          </div>

          <div className="ts-review-row flex items-start justify-between gap-4">
            <div>
              <p className="ts-review-label">What it’s for</p>
              <p className="ts-review-value">{purpose === 'Others' ? purposeOther : purpose}</p>
            </div>
            <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
              Edit
            </button>
          </div>

          <div className="ts-review-row flex items-start justify-between gap-4">
            <div>
              <p className="ts-review-label">Number of copies</p>
              <p className="ts-review-value">{numberOfCopies}</p>
            </div>
            <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
              Edit
            </button>
          </div>

          {isPerPage && (
            <div className="ts-review-row flex items-start justify-between gap-4">
              <div>
                <p className="ts-review-label">Number of pages</p>
                <p className="ts-review-value">{numberOfPages}</p>
              </div>
              <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                Edit
              </button>
            </div>
          )}

          {needsCavAgency && (
            <div className="ts-review-row flex items-start justify-between gap-4">
              <div>
                <p className="ts-review-label">Agency</p>
                <p className="ts-review-value">{CAV_AGENCIES.find((a) => a.value === cavAgency)?.label || cavAgency}</p>
              </div>
              <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                Edit
              </button>
            </div>
          )}

          {needsCertificationSubtypes && (
            <div className="ts-review-row flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="ts-review-label">Certification should say</p>
                <p className="ts-review-value">{certificationSubtypes.join(', ')}</p>
              </div>
              <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                Edit
              </button>
            </div>
          )}

          {isIncCompletion && (
            <div className="ts-review-row flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="ts-review-label">Completion of INC</p>
                <p className="ts-review-value">
                  {semesterTaken} · {subjectCode}
                </p>
              </div>
              <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                Edit
              </button>
            </div>
          )}

          <div className="ts-review-row flex items-start justify-between gap-4">
            <div>
              <p className="ts-review-label">Latest semester</p>
              <p className="ts-review-value">{semester}</p>
            </div>
            <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
              Edit
            </button>
          </div>

          {isAlumni && (
            <div className="ts-review-row flex items-start justify-between gap-4">
              <div>
                <p className="ts-review-label">Graduated</p>
                <p className="ts-review-value">{graduationDate}</p>
              </div>
              <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                Edit
              </button>
            </div>
          )}

          {purpose === 'For Board Exam' && boardExamPhoto && (
            <div className="ts-review-row flex items-start justify-between gap-4">
              <div>
                <p className="ts-review-label">2x2 photo</p>
                <p className="ts-review-value">{boardExamPhoto.name}</p>
              </div>
              <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                Edit
              </button>
            </div>
          )}

          {additionalNotes.trim() && (
            <div className="ts-review-row flex items-start justify-between gap-4">
              <div>
                <p className="ts-review-label">Additional notes</p>
                <p className="ts-review-value font-normal">{additionalNotes}</p>
              </div>
              <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                Edit
              </button>
            </div>
          )}

          {proxyEnabled && (
            <div className="ts-review-row flex items-start justify-between gap-4">
              <div>
                <p className="ts-review-label">Picked up by</p>
                <p className="ts-review-value">
                  {proxyFullName} ({proxyRelationship}) — {proxyContactNumber}
                </p>
              </div>
              <button type="button" onClick={() => goToStep(3)} className="ts-link shrink-0 text-sm font-medium">
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      <SubmitProblems general={generalError} {...problemsFor(4)} />

      <div className="mt-5">
        <label htmlFor="confirmAccurate" className="flex cursor-pointer select-none items-start gap-2.5">
          <span className="ts-checkbox-wrap mt-0.5">
            <input
              id="confirmAccurate"
              type="checkbox"
              checked={confirmAccurate}
              onChange={(e) => setConfirmAccurate(e.target.checked)}
              className="ts-checkbox-input"
            />
            <span className="ts-checkbox-well" aria-hidden="true">
              <svg viewBox="0 0 12 10" fill="none" className="ts-checkbox-check">
                <path
                  d="M1 5.2 4.3 8.5 11 1.5"
                  stroke="#FAF8F3"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
          <span className="ts-soft text-sm">I’ve checked everything above, and it’s correct.</span>
        </label>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={() => goToStep(3)}
          className="ts-btn-glass px-6 py-2.5 text-sm font-medium"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!step4Valid || submitting}
          onClick={handleSubmit}
          className="ts-btn-primary flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium"
        >
          <BusyLabel busy={submitting} busyLabel="Sending…">
            Send request
          </BusyLabel>
        </button>
      </div>
    </>
  );
}
