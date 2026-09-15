// Choice lists for a student's academic profile. COURSES is still a placeholder awaiting USTP–CDO's real programmes.

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

// Mirrors the printed form and the server: only alumni can have finished at high school level.
export const ACADEMIC_LEVELS = {
  Student: ['Undergraduate', 'Graduate'],
  Alumni: ['High School', 'Undergraduate', 'Graduate'],
};
