import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const gitPath = [
  'git',
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Users\\user\\AppData\\Local\\Programs\\Git\\cmd\\git.exe'
].find(p => {
  try {
    execSync(`"${p}" --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
});

if (!gitPath) {
  console.log('Git CLI not found in PATH or standard directories. Please push via GitHub Desktop button!');
  process.exit(0);
}

try {
  console.log('Pushing latest UI and logo fixes to GitHub...');
  execSync(`"${gitPath}" add .`, { stdio: 'inherit' });
  execSync(`"${gitPath}" commit -m "UI Redesign, Logo asset fix, Show Password toggle feature"`, { stdio: 'inherit' });
  execSync(`"${gitPath}" push origin main`, { stdio: 'inherit' });
  console.log('✅ Pushed to GitHub successfully!');
} catch (err) {
  console.log('Git push status:', err.message);
}
