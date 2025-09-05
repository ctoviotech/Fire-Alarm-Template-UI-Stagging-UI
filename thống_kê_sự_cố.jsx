import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Activity,
  Gauge,
  MapPin,
  Search,
  Wrench,
  Fan as FanIcon,
  Waves,
  Camera,
  ChevronLeft,
  Building2,
  RotateCcw,
  Power,
  RefreshCcw,
  Phone,
  Video,
  ClipboardList,
  Ticket as TicketIcon,
  Clock,
  Info,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";

// Tone: white • deep blue • red • sky
// Tailwind CSS for styling

/**
 * Update per new spec:
 * 1) Branch Overview: replace simple pills with **Smart Filter** (root-cause only, GW states, Door open, Gen off, min Risk).
 *    Risk score now follows an explicit **weighting convention** (see computeRisk + RiskLegend).
 * 2) Branch Incidents: reorganize **Door** (list 5 doors) and **Generator** (Online/Offline badge) in detail column.
 * 3) Device Detail: add **timeline input** for kỹ thuật log (datetime + text), rendered as a timeline list.
 */

// ---------------- Metric Specs (from thresholds) ----------------
const metricSpecs: Record<string, { min: number; max: number; unit: string; label: string; warnLow: string; warnHigh: string }> = {
  // FACP
  ACVoltage: { min: 200, max: 250, unit: "V", label: "Điện áp AC (FACP)", warnLow: "Điện áp AC quá thấp", warnHigh: "Điện áp AC quá cao" },
  DCVoltage: { min: 20, max: 30, unit: "V", label: "Điện áp DC (FACP)", warnLow: "Điện áp DC quá thấp", warnHigh: "Điện áp DC quá cao" },
  // UPS
  UPSVoltage: { min: 200, max: 250, unit: "V", label: "Điện áp UPS (V)", warnLow: "Điện áp AC quá thấp", warnHigh: "Điện áp AC quá cao" },
  UPSCurrent: { min: 0, max: 20, unit: "A", label: "Dòng điện UPS (A)", warnLow: "Dòng điện UPS quá thấp", warnHigh: "Dòng điện UPS quá cao" },
  // Fan
  FANVoltage: { min: 200, max: 250, unit: "V", label: "Điện áp Quạt (V)", warnLow: "Điện áp AC quá thấp", warnHigh: "Điện áp AC quá cao" },
  FANCurrent: { min: 0, max: 10, unit: "A", label: "Dòng điện Quạt (A)", warnLow: "Dòng điện Quạt quá thấp", warnHigh: "Dòng điện Quạt quá cao" },
  // Pump
  PUMPVoltage: { min: 200, max: 250, unit: "V", label: "Điện áp Bơm (V)", warnLow: "Điện áp AC quá thấp", warnHigh: "Điện áp AC quá cao" },
  PUMPCurrent: { min: 0, max: 20, unit: "A", label: "Dòng điện Bơm (A)", warnLow: "Dòng điện quá thấp", warnHigh: "Dòng điện quá cao" },
  WaterFlow: { min: 5, max: 20, unit: "m³/h", label: "Lưu lượng nước (m³/h)", warnLow: "Lưu lượng nước quá thấp", warnHigh: "Lưu lượng nước quá cao" },
  PipePressure: { min: 10, max: 50, unit: "bar", label: "Áp suất đường ống (bar)", warnLow: "Áp suất đường ống quá thấp", warnHigh: "Áp suất đường ống quá cao" },
};

