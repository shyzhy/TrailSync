import { CheckIcon, ChevronIcon, FieldError, HelpTip, UploadIcon } from '../../../components/ui/index.js';
import { FONT_SERIF } from '../../../styles/fonts.js';
import { CAV_AGENCIES, CERTIFICATION_SUBTYPES, formatFee, PURPOSE_OPTIONS } from './requestFormOptions.js';
import { MissingHint, RequiredMark, SubmitProblems } from './RequestFormParts.jsx';

// Step 2: the details this document and purpose need.
export default function DetailsStep({ form }) {
  const {
    additionalNotes,
    boardExamPhoto,
    cavAgency,
    certificationSubtypes,
    errorClass,
    errorFor,
    generalError,
    goToStep,
    graduationDate,
    guideOpen,
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
    setGraduationDate,
    setGuideOpen,
    setNumberOfCopies,
    setNumberOfPages,
    setPurpose,
    setPurposeOther,
    setSemester,
    setSemesterTaken,
    setSubjectCode,
    step2Missing,
    step2Valid,
    subjectCode,
  } = form;

  return (
    <>
      <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
        A few details about your {selectedType?.name || 'document'}
      </h1>
      <p className="ts-soft mt-1.5 text-base">
        Answer the questions below. Anything marked with <span className="ts-error-text">*</span> is required.
      </p>

      <SubmitProblems general={generalError} {...problemsFor(2)} />

      {requestingAsLine && (
        <div className="ts-info-note mt-4 px-3.5 py-2.5 text-sm">
          <span className="font-semibold">You&rsquo;re requesting as:</span> {requestingAsLine}
        </div>
      )}

      {selectedType && (selectedType.required_documents || selectedType.processing_time || selectedType.fee_amount) && (
        <div className="ts-card mt-4 overflow-hidden">
          <button
            type="button"
            onClick={() => setGuideOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="ts-ink text-sm font-semibold">Requirements &amp; Processing Time</span>
            <span className={`ts-soft transition-transform ${guideOpen ? 'rotate-180' : ''}`}>
              <ChevronIcon />
            </span>
          </button>
          {guideOpen && (
            <div className="border-t px-4 pb-4 pt-1 text-xs" style={{ borderColor: '#E3DFD2' }}>
              {selectedType.required_documents && (
                <p className="ts-soft mt-2">
                  <strong className="ts-ink">You'll need:</strong> {selectedType.required_documents}
                </p>
              )}
              {(selectedType.processing_time || selectedType.fee_amount) && (
                <p className="ts-soft mt-2">
                  {selectedType.processing_time && <>Processing time: {selectedType.processing_time}</>}
                  {selectedType.processing_time && selectedType.fee_amount ? ' · ' : ''}
                  {formatFee(selectedType.fee_amount) && (
                    <>
                      Fee (paid at the Cashier): {formatFee(selectedType.fee_amount)}{' '}
                      {selectedType.pricing_unit === 'per_page' ? 'per page' : 'per copy'}
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="ts-card mt-4 space-y-5 p-6 sm:p-8">
        <div>
          <div className="mb-1.5 flex items-center">
            <label htmlFor="purpose" className="ts-ink text-sm font-medium">
              What do you need it for?
              <RequiredMark />
            </label>
            <HelpTip label="Why are we asking?">
              The reason is printed on your official request form. A few reasons &mdash; like a Board Exam
              or completing an INC &mdash; need an extra detail or fee, and we&rsquo;ll ask for it here.
            </HelpTip>
          </div>
          <div className="relative">
            <select
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              {...invalidProps('purpose', 'purpose')}
              className={`ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm ${errorClass('purpose')}`}
            >
              <option value="">Select a purpose</option>
              {PURPOSE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <ChevronIcon />
            </span>
          </div>
          <FieldError id="purpose">{errorFor('purpose')}</FieldError>

          {purpose === 'Others' && (
            <>
              <input
                id="purposeOther"
                type="text"
                value={purposeOther}
                onChange={(e) => setPurposeOther(e.target.value)}
                placeholder="Tell us what you need it for"
                aria-label="What you need the document for"
                {...invalidProps('purpose_other', 'purposeOther')}
                className={`ts-input mt-3 w-full px-3.5 py-2.5 text-sm ${errorClass('purpose_other')}`}
              />
              <FieldError id="purposeOther">{errorFor('purpose_other')}</FieldError>
            </>
          )}

          {/* The one purpose with its own fee and its own two questions. */}
          {isIncCompletion && (
            <div className="ts-well mt-3 space-y-3 px-3.5 py-3.5">
              <p className="ts-soft text-xs leading-relaxed">
                Completing an INC (incomplete grade) adds a ₱175.00 fee, paid at the Cashier. Tell us which
                subject it&rsquo;s for.
              </p>
              <div>
                <label htmlFor="semesterTaken" className="ts-ink mb-1.5 block text-sm font-medium">
                  Semester Taken &amp; S.Y.<RequiredMark />
                </label>
                <input
                  id="semesterTaken"
                  type="text"
                  value={semesterTaken}
                  onChange={(e) => setSemesterTaken(e.target.value)}
                  placeholder="e.g. 1st Semester, SY 2023-2024"
                  {...invalidProps('semester_taken', 'semesterTaken')}
                  className={`ts-input w-full px-3.5 py-2.5 text-sm ${errorClass('semester_taken')}`}
                />
                <FieldError id="semesterTaken">{errorFor('semester_taken')}</FieldError>
              </div>
              <div>
                <label htmlFor="subjectCode" className="ts-ink mb-1.5 block text-sm font-medium">
                  Subject Code<RequiredMark />
                </label>
                <input
                  id="subjectCode"
                  type="text"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  placeholder="e.g. IT321"
                  {...invalidProps('subject_code', 'subjectCode')}
                  className={`ts-input w-full px-3.5 py-2.5 text-sm ${errorClass('subject_code')}`}
                />
                <FieldError id="subjectCode">{errorFor('subject_code')}</FieldError>
              </div>
            </div>
          )}

          {purpose === 'For Board Exam' && (
            <div className="mt-3">
              <label
                htmlFor="boardExamPhoto"
                className={`ts-file-drop flex cursor-pointer items-center gap-3 px-4 py-3.5 ${
                  boardExamPhoto ? 'ts-file-drop-filled' : ''
                } ${photoError || errorFor('board_exam_photo') ? 'ts-file-drop-error' : ''}`}
              >
                <span className={boardExamPhoto ? 'ts-sage' : 'ts-soft'}>
                  {boardExamPhoto ? <CheckIcon /> : <UploadIcon />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="ts-ink block text-sm font-medium">
                    Upload white-background photo (2x2)
                    <RequiredMark />
                  </span>
                  <span className="ts-soft block truncate text-xs">
                    {boardExamPhoto ? boardExamPhoto.name : 'JPG or PNG, up to 5 MB. Required for Board Exam requests'}
                  </span>
                </span>
              </label>
              <input
                id="boardExamPhoto"
                type="file"
                accept="image/png,image/jpeg"
                onChange={pickBoardExamPhoto}
                aria-invalid={Boolean(photoError || errorFor('board_exam_photo'))}
                aria-describedby={photoError || errorFor('board_exam_photo') ? 'boardExamPhoto-error' : undefined}
                className="sr-only"
              />
              <FieldError id="boardExamPhoto">{photoError || errorFor('board_exam_photo')}</FieldError>
            </div>
          )}
        </div>

        {/* Sub-selections belonging to one document type each. */}
        {needsCavAgency && (
          <div>
            <div className="mb-1.5 flex items-center">
              <label htmlFor="cavAgency" className="ts-ink text-sm font-medium">
                Which agency is this for?
                <RequiredMark />
              </label>
              <HelpTip label="What is a CAV?">
                CAV stands for Certification, Authentication and Verification. It confirms your school
                records are genuine for the government office that asked for them &mdash; often needed to
                work or study abroad.
              </HelpTip>
            </div>
            <div className="relative">
              <select
                id="cavAgency"
                value={cavAgency}
                onChange={(e) => setCavAgency(e.target.value)}
                {...invalidProps('cav_agency', 'cavAgency')}
                className={`ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm ${errorClass('cav_agency')}`}
              >
                <option value="">Choose the office that asked for it</option>
                {CAV_AGENCIES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <ChevronIcon />
              </span>
            </div>
            <FieldError id="cavAgency">{errorFor('cav_agency')}</FieldError>
            <p className="ts-soft mt-1.5 text-xs">
              {CAV_AGENCIES.find((a) => a.value === cavAgency)?.hint ||
                "Pick the office you'll be giving the document to. Not sure? Ask whoever requested it from you."}
            </p>
          </div>
        )}

        {needsCertificationSubtypes && (
          <div>
            <div className="mb-1.5 flex items-center">
              <p className="ts-ink text-sm font-medium">
                What should the certification say?
                <RequiredMark />
              </p>
              <HelpTip label="What is a certification?">
                A certification is a short official letter from the Registrar confirming something about your
                records. Tick everything it needs to cover &mdash; one certification can cover several.
              </HelpTip>
            </div>
            <div className="ts-well grid grid-cols-1 gap-x-4 gap-y-3 px-3.5 py-3.5 sm:grid-cols-2">
              {CERTIFICATION_SUBTYPES.map(({ value: sub, hint }) => {
                const checked = certificationSubtypes.includes(sub);
                return (
                  <label key={sub} className="flex cursor-pointer select-none items-start gap-2.5 text-sm">
                    <span className="ts-checkbox-wrap mt-0.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setCertificationSubtypes((prev) =>
                            checked ? prev.filter((x) => x !== sub) : [...prev, sub]
                          )
                        }
                        className="ts-checkbox-input"
                      />
                      <span className="ts-checkbox-well" aria-hidden="true">
                        <svg viewBox="0 0 12 10" fill="none" className="ts-checkbox-check">
                          <path d="M1 5.2 4.3 8.5 11 1.5" stroke="#FAF8F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </span>
                    <span>
                      <span className="ts-ink block">{sub}</span>
                      {hint && <span className="ts-soft block text-xs">{hint}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="ts-soft mt-1.5 text-xs">Tick at least one.</p>
            <FieldError id="certificationSubtypes">{errorFor('certification_subtypes')}</FieldError>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="numberOfCopies" className="ts-ink mb-1.5 block text-sm font-medium">
              Number of copies
              <RequiredMark />
            </label>
            <input
              id="numberOfCopies"
              type="number"
              min="1"
              value={numberOfCopies}
              onChange={(e) => setNumberOfCopies(e.target.value)}
              {...invalidProps('number_of_copies', 'numberOfCopies')}
              className={`ts-input w-full px-3.5 py-2.5 text-sm ${errorClass('number_of_copies')}`}
            />
            <FieldError id="numberOfCopies">{errorFor('number_of_copies')}</FieldError>
            <p className="ts-soft mt-1.5 text-xs">How many separate copies you need.</p>
          </div>

          {/* Per-page documents only: two copies of a ten-page transcript are charged for twenty pages. */}
          {isPerPage && (
            <div>
              <label htmlFor="numberOfPages" className="ts-ink mb-1.5 block text-sm font-medium">
                Number of pages
                <RequiredMark />
              </label>
              <input
                id="numberOfPages"
                type="number"
                min="1"
                value={numberOfPages}
                onChange={(e) => setNumberOfPages(e.target.value)}
                placeholder="e.g. 4"
                {...invalidProps('number_of_pages', 'numberOfPages')}
                className={`ts-input w-full px-3.5 py-2.5 text-sm ${errorClass('number_of_pages')}`}
              />
              <FieldError id="numberOfPages">{errorFor('number_of_pages')}</FieldError>
              <p className="ts-soft mt-1.5 text-xs">
                {selectedType?.name} is charged per page
                {selectedType?.fee_amount ? ` (₱${Number(selectedType.fee_amount).toFixed(2)} each)` : ''}.
                Ask the registrar if you are unsure how many pages yours runs to.
              </p>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center">
              <label htmlFor="semester" className="ts-ink text-sm font-medium">
                Your latest semester at USTP
                <RequiredMark />
              </label>
              <HelpTip label="Which semester should I pick?">
                The most recent semester you were enrolled in. It&rsquo;s printed on your official request
                form.
              </HelpTip>
            </div>
            <div className="relative">
              <select
                id="semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                {...invalidProps('semester', 'semester')}
                className={`ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm ${errorClass('semester')}`}
              >
                <option value="">Choose a semester</option>
                {semesterOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <ChevronIcon />
              </span>
            </div>
            <FieldError id="semester">{errorFor('semester')}</FieldError>
          </div>
        </div>

        {/* Alumni only. */}
        {isAlumni && (
          <div>
            <label htmlFor="graduationDate" className="ts-ink mb-1.5 block text-sm font-medium">
              When did you graduate?
              <RequiredMark />
            </label>
            <input
              id="graduationDate"
              type="date"
              value={graduationDate}
              onChange={(e) => setGraduationDate(e.target.value)}
              {...invalidProps('graduation_date', 'graduationDate')}
              className={`ts-input w-full px-3.5 py-2.5 text-sm ${errorClass('graduation_date')}`}
            />
            <FieldError id="graduationDate">{errorFor('graduation_date')}</FieldError>
            {/* Mirrors the server's pre-2018 archive rule, so the wait is explained up front. */}
            {graduationDate && graduationDate < '2018-01-01' && (
              <div className="ts-info-note mt-2 flex items-start px-3.5 py-2.5 text-sm">
                <span>
                  Records from before 2018 are kept in the university archive, so this request may take a
                  little longer than usual.
                </span>
                <HelpTip label="Why does this take longer?">
                  Older records are stored separately and have to be retrieved by hand before the Registrar
                  can prepare your document.
                </HelpTip>
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor="additionalNotes" className="ts-ink mb-1.5 block text-sm font-medium">
            Additional notes <span className="ts-soft font-normal">(optional)</span>
          </label>
          <textarea
            id="additionalNotes"
            rows={3}
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Anything else Window 6 should know about this request"
            className="ts-input w-full px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-8 flex justify-between gap-3">
        <button type="button" onClick={() => goToStep(1)} className="ts-btn-glass self-start px-6 py-2.5 text-sm font-medium">
          Back
        </button>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            disabled={!step2Valid}
            onClick={() => goToStep(3)}
            className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
          >
            Next
          </button>
          <MissingHint items={step2Missing} />
        </div>
      </div>
    </>
  );
}
