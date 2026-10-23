/**
 * Intelligent Gender Detection and Avatar Generation for Finovo
 */

// Common male first names (Indian and Global)
const MALE_NAMES = new Set([
  // Indian
  'prakhar', 'rahul', 'amit', 'rohit', 'ankit', 'ayush', 'vikas', 'sachin',
  'varun', 'arjun', 'aditya', 'mayank', 'shivam', 'prateek', 'abhishek',
  'karan', 'vishal', 'manish', 'deepak', 'raj', 'roshan', 'suraj', 'ajay',
  'sunil', 'anil', 'vijay', 'sanjay', 'vikram', 'vivek', 'sumit', 'gaurav',
  'harsh', 'mohit', 'aman', 'kartik', 'tarun', 'yash', 'akash', 'naveen',
  'kunal', 'sid', 'siddharth', 'ritesh', 'alok', 'ashish', 'chetan', 'dev',
  'dhruv', 'ishaan', 'kabir', 'madhav', 'nihal', 'om', 'parth', 'raghav',
  'samar', 'tanmay', 'utkarsh', 'veer', 'yuvraj', 'harshit', 'nikhil',
  // Global
  'john', 'david', 'michael', 'james', 'robert', 'chris', 'daniel', 'sam',
  'matt', 'ryan', 'tom', 'alex', 'steve', 'mark', 'brian', 'kevin', 'paul',
  'jason', 'eric', 'adam', 'ben', 'luke', 'jack', 'harry', 'george', 'will'
]);

// Common female first names (Indian and Global)
const FEMALE_NAMES = new Set([
  // Indian
  'priya', 'pooja', 'neha', 'ananya', 'shreya', 'sneha', 'sakshi', 'simran',
  'kriti', 'divya', 'tanvi', 'swati', 'aditi', 'riku', 'riya', 'kajal',
  'kavita', 'rashmi', 'deepika', 'anushka', 'pallavi', 'preeti', 'megha',
  'sonal', 'monika', 'rekha', 'sunita', 'geeta', 'seema', 'radha', 'aarti',
  'komal', 'bhavna', 'mansi', 'rashi', 'isha', 'diya', 'khushi', 'tanya',
  'akanksha', 'garima', 'nidhi', 'parul', 'richa', 'shweta', 'urvashi',
  // Global
  'sarah', 'emma', 'olivia', 'sophia', 'charlotte', 'emily', 'jessica',
  'anna', 'laura', 'mary', 'jennifer', 'lisa', 'amanda', 'rachel', 'amy',
  'claire', 'elena', 'grace', 'hannah', 'lucy', 'mia', 'zoe'
]);

/**
 * Detects gender from a person's display name using heuristics
 * @param {string} fullName 
 * @returns {'male' | 'female' | 'neutral'}
 */
export const detectGender = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return 'neutral';
  
  const firstName = fullName.trim().split(/[\s._-]+/)[0].toLowerCase();
  if (!firstName) return 'neutral';

  if (MALE_NAMES.has(firstName)) return 'male';
  if (FEMALE_NAMES.has(firstName)) return 'female';

  // Common Indian feminine suffixes
  if (firstName.endsWith('ika') || firstName.endsWith('ita') || firstName.endsWith('iya') || firstName.endsWith('shree')) {
    return 'female';
  }

  // Default neutral if ambiguous
  return 'male';
};

/**
 * Extracts initials from user name (e.g., "Prakhar Purwar" -> "PP")
 */
export const getUserInitials = (name) => {
  if (!name || typeof name !== 'string') return 'FN';
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'FN';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Generates an appropriate DiceBear 9.x avatar URL respecting detected/selected gender
 */
export const getAvatarUrl = (userProfile = {}) => {
  const name = userProfile?.name || 'Finovo Member';
  const explicitGender = userProfile?.gender;
  const effectiveGender = explicitGender || detectGender(name);
  const seed = encodeURIComponent(name.trim() || 'Finovo');

  if (effectiveGender === 'male') {
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&top=shortCurly,shortFlat,shortRound,shortWaved,sides,theCaesar`;
  }

  if (effectiveGender === 'female') {
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&top=bob,curly,curvy,longButNotTooLong,straight01,straight02`;
  }

  // Neutral / default
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
};
