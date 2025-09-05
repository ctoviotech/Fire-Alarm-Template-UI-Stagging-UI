import React, { useMemo, useState } from "react";
import { Flame, ShieldAlert, AlertTriangle, MapPin, List, Search, Clock, Phone, Map as MapIcon } from "lucide-react";
import { motion } from "framer-motion";

// BRAND TONES: white • deep blue • red
// Tailwind palette refs: slate / blue-900 / red-600 / indigo-600

// ---------------- Types ----------------
type Member = { name: string; phone: string; pttId: string; role: string };
type IncidentType = "Cháy" | "An ninh" | "SOS" | "Kỹ thuật";
type IncidentStatus = "Cảnh báo Khẩn cấp" | "Đang xử lý" | "Đã xử lý";

type Incident = {
  id: string;
  branch: string;
  address: string;
  type: IncidentType;
  priority: 1 | 2 | 3;
  status: IncidentStatus;
  time: string; // for demo
  members: Member[];
  scenario?: "Sensor" | "SOS"; // legacy field for context; not used for filtering
};

// ---------------- Mock Data ----------------
const incidents: Incident[] = [
  {
    id: "PNJ.FIRE.001",
    branch: "Chi nhánh A",
    address: "Tòa nhà A, 123 Đường XYZ",
    type: "Cháy",
    priority: 1,
    status: "Cảnh báo Khẩn cấp",
    time: "2025-08-24 10:45",
    members: [
      { name: "Đội trưởng A", phone: "0901234567", pttId: "PTT-101", role: "Chỉ huy" },
      { name: "Kỹ thuật B", phone: "0902223344", pttId: "PTT-102", role: "Kỹ thuật" },
      { name: "Bảo vệ C", phone: "0905556677", pttId: "PTT-103", role: "Bảo vệ" },
      { name: "Y tế D", phone: "0908889991", pttId: "PTT-104", role: "Nhân viên" },
    ],
  },
  {
    id: "PNJ.SECU.001",
    branch: "Chi nhánh A",
    address: "Tòa nhà A, 123 Đường XYZ",
    type: "An ninh",
    priority: 2,
    status: "Đã xử lý",
    time: "2025-08-24 09:05",
    scenario: "Sensor", // cửa bị mở bất thường
    members: [{ name: "Bảo vệ G", phone: "0901112233", pttId: "PTT-301", role: "Bảo vệ" }],
  },
  {
    id: "PNJ.SECU.002",
    branch: "Chi nhánh A",
    address: "Tòa nhà A, 123 Đường XYZ",
    type: "An ninh",
    priority: 1,
    status: "Đang xử lý",
    time: "2025-08-24 10:51",
    scenario: "Sensor",
    members: [
      { name: "Bảo vệ H", phone: "0912345678", pttId: "PTT-302", role: "Bảo vệ" },
      { name: "Chỉ huy I", phone: "0934567890", pttId: "PTT-303", role: "Chỉ huy" },
      { name: "Hỗ trợ J", phone: "0977777777", pttId: "PTT-304", role: "Nhân viên" },
      { name: "Hỗ trợ K", phone: "0966666666", pttId: "PTT-305", role: "Nhân viên" },
    ],
  },
  {
    id: "PNJ.SOS.001",
    branch: "Chi nhánh A",
    address: "Tòa nhà A, 123 Đường XYZ",
    type: "SOS", // SOS là MỘT LOẠI SỰ CỐ RIÊNG
    priority: 1,
    status: "Cảnh báo Khẩn cấp",
    time: "2025-08-24 11:02",
    scenario: "SOS", // nguồn phát: nút bấm SOS
    members: [
      { name: "Bảo vệ P", phone: "0900000001", pttId: "PTT-401", role: "Bảo vệ" },
      { name: "Chỉ huy Q", phone: "0900000002", pttId: "PTT-402", role: "Chỉ huy" },
    ],
  },
  {
    id: "PNJ.FIRE.002",
    branch: "Chi nhánh A",
    address: "Tòa nhà A, 123 Đường XYZ",
    type: "Cháy",
    priority: 1,
    status: "Đang xử lý",
    time: "2025-08-24 11:10",
    members: [
      { name: "Đội trưởng L", phone: "0909090901", pttId: "PTT-401", role: "Chỉ huy" },
      { name: "Kỹ thuật M", phone: "0909090902", pttId: "PTT-402", role: "Kỹ thuật" },
      { name: "Bảo vệ N", phone: "0909090903", pttId: "PTT-403", role: "Bảo vệ" },
    ],
  },
  // (Tuỳ chọn) Một case Kỹ thuật để đảm bảo đã bị loại khỏi tab này
  {
    id: "PNJ.TECH.001",
    branch: "Chi nhánh A",
    address: "Tòa nhà A, 123 Đường XYZ",
    type: "Kỹ thuật",
    priority: 2,
    status: "Đang xử lý",
    time: "2025-08-24 10:32",
    members: [{ name: "Kỹ thuật E", phone: "0907778899", pttId: "PTT-201", role: "Kỹ thuật" }],
  },
];

