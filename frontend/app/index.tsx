import React, { useMemo, useState } from "react";
import {
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

// ---------------------------------------------------------------------------
// Teleconi Tracker — faithful mockup of Telecony_Ops_Tracker_Draft21.html
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
  amber: "#F59E0B",
};

type Screen = "dashboard" | "po" | "operational" | "gaji" | "users" | "password";

const TABS: { id: Screen; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "po", label: "PO Project", icon: "documents" },
  { id: "operational", label: "Operational", icon: "add-circle" },
  { id: "gaji", label: "Gaji", icon: "wallet" },
];

const DEMO_ACCOUNTS = [
  { role: "Owner", cred: "00101 / owner123" },
  { role: "Engineer", cred: "00201 / eng123" },
  { role: "PM", cred: "00202 / pm123" },
  { role: "PCM", cred: "00203 / pcm123" },
];

// ---------------------------------------------------------------------------
// Small reusable primitives
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

function Login({ onLogin }: { onLogin: () => void }) {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!user || !pass) {
      setError("Masukkan Username / Employee ID dan Password.");
      return;
    }
    setError("");
    onLogin();
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
        <Pressable testID="login-button" onPress={submit} style={({ pressed }) => [styles.primaryBtn, { marginTop: 18 }, pressed && styles.pressed]}>
          <Text style={styles.primaryBtnText}>Login</Text>
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
  { m: "Jan", h: 30 },
  { m: "Feb", h: 38 },
  { m: "Mar", h: 46 },
  { m: "Apr", h: 40 },
  { m: "May", h: 58 },
  { m: "Jun", h: 65 },
  { m: "Jul", h: 76 },
  { m: "Aug", h: 100 },
];

