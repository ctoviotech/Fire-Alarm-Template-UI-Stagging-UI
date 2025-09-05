import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  Server,
  Gauge,
  Camera as CameraIcon,
  Settings,
  Building2,
  ShieldCheck,
  Radio,
  Plus,
  MapPin,
  Users,
  Trash2,
  Edit3,
  Phone,
  User,
  Activity,
  Battery,
  Zap,
  Flame,
  DoorOpen,
  DoorClosed,
  Fan as FanIcon,
  Power,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// =============================================================
// Types & Helpers (aligned to Metrics & Flow Data spec)
// =============================================================

type BranchId = "ALL" | "HCM-01" | "HN-01" | "DN-01";

interface Contact { name: string; phone: string }

interface BranchRec {
  id: Exclude<BranchId, "ALL">;
  name: string;
  gps: { lat: number; lng: number };
  contacts: { director: Contact; securityLead: Contact; engineeringLead: Contact };
}

interface GatewayRow { name: string; type: "GW-A" | "GW-M"; branch: BranchId; online: boolean; id: string; }

// ------------ Device Models per spec -------------
export type DeviceType =
  | "FACP"   // GW-A
  | "INPUT"  // GW-A (4 kênh)
  | "OUTPUT" // GW-A (4 kênh)
  | "UPS"    // GW-M
  | "FAN"    // GW-M
  | "PUMP"   // GW-M
  | "DOOR"   // GW-M (Cửa thoát hiểm)
  | "GEN"    // GW-M (Máy phát)
  | "CAM";   // Camera

export interface DeviceBase { id: string; type: DeviceType; branch: Exclude<BranchId, "ALL">; online: boolean }

export interface DeviceFACP extends DeviceBase {
  type: "FACP";
  ACvoltage: number; // 200..250 bình thường
  DCvoltage: number; // 20..30 bình thường
  zones: Array<{ name: string; state: 0 | 1 | 2 | 3 }>; // 0 NORM,1 FIRE,2 OPEN,3 SHORT
}

export interface DeviceInput extends DeviceBase {
  type: "INPUT";
  channels: Array<{ id: 1 | 2 | 3 | 4; label: string; state: 0 | 1 }>;
}

export interface DeviceOutput extends DeviceBase {
  type: "OUTPUT";
  channels: Array<{ id: 1 | 2 | 3 | 4; label: string; state: 0 | 1 }>;
}

export interface DeviceUPS extends DeviceBase {
  type: "UPS";
  UPSvoltage: number; // 200..250 bình thường
  UPScurrent: number; // 0..20
}

export interface DeviceFan extends DeviceBase {
  type: "FAN";
  FANvoltage: number; // 200..250 bình thường
  FANcurrent: number; // 0..10
}

export interface DevicePump extends DeviceBase {
  type: "PUMP";
  PUMPvoltage: number; // 200..250 bình thường
  PUMPcurrent: number; // 0..20
  PipePressure: number; // kPa (SI)
  WaterFlow: number;   // tuỳ đơn vị, giữ nguyên số
}

export interface DeviceDoor extends DeviceBase { type: "DOOR"; StateDoor: 0 | 1 } // 0 mở,1 đóng
export interface DeviceGen extends DeviceBase { type: "GEN"; StateGenerator: 0 | 1 } // 0 off,1 on
export interface DeviceCam extends DeviceBase { type: "CAM"; recording: boolean; location?: string }

export type Device =
  | DeviceFACP | DeviceInput | DeviceOutput | DeviceUPS | DeviceFan | DevicePump | DeviceDoor | DeviceGen | DeviceCam;

// =============================================================
// Mock Data
// =============================================================

const INIT_BRANCHES: BranchRec[] = [
  { id: "HCM-01", name: "Chi nhánh TP.HCM", gps: { lat: 10.776, lng: 106.7 }, contacts: { director: { name: "Nguyễn Văn A", phone: "+84 912 345 678" }, securityLead: { name: "Trần Thị B", phone: "+84 913 222 333" }, engineeringLead: { name: "Lê Quốc C", phone: "+84 914 111 222" } } },
  { id: "HN-01",  name: "Chi nhánh Hà Nội", gps: { lat: 21.028, lng: 105.854 }, contacts: { director: { name: "Phạm Văn D", phone: "+84 915 444 555" }, securityLead: { name: "Đỗ Thị E", phone: "+84 916 666 777" }, engineeringLead: { name: "Vũ Minh F", phone: "+84 917 888 999" } } },
  { id: "DN-01",  name: "Chi nhánh Đà Nẵng", gps: { lat: 16.054, lng: 108.202 }, contacts: { director: { name: "Ngô Thanh G", phone: "+84 918 000 111" }, securityLead: { name: "Huỳnh Hải H", phone: "+84 919 222 444" }, engineeringLead: { name: "Bùi Đức I", phone: "+84 920 555 777" } } },
];

const GATEWAYS: GatewayRow[] = [
  { id: "GW-A-01", name: "Gateway Báo động #01", type: "GW-A", branch: "HCM-01", online: true },
  { id: "GW-M-01", name: "Gateway Kỹ thuật #01", type: "GW-M", branch: "HCM-01", online: true },
  { id: "GW-A-02", name: "Gateway Báo động #02", type: "GW-A", branch: "HN-01", online: true },
  { id: "GW-M-02", name: "Gateway Kỹ thuật #02", type: "GW-M", branch: "DN-01", online: false },
];

// =============================================================
// Map Positions (Dashboard ALL)
// =============================================================

const BRANCH_POS: Record<Exclude<BranchId, "ALL">, { top: number; left: number }> = {
  "HCM-01": { top: 75, left: 46 },
  "HN-01": { top: 18, left: 63 },
  "DN-01": { top: 55, left: 58 },
};

