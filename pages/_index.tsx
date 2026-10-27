import React, { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, ChevronRight, Clock3, Download, FileText, Search, ShieldCheck, UsersRound, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { useRealtimeQuery } from "../components/FlootRealtimeProvider";
import { channels } from "../helpers/realtimeChannels";
import { getAttendanceOverview } from "../endpoints/attendance/overview_GET.schema";
import { postAttendanceIncident } from "../endpoints/attendance/incident_POST.schema";
import { getAttendanceEmployee } from "../endpoints/attendance/employee_GET.schema";
import { updateAttendanceIncident } from "../endpoints/attendance/incident_update_POST.schema";
import { updateEmployeePhone } from "../endpoints/attendance/employee_phone_POST.schema";
import { enablePush } from "../helpers/pushClient";
import { getAttendanceExport } from "../endpoints/attendance/export_GET.schema";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import styles from "./_index.module.css";

type Employee = {
  id: number; name: string; email: string | null; position: string | null; office: string;
  incidents: number; lastIncident: string | null; status: "Good" | "Watch" | "Review";
};

type Overview = Awaited<ReturnType<typeof getAttendanceOverview>>;

function prettyDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value + (value.length === 10 ? "T12:00:00Z" : "")));
}

export default function Index() {
  const { authState, logout } = useAuth();
  const query = useRealtimeQuery<Overview>({
    queryKey: ["attendance", "overview"],
    queryFn: getAttendanceOverview,
    channel: channels.attendance(),
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showIncident, setShowIncident] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<"all" | "clear" | "watch" | "review">("all");
  const [sortKey, setSortKey] = useState<"name" | "office" | "incidents" | "lastIncident" | "status">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [employeeDetail, setEmployeeDetail] = useState<Awaited<ReturnType<typeof getAttendanceEmployee>> | null>(null);
  const [editingIncident, setEditingIncident] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState({ incidentId: 0, incidentDate: "", occurrence: "Call-Out", hoursMissed: "", employeeReason: "", classification: "pending_review", protectedLeaveReview: "no_apparent_issue", action: "none", employeeComments: "", managerNotes: "", scheduledStart: "", scheduledEnd: "", actualStart: "", actualEnd: "", noticeAt: "", noticeMethod: "", noticeTimely: "" });
  const [phoneDraft, setPhoneDraft] = useState("");
  const [form, setForm] = useState({ employeeId: "", incidentDate: new Date().toISOString().slice(0, 10), occurrence: "Call-Out", hoursMissed: "", employeeReason: "", employeeComments: "", managerNotes: "", classification: "pending_review", protectedLeaveReview: "no_apparent_issue", action: "none", scheduledStart: "", scheduledEnd: "", actualStart: "", actualEnd: "", noticeAt: "", noticeMethod: "", noticeTimely: "" });

  const employees = query.data && !("error" in query.data) ? query.data.employees : [];
  const filtered = useMemo(() => {
    const searched = employees.filter(e => (e.name + " " + e.office + " " + (e.position ?? "")).toLowerCase().includes(search.toLowerCase()));
    const statusFiltered = summaryFilter === "clear" ? searched.filter(e => e.incidents === 0) : summaryFilter === "watch" ? searched.filter(e => e.incidents === 2) : summaryFilter === "review" ? searched.filter(e => e.incidents >= 3) : searched;
    const statusRank = { Good: 0, Watch: 1, Review: 2 };
    return [...statusFiltered].sort((a, b) => {
      let av: string | number = "", bv: string | number = "";
      if (sortKey === "name") { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      if (sortKey === "office") { av = a.office.toLowerCase(); bv = b.office.toLowerCase(); }
      if (sortKey === "incidents") { av = a.incidents; bv = b.incidents; }
      if (sortKey === "lastIncident") { av = a.lastIncident ?? ""; bv = b.lastIncident ?? ""; }
      if (sortKey === "status") { av = statusRank[a.status]; bv = statusRank[b.status]; }
      if (av < bv) return sortDirection === "asc" ? -1 : 1;
      if (av > bv) return sortDirection === "asc" ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [employees, search, summaryFilter, sortKey, sortDirection]);

  const setSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDirection(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("asc"); }
  };

  const sortHeader = (label: string, column: typeof sortKey) => (
    <button className={styles.sortHeader} onClick={() => setSort(column)}>
      <span>{label}</span>
      {sortKey === column && (sortDirection === "asc" ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
    </button>
  );

  useEffect(() => {
    if (!selected) { setEmployeeDetail(null); return; }
    let active = true;
    void getAttendanceEmployee(selected.id).then(result => { if (active) { setEmployeeDetail(result); setPhoneDraft(result.employee.phone ?? ""); } }).catch(() => { if (active) setEmployeeDetail(null); });
    return () => { active = false; };
  }, [selected]);

  if (query.isPending || !query.data) return <div className={styles.loading}><div className={styles.loadingMark}>EA</div><strong>Loading attendance records…</strong><span>Securely checking your access.</span></div>;
  if ("error" in query.data) return <div className={styles.loading}><strong>{query.data.error}</strong></div>;

  const data = query.data;
  const isEmployee = false;
  const clear = employees.filter(e => e.incidents === 0).length;
  const watch = employees.filter(e => e.incidents === 2).length;
  const review = employees.filter(e => e.incidents >= 3).length;

  const saveIncident = async () => {
    if (!form.employeeId) return;
    setSaving(true);
    try {
      const result = await postAttendanceIncident({ employeeId: Number(form.employeeId), incidentDate: form.incidentDate, occurrence: form.occurrence, hoursMissed: form.hoursMissed ? Number(form.hoursMissed) : null, employeeReason: form.employeeReason || null, employeeComments: form.employeeComments || null, managerNotes: form.managerNotes || null, classification: form.classification, protectedLeaveReview: form.protectedLeaveReview, action: form.action, scheduledStart: form.scheduledStart || null, scheduledEnd: form.scheduledEnd || null, actualStart: form.actualStart || null, actualEnd: form.actualEnd || null, noticeAt: form.noticeAt || null, noticeMethod: form.noticeMethod || null, noticeTimely: form.noticeTimely || null });
      const employee = employees.find(e => e.id === Number(form.employeeId));
      const eventDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(form.incidentDate + "T12:00:00"));
      const incidentBase = new Date(form.incidentDate + "T12:00:00");
      const resetDate = new Date(incidentBase.getFullYear(), incidentBase.getMonth() < 6 ? 6 : 0, 1);
      if (incidentBase.getMonth() >= 6) resetDate.setFullYear(incidentBase.getFullYear() + 1);
      const reset = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(resetDate);
      setCopyMessage(`Employee Attendance update for ${employee?.name ?? "Employee"}: ${eventDate} — ${form.occurrence}. Your current attendance incident count for this six-month period is ${result.sixMonthCount ?? 0}. The period resets ${reset}. Questions? Please contact your office manager.`);
      setCopyStatus("");
      setSaveMessage("Incident saved. The employee message is ready to copy.");
      setShowIncident(false);
      setForm(f => ({ ...f, employeeId: "", hoursMissed: "", employeeReason: "", employeeComments: "", managerNotes: "", scheduledStart: "", scheduledEnd: "", actualStart: "", actualEnd: "", noticeAt: "", noticeMethod: "", noticeTimely: "" }));
    } finally { setSaving(false); }
  };

  const copyEmployeeMessage = async () => {
    if (!copyMessage) return;
    try {
      await navigator.clipboard.writeText(copyMessage);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Select and copy the message manually.");
    }
  };

  const downloadExport = async (format: "csv" | "json") => {
    const exported = await getAttendanceExport();
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `employee-attendance-backup-${stamp}.json`; a.click(); URL.revokeObjectURL(url);
    } else {
      const columns = ["Incident ID","Employee","Office","Incident Date","Occurrence","Hours Missed","Employee Reason","Employee Comments","Manager Notes","Classification","Protected/Leave Review","Action","Six-Month Count","Created By","Created At"];
      const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = exported.incidents.map((i: Record<string, unknown>) => [i.id,i.employeeName,i.office,i.incidentDate,i.occurrence,i.hoursMissed,i.employeeReason,i.employeeComments,i.managerNotes,i.classification,i.protectedLeaveReview,i.action,i.sixMonthCount,i.createdBy,i.createdAt].map(esc).join(","));
      const csv = [columns.map(esc).join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `employee-attendance-export-${stamp}.csv`; a.click(); URL.revokeObjectURL(url);
    }
    setShowExport(false);
  };

  const saveEdit = async () => {
    if (!editForm.incidentId) return;
    setSaving(true);
    try {
      await updateAttendanceIncident({ incidentId: editForm.incidentId, incidentDate: editForm.incidentDate, occurrence: editForm.occurrence, hoursMissed: editForm.hoursMissed ? Number(editForm.hoursMissed) : null, employeeReason: editForm.employeeReason || null, classification: editForm.classification, protectedLeaveReview: editForm.protectedLeaveReview, action: editForm.action, employeeComments: editForm.employeeComments || null, managerNotes: editForm.managerNotes || null, scheduledStart: editForm.scheduledStart || null, scheduledEnd: editForm.scheduledEnd || null, actualStart: editForm.actualStart || null, actualEnd: editForm.actualEnd || null, noticeAt: editForm.noticeAt || null, noticeMethod: editForm.noticeMethod || null, noticeTimely: editForm.noticeTimely || null });
      setEditingIncident(null);
      if (selected) { const refreshed = await getAttendanceEmployee(selected.id); setEmployeeDetail(refreshed); }
    } finally { setSaving(false); }
  };

  return (
    <div className={styles.appShell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandMark}>EA</div>
        <div className={styles.brandText}><strong>Employee</strong><span>Attendance</span></div>
        <div className={styles.sideSection}>WORKSPACE</div>
        <button className={styles.navItem + " " + styles.navActive} onClick={() => document.getElementById("attendance-overview")?.scrollIntoView({ behavior: "smooth" })}><UsersRound size={17}/> Attendance</button>
        <button className={styles.navItem} onClick={() => document.getElementById("attendance-overview")?.scrollIntoView({ behavior: "smooth" })}><CalendarDays size={17}/> Current Period</button>
        <button className={styles.navItem} onClick={() => setShowReport(true)}><FileText size={17}/> Reports</button>
        <div className={styles.sideSpacer}/>
        <div className={styles.secureNote}><ShieldCheck size={16}/><span>Confidential personnel records</span></div>
        <div className={styles.profile}><div className={styles.avatar}>{authState.type === "authenticated" ? authState.user.displayName.split(" ").map(n => n[0]).join("").slice(0,2) : "ME"}</div><div><strong>{authState.type === "authenticated" ? authState.user.displayName : "Employee"}</strong><span>{isEmployee ? "Employee" : "Manager"}</span></div></div>
        <button className={styles.logout} onClick={() => void logout()}>Sign out</button>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div><div className={styles.eyebrow}>{isEmployee ? "MY ATTENDANCE" : "ATTENDANCE MANAGEMENT"}</div><h1>{isEmployee ? data.myRecord!.name : "Attendance overview"}</h1></div>
          <div className={styles.topActions}>
            {!isEmployee && <><button className={styles.notifyButton} onClick={async () => { await enablePush(); setNotifyEnabled(true); }}><Bell size={15}/>{notifyEnabled ? "Notifications on" : "Enable alerts"}</button><button className={styles.notifyButton} onClick={() => setShowExport(true)}><Download size={15}/>Export data</button></>}
            <div className={styles.currentPeriod}><CalendarDays size={14}/> {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(data.period.start))} – {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(data.period.end))}</div>
          </div>
        </header>
        {saveMessage && <div className={styles.saveMessage}><ShieldCheck size={15}/><div className={styles.saveMessageBody}><strong>{saveMessage}</strong>{copyMessage && <div className={styles.copyMessageBox}>{copyMessage}</div>}{copyMessage && <div className={styles.copyActions}><Button size="sm" onClick={() => void copyEmployeeMessage()}>Copy message</Button>{copyStatus && <span>{copyStatus}</span>}</div>}</div><button onClick={() => { setSaveMessage(""); setCopyMessage(""); setCopyStatus(""); }}>Dismiss</button></div>}
        {showExport && <div className={styles.modalBackdrop} onClick={() => setShowExport(false)}><div className={styles.modal} onClick={e => e.stopPropagation()}><div className={styles.modalTop}><div><div className={styles.eyebrow}>DATA EXPORT</div><h2>Export attendance data</h2><p>Download a copy of the attendance records for backup or use in another system.</p></div><button className={styles.close} onClick={() => setShowExport(false)}>×</button></div><div className={styles.exportOptions}><button onClick={() => void downloadExport("csv")}><strong>CSV export</strong><span>Easy to open in Excel or Google Sheets. Includes all attendance incidents and employee/office details.</span></button><button onClick={() => void downloadExport("json")}><strong>JSON backup</strong><span>Full structured backup of employees, offices, and attendance incidents. Best for restoring or moving data later.</span></button></div><div className={styles.modalActions}><Button variant="outline" onClick={() => setShowExport(false)}>Cancel</Button></div></div></div>}

        {
          <>
            <section className={styles.summaryGrid}>
              <button className={styles.summaryCard + (summaryFilter === "all" ? " " + styles.summarySelected : "")} onClick={() => setSummaryFilter("all")}><div className={styles.summaryIcon}><UsersRound size={18}/></div><span>Employees</span><strong>{employees.length}</strong><small>Show all employees</small></button>
              <button className={styles.summaryCard + (summaryFilter === "clear" ? " " + styles.summarySelected : "")} onClick={() => setSummaryFilter("clear")}><div className={styles.summaryIcon}><ShieldCheck size={18}/></div><span>No incidents</span><strong>{clear}</strong><small>Show employees with 0 incidents</small></button>
              <button className={styles.summaryCard + (summaryFilter === "watch" ? " " + styles.summarySelected : "")} onClick={() => setSummaryFilter("watch")}><div className={styles.summaryIcon}><Clock3 size={18}/></div><span>At 2 incidents</span><strong>{watch}</strong><small>Show employees at 2 incidents</small></button>
              <button className={styles.summaryCard + (review ? " " + styles.alertCard : "") + (summaryFilter === "review" ? " " + styles.summarySelected : "")} onClick={() => setSummaryFilter("review")}><div className={styles.summaryIcon}><Bell size={18}/></div><span>Formal review</span><strong>{review}</strong><small>Show employees at 3+ incidents</small></button>
            </section>

            <section id="attendance-overview" className={styles.contentGrid}>
              <div className={styles.card}>
                <div className={styles.cardHeader}><div><div className={styles.eyebrow}>LIVE EMPLOYEE RECORDS</div><h2>Attendance overview</h2></div><Button size="sm" onClick={() => setShowIncident(true)}>+ Add incident</Button></div>
                <div className={styles.toolbar}><div className={styles.search}><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee, office, or position"/></div><span className={styles.period}><CalendarDays size={15}/> {summaryFilter === "all" ? "All employees" : summaryFilter === "clear" ? "0 incidents" : summaryFilter === "watch" ? "2 incidents" : "Formal review (3+)"} · {filtered.length} shown</span></div>
                <div className={styles.tableWrap}><table><thead><tr><th>{sortHeader("Employee","name")}</th><th>{sortHeader("Office","office")}</th><th>{sortHeader("Current period","incidents")}</th><th>{sortHeader("Last incident","lastIncident")}</th><th>{sortHeader("Status","status")}</th><th/></tr></thead><tbody>{filtered.map(employee => <tr key={employee.id} onClick={() => setSelected(employee)} style={{cursor:"pointer"}}><td><div className={styles.person}><div className={styles.tableAvatar}>{employee.name.split(" ").map(n => n[0]).join("")}</div><div><strong>{employee.name}</strong><span>{employee.position ?? "—"}</span></div></div></td><td>{employee.office}</td><td><strong>{employee.incidents}</strong> <span className={styles.muted}>incident{employee.incidents === 1 ? "" : "s"}</span></td><td>{prettyDate(employee.lastIncident)}</td><td><Badge variant={employee.status === "Review" ? "destructive" : employee.status === "Watch" ? "warning" : "success"}>{employee.status}</Badge></td><td><div className={styles.rowActions}><Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setForm(f => ({...f, employeeId: String(employee.id)})); setShowIncident(true); }}>Add incident</Button><button className={styles.iconAction} onClick={e => { e.stopPropagation(); setSelected(employee); }} aria-label="Open employee record"><ChevronRight size={17}/></button></div></td></tr>)}</tbody></table></div>
              </div>
              <div className={styles.sideColumn}>
                <div className={styles.card}><div className={styles.cardHeader}><div><div className={styles.eyebrow}>RECENT ACTIVITY</div><h2>Latest incidents</h2></div></div>{data.recentIncidents.length === 0 ? <div className={styles.emptyState}>No incidents yet.</div> : data.recentIncidents.map(item => <div className={styles.activity} key={item.id}><div className={styles.activityIcon}><Clock3 size={15}/></div><div className={styles.activityBody}><strong>{item.employee}</strong><span>{item.type} · {prettyDate(item.date)}</span><small>Incident #{item.count ?? "—"} · {item.manager}</small></div></div>)}</div>
                <div className={styles.infoPanel}><div className={styles.infoIcon}><ShieldCheck size={19}/></div><div><strong>Six-month reset</strong><p>Attendance records automatically reset on January 1 and July 1.</p></div></div>
                <div className={styles.statusLegend}>
                  <div className={styles.eyebrow}>STATUS LEGEND</div>
                  <div className={styles.legendItem}><Badge variant="success">Good</Badge><span>0–1 attendance incidents</span></div>
                  <div className={styles.legendItem}><Badge variant="warning">Watch</Badge><span>2 attendance incidents</span></div>
                  <div className={styles.legendItem}><Badge variant="destructive">Review</Badge><span>3 or more attendance incidents</span></div>
                </div>
              </div>
            </section>
          </>
        }

        {selected && <div className={styles.modalBackdrop} onClick={() => setSelected(null)}><div className={styles.modal} onClick={e => e.stopPropagation()}><div className={styles.modalTop}><div><div className={styles.eyebrow}>EMPLOYEE RECORD</div><h2>{selected.name}</h2><p>{selected.position} · {selected.office}</p></div><button className={styles.close} onClick={() => setSelected(null)}>×</button></div><div className={styles.recordStats}><div><span>Current incidents</span><strong>{selected.incidents}</strong></div><div><span>Next reset</span><strong>{prettyDate(data.period.nextReset)}</strong></div><div><span>Status</span><Badge variant={selected.status === "Review" ? "destructive" : selected.status === "Watch" ? "warning" : "success"}>{selected.status}</Badge></div></div><div className={styles.smsSettings}><div><strong>Employee mobile</strong><span>Saved here for future texting options. No automatic text is sent.</span></div><div className={styles.phoneEdit}><input value={phoneDraft} onChange={e => setPhoneDraft(e.target.value)} placeholder="(206) 555-0123"/><Button size="sm" variant="outline" onClick={async () => { await updateEmployeePhone({ employeeId: selected.id, phone: phoneDraft.trim() || null }); const refreshed = await getAttendanceEmployee(selected.id); setEmployeeDetail(refreshed); setSaveMessage("Employee mobile number updated."); }}>Save</Button></div></div><div className={styles.cardInner}><h3>Attendance history</h3>{!employeeDetail ? <div className={styles.emptyState}>Loading record…</div> : employeeDetail.employee.incidents.length === 0 ? <div className={styles.emptyState}>No incidents in the current period.</div> : employeeDetail.employee.incidents.map((incident, i) => <div className={styles.historyRow} key={String(incident.id ?? i)}><div><strong>{prettyDate(String(incident.incidentDate ?? ""))} · {String(incident.occurrence ?? "")}</strong><span>{String(incident.classification) === "unprotected_attendance_incident" ? "Attendance Incident" : "Pending / protected review"} · {String(incident.action ?? "None")}</span><div className={styles.historyDetails}><span><b>Hours missed:</b> {incident.hoursMissed == null ? "—" : String(incident.hoursMissed)}</span><span><b>Employee reason:</b> {String(incident.employeeReason ?? "—")}</span><span><b>Employee comments:</b> {String(incident.employeeComments ?? "—")}</span><span><b>Manager notes:</b> {String(incident.managerNotes ?? "—")}</span><span><b>Protected/leave review:</b> {String(incident.protectedLeaveReview ?? "—")}</span><span><b>Incident count:</b> {String(incident.sixMonthCount ?? "—")}</span></div></div><Button size="sm" variant="outline" onClick={() => { setEditingIncident(incident); setEditForm({ incidentId: Number(incident.id), incidentDate: String(incident.incidentDate).slice(0,10), occurrence: String(incident.occurrence ?? "Call-Out"), hoursMissed: incident.hoursMissed == null ? "" : String(incident.hoursMissed), employeeReason: String(incident.employeeReason ?? ""), classification: String(incident.classification ?? "pending_review"), protectedLeaveReview: String(incident.protectedLeaveReview ?? "no_apparent_issue"), action: String(incident.action ?? "none"), employeeComments: String(incident.employeeComments ?? ""), managerNotes: String(incident.managerNotes ?? ""), scheduledStart: String(incident.scheduledStart ?? ""), scheduledEnd: String(incident.scheduledEnd ?? ""), actualStart: String(incident.actualStart ?? ""), actualEnd: String(incident.actualEnd ?? ""), noticeAt: String(incident.noticeAt ?? ""), noticeMethod: String(incident.noticeMethod ?? ""), noticeTimely: String(incident.noticeTimely ?? "") }); }}>Edit</Button></div>)}</div></div></div>}

        {showReport && <div className={styles.modalBackdrop} onClick={() => setShowReport(false)}><div className={styles.modal} onClick={e => e.stopPropagation()}><div className={styles.modalTop}><div><div className={styles.eyebrow}>CURRENT PERIOD REPORT</div><h2>Attendance report</h2><p>{prettyDate(data.period.start)} – {prettyDate(data.period.end)}</p></div><button className={styles.close} onClick={() => setShowReport(false)}>×</button></div><div className={styles.recordStats}><div><span>Employees</span><strong>{employees.length}</strong></div><div><span>No incidents</span><strong>{clear}</strong></div><div><span>At review</span><strong>{review}</strong></div></div><div className={styles.cardInner}><h3>Employee status</h3>{employees.map(employee => <div className={styles.employeeIncident} key={employee.id}><div><strong>{employee.name}</strong><span>{employee.office} · {employee.incidents} incident{employee.incidents === 1 ? "" : "s"}</span></div><Badge variant={employee.status === "Review" ? "destructive" : employee.status === "Watch" ? "warning" : "success"}>{employee.status}</Badge></div>)}</div><div className={styles.modalActions}><Button variant="outline" onClick={() => window.print()}>Print report</Button><Button onClick={() => setShowReport(false)}>Close</Button></div></div></div>}

        {editingIncident && <div className={styles.modalBackdrop} onClick={() => !saving && setEditingIncident(null)}><div className={styles.modal} onClick={e => e.stopPropagation()}><div className={styles.modalTop}><div><div className={styles.eyebrow}>EDIT DOCUMENTATION</div><h2>Edit attendance incident</h2><p>Changes are recorded in the audit history.</p></div><button className={styles.close} onClick={() => !saving && setEditingIncident(null)}>×</button></div><div className={styles.formGrid}><label>Date<input type="date" value={editForm.incidentDate} onChange={e => setEditForm(f => ({...f, incidentDate:e.target.value}))}/></label><label>Occurrence<select value={editForm.occurrence} onChange={e => setEditForm(f => ({...f, occurrence:e.target.value}))}><option>Call-Out</option><option>Late</option><option>Left Early</option><option>No-Call/No-Show</option><option>Notice Issue</option><option>Other</option></select></label><label>Hours missed<input value={editForm.hoursMissed} onChange={e => setEditForm(f => ({...f, hoursMissed:e.target.value}))}/></label><label>Classification<select value={editForm.classification} onChange={e => setEditForm(f => ({...f, classification:e.target.value}))}><option value="pending_review">Pending review</option><option value="unprotected_attendance_incident">Attendance incident</option><option value="protected_approved">Protected / approved</option><option value="other">Other</option></select></label><label>Action<select value={editForm.action} onChange={e => setEditForm(f => ({...f, action:e.target.value}))}><option value="none">None</option><option value="coaching">Coaching</option><option value="verbal_warning">Verbal warning</option><option value="written_warning">Written warning</option><option value="final_warning">Final warning</option><option value="leave_accommodation_review">Leave / accommodation review</option><option value="further_review">Further review</option></select></label><label className={styles.full}>Employee reason<textarea value={editForm.employeeReason} onChange={e => setEditForm(f => ({...f, employeeReason:e.target.value}))}/></label><label className={styles.full}>Manager notes<textarea value={editForm.managerNotes} onChange={e => setEditForm(f => ({...f, managerNotes:e.target.value}))}/></label><label className={styles.full}>Employee comments<textarea value={editForm.employeeComments} onChange={e => setEditForm(f => ({...f, employeeComments:e.target.value}))}/></label></div><div className={styles.reviewBox}><strong>Protected / leave review</strong><div className={styles.checkGrid}><label><input type="radio" name="editProtected" checked={editForm.protectedLeaveReview === "no_apparent_issue"} onChange={() => setEditForm(f => ({...f, protectedLeaveReview:"no_apparent_issue"}))}/> No apparent issue</label><label><input type="radio" name="editProtected" checked={editForm.protectedLeaveReview === "wa_paid_sick_leave"} onChange={() => setEditForm(f => ({...f, protectedLeaveReview:"wa_paid_sick_leave"}))}/> WA Paid Sick Leave</label><label><input type="radio" name="editProtected" checked={editForm.protectedLeaveReview === "pfml_fmla"} onChange={() => setEditForm(f => ({...f, protectedLeaveReview:"pfml_fmla"}))}/> PFML / FMLA</label><label><input type="radio" name="editProtected" checked={editForm.protectedLeaveReview === "accommodation"} onChange={() => setEditForm(f => ({...f, protectedLeaveReview:"accommodation"}))}/> Accommodation</label><label><input type="radio" name="editProtected" checked={editForm.protectedLeaveReview === "pregnancy"} onChange={() => setEditForm(f => ({...f, protectedLeaveReview:"pregnancy"}))}/> Pregnancy</label><label><input type="radio" name="editProtected" checked={editForm.protectedLeaveReview === "dv_safety"} onChange={() => setEditForm(f => ({...f, protectedLeaveReview:"dv_safety"}))}/> DV / Safety</label><label><input type="radio" name="editProtected" checked={editForm.protectedLeaveReview === "military_jury_civic"} onChange={() => setEditForm(f => ({...f, protectedLeaveReview:"military_jury_civic"}))}/> Military / Jury / Civic</label><label><input type="radio" name="editProtected" checked={editForm.protectedLeaveReview === "unsure_hr_review"} onChange={() => setEditForm(f => ({...f, protectedLeaveReview:"unsure_hr_review"}))}/> Unsure — HR review</label></div></div><div className={styles.modalActions}><Button variant="outline" disabled={saving} onClick={() => setEditingIncident(null)}>Cancel</Button><Button disabled={saving} onClick={() => void saveEdit()}>{saving ? "Saving…" : "Save changes"}</Button></div></div></div>}

        {showIncident && <div className={styles.modalBackdrop} onClick={() => !saving && setShowIncident(false)}><div className={styles.modal} onClick={e => e.stopPropagation()}><div className={styles.modalTop}><div><div className={styles.eyebrow}>NEW DOCUMENTATION</div><h2>Add attendance incident</h2><p>Record the occurrence and complete the protected-leave review before classification.</p></div><button className={styles.close} onClick={() => !saving && setShowIncident(false)}>×</button></div><div className={styles.formGrid}><label>Employee<select value={form.employeeId} onChange={e => setForm(f => ({...f, employeeId:e.target.value}))}><option value="">Select employee…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>Date<input type="date" value={form.incidentDate} onChange={e => setForm(f => ({...f, incidentDate:e.target.value}))}/></label><label>Occurrence<select value={form.occurrence} onChange={e => setForm(f => ({...f, occurrence:e.target.value}))}><option>Call-Out</option><option>Late</option><option>Left Early</option><option>No-Call/No-Show</option><option>Notice Issue</option><option>Other</option></select></label><label>Hours missed<input value={form.hoursMissed} onChange={e => setForm(f => ({...f, hoursMissed:e.target.value}))} placeholder="e.g. 4"/></label><label>Classification<select value={form.classification} onChange={e => setForm(f => ({...f, classification:e.target.value}))}><option value="pending_review">Pending review</option><option value="unprotected_attendance_incident">Attendance incident</option><option value="protected_approved">Protected / approved</option><option value="other">Other</option></select></label><label>Action<select value={form.action} onChange={e => setForm(f => ({...f, action:e.target.value}))}><option value="none">None</option><option value="coaching">Coaching</option><option value="verbal_warning">Verbal warning</option><option value="written_warning">Written warning</option><option value="final_warning">Final warning</option><option value="leave_accommodation_review">Leave / accommodation review</option><option value="further_review">Further review</option></select></label><label className={styles.full}>Employee reason<textarea value={form.employeeReason} onChange={e => setForm(f => ({...f, employeeReason:e.target.value}))} placeholder="Record the employee's stated reason without unnecessary medical details."/></label><label className={styles.full}>Employee comments<textarea value={form.employeeComments} onChange={e => setForm(f => ({...f, employeeComments:e.target.value}))} placeholder="Comments from the employee."/></label><label className={styles.full}>Manager notes<textarea value={form.managerNotes} onChange={e => setForm(f => ({...f, managerNotes:e.target.value}))} placeholder="Manager documentation or follow-up."/></label></div><div className={styles.reviewBox}><strong>Protected / leave review</strong><div className={styles.checkGrid}><label><input type="radio" name="protected" checked={form.protectedLeaveReview === "no_apparent_issue"} onChange={() => setForm(f => ({...f, protectedLeaveReview:"no_apparent_issue"}))}/> No apparent issue</label><label><input type="radio" name="protected" checked={form.protectedLeaveReview === "wa_paid_sick_leave"} onChange={() => setForm(f => ({...f, protectedLeaveReview:"wa_paid_sick_leave"}))}/> WA Paid Sick Leave</label><label><input type="radio" name="protected" checked={form.protectedLeaveReview === "pfml_fmla"} onChange={() => setForm(f => ({...f, protectedLeaveReview:"pfml_fmla"}))}/> PFML / FMLA</label><label><input type="radio" name="protected" checked={form.protectedLeaveReview === "accommodation"} onChange={() => setForm(f => ({...f, protectedLeaveReview:"accommodation"}))}/> Accommodation</label><label><input type="radio" name="protected" checked={form.protectedLeaveReview === "pregnancy"} onChange={() => setForm(f => ({...f, protectedLeaveReview:"pregnancy"}))}/> Pregnancy</label><label><input type="radio" name="protected" checked={form.protectedLeaveReview === "dv_safety"} onChange={() => setForm(f => ({...f, protectedLeaveReview:"dv_safety"}))}/> DV / Safety</label><label><input type="radio" name="protected" checked={form.protectedLeaveReview === "military_jury_civic"} onChange={() => setForm(f => ({...f, protectedLeaveReview:"military_jury_civic"}))}/> Military / Jury / Civic</label><label><input type="radio" name="protected" checked={form.protectedLeaveReview === "unsure_hr_review"} onChange={() => setForm(f => ({...f, protectedLeaveReview:"unsure_hr_review"}))}/> Unsure — HR review</label></div></div><div className={styles.modalActions}><Button variant="outline" disabled={saving} onClick={() => setShowIncident(false)}>Cancel</Button><Button disabled={saving || !form.employeeId} onClick={() => void saveIncident()}>{saving ? "Saving…" : "Save incident"}</Button></div></div></div>}
      </main>
    </div>
  );
}
