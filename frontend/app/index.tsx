import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { api, ApiUser, clearToken, loadToken, setToken } from "@/src/api";

// ---------------------------------------------------------------------------
// Teleconi Tracker — faithful mockup of Telecony_Ops_Tracker_Draft29.html
// ---------------------------------------------------------------------------

const C = {
  blue: "#1769E0",
  blueDark: "#0F4FB0",
  paleBlue: "#E7F0FD",
  text: "#0F1B2D",
  muted: "#6B7A90",
  bg: "#EEF2F7",
  white: "#FFFFFF",
  line: "#E3E9F0",
  track: "#E6ECF3",
  green: "#12B76A",
  greenBg: "#E7F7EF",
  red: "#E5484D",
  redBg: "#FDECEC",
};

type Screen = "dashboard" | "po" | "operational" | "users" | "password";

const TABS: { id: Screen; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "po", label: "PO & Invoice", icon: "documents" },
  { id: "operational", label: "Submit Ops", icon: "add-circle" },
  { id: "users", label: "Employee", icon: "people" },
];

const DEMO_ACCOUNTS = [
  { role: "Owner", cred: "00101 / 123" },
  { role: "PM", cred: "00201 / 123" },
  { role: "Engineer", cred: "00202 / 123" },
];

type SessionUser = {
  employeeId: string;
  name: string;
  role: string;
  ktp: string;
  bpjs: string;
  address: string;
  gaji: string;
  bank: string;
  noRek: string;
  joinDate: string;
};

const fromApi = (u: ApiUser): SessionUser => ({
  employeeId: u.employee_id, name: u.name, role: u.role, ktp: u.ktp, bpjs: u.bpjs,
  address: u.address, gaji: u.gaji, bank: u.bank, noRek: u.no_rek, joinDate: u.join_date,
});

const initials = (name: string) => name.trim().split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

// ---------------------------------------------------------------------------
// Reusable primitives
// ---------------------------------------------------------------------------

function Card({ children, style }: any) {
  return <View style={[styles.card, style]}>{children}</View>;
}
function Muted({ children, style }: any) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}
function Label({ children }: any) {
  return <Text style={styles.label}>{children}</Text>;
}
function Input({ value, onChangeText, placeholder, secureTextEntry, readOnly, keyboardType, testID }: any) {
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9AA7B8"
      secureTextEntry={secureTextEntry}
      editable={!readOnly}
      keyboardType={keyboardType}
      style={[styles.input, readOnly && styles.inputReadonly]}
    />
  );
}
function BarTrack({ pct, color = C.blue }: { pct: number; color?: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}
function StatusPill({ paid, onPress, testID }: { paid: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.statusPill, paid ? styles.statusPaid : styles.statusUnpaid]}>
      <Text style={[styles.statusText, { color: paid ? C.green : C.red }]}>{paid ? "Terbayar" : "Belum"}</Text>
    </Pressable>
  );
}

