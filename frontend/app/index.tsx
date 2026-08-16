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

import { api, ApiUser, loadToken, setToken } from "@/src/api";

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
    <View pointerEvents="none" style={[styles.toastWrap, { bottom: insets.bottom + 96 }]}>
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

const TREND = [
  { m: "Jan", h: 30 }, { m: "Feb", h: 38 }, { m: "Mar", h: 46 }, { m: "Apr", h: 40 },
  { m: "May", h: 58 }, { m: "Jun", h: 65 }, { m: "Jul", h: 76 }, { m: "Aug", h: 100 },
];
const COST_BY_USER = [
  { name: "Yendro Makendro Sija", role: "Engineer", amt: "Rp18,2M" },
  { name: "Rofinus Hada", role: "Engineer", amt: "Rp15,4M" },
  { name: "Pahala Sidauruk", role: "PM", amt: "Rp12,8M" },
  { name: "Aldi Efendi", role: "Engineer", amt: "Rp11,7M" },
  { name: "Teleconi", role: "Owner", amt: "Rp9,8M" },
];
const COST_BY_CATEGORY = [
  { name: "Transport", desc: "Travel & local transportation", pct: 42 },
  { name: "Penginapan", desc: "Hotel / accommodation", pct: 31 },
  { name: "Makan", desc: "Meals", pct: 21 },
  { name: "Others", desc: "Other operational cost", pct: 6 },
];

