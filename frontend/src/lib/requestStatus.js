// The request lifecycle shared by every screen; values are the backend's stored strings, never display labels.

export const STATUS = {
  SUBMITTED: 'Submitted',
  VERIFIED: 'Verified',
  APPROVED: 'Approved',
  PROCESSING: 'Processing',
  READY: 'Ready',
  RELEASED: 'Released',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

// The happy path in order. Rejected and Cancelled are exits, not positions on the line.
export const LIFECYCLE = [
  STATUS.SUBMITTED,
  STATUS.VERIFIED,
  STATUS.APPROVED,
  STATUS.PROCESSING,
  STATUS.READY,
  STATUS.RELEASED,
];

// Staff-facing labels, phrased as whose turn it is.
export const STATUS_LABEL = {
  [STATUS.SUBMITTED]: 'Waiting for Review',
  [STATUS.VERIFIED]: 'Waiting for Approval',
  [STATUS.APPROVED]: 'Waiting for Payment',
  [STATUS.PROCESSING]: 'Being Prepared',
  [STATUS.READY]: 'Ready for Pickup',
  [STATUS.RELEASED]: 'Released',
  [STATUS.REJECTED]: 'Not Approved',
  [STATUS.CANCELLED]: 'Cancelled by Student',
};

// What staff should do next at each stage.
export const STAFF_NEXT_STEP = {
  [STATUS.SUBMITTED]: 'Check the requirements, then send it to the Registrar.',
  [STATUS.VERIFIED]: 'The Registrar approves it and the fee is worked out.',
  [STATUS.APPROVED]: 'The student prints their form and pays at the Cashier.',
  [STATUS.PROCESSING]: 'Prepare the document, then set the pickup date.',
  [STATUS.READY]: 'The student collects it at Window 6.',
  [STATUS.RELEASED]: 'Nothing left to do. This one is finished.',
  [STATUS.REJECTED]: 'Nothing left to do. The student was told why.',
  [STATUS.CANCELLED]: 'Nothing left to do. The student cancelled it before paying.',
};

// Student-facing labels, written from the student's side of the counter.
export const STUDENT_STATUS_LABEL = {
  [STATUS.SUBMITTED]: 'Submitted',
  // "Verified" would read to a student as finished; it is only with the Registrar.
  [STATUS.VERIFIED]: 'Under Review',
  [STATUS.APPROVED]: 'Ready to Print',
  [STATUS.PROCESSING]: 'Processing',
  [STATUS.READY]: 'Ready for Pickup',
  [STATUS.RELEASED]: 'Released',
  // Softer than "Rejected", and true: the student can fix it and try again.
  [STATUS.REJECTED]: 'Not approved',
  [STATUS.CANCELLED]: 'Cancelled',
};

// Compact labels for the progress line, where space is tight.
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
  [STATUS.CANCELLED]: 'ts-pill-cancelled',
};

// Queue filter options, plus the catch-all the list endpoint understands.
export const STATUS_FILTER_OPTIONS = [
  ...LIFECYCLE.map((value) => ({ value, label: STATUS_LABEL[value] })),
  { value: STATUS.REJECTED, label: STATUS_LABEL[STATUS.REJECTED] },
  { value: STATUS.CANCELLED, label: STATUS_LABEL[STATUS.CANCELLED] },
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
