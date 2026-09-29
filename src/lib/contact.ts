/** Contact form rules — shared by the browser (instant feedback) and the server (the real check). */
export const CONTACT_LIMITS = { name: 120, email: 254, message: 5000 } as const;

export type ContactInput = { name: string; email: string; message: string };
export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

export function validateContact(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();
  if (!name) errors.name = "Please enter your name.";
  else if (name.length > CONTACT_LIMITS.name)
    errors.name = `Name must be ${CONTACT_LIMITS.name} characters or fewer.`;
  if (!email) errors.email = "Please enter your email.";
  else if (email.length > CONTACT_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!message) errors.message = "Please write a message.";
  else if (message.length > CONTACT_LIMITS.message) {
    errors.message = `Message must be ${CONTACT_LIMITS.message} characters or fewer.`;
  }
  return errors;
}
