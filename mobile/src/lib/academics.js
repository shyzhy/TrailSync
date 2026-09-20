// Choice lists for a student's academic profile, mirroring the web app and the server (TrailSync/academics.py).
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

// The two lines of the printed form; any number can be ticked at once.
export const ACADEMIC_STATUS_OPTIONS = [
  { value: 'Undergraduate Student', hint: 'Taking a bachelor’s degree now' },
  { value: 'Graduate/Masteral Student', hint: 'Taking a master’s or doctorate now' },
  { value: 'Alumnus — High School', hint: 'Finished high school at USTP' },
  { value: 'Alumnus — Undergraduate', hint: 'Finished a bachelor’s degree at USTP' },
  { value: 'Alumnus — Graduate/Masteral', hint: 'Finished a master’s or doctorate at USTP' },
];

export const isAlumnus = (statuses) => (statuses || []).some((s) => String(s).startsWith('Alumnus'));

export const PURPOSES = [
  'For Evaluation',
  'For Employment',
  'For Scholarship',
  'For Personal File',
  'For Passport',
  'For Advanced Studies',
  'For Board Exam',
  'For Ranking',
  'For Completion of INC',
  'Others',
];

export const PROXY_RELATIONSHIPS = ['Parent', 'Sibling', 'Spouse', 'Relative', 'Friend', 'Authorized Representative'];
