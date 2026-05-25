/**
 * Comprehensive sequencing question bank for CurioKids AI AlphabetGrab.
 * Includes letter sequences (A-Z) and number sequences (1-9) across three difficulty levels.
 */

export const alphabetQuestions = [
  // DIFFICULTY 1: 3 options, slow float speed
  {
    id: 1,
    type: 'what_comes_after',
    prompt: 'What comes after B?',
    answer: 'C',
    options: ['A', 'C', 'D'],
    difficulty: 1
  },
  {
    id: 2,
    type: 'what_comes_before',
    prompt: 'What comes before D?',
    answer: 'C',
    options: ['B', 'C', 'E'],
    difficulty: 1
  },
  {
    id: 3,
    type: 'what_comes_after',
    prompt: 'What comes after 2?',
    answer: '3',
    options: ['1', '3', '4'],
    difficulty: 1
  },
  {
    id: 4,
    type: 'what_comes_before',
    prompt: 'What comes before 6?',
    answer: '5',
    options: ['4', '5', '7'],
    difficulty: 1
  },
  {
    id: 5,
    type: 'what_comes_after',
    prompt: 'What comes after F?',
    answer: 'G',
    options: ['E', 'G', 'H'],
    difficulty: 1
  },
  {
    id: 6,
    type: 'what_comes_before',
    prompt: 'What comes before H?',
    answer: 'G',
    options: ['F', 'G', 'I'],
    difficulty: 1
  },

  // DIFFICULTY 2: 4 options, standard bobbing speed
  {
    id: 7,
    type: 'what_comes_after',
    prompt: 'What comes after J?',
    answer: 'K',
    options: ['I', 'K', 'L', 'M'],
    difficulty: 2
  },
  {
    id: 8,
    type: 'what_comes_before',
    prompt: 'What comes before O?',
    answer: 'N',
    options: ['M', 'N', 'P', 'Q'],
    difficulty: 2
  },
  {
    id: 9,
    type: 'what_comes_after',
    prompt: 'What comes after 5?',
    answer: '6',
    options: ['4', '6', '7', '8'],
    difficulty: 2
  },
  {
    id: 10,
    type: 'what_comes_before',
    prompt: 'What comes before 8?',
    answer: '7',
    options: ['5', '6', '7', '9'],
    difficulty: 2
  },
  {
    id: 11,
    type: 'what_comes_after',
    prompt: 'What comes after R?',
    answer: 'S',
    options: ['Q', 'S', 'T', 'U'],
    difficulty: 2
  },
  {
    id: 12,
    type: 'what_comes_before',
    prompt: 'What comes before V?',
    answer: 'U',
    options: ['T', 'U', 'W', 'X'],
    difficulty: 2
  },
  {
    id: 13,
    type: 'what_comes_after',
    prompt: 'What comes after K?',
    answer: 'L',
    options: ['J', 'L', 'M', 'N'],
    difficulty: 2
  },

  // DIFFICULTY 3: 5 options, faster bobbing/drifting speed
  {
    id: 14,
    type: 'what_comes_after',
    prompt: 'What comes after X?',
    answer: 'Y',
    options: ['W', 'Y', 'Z', 'V', 'U'],
    difficulty: 3
  },
  {
    id: 15,
    type: 'what_comes_before',
    prompt: 'What comes before Z?',
    answer: 'Y',
    options: ['X', 'Y', 'W', 'Z', 'V'],
    difficulty: 3
  },
  {
    id: 16,
    type: 'what_comes_after',
    prompt: 'What comes after 7?',
    answer: '8',
    options: ['5', '6', '8', '9', '4'],
    difficulty: 3
  },
  {
    id: 17,
    type: 'what_comes_before',
    prompt: 'What comes before 3?',
    answer: '2',
    options: ['1', '2', '4', '5', '6'],
    difficulty: 3
  },
  {
    id: 18,
    type: 'what_comes_after',
    prompt: 'What comes after N?',
    answer: 'O',
    options: ['M', 'O', 'P', 'Q', 'L'],
    difficulty: 3
  },
  {
    id: 19,
    type: 'what_comes_before',
    prompt: 'What comes before Q?',
    answer: 'P',
    options: ['O', 'P', 'R', 'S', 'N'],
    difficulty: 3
  },
  {
    id: 20,
    type: 'what_comes_after',
    prompt: 'What comes after 8?',
    answer: '9',
    options: ['6', '7', '9', '5', '4'],
    difficulty: 3
  }
];

// Helper to shuffle array elements (useful for scrambling options dynamically)
export function shuffleOptions(options) {
  const arr = [...options];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