// ---------------- Mock Data with 2 Gateways per branch ----------------
// Each device has: domain, site, online, uplink ("GW-A"|"GW-M"|undefined), metrics, updatedAt
const devices = [
  // ===== Branch A =====
  { id: "GW-A-A", domain: "GW-A", site: { id: "SITE-A", name: "Chi nhánh A", address: "Tòa nhà A, 123 Đường XYZ" }, online: true, uplink: undefined, metrics: {}, updatedAt: "10:40" },
  { id: "GW-M-A", domain: "GW-M", site: { id: "SITE-A", name: "Chi nhánh A", address: "Tòa nhà A, 123 Đường XYZ" }, online: false, uplink: undefined, metrics: {}, updatedAt: "10:41" }, // Disconnected → cascade to Metrics devices
  { id: "FACP-01", domain: "FACP", site: { id: "SITE-A", name: "Chi nhánh A", address: "Tòa nhà A, 123 Đường XYZ" }, online: true, uplink: "GW-A", metrics: { ACVoltage: 260, DCVoltage: 35, ZoneStatus: 2 }, updatedAt: "10:42" },
  { id: "UPS-01", domain: "UPS", site: { id: "SITE-A", name: "Chi nhánh A", address: "Tòa nhà A, 123 Đường XYZ" }, online: true, uplink: "GW-M", metrics: { UPSVoltage: 210, UPSCurrent: 2.4, UPSStatus: "ON" }, updatedAt: "10:43" },
  { id: "FAN-01", domain: "Fan", site: { id: "SITE-A", name: "Chi nhánh A", address: "Tòa nhà A, 123 Đường XYZ" }, online: true, uplink: "GW-M", metrics: { FANVoltage: 230, FANCurrent: 6.5, FANStatus: "ON" }, updatedAt: "10:44" },
  { id: "PUMP-01", domain: "Pump", site: { id: "SITE-A", name: "Chi nhánh A", address: "Tòa nhà A, 123 Đường XYZ" }, online: true, uplink: "GW-M", metrics: { PUMPVoltage: 380, PUMPCurrent: 25, WaterFlow: 9.5, PipePressure: 5.2, PUMPStatus: "ON" }, updatedAt: "10:45" },
  { id: "DOOR-01", domain: "Door", site: { id: "SITE-A", name: "Chi nhánh A", address: "Tòa nhà A, 123 Đường XYZ" }, online: true, uplink: "GW-M", metrics: { Door01: "Close", Door02: "Close", Door03: "Close", Door04: "Open", Door05: "Close" }, updatedAt: "10:46" },
  { id: "GEN-01", domain: "Generator", site: { id: "SITE-A", name: "Chi nhánh A", address: "Tòa nhà A, 123 Đường XYZ" }, online: true, uplink: "GW-M", metrics: { GenStatus: "Online" }, updatedAt: "10:47" },
  { id: "CAM-01", domain: "Camera", site: { id: "SITE-A", name: "Chi nhánh A", address: "Tòa nhà A, 123 Đường XYZ" }, online: true, uplink: undefined, metrics: {}, updatedAt: "10:48" },
  // ===== Branch B =====
  { id: "GW-A-B", domain: "GW-A", site: { id: "SITE-B", name: "Chi nhánh B", address: "Tòa nhà B, 456 Đường ABC" }, online: false, uplink: undefined, metrics: {}, updatedAt: "10:40" },
  { id: "GW-M-B", domain: "GW-M", site: { id: "SITE-B", name: "Chi nhánh B", address: "Tòa nhà B, 456 Đường ABC" }, online: true, uplink: undefined, metrics: {}, updatedAt: "10:41" },
  { id: "FACP-02", domain: "FACP", site: { id: "SITE-B", name: "Chi nhánh B", address: "Tòa nhà B, 456 Đường ABC" }, online: true, uplink: "GW-A", metrics: { ACVoltage: 180, DCVoltage: 15, ZoneStatus: 3 }, updatedAt: "10:42" },
  { id: "UPS-02", domain: "UPS", site: { id: "SITE-B", name: "Chi nhánh B", address: "Tòa nhà B, 456 Đường ABC" }, online: true, uplink: "GW-M", metrics: { UPSVoltage: 198, UPSCurrent: 21, UPSStatus: "OFF" }, updatedAt: "10:43" },
  { id: "FAN-02", domain: "Fan", site: { id: "SITE-B", name: "Chi nhánh B", address: "Tòa nhà B, 456 Đường ABC" }, online: true, uplink: "GW-M", metrics: { FANVoltage: 180, FANCurrent: -1, FANStatus: "OFF" }, updatedAt: "10:44" },
  { id: "PUMP-02", domain: "Pump", site: { id: "SITE-B", name: "Chi nhánh B", address: "Tòa nhà B, 456 Đường ABC" }, online: true, uplink: "GW-M", metrics: { PUMPVoltage: 210, PUMPCurrent: 15, WaterFlow: 25, PipePressure: 60, PUMPStatus: "ON" }, updatedAt: "10:45" },
  { id: "DOOR-02", domain: "Door", site: { id: "SITE-B", name: "Chi nhánh B", address: "Tòa nhà B, 456 Đường ABC" }, online: true, uplink: "GW-M", metrics: { Door01: "Open", Door02: "Close", Door03: "Open", Door04: "Close", Door05: "Close" }, updatedAt: "10:46" },
  { id: "GEN-02", domain: "Generator", site: { id: "SITE-B", name: "Chi nhánh B", address: "Tòa nhà B, 456 Đường ABC" }, online: true, uplink: "GW-M", metrics: { GenStatus: "Offline" }, updatedAt: "10:47" },
  { id: "CAM-02", domain: "Camera", site: { id: "SITE-B", name: "Chi nhánh B", address: "Tòa nhà B, 456 Đường ABC" }, online: false, uplink: undefined, metrics: {}, updatedAt: "10:48" },
];

// ---------------- Incident coding rules ----------------
const statusIncidentMap: Record<string, { domain: string; message: string; code: string }> = {
  UPSStatus: { domain: "UPS", message: "UPS mất kết nối tới GW-M", code: "TECH.STATUS.UPS" },
  FANStatus: { domain: "Fan", message: "Quạt mất kết nối tới GW-M", code: "TECH.STATUS.FAN" },
  PUMPStatus: { domain: "Pump", message: "Bơm mất kết nối tới GW-M", code: "TECH.STATUS.PUMP" },
  ZoneStatus: { domain: "FACP", message: "Lỗi vùng FACP", code: "TECH.FACP.ZONE" }, // 2: OpenCircuit, 3: ShortCircuit
};

// --------------- Detection Logic ---------------
function checkRange(key: string, value: number) {
  const spec = metricSpecs[key];
  if (!spec) return null;
  if (value < spec.min) return { side: "low", message: spec.warnLow, spec } as const;
  if (value > spec.max) return { side: "high", message: spec.warnHigh, spec } as const;
  return null;
}