// ---------------- Meta ----------------
const typeMeta: Record<string, { icon: any; color: string; bg: string }> = {
  "Cháy": { icon: Flame, color: "text-red-600", bg: "bg-red-50" },
  "An ninh": { icon: ShieldAlert, color: "text-blue-600", bg: "bg-blue-50" },
  "SOS": { icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50" },
};

const statusMeta: Record<IncidentStatus, { color: string; bg: string }> = {
  "Cảnh báo Khẩn cấp": { color: "text-red-700", bg: "bg-red-100" },
  "Đang xử lý": { color: "text-blue-700", bg: "bg-blue-100" },
  "Đã xử lý": { color: "text-emerald-700", bg: "bg-emerald-100" },
};

// ---------------- UI Bits ----------------
function StatusBadge({ status }: { status: IncidentStatus }) {
  const m = statusMeta[status] || { color: "text-slate-700", bg: "bg-slate-100" };
  const isCritical = status === "Cảnh báo Khẩn cấp";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${m.bg} ${m.color}`}>
      {isCritical ? (
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-current" />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {status}
    </span>
  );
}

function TypeChip({ type }: { type: IncidentType }) {
  const M = typeMeta[type] || { icon: ShieldAlert, color: "text-slate-700", bg: "bg-slate-100" };
  const Icon = M.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${M.bg} ${M.color}`}>
      <Icon className="h-3.5 w-3.5" /> {type}
    </span>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number | string; tone: "red" | "blue" | "amber" | "emerald" }) {
  const map: Record<string, string> = {
    red: "from-red-600 to-red-700",
    blue: "from-blue-700 to-blue-800",
    amber: "from-amber-500 to-amber-600",
    emerald: "from-emerald-600 to-emerald-700",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex items-center rounded-xl bg-gradient-to-br ${map[tone]} px-3 py-1 text-xs font-semibold text-white`}>{label}</div>
      <div className="mt-3 text-3xl font-bold text-slate-900">{value}</div>
    </motion.div>
  );
}

function ContactCell({ members }: { members: Member[] }) {
  // Group members into requested buckets
  const buckets: Record<string, { name: string; phone: string }[]> = {
    manager: [], // Trưởng chi nhánh
    guard: [], // Bảo vệ
    tech: [], // Kỹ thuật
    staff: [], // Nhân viên
  };
  members.forEach((m) => {
    const role = (m.role || "").toLowerCase();
    if (role.includes("chỉ huy") || role.includes("trưởng") || role.includes("quản lý")) buckets.manager.push({ name: m.name, phone: m.phone });
    else if (role.includes("bảo vệ")) buckets.guard.push({ name: m.name, phone: m.phone });
    else if (role.includes("kỹ thuật")) buckets.tech.push({ name: m.name, phone: m.phone });
    else buckets.staff.push({ name: m.name, phone: m.phone });
  });

  const Line = ({ label, arr }: { label: string; arr: { name: string; phone: string }[] }) =>
    arr.length ? (
      <div className="flex items-start gap-1 text-xs">
        <span className="min-w-[120px] shrink-0 text-slate-500">{label}:</span>
        <div className="flex-1 space-x-2">
          {arr.slice(0, 3).map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <span className="font-medium text-slate-800">{p.name}</span>
              <a href={`tel:${p.phone}`} className="text-blue-700 hover:underline">
                - {p.phone}
              </a>
              {i < Math.min(arr.length, 3) - 1 && <span className="text-slate-400">,</span>}
            </span>
          ))}
          {arr.length > 3 && <span className="text-slate-400">… +{arr.length - 3}</span>}
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-1">
      <Line label="Trưởng chi nhánh" arr={buckets.manager} />
      <Line label="Bảo vệ" arr={buckets.guard} />
      <Line label="Kỹ thuật" arr={buckets.tech} />
      <Line label="Nhân viên" arr={buckets.staff} />
    </div>
  );
}

// ---------------- Main Page ----------------
export default function IncidentOverview() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"Tất cả" | IncidentType>("Tất cả");
  const [range, setRange] = useState("24h");
  const [view, setView] = useState<"list" | "map">("list");

  const filtered = useMemo(() => {
    return incidents.filter(
      (it) =>
        it.type !== "Kỹ thuật" && // exclude kỹ thuật from this tab
        (typeFilter === "Tất cả" || it.type === typeFilter) &&
        (query === "" || it.id.toLowerCase().includes(query.toLowerCase()) || it.address.toLowerCase().includes(query.toLowerCase()))
    );
  }, [query, typeFilter]);

  const kpi = useMemo(
    () => ({
      critical: filtered.filter((i) => i.status === "Cảnh báo Khẩn cấp").length,
      inprogress: filtered.filter((i) => i.status === "Đang xử lý").length,
      resolved: filtered.filter((i) => i.status === "Đã xử lý").length,
    }),
    [filtered]
  );

  // --- Dev Tests (do NOT change unless wrong) ---
  const allowed = new Set<IncidentStatus>(["Cảnh báo Khẩn cấp", "Đang xử lý", "Đã xử lý"]);
  console.assert(incidents.some((i) => i.type === "SOS"), "Cần có ít nhất 1 sự cố loại SOS");
  console.assert(filtered.every((i) => i.type !== "Kỹ thuật"), "Tab này không được hiển thị sự cố Kỹ thuật");
  console.assert(filtered.every((i) => allowed.has(i.status)), "Trạng thái phải nằm trong 3 state cho phép");
  console.assert(kpi.critical + kpi.inprogress + kpi.resolved === filtered.length, "Tổng KPI phải khớp số dòng");
  console.assert(filtered.some((i) => i.status === "Cảnh báo Khẩn cấp"), "Cần có ít nhất 1 sự cố critical để test badge ping");
  // New: unit test for type filter = SOS
  const sosOnly = incidents.filter((i) => i.type === "SOS");
  console.assert(sosOnly.length > 0, "Data test: phải có SOS để test filter");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top brand bar */}
      <div className="bg-gradient-to-r from-white via-white to-white">
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ứng cứu sự cố</h1>
              <p className="mt-1 text-sm text-slate-600">Giám sát & điều phối theo thời gian thực</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                <Phone className="mr-2 inline h-4 w-4" />Tham gia PTT
              </button>
              <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                <Clock className="mr-2 inline h-4 w-4" />Mở SOP
              </button>
              <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700">Tạo sự vụ thủ công</button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & KPIs */}
      <div className="mx-auto max-w-[1600px] px-6">
        <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Filters */}
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              {/* Type chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {["Tất cả", "Cháy", "An ninh", "SOS"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t as any)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      typeFilter === t ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {t === "Cháy" && <Flame className="h-3.5 w-3.5" />}
                    {t === "An ninh" && <ShieldAlert className="h-3.5 w-3.5" />}
                    {t === "SOS" && <AlertTriangle className="h-3.5 w-3.5" />}
                    {t}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="mx-2 h-6 w-px bg-slate-200" />

              {/* Range */}
              <div className="flex items-center gap-1">
                {["24h", "7d", "30d"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      range === r ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm mã sự cố / địa chỉ"
                  className="w-48 text-sm outline-none placeholder:text-slate-400"
                />
              </div>

              {/* View toggle */}
              <div className="ml-2 inline-flex overflow-hidden rounded-xl border border-slate-300">
                <button
                  onClick={() => setView("list")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs ${
                    view === "list" ? "bg-blue-900 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  <List className="h-4 w-4" />Danh sách
                </button>
                <button
                  onClick={() => setView("map")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs ${
                    view === "map" ? "bg-blue-900 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  <MapIcon className="h-4 w-4" />Bản đồ
                </button>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-4 lg:grid-cols-3">
            <MetricCard label="Cảnh báo Khẩn cấp" value={kpi.critical} tone="red" />
            <MetricCard label="Đang xử lý" value={kpi.inprogress} tone="blue" />
            <MetricCard label="Đã xử lý" value={kpi.resolved} tone="emerald" />
          </div>
        </div>

        {/* Content area */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {view === "list" ? (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="w-[60px] px-4 py-3">STT</th>
                    <th className="px-4 py-3">Mã sự cố</th>
                    <th className="w-[26%] px-4 py-3">Địa điểm</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="w-[32%] px-4 py-3">Liên hệ</th>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((it, idx) => {
                    const googleLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.address)}`;
                    return (
                      <tr key={it.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-600">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-blue-700">{it.id}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          <div className="font-medium text-slate-900">{it.branch}</div>
                          <div className="flex items-center gap-2 text-slate-500">
                            <span>{it.address}</span>
                            <a
                              href={googleLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-blue-700 hover:text-blue-800"
                              title="Mở Google Maps"
                            >
                              <MapPin className="h-4 w-4" />
                            </a>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <TypeChip type={it.type} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={it.status} />
                        </td>
                        <td className="px-4 py-3">
                          <ContactCell members={it.members || []} />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{it.time}</td>
                        <td className="px-4 py-3">
                          <button className="rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">Chi tiết</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-[520px] items-center justify-center">
              <div className="text-center">
                <MapIcon className="mx-auto h-10 w-10 text-blue-700" />
                <p className="mt-2 text-sm text-slate-600">Bản đồ sự vụ (cluster theo cơ sở) — placeholder, tích hợp GIS ở đây.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <div>
            Tổng số sự vụ: <span className="font-semibold text-slate-700">{filtered.length}</span>
          </div>
          <div>Tone màu: nền trắng · nhấn xanh dương đậm · cảnh báo đỏ.</div>
        </div>
      </div>
    </div>
  );
}
