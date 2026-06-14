// Architecture: each question's starterCode is a COMPLETE driver.
// It reads stdin, parses input, defines a placeholder function,
// calls it, and prints the result.
// The candidate ONLY replaces the function body — they never touch I/O.
// Test cases supply raw stdin that matches the driver's expected format.

export const questions = [

  // ─── 1. Two Sum ──────────────────────────────────────────
  {
    title: "Two Sum",
    difficulty: "Easy",
    description:
      "Given a list of integers and a target, return the indices of the two numbers that add up to the target.\n\nOutput the two indices separated by a space.\n\nExample:\nInput: nums = [2, 7, 11, 15], target = 9\nOutput: 0 1",
    starterCode:
      'import sys\n' +
      '\n' +
      'def two_sum(nums, target):\n' +
      '    # write your solution here\n' +
      '    pass\n' +
      '\n' +
      '# --- driver (do not edit below) ---\n' +
      'data   = sys.stdin.read().split()\n' +
      'n      = int(data[0])\n' +
      'nums   = list(map(int, data[1:n+1]))\n' +
      'target = int(data[n+1])\n' +
      'result = two_sum(nums, target)\n' +
      'print(*result)\n',
    testCases: [
      { input: "4\n2 7 11 15\n9",  expected: "0 1" },
      { input: "3\n3 2 4\n6",      expected: "1 2" },
      { input: "2\n3 3\n6",        expected: "0 1" },
      { input: "5\n1 4 5 2 8\n6",  expected: "1 3" },
    ],
  },

  // ─── 2. Binary Search ────────────────────────────────────
  {
    title: "Binary Search",
    difficulty: "Easy",
    description:
      "Given a sorted list of integers and a target, return the index of the target. Return -1 if not found.\n\nExample:\nInput: arr = [1, 3, 5, 7, 9, 11], target = 7\nOutput: 3",
    starterCode:
      'import sys\n' +
      '\n' +
      'def binary_search(arr, target):\n' +
      '    # write your solution here\n' +
      '    pass\n' +
      '\n' +
      '# --- driver (do not edit below) ---\n' +
      'data   = sys.stdin.read().split()\n' +
      'n      = int(data[0])\n' +
      'arr    = list(map(int, data[1:n+1]))\n' +
      'target = int(data[n+1])\n' +
      'print(binary_search(arr, target))\n',
    testCases: [
      { input: "6\n1 3 5 7 9 11\n7",  expected: "3"  },
      { input: "6\n1 3 5 7 9 11\n1",  expected: "0"  },
      { input: "6\n1 3 5 7 9 11\n11", expected: "5"  },
      { input: "6\n1 3 5 7 9 11\n4",  expected: "-1" },
    ],
  },

  // ─── 3. Valid Parentheses ────────────────────────────────
  {
    title: "Valid Parentheses",
    difficulty: "Easy",
    description:
      "Given a string of brackets, return True if it is valid, False otherwise.\n\nValid means every opening bracket has a matching closing bracket in the correct order.\n\nExample:\nInput: \"()[]{}\"\nOutput: True",
    starterCode:
      'import sys\n' +
      '\n' +
      'def is_valid(s):\n' +
      '    # write your solution here\n' +
      '    pass\n' +
      '\n' +
      '# --- driver (do not edit below) ---\n' +
      's = sys.stdin.read().strip()\n' +
      'print(is_valid(s))\n',
    testCases: [
      { input: "()",     expected: "True"  },
      { input: "()[]{}", expected: "True"  },
      { input: "(]",     expected: "False" },
      { input: "([)]",   expected: "False" },
      { input: "{[]}",   expected: "True"  },
    ],
  },

  // ─── 4. Reverse String ───────────────────────────────────
  {
    title: "Reverse String",
    difficulty: "Easy",
    description:
      "Given a string, return it reversed.\n\nExample:\nInput: \"hello\"\nOutput: \"olleh\"",
    starterCode:
      'import sys\n' +
      '\n' +
      'def reverse_string(s):\n' +
      '    # write your solution here\n' +
      '    pass\n' +
      '\n' +
      '# --- driver (do not edit below) ---\n' +
      's = sys.stdin.read().strip()\n' +
      'print(reverse_string(s))\n',
    testCases: [
      { input: "hello",   expected: "olleh"   },
      { input: "abcde",   expected: "edcba"   },
      { input: "racecar", expected: "racecar" },
      { input: "OpenAI",  expected: "IAnepO"  },
    ],
  },

  // ─── 5. FizzBuzz ─────────────────────────────────────────
  {
    title: "FizzBuzz",
    difficulty: "Easy",
    description:
      "Given N, print numbers 1 to N. Replace multiples of 3 with Fizz, multiples of 5 with Buzz, and multiples of both with FizzBuzz.\n\nExample:\nInput: 5\nOutput:\n1\n2\nFizz\n4\nBuzz",
    starterCode:
      'import sys\n' +
      '\n' +
      'def fizzbuzz(n):\n' +
      '    # write your solution here\n' +
      '    # return a list of strings\n' +
      '    pass\n' +
      '\n' +
      '# --- driver (do not edit below) ---\n' +
      'n = int(sys.stdin.read().strip())\n' +
      'print("\\n".join(fizzbuzz(n)))\n',
    testCases: [
      { input: "5",  expected: "1\n2\nFizz\n4\nBuzz" },
      { input: "15", expected: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz" },
      { input: "3",  expected: "1\n2\nFizz" },
    ],
  },

  // ─── 6. Palindrome Check ─────────────────────────────────
  {
    title: "Palindrome Check",
    difficulty: "Easy",
    description:
      "Given a string, return True if it is a palindrome (case-insensitive), False otherwise.\n\nExample:\nInput: \"Madam\"\nOutput: True",
    starterCode:
      'import sys\n' +
      '\n' +
      'def is_palindrome(s):\n' +
      '    # write your solution here\n' +
      '    pass\n' +
      '\n' +
      '# --- driver (do not edit below) ---\n' +
      's = sys.stdin.read().strip()\n' +
      'print(is_palindrome(s))\n',
    testCases: [
      { input: "racecar", expected: "True"  },
      { input: "hello",   expected: "False" },
      { input: "Madam",   expected: "True"  },
      { input: "abcba",   expected: "True"  },
      { input: "abcd",    expected: "False" },
    ],
  },

  // ─── 7. Maximum Subarray ─────────────────────────────────
  {
    title: "Maximum Subarray",
    difficulty: "Medium",
    description:
      "Find the contiguous subarray with the largest sum and return that sum.\n\nUse Kadane's Algorithm.\n\nExample:\nInput: [-2, 1, -3, 4, -1, 2, 1, -5, 4]\nOutput: 6",
    starterCode:
      'import sys\n' +
      '\n' +
      'def max_subarray(nums):\n' +
      '    # write your solution here\n' +
      '    pass\n' +
      '\n' +
      '# --- driver (do not edit below) ---\n' +
      'data = sys.stdin.read().split()\n' +
      'n    = int(data[0])\n' +
      'nums = list(map(int, data[1:n+1]))\n' +
      'print(max_subarray(nums))\n',
    testCases: [
      { input: "9\n-2 1 -3 4 -1 2 1 -5 4", expected: "6"  },
      { input: "1\n1",                       expected: "1"  },
      { input: "5\n5 4 -1 7 8",             expected: "23" },
      { input: "4\n-3 -2 -1 -4",            expected: "-1" },
    ],
  },

  // ─── 8. Cycle Detection ──────────────────────────────────
  {
    title: "Cycle Detection",
    difficulty: "Medium",
    description:
      "Given n next-pointers (0-indexed), where -1 means null, detect if the linked list has a cycle.\n\nReturn True or False.\n\nExample:\nInput: n=4, next=[1, 2, 3, 1]\nOutput: True",
    starterCode:
      'import sys\n' +
      '\n' +
      'def has_cycle(n, nxt):\n' +
      '    # nxt[i] is the next pointer, -1 means null\n' +
      '    # write your solution here\n' +
      '    pass\n' +
      '\n' +
      '# --- driver (do not edit below) ---\n' +
      'data = sys.stdin.read().split()\n' +
      'n    = int(data[0])\n' +
      'nxt  = list(map(int, data[1:n+1]))\n' +
      'print(has_cycle(n, nxt))\n',
    testCases: [
      { input: "4\n1 2 3 1",  expected: "True"  },
      { input: "4\n1 2 3 -1", expected: "False" },
      { input: "1\n-1",       expected: "False" },
      { input: "3\n1 2 0",    expected: "True"  },
    ],
  },

  // ─── 9. Climbing Stairs ──────────────────────────────────
  {
    title: "Climbing Stairs",
    difficulty: "Easy",
    description:
      "You can climb 1 or 2 steps at a time. Given N steps, return the number of distinct ways to reach the top.\n\nExample:\nInput: 5\nOutput: 8",
    starterCode:
      'import sys\n' +
      '\n' +
      'def climb_stairs(n):\n' +
      '    # write your solution here\n' +
      '    pass\n' +
      '\n' +
      '# --- driver (do not edit below) ---\n' +
      'n = int(sys.stdin.read().strip())\n' +
      'print(climb_stairs(n))\n',
    testCases: [
      { input: "1",  expected: "1"  },
      { input: "2",  expected: "2"  },
      { input: "3",  expected: "3"  },
      { input: "5",  expected: "8"  },
      { input: "10", expected: "89" },
    ],
  },

  // ─── 10. Longest Common Prefix ───────────────────────────
  {
    title: "Longest Common Prefix",
    difficulty: "Easy",
    description:
      "Given a list of strings, find the longest common prefix. Return an empty string if none exists.\n\nExample:\nInput: [\"flower\", \"flow\", \"flight\"]\nOutput: fl",
    starterCode:
      'import sys\n' +
      '\n' +
      'def longest_common_prefix(words):\n' +
      '    # write your solution here\n' +
      '    pass\n' +
      '\n' +
      '# --- driver (do not edit below) ---\n' +
      'lines = sys.stdin.read().splitlines()\n' +
      'n     = int(lines[0])\n' +
      'words = lines[1:n+1]\n' +
      'print(longest_common_prefix(words))\n',
    testCases: [
      { input: "3\nflower\nflow\nflight",    expected: "fl"        },
      { input: "3\ndog\nracecar\ncar",        expected: ""          },
      { input: "2\ninterviewflow\ninterview", expected: "interview" },
      { input: "1\nhello",                    expected: "hello"     },
    ],
  },

];
