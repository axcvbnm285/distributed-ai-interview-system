const fs    = require("fs");
const path  = require("path");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");

const TIMEOUT_MS = 10000; // 10 s per execution

// ── runtime config ────────────────────────────────────────────────────────────
const RUNNERS = {
  python: { bin: "python3", ext: "py" },
};

// ── core executor ─────────────────────────────────────────────────────────────
// Uses spawn with stdio:'pipe' so:
//   • stdin is always a pipe  → /dev/stdin & process.stdin both work
//   • input (even empty) is written then stdin.end() signals EOF immediately
//   • no shell escaping needed — input bytes go directly to the child process
function execute(language, filePath, input) {
  return new Promise((resolve) => {
    const runner = RUNNERS[language];
    if (!runner) {
      return resolve({ stdout: "", stderr: `Language "${language}" not supported.`, timedOut: false, code: 1 });
    }

    const child = spawn(runner.bin, [filePath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut, code });
    });

    // Always write stdin (empty string = immediate EOF, which is what
    // readFileSync("/dev/stdin") and input() need to not block forever)
    child.stdin.write(input || "");
    child.stdin.end();
  });
}

// ── write temp file ───────────────────────────────────────────────────────────
function writeTempFile(language, code) {
  const { ext } = RUNNERS[language] || { ext: "txt" };
  const filePath = path.join(__dirname, `../../temp-${uuidv4()}.${ext}`);
  fs.writeFileSync(filePath, code, "utf8");
  return filePath;
}

function cleanup(filePath) {
  try { fs.unlinkSync(filePath); } catch {}
}

// ── POST /code/run ────────────────────────────────────────────────────────────
exports.runCode = async (req, res) => {
  const { code, language, input = "" } = req.body;

  if (!RUNNERS[language]) {
    return res.json({ output: `Language "${language}" is not supported.` });
  }

  const filePath = writeTempFile(language, code);
  try {
    const { stdout, stderr, timedOut, code: exitCode } = await execute(language, filePath, input);

    console.log(`[runCode] lang=${language} exit=${exitCode} timedOut=${timedOut}`);
    if (stderr) console.log(`[runCode] stderr: ${stderr.slice(0, 200)}`);

    if (timedOut) {
      return res.json({ output: "Error: Time limit exceeded (10s)." });
    }
    // Return stderr when there's an error exit, stdout otherwise
    // If both exist (e.g. partial output then crash) combine them
    const output = exitCode !== 0 ? (stderr || stdout || "Error: No output.") : stdout;
    res.json({ output });
  } finally {
    cleanup(filePath);
  }
};

// ── POST /code/run-tests ──────────────────────────────────────────────────────
exports.runTests = async (req, res) => {
  const { code, language, testCases } = req.body;

  if (!RUNNERS[language]) {
    return res.status(400).json({ message: `Language "${language}" is not supported.` });
  }
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return res.status(400).json({ message: "No test cases provided." });
  }

  // Write the file once — reused across all test cases
  const filePath = writeTempFile(language, code);
  const results  = [];

  try {
    for (const tc of testCases) {
      const { stdout, stderr, timedOut, code: exitCode } = await execute(language, filePath, tc.input);

      console.log(`[runTests] case input=${JSON.stringify(tc.input).slice(0,40)} exit=${exitCode} timedOut=${timedOut}`);

      let actual;
      if (timedOut) {
        actual = "Error: Time limit exceeded (10s).";
      } else if (exitCode !== 0) {
        actual = stderr || stdout || "Error: No output.";
      } else {
        actual = stdout;
      }

      const actualTrimmed   = actual.trim();
      const expectedTrimmed = (tc.expected || "").trim();

      results.push({
        input:    tc.input,
        expected: expectedTrimmed,
        actual:   actualTrimmed,
        passed:   !timedOut && exitCode === 0 && actualTrimmed === expectedTrimmed,
      });
    }

    res.json({ results });
  } finally {
    cleanup(filePath);
  }
};
