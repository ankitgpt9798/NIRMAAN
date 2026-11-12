/**
 * Creates the shop owner's admin account, or resets the password of an existing one.
 *
 * Usage (from the backend folder):  npm run create-admin
 *
 * - Asks for email, name and password in the terminal; the password is never
 *   printed, logged or stored in plain text (only a bcrypt hash is saved).
 * - Running it again for an existing email resets that password and signs out
 *   every device that was logged in with the old password.
 * - It needs the database credentials from backend/.env, which is why there is
 *   no public registration page.
 */
import readline from 'node:readline';
import { env } from '../config/env.js';
import { connectDB, describeMongoHost, disconnectDB } from '../config/db.js';
import { Admin } from '../models/index.js';
import { hashPassword } from '../services/auth.service.js';
import { adminNameField, emailField, passwordPolicy } from '../validators/auth.validators.js';

const MAX_TRIES = 3;

/**
 * Terminal prompts. In a real terminal the password is hidden while typing.
 * When input is piped (or the terminal cannot hide input) lines are read in order.
 */
function createPrompter() {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: interactive });
  rl.on('SIGINT', () => {
    process.stdout.write('\nCancelled. No changes were made.\n');
    process.exit(130);
  });

  if (interactive) {
    let muted = false;
    const write = rl._writeToOutput.bind(rl);
    // While muted, typed characters are not echoed (like most password prompts).
    rl._writeToOutput = (text) => {
      if (!muted) write(text);
      else if (/[\r\n]/.test(text)) write('\n');
    };
    const question = (text) => new Promise((resolve) => rl.question(text, resolve));
    return {
      interactive,
      ask: (text) => question(text),
      async askHidden(text) {
        const answer = question(text);
        muted = true;
        try {
          return await answer;
        } finally {
          muted = false;
        }
      },
      close: () => rl.close(),
    };
  }

  const lines = rl[Symbol.asyncIterator]();
  const readLine = async (text) => {
    process.stdout.write(text);
    const { value, done } = await lines.next();
    if (done) throw new Error('Input ended before all questions were answered. No changes were made.');
    process.stdout.write('\n');
    return value;
  };
  return { interactive, ask: readLine, askHidden: readLine, close: () => rl.close() };
}

async function askValid(prompter, question, schema, { hidden = false } = {}) {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    const raw = hidden ? await prompter.askHidden(question) : await prompter.ask(question);
    const result = schema.safeParse(raw);
    if (result.success) return result.data;
    console.log(`  ✗ ${result.error.issues[0].message}`);
  }
  throw new Error('Too many invalid answers. No changes were made.');
}

async function askNewPassword(prompter) {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    const password = await askValid(prompter, 'New password (min 8 characters, letters and numbers): ', passwordPolicy, {
      hidden: true,
    });
    const confirmation = await prompter.askHidden('Type the password again: ');
    if (password === confirmation) return password;
    console.log('  ✗ The two passwords do not match. Please try again.');
  }
  throw new Error('Passwords did not match. No changes were made.');
}

async function main() {
  const prompter = createPrompter();
  try {
    const connection = await connectDB();
    console.log('\n=== Shop admin account ===');
    console.log(`Database: "${connection.name}" on ${describeMongoHost(env.MONGODB_URI)}`);
    console.log(`Existing admin accounts: ${await Admin.countDocuments()}`);
    if (!prompter.interactive) {
      console.log('(Note: this terminal cannot hide typing. Make sure nobody can see your screen.)');
    }
    console.log('');

    const email = await askValid(prompter, 'Admin email: ', emailField);
    const existing = await Admin.findOne({ email });

    if (existing) {
      console.log(`An admin account for ${email} (${existing.name}) already exists.`);
      const answer = (await prompter.ask('Reset its password? Type "yes" to continue: ')).trim().toLowerCase();
      if (answer !== 'yes' && answer !== 'y') {
        console.log('No changes were made.');
        return;
      }
      const password = await askNewPassword(prompter);
      existing.passwordHash = await hashPassword(password);
      existing.tokenVersion += 1;
      await existing.save();
      console.log(`\n✓ Password reset for ${email}. Devices logged in with the old password have been signed out.`);
      return;
    }

    const name = await askValid(prompter, 'Owner name: ', adminNameField);
    const password = await askNewPassword(prompter);
    await Admin.create({ name, email, passwordHash: await hashPassword(password), role: 'admin' });
    console.log(`\n✓ Admin account created for ${email}. Log in at /admin/login`);
  } finally {
    prompter.close();
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
});
