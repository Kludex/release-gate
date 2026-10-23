import { link } from "@/ui/Layout";

const WORKFLOW = `on:
  push:
    tags: ["v*"]

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: pypi`;

export const ConnectGuide = ({ repo }: { repo?: string }) => (
  <>
    <button type="button" popovertarget="connect" class={`${link} cursor-pointer text-xl`}>
      How do I connect a workflow?
    </button>
    <div
      id="connect"
      popover="auto"
      class="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl backdrop:bg-black/40 md:p-10"
    >
      <div class="mb-6 flex items-baseline justify-between gap-4">
        <h2 class="text-2xl font-bold lg:text-3xl">Connect a workflow</h2>
        <button
          type="button"
          popovertarget="connect"
          popovertargetaction="hide"
          class={`${link} cursor-pointer text-lg`}
        >
          Close
        </button>
      </div>
      <ol class="max-w-[60ch] list-decimal space-y-5 pl-6 text-xl leading-relaxed marker:font-bold">
        <li>
          Run the publishing job on a tag push, in an environment:
          <pre class="mt-3 overflow-x-auto rounded-2xl bg-cream p-5 font-mono text-base leading-snug">
            {WORKFLOW}
          </pre>
        </li>
        <li>
          {repo ? (
            <>
              In{" "}
              <a href={`https://github.com/${repo}/settings/environments`} class={link}>
                the repository's environments
              </a>
              ,
            </>
          ) : (
            <>
              In the repository's <strong>Settings → Environments</strong>,
            </>
          )}{" "}
          open that environment. Under <strong>Deployment protection rules</strong>, check the
          release-gate app and turn off <strong>Allow administrators to bypass</strong>.
        </li>
        <li>Push a tag. The job waits here until approvers confirm with a passkey.</li>
      </ol>
    </div>
  </>
);
