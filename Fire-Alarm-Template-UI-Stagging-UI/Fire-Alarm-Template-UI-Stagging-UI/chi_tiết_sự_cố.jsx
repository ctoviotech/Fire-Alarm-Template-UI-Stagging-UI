import React, { useMemo, useState } from "react";

// === Incident Detail Screen (Tenant) ===
// New in this revision:
// - Auto-capture playback (30s at incident time)
// - Manual capture buttons (per camera tile) + capture log section
// - 8-zone FACP with animations, PTT taller, SOS Button status
// - Cloud→device toggles (Buzzer, Nhả khói, Cắt điện)
// - Merged "Máy bơm" (UPS + Pump)
// - NEW: Door Sensor (under SOS Button) + tests

// ---------- Mock Data ----------
const mockIncident = {
  id: "PNJ.FIRE.001",
  site: {
    name: "Chi nhánh A",
    address: "Tòa nhà A, 123 Đường XYZ",
    lat: 10.771,
    lng: 106.698,
  },
  type: "Cháy", // có thể là "Cháy" | "An ninh" | "SOS"
  priority: 1,
  status: "Cảnh báo",
  occurredAt: "2025-08-24T10:45:00+07:00",
  commander: { name: "Nguyễn Văn A" },
  operator: { name: "Nguyễn Văn B" },
  sosButton: { pressed: false },
  security: { doorSensor: { violated: false } },
};

const cameraList = Array.from({ length: 20 }).map((_, i) => ({
  id: `CAM-${String(i + 1).padStart(2, "0")}`,
  name: `Camera ${i + 1}`,
  location: [
    "Sảnh chính",
    "Hành lang T5",
    "Kho A",
    "Thang thoát hiểm",
    "Bãi xe",
    "Quầy thu ngân",
    "Phòng bơm",
    "Máy phát",
    "Mái che",
    "Cửa chính",
    "Khu A1",
    "Khu A2",
    "Khu A3",
    "Khu A4",
    "Lối ra 1",
    "Lối ra 2",
    "Thang bộ",
    "Thang máy",
    "Sân sau",
    "Tầng mái",
  ][i % 20],
  // snapshot placeholder (replace with <video> / player)
  snapshot: `https://placehold.co/640x360?text=CAM+${i + 1}`,
}));

type Zone = { name: string; status: "FIRE" | "NORMAL" };
const metrics = {
  facp: {
    zones: [
      { name: "Zone 1", status: "FIRE" },
      { name: "Zone 2", status: "NORMAL" },
      { name: "Zone 3", status: "NORMAL" },
      { name: "Zone 4", status: "FIRE" },
      { name: "Zone 5", status: "NORMAL" },
      { name: "Zone 6", status: "NORMAL" },
      { name: "Zone 7", status: "NORMAL" },
      { name: "Zone 8", status: "NORMAL" },
    ] as Zone[],
    buzzer: { label: "Còi báo", value: true },
  },
  ups: { voltage: 220, current: 2.4 },
  pump: {
    state: "RUNNING",
    voltage: 380,
    current: 15.2,
    pipePressure: 6.8, // bar
    waterFlow: 12.3, // m3/h
  },
  fan: { state: "OFF", voltage: 0, current: 0 },
};

const ptt = {
  talkgroup: "Ops-Fire-A",
  members: [
    { id: "PTT-101", name: "Đội trưởng A", role: "Chỉ huy", online: true },
    { id: "PTT-102", name: "Kỹ thuật B", role: "Kỹ thuật", online: true },
    { id: "PTT-103", name: "Bảo vệ C", role: "Bảo vệ", online: false },
    { id: "PTT-104", name: "Y tế D", role: "Y tế", online: true },
  ],
  // Voice log entries (replace src with real recorded clips)
  voiceLog: [
    { at: "10:45:14", from: "Đội trưởng A", src: "/audio/clip-1.mp3", note: "Kích hoạt talkgroup Ops-Fire-A." },
    { at: "10:45:30", from: "Kỹ thuật B", src: "/audio/clip-2.mp3", note: "Kiểm tra camera Sảnh chính." },
    { at: "10:46:02", from: "Đội trưởng A", src: "/audio/clip-3.mp3", note: "Điều phối mang bình chữa cháy tới khu A." },
  ],
};

const aar = [
  { at: "10:45:00", text: "Cảnh báo từ Zone 1 (FACP)." },
  { at: "10:45:25", text: "Mở PTT, xác minh qua camera Sảnh chính." },
  { at: "10:46:10", text: "Huy động đội PCCC cơ sở, chuẩn bị bình bột." },
];

