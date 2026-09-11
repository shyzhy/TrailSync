/**
 * The request lifecycle, shared by every screen that renders or filters one.
 *
 * Six screens used to each keep their own copy of this vocabulary, and they
 * had already drifted: the student dashboard collapsed two stages into
 * "Processing", the ticket card walked a four-step line, and the queue filter
 * called the first stage "Pending". Adding the real Processing stage would
 * have meant finding all six. They read from here instead.
 *
 * Values mirror FormRequest.RequestStatus on the backend exactly — they cross
 * the wire and travel in query strings, so they are the short stored strings,
 * never the display labels.
 */

export const STATUS = {
  SUBMITTED: 'Submitted',
  VERIFIED: 'Verified',
  APPROVED: 'Approved',
  PROCESSING: 'Processing',
  READY: 'Ready',
  RELEASED: 'Released',
  REJECTED: 'Rejected',
};

/**
 * The happy path, in order. Rejected is deliberately absent: it is an exit,
 * not a position on the line, so anything rendering progress treats it
 * separately rather than trying to place it.
 */
export const LIFECYCLE = [
  STATUS.SUBMITTED,
  STATUS.VERIFIED,
  STATUS.APPROVED,
  STATUS.PROCESSING,
  STATUS.READY,
  STATUS.RELEASED,
];

/** Staff-facing labels — the full wording from the feature docs. */
export const STATUS_LABEL = {
  [STATUS.SUBMITTED]: 'Pending Verification',
  [STATUS.VERIFIED]: 'Verified',
  [STATUS.APPROVED]: 'Approved - Ready to Print',
  [STATUS.PROCESSING]: 'Processing',
  [STATUS.READY]: 'Ready for Pickup',
  [STATUS.RELEASED]: 'Released',
  [STATUS.REJECTED]: 'Rejected',
};

/**
 * Student-facing labels. Shorter, and written from the student's side of the
 * counter: "Approved - Ready to Print" is an instruction to them, where
 * "Processing" is something happening without them.
 */
export const STUDENT_STATUS_LABEL = {
  [STATUS.SUBMITTED]: 'Submitted',
  // Front Desk has cleared the requirements and it is with the Registrar.
  // "Verified" would read to a student as "finished"; it is not.
  [STATUS.VERIFIED]: 'Under Review',
  [STATUS.APPROVED]: 'Ready to Print',
  [STATUS.PROCESSING]: 'Processing',
  [STATUS.READY]: 'Ready for Pickup',
  [STATUS.RELEASED]: 'Released',
  // Softer than "Rejected", and true: the student can fix it and try again.
  [STATUS.REJECTED]: 'Not approved',
};

/** Compact labels for the progress line, where space is tight. */
export const STEP_LABEL = {
  [STATUS.SUBMITTED]: 'Submitted',
  [STATUS.VERIFIED]: 'Verified',
  [STATUS.APPROVED]: 'Approved',
  [STATUS.PROCESSING]: 'Processing',
  [STATUS.READY]: 'Ready',
  [STATUS.RELEASED]: 'Released',
};

export const STATUS_PILL_CLASS = {
  [STATUS.SUBMITTED]: 'ts-pill-released',
  [STATUS.VERIFIED]: 'ts-pill-teal',
  [STATUS.APPROVED]: 'ts-pill-blue',
  [STATUS.PROCESSING]: 'ts-pill-processing',
  [STATUS.READY]: 'ts-pill-ready',
  [STATUS.RELEASED]: 'ts-pill-released',
  [STATUS.REJECTED]: 'ts-pill-danger',
};

/** Queue filter options, plus the catch-all the list endpoint understands. */
export const STATUS_FILTER_OPTIONS = [
  ...LIFECYCLE.map((value) => ({ value, label: STATUS_LABEL[value] })),
  { value: STATUS.REJECTED, label: STATUS_LABEL[STATUS.REJECTED] },
  { value: 'all', label: 'All statuses' },
];

export function statusLabel(value) {
  return STATUS_LABEL[value] || value;
}

export function studentStatusLabel(value) {
  return STUDENT_STATUS_LABEL[value] || value;
}

export function statusPillClass(value) {
  return STATUS_PILL_CLASS[value] || 'ts-pill-released';
}