function evaluateDeviceIncidents(device: any) {
  const list: any[] = [];
  // generic offline
  if (!device.online) {
    list.push({
      code: `TECH.OFFLINE.${device.id}`,
      kind: "Mất kết nối",
      domain: device.domain,
      site: device.site,
      deviceId: device.id,
      detail: "Không nhận heartbeat",
      severity: "high",
      at: device.updatedAt,
    });
  }
  // status-based keys (ON/OFF)
  for (const key in device.metrics) {
    const v = device.metrics[key];
    if (typeof v === "string" && (v.toUpperCase() === "OFF" || v.toLowerCase() === "offline") && statusIncidentMap[key]) {
      const meta = statusIncidentMap[key];
      list.push({
        code: `${meta.code}.${device.id}`,
        kind: "Mất kết nối",
        domain: meta.domain,
        site: device.site,
        deviceId: device.id,
        detail: meta.message,
        severity: "high",
        at: device.updatedAt,
      });
      continue;
    }
    // FACP zone status special
    if (key === "ZoneStatus" && (v === 2 || v === 3)) {
      list.push({
        code: `${statusIncidentMap.ZoneStatus.code}.${v}.${device.id}`,
        kind: v === 2 ? "Open Circuit" : "Short Circuit",
        domain: "FACP",
        site: device.site,
        deviceId: device.id,
        detail: v === 2 ? "Mạch hở tại vùng báo cháy" : "Chập mạch tại vùng báo cháy",
        severity: "high",
        at: device.updatedAt,
      });
      continue;
    }
    // Door Open/Close → cảnh báo khi Open (bất thường)
    if (key.startsWith("Door") && typeof v === "string") {
      if (v.toLowerCase() === "open") {
        list.push({
          code: `TECH.DOOR.OPEN.${device.id}.${key}`,
          kind: "Cửa mở",
          domain: "Door",
          site: device.site,
          deviceId: device.id,
          detail: `${key} đang mở`,
          severity: "medium",
          at: device.updatedAt,
        });
      }
      continue;
    }
    // numeric thresholds
    if (typeof v === "number") {
      const verdict = checkRange(key, v);
      if (verdict) {
        const { spec, message } = verdict;
        list.push({
          code: `TECH.THRESH.${device.id}.${key}.${verdict.side === "high" ? "HIGH" : "LOW"}`,
          kind: "Vượt ngưỡng",
          domain: device.domain,
          site: device.site,
          deviceId: device.id,
          detail: `${spec.label}: ${v} ${spec.unit} — ${message}`,
          severity: "medium",
          at: device.updatedAt,
        });
      }
    }
  }
  return list;
}

// Add cascading incidents due to GW-A / GW-M disconnections
function augmentWithGatewayCascade(all: any[]) {
  const out = [...all];
  const bySite: Record<string, any[]> = {};
  devices.forEach((d) => {
    const sid = d.site.id;
    bySite[sid] = bySite[sid] || [];
    bySite[sid].push(d);
  });
  for (const sid in bySite) {
    const group = bySite[sid];
    const gwA = group.find((d) => d.domain === "GW-A");
    const gwM = group.find((d) => d.domain === "GW-M");
    group.forEach((dev) => {
      if (dev.uplink === "GW-A" && gwA && !gwA.online) {
        out.push({
          code: `TECH.CASCADE.GW-A.${dev.id}`,
          kind: "Mất kết nối",
          domain: dev.domain,
          site: dev.site,
          deviceId: dev.id,
          detail: `Thiết bị phụ thuộc GW-A (gateway Alarm)`,
          severity: "high",
          at: gwA.updatedAt,
        });
      }
      if (dev.uplink === "GW-M" && gwM && !gwM.online) {
        out.push({
          code: `TECH.CASCADE.GW-M.${dev.id}`,
          kind: "Mất kết nối",
          domain: dev.domain,
          site: dev.site,
          deviceId: dev.id,
          detail: `Thiết bị phụ thuộc GW-M (gateway Metrics)`,
          severity: "high",
          at: gwM.updatedAt,
        });
      }
    });
  }
  return out;
}

const baseIncidents = devices.flatMap(evaluateDeviceIncidents);
const allIncidents = augmentWithGatewayCascade(baseIncidents);

// --------- Risk scoring convention ---------
/**
 * RISK = min(100, sum(weights)) with weights:
 * - GW offline (root cause): +40 each (GW-A/GW-M)
 * - Device offline (non-cascade): +25 each
 * - Cascade offline (TECH.CASCADE.*): +8 each
 * - FACP ZoneStatus 2/3: +30 each
 * - Threshold HIGH/LOW: AC/DC/UPS/FAN Current/Voltage +10; WaterFlow/PipePressure +8
 * - Door open incident: +10 each (capped 30 per branch)
 * - Generator domain incident (offline/cascade): +15 once if present
 */
function computeRisk(incList: any[]) {
  let score = 0;
  let doorPts = 0;
  let genAdded = false;
  for (const i of incList) {
    const code = String(i.code);
    if (code.startsWith("TECH.OFFLINE.GW-A") || code.startsWith("TECH.OFFLINE.GW-M")) { score += 40; continue; }
    if (code.startsWith("TECH.CASCADE.")) { score += 8; continue; }
    if (i.kind === "Mất kết nối") { score += 25; continue; }
    if (code.startsWith("TECH.FACP.ZONE.")) { score += 30; continue; }
    if (i.domain === "Door" && i.kind === "Cửa mở") { doorPts += 10; continue; }
    if (i.kind === "Vượt ngưỡng") {
      if (/ACVoltage|DCVoltage|UPSVoltage|UPSCurrent|FANVoltage|FANCurrent|PUMPVoltage|PUMPCurrent/.test(code)) score += 10; else score += 8;
      continue;
    }
    if (i.domain === "Generator" && !genAdded && i.kind === "Mất kết nối") { score += 15; genAdded = true; continue; }
  }
  score += Math.min(30, doorPts);
  return Math.min(100, score);
}

// --------- Dev Tests (soft asserts – do not modify unless wrong) ---------
console.assert(allIncidents.some((i) => i.code.startsWith("TECH.OFFLINE.CAM-02")), "Camera offline (B) phải tạo incident");
console.assert(allIncidents.some((i) => i.code.includes("TECH.FACP.ZONE.2")), "FACP Zone open circuit (2) phải có");
console.assert(allIncidents.some((i) => i.code.includes("TECH.FACP.ZONE.3")), "FACP Zone short circuit (3) phải có");
console.assert(allIncidents.some((i) => i.code.includes("UPS-02.UPSVoltage") && i.kind === "Vượt ngưỡng"), "UPSVoltage ngoài ngưỡng phải có");
console.assert(allIncidents.some((i) => i.code.includes("UPS-02.UPSCurrent") && i.kind === "Vượt ngưỡng"), "UPSCurrent ngoài ngưỡng phải có");
console.assert(allIncidents.some((i) => i.code.includes("PUMP-02.PipePressure.HIGH")), "PipePressure cao phải có");
console.assert(allIncidents.some((i) => i.code.includes("PUMP-02.WaterFlow.HIGH")), "WaterFlow cao phải có");
// Risk tests
const __riskA = computeRisk(allIncidents.filter(i=>i.site.id==="SITE-A"));
const __riskB = computeRisk(allIncidents.filter(i=>i.site.id==="SITE-B"));
console.assert(__riskA>=0 && __riskA<=100 && __riskB>=0 && __riskB<=100, "Risk phải nằm trong [0,100]");
console.assert(__riskA>=70, "SITE-A nhiều lỗi → Risk cao (>=70)");
console.assert(__riskB>=70, "SITE-B nhiều lỗi → Risk cao (>=70)");

