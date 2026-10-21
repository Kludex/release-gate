import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

type Ceremony = { challengeId: string; options: never };
type Result = { error?: string; message?: string; redirect?: string; registration?: Ceremony };

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed with HTTP ${response.status}`);
  return data;
}

async function submit(form: HTMLFormElement): Promise<Result> {
  const fields: Record<string, unknown> = Object.fromEntries(new FormData(form));
  let body = fields;
  if (form.dataset.challenge) {
    const { challengeId, options } = await post<Ceremony>(form.dataset.challenge, fields);
    body = {
      ...fields,
      challengeId,
      response: await startAuthentication({ optionsJSON: options }),
    };
  }
  // Not `form.action`: a field named "action" would shadow it.
  const result = await post<Result>(form.getAttribute("action") as string, body);
  if (!result.registration) return result;
  const { challengeId, options } = result.registration;
  const response = await startRegistration({ optionsJSON: options });
  return post<Result>("/passkeys/register/verify", { challengeId, response, name: fields.name });
}

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !("passkey" in form.dataset)) return;
  event.preventDefault();
  const output = form.querySelector<HTMLElement>("[data-output]");
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button) button.disabled = true;
  if (output) output.textContent = "Waiting for your passkey…";
  try {
    const result = await submit(form);
    if (result.redirect) window.location.assign(result.redirect);
    else if (output) output.textContent = result.message ?? "Done.";
  } catch (error) {
    if (output) output.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    if (button) button.disabled = false;
  }
});