function Dashboard() {
  const [project, setProject] = useState("All Project");
  return (
    <>
      <Card style={styles.filterCard}>
        <Label>Project</Label>
        <Select testID="dashboard-project-filter" value={project} options={["All Project", "Moratel DWDM", "Moratel OLT"]} onSelect={setProject} />
      </Card>

      <Card style={styles.heroCard}>
        <Muted style={{ color: "#C7D6EA" }}>Project Profitability</Muted>
        <View style={styles.profitGrid}>
          <View style={styles.profitItem}>
            <Text style={styles.profitLabel}>Total Profit</Text>
            <Text testID="dashboard-total-profit" style={styles.profitValue}>Rp 564,6M</Text>
            <Text style={styles.profitSub}>PO Value − Actual Cost</Text>
          </View>
          <View style={styles.profitItem}>
            <Text style={styles.profitLabel}>Profit Margin</Text>
            <Text style={styles.profitValue}>75,3%</Text>
            <Text style={styles.profitSub}>Profit ÷ PO Value</Text>
          </View>
        </View>
        <Muted style={{ color: "#C7D6EA", marginTop: 6 }}>{project === "All Project" ? "All projects" : project}</Muted>
      </Card>

      <View style={styles.statGrid}>
        {[
          { label: "PO Value", value: "Rp 750M", note: "Nilai project dari customer" },
          { label: "Cost Budget", value: "Rp 320M", note: "Budget internal operational" },
          { label: "Actual Cost", value: "Rp 185,4M", note: "Pengeluaran aktual" },
          { label: "Remaining Cost Budget", value: "Rp 134,6M", note: "Budget − Actual Cost" },
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
          <Text style={styles.h2}>72%</Text>
        </View>
        <BarTrack pct={72} />
        <Muted>Actual Rp185,4M / Budget Rp257,0M</Muted>
      </Card>

      <Card>
        <Text style={styles.h2}>Project Financial Summary</Text>
        <View style={styles.finHeader}>
          {["Project", "PO", "Budget", "Actual", "Remaining"].map((h, i) => (
            <Text key={h} style={[styles.finHeadCell, i === 0 && styles.finCellFirst]}>{h}</Text>
          ))}
        </View>
        {[
          ["Moratel DWDM", "Rp450M", "Rp190M", "Rp115,2M", "Rp74,8M"],
          ["Moratel OLT", "Rp300M", "Rp130M", "Rp70,2M", "Rp59,8M"],
        ].map((r) => (
          <View key={r[0]} style={styles.finRow}>
            <Text style={[styles.finCell, styles.finCellFirst, styles.finProject]}>{r[0]}</Text>
            <Text style={styles.finCell}>{r[1]}</Text>
            <Text style={styles.finCell}>{r[2]}</Text>
            <Text style={styles.finCell}>{r[3]}</Text>
            <Text style={[styles.finCell, styles.finRemaining]}>{r[4]}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.h2}>Monthly Cost Trend</Text>
        <View style={styles.chart}>
          {TREND.map((b) => (
            <View key={b.m} style={styles.barCol}>
              <View style={styles.barArea}>
                <View style={[styles.bar, { height: `${b.h}%` }]} />
              </View>
              <Text style={styles.barLabel}>{b.m}</Text>
            </View>
          ))}
        </View>
        <Muted>Highest: August • Rp28,6M</Muted>
      </Card>

      <Card>
        <Text style={styles.h2}>Cost by Project</Text>
        <View style={styles.rowBetween}><Text style={styles.rowMain}>Moratel DWDM</Text><Text style={styles.strong}>62%</Text></View>
        <BarTrack pct={62} />
        <View style={[styles.rowBetween, { marginTop: 8 }]}><Text style={styles.rowMain}>Moratel OLT</Text><Text style={styles.strong}>38%</Text></View>
        <BarTrack pct={38} />
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.h2}>Cost by User</Text>
          <Muted>Top 5</Muted>
        </View>
        {COST_BY_USER.map((u) => (
          <View key={u.name} style={styles.listRow}>
            <View><Text style={styles.rowMain}>{u.name}</Text><Muted>{u.role}</Muted></View>
            <Text style={styles.strong}>{u.amt}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.h2}>Cost by Category</Text>
        {COST_BY_CATEGORY.map((c) => (
          <View key={c.name}>
            <View style={styles.listRow}>
              <View style={{ flex: 1 }}><Text style={styles.rowMain}>{c.name}</Text><Muted>{c.desc}</Muted></View>
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

const POS = [
  { no: "PO-2026-001", project: "Moratel DWDM • Bank Mandiri", amount: "Rp 450.000.000", actual: "Rp 115.200.000", remaining: "Rp 334.800.000", util: "25,6%" },
  { no: "PO-2026-002", project: "Moratel OLT • Bali", amount: "Rp 300.000.000", actual: "Rp 70.200.000", remaining: "Rp 229.800.000", util: "23,4%" },
];

const INVOICES = [
  { no: "INV-2026-001", meta: "PO-2026-001 • Rp 225.000.000 • Due 25 Aug 2026", paid: true },
  { no: "INV-2026-002", meta: "PO-2026-001 • Rp 225.000.000 • Due 10 Sep 2026", paid: false },
  { no: "INV-2026-003", meta: "PO-2026-002 • Rp 150.000.000 • Due 30 Aug 2026", paid: true },
  { no: "INV-2026-004", meta: "PO-2026-002 • Rp 150.000.000 • Due 15 Sep 2026", paid: false },
];

function POInvoice({ toast }: { toast: (t: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [invoices, setInvoices] = useState(INVOICES);
  const toggleInv = (i: number) => setInvoices((s) => s.map((inv, n) => (n === i ? { ...inv, paid: !inv.paid } : inv)));
  return (
    <>
      <Text style={styles.screenTitle}>PO & Invoice</Text>
      <Card>
        <View style={styles.btnRow}>
          <Pressable testID="po-add-button" onPress={() => setShowAdd(true)} style={({ pressed }) => [styles.primaryBtn, styles.flex1, pressed && styles.pressed]}>
            <Text style={styles.primaryBtnText}>+ Add PO</Text>
          </Pressable>
          <Pressable testID="po-search-button" onPress={() => toast("Search PO")} style={({ pressed }) => [styles.secondaryBtn, styles.flex1, pressed && styles.pressed]}>
            <Text style={styles.secondaryBtnText}>Search</Text>
          </Pressable>
        </View>
      </Card>

      {POS.map((po) => (
        <Card key={po.no}>
          <View style={styles.listRow}>
            <View><Text style={styles.strong}>{po.no}</Text><Muted>{po.project}</Muted></View>
            <View style={styles.badgeApproved}><Text style={styles.badgeApprovedText}>Active</Text></View>
          </View>
          <View style={styles.poStatRow}>
            <View><Muted>PO Amount</Muted><Text style={styles.strong}>{po.amount}</Text></View>
            <View style={{ alignItems: "flex-end" }}><Muted>Actual Cost</Muted><Text style={styles.strong}>{po.actual}</Text></View>
          </View>
          <View style={styles.poStatRow}>
            <View><Muted>Remaining PO</Muted><Text style={styles.strong}>{po.remaining}</Text></View>
            <View style={{ alignItems: "flex-end" }}><Muted>Cost Utilization</Muted><Text style={styles.strong}>{po.util}</Text></View>
          </View>
        </Card>
      ))}

      <Card>
        <Text style={styles.h2}>Invoice Status</Text>
        {invoices.map((inv, i) => (
          <View key={inv.no} style={styles.listRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.rowMain}>{inv.no}</Text>
              <Muted>{inv.meta}</Muted>
            </View>
            <StatusPill testID={`invoice-status-${i}`} paid={inv.paid} onPress={() => toggleInv(i)} />
          </View>
        ))}
      </Card>

      <AddPOModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); toast("PO berhasil ditambahkan"); }} />
    </>
  );
}

function AddPOModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: () => void }) {
  const insets = useSafeAreaInsets();
  const [no, setNo] = useState("");
  const [project, setProject] = useState("Moratel DWDM");
  const [amount, setAmount] = useState("");
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
            <Select value={project} options={["Moratel DWDM", "Moratel OLT"]} onSelect={setProject} testID="po-project-select" />
            <View style={{ height: 12 }} />
            <Label>PO Amount</Label>
            <Input testID="po-amount-input" value={amount} onChangeText={setAmount} placeholder="Rp 0" keyboardType="numeric" />
            <Pressable testID="po-save-button" onPress={onSave} style={({ pressed }) => [styles.primaryBtn, { marginTop: 18 }, pressed && styles.pressed]}>
              <Text style={styles.primaryBtnText}>Save PO</Text>
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

const TRANSACTIONS = [
  { title: "Fuel — Bank Mandiri", meta: "14 Aug 2026 • 2.1 Fuel", amt: "Rp450K", icon: "car-outline" as const },
  { title: "Toll — site visit", meta: "12 Aug 2026 • 2.2 Toll", amt: "Rp120K", icon: "card-outline" as const },
  { title: "Hotel — crew", meta: "09 Aug 2026 • 3.1 Hotel", amt: "Rp2,8M", icon: "bed-outline" as const },
];

function SubmitOps({ toast }: { toast: (t: string) => void }) {
  const [date, setDate] = useState("2026-08-14");
  const [project, setProject] = useState("DWDM");
  const [site, setSite] = useState("Bank Mandiri - Jakarta");
  const [post, setPost] = useState(POSTS[0]);
  const [category, setCategory] = useState(POST_CATEGORIES[POSTS[0]][0]);
  const [amount, setAmount] = useState("450000");
  const [ket, setKet] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  const onPost = (p: string) => {
    setPost(p);
    setCategory(POST_CATEGORIES[p][0]);
  };
  const submit = () => {
    if (!remarks.trim()) {
      setError("Remarks wajib diisi sebelum submit.");
      return;
    }
    setError("");
    setRemarks("");
    toast("Cost berhasil disubmit");
  };

  return (
    <>
      <Text style={styles.screenTitle}>Operational Tracker</Text>
      <Card>
        <Label>Date</Label>
        <Input testID="op-date-input" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <View style={{ height: 12 }} />
        <Label>Project</Label>
        <Select value={project} options={["DWDM", "OLT"]} onSelect={setProject} testID="op-project-select" />
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
        <Pressable testID="op-submit-button" onPress={submit} style={({ pressed }) => [styles.primaryBtn, { marginTop: 18 }, pressed && styles.pressed]}>
          <Text style={styles.primaryBtnText}>Submit Cost</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.h2}>Transaction History</Text>
        {TRANSACTIONS.map((t) => (
          <View key={t.title} style={styles.listRow}>
            <View style={styles.txIcon}><Ionicons name={t.icon} size={18} color={C.blue} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.rowMain}>{t.title}</Text>
              <Muted>{t.meta}</Muted>
            </View>
            <Text style={styles.strong}>{t.amt}</Text>
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

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) {
        try {
          const me = await api.me();
          setCurrentUser(fromApi(me));
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
      case "password": return <ChangePassword toast={showToast} onDone={() => setScreen("users")} />;
    }
  }, [screen, currentUser]);

  if (booting) {
    return (
      <View style={[styles.app, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.blue} size="large" />
      </View>
    );
  }

  if (!currentUser) return <Login onLogin={(u) => { setCurrentUser(u); setScreen("dashboard"); }} />;

  const showBack = screen === "password";

  return (
    <View style={styles.app}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        {showBack ? (
          <Pressable testID="appbar-back" onPress={() => setScreen("users")} hitSlop={10} style={styles.appBarSide}>
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
        <Pressable testID="appbar-password" onPress={() => setScreen("password")} hitSlop={10} style={styles.appBarSide}>
          <Ionicons name="settings-outline" size={23} color={screen === "password" ? C.blue : C.text} />
        </Pressable>
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
        {TABS.map((t) => {
          const active = screen === t.id || (screen === "password" && t.id === "users");
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
