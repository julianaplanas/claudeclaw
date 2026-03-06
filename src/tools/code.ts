import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

const MAX_TIMEOUT_SECONDS = 30;
const MAX_OUTPUT_LENGTH = 4000;

export async function executeCode(args: {
  language: 'python' | 'javascript';
  code: string;
  timeout?: number;
}): Promise<string> {
  const timeout = Math.min((args.timeout ?? 10) * 1000, MAX_TIMEOUT_SECONDS * 1000);

  let tmpDir: string | null = null;
  let filePath: string | null = null;

  try {
    tmpDir = await mkdtemp(join(tmpdir(), 'openclaw-'));

    let command: string;

    if (args.language === 'python') {
      filePath = join(tmpDir, 'script.py');
      await writeFile(filePath, args.code, 'utf-8');
      command = `python3 "${filePath}"`;
    } else {
      filePath = join(tmpDir, 'script.js');
      await writeFile(filePath, args.code, 'utf-8');
      command = `node "${filePath}"`;
    }

    const { stdout, stderr } = await execAsync(command, {
      timeout,
      cwd: tmpDir,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        // Restrict access to secrets
        NODE_ENV: 'sandbox',
      },
    });

    const output = stdout.substring(0, MAX_OUTPUT_LENGTH);
    const errOutput = stderr.substring(0, 500);

    let result = '';
    if (output) result += `Output:\n${output}`;
    if (errOutput) result += `\nStderr:\n${errOutput}`;
    if (!result) result = '(no output)';

    if (output.length >= MAX_OUTPUT_LENGTH) {
      result += '\n\n(output truncated)';
    }

    return result;
  } catch (err: any) {
    if (err.killed || err.signal === 'SIGTERM') {
      return `Error: Code execution timed out after ${args.timeout ?? 10} seconds.`;
    }

    const stderr = err.stderr?.substring(0, 1000) || '';
    const message = err.message?.substring(0, 500) || 'Unknown error';

    return `Error executing ${args.language} code:\n${stderr || message}`;
  } finally {
    // Clean up temp files
    if (filePath) {
      await unlink(filePath).catch(() => {});
    }
    if (tmpDir) {
      await import('fs').then(fs => {
        fs.rm(tmpDir!, { recursive: true, force: true }, () => {});
      });
    }
  }
}
