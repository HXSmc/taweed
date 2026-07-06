import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getRules, getAuditLog } from "@/lib/data";
import { capability } from "@/lib/rbac";
import { getTenantPayers, listAuthoredRules } from "@/lib/rules-data";
import { PageHeader } from "@/components/shell/page-header";
import { RuleAuthoring } from "@/components/modules/rule-authoring";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireSession(locale);
  const t = await getTranslations("settings");
  const tr = await getTranslations("trust");
  const ts = await getTranslations("scrubber");

  // AI-3: only roles that can write rules (rcm='rules', owner/admin='full') see the
  // authoring surface. The server action re-enforces this — the tab is UX only.
  const canAuthor = ["full", "rules"].includes(capability(session.role, "settings"));

  const [rules, audit, payers, authoredRules] = await Promise.all([
    getRules(session.tenantId),
    getAuditLog(session.tenantId),
    canAuthor ? getTenantPayers(session.tenantId) : Promise.resolve([]),
    canAuthor ? listAuthoredRules(session.tenantId) : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title={t("title")} />
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">{t("rules")}</TabsTrigger>
          {canAuthor && <TabsTrigger value="author">{t("author")}</TabsTrigger>}
          <TabsTrigger value="audit">{t("audit")}</TabsTrigger>
          <TabsTrigger value="residency">{t("residency")}</TabsTrigger>
        </TabsList>

        {canAuthor && (
          <TabsContent value="author">
            <RuleAuthoring payers={payers} authoredRules={authoredRules} />
          </TabsContent>
        )}

        <TabsContent value="rules">
          <Card>
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>{ts("ruleLabel")}</TH>
                    <TH>{ts("severity")}</TH>
                    <TH>Scope</TH>
                    <TH className="text-end">{ts("version")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {rules.map((r) => (
                    <TR key={r.id}>
                      <TD>{locale === "ar" ? r.message_ar : r.message_en}</TD>
                      <TD>
                        <Badge variant={r.severity === "high" ? "atRisk" : "neutral"}>
                          {r.severity}
                        </Badge>
                      </TD>
                      <TD className="mono text-label text-muted">{r.scope}</TD>
                      <TD className="text-end num text-muted">v{r.version}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>{t("auditActor")}</TH>
                    <TH>{t("auditAction")}</TH>
                    <TH>{t("auditEntity")}</TH>
                    <TH>{t("auditWhen")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {audit.map((a) => (
                    <TR key={a.id}>
                      <TD className="mono text-label">{a.actor}</TD>
                      <TD>
                        <Badge variant={a.action === "export" ? "accent" : "neutral"}>
                          {a.action}
                        </Badge>
                      </TD>
                      <TD className="mono text-label text-muted">
                        {a.entity}
                        {a.entity_id ? `:${a.entity_id.slice(0, 12)}` : ""}
                      </TD>
                      <TD className="num text-label text-muted">
                        {a.at ? new Date(a.at).toISOString().slice(0, 19).replace("T", " ") : "—"}
                      </TD>
                    </TR>
                  ))}
                  {audit.length === 0 && (
                    <TR>
                      <TD className="text-muted">{tr("everyAccessLogged")}</TD>
                      <TD /> <TD /> <TD />
                    </TR>
                  )}
                </TBody>
              </Table>
            </TableWrap>
          </Card>
        </TabsContent>

        <TabsContent value="residency">
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <p className="flex items-center gap-2 text-h3 font-medium">
                <ShieldCheck className="size-5 text-money-neutral" />
                {tr("residency")}
              </p>
              <p className="text-body text-muted">{tr("notDevice")}</p>
              <p className="text-body text-muted">{tr("everyAccessLogged")}</p>
              <p className="mt-2 border-t border-hairline pt-3 text-label text-muted">
                {t("digitNote")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
