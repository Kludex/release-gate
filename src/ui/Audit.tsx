import type { AuditRow } from "@/db/audit";
import { Empty, formatTime, link, meta, PageTitle, Section } from "@/ui/Layout";

type Props = { entries: AuditRow[] };

const th = `${meta} px-3 py-3 text-grey-600`;

export const Audit = ({ entries }: Props) => (
  <>
    <PageTitle
      title="Audit log"
      subtitle="Every webhook, vote and change on the repositories you administer."
    />
    <Section title="Latest entries">
      {entries.length === 0 ? (
        <Empty>No entries.</Empty>
      ) : (
        <div class="-mx-3 overflow-x-auto">
          <table class="w-full text-left text-base">
            <thead class="border-b-2 border-black">
              <tr>
                <th class={th}>Time</th>
                <th class={th}>Actor</th>
                <th class={th}>Action</th>
                <th class={th}>Repository</th>
                <th class={th}>Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-grey-200">
              {entries.map((entry) => (
                <tr class="align-top transition-colors hover:bg-cream">
                  <td class="whitespace-nowrap px-3 py-3">{formatTime(entry.at)}</td>
                  <td class="px-3 py-3 font-semibold">
                    {entry.actor_login ? `@${entry.actor_login}` : "github"}
                  </td>
                  <td class="whitespace-nowrap px-3 py-3 font-mono text-sm">{entry.action}</td>
                  <td class="px-3 py-3">
                    {entry.request_id ? (
                      <a href={`/requests/${entry.request_id}`} class={link}>
                        {entry.repo_full_name}
                      </a>
                    ) : (
                      entry.repo_full_name
                    )}
                  </td>
                  <td class="break-all px-3 py-3 font-mono text-xs text-grey-600">
                    {entry.details_json}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  </>
);
