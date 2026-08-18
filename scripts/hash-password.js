// Manual password reset helper — there's no self-serve "forgot password"
// flow (no email system), so if someone loses access, this is how you help
// them: hash a new password here, then paste the hash into an UPDATE in
// Neon's SQL Editor.
//
// Usage:
//   node scripts/hash-password.js <new-password>
//
// Then in Neon's SQL Editor:
//   UPDATE users SET password_hash = '<hash printed below>'
//   WHERE username = '<their username>';

const bcrypt = require("bcryptjs");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <new-password>");
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log(hash);
});