const COST_BY_USER = [
  { name: "Budi Santoso", role: "Engineer", amt: "Rp18,2M" },
  { name: "Andi Saputra", role: "Engineer", amt: "Rp15,4M" },
  { name: "Citra Lestari", role: "PM", amt: "Rp12,8M" },
  { name: "Deni Kurniawan", role: "Engineer", amt: "Rp11,7M" },
  { name: "Eka Wijaya", role: "Engineer", amt: "Rp9,8M" },
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
        <Select
          testID="dashboard-project-filter"
          value={project}
          options={["All Project", "Moratel DWDM", "Moratel OLT"]}
          onSelect={setProject}
        />
      </Card>

      {/* Hero — profitability */}
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

      {/* KPI grid */}
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

      {/* Budget utilization */}
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.h2}>Budget Utilization</Text>
          <Text style={styles.h2}>72%</Text>
        </View>
        <BarTrack pct={72} />
        <Muted>Actual Rp185,4M / Budget Rp257,0M</Muted>
      </Card>

      {/* Project financial summary */}
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

      {/* Monthly cost trend */}
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

      {/* Cost by project */}
      <Card>
        <Text style={styles.h2}>Cost by Project</Text>
        <View style={styles.rowBetween}><Text style={styles.rowMain}>Moratel DWDM</Text><Text style={styles.strong}>62%</Text></View>
        <BarTrack pct={62} />
        <View style={[styles.rowBetween, { marginTop: 8 }]}><Text style={styles.rowMain}>Moratel OLT</Text><Text style={styles.strong}>38%</Text></View>
        <BarTrack pct={38} />
      </Card>

      {/* Cost by user */}
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.h2}>Cost by User</Text>
          <Muted>Top 5</Muted>
        </View>
        {COST_BY_USER.map((u) => (
          <View key={u.name} style={styles.listRow}>
            <View>
              <Text style={styles.rowMain}>{u.name}</Text>
              <Muted>{u.role}</Muted>
            </View>
            <Text style={styles.strong}>{u.amt}</Text>
          </View>
        ))}
      </Card>

      {/* Cost by category */}
      <Card>
        <Text style={styles.h2}>Cost by Category</Text>
        {COST_BY_CATEGORY.map((c) => (
          <View key={c.name}>
            <View style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowMain}>{c.name}</Text>
                <Muted>{c.desc}</Muted>
              </View>
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
// PO Project
// ---------------------------------------------------------------------------

const POS = [
  {
    no: "PO-2026-001",
    project: "Moratel DWDM • Bank Mandiri",
    amount: "Rp 450.000.000",
    actual: "Rp 115.200.000",
    remaining: "Rp 334.800.000",
    util: "25,6%",
  },
  {
    no: "PO-2026-002",
    project: "Moratel OLT • Bali",
    amount: "Rp 300.000.000",
    actual: "Rp 70.200.000",
    remaining: "Rp 229.800.000",
    util: "23,4%",
  },
];

function POProject({ toast }: { toast: (t: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <>
      <Text style={styles.screenTitle}>PO Project</Text>
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
            <View>
              <Text style={styles.strong}>{po.no}</Text>
              <Muted>{po.project}</Muted>
            </View>
            <View style={styles.badgeApproved}>
              <Text style={styles.badgeApprovedText}>Active</Text>
            </View>
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
        <Text style={styles.h2}>PO Summary</Text>
        <View style={styles.statGrid}>
          {[
            ["Total PO Value", "Rp 750M"],
            ["Actual Cost", "Rp 185,4M"],
            ["Remaining PO", "Rp 564,6M"],
            ["Utilization", "24,7%"],
          ].map((s) => (
            <View key={s[0]} style={styles.summaryStat}>
              <Muted>{s[0]}</Muted>
              <Text style={styles.statValue}>{s[1]}</Text>
            </View>
          ))}
        </View>
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
// Operational Tracker
// ---------------------------------------------------------------------------

const TRANSACTIONS = [
  { title: "Meals — Bank Mandiri", meta: "14 Aug 2026 • Makan", amt: "Rp450K", icon: "restaurant-outline" as const },
  { title: "Site transport", meta: "12 Aug 2026 • Transport", amt: "Rp1,2M", icon: "car-outline" as const },
  { title: "Hotel — crew", meta: "09 Aug 2026 • Penginapan", amt: "Rp2,8M", icon: "bed-outline" as const },
];

function Operational({ toast }: { toast: (t: string) => void }) {
  const [date, setDate] = useState("2026-08-14");
  const [project, setProject] = useState("DWDM");
  const [site, setSite] = useState("Bank Mandiri - Jakarta");
  const [category, setCategory] = useState("Makan");
  const [amount, setAmount] = useState("450000");
  const [ket, setKet] = useState("");
  const needsKet = category === "Transport" || category === "Others";

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
        <Label>Category</Label>
        <Select value={category} options={["Makan", "Penginapan", "Transport", "Others"]} onSelect={setCategory} testID="op-category-select" />
        <View style={{ height: 12 }} />
        <Label>Amount</Label>
        <Input testID="op-amount-input" value={amount} onChangeText={setAmount} keyboardType="numeric" />
        {needsKet && (
          <>
            <View style={{ height: 12 }} />
            <Label>Keterangan *</Label>
            <TextInput
              testID="op-ket-input"
              value={ket}
              onChangeText={setKet}
              placeholder="Wajib untuk Transport / Others"
              placeholderTextColor="#9AA7B8"
              multiline
              style={[styles.input, styles.textarea]}
            />
          </>
        )}
        <Pressable testID="op-submit-button" onPress={() => toast("Cost berhasil disubmit")} style={({ pressed }) => [styles.primaryBtn, { marginTop: 18 }, pressed && styles.pressed]}>
          <Text style={styles.primaryBtnText}>Submit Cost</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.h2}>Transaction History</Text>
        {TRANSACTIONS.map((t) => (
          <View key={t.title} style={styles.listRow}>
            <View style={styles.txIcon}>
              <Ionicons name={t.icon} size={18} color={C.blue} />
            </View>
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
// User Management
// ---------------------------------------------------------------------------

function UserManagement({ toast, onChangePassword }: { toast: (t: string) => void; onChangePassword: () => void }) {
  const [address, setAddress] = useState("Depok, Jawa Barat");
  const [email, setEmail] = useState("andi@projectops.local");
  const role = "Owner";
  const [salary, setSalary] = useState("15000000");

  return (
    <>
      <Text style={styles.screenTitle}>User Management</Text>
      <Card style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>AS</Text></View>
        <View>
          <Text style={styles.strong}>Andi Saputra</Text>
          <Muted>ID 00101 • Owner</Muted>
        </View>
      </Card>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>Email Address dan Alamat Rumah dapat diubah oleh user. Data identitas lainnya hanya dapat diubah oleh Owner.</Text>
      </View>

      <Card>
        <Label>Nama Lengkap</Label>
        <Input value="Andi Saputra" readOnly />
        <View style={{ height: 12 }} />
        <Label>No. KTP</Label>
        <Input value="3174********1234" readOnly />
        <View style={{ height: 12 }} />
        <Label>No. BPJS Kesehatan</Label>
        <Input value="0001********789" readOnly />
        <View style={{ height: 12 }} />
        <Label>Alamat Rumah</Label>
        <TextInput testID="user-address-input" value={address} onChangeText={setAddress} multiline style={[styles.input, styles.textarea]} />
        <View style={{ height: 12 }} />
        <Label>Email</Label>
        <Input testID="user-email-input" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <View style={{ height: 12 }} />
        <Label>Join Date</Label>
        <Input value="2018-04-02" readOnly />
        <View style={{ height: 12 }} />
        <Label>Role</Label>
        <View style={styles.selectDisabled}>
          <Text style={[styles.selectText, { color: C.muted }]}>{role}</Text>
          <Ionicons name="lock-closed" size={14} color={C.muted} />
        </View>
        <View style={{ height: 12 }} />
        <Label>Gaji Bulanan</Label>
        <Input testID="user-salary-input" value={salary} onChangeText={setSalary} keyboardType="numeric" />
        <Pressable testID="user-save-button" onPress={() => toast("Profil tersimpan")} style={({ pressed }) => [styles.primaryBtn, { marginTop: 18 }, pressed && styles.pressed]}>
          <Text style={styles.primaryBtnText}>Save Profile</Text>
        </Pressable>
        <Pressable testID="user-change-password-button" onPress={onChangePassword} style={({ pressed }) => [styles.secondaryBtn, { marginTop: 10 }, pressed && styles.pressed]}>
          <Text style={styles.secondaryBtnText}>Change Password</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.h2}>Employee List</Text>
        <View style={styles.btnRow}>
          <Pressable testID="employee-add-button" onPress={() => toast("Add employee")} style={({ pressed }) => [styles.primaryBtn, styles.flex1, pressed && styles.pressed]}>
            <Text style={styles.primaryBtnText}>+ Add Employee</Text>
          </Pressable>
          <Pressable testID="employee-search-button" onPress={() => toast("Search employee")} style={({ pressed }) => [styles.secondaryBtn, styles.flex1, pressed && styles.pressed]}>
            <Text style={styles.secondaryBtnText}>Search</Text>
          </Pressable>
        </View>
        {[
          { name: "Budi Santoso", meta: "00201 • Engineer", amt: "Rp8.5M" },
          { name: "Citra Lestari", meta: "00202 • Project Manager", amt: "Rp12M" },
          { name: "Deni Kurniawan", meta: "00203 • Project Controller", amt: "Rp9.5M" },
        ].map((e) => (
          <View key={e.name} style={styles.listRow}>
            <View>
              <Text style={styles.rowMain}>{e.name}</Text>
              <Muted>{e.meta}</Muted>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>{e.amt}</Text></View>
          </View>
        ))}
      </Card>
    </>
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
// Salary Payment
// ---------------------------------------------------------------------------

const SALARY_ROWS = [
  { name: "Budi Santoso", month: "Aug-26", amount: "8.5M", paid: false },
  { name: "Citra Lestari", month: "Aug-26", amount: "12M", paid: false },
  { name: "Deni Kurniawan", month: "Aug-26", amount: "9.5M", paid: true },
  { name: "Eka Wijaya", month: "Jul-26", amount: "8M", paid: true },
];

function Salary() {
  const [rows, setRows] = useState(SALARY_ROWS);
  const toggle = (i: number) => setRows((r) => r.map((row, n) => (n === i ? { ...row, paid: !row.paid } : row)));
  return (
    <>
      <Text style={styles.screenTitle}>Salary Payment</Text>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>Default status: Belum Dibayar. Tap status to mark as paid.</Text>
      </View>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <View style={styles.tableHead}>
          <Text style={[styles.tableHeadCell, { flex: 2 }]}>Employee</Text>
          <Text style={[styles.tableHeadCell, { flex: 1 }]}>Month</Text>
          <Text style={[styles.tableHeadCell, { flex: 1 }]}>Amount</Text>
          <Text style={[styles.tableHeadCell, { flex: 1.2, textAlign: "right" }]}>Status</Text>
        </View>
        {rows.map((row, i) => (
          <View key={row.name} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2, fontWeight: "700", color: C.text }]}>{row.name}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{row.month}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{row.amount}</Text>
            <View style={{ flex: 1.2, alignItems: "flex-end" }}>
              <Pressable
                testID={`salary-status-${i}`}
                onPress={() => toggle(i)}
                style={[styles.statusPill, row.paid ? styles.statusPaid : styles.statusUnpaid]}
              >
                <Text style={[styles.statusText, { color: row.paid ? C.green : C.red }]}>{row.paid ? "Terbayar" : "Belum"}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function Index() {
  const insets = useSafeAreaInsets();
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = (t: string) => {
    setToastText(t);
    setTimeout(() => setToastText(null), 1800);
  };

  const content = useMemo(() => {
    switch (screen) {
      case "dashboard": return <Dashboard />;
      case "po": return <POProject toast={showToast} />;
      case "operational": return <Operational toast={showToast} />;
      case "gaji": return <Salary />;
      case "users": return <UserManagement toast={showToast} onChangePassword={() => setScreen("password")} />;
      case "password": return <ChangePassword toast={showToast} onDone={() => setScreen("users")} />;
    }
  }, [screen]);

  if (!loggedIn) return <Login onLogin={() => { setLoggedIn(true); setScreen("dashboard"); }} />;

  const showBack = screen === "users" || screen === "password";

  return (
    <View style={styles.app}>
      {/* Top app bar */}
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        {showBack ? (
          <Pressable testID="appbar-back" onPress={() => setScreen(screen === "password" ? "users" : "dashboard")} hitSlop={10} style={styles.appBarSide}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </Pressable>
        ) : (
          <View style={styles.appBarBrand}>
            <View style={styles.appBarLogo}><Ionicons name="pulse" size={16} color={C.white} /></View>
            <Text style={styles.appBarTitle}>Teleconi Tracker</Text>
          </View>
        )}
        <Pressable testID="appbar-profile" onPress={() => setScreen("users")} hitSlop={10} style={styles.appBarSide}>
          <Ionicons name="person-circle-outline" size={28} color={screen === "users" ? C.blue : C.text} />
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

      {/* Bottom nav */}
      <View style={[styles.nav, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
        {TABS.map((t) => {
          const active = screen === t.id;
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

  // app bar
  appBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line },
  appBarBrand: { flexDirection: "row", alignItems: "center", gap: 9 },
  appBarLogo: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  appBarTitle: { fontSize: 17, fontWeight: "800", color: C.text, letterSpacing: -0.3 },
  appBarSide: { minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center" },

  // primitives
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

  // login
  loginScreen: { flex: 1, backgroundColor: C.text },
  loginContent: { paddingHorizontal: 22, alignItems: "center" },
  logoBox: { width: 60, height: 60, borderRadius: 18, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  loginBrand: { color: C.white, fontSize: 24, fontWeight: "800", marginTop: 16, letterSpacing: -0.4 },
  loginTagline: { color: "#9DB0C8", marginTop: 6, textAlign: "center" },
  loginCard: { width: "100%", marginTop: 26 },
  demoBox: { marginTop: 20, backgroundColor: "#F5F8FC", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.line },
  demoTitle: { fontWeight: "800", color: C.text, marginBottom: 8, fontSize: 13 },
  demoLine: { color: C.muted, fontSize: 12.5, lineHeight: 21 },

  // dashboard
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
  summaryStat: { width: "47.5%", flexGrow: 1, backgroundColor: "#F7FAFD", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.line },

  barTrack: { height: 9, backgroundColor: C.track, borderRadius: 20, overflow: "hidden", marginTop: 8, marginBottom: 8 },
  barFill: { height: "100%", borderRadius: 20 },

  // financial summary table
  finHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 8, marginTop: 4 },
  finHeadCell: { flex: 1, fontSize: 9.5, fontWeight: "800", color: C.muted, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.3 },
  finCellFirst: { flex: 1.4, textAlign: "left" },
  finRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  finCell: { flex: 1, fontSize: 11.5, color: C.text, textAlign: "right" },
  finProject: { fontWeight: "800" },
  finRemaining: { fontWeight: "800", color: C.green },

  // chart
  chart: { height: 120, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8, marginBottom: 10 },
  barCol: { flex: 1, alignItems: "center" },
  barArea: { height: 100, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  bar: { width: 14, borderRadius: 5, backgroundColor: C.blue },
  barLabel: { fontSize: 9.5, color: C.muted, marginTop: 6 },

  // list rows
  listRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  txIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.paleBlue, alignItems: "center", justifyContent: "center" },

  // PO
  poStatRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  badgeApproved: { backgroundColor: C.greenBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  badgeApprovedText: { color: C.green, fontSize: 11.5, fontWeight: "800" },
  badge: { backgroundColor: C.paleBlue, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { color: C.blue, fontSize: 12, fontWeight: "800" },

  // user mgmt
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.text, alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.white, fontWeight: "800", fontSize: 15 },
  notice: { backgroundColor: "#FFF7E6", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FBE7B8" },
  noticeText: { color: "#8A6A1F", fontSize: 12.5, lineHeight: 18 },

  // salary table
  tableHead: { flexDirection: "row", backgroundColor: "#F7FAFD", paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  tableHeadCell: { fontSize: 10.5, fontWeight: "800", color: C.muted, textTransform: "uppercase", letterSpacing: 0.3 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  tableCell: { fontSize: 13, color: C.muted },
  statusPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, minWidth: 74, alignItems: "center" },
  statusPaid: { backgroundColor: C.greenBg },
  statusUnpaid: { backgroundColor: C.redBg },
  statusText: { fontSize: 11.5, fontWeight: "800" },

  // modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,27,45,0.45)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },

  // nav
  nav: { flexDirection: "row", backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, paddingHorizontal: 6 },
  navItem: { flex: 1, alignItems: "center", gap: 4, minHeight: 44 },
  navLabel: { fontSize: 10.5, color: C.muted, fontWeight: "600" },
  navLabelActive: { color: C.blue, fontWeight: "800" },

  // toast
  toastWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  toastText: { color: C.white, fontWeight: "700", fontSize: 13 },
});