// ---------- Helpers ----------
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Cảnh báo": "bg-yellow-100 text-yellow-800",
    "Đang xử lý": "bg-blue-100 text-blue-800",
    "Hoàn tất": "bg-emerald-100 text-emerald-800",
    "Khẩn cấp": "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${map[status] || "bg-slate-100 text-slate-700"}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function SectionCard({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MetricTile({ label, value, unit, state, urgent }: { label: string; value: string | number; unit?: string; state?: "ok" | "warn" | "err"; urgent?: boolean }) {
  const color = state === "err" ? "text-red-600" : state === "warn" ? "text-amber-600" : "text-slate-900";
  const bg = state === "err" ? "bg-red-50" : state === "warn" ? "bg-amber-50" : "bg-slate-50";
  return (
    <div className={`relative rounded-xl ${bg} p-3 ${urgent ? "ring-2 ring-red-500 animate-pulse" : ""}`}>
      {urgent && <span className="pointer-events-none absolute -inset-0.5 -z-10 animate-ping rounded-xl bg-red-400/30" />}
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>
        {value}
        {unit ? <span className="ml-1 text-sm text-slate-500">{unit}</span> : null}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, danger }: { checked: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  const base = checked ? (danger ? "bg-red-600 border-red-600" : "bg-emerald-500 border-emerald-500") : "bg-slate-200 border-slate-200";
  return (
    <button
      onClick={() => {
        if (danger && !checked) {
          const ok = confirm("Xác nhận kích hoạt hành động nguy cơ cao?");
          if (!ok) return;
        }
        onChange(!checked);
      }}
      className={`inline-flex h-6 w-11 items-center rounded-full border transition ${base}`}
      aria-label="toggle"
    >
      <span className={`ml-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function Pager({ page, total, onPrev, onNext }: { page: number; total: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button onClick={onPrev} className="rounded-lg border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100" aria-label="prev">‹</button>
      <span className="min-w-[80px] text-center text-slate-600">Trang {page}/{total}</span>
      <button onClick={onNext} className="rounded-lg border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100" aria-label="next">›</button>
    </div>
  );
}

type ManualCapture = { id: string; camId: string; at: string; duration: number; src: string };

// ---------- Main Component ----------
export default function IncidentDetail() {
  // Controls
  const [buzzer, setBuzzer] = useState(metrics.facp.buzzer.value);
  const [fog, setFog] = useState(false); // Nhả khói mù
  const [powerCut, setPowerCut] = useState(false); // Cắt điện

  // Cameras paging
  const [page, setPage] = useState(1);
  const perPage = 9;
  const totalPages = Math.ceil(cameraList.length / perPage);
  const start = (page - 1) * perPage;
  const displayCams = cameraList.slice(start, start + perPage);

  // Auto capture (30s at incident time)
  const autoCapture = useMemo(() => ({
    at: mockIncident.occurredAt,
    duration: 30,
    src: `/video/auto-${mockIncident.id}-30s.mp4`,
  }), []);

  // Manual capture log
  const [manualCaptures, setManualCaptures] = useState<ManualCapture[]>([]);

  function handleManualCapture(camId: string) {
    const now = new Date();
    const id = `MAN-${manualCaptures.length + 1}`;
    const ts = now.toLocaleTimeString("vi-VN", { hour12: false });
    const entry: ManualCapture = {
      id,
      camId,
      at: ts,
      duration: 30,
      src: `/video/manual-${mockIncident.id}-${camId}-${Date.now()}.mp4`,
    };
    setManualCaptures((prev) => [entry, ...prev]);
  }

  // FACP status summary
  const facpStatus = useMemo(() => {
    const active = metrics.facp.zones.filter((z) => z.status !== "NORMAL");
    return active.length > 0 ? `ALARM tại ${active.map((z) => z.name).join(", ")}` : "Bình thường";
  }, []);

  const handlePrev = () => setPage((p) => (p <= 1 ? totalPages : p - 1));
  const handleNext = () => setPage((p) => (p >= totalPages ? 1 : p + 1));

  // --- Derived states before tests ---
  const sosActive = mockIncident.type === "SOS" || !!mockIncident.sosButton?.pressed;
  const doorSensorActive = mockIncident.type === "An ninh" || !!mockIncident.security?.doorSensor?.violated;

  // --- Dev tests --- (không sửa test cũ, chỉ bổ sung)
  console.assert(cameraList.length === 20, "Phải có 20 camera để test phân trang");
  console.assert(Math.ceil(20 / 9) === totalPages, "Tổng trang phải khớp 3 trang");
  console.assert(displayCams.length <= perPage && displayCams.length > 0, "Số camera hiển thị phải >0 và ≤ perPage");
  console.assert(metrics.facp.zones.length === 8, "FACP phải hiển thị đủ 8 zone");
  console.assert(metrics.facp.zones.every((z) => z.status === "FIRE" || z.status === "NORMAL"), "Trạng thái zone chỉ được FIRE hoặc NORMAL");
  console.assert(metrics.facp.zones.some((z) => z.status === "FIRE"), "Phải có >=1 zone FIRE để test animation");
  console.assert(typeof sosActive === "boolean", "SOS Button state phải là boolean");
  console.assert(mockIncident.type !== "SOS" || sosActive, "Nếu loại sự cố là SOS thì SOS Button phải đang hoạt động");
  console.assert(autoCapture.duration === 30, "Auto capture phải 30s");
  console.assert(Array.isArray(manualCaptures), "Manual capture log phải là mảng");
  // new tests
  console.assert(typeof doorSensorActive === "boolean", "Door sensor state phải là boolean");
  console.assert(mockIncident.type !== "An ninh" || doorSensorActive, "Nếu loại sự cố là An ninh thì cảm biến cửa phải bất thường");
  console.assert(typeof displayCams[0]?.snapshot === "string", "snapshot phải là string");
  console.assert(cameraList.every((c, idx) => c.name === `Camera ${idx + 1}`), "Tên camera phải đúng định dạng");

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900">Chi tiết sự cố • {mockIncident.id}</h1>
              <StatusPill status={mockIncident.status} />
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">Ưu tiên P{mockIncident.priority}</span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {mockIncident.site.name} — {mockIncident.site.address}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Tham gia PTT</button>
            <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Mở SOP</button>
            <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Mở GIS</button>
          </div>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Left: Camera Grid + PTT under it */}
          <div className="xl:col-span-2">
            <SectionCard title="Camera (3×3)" right={<Pager page={page} total={totalPages} onPrev={handlePrev} onNext={handleNext} />}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {displayCams.map((cam) => (
                  <div key={cam.id} className="group relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    <img src={cam.snapshot} alt={cam.name} className="h-full w-full object-cover" />
                    {/* per-camera manual capture button */}
                    <div className="absolute right-2 top-2 z-10">
                      <button
                        onClick={() => handleManualCapture(cam.id)}
                        className="rounded-lg bg-red-600/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow hover:bg-red-700"
                        title="Capture 30s từ camera này"
                      >
                        Capture 30s
                      </button>
                    </div>
                    {/* subtle shimmer to make it alive */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
                      <div>
                        <div className="text-sm font-semibold">{cam.name}</div>
                        <div className="text-xs opacity-80">{cam.location}</div>
                      </div>
                      <div className="flex items-center gap-2 opacity-90">
                        <button className="rounded-lg bg-white/15 px-2 py-1 text-xs backdrop-blur hover:bg-white/25">Preset</button>
                        <button className="rounded-lg bg-white/15 px-2 py-1 text-xs backdrop-blur hover:bg-white/25">Phóng to</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Auto-capture playback */}
            <div className="mt-6">
              <SectionCard title="Bản ghi video lúc nhận tín hiệu sự cố (Tự động)">
                <div className="flex flex-col gap-3">
                  <div className="text-sm text-slate-700">
                    <span className="font-semibold">Thời điểm:</span> {new Date(autoCapture.at).toLocaleString("vi-VN")} • <span className="font-semibold">Thời lượng:</span> {autoCapture.duration}s
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
                    <video controls preload="metadata" className="h-full w-full">
                      <source src={autoCapture.src} type="video/mp4" />
                    </video>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Manual capture log */}
            <div className="mt-6">
              <SectionCard title="Bản ghi thủ công">
                {manualCaptures.length === 0 ? (
                  <div className="text-sm text-slate-500">Chưa có bản ghi thủ công. Bấm nút <span className="font-medium text-slate-700">Capture 30s</span> trên camera để tạo bản ghi.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex gap-3 pr-2">
                      {manualCaptures.map((mc) => (
                        <div key={mc.id} className="min-w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <div>
                              <span className="font-semibold text-slate-800">{mc.camId}</span> • {mc.at}
                            </div>
                            <div>{mc.duration}s</div>
                          </div>
                          <video controls preload="metadata" className="h-full w-full bg-black">
                            <source src={mc.src} type="video/mp4" />
                          </video>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* PTT (đặt dưới) */}
            <div className="mt-6">
              <SectionCard title="Kênh Đàm (PTT)">
                <div className="mb-3 text-sm text-slate-600">Talkgroup: <span className="font-semibold text-slate-800">{ptt.talkgroup}</span></div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Members */}
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Thành viên</div>
                    <div className="max-h-72 space-y-2 overflow-auto pr-2">
                      {ptt.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <div>
                            <div className="text-sm font-medium text-slate-800">{m.name}</div>
                            <div className="text-xs text-slate-500">{m.role} • {m.id}</div>
                          </div>
                          <span className={`text-xs font-medium ${m.online ? "text-emerald-600" : "text-slate-400"}`}>{m.online ? "Online" : "Offline"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Voice sessions */}
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Phiên trao đổi (voice)</div>
                    <div className="max-h-72 space-y-3 overflow-auto pr-2">
                      {ptt.voiceLog.map((v, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="mb-1 text-xs text-slate-500">{v.at} • <span className="font-medium text-slate-700">{v.from}</span></div>
                          <audio controls className="w-full">
                            <source src={v.src} type="audio/mpeg" />
                          </audio>
                          {v.note ? <div className="mt-1 text-xs text-slate-500">{v.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Related documents (kept) */}
            <div className="mt-6">
              <SectionCard title="Tài liệu liên quan">
                <ul className="list-inside list-disc text-sm text-slate-700">
                  <li>Phương án chữa cháy khu A (SOP-FA-01)</li>
                  <li>Sơ đồ thoát nạn tầng 5</li>
                  <li>Biên bản thử PC04 gần nhất</li>
                </ul>
              </SectionCard>
            </div>
          </div>

          {/* Right: Metrics + Incident Summary */}
          <div className="flex flex-col gap-6">
            <SectionCard title="Metrics cảm biến" right={
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" /> <span>Khẩn cấp</span></div>
                <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> <span>An toàn</span></div>
              </div>
            }>
              {/* FACP */}
              <div className="mb-4 rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">FACP</div>
                  <div className="text-xs font-medium text-slate-600">{facpStatus}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {metrics.facp.zones.map((z, i) => (
                    <div key={i} className="relative">
                      <MetricTile
                        label={z.name}
                        value={z.status === "FIRE" ? "Cháy" : "An toàn"}
                        state={z.status === "FIRE" ? "err" : "ok"}
                        urgent={z.status === "FIRE"}
                      />
                      {z.status === "FIRE" && (
                        <span className="pointer-events-none absolute -inset-2 -z-10 animate-ping rounded-2xl bg-red-400/20" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Controls */}
                <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-700">Còi báo (Buzzer)</div>
                    <Toggle checked={buzzer} onChange={setBuzzer} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-700">Nhả khói mù</div>
                    <Toggle checked={fog} onChange={setFog} danger />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-700">Cắt điện</div>
                    <Toggle checked={powerCut} onChange={setPowerCut} danger />
                  </div>
                </div>
              </div>

              {/* SOS Button (compact, under FACP) */}
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-rose-700">SOS Button</div>
                  {sosActive ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Đang kích hoạt
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-slate-400" /> Chưa kích hoạt
                    </span>
                  )}
                </div>
              </div>

              {/* Door Sensor (compact, under SOS) */}
              <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-sky-700">Cảm biến cửa</div>
                  {doorSensorActive ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Bất thường
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-slate-400" /> Bình thường
                    </span>
                  )}
                </div>
              </div>

              {/* Máy bơm (merge UPS + Pump) */}
              <div className="mb-4 rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">Máy bơm</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MetricTile label="UPS Voltage" value={metrics.ups.voltage} unit="V" />
                  <MetricTile label="UPS Current" value={metrics.ups.current} unit="A" />
                  <MetricTile label="Pump Voltage" value={metrics.pump.voltage} unit="V" />
                  <MetricTile label="Pump Current" value={metrics.pump.current} unit="A" />
                  <MetricTile label="Pipe Pressure" value={metrics.pump.pipePressure} unit="bar" />
                  <MetricTile label="Water Flow" value={metrics.pump.waterFlow} unit="m³/h" />
                </div>
              </div>

              {/* Fan */}
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-800">Fan</div>
                <div className="grid grid-cols-2 gap-2">
                  <MetricTile label="State" value={metrics.fan.state} state={metrics.fan.state === "OFF" ? "warn" : "ok"} />
                  <MetricTile label="Fan Voltage" value={metrics.fan.voltage} unit="V" />
                  <MetricTile label="Fan Current" value={metrics.fan.current} unit="A" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Nhật ký ứng cứu (tóm tắt)">
              <ol className="space-y-3">
                {aar.map((e, idx) => (
                  <li key={idx} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="text-xs text-slate-500">{e.at}</div>
                    <div className="text-sm text-slate-800">{e.text}</div>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
