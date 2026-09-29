import * as React from "react";

import { CONTACT_LIMITS, validateContact, type ContactErrors } from "@/lib/contact";
import { submitContactFn } from "@/lib/content.functions";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * The public contact form. Same markup and classes as before; it now validates, posts to a server
 * function (which stores the message in Supabase) and shows loading / success / error states.
 */
export function ContactForm() {
  const [values, setValues] = React.useState({ name: "", email: "", message: "", website: "" });
  const [errors, setErrors] = React.useState<ContactErrors>({});
  const [status, setStatus] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState("");
  const statusRef = React.useRef<HTMLParagraphElement>(null);

  const set =
    (key: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [key]: event.target.value }));
      if (key !== "website" && errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    const found = validateContact(values);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus("error");
      setMessage("Please check the highlighted fields.");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const result = await submitContactFn({ data: values });
      if (result.ok) {
        setStatus("sent");
        setMessage("Message sent. Thank you — I'll get back to you soon.");
        setValues({ name: "", email: "", message: "", website: "" });
      } else {
        setStatus("error");
        setMessage(result.message);
        if (result.fieldErrors) setErrors(result.fieldErrors as ContactErrors);
      }
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Check your connection and try again.");
    }
    statusRef.current?.focus();
  };

  return (
    <form className="contact-form" onSubmit={onSubmit} noValidate aria-busy={status === "sending"}>
      <label>
        Name
        <input
          type="text"
          name="name"
          placeholder="Your name"
          autoComplete="name"
          maxLength={CONTACT_LIMITS.name}
          value={values.name}
          onChange={set("name")}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "cf-name-err" : undefined}
        />
        {errors.name ? (
          <span id="cf-name-err" className="contact-error">
            {errors.name}
          </span>
        ) : null}
      </label>
      <label>
        Email
        <input
          type="email"
          name="email"
          placeholder="your@email.com"
          autoComplete="email"
          maxLength={CONTACT_LIMITS.email}
          value={values.email}
          onChange={set("email")}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "cf-email-err" : undefined}
        />
        {errors.email ? (
          <span id="cf-email-err" className="contact-error">
            {errors.email}
          </span>
        ) : null}
      </label>
      <label>
        Message
        <textarea
          name="message"
          placeholder="Tell me about your project..."
          maxLength={CONTACT_LIMITS.message}
          value={values.message}
          onChange={set("message")}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "cf-message-err" : undefined}
        />
        {errors.message ? (
          <span id="cf-message-err" className="contact-error">
            {errors.message}
          </span>
        ) : null}
      </label>

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div className="contact-hp" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={set("website")}
          />
        </label>
      </div>

      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send Message"}
      </button>

      <p
        ref={statusRef}
        tabIndex={-1}
        role={status === "error" ? "alert" : "status"}
        aria-live="polite"
        className={`contact-status mono ${status === "sent" ? "is-ok" : status === "error" ? "is-error" : ""}`}
      >
        {message}
      </p>
    </form>
  );
}
