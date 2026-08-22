// Matches the spec requirement ("Password must follow security rules"):
// at least 8 characters, one uppercase, one lowercase, one digit.
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const getPasswordError = (password) => {
  if (!password || typeof password !== "string") {
    return "Password is required";
  }
  if (!PASSWORD_RULE.test(password)) {
    return "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number";
  }
  return null;
};