function Select({ value, options, onSelect, testID }: { value: string; options: string[]; onSelect: (v: string) => void; testID?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable testID={testID} onPress={() => setOpen(true)} style={styles.select}>
        <Text style={styles.selectText}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color={C.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.pickerSheet}>
            {options.map((opt) => (
              <Pressable
                key={opt}
                testID={`option-${opt}`}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
                style={styles.pickerRow}
              >
                <Text style={[styles.pickerText, opt === value && { color: C.blue, fontWeight: "800" }]}>{opt}</Text>
                {opt === value && <Ionicons name="checkmark" size={18} color={C.blue} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Toast({ text }: { text: string | null }) {
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View style={[styles.toastWrap, { bottom: insets.bottom + 96, pointerEvents: "none" }]}>
      <View style={styles.toast}>
        <Ionicons name="checkmark-circle" size={18} color="#7CE0AE" />
        <Text style={styles.toastText}>{text}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function Login({ onLogin }: { onLogin: (u: SessionUser) => void }) {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const id = user.trim();
    if (!id || !pass) {
      setError("Masukkan Username / Employee ID dan Password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { access_token } = await api.login(id, pass);
      await setToken(access_token);
      const me = await api.me();
      onLogin(fromApi(me));
    } catch (e: any) {
      setError(e?.message || "Employee ID atau Password salah.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={styles.loginScreen}
      contentContainerStyle={[styles.loginContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
      bottomOffset={24}
    >
      <View style={styles.logoBox}>
        <Ionicons name="pulse" size={30} color={C.white} />
      </View>
      <Text style={styles.loginBrand}>Teleconi Tracker</Text>
      <Muted style={styles.loginTagline}>Project Delivery & Employee Management</Muted>

      <Card style={styles.loginCard}>
        <Label>Username / Employee ID</Label>
        <Input testID="login-user-input" value={user} onChangeText={setUser} placeholder="Contoh: 00101" />
        <View style={{ height: 12 }} />
        <Label>Password</Label>
        <Input testID="login-pass-input" value={pass} onChangeText={setPass} placeholder="Password" secureTextEntry />
        {error ? <Text testID="login-error" style={styles.errorText}>{error}</Text> : null}
        <Pressable testID="login-button" onPress={submit} disabled={loading} style={({ pressed }) => [styles.primaryBtn, { marginTop: 18 }, loading && { opacity: 0.7 }, pressed && styles.pressed]}>
          {loading ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryBtnText}>Login</Text>}
        </Pressable>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Demo Accounts</Text>
          {DEMO_ACCOUNTS.map((d) => (
            <Text key={d.role} style={styles.demoLine}>
              {d.role}: {d.cred}
            </Text>
          ))}
        </View>
      </Card>
    </KeyboardAwareScrollView>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const fmtM = (n: number) => {
  const r = Math.round((n / 1_000_000) * 10) / 10;
  return `Rp${String(r).replace(".", ",")}M`;
};
const fmtFull = (n: number) => `Rp ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

const postIcon = (post: string): keyof typeof Ionicons.glyphMap => {
  if (!post) return "cash-outline";
  if (post.startsWith("3")) return "bed-outline";
  if (post.startsWith("4")) return "car-outline";
  if (post.startsWith("5")) return "construct-outline";
  if (post.startsWith("6")) return "document-text-outline";
  return "cash-outline";
};

function Loading() {
  return <Card style={{ alignItems: "center", paddingVertical: 40 }}><ActivityIndicator color={C.blue} /></Card>;
}

function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<string[]>(["All Project"]);
  const [project, setProject] = useState("All Project");

  const fetchData = async (proj: string) => {
    setLoading(true);
    try {
      const d = await api.dashboard(proj);
      setData(d);
      if (d.projects?.length) setOptions(["All Project", ...d.projects]);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { fetchData("All Project"); }, []);

  const onProject = (p: string) => { setProject(p); fetchData(p); };

  return (
    <>
      <Card style={styles.filterCard}>
        <Label>Project</Label>
        <Select testID="dashboard-project-filter" value={project} options={options} onSelect={onProject} />
      </Card>

      {loading || !data ? <Loading /> : <DashboardBody data={data} project={project} />}
    </>
  );
}

function DashboardBody({ data, project }: { data: any; project: string }) {
  const remainingBudget = data.total_budget - data.total_actual;
  const trendMax = Math.max(...data.trend.map((t: any) => t.total), 1);

  return (
    <>
      <Card style={styles.heroCard}>
        <Muted style={{ color: "#C7D6EA" }}>Project Profitability</Muted>
        <View style={styles.profitGrid}>
          <View style={styles.profitItem}>
            <Text style={styles.profitLabel}>Total Profit</Text>
            <Text testID="dashboard-total-profit" style={styles.profitValue}>{fmtM(data.total_profit)}</Text>
            <Text style={styles.profitSub}>PO Value − Actual Cost</Text>
          </View>
          <View style={styles.profitItem}>
            <Text style={styles.profitLabel}>Profit Margin</Text>
            <Text style={styles.profitValue}>{String(data.profit_margin).replace(".", ",")}%</Text>
            <Text style={styles.profitSub}>Profit ÷ PO Value</Text>
          </View>
        </View>
        <Muted style={{ color: "#C7D6EA", marginTop: 6 }}>{project === "All Project" ? "All projects" : project}</Muted>
      </Card>

      <View style={styles.statGrid}>
        {[
          { label: "PO Value", value: fmtM(data.total_po), note: "Nilai project dari customer" },
          { label: "Cost Budget", value: fmtM(data.total_budget), note: "Budget internal operational" },
          { label: "Actual Cost", value: fmtM(data.total_actual), note: "Pengeluaran aktual" },
          { label: "Remaining Cost Budget", value: fmtM(remainingBudget), note: "Budget − Actual Cost" },
        ].map((s) => (
          <Card key={s.label} style={styles.statCard}>
            <Muted>{s.label}</Muted>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.kpiNote}>{s.note}</Text>
          </Card>
        ))}
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.h2}>Budget Utilization</Text>
          <Text style={styles.h2}>{String(data.budget_utilization).replace(".", ",")}%</Text>
        </View>
        <BarTrack pct={Math.min(data.budget_utilization, 100)} />
        <Muted>Actual {fmtM(data.total_actual)} / Budget {fmtM(data.total_budget)}</Muted>
      </Card>

      <Card>
        <Text style={styles.h2}>Project Financial Summary</Text>
        <View style={styles.finHeader}>
          {["Project", "PO", "Budget", "Actual", "Remaining"].map((h, i) => (
            <Text key={h} style={[styles.finHeadCell, i === 0 && styles.finCellFirst]}>{h}</Text>
          ))}
        </View>
        {data.summary.map((r: any) => (
          <View key={r.project_name} style={styles.finRow}>
            <Text style={[styles.finCell, styles.finCellFirst, styles.finProject]}>{r.project_name}</Text>
            <Text style={styles.finCell}>{fmtM(r.po_amount)}</Text>
            <Text style={styles.finCell}>{fmtM(r.budget)}</Text>
            <Text style={styles.finCell}>{fmtM(r.actual_cost)}</Text>
            <Text style={[styles.finCell, styles.finRemaining]}>{fmtM(r.remaining)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.h2}>Monthly Cost Trend</Text>
        <View style={styles.chart}>
          {data.trend.map((b: any) => (
            <View key={b.month} style={styles.barCol}>
              <View style={styles.barArea}>
                <View style={[styles.bar, { height: `${Math.max((b.total / trendMax) * 100, 2)}%` }]} />
              </View>
              <Text style={styles.barLabel}>{b.label}</Text>
            </View>
          ))}
        </View>
        <Muted>Highest: {data.peak_month.label} • {fmtM(data.peak_month.total)}</Muted>
      </Card>

      <Card>
        <Text style={styles.h2}>Cost by Project</Text>
        {data.cost_by_project.length === 0 ? <Muted>Belum ada data</Muted> : data.cost_by_project.map((c: any) => (
          <View key={c.name}>
            <View style={styles.rowBetween}><Text style={styles.rowMain}>{c.name}</Text><Text style={styles.strong}>{c.pct}%</Text></View>
            <BarTrack pct={c.pct} />
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.h2}>Cost by User</Text>
          <Muted>Top 5</Muted>
        </View>
        {data.cost_by_user.map((u: any) => (
          <View key={u.name} style={styles.listRow}>
            <View><Text style={styles.rowMain}>{u.name}</Text><Muted>{u.role}</Muted></View>
            <Text style={styles.strong}>{fmtM(u.total)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.h2}>Cost by Category</Text>
        {data.cost_by_category.map((c: any) => (
          <View key={c.name}>
            <View style={styles.listRow}>
              <View style={{ flex: 1 }}><Text style={styles.rowMain}>{c.name}</Text></View>
              <Text style={styles.strong}>{c.pct}%</Text>
            </View>
            <BarTrack pct={c.pct} />
          </View>
        ))}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// PO & Invoice
// ---------------------------------------------------------------------------

function POInvoice({ toast }: { toast: (t: string) => void }) {
  const [pos, setPos] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    try {
      const p = await api.pos();
      setPos(p.pos);
      const inv = await api.invoices();
      setInvoices(inv.invoices);
    } catch (e: any) {
      toast(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleInv = async (num: string) => {
    try { await api.toggleInvoice(num); await load(); } catch (e: any) { toast(e?.message || "Gagal"); }
  };

  const projectNames = Array.from(new Set(pos.map((p) => p.project_name)));

  return (
    <>
      <Text style={styles.screenTitle}>PO & Invoice</Text>
      <Card>
        <View style={styles.btnRow}>
          <Pressable testID="po-add-button" onPress={() => setShowAdd(true)} style={({ pressed }) => [styles.primaryBtn, styles.flex1, pressed && styles.pressed]}>
            <Text style={styles.primaryBtnText}>+ Add PO</Text>
          </Pressable>
        </View>
      </Card>

      {loading ? <Loading /> : pos.map((po) => {
        const remaining = po.po_amount - po.actual_cost;
        return (
          <Card key={po.po_number}>
            <View style={styles.listRow}>
              <View><Text style={styles.strong}>{po.po_number}</Text><Muted>{po.project_name} • {po.location}</Muted></View>
              <View style={styles.badgeApproved}><Text style={styles.badgeApprovedText}>{po.status}</Text></View>
            </View>
            <View style={styles.poStatRow}>
              <View><Muted>PO Amount</Muted><Text style={styles.strong}>{fmtFull(po.po_amount)}</Text></View>
              <View style={{ alignItems: "flex-end" }}><Muted>Actual Cost</Muted><Text style={styles.strong}>{fmtFull(po.actual_cost)}</Text></View>
            </View>
            <View style={styles.poStatRow}>
              <View><Muted>Remaining PO</Muted><Text style={styles.strong}>{fmtFull(remaining)}</Text></View>
              <View style={{ alignItems: "flex-end" }}><Muted>Cost Utilization</Muted><Text style={styles.strong}>{String(po.utilization).replace(".", ",")}%</Text></View>
            </View>
          </Card>
        );
      })}

      <Card>
        <Text style={styles.h2}>Invoice Status</Text>
        {invoices.map((inv, i) => (
          <View key={inv.invoice_number} style={styles.listRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.rowMain}>{inv.invoice_number}</Text>
              <Muted>{inv.po_number} • {fmtFull(inv.amount)} • Due {inv.due_date}</Muted>
            </View>
            <StatusPill testID={`invoice-status-${i}`} paid={inv.paid} onPress={() => toggleInv(inv.invoice_number)} />
          </View>
        ))}
      </Card>

      <AddPOModal
        visible={showAdd}
        projects={projectNames.length ? projectNames : ["Moratel DWDM", "Moratel OLT"]}
        onClose={() => setShowAdd(false)}
        onCreated={async () => { setShowAdd(false); await load(); toast("PO berhasil ditambahkan"); }}
      />
    </>
  );
}

function AddPOModal({ visible, projects, onClose, onCreated }: { visible: boolean; projects: string[]; onClose: () => void; onCreated: () => void }) {
  const insets = useSafeAreaInsets();
  const [no, setNo] = useState("");
  const [project, setProject] = useState(projects[0]);
  const [location, setLocation] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!no.trim() || !amount.trim()) { setErr("PO Number dan PO Amount wajib diisi."); return; }
    setSaving(true);
    setErr("");
    try {
      await api.createPO({ po_number: no.trim(), project_name: project, location: location || "-", po_amount: Number(amount) });
      setNo(""); setLocation(""); setAmount("");
      onCreated();
    } catch (e: any) {
      setErr(e?.message || "Gagal menambah PO.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.h2}>Add Purchase Order</Text>
            <Pressable testID="po-modal-close" onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={C.text} />
            </Pressable>
          </View>
          <KeyboardAwareScrollView bottomOffset={24} showsVerticalScrollIndicator={false}>
            <Label>PO Number</Label>
            <Input testID="po-number-input" value={no} onChangeText={setNo} placeholder="PO-2026-003" />
            <View style={{ height: 12 }} />
            <Label>Project</Label>
            <Select value={project} options={projects} onSelect={setProject} testID="po-project-select" />
            <View style={{ height: 12 }} />
            <Label>Location</Label>
            <Input testID="po-location-input" value={location} onChangeText={setLocation} placeholder="Lokasi project" />
            <View style={{ height: 12 }} />
            <Label>PO Amount</Label>
            <Input testID="po-amount-input" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
            {err ? <Text style={styles.errorText}>{err}</Text> : null}
            <Pressable testID="po-save-button" onPress={submit} disabled={saving} style={({ pressed }) => [styles.primaryBtn, { marginTop: 18 }, saving && { opacity: 0.7 }, pressed && styles.pressed]}>
              {saving ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryBtnText}>Save PO</Text>}
            </Pressable>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Submit Ops (Operational Tracker)
// ---------------------------------------------------------------------------

const POST_CATEGORIES: Record<string, string[]> = {
  "2.0 Operational": ["2.1 Fuel", "2.2 Toll", "2.3 Parking"],
  "3.0 Accomodation": ["3.1 Hotel", "3.2 Guest House"],
  "4.0 Transportation": ["4.1 Flight", "4.2 Train", "4.3 Rental Car"],
  "5.0 Rental": ["5.1 Equipment Rental", "5.2 Vehicle Rental"],
  "6.0 Office and Admin": ["6.1 Stationery", "6.2 Utilities"],
  "7.0 Other Project Cost": ["7.1 Others"],
};
const POSTS = Object.keys(POST_CATEGORIES);

function SubmitOps({ toast }: { toast: (t: string) => void }) {
  const [projects, setProjects] = useState<string[]>(["Moratel DWDM", "Moratel OLT"]);
  const [txns, setTxns] = useState<any[]>([]);
  const [date, setDate] = useState("2026-08-14");
  const [project, setProject] = useState("Moratel DWDM");
  const [site, setSite] = useState("Bank Mandiri - Jakarta");
  const [post, setPost] = useState(POSTS[0]);
  const [category, setCategory] = useState(POST_CATEGORIES[POSTS[0]][0]);
  const [amount, setAmount] = useState("450000");
  const [ket, setKet] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const p = await api.pos();
      if (p.pos.length) { setProjects(Array.from(new Set(p.pos.map((x) => x.project_name)))); setProject(p.pos[0].project_name); }
      const c = await api.costs();
      setTxns(c.costs.slice(0, 10));
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  const onPost = (p: string) => { setPost(p); setCategory(POST_CATEGORIES[p][0]); };

  const submit = async () => {
    if (!remarks.trim()) { setError("Remarks wajib diisi sebelum submit."); return; }
    if (!amount.trim() || isNaN(Number(amount))) { setError("Amount harus berupa angka."); return; }
    setSaving(true);
    setError("");
    try {
      await api.createCost({ date, project_name: project, site_name: site, post, category, amount: Number(amount), keterangan: ket, remarks });
      setRemarks(""); setKet("");
      await load();
      toast("Cost berhasil disubmit");
    } catch (e: any) {
      setError(e?.message || "Gagal submit cost.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Text style={styles.screenTitle}>Operational Tracker</Text>
      <Card>
        <Label>Date</Label>
        <Input testID="op-date-input" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <View style={{ height: 12 }} />
        <Label>Project</Label>
        <Select value={project} options={projects} onSelect={setProject} testID="op-project-select" />
        <View style={{ height: 12 }} />
        <Label>Site Name</Label>
        <Input testID="op-site-input" value={site} onChangeText={setSite} />
        <View style={{ height: 12 }} />
        <Label>Post</Label>
        <Select value={post} options={POSTS} onSelect={onPost} testID="op-post-select" />
        <View style={{ height: 12 }} />
        <Label>Category</Label>
        <Select value={category} options={POST_CATEGORIES[post]} onSelect={setCategory} testID="op-category-select" />
        <View style={{ height: 12 }} />
        <Label>Amount</Label>
        <Input testID="op-amount-input" value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <View style={{ height: 12 }} />
        <Label>Keterangan</Label>
        <TextInput
          testID="op-ket-input"
          value={ket}
          onChangeText={setKet}
          placeholder="Tambahkan keterangan bila diperlukan"
          placeholderTextColor="#9AA7B8"
          multiline
          style={[styles.input, styles.textarea]}
        />
        <View style={{ height: 12 }} />
        <Label>Remarks *</Label>
        <TextInput
          testID="op-remarks-input"
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Remarks wajib diisi sebelum submit"
          placeholderTextColor="#9AA7B8"
          multiline
          style={[styles.input, styles.textarea]}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable testID="op-submit-button" onPress={submit} disabled={saving} style={({ pressed }) => [styles.primaryBtn, { marginTop: 18 }, saving && { opacity: 0.7 }, pressed && styles.pressed]}>
          {saving ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryBtnText}>Submit Cost</Text>}
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.h2}>Transaction History</Text>
        {txns.length === 0 ? <Muted>Belum ada transaksi</Muted> : txns.map((t) => (
          <View key={t.id} style={styles.listRow}>
            <View style={styles.txIcon}><Ionicons name={postIcon(t.post)} size={18} color={C.blue} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.rowMain}>{t.category}</Text>
              <Muted>{t.date} • {t.project_name}</Muted>
            </View>
            <Text style={styles.strong}>{fmtFull(t.amount)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Employee Management (profile + employee list + salary status)
// ---------------------------------------------------------------------------

function EmployeeManagement({ toast, user, refreshUser }: { toast: (t: string) => void; user: SessionUser; refreshUser: () => void }) {
  const isOwner = user.role === "Owner";
  const [employees, setEmployees] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(user.employeeId);
  const [form, setForm] = useState({ ktp: "", bpjs: "", address: "", gaji: "", bank: "", noRek: "" });
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    try {
      const data = await api.employees();
      setEmployees(data.employees);
    } catch (e: any) {
      toast(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = employees.find((e) => e.employee_id === selectedId);
  useEffect(() => {
    if (selected) setForm({ ktp: selected.ktp, bpjs: selected.bpjs, address: selected.address, gaji: selected.gaji, bank: selected.bank, noRek: selected.no_rek });
  }, [selectedId, employees.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.updateEmployee(selected.employee_id, {
        name: selected.name, role: selected.role, join_date: selected.join_date,
        ktp: form.ktp, bpjs: form.bpjs, address: form.address, gaji: form.gaji, bank: form.bank, no_rek: form.noRek,
      });
      await load();
      if (selected.employee_id === user.employeeId) refreshUser();
      toast("Profil tersimpan");
    } catch (e: any) {
      toast(e?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (eid: string) => {
    if (!isOwner) return toast("Hanya Owner yang dapat mengubah data");
    try {
      await api.toggleSalary(eid);
      await load();
    } catch (e: any) {
      toast(e?.message || "Gagal mengubah status");
    }
  };

  const createEmployee = async (payload: any) => {
    await api.createEmployee(payload);
    await load();
    setAddOpen(false);
    toast("Karyawan berhasil ditambahkan");
  };

  const headName = selected?.name ?? user.name;
  const headRole = selected?.role ?? user.role;

  return (
    <>
      <Text style={styles.screenTitle}>Employee Management</Text>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          {isOwner ? "Pilih karyawan pada daftar untuk melihat & mengubah detail profilnya." : "Pilih karyawan pada daftar untuk melihat detail profil dan jumlah gajinya."}
        </Text>
      </View>

      <Card style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(headName)}</Text></View>
        <View><Text style={styles.strong}>{headName}</Text><Muted>ID {selected?.employee_id ?? user.employeeId} • {headRole}</Muted></View>
      </Card>
      <View style={[styles.notice, isOwner ? styles.noticeOwner : null]}>
        <Text style={[styles.noticeText, isOwner ? styles.noticeOwnerText : null]}>
          {isOwner
            ? "Anda login sebagai Owner. Semua data karyawan dapat diubah dan disimpan."
            : "Semua informasi hanya dapat diubah oleh Owner. Data di bawah bersifat read-only."}
        </Text>
      </View>

      {loading ? (
        <Card style={{ alignItems: "center", paddingVertical: 32 }}><ActivityIndicator color={C.blue} /></Card>
      ) : (
        <Card>
          <Label>Nama Lengkap</Label>
          <Input value={selected?.name ?? ""} readOnly />
          <View style={{ height: 12 }} />
          <Label>No. KTP</Label>
          <Input testID="user-ktp-input" value={form.ktp} onChangeText={set("ktp")} readOnly={!isOwner} />
          <View style={{ height: 12 }} />
          <Label>No. BPJS Kesehatan</Label>
          <Input testID="user-bpjs-input" value={form.bpjs} onChangeText={set("bpjs")} readOnly={!isOwner} />
          <View style={{ height: 12 }} />
          <Label>Alamat Rumah</Label>
          <TextInput
            testID="user-address-input"
            value={form.address}
            onChangeText={set("address")}
            editable={isOwner}
            multiline
            style={[styles.input, styles.textarea, !isOwner && styles.inputReadonly]}
          />
          <View style={{ height: 12 }} />
          <Label>Gaji Bulanan</Label>
          <Input testID="user-salary-input" value={form.gaji} onChangeText={set("gaji")} readOnly={!isOwner} />
          <View style={{ height: 12 }} />
          <Label>Bank</Label>
          <Input testID="user-bank-input" value={form.bank} onChangeText={set("bank")} readOnly={!isOwner} />
          <View style={{ height: 12 }} />
          <Label>No. Rekening</Label>
          <Input testID="user-norek-input" value={form.noRek} onChangeText={set("noRek")} readOnly={!isOwner} />
          <View style={{ height: 12 }} />
          <Label>Join Date</Label>
          <Input value={selected?.join_date ?? ""} readOnly />
          <View style={{ height: 12 }} />
          <Label>Role</Label>
          <View style={styles.selectDisabled}>
            <Text style={[styles.selectText, { color: C.muted }]}>{selected?.role ?? ""}</Text>
            <Ionicons name="lock-closed" size={14} color={C.muted} />
          </View>
          {isOwner && (
            <Pressable testID="user-save-button" onPress={save} disabled={saving} style={({ pressed }) => [styles.primaryBtn, { marginTop: 18 }, saving && { opacity: 0.7 }, pressed && styles.pressed]}>
              {saving ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryBtnText}>Save Profile</Text>}
            </Pressable>
          )}
        </Card>
      )}

      <Card>
        <Text style={styles.h2}>Employee List</Text>
        {isOwner && (
          <View style={styles.btnRow}>
            <Pressable testID="employee-add-button" onPress={() => setAddOpen(true)} style={({ pressed }) => [styles.primaryBtn, styles.flex1, pressed && styles.pressed]}>
              <Text style={styles.primaryBtnText}>+ Add Employee</Text>
            </Pressable>
          </View>
        )}
        {employees.map((e, i) => {
          const active = e.employee_id === selectedId;
          return (
            <Pressable
              key={e.employee_id}
              testID={`employee-row-${i}`}
              onPress={() => (isOwner ? setSelectedId(e.employee_id) : toast("Hanya Owner yang dapat mengubah data"))}
              style={[styles.listRow, active && styles.listRowActive]}
            >
              <View><Text style={styles.rowMain}>{e.name}</Text><Muted>{e.employee_id} • {e.role}</Muted></View>
              <View style={styles.badge}><Text style={styles.badgeText}>{e.gaji}</Text></View>
            </Pressable>
          );
        })}
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <Text style={styles.h2}>Salary Status</Text>
          <Muted>{isOwner ? "Status pembayaran gaji periode Aug-26. Pilih status untuk memperbaruinya." : "Status pembayaran gaji periode Aug-26 (read-only)."}</Muted>
        </View>
        <View style={styles.tableHead}>
          <Text style={[styles.tableHeadCell, { flex: 2 }]}>Employee</Text>
          <Text style={[styles.tableHeadCell, { flex: 1 }]}>Amount</Text>
          <Text style={[styles.tableHeadCell, { flex: 1.2, textAlign: "right" }]}>Status</Text>
        </View>
        {employees.map((e, i) => (
          <View key={e.employee_id} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontWeight: "700", color: C.text }]}>{e.name}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{e.gaji}</Text>
            <View style={{ flex: 1.2, alignItems: "flex-end" }}>
              <StatusPill testID={`salary-status-${i}`} paid={!!e.paid} onPress={() => toggle(e.employee_id)} />
            </View>
          </View>
        ))}
      </Card>

      <AddEmployeeModal visible={addOpen} onClose={() => setAddOpen(false)} onCreate={createEmployee} />
    </>
  );
}

function AddEmployeeModal({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate: (p: any) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [f, setF] = useState({ employee_id: "", name: "", role: "Engineer", gaji: "tbd", bank: "", no_rek: "", join_date: "2026-08-01" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!f.employee_id.trim() || !f.name.trim()) {
      setErr("Employee ID dan Nama wajib diisi.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await onCreate({ ...f, ktp: "tbd", bpjs: "tbd", address: "", password: "123" });
      setF({ employee_id: "", name: "", role: "Engineer", gaji: "tbd", bank: "", no_rek: "", join_date: "2026-08-01" });
    } catch (e: any) {
      setErr(e?.message || "Gagal menambah karyawan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.h2}>Add Employee</Text>
            <Pressable testID="employee-modal-close" onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={C.text} />
            </Pressable>
          </View>
          <KeyboardAwareScrollView bottomOffset={24} showsVerticalScrollIndicator={false}>
            <Label>Employee ID</Label>
            <Input testID="add-emp-id-input" value={f.employee_id} onChangeText={set("employee_id")} placeholder="Contoh: 00205" />
            <View style={{ height: 12 }} />
            <Label>Nama Lengkap</Label>
            <Input testID="add-emp-name-input" value={f.name} onChangeText={set("name")} placeholder="Nama karyawan" />
            <View style={{ height: 12 }} />
            <Label>Role</Label>
            <Select value={f.role} options={["Engineer", "PM", "Project Manager", "Project Controller", "Owner"]} onSelect={set("role")} testID="add-emp-role-select" />
            <View style={{ height: 12 }} />
            <Label>Gaji Bulanan</Label>
            <Input testID="add-emp-gaji-input" value={f.gaji} onChangeText={set("gaji")} />
            <View style={{ height: 12 }} />
            <Label>Bank</Label>
            <Input testID="add-emp-bank-input" value={f.bank} onChangeText={set("bank")} placeholder="BCA / Mandiri" />
            <View style={{ height: 12 }} />
            <Label>No. Rekening</Label>
            <Input testID="add-emp-norek-input" value={f.no_rek} onChangeText={set("no_rek")} keyboardType="numeric" />
            <View style={{ height: 12 }} />
            <Label>Join Date</Label>
            <Input testID="add-emp-join-input" value={f.join_date} onChangeText={set("join_date")} placeholder="YYYY-MM-DD" />
            <Text style={styles.helperText}>Password default untuk karyawan baru: 123</Text>
            {err ? <Text style={styles.errorText}>{err}</Text> : null}
            <Pressable testID="add-emp-save-button" onPress={submit} disabled={saving} style={({ pressed }) => [styles.primaryBtn, { marginTop: 14 }, saving && { opacity: 0.7 }, pressed && styles.pressed]}>
              {saving ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryBtnText}>Save Employee</Text>}
            </Pressable>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Change Password
// ---------------------------------------------------------------------------

function ChangePassword({ toast, onDone }: { toast: (t: string) => void; onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    if (!pw || !confirm) return setError("Isi kedua kolom password.");
    if (pw !== confirm) return setError("Password tidak sama.");
    setError("");
    toast("Password berhasil diubah");
    onDone();
  };
  return (
    <>
      <Text style={styles.screenTitle}>Change Password</Text>
      <Card>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Masukkan password baru sebanyak dua kali untuk validasi.</Text>
        </View>
        <View style={{ height: 12 }} />
        <Label>New Password</Label>
        <Input testID="new-password-input" value={pw} onChangeText={setPw} placeholder="Masukkan password baru" secureTextEntry />
        <View style={{ height: 12 }} />
        <Label>Confirm New Password</Label>
        <Input testID="confirm-password-input" value={confirm} onChangeText={setConfirm} placeholder="Ulangi password baru" secureTextEntry />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable testID="change-password-button" onPress={submit} style={({ pressed }) => [styles.primaryBtn, { marginTop: 18 }, pressed && styles.pressed]}>
          <Text style={styles.primaryBtnText}>Change Password</Text>
        </Pressable>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

const allowedScreens = (role: string): Screen[] => {
  if (role === "Owner") return ["dashboard", "po", "operational", "users"];
  if (role === "PM" || role === "PCM" || role === "Project Manager" || role === "Project Controller") return ["po", "operational"];
  return ["operational"]; // Engineer + fallback
};

export default function Index() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = (t: string) => {
    setToastText(t);
    setTimeout(() => setToastText(null), 1800);
  };

  const refreshUser = async () => {
    try {
      const me = await api.me();
      setCurrentUser(fromApi(me));
    } catch { /* ignore */ }
  };

  const logout = async () => {
    await clearToken();
    setCurrentUser(null);
    setScreen("dashboard");
  };

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) {
        try {
          const me = await api.me();
          const u = fromApi(me);
          setCurrentUser(u);
          setScreen(allowedScreens(u.role)[0]);
        } catch { /* token invalid */ }
      }
      setBooting(false);
    })();
  }, []);

  const content = useMemo(() => {
    switch (screen) {
      case "dashboard": return <Dashboard />;
      case "po": return <POInvoice toast={showToast} />;
      case "operational": return <SubmitOps toast={showToast} />;
      case "users": return <EmployeeManagement toast={showToast} user={currentUser!} refreshUser={refreshUser} />;
      case "password": return <ChangePassword toast={showToast} onDone={() => setScreen(allowedScreens(currentUser!.role)[0])} />;
    }
  }, [screen, currentUser]);

  if (booting) {
    return (
      <View style={[styles.app, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.blue} size="large" />
      </View>
    );
  }

  if (!currentUser) return <Login onLogin={(u) => { setCurrentUser(u); setScreen(allowedScreens(u.role)[0]); }} />;

  const tabs = TABS.filter((t) => allowedScreens(currentUser.role).includes(t.id));
  const showBack = screen === "password";

  return (
    <View style={styles.app}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        {showBack ? (
          <Pressable testID="appbar-back" onPress={() => setScreen(allowedScreens(currentUser.role)[0])} hitSlop={10} style={styles.appBarSide}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </Pressable>
        ) : (
          <View style={styles.appBarBrand}>
            <View style={styles.appBarLogo}><Ionicons name="pulse" size={16} color={C.white} /></View>
            <View style={{ flexShrink: 1 }}>
              <Text testID="appbar-user-name" style={styles.appBarUserName} numberOfLines={1}>{currentUser.name}</Text>
              <Text testID="appbar-user-role" style={styles.appBarUserRole} numberOfLines={1}>{currentUser.role}</Text>
            </View>
          </View>
        )}
        <View style={styles.appBarActions}>
          <Pressable testID="appbar-password" onPress={() => setScreen("password")} hitSlop={10} style={styles.appBarSide}>
            <Ionicons name="settings-outline" size={22} color={screen === "password" ? C.blue : C.text} />
          </Pressable>
          <Pressable testID="appbar-logout" onPress={logout} hitSlop={10} style={styles.appBarSide}>
            <Ionicons name="log-out-outline" size={23} color={C.red} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        testID={`screen-${screen}`}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {content}
      </ScrollView>

      <View style={[styles.nav, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
        {tabs.map((t) => {
          const active = screen === t.id || (screen === "password" && t.id === tabs[0]?.id);
          return (
            <Pressable key={t.id} testID={`tab-${t.id}`} onPress={() => setScreen(t.id)} style={styles.navItem}>
              <Ionicons name={t.icon} size={22} color={active ? C.blue : C.muted} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Toast text={toastText} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 16, gap: 14 },

  appBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line },
  appBarBrand: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingRight: 12 },
  appBarLogo: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  appBarTitle: { fontSize: 17, fontWeight: "800", color: C.text, letterSpacing: -0.3 },
  appBarUserName: { fontSize: 14.5, fontWeight: "800", color: C.text, letterSpacing: -0.2 },
  appBarUserRole: { fontSize: 11.5, fontWeight: "700", color: C.blue, marginTop: 1 },
  appBarSide: { minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center" },
  appBarActions: { flexDirection: "row", alignItems: "center", gap: 6 },

  card: { backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line },
  muted: { color: C.muted, fontSize: 12.5, lineHeight: 18 },
  label: { color: C.text, fontSize: 12.5, fontWeight: "700", marginBottom: 7 },
  h2: { fontSize: 16, fontWeight: "800", color: C.text, marginBottom: 8 },
  screenTitle: { fontSize: 22, fontWeight: "800", color: C.text, letterSpacing: -0.4 },
  strong: { color: C.text, fontWeight: "800", fontSize: 14 },
  rowMain: { color: C.text, fontSize: 14, fontWeight: "600" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  input: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, color: C.text, fontSize: 14, backgroundColor: "#FBFCFE" },
  inputReadonly: { backgroundColor: "#F2F5F9", color: C.muted },
  textarea: { minHeight: 72, paddingTop: 12, textAlignVertical: "top" },

  select: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, backgroundColor: "#FBFCFE", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectDisabled: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, backgroundColor: "#F2F5F9", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectText: { fontSize: 14, color: C.text, fontWeight: "600" },

  pickerBackdrop: { flex: 1, backgroundColor: "rgba(15,27,45,0.35)", justifyContent: "center", padding: 32 },
  pickerSheet: { backgroundColor: C.white, borderRadius: 16, overflow: "hidden" },
  pickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 15, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  pickerText: { fontSize: 15, color: C.text },

  primaryBtn: { minHeight: 46, borderRadius: 11, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryBtnText: { color: C.white, fontWeight: "800", fontSize: 14 },
  secondaryBtn: { minHeight: 46, borderRadius: 11, backgroundColor: C.paleBlue, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  secondaryBtnText: { color: C.blue, fontWeight: "800", fontSize: 14 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  btnRow: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },

  errorText: { color: C.red, fontSize: 12.5, marginTop: 10, fontWeight: "600" },

  loginScreen: { flex: 1, backgroundColor: C.text },
  loginContent: { paddingHorizontal: 22, alignItems: "center" },
  logoBox: { width: 60, height: 60, borderRadius: 18, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  loginBrand: { color: C.white, fontSize: 24, fontWeight: "800", marginTop: 16, letterSpacing: -0.4 },
  loginTagline: { color: "#9DB0C8", marginTop: 6, textAlign: "center" },
  loginCard: { width: "100%", marginTop: 26 },
  demoBox: { marginTop: 20, backgroundColor: "#F5F8FC", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.line },
  demoTitle: { fontWeight: "800", color: C.text, marginBottom: 8, fontSize: 13 },
  demoLine: { color: C.muted, fontSize: 12.5, lineHeight: 21 },

  filterCard: { paddingVertical: 14 },
  heroCard: { backgroundColor: C.text, borderColor: C.text },
  profitGrid: { flexDirection: "row", marginTop: 12 },
  profitItem: { flex: 1 },
  profitLabel: { color: "#9DB0C8", fontSize: 12, fontWeight: "600" },
  profitValue: { color: C.white, fontSize: 22, fontWeight: "800", marginTop: 4, letterSpacing: -0.5 },
  profitSub: { color: "#7C90AB", fontSize: 10.5, marginTop: 3 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "47.5%", flexGrow: 1, padding: 14 },
  statValue: { fontSize: 19, fontWeight: "800", color: C.text, marginTop: 5, letterSpacing: -0.3 },
  kpiNote: { color: C.muted, fontSize: 10.5, marginTop: 4, lineHeight: 15 },

  barTrack: { height: 9, backgroundColor: C.track, borderRadius: 20, overflow: "hidden", marginTop: 8, marginBottom: 8 },
  barFill: { height: "100%", borderRadius: 20 },

  finHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 8, marginTop: 4 },
  finHeadCell: { flex: 1, fontSize: 9.5, fontWeight: "800", color: C.muted, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.3 },
  finCellFirst: { flex: 1.4, textAlign: "left" },
  finRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  finCell: { flex: 1, fontSize: 11.5, color: C.text, textAlign: "right" },
  finProject: { fontWeight: "800" },
  finRemaining: { fontWeight: "800", color: C.green },

  chart: { height: 120, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8, marginBottom: 10 },
  barCol: { flex: 1, alignItems: "center" },
  barArea: { height: 100, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  bar: { width: 14, borderRadius: 5, backgroundColor: C.blue },
  barLabel: { fontSize: 9.5, color: C.muted, marginTop: 6 },

  listRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  listRowActive: { backgroundColor: "#F5F9FF", borderRadius: 10, paddingHorizontal: 8, borderBottomColor: "transparent" },
  helperText: { color: C.muted, fontSize: 11.5, marginTop: 12 },
  txIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.paleBlue, alignItems: "center", justifyContent: "center" },

  poStatRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  badgeApproved: { backgroundColor: C.greenBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  badgeApprovedText: { color: C.green, fontSize: 11.5, fontWeight: "800" },
  badge: { backgroundColor: C.paleBlue, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { color: C.blue, fontSize: 12, fontWeight: "800" },

  profileCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.text, alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.white, fontWeight: "800", fontSize: 15 },
  notice: { backgroundColor: "#FFF7E6", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FBE7B8" },
  noticeText: { color: "#8A6A1F", fontSize: 12.5, lineHeight: 18 },
  noticeOwner: { backgroundColor: "#E7F7EF", borderColor: "#BCEBD3" },
  noticeOwnerText: { color: "#0A7A47" },

  tableHead: { flexDirection: "row", backgroundColor: "#F7FAFD", paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line },
  tableHeadCell: { fontSize: 10.5, fontWeight: "800", color: C.muted, textTransform: "uppercase", letterSpacing: 0.3 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  tableCell: { fontSize: 13, color: C.muted },
  statusPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, minWidth: 74, alignItems: "center" },
  statusPaid: { backgroundColor: C.greenBg },
  statusUnpaid: { backgroundColor: C.redBg },
  statusText: { fontSize: 11.5, fontWeight: "800" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,27,45,0.45)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },

  nav: { flexDirection: "row", backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, paddingHorizontal: 6 },
  navItem: { flex: 1, alignItems: "center", gap: 4, minHeight: 44 },
  navLabel: { fontSize: 10.5, color: C.muted, fontWeight: "600" },
  navLabelActive: { color: C.blue, fontWeight: "800" },

  toastWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  toastText: { color: C.white, fontWeight: "700", fontSize: 13 },
});
