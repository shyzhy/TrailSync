// The request lifecycle, same as the web app: values are the backend's stored strings, never display labels.
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
export const LIFECYCLE = [STATUS.SUBMITTED, STATUS.VERIFIED, STATUS.APPROVED, STATUS.PROCESSING, STATUS.READY, STATUS.RELEASED];

// Written from the student's side of the counter.
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

export const STEP_LABEL = {
  [STATUS.SUBMITTED]: 'Submitted',
  [STATUS.VERIFIED]: 'Verified',
  [STATUS.APPROVED]: 'Approved',
  [STATUS.PROCESSING]: 'Processing',
  [STATUS.READY]: 'Ready',
  [STATUS.RELEASED]: 'Released',
};

// What each stage means for the student, in one short line.
export const NEXT_STEP = {
  [STATUS.SUBMITTED]: 'The Registrar’s office is checking it.',
  [STATUS.VERIFIED]: 'Waiting for the Registrar’s approval.',
  [STATUS.APPROVED]: 'Download your form, then pay at the Cashier.',
  [STATUS.PROCESSING]: 'Payment received. Your document is being prepared.',
  [STATUS.READY]: 'Ready! Pick it up at Window 6.',
  [STATUS.RELEASED]: 'Picked up. All done.',
};

export const studentStatusLabel = (value) => STUDENT_STATUS_LABEL[value] || value;

export const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Submitted', value: STATUS.SUBMITTED },
  { label: 'Under review', value: STATUS.VERIFIED },
  { label: 'Ready to print', value: STATUS.APPROVED },
  { label: 'Processing', value: STATUS.PROCESSING },
  { label: 'Ready', value: STATUS.READY },
  { label: 'Released', value: STATUS.RELEASED },
];
