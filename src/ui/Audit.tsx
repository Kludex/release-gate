import type { AuditRow } from "@/db/audit";
import { Empty, formatTime, link, PageTitle, Section } from "@/ui/Layout";

type Props = { entries: AuditRow[] };

const th = "px-4 py-3 text-sm font-bold uppercase";

export const Audit = ({ entries }: Props) => (
  <>
    <PageTitle
      title="Audit log"
      subtitle="Every webhook, vote and change on the repositories you administer."
    />
    <Section title="Latest entries" tone="caramel">
      {entries.length === 0 ? (
        <Empty>No entries.</Empty>
      ) : (
        <div class="overflow-x-auto border-3 border-black bg-cream">
          <table class="w-full text-left">
            <thead class="border-b-3 border-black bg-milk">
              <tr>
                <th class={th}>Time (UTC)</th>
                <th class={th}>Actor</th>
                <th class={th}>Action</th>
                <th class={th}>Repository</th>
                <th class={th}>Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-black/25">
              {entries.map((entry) => (
                <tr class="align-top transition-colors hover:bg-milk">
                  <td class="whitespace-nowrap px-4 py-3">{formatTime(entry.at)}</td>
                  <td class="px-4 py-3 font-bold">
                    {entry.actor_login ? `@${entry.actor_login}` : "github"}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 font-mono text-sm">{entry.action}</td>
                  <td class="px-4 py-3">
                    {entry.request_id ? (
                      <a href={`/requests/${entry.request_id}`} class={link}>
                        {entry.repo_full_name}
                      </a>
                    ) : (
                      entry.repo_full_name
                    )}
                  </td>
                  <td class="break-all px-4 py-3 font-mono text-xs text-grey-700">
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