const STATUS_COLORS: Record<string, string> = { success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// =============================================================
// Seed & Realtime mutate (align ranges to spec)
// =============================================================

function seedDevices(branch: Exclude<BranchId, "ALL">): Device[] {
  const zones = Array.from({ length: 8 }, (_, i) => ({ name: `Zone ${String(i + 1).padStart(2, "0")}` as string, state: 0 as 0 }));
  return [
    { id: `${branch}-FACP-01`, type: "FACP", branch, online: true, ACvoltage: 230, DCvoltage: 26, zones },
    { id: `${branch}-IN-01`,   type: "INPUT", branch, online: true, channels: [
      { id: 1, label: "SOS", state: 0 },
      { id: 2, label: "Cảm biến cửa", state: 0 },
      { id: 3, label: "Custom-3", state: 0 },
      { id: 4, label: "Custom-4", state: 0 },
    ] },
    { id: `${branch}-OUT-01`,  type: "OUTPUT", branch, online: true, channels: [
      { id: 1, label: "Còi hú", state: 0 },
      { id: 2, label: "Nhả khói", state: 0 },
      { id: 3, label: "Cầu dao", state: 0 },
      { id: 4, label: "Custom-4", state: 0 },
    ] },
    { id: `${branch}-UPS-01`,  type: "UPS", branch, online: true, UPSvoltage: 225, UPScurrent: 5 },
    { id: `${branch}-FAN-01`,  type: "FAN", branch, online: true, FANvoltage: 230, FANcurrent: 3 },
    { id: `${branch}-PUMP-01`, type: "PUMP", branch, online: true, PUMPvoltage: 235, PUMPcurrent: 8, PipePressure: 220, WaterFlow: 12 },
    { id: `${branch}-DOOR-01`, type: "DOOR", branch, online: true, StateDoor: 1 },
    { id: `${branch}-DOOR-02`, type: "DOOR", branch, online: true, StateDoor: 1 },
    { id: `${branch}-DOOR-03`, type: "DOOR", branch, online: true, StateDoor: 0 },
    { id: `${branch}-DOOR-04`, type: "DOOR", branch, online: true, StateDoor: 1 },
    { id: `${branch}-GEN-01`,  type: "GEN", branch, online: true, StateGenerator: 0 },
    { id: `${branch}-CAM-01`,  type: "CAM", branch, online: true, recording: true,  location: "Kho A - Lối thoát" },
    { id: `${branch}-CAM-02`,  type: "CAM", branch, online: true, recording: false, location: "Tầng 3 - Hành lang" },
  ];
}

function mutateDevice(d: Device): Device {
  if (!d.online && Math.random() < 0.1) return { ...d, online: true };
  switch (d.type) {
    case "FACP": {
      const ACvoltage = clamp(d.ACvoltage + (Math.random() - 0.5) * 4, 180, 260);
      const DCvoltage = clamp(d.DCvoltage + (Math.random() - 0.5) * 1, 15, 35);
      const zones = d.zones.map((z) => ({ ...z }));
      if (Math.random() < 0.06) { const i = Math.floor(Math.random() * zones.length); zones[i].state = ([0,1,2,3] as const)[Math.floor(Math.random()*4)]; }
      return { ...d, ACvoltage, DCvoltage, zones };
    }
    case "INPUT": {
      const channels = d.channels.map((c) => ({ ...c }));
      if (Math.random() < 0.05) { const i = Math.floor(Math.random()*channels.length); channels[i].state = channels[i].state ? 0 : 1; }
      return { ...d, channels };
    }
    case "OUTPUT": {
      const channels = d.channels.map((c) => ({ ...c }));
      if (Math.random() < 0.03) { const i = Math.floor(Math.random()*channels.length); channels[i].state = channels[i].state ? 0 : 1; }
      return { ...d, channels };
    }
    case "UPS": {
      const UPSvoltage = clamp(d.UPSvoltage + (Math.random()-0.5)*2, 190, 260);
      const UPScurrent = clamp(d.UPScurrent + (Math.random()-0.5)*1.5, 0, 25);
      return { ...d, UPSvoltage, UPScurrent };
    }
    case "FAN": {
      const FANvoltage = clamp(d.FANvoltage + (Math.random()-0.5)*2, 190, 260);
      const FANcurrent = clamp(d.FANcurrent + (Math.random()-0.5)*1, 0, 12);
      return { ...d, FANvoltage, FANcurrent };
    }
    case "PUMP": {
      const PUMPvoltage = clamp(d.PUMPvoltage + (Math.random()-0.5)*3, 190, 260);
      const PUMPcurrent = clamp(d.PUMPcurrent + (Math.random()-0.5)*2, 0, 25);
      const PipePressure = clamp(d.PipePressure + (Math.random()-0.5)*30, 0, 600); // kPa realistic scale
      const WaterFlow = clamp(d.WaterFlow + (Math.random()-0.5)*2.5, 0, 30);
      const online = Math.random() < 0.02 ? !d.online : d.online;
      return { ...d, PUMPvoltage, PUMPcurrent, PipePressure, WaterFlow, online };
    }
    case "DOOR": { const StateDoor = Math.random()<0.02 ? (d.StateDoor?0:1) : d.StateDoor; return { ...d, StateDoor }; }
    case "GEN":  { const StateGenerator = Math.random()<0.02 ? (d.StateGenerator?0:1) : d.StateGenerator; return { ...d, StateGenerator }; }
    case "CAM":  { const recording = Math.random()<0.05 ? !d.recording : d.recording; const online = Math.random()<0.01 ? !d.online : d.online; return { ...d, recording, online }; }
  }
}

function useRealtimeDevices(branch: BranchId) {
  const [devices, setDevices] = useState<Device[]>([]);
  useEffect(() => {
    if (branch === "ALL") { setDevices([]); return; }
    setDevices(seedDevices(branch));
    const iv = setInterval(() => setDevices((prev) => prev.map((d) => mutateDevice(d as any) as Device)), 2000);
    return () => clearInterval(iv);
  }, [branch]);
  return devices;
}

// =============================================================
// Small UI helpers
// =============================================================

const Pill = ({ text, tone = "gray" }: { text: string; tone?: "gray"|"green"|"red"|"amber"|"blue" }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${
    tone==="green"?"bg-emerald-600":tone==="red"?"bg-rose-600":tone==="amber"?"bg-amber-600":tone==="blue"?"bg-sky-600":"bg-gray-500"
  }`}>{text}</span>
);

function Bar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="w-full">
      {label && <div className="mb-1 text-xs text-gray-500">{label} ({pct}%)</div>}
      <div className="h-2 w-full rounded bg-gray-200">
        <div className="h-2 rounded bg-sky-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const zoneClass = (s: 0|1|2|3) => (s===0?"bg-emerald-600":s===1?"bg-rose-600":"bg-amber-500");
const zoneText = (s: 0|1|2|3) => (s===0?"Bình thường":s===1?"Cháy":s===2?"Hở mạch":"Chập mạch");

const acLabel = (v:number) => v<200?{t:"AC thấp",tone:"amber" as const}: v>250?{t:"AC cao",tone:"red" as const}:{t:"AC OK",tone:"green" as const};
const dcLabel = (v:number) => v<20?{t:"DC thấp",tone:"amber" as const}: v>30?{t:"DC cao",tone:"red" as const}:{t:"DC OK",tone:"green" as const};
const curLabel20 = (a:number) => a<0?{t:"I thấp",tone:"amber" as const}: a>20?{t:"I cao",tone:"red" as const}:{t:"I OK",tone:"green" as const};
const curLabel10 = (a:number) => a<0?{t:"I thấp",tone:"amber" as const}: a>10?{t:"I cao",tone:"red" as const}:{t:"I OK",tone:"green" as const};
const pressLabel = (p:number) => p<100?{t:"Áp yếu",tone:"amber" as const}: p>500?{t:"Áp cao",tone:"red" as const}:{t:"Áp OK",tone:"green" as const}; // kPa
const flowLabel = (f:number) => f<5?{t:"Lưu yếu",tone:"amber" as const}: f>20?{t:"Lưu cao",tone:"red" as const}:{t:"Lưu OK",tone:"green" as const};

// =============================================================
// Layout Shell
// =============================================================

type PageKey = "dashboard" | "devices" | "gwa" | "gwm" | "camera" | "radio" | "settings" | "branches";

function Sidebar({ active, onChange }: { active: PageKey; onChange: (p: PageKey) => void }) {
  const items = [
    { key: "dashboard", label: "Tổng quan Thiết bị", icon: <LayoutGrid className="h-4 w-4" /> },
    { key: "branches", label: "Chi nhánh", icon: <Building2 className="h-4 w-4" /> },
    { key: "gwa", label: "Gateway Báo động (GW‑A)", icon: <Server className="h-4 w-4" /> },
    { key: "gwm", label: "Gateway Kỹ thuật (GW‑M)", icon: <Gauge className="h-4 w-4" /> },
    { key: "camera", label: "Quản lý Camera", icon: <CameraIcon className="h-4 w-4" /> },
    { key: "radio", label: "Đàm thoại 4G (PTT)", icon: <Radio className="h-4 w-4" /> },
    { key: "settings", label: "Cấu hình & Cài đặt", icon: <Settings className="h-4 w-4" /> },
  ] as const;
  return (
    <aside className="h-full w-72 shrink-0 border-r bg-white/50 p-4">
      <div className="mb-6 flex items-center gap-2"><ShieldCheck className="h-5 w-5" /><div className="text-sm font-semibold">Quản lý Thiết bị</div></div>
      <nav className="space-y-1">
        {items.map((it) => (
          <button key={it.key} onClick={() => onChange(it.key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${active === it.key ? "bg-gray-900 text-white" : "hover:bg-gray-100"}`}>
            {it.icon}<span>{it.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function Topbar({ branch, setBranch }: { branch: BranchId; setBranch: (b: BranchId) => void }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/70 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3"><Building2 className="h-5 w-5" /><div className="text-sm text-gray-600">Portal Tenant</div></div>
      <div className="flex items-center gap-3">
        <Select value={branch} onValueChange={(v) => setBranch(v as BranchId)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Chọn chi nhánh" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toàn bộ Tổ chức</SelectItem>
            <SelectItem value="HCM-01">Chi nhánh HCM-01</SelectItem>
            <SelectItem value="HN-01">Chi nhánh HN-01</SelectItem>
            <SelectItem value="DN-01">Chi nhánh DN-01</SelectItem>
          </SelectContent>
        </Select>
        <div className="rounded-xl border px-3 py-1 text-xs text-gray-600">v1.3 • 03/09/2025</div>
      </div>
    </header>
  );
}

// =============================================================
// Reusable Frame Components (8 frames)
// =============================================================

function Frame({ title, icon, children, className = "", compact = false }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string; compact?: boolean }) {
  return (
    <Card className={`rounded-2xl shadow-sm ${className}`}>
      <CardHeader className={compact ? "pb-1 pt-3" : "pb-2"}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {icon}
        </div>
      </CardHeader>
      <CardContent className={compact ? "text-xs pt-0" : "text-xs"}>{children}</CardContent>
    </Card>
  );
}

function FacpFrame({ facp, className }: { facp?: DeviceFACP; className?: string }) {
  if (!facp) return <Frame title="FACP" icon={<Flame className="h-4 w-4" />} className={className}>Không có thiết bị.</Frame>;
  return (
    <Frame title="FACP" icon={<Flame className="h-4 w-4 text-rose-600" />} className={className}>
      {!facp.online && <div className="mb-2 text-rose-600">Offline</div>}
      <div className="mb-2 flex items-center gap-2">
        <Pill text={`AC ${facp.ACvoltage.toFixed(0)}V`} tone={acLabel(facp.ACvoltage).tone} />
        <Pill text={`DC ${facp.DCvoltage.toFixed(1)}V`} tone={dcLabel(facp.DCvoltage).tone} />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {facp.zones.map((z, idx) => {
          const s = z.state; const isFire = s === 1; const zoneId = `Z${String(idx+1).padStart(2,'0')}`;
          return (
            <div key={z.name} className={`relative h-12 overflow-hidden rounded ${zoneClass(s)} ${isFire? 'ring-2 ring-rose-400': ''}`} title={`${z.name} — ${zoneText(s)}`}>
              {isFire && <span className="absolute inset-0 animate-ping rounded bg-rose-400/60" />}
              <div className="relative z-10 flex h-full w-full flex-col items-center justify-center leading-tight text-[10px] font-semibold text-white">
                <div className="opacity-90">{zoneId}</div>
                <div className="text-[10px]">{zoneText(s)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

function IOFrame({ input, output, className }: { input?: DeviceInput; output?: DeviceOutput; className?: string }) {
  return (
    <Frame title="Khối I/O" icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} className={className}>
      <div className="grid grid-cols-1 gap-2">
        <div>
          <div className="mb-1 text-[11px] font-medium text-gray-500">INPUT</div>
          {input ? (
            <div className="space-y-1">
              {input.channels.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded border px-2 py-1">
                  <div>Ch{String(c.id).padStart(2, "0")} • {c.label}</div>
                  <Pill text={c.state ? (c.id === 1 ? "SOS!" : "ON") : (c.id === 2 ? "Đóng/An toàn" : "OFF")} tone={c.state ? (c.id === 1 ? "red" : "green") : (c.id === 2 ? "green" : "gray")} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">Không có thiết bị INPUT.</div>
          )}
        </div>
        <div>
          <div className="mb-1 mt-2 text-[11px] font-medium text-gray-500">OUTPUT</div>
          {output ? (
            <div className="space-y-1">
              {output.channels.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded border px-2 py-1">
                  <div>Ch{String(c.id).padStart(2, "0")} • {c.label}</div>
                  <div className="inline-flex items-center gap-1 opacity-60" title="Điều khiển tại màn GW-A">
                    {c.state ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    <span className="text-[11px]">{c.state ? "Bật" : "Tắt"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">Không có thiết bị OUTPUT.</div>
          )}
        </div>
      </div>
    </Frame>
  );
}

function UPSFrame({ ups, className }: { ups?: DeviceUPS; className?: string }) {
  return (
    <Frame title="UPS" icon={<Battery className="h-4 w-4 text-emerald-600" />} className={className} compact>
      {ups ? (
        <div className="flex items-center gap-2">
          <Pill text={`V ${ups.UPSvoltage.toFixed(0)}V`} tone={acLabel(ups.UPSvoltage).tone} />
          <Pill text={`I ${ups.UPScurrent.toFixed(1)}A`} tone={curLabel20(ups.UPScurrent).tone} />
        </div>
      ) : (
        <div className="text-gray-500">Không có thiết bị UPS.</div>
      )}
    </Frame>
  );
}

function FanFrame({ fan, className }: { fan?: DeviceFan; className?: string }) {
  return (
    <Frame title="FAN" icon={<FanIcon className="h-4 w-4 text-gray-600" />} className={className} compact>
      {fan ? (
        <div className="flex items-center gap-2">
          <Pill text={`V ${fan.FANvoltage.toFixed(0)}V`} tone={acLabel(fan.FANvoltage).tone} />
          <Pill text={`I ${fan.FANcurrent.toFixed(1)}A`} tone={curLabel10(fan.FANcurrent).tone} />
        </div>
      ) : (
        <div className="text-gray-500">Không có thiết bị FAN.</div>
      )}
    </Frame>
  );
}

function PumpFrame({ pump, className }: { pump?: DevicePump; className?: string }) {
  return (
    <Frame title="PUMP" icon={<Zap className="h-4 w-4 text-sky-600" />} className={className}>
      {pump ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Pill text={`V ${pump.PUMPvoltage.toFixed(0)}V`} tone={acLabel(pump.PUMPvoltage).tone} />
            <Pill text={`I ${pump.PUMPcurrent.toFixed(1)}A`} tone={curLabel20(pump.PUMPcurrent).tone} />
          </div>
          <Bar value={pump.PipePressure} max={600} label={`PipePressure ${pump.PipePressure.toFixed(0)} kPa (${pressLabel(pump.PipePressure).t})`} />
          <Bar value={pump.WaterFlow} max={30} label={`WaterFlow (${flowLabel(pump.WaterFlow).t})`} />
        </div>
      ) : (
        <div className="text-gray-500">Không có thiết bị PUMP.</div>
      )}
    </Frame>
  );
}

function DoorFrame({ doors, className }: { doors: DeviceDoor[]; className?: string }) {
  return (
    <Frame title="EDOOR" icon={<DoorClosed className="h-4 w-4" />} className={className} compact>
      {doors && doors.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {doors.slice(0,4).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded border px-2 py-1">
              <div className="text-[11px] font-medium">{d.id.split('-').slice(-2).join('-')}</div>
              <div className="inline-flex items-center gap-1">
                {d.StateDoor === 0 ? <DoorOpen className="h-3.5 w-3.5 text-amber-600" /> : <DoorClosed className="h-3.5 w-3.5 text-emerald-600" />}
                <span className="text-[11px]">{d.StateDoor === 0 ? "Mở" : "Đóng"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500">Không có thiết bị Cửa thoát hiểm.</div>
      )}
    </Frame>
  );
}

function GenFrame({ gen }: { gen?: DeviceGen }) {
  return (
    <Frame title="Máy Phát Điện" icon={<Power className="h-4 w-4" />}>
      {gen ? (
        <div className="flex items-center justify-between">
          <div>Máy phát: <span className={`font-medium ${gen.StateGenerator ? "text-emerald-600" : "text-gray-500"}`}>{gen.StateGenerator ? "Đang hoạt động" : "Không hoạt động"}</span></div>
          <Power className="h-4 w-4" />
        </div>
      ) : (
        <div className="text-gray-500">Không có thiết bị Máy phát.</div>
      )}
    </Frame>
  );
}

function CamFrame({ cams, className }: { cams: DeviceCam[]; className?: string }) {
  const [page, setPage] = useState(0);
  const pageSize = 9; // 3x3
  const totalPages = Math.max(1, Math.ceil(cams.length / pageSize));
  const start = page * pageSize;
  const slice = cams.slice(start, start + pageSize);

  return (
    <Frame title="CAMERA (3×3)" icon={<CameraIcon className="h-4 w-4 text-gray-600" />} className={className}>
      <div className="mb-2 flex items-center justify-between text-[11px] text-gray-500">
        <div>Tổng: {cams.length} • Trang {page + 1}/{totalPages}</div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setPage((p) => (p - 1 + totalPages) % totalPages)}><ChevronLeft className="h-3 w-3" /></Button>
          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setPage((p) => (p + 1) % totalPages)}><ChevronRight className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {slice.length === 0 && (
          <div className="col-span-3 text-center text-gray-500">Chưa có camera.</div>
        )}
        {slice.map((c) => (
          <div key={c.id} className="aspect-video rounded border bg-black/80 text-[10px] text-white">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between bg-white/10 px-1 py-0.5">
                <span className="truncate" title={c.location || c.id}>{c.location || c.id}</span>
                <span className={`${c.recording ? "text-emerald-400" : "text-gray-300"}`}>{c.recording ? "REC" : "—"}</span>
              </div>
              <div className="flex flex-1 items-center justify-center opacity-60">Stream</div>
              <div className="flex items-center justify-between bg-white/10 px-1 py-0.5">
                <span>{c.online ? "Online" : "Offline"}</span>
                <span>{c.id.split("-").slice(-2).join("-")}</span>
              </div>
            </div>
          </div>
        ))}
        {/* Fillers to keep 3x3 grid shape */}
        {Array.from({ length: Math.max(0, pageSize - slice.length) }).map((_, i) => (
          <div key={`f-${i}`} className="aspect-video rounded border bg-slate-50" />
        ))}
      </div>
    </Frame>
  );
}

// =============================================================
// Dashboard (ALL + Branch view with realtime)
// =============================================================

function StatCard({ title, value, icon, onClick }: { title: string; value: string; icon?: React.ReactNode; onClick?: () => void }) {
  const defaultClick = () => {
    if (/^Thiết bị/.test(title)) {
      window.dispatchEvent(new CustomEvent('OPEN_DEVICE_LIST'));
    }
  };
  const handler = onClick ?? defaultClick;
  const clickable = Boolean(handler);
  return (
    <Card onClick={handler} className={`rounded-2xl shadow-sm ${clickable ? 'cursor-pointer transition hover:shadow-md' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>{icon}</CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {clickable && /^Thiết bị/.test(title) && <div className="mt-1 text-[11px] text-sky-600">Nhấp để xem danh sách thiết bị</div>}
      </CardContent>
    </Card>
  );
}

function Dashboard({ branch, branches, onSelectBranch, onOpenDeviceList }: { branch: BranchId; branches: BranchRec[]; onSelectBranch: (id: BranchId) => void; onOpenDeviceList: () => void }) {
  const devices = useRealtimeDevices(branch);
  const branchName = useMemo(() => branches.find(b => b.id === branch)?.name, [branch, branches]);

  const kpi = useMemo(() => {
    if (branch === "ALL") {
      return { totalBranches: branches.length, gwaOnline: GATEWAYS.filter(g=>g.type==="GW-A"&&g.online).length, gwmOnline: GATEWAYS.filter(g=>g.type==="GW-M"&&g.online).length };
    }
    const online = devices.filter(d=>d.online).length;
    const total = devices.length;
    const fireZones = devices.filter(d=>d.type==="FACP").flatMap(d=> (d as DeviceFACP).zones).filter(z=>z.state===1).length;
    const techWarn = devices.reduce((acc,d)=>{
      if (d.type==="PUMP") return acc + (d.PipePressure<100?1:0) + (d.WaterFlow<5?1:0);
      if (d.type==="UPS") return acc + (d.UPSvoltage<200 || d.UPSvoltage>250 ? 1:0);
      if (d.type==="FAN") return acc + (d.FANvoltage<200 || d.FANvoltage>250 ? 1:0);
      return acc;
    },0);
    return { totalDevices: total, onlineDevices: online, fireZones, techWarn };
  }, [branch, branches.length, devices]);

  if (branch !== "ALL") {
    const facp = devices.find(d => d.type === "FACP") as DeviceFACP | undefined;
    const input = devices.find(d => d.type === "INPUT") as DeviceInput | undefined;
    const output = devices.find(d => d.type === "OUTPUT") as DeviceOutput | undefined;
    const ups = devices.find(d => d.type === "UPS") as DeviceUPS | undefined;
    const fan = devices.find(d => d.type === "FAN") as DeviceFan | undefined;
    const pump = devices.find(d => d.type === "PUMP") as DevicePump | undefined;
    const doors = devices.filter(d => d.type === "DOOR") as DeviceDoor[];
    const gen  = devices.find(d => d.type === "GEN") as DeviceGen | undefined;
    const cams = devices.filter(d => d.type === "CAM") as DeviceCam[];

    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Tổng quan Thiết bị • Chi nhánh</div>
            <h2 className="text-lg font-semibold">{branch} — {branchName || ""} <span className="ml-2"><span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600"><Activity className="h-3 w-3" /> LIVE</span></span></h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => onSelectBranch("ALL")}>Quay về Toàn bộ</Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard title="Thiết bị (Online/Tổng)" value={`${kpi.onlineDevices}/${kpi.totalDevices}`} icon={<Activity className="h-4 w-4 text-emerald-600" />} onClick={onOpenDeviceList} />
          <StatCard title="Báo cháy (Zones)" value={`${kpi.fireZones}`} icon={<Flame className="h-4 w-4 text-rose-600" />} />
          <StatCard title="Cảnh báo kỹ thuật" value={`${kpi.techWarn}`} icon={<Zap className="h-4 w-4 text-amber-600" />} />
          <StatCard title="Cập nhật" value={new Date().toLocaleTimeString()} icon={<Activity className="h-4 w-4 text-gray-500" />} />
        </div>

        {/* 8 FRAMES EXACTLY */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FacpFrame className="md:col-span-2" facp={facp} />
          <IOFrame className="md:col-span-2" input={input} output={output} />
          <PumpFrame className="md:col-span-2" pump={pump} />
          <DoorFrame className="md:col-span-1" doors={doors} />
          <UPSFrame className="md:col-span-1" ups={ups} />
          <FanFrame className="md:col-span-1" fan={fan} />
          <GenFrame className="md:col-span-1" gen={gen} />
          <CamFrame className="md:col-span-2 xl:col-span-4" cams={cams} />
        </div>
      </div>
    );
  }

  // ALL view
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Tổng số Chi nhánh" value={`${kpi.totalBranches}`} icon={<Building2 className="h-4 w-4 text-gray-500" />} />
        <StatCard title="Gateway‑A Online" value={`${kpi.gwaOnline}`} icon={<Server className="h-4 w-4 text-gray-500" />} />
        <StatCard title="Gateway‑M Online" value={`${kpi.gwmOnline}`} icon={<Gauge className="h-4 w-4 text-gray-500" />} />
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader><CardTitle className="text-sm text-gray-600">Bản đồ Giám sát Địa lý</CardTitle></CardHeader>
        <CardContent>
          <div className="relative h-96 w-full rounded-xl border bg-gradient-to-b from-slate-50 to-slate-100">
            {INIT_BRANCHES.map((b) => {
              const pos = BRANCH_POS[b.id];
              const online = GATEWAYS.filter((g) => g.branch === b.id && g.online).length;
              const total = GATEWAYS.filter((g) => g.branch === b.id).length;
              const variant: keyof typeof STATUS_COLORS = online === total ? "success" : online === 0 ? "danger" : "warning";
              return (
                <div key={b.id} className="absolute cursor-pointer" style={{ top: `${pos.top}%`, left: `${pos.left}%`, transform: "translate(-50%,-50%)" }} onClick={() => onSelectBranch(b.id)}>
                  <div className={`h-4 w-4 rounded-full border-2 ${STATUS_COLORS[variant]}`} />
                  <div className="mt-1 whitespace-nowrap rounded bg-white/90 px-2 py-0.5 text-xs shadow">{b.id}</div>
                </div>
              );
            })}
            <div className="absolute bottom-3 right-3 flex items-center gap-3 rounded-lg bg-white/90 px-3 py-1 text-xs shadow">
              <span className={`inline-block h-3 w-3 rounded-full ${STATUS_COLORS.success}`} /> OK
              <span className={`inline-block h-3 w-3 rounded-full ${STATUS_COLORS.warning}`} /> Cảnh báo
              <span className={`inline-block h-3 w-3 rounded-full ${STATUS_COLORS.danger}`} /> Sự cố
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================
// Device List Page
// =============================================================

function typeLabel(t: DeviceType) {
  switch (t) {
    case "FACP": return "FACP";
    case "INPUT": return "INPUT";
    case "OUTPUT": return "OUTPUT";
    case "UPS": return "UPS";
    case "FAN": return "FAN";
    case "PUMP": return "PUMP";
    case "DOOR": return "EDOOR";
    case "GEN": return "GEN";
    case "CAM": return "CAM";
  }
}

function StatusPill({ online }: { online: boolean }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${online? 'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-600'}`}>{online? 'Online':'Offline'}</span>;
}

function DeviceListPage({ branch, onBack }: { branch: BranchId; onBack: () => void }) {
  const [rows, setRows] = useState<Device[]>([]);
  const [q, setQ] = useState("");
  const [ftype, setFtype] = useState<DeviceType | "ALL">("ALL");
  const [fstatus, setFstatus] = useState<"ALL"|"ONLINE"|"OFFLINE">("ALL");

  useEffect(() => {
    if (branch === 'ALL') { setRows([]); return; }
    setRows(seedDevices(branch));
    const iv = setInterval(() => setRows(prev => prev.map(d => mutateDevice(d as any) as Device)), 2000);
    return () => clearInterval(iv);
  }, [branch]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (ftype !== 'ALL' && r.type !== ftype) return false;
      if (fstatus === 'ONLINE' && !r.online) return false;
      if (fstatus === 'OFFLINE' && r.online) return false;
      const qq = q.trim().toLowerCase();
      if (qq && !(`${r.id} ${r.branch} ${r.type}`.toLowerCase().includes(qq))) return false;
      return true;
    });
  }, [rows, q, ftype, fstatus]);

  function addDevice(t: DeviceType) {
    if (branch === 'ALL') return;
    const newId = `${branch}-${t}-${String(rows.filter(r=>r.type===t).length+1).padStart(2,'0')}`;
    const base = { id: newId, type: t, branch: branch as Exclude<BranchId,'ALL'>, online: true } as DeviceBase;
    let d: Device;
    switch (t) {
      case 'FACP': d = { ...(base as any), ACvoltage: 230, DCvoltage: 26, zones: Array.from({length:8}, (_,i)=>({name:`Zone ${String(i+1).padStart(2,'0')}`, state:0 as 0})) }; break;
      case 'INPUT': d = { ...(base as any), channels: [1,2,3,4].map(i=>({id:i as 1|2|3|4,label:`Ch${i}`, state:0 as 0})) }; break;
      case 'OUTPUT': d = { ...(base as any), channels: [1,2,3,4].map(i=>({id:i as 1|2|3|4,label:`Ch${i}`, state:0 as 0})) }; break;
      case 'UPS': d = { ...(base as any), UPSvoltage: 225, UPScurrent: 5 }; break;
      case 'FAN': d = { ...(base as any), FANvoltage: 230, FANcurrent: 3 }; break;
      case 'PUMP': d = { ...(base as any), PUMPvoltage: 235, PUMPcurrent: 8, PipePressure: 220, WaterFlow: 12 }; break;
      case 'DOOR': d = { ...(base as any), StateDoor: 1 }; break;
      case 'GEN': d = { ...(base as any), StateGenerator: 0 }; break;
      case 'CAM': d = { ...(base as any), recording: false }; break;
    }
    setRows(prev => [d, ...prev]);
  }

  function removeDevice(id: string) { setRows(prev => prev.filter(r => r.id !== id)); }
  function toggleOnline(id: string) { setRows(prev => prev.map(r => r.id===id? {...r, online: !r.online } : r)); }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Danh sách thiết bị • {branch === 'ALL' ? 'Toàn tổ chức' : branch}</div>
          <h2 className="text-lg font-semibold">Thiết bị</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={ftype} onValueChange={(v)=>setFtype(v as any)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Loại" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả loại</SelectItem>
              <SelectItem value="FACP">FACP</SelectItem>
              <SelectItem value="INPUT">INPUT</SelectItem>
              <SelectItem value="OUTPUT">OUTPUT</SelectItem>
              <SelectItem value="UPS">UPS</SelectItem>
              <SelectItem value="FAN">FAN</SelectItem>
              <SelectItem value="PUMP">PUMP</SelectItem>
              <SelectItem value="DOOR">EDOOR</SelectItem>
              <SelectItem value="GEN">GEN</SelectItem>
              <SelectItem value="CAM">CAM</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fstatus} onValueChange={(v)=>setFstatus(v as any)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              <SelectItem value="ONLINE">Online</SelectItem>
              <SelectItem value="OFFLINE">Offline</SelectItem>
            </SelectContent>
          </Select>
          <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Tìm theo ID/loại/chi nhánh…" className="w-60" />
          <Button variant="outline" onClick={onBack}>Quay lại Dashboard</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600">Tổng: {rows.length} • Hiển thị: {filtered.length}</span>
        <div className="ml-auto" />
        <Select onValueChange={(v)=>addDevice(v as DeviceType)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Thêm thiết bị…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="FACP">+ FACP</SelectItem>
            <SelectItem value="INPUT">+ INPUT</SelectItem>
            <SelectItem value="OUTPUT">+ OUTPUT</SelectItem>
            <SelectItem value="UPS">+ UPS</SelectItem>
            <SelectItem value="FAN">+ FAN</SelectItem>
            <SelectItem value="PUMP">+ PUMP</SelectItem>
            <SelectItem value="DOOR">+ EDOOR</SelectItem>
            <SelectItem value="GEN">+ GEN</SelectItem>
            <SelectItem value="CAM">+ CAM</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-600">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Chi nhánh</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Thông số chính</th>
              <th className="px-3 py-2 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{d.id}</td>
                <td className="px-3 py-2"><span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs">{typeLabel(d.type)}</span></td>
                <td className="px-3 py-2">{d.branch}</td>
                <td className="px-3 py-2"><StatusPill online={d.online} /></td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {d.type==='PUMP' && <>P={ (d as DevicePump).PipePressure.toFixed(0)} kPa • Q={(d as DevicePump).WaterFlow.toFixed(1)}</>}
                  {d.type==='UPS'  && <>V={ (d as DeviceUPS).UPSvoltage.toFixed(0)}V • I={(d as DeviceUPS).UPScurrent.toFixed(1)}A</>}
                  {d.type==='FAN'  && <>V={ (d as DeviceFan).FANvoltage.toFixed(0)}V • I={(d as DeviceFan).FANcurrent.toFixed(1)}A</>}
                  {d.type==='FACP' && <>AC={ (d as DeviceFACP).ACvoltage.toFixed(0)}V • DC={(d as DeviceFACP).DCvoltage.toFixed(1)}V • FireZones={(d as DeviceFACP).zones.filter(z=>z.state===1).length}</>}
                  {d.type==='DOOR' && <>Cửa={(d as DeviceDoor).StateDoor===0? 'Mở':'Đóng'}</>}
                  {d.type==='GEN'  && <>Máy phát={(d as DeviceGen).StateGenerator? 'ON':'OFF'}</>}
                  {d.type==='CAM'  && <>REC={(d as DeviceCam).recording? 'Đang ghi':'—'}</>}
                  {d.type==='INPUT' && <>Kênh={(d as DeviceInput).channels.length}</>}
                  {d.type==='OUTPUT' && <>Kênh={(d as DeviceOutput).channels.length}</>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="icon" variant="outline" className="h-7 w-7" title="Bật/Tắt Online" onClick={()=>toggleOnline(d.id)}>
                      {d.online? <Power className="h-3.5 w-3.5 text-emerald-600" /> : <Power className="h-3.5 w-3.5 text-gray-500" />}
                    </Button>
                    <Button size="icon" variant="outline" className="h-7 w-7" title="Sửa">
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="destructive" className="h-7 w-7" title="Xóa" onClick={()=>removeDevice(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">Không có thiết bị phù hợp.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================
// Placeholder for Radio (Đàm thoại)
// =============================================================

function RadioPage() {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold mb-4">Quản lý Đàm thoại 4G (PTT)</h2>
      <Card><CardHeader><CardTitle>Danh sách Thiết bị Đàm thoại</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600">Tính năng quản lý bộ đàm 4G (PTT) sẽ hiển thị ở đây…</p></CardContent></Card>
    </div>
  );
}

// =============================================================
// Branches Page (Admin Tenant vs Admin Department)
// =============================================================

function ContactRow({ label, person }: { label: string; person: Contact }) {
  const tel = `tel:${person.phone.replace(/\s+/g, "")}`;
  return (
    <div className="flex items-center justify-between rounded-md border px-2 py-1 text-xs">
      <div className="flex items-center gap-2 text-gray-700"><User className="h-3.5 w-3.5" /><span className="font-medium">{label}:</span><span>{person.name}</span></div>
      <a href={tel} className="inline-flex items-center gap-1 text-sky-700 hover:underline" title="Gọi nhanh"><Phone className="h-3.5 w-3.5" /> {person.phone}</a>
    </div>
  );
}

function BranchCard({ b, isTenantAdmin, onOpenBranch, onGo }: { b: BranchRec; isTenantAdmin: boolean; onOpenBranch: (id: BranchId) => void; onGo: (p: PageKey) => void; }) {
  const mapsUrl = `https://www.google.com/maps?q=${b.gps.lat},${b.gps.lng}`;
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">{b.name}</CardTitle><span className="text-xs text-gray-500">{b.id}</span></div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" title="Mở trên Google Maps" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sky-700 hover:bg-sky-50"><MapPin className="h-3.5 w-3.5" /><span>{b.gps.lat.toFixed(3)}, {b.gps.lng.toFixed(3)}</span></a>
        </div>
        <div className="space-y-1">
          <ContactRow label="GĐ Chi nhánh" person={b.contacts.director} />
          <ContactRow label="Trưởng An ninh" person={b.contacts.securityLead} />
          <ContactRow label="Trưởng Kỹ thuật" person={b.contacts.engineeringLead} />
        </div>
        <div className="pt-1"><Button size="xs" className="w-full" onClick={() => { onOpenBranch(b.id); onGo("dashboard"); }}>Xem Tổng quan Thiết bị</Button></div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="xs" variant="outline" className="gap-1"><Edit3 className="h-3 w-3" />Sửa</Button>
          {isTenantAdmin ? (<><Button size="xs" variant="outline" className="gap-1"><Users className="h-3 w-3" />Gán Admin Dept</Button><Button size="xs" variant="destructive" className="gap-1"><Trash2 className="h-3 w-3" />Xóa</Button></>) : (
            <Button size="xs" variant="outline" disabled className="gap-1"><Users className="h-3 w-3" />Gán Admin Dept</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BranchesPage({ isTenantAdmin, branches, onOpenBranch, onGo }: { isTenantAdmin: boolean; branches: BranchRec[]; onOpenBranch: (id: BranchId) => void; onGo: (p: PageKey) => void; }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(b => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q));
  }, [branches, query]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Chi nhánh trong Tổ chức</h2>
        {isTenantAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Mã ID Department" className="w-40" />
            <Input placeholder="Tên Department" className="w-56" />
            <Input placeholder="LatLong (vd: 10.776,106.700)" className="w-56" />
            <Input placeholder="Tài khoản Admin Department" className="w-56" />
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" />Tạo Department</Button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-gray-600">Tổng số: {branches.length} • Hiển thị: {filtered.length}</div>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm chi nhánh theo tên/ID…" className="max-w-xs" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => (<BranchCard key={b.id} b={b} isTenantAdmin={isTenantAdmin} onOpenBranch={onOpenBranch} onGo={onGo} />))}
        {filtered.length === 0 && (<div className="text-sm text-gray-500">Không tìm thấy chi nhánh phù hợp.</div>)}
      </div>
    </div>
  );
}

// =============================================================
// DEV: Very light runtime assertions (acts as tests)
// =============================================================

if (typeof window !== 'undefined') {
  console.assert(zoneText(0) === 'Bình thường', 'zoneText(0) should be Bình thường');
  console.assert(zoneText(1) === 'Cháy', 'zoneText(1) should be Cháy');
  console.assert(zoneText(2) === 'Hở mạch', 'zoneText(2) should be Hở mạch');
  console.assert(zoneText(3) === 'Chập mạch', 'zoneText(3) should be Chập mạch');
  const seeded = seedDevices('HCM-01' as any);
  console.assert(seeded.filter(d => d.type === 'DOOR').length === 4, 'seedDevices should create 4 EDOORs');
  console.assert(seeded.some(d => d.type === 'GEN'), 'seedDevices should include a GEN device');
  // extra quick checks for labels
  console.assert(pressLabel(300).tone === 'green', 'pressLabel(300) should be green');
  console.assert(pressLabel(550).tone === 'red', 'pressLabel(550) should be red');
  console.assert(pressLabel(50).tone === 'amber', 'pressLabel(50) should be amber');
}

// =============================================================
// Root
// =============================================================

export default function DeviceManagementTenant() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [branch, setBranch] = useState<BranchId>("ALL");
  const [branches] = useState<BranchRec[]>(INIT_BRANCHES);
  const [isTenantAdmin] = useState(true); // demo

  useEffect(() => {
    const handler = () => setPage('devices');
    // @ts-ignore custom event name
    window.addEventListener('OPEN_DEVICE_LIST', handler as any);
    return () => {
      // @ts-ignore
      window.removeEventListener('OPEN_DEVICE_LIST', handler as any);
    };
  }, []);

  return (
    <div className="flex h-screen w-full flex-col bg-white">
      <Topbar branch={branch} setBranch={setBranch} />
      <div className="flex h-[calc(100vh-56px)]">
        <Sidebar active={page} onChange={setPage} />
        <main className="flex-1 overflow-auto bg-gray-50/60">
          {page === "dashboard" && <Dashboard branch={branch} branches={branches} onSelectBranch={setBranch} onOpenDeviceList={() => setPage("devices")} />}
          {page === "devices" && <DeviceListPage branch={branch} onBack={() => setPage("dashboard")} />}
          {page === "branches" && (
            <BranchesPage isTenantAdmin={isTenantAdmin} branches={branches} onOpenBranch={(id) => { setBranch(id); setPage("dashboard"); }} onGo={(p) => setPage(p)} />
          )}
          {page === "gwa" && (
            <div className="p-6"><Card><CardHeader><CardTitle>Gateway Báo động (GW‑A)</CardTitle></CardHeader><CardContent>Đang phát triển…</CardContent></Card></div>
          )}
          {page === "gwm" && (
            <div className="p-6"><Card><CardHeader><CardTitle>Gateway Kỹ thuật (GW‑M)</CardTitle></CardHeader><CardContent>Đang phát triển…</CardContent></Card></div>
          )}
          {page === "camera" && (
            <div className="p-6"><Card><CardHeader><CardTitle>Quản lý Camera</CardTitle></CardHeader><CardContent>Đang phát triển…</CardContent></Card></div>
          )}
          {page === "radio" && <RadioPage />}
          {page === "settings" && (
            <div className="p-6">
              <Card>
                <CardHeader><CardTitle>Cấu hình & Cài đặt</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Trang cấu hình đang được hoàn thiện…</p>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
