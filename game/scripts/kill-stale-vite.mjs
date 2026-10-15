// Kill all stale Vite processes that are holding port 5173 (or any other
// dev port). Use this when `npm run dev` fails with "Port 5173 is in use"
// because there are 7+ old Vite instances from previous sessions.
//
// On Windows:  uses `taskkill` to find and kill any process whose
// command line contains "vite".
// On macOS / Linux:  uses `pkill -f vite`.

import { spawn } from 'node:child_process';
import { platform } from 'node:os';

const isWin = platform() === 'win32';

function run(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('close', (code) => resolve(code ?? 0));
  });
}

async function main() {
  console.log('Killing stale Vite processes...');
  if (isWin) {
    // /F = force, /IM = image name. /FI filters by command line contains "vite".
    await run('taskkill', ['/F', '/FI', 'IMAGENAME eq node.exe', '/T']);
  } else {
    await run('pkill', ['-f', 'vite']);
  }
  console.log('Done. You can now run: npm run dev');
}

main().catch((e) => {
  console.error('Failed to clean up:', e);
  process.exit(1);
});
