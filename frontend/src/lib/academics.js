/**
 * Choice lists for a student's academic profile.
 *
 * Shared by onboarding and anywhere else that asks, so the options can't
 * differ between screens. COURSES is still the placeholder list the original
 * sign-up form shipped with and needs replacing with USTP–CDO's real
 * programme offerings.
 */

export const COURSES = [
  'BS Information Technology',
  'BS Computer Science',
  'BS Computer Engineering',
  'BS Civil Engineering',
  'BS Electrical Engineering',
  'BS Electronics Engineering',
  'BS Mechanical Engineering',
  'BS Chemical Engineering',
  'BS Architecture',
  'BS Accountancy',
  'BS Business Administration',
  'BS Food Technology',
  'BS Environmental Science',
  'BS Secondary Education',
];

export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

export const USER_CATEGORIES = [
  { value: 'Student', label: 'Student', hint: 'I’m currently enrolled at USTP' },
  { value: 'Alumni', label: 'Alumni', hint: 'I’ve graduated or left USTP' },
];

/**
 * Mirrors the printed form's checkbox and the server's rule: a current
 * student is Undergraduate or Graduate; an alumnus may also have finished at
 * the high school level.
 */
export const ACADEMIC_LEVELS = {
  Student: ['Undergraduate', 'Graduate'],
  Alumni: ['High School', 'Undergraduate', 'Graduate'],
};