// ---------------- UI Helpers ----------------
const domainIcon: Record<string, any> = {
  UPS: Activity,
  Pump: Waves,
  Fan: FanIcon,
  Camera: Camera,
  "GW-A": Gauge,
  "GW-M": Gauge,
  FACP: AlertTriangle,
  Door: MapPin,
  Generator: Power,
};

function StatusBadge({ label, tone }: { label: string; tone: "red" | "blue" | "amber" | "emerald" | "slate" }) {
  const map: Record<string, string> = {
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${map[tone] || map.slate}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function Pill({ children, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{children}</button>
  );
}

function RiskBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 70 ? "bg-red-600" : pct >= 40 ? "bg-amber-500" : "bg-emerald-500";
  const label = pct >= 70 ? "Cao" : pct >= 40 ? "Trung bình" : "Thấp";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
        <span>Chỉ số rủi ro</span>
        <span className="font-semibold text-slate-800">{pct}/100 • {label}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RiskLegend() {
  const items = [
    { k: "+40", v: "Gateway (GW-A/GW-M) mất kết nối – root cause" },
    { k: "+25", v: "Thiết bị offline (không phải cascade)" },
    { k: "+8", v: "Cascade do gateway" },
    { k: "+30", v: "FACP Zone 2/3 (hở/đoản mạch)" },
    { k: "+10", v: "AC/DC/UPS/FAN/PUMP Voltage|Current vượt ngưỡng" },
    { k: "+8", v: "WaterFlow/PipePressure vượt ngưỡng" },
    { k: "+10 × n (≤30)", v: "Mỗi cửa mở (Door01..05)" },
    { k: "+15", v: "Sự cố miền Generator (offline/cascade)" },
  ];
  return (
    <div className="text-xs text-slate-600">
      <div className="mb-1 font-semibold text-slate-800">Quy ước chấm điểm RISK</div>
      <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
        {items.map((it, i)=> (
          <li key={i} className="flex items-start gap-2"><span className="font-mono font-semibold text-blue-700">{it.k}</span><span>{it.v}</span></li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- Definitions Panel ----------------
function DefinitionsPanel({ onClose }: { onClose: () => void }) {
  const rows = [
    { domain: "GW-A", code: "TECH.OFFLINE.GW-A-xx / TECH.CASCADE.GW-A.*", desc: "Gateway Alarm mất kết nối • cascade tới FACP/SOS/điều khiển" },
    { domain: "GW-M", code: "TECH.OFFLINE.GW-M-xx / TECH.CASCADE.GW-M.*", desc: "Gateway Metrics mất kết nối • cascade tới UPS/Fan/Pump/Door/Gen" },
    { domain: "FACP", code: "TECH.FACP.ZONE.[2|3]", desc: "2=Hở mạch, 3=Đoản mạch" },
    { domain: "FACP", code: "TECH.THRESH.FACP-xx.(ACVoltage|DCVoltage).[HIGH|LOW]", desc: "AC 200–250V, DC 20–30V" },
    { domain: "UPS", code: "TECH.THRESH.UPS-xx.(UPSVoltage|UPSCurrent).[HIGH|LOW] • TECH.STATUS.UPS", desc: "Voltage 200–250V, Current 0–20A, OFF= mất kết nối" },
    { domain: "Fan", code: "TECH.THRESH.FAN-xx.(FANVoltage|FANCurrent).[HIGH|LOW] • TECH.STATUS.FAN", desc: "Voltage 200–250V, Current 0–10A" },
    { domain: "Pump", code: "TECH.THRESH.PUMP-xx.(PUMPVoltage|PUMPCurrent|WaterFlow|PipePressure).[HIGH|LOW] • TECH.STATUS.PUMP", desc: "Voltage 200–250V, Current 0–20A, Flow 5–20, Pressure 10–50" },
    { domain: "Door", code: "TECH.DOOR.OPEN.*", desc: "Door01..Door05 = Open → cảnh báo" },
    { domain: "Generator", code: "(Trạng thái) GenStatus Online/Offline", desc: "Hiển thị trạng thái vận hành" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2"><Info className="h-4 w-4 text-blue-700"/><h3 className="text-sm font-semibold text-slate-800">Quy ước mã sự cố kỹ thuật</h3></div>
          <button onClick={onClose} className="rounded-lg border px-2 py-1 text-xs">Đóng</button>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div>
            <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="w-36 px-3 py-2">Thiết bị</th>
                  <th className="px-3 py-2">Mã/Pattern</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-800">{r.domain}</td>
                    <td className="px-3 py-2 font-mono text-xs text-blue-700">{r.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RiskLegend />
        </div>
      </div>
    </div>
  );
}

// ---------------- Smart Filter (Overview) ----------------
function SmartFilterBar({ smart, setSmart, query, setQuery }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={()=>setOpen(!open)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <SlidersHorizontal className="h-4 w-4"/>Bộ lọc thông minh
        </button>
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm chi nhánh / địa chỉ" className="w-56 text-sm outline-none placeholder:text-slate-400" />
        </div>
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Nguồn gốc</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={smart.rootOnly} onChange={(e)=>setSmart({...smart, rootOnly:e.target.checked})}/> Chỉ root-cause (ẩn cascade)</label>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Gateway</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">GW-A:</span>
              <select value={smart.gwA} onChange={(e)=>setSmart({...smart, gwA:e.target.value})} className="rounded-lg border border-slate-300 p-1.5 text-xs">
                <option value="any">Bất kỳ</option>
                <option value="down">Down</option>
                <option value="up">Up</option>
              </select>
              <span className="ml-2 text-slate-600">GW-M:</span>
              <select value={smart.gwM} onChange={(e)=>setSmart({...smart, gwM:e.target.value})} className="rounded-lg border border-slate-300 p-1.5 text-xs">
                <option value="any">Bất kỳ</option>
                <option value="down">Down</option>
                <option value="up">Up</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Điều kiện</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={smart.needDoorOpen} onChange={(e)=>setSmart({...smart, needDoorOpen:e.target.checked})}/> Có cửa đang mở</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={smart.needGenOff} onChange={(e)=>setSmart({...smart, needGenOff:e.target.checked})}/> Máy phát tắt</label>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Ngưỡng RISK tối thiểu</div>
            <input type="range" min={0} max={100} value={smart.minRisk} onChange={(e)=>setSmart({...smart, minRisk: Number(e.target.value)})} className="w-full"/>
            <div className="text-xs text-slate-600">Hiện nhánh có Risk ≥ <span className="font-semibold text-slate-800">{smart.minRisk}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Branch-first Overview ----------------
function BranchOverview({ onOpenBranch }: any) {
  const [query, setQuery] = useState("");
  const [showDefs, setShowDefs] = useState(false);
  const [smart, setSmart] = useState({ rootOnly:false, gwA:"any", gwM:"any", needDoorOpen:false, needGenOff:false, minRisk:0 });

  const branches = useMemo(() => {
    const byId = new globalThis.Map();
    devices.forEach((d) => {
      const key = d.site.id;
      if (!byId.has(key)) byId.set(key, { site: d.site, devices: [] as any[] });
      byId.get(key).devices.push(d);
    });
    const arr = Array.from(byId.values()).map((b: any) => {
      const incidents = allIncidents.filter((i) => i.site.id === b.site.id);
      const offline = incidents.filter((i) => i.kind === "Mất kết nối").length;
      const outOfRange = incidents.filter((i) => i.kind === "Vượt ngưỡng").length;
      const risk = computeRisk(incidents);
      const gwA = b.devices.find((d:any)=>d.domain==="GW-A")?.online !== false; // true if up
      const gwM = b.devices.find((d:any)=>d.domain==="GW-M")?.online !== false;
      const hasDoorOpen = incidents.some((i)=> i.domain==="Door" && i.kind==="Cửa mở");
      const genDev = b.devices.find((d:any)=> d.domain==="Generator");
      const hasGenOff = genDev ? (String(genDev.metrics?.GenStatus||"").toLowerCase()==="offline" || !genDev.online) : false;
      const rootOnlyOk = incidents.some((i)=> !String(i.code).startsWith("TECH.CASCADE."));
      return { ...b, incidents, metrics: { offline, outOfRange, risk }, flags: { gwA, gwM, hasDoorOpen, hasGenOff, rootOnlyOk } };
    });
    return arr.filter((b: any) => {
      const qOk = query === "" || b.site.name.toLowerCase().includes(query.toLowerCase()) || b.site.address.toLowerCase().includes(query.toLowerCase());
      const gwAOk = smart.gwA === "any" ? true : (smart.gwA === "down" ? !b.flags.gwA : b.flags.gwA);
      const gwMOk = smart.gwM === "any" ? true : (smart.gwM === "down" ? !b.flags.gwM : b.flags.gwM);
      const doorOk = smart.needDoorOpen ? b.flags.hasDoorOpen : true;
      const genOk = smart.needGenOff ? b.flags.hasGenOff : true;
      const rootOk = smart.rootOnly ? b.flags.rootOnlyOk : true;
      const riskOk = b.metrics.risk >= smart.minRisk;
      return qOk && gwAOk && gwMOk && doorOk && genOk && rootOk && riskOk;
    });
  }, [query, smart]);

  return (
    <div className="min-h-screen bg-slate-50">
      {showDefs && <DefinitionsPanel onClose={() => setShowDefs(false)} />}
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Ứng cứu kỹ thuật</h1>
            <p className="text-sm text-slate-600">Bám sát ND105: Điều 4 (hồ sơ), Điều 24 (CSDL), Điều 25-27 (tình trạng thiết bị)</p>
          </div>
          <button onClick={() => setShowDefs(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
            <Info className="h-4 w-4"/>Quy ước mã & RISK
          </button>
        </div>

        <SmartFilterBar smart={smart} setSmart={setSmart} query={query} setQuery={setQuery} />

        {/* Branch cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b: any) => (
            <div key={b.site.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-900">
                    <Building2 className="h-5 w-5 text-blue-700" />
                    <span className="text-base font-semibold">{b.site.name}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {b.site.address}{" "}
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.site.address)}`} target="_blank" rel="noreferrer" className="text-blue-700 hover:text-blue-800">
                      (Map)
                    </a>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Issues</div>
                  <div className="text-lg font-bold text-slate-900">{b.incidents.length}</div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-red-50 p-2">
                  <div className="text-[11px] font-semibold text-red-700">OFFLINE</div>
                  <div className="text-xl font-bold">{b.metrics.offline}</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-2">
                  <div className="text-[11px] font-semibold text-amber-700">VƯỢT NGƯỠNG</div>
                  <div className="text-xl font-bold">{b.metrics.outOfRange}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  <div className="text-[11px] font-semibold text-slate-700">RISK</div>
                  <div className="text-xl font-bold">{b.metrics.risk}</div>
                </div>
              </div>
              <div className="mt-3"><RiskBar score={b.metrics.risk} /></div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-slate-500">GW-A: {b.flags.gwA? <span className="text-emerald-700">Up</span> : <span className="text-red-700">Down</span>} • GW-M: {b.flags.gwM? <span className="text-emerald-700">Up</span> : <span className="text-red-700">Down</span>}</div>
                <button onClick={() => onOpenBranch(b)} className="rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">Xem sự cố</button>
              </div>
              {(b.flags.hasDoorOpen || b.flags.hasGenOff) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {b.flags.hasDoorOpen && <StatusBadge label="Cửa đang mở" tone="amber"/>}
                  {b.flags.hasGenOff && <StatusBadge label="Máy phát tắt" tone="slate"/>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Branch Incidents (list for a selected branch) ----------------
function BranchIncidents({ branch, onBack, onOpenIncident }: any) {
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("Tất cả");
  const [typeFilter, setTypeFilter] = useState("Tất cả");

  const incidents = useMemo(() => allIncidents.filter((i) => i.site.id === branch.site.id), [branch]);

  const filtered = useMemo(
    () =>
      incidents.filter(
        (i) =>
          (domainFilter === "Tất cả" || i.domain === domainFilter) &&
          (typeFilter === "Tất cả" || i.kind === typeFilter) &&
          (query === "" || i.code.toLowerCase().includes(query.toLowerCase()) || i.deviceId.toLowerCase().includes(query.toLowerCase()))
      ),
    [incidents, domainFilter, typeFilter, query]
  );

  const allDomains = ["Tất cả", "GW-A", "GW-M", "FACP", "UPS", "Fan", "Pump", "Door", "Generator", "Camera"];

  const renderDetail = (it: any) => {
    if (it.domain === "Door") {
      const dev = devices.find((d)=> d.id === it.deviceId);
      const doors = ["Door01","Door02","Door03","Door04","Door05"]; // render all 5
      return (
        <div className="flex flex-wrap gap-1.5">
          {doors.map((k)=>{
            const st = String(dev?.metrics?.[k]||"?");
            const open = st.toLowerCase()==="open";
            return <span key={k} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${open?"bg-amber-100 text-amber-700 animate-pulse":"bg-slate-100 text-slate-600"}`}>{k}: {st}</span>;
          })}
        </div>
      );
    }
    if (it.domain === "Generator") {
      const dev = devices.find((d)=> d.id === it.deviceId);
      const st = String(dev?.metrics?.GenStatus||"?");
      return <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${st.toLowerCase()==="online"?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-700"}`}>GenStatus: {st}</span>;
    }
    return it.detail;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          <ChevronLeft className="h-4 w-4" />Quay về danh sách chi nhánh
        </button>
        <div className="mb-1 text-xl font-semibold text-slate-900">{branch.site.name}</div>
        <div className="mb-4 text-sm text-slate-600">
          {branch.site.address}{" "}
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.site.address)}`} className="text-blue-700" target="_blank" rel="noreferrer">(Map)</a>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {allDomains.map((d) => (
            <Pill key={d} active={domainFilter === d} onClick={() => setDomainFilter(d)}>{d}</Pill>
          ))}
          <div className="mx-2 h-6 w-px bg-slate-200" />
          {["Tất cả", "Mất kết nối", "Vượt ngưỡng"].map((t) => (
            <Pill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>{t}</Pill>
          ))}
          <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã sự cố / thiết bị" className="w-56 text-sm outline-none placeholder:text-slate-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-200">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="w-[60px] px-4 py-3">STT</th>
                  <th className="px-4 py-3">Mã sự cố</th>
                  <th className="px-4 py-3">Thiết bị</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Chi tiết</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((it: any, idx: number) => {
                  const Icon = domainIcon[it.domain] || Wrench;
                  const pulse = it.kind === "Mất kết nối" ? "animate-pulse" : "";
                  return (
                    <tr key={it.code} className={`hover:bg-slate-50 ${pulse}`}>
                      <td className="px-4 py-3 text-sm text-slate-600">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{it.code}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="font-medium">{it.deviceId}</span>
                          <StatusBadge label={it.domain} tone="slate" />
                        </div>
                      </td>
                      <td className="px-4 py-3">{it.kind === "Mất kết nối" ? <StatusBadge label="Mất kết nối" tone="red" /> : <StatusBadge label="Vượt ngưỡng" tone="amber" />}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{renderDetail(it)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{it.at}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => onOpenIncident(it)} className="inline-flex items-center gap-1 rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">
                          Chi tiết <ExternalLink className="h-3 w-3"/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Metric Tile ----------------
function MetricTile({ label, value, unit, state }: any) {
  const color = state === "err" ? "text-red-600" : state === "warn" ? "text-amber-600" : "text-slate-900";
  const bg = state === "err" ? "bg-red-50" : state === "warn" ? "bg-amber-50" : "bg-slate-50";
  return (
    <div className={`rounded-xl ${bg} p-3`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}{unit ? <span className="ml-1 text-sm text-slate-500">{unit}</span> : null}</div>
    </div>
  );
}

// ---------------- Detail Screen with professional ticketing ----------------
function TechnicalDetail({ incident, onBack }: any) {
  const device = devices.find((d) => d.id === incident.deviceId) || devices[0];
  const tiles: any[] = [];
  for (const key in device.metrics) {
    const v = device.metrics[key];
    const spec = metricSpecs[key];
    if (spec && typeof v === "number") {
      const out = v < spec.min || v > spec.max;
      tiles.push({ label: spec.label, value: v, unit: spec.unit, state: out ? "err" : "ok" });
    }
  }

  type LogItem = { at: string; actor: string; text: string };
  const [opsLog, setOpsLog] = useState<LogItem[]>([]);
  const addLog = (text: string, at?: string) => setOpsLog((l) => [...l, { at: at || new Date().toLocaleTimeString("vi-VN", { hour12: false }), actor: "Admin tenant", text }]);

  // Manual timeline input
  const [logTime, setLogTime] = useState<string>(()=>{
    const d = new Date(); d.setSeconds(0); d.setMilliseconds(0); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  });
  const [logText, setLogText] = useState<string>("");

  // Quick actions
  const [busy, setBusy] = useState<string | null>(null);
  const doAction = async (name: string, cb: () => void) => {
    if (busy) return;
    setBusy(name);
    addLog(`Thực hiện lệnh: ${name}`);
    setTimeout(() => { cb(); addLog(`Hoàn tất: ${name}`); setBusy(null); }, 600);
  };

  // Ticketing: assign + vendor
  type Staff = { id: string; name: string; role: string; phone: string };
  type Vendor = { id: string; name: string; hotline: string };
  const staff: Staff[] = [
    { id: "EMP-01", name: "Nguyễn Văn A", role: "Kỹ thuật trưởng", phone: "0901 234 567" },
    { id: "EMP-02", name: "Trần Thị B", role: "Kỹ sư điện", phone: "0902 345 678" },
    { id: "EMP-03", name: "Lê Văn C", role: "Bảo trì cơ điện", phone: "0903 456 789" },
  ];
  const vendors: Vendor[] = [
    { id: "VN-UPS", name: "Hãng UPS Co.", hotline: "1800-1111" },
    { id: "VN-PUMP", name: "Bơm Việt Service", hotline: "1800-2222" },
    { id: "VN-FACP", name: "FirePanel JSC", hotline: "1800-3333" },
  ];

  type Ticket = { id: string; status: "Open" | "Resolved"; startedAt: number; slaMin: number; assignee?: Staff; vendor?: Vendor; note?: string };
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [assigneeId, setAssigneeId] = useState<string>(staff[0].id);
  const [vendorId, setVendorId] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const openTicket = () => {
    if (ticket) return;
    const asg = staff.find((s) => s.id === assigneeId)!;
    const vend = vendors.find((v) => v.id === vendorId);
    const t: Ticket = {
      id: `TCK-${Math.floor(Math.random() * 9999)}`,
      status: "Open",
      startedAt: Date.now(),
      slaMin: 120,
      assignee: asg,
      vendor: vend,
      note,
    };
    setTicket(t);
    addLog(`Tạo ticket ${t.id} • Giao cho ${asg.name}${vend ? ` • Gửi hãng ${vend.name}` : ""}`);
  };
  const resolveTicket = () => { if (!ticket) return; setTicket({ ...ticket, status: "Resolved" }); addLog(`Đánh dấu ticket ${ticket.id} hoàn tất`); };
  const remainingMin = ticket ? Math.max(0, ticket.slaMin - Math.floor((Date.now() - ticket.startedAt) / 60000)) : 0;

  const Icon = domainIcon[device.domain] || Wrench;
  const googleLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(device.site.address)}`;

  // --- Extra test for timeline input
  console.assert(typeof addLog === "function", "Phải có hàm addLog cho timeline");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"><ChevronLeft className="h-4 w-4"/>Quay lại</button>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-slate-500"/><h1 className="text-xl font-semibold text-slate-900">Chi tiết sự cố kỹ thuật • {incident.code}</h1></div>
            <div className="mt-1 text-sm text-slate-600">Thiết bị: <span className="font-medium text-slate-800">{device.id}</span> — {device.domain}</div>
            <div className="text-sm text-slate-600">{device.site.name} — {device.site.address} <a href={googleLink} target="_blank" rel="noreferrer" className="text-blue-700 hover:text-blue-800">(Map)</a></div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge label={device.online ? "Online" : "Offline"} tone={device.online ? "emerald" : "red"}/>
            <StatusBadge label={incident.kind} tone={incident.kind === "Mất kết nối" ? "red" : "amber"}/>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{incident.at}</span>
          </div>
        </div>

        {/* Top: metrics + device state */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-800">Thông số & Ngưỡng</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {tiles.length === 0 ? (
                <div className="col-span-full text-sm text-slate-500">Thiết bị này không có thông số dạng số cần theo dõi.</div>
              ) : (
                tiles.map((t, i) => <MetricTile key={i} label={t.label} value={t.value} unit={t.unit} state={t.state}/>)
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-slate-800">Tình trạng thiết bị</div>
            <div className="space-y-2 text-sm">
              <div>Online: <span className={`font-semibold ${device.online ? "text-emerald-700" : "text-red-700"}`}>{device.online ? "Yes" : "No"}</span></div>
              <div>Lần cập nhật: <span className="font-medium text-slate-800">{device.updatedAt}</span></div>
            </div>
          </div>
        </div>

        {/* Actions & SOP */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><Wrench className="h-4 w-4"/>Ứng cứu kỹ thuật tức thì</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <button disabled={busy!==null} onClick={()=>doAction("Khởi động lại bơm", ()=>{})} className="flex items-center justify-center gap-2 rounded-xl bg-blue-900 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"><RotateCcw className="h-4 w-4"/>Khởi động lại bơm</button>
              <button disabled={busy!==null} onClick={()=>doAction("Reset cảm biến", ()=>{})} className="flex items-center justify-center gap-2 rounded-xl bg-blue-900 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"><RefreshCcw className="h-4 w-4"/>Reset cảm biến</button>
              <button disabled={busy!==null} onClick={()=>doAction("Chuyển sang nguồn dự phòng", ()=>{})} className="flex items-center justify-center gap-2 rounded-xl bg-blue-900 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"><Power className="h-4 w-4"/>Chuyển nguồn dự phòng</button>
            </div>
            <div className="mt-4 text-xs text-slate-500">Ghi nhận log thao tác: mọi lệnh sẽ vào nhật ký bên dưới.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><ClipboardList className="h-4 w-4"/>Kịch bản khắc phục (SOP)</div>
            <ul className="list-inside list-disc text-sm text-slate-700">
              <li>Khắc phục mất nguồn</li>
              <li>Khắc phục mất áp bơm</li>
              <li>Khắc phục lỗi cảm biến</li>
            </ul>
            <div className="mt-3"><button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Mở thư viện SOP</button></div>
          </div>
        </div>

        {/* Ticketing & Remote support */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><TicketIcon className="h-4 w-4"/>Ticket & SLA</div>
            {ticket ? (
              <div className="space-y-2 text-sm">
                <div>Mã ticket: <span className="font-semibold text-slate-800">{ticket.id}</span></div>
                <div>Trạng thái: <StatusBadge label={ticket.status} tone={ticket.status==="Open"?"amber":"emerald"}/></div>
                <div>Nhân sự phụ trách: <span className="font-medium text-slate-800">{ticket.assignee?.name}</span> • {ticket.assignee?.role} • {ticket.assignee?.phone}</div>
                {ticket.vendor && (<div>Nhà cung cấp: <span className="font-medium text-slate-800">{ticket.vendor.name}</span> • Hotline {ticket.vendor.hotline}</div>)}
                {ticket.note && (<div>Ghi chú: <span className="text-slate-700">{ticket.note}</span></div>)}
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-500"/><span>Còn lại ~ {remainingMin} phút (SLA {ticket.slaMin}p)</span></div>
                <div className="flex gap-2"><button onClick={resolveTicket} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Đánh dấu hoàn tất</button></div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-600">Giao cho</div>
                  <select value={assigneeId} onChange={(e)=>setAssigneeId(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
                    {staff.map((s)=> (<option key={s.id} value={s.id}>{s.name} — {s.role} — {s.phone}</option>))}
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-600">Gửi hãng bảo trì (tuỳ chọn)</div>
                  <select value={vendorId} onChange={(e)=>setVendorId(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
                    <option value="">— Không gửi —</option>
                    {vendors.map((v)=> (<option key={v.id} value={v.id}>{v.name} — {v.hotline}</option>))}
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-600">Mô tả / Ghi chú</div>
                  <textarea value={note} onChange={(e)=>setNote(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-slate-300 p-2 text-sm" placeholder="Mô tả nhanh nguyên nhân dự kiến, bộ phận bị ảnh hưởng..." />
                </div>
                <button onClick={openTicket} className="w-full rounded-lg bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Tạo ticket</button>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><Phone className="h-4 w-4"/>Remote support</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"><Video className="mr-2 inline h-4 w-4"/>Bắt đầu video call</button>
              <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Mở chat hỗ trợ</button>
            </div>
            <div className="mt-3 text-xs text-slate-500">Phối hợp đội kỹ thuật chi nhánh/nhà thầu — lưu thời gian tương tác để tính SLA.</div>
          </div>
        </div>

        {/* Nhật ký kỹ thuật + Hồ sơ PCCC */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Nhật ký kỹ thuật (timeline)</div>
              <div className="text-xs text-slate-500">{opsLog.length} mục</div>
            </div>
            {/* Input row */}
            <div className="mb-3 grid grid-cols-1 items-end gap-2 md:grid-cols-[180px,1fr,120px]">
              <div>
                <div className="mb-1 text-xs text-slate-600">Thời điểm</div>
                <input type="datetime-local" value={logTime} onChange={(e)=>setLogTime(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-600">Nội dung</div>
                <input value={logText} onChange={(e)=>setLogText(e.target.value)} placeholder="Nhập ghi chú/diễn biến..." className="w-full rounded-lg border border-slate-300 p-2 text-sm"/>
              </div>
              <button onClick={()=>{ if(!logText) return; const at = new Date(logTime).toLocaleString("vi-VN"); addLog(logText, at); setLogText(""); }} className="h-10 rounded-lg bg-blue-900 text-sm font-semibold text-white hover:bg-blue-800">Thêm mốc</button>
            </div>
            {/* Timeline list */}
            {opsLog.length === 0 ? (
              <div className="text-sm text-slate-500">Chưa có ghi nhận — thao tác ở phần trên để tạo log.</div>
            ) : (
              <ol className="space-y-2">
                {opsLog.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-700"/>
                    <div>
                      <div className="text-xs text-slate-500">{l.at} • {l.actor}</div>
                      <div className="text-sm text-slate-800">{l.text}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-slate-800">Kết nối hồ sơ PCCC</div>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> <span>Ghi vào PC01</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> <span>Ghi vào PC04</span></label>
              <div className="text-xs text-slate-500">Tuân thủ ND105: Điều 4 (hồ sơ), Điều 24 (CSDL), Điều 25–27 (cập nhật tình trạng).</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Page Wrapper ----------------
export default function TechnicalRescuePage() {
  const [branchOpen, setBranchOpen] = useState<any | null>(null);
  const [incidentOpen, setIncidentOpen] = useState<any | null>(null);
  if (incidentOpen) return <TechnicalDetail incident={incidentOpen} onBack={() => setIncidentOpen(null)} />;
  if (branchOpen) return <BranchIncidents branch={branchOpen} onBack={() => setBranchOpen(null)} onOpenIncident={setIncidentOpen} />;
  return <BranchOverview onOpenBranch={setBranchOpen} />;
}
