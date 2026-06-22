import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const fmt = (n, d = 2) => n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtRs = (n) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function App() {
  // ── Inputs ──────────────────────────────────────────────────────────────
  const [makeupCond, setMakeupCond]     = useState(500);
  const [blowdownCond, setBlowdownCond] = useState(3000);
  const [circulation, setCirculation]   = useState(1000);
  const [evapPct, setEvapPct]           = useState(2.0);
  const [driftPct, setDriftPct]         = useState(0.02);
  const [targetCoc, setTargetCoc]       = useState(8);

  // Cost inputs (₹)
  const [waterCostPerM3, setWaterCostPerM3]       = useState(45);
  const [chemCostPerM3, setChemCostPerM3]         = useState(12);
  const [sewageCostPerM3, setSewageCostPerM3]     = useState(20);
  const [operatingHours, setOperatingHours]       = useState(10000);

  // ── Calculations ──────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const coc = blowdownCond / makeupCond;
    const evap = circulation * evapPct / 100;
    const drift = circulation * driftPct / 100;
    const blowdown = Math.max((evap / coc) - drift, 0);
    const makeup = evap + blowdown + drift;

    // Baseline at CoC=1 (no concentration)
    const makeupBase = 2 * evap + drift;
    const blowdownBase = makeupBase - evap - drift;

    const waterSavingM3h = makeupBase - makeup;
    const waterSavingPct = makeupBase > 0 ? (waterSavingM3h / makeupBase) * 100 : 0;

    // Annual costs
    const annualMakeup    = makeup    * operatingHours;
    const annualBlowdown  = blowdown  * operatingHours;
    const annualMakeupBase   = makeupBase   * operatingHours;
    const annualBlowdownBase = blowdownBase * operatingHours;

    const annualWaterCost  = annualMakeup * waterCostPerM3;
    const annualChemCost   = annualMakeup * chemCostPerM3;
    const annualSewageCost = annualBlowdown * sewageCostPerM3;
    const totalAnnualCost  = annualWaterCost + annualChemCost + annualSewageCost;

    const baseWaterCost  = annualMakeupBase * waterCostPerM3;
    const baseChemCost   = annualMakeupBase * chemCostPerM3;
    const baseSewageCost = annualBlowdownBase * sewageCostPerM3;
    const totalBaseCost  = baseWaterCost + baseChemCost + baseSewageCost;

    const annualSaving = totalBaseCost - totalAnnualCost;

    // Target CoC comparison
    const targetBlowdown = Math.max((evap / targetCoc) - drift, 0);
    const targetMakeup   = evap + targetBlowdown + drift;
    const targetAnnualMakeup   = targetMakeup   * operatingHours;
    const targetAnnualBlowdown = targetBlowdown * operatingHours;
    const targetCost = targetAnnualMakeup * (waterCostPerM3 + chemCostPerM3) + targetAnnualBlowdown * sewageCostPerM3;
    const targetSaving = totalAnnualCost - targetCost;

    // Sensitivity curve
    const curve = [];
    for (let c = 1.5; c <= 20.05; c += 0.5) {
      const bd = Math.max((evap / c) - drift, 0);
      const mu = evap + bd + drift;
      const amu = mu * operatingHours;
      const abd = bd * operatingHours;
      const cost = amu * (waterCostPerM3 + chemCostPerM3) + abd * sewageCostPerM3;
      curve.push({
        coc: parseFloat(c.toFixed(1)),
        blowdown: parseFloat(bd.toFixed(3)),
        makeup: parseFloat(mu.toFixed(3)),
        annualCostL: parseFloat((cost / 100000).toFixed(2)),
      });
    }

    return {
      coc, evap, drift, blowdown, makeup,
      waterSavingPct, waterSavingM3h,
      annualMakeup, annualBlowdown,
      annualWaterCost, annualChemCost, annualSewageCost, totalAnnualCost,
      annualSaving, targetSaving, targetCost,
      curve,
      pieData: [
        { name: "Water Cost", value: Math.round(annualWaterCost), color: "#00c8ff" },
        { name: "Chemical Cost", value: Math.round(annualChemCost), color: "#ffb300" },
        { name: "Sewage Cost", value: Math.round(annualSewageCost), color: "#ff6b6b" },
      ],
    };
  }, [makeupCond, blowdownCond, circulation, evapPct, driftPct, targetCoc, waterCostPerM3, chemCostPerM3, sewageCostPerM3, operatingHours]);

  const cocStatus = calc.coc < 2 ? "low" : calc.coc <= 6 ? "good" : "high";
  const statusColors = { low: "#ffb300", good: "#00c8ff", high: "#ff6b6b" };
  const statusText   = { low: "Too Low — Wasteful", good: "Optimal Range", high: "High — Monitor Scale" };

  const Slider = ({ label, value, min, max, step, onChange, unit, hint }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#8ab4cc", fontFamily: "'Courier Prime', monospace" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e0f4ff", fontFamily: "'Courier Prime', monospace" }}>
          {unit === "₹" ? `₹${value.toLocaleString("en-IN")}` : `${value}${unit}`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#00c8ff", cursor: "pointer" }} />
      {hint && <div style={{ fontSize: 10, color: "#4a7a94", marginTop: 2 }}>{hint}</div>}
    </div>
  );

  const MetricCard = ({ label, value, sub, accent }) => (
    <div style={{
      background: "rgba(0,200,255,0.05)", border: `1px solid ${accent || "rgba(0,200,255,0.2)"}`,
      borderRadius: 12, padding: "14px 18px", flex: 1, minWidth: 130
    }}>
      <div style={{ fontSize: 11, color: "#5a9ab8", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || "#00c8ff", fontFamily: "'Courier Prime', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#4a7090", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const tooltipStyle = { backgroundColor: "#0a1a2a", border: "1px solid #1e4060", borderRadius: 8, fontSize: 12, color: "#e0f4ff" };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #070f1a 0%, #0b1e30 40%, #091525 100%)",
      color: "#e0f4ff",
      fontFamily: "'DM Sans', sans-serif",
      padding: "0 0 60px 0",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(90deg, rgba(0,50,80,0.9) 0%, rgba(0,30,55,0.9) 100%)",
        borderBottom: "1px solid rgba(0,200,255,0.15)",
        padding: "24px 32px 20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 36 }}>🌊</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontFamily: "'Courier Prime', monospace", color: "#00c8ff", letterSpacing: "0.05em" }}>
            COOLING TOWER CoC CALCULATOR
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#5a9ab8" }}>Cycles of Concentration · Water Chemistry · Cost Analysis in ₹</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, maxWidth: 1400, margin: "0 auto", padding: "0 16px" }}>

        {/* ── Sidebar ── */}
        <div style={{
          width: 300, minWidth: 280, padding: "24px 20px",
          borderRight: "1px solid rgba(0,200,255,0.1)",
          background: "rgba(0,15,30,0.4)",
        }}>
          <div style={{ fontSize: 11, color: "#00c8ff", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.15em", marginBottom: 16, borderBottom: "1px solid rgba(0,200,255,0.2)", paddingBottom: 6 }}>
            WATER QUALITY
          </div>
          <Slider label="Make-up Conductivity" value={makeupCond} min={50} max={2000} step={10} onChange={setMakeupCond} unit=" µS/cm" />
          <Slider label="Blowdown Conductivity" value={blowdownCond} min={100} max={10000} step={50} onChange={setBlowdownCond} unit=" µS/cm" />

          <div style={{ fontSize: 11, color: "#00c8ff", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.15em", margin: "20px 0 16px", borderBottom: "1px solid rgba(0,200,255,0.2)", paddingBottom: 6 }}>
            SYSTEM PARAMETERS
          </div>
          <Slider label="Circulation Flow" value={circulation} min={10} max={10000} step={10} onChange={setCirculation} unit=" m³/h" />
          <Slider label="Evaporation Rate" value={evapPct} min={0.1} max={10} step={0.1} onChange={setEvapPct} unit="%" />
          <Slider label="Drift Rate" value={driftPct} min={0.001} max={1.0} step={0.001} onChange={setDriftPct} unit="%" />
          <Slider label="Target CoC" value={targetCoc} min={1.5} max={20} step={0.5} onChange={setTargetCoc} unit="×" hint="Target for savings comparison" />
          <Slider label="Operating Hours/Year" value={operatingHours} min={1000} max={10000} step={100} onChange={setOperatingHours} unit=" h/yr" />

          <div style={{ fontSize: 11, color: "#ffb300", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.15em", margin: "20px 0 16px", borderBottom: "1px solid rgba(255,179,0,0.2)", paddingBottom: 6 }}>
            COST INPUTS (₹)
          </div>
          <Slider label="Water Purchase Cost" value={waterCostPerM3} min={5} max={200} step={5} onChange={setWaterCostPerM3} unit="₹" hint="₹ per m³ of make-up water" />
          <Slider label="Chemical Treatment Cost" value={chemCostPerM3} min={1} max={100} step={1} onChange={setChemCostPerM3} unit="₹" hint="₹ per m³ treated" />
          <Slider label="Sewage / Disposal Cost" value={sewageCostPerM3} min={0} max={100} step={1} onChange={setSewageCostPerM3} unit="₹" hint="₹ per m³ blowdown discharged" />
        </div>

        {/* ── Main Content ── */}
        <div style={{ flex: 1, padding: "24px 24px" }}>

          {/* CoC Hero */}
          <div style={{
            background: `linear-gradient(135deg, rgba(0,200,255,0.08), rgba(0,0,0,0))`,
            border: `2px solid ${statusColors[cocStatus]}40`,
            borderRadius: 18, padding: "24px 28px", marginBottom: 24,
            display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap"
          }}>
            <div>
              <div style={{ fontSize: 11, color: "#5a9ab8", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.15em", marginBottom: 4 }}>CYCLES OF CONCENTRATION</div>
              <div style={{ fontSize: 64, fontWeight: 700, color: statusColors[cocStatus], fontFamily: "'Courier Prime', monospace", lineHeight: 1, textShadow: `0 0 30px ${statusColors[cocStatus]}60` }}>
                {calc.coc.toFixed(2)}×
              </div>
              <div style={{ fontSize: 13, color: statusColors[cocStatus], marginTop: 4, fontWeight: 600 }}>{statusText[cocStatus]}</div>
            </div>
            <div style={{ flex: 1, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <MetricCard label="Make-up Flow" value={`${fmt(calc.makeup, 1)} m³/h`} sub={`${fmt(calc.annualMakeup, 0)} m³/yr`} />
              <MetricCard label="Blowdown Flow" value={`${fmt(calc.blowdown, 2)} m³/h`} sub={`${fmt(calc.annualBlowdown, 0)} m³/yr`} />
              <MetricCard label="Evaporation" value={`${fmt(calc.evap, 2)} m³/h`} />
              <MetricCard label="Water Saved" value={`${fmt(calc.waterSavingPct, 1)}%`} sub="vs CoC = 1×" accent="#00ff99" />
            </div>
          </div>

          {/* Cost Cards */}
          <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
            {[
              { label: "Annual Water Cost", val: calc.annualWaterCost, color: "#00c8ff" },
              { label: "Annual Chemical Cost", val: calc.annualChemCost, color: "#ffb300" },
              { label: "Annual Sewage Cost", val: calc.annualSewageCost, color: "#ff6b6b" },
              { label: "TOTAL ANNUAL COST", val: calc.totalAnnualCost, color: "#e0f4ff", big: true },
            ].map(({ label, val, color, big }) => (
              <div key={label} style={{
                flex: 1, minWidth: 150,
                background: big ? "rgba(0,200,255,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${color}30`,
                borderRadius: 12, padding: "14px 18px",
              }}>
                <div style={{ fontSize: 10, color: "#5a9ab8", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: big ? 22 : 18, fontWeight: 700, color, fontFamily: "'Courier Prime', monospace" }}>{fmtRs(val)}</div>
                <div style={{ fontSize: 11, color: "#3a6070", marginTop: 2 }}>per year</div>
              </div>
            ))}
          </div>

          {/* Savings Banner */}
          <div style={{
            background: "linear-gradient(90deg, rgba(0,255,100,0.07), rgba(0,0,0,0))",
            border: "1px solid rgba(0,255,100,0.25)",
            borderRadius: 12, padding: "14px 20px", marginBottom: 24,
            display: "flex", gap: 40, flexWrap: "wrap", alignItems: "center"
          }}>
            <div>
              <div style={{ fontSize: 10, color: "#5a9ab8", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.12em" }}>SAVINGS vs CoC = 1× (No Concentration)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#00ff99", fontFamily: "'Courier Prime', monospace" }}>{fmtRs(calc.annualSaving)} / yr</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#5a9ab8", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.12em" }}>ADDITIONAL SAVINGS if Target CoC ({targetCoc}×) Achieved</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: calc.targetSaving >= 0 ? "#00ff99" : "#ff6b6b", fontFamily: "'Courier Prime', monospace" }}>
                {calc.targetSaving >= 0 ? "+" : ""}{fmtRs(calc.targetSaving)} / yr
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, marginBottom: 24 }}>
            {/* Line Chart */}
            <div style={{ background: "rgba(0,15,30,0.6)", border: "1px solid rgba(0,200,255,0.1)", borderRadius: 14, padding: "16px 8px 8px 8px" }}>
              <div style={{ fontSize: 12, color: "#5a9ab8", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em", marginBottom: 10, paddingLeft: 12 }}>ANNUAL COST (₹ LAKHS) vs CoC</div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={calc.curve} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="coc" stroke="#3a6070" tick={{ fontSize: 11, fill: "#5a9ab8" }} label={{ value: "CoC (×)", position: "insideBottom", offset: -2, fill: "#5a9ab8", fontSize: 11 }} />
                  <YAxis stroke="#3a6070" tick={{ fontSize: 11, fill: "#5a9ab8" }} label={{ value: "₹ Lakhs/yr", angle: -90, position: "insideLeft", fill: "#5a9ab8", fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`₹${v}L`, "Annual Cost"]} labelFormatter={l => `CoC: ${l}×`} />
                  <Line type="monotone" dataKey="annualCostL" stroke="#00c8ff" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div style={{ background: "rgba(0,15,30,0.6)", border: "1px solid rgba(0,200,255,0.1)", borderRadius: 14, padding: "16px 8px 8px 8px" }}>
              <div style={{ fontSize: 12, color: "#5a9ab8", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em", marginBottom: 10, paddingLeft: 12 }}>COST BREAKDOWN</div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={calc.pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                    {calc.pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtRs(v), ""]} />
                  <Legend formatter={(v) => <span style={{ color: "#8ab4cc", fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sensitivity Table */}
          <div style={{ background: "rgba(0,15,30,0.6)", border: "1px solid rgba(0,200,255,0.1)", borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "#5a9ab8", fontFamily: "'Courier Prime', monospace", letterSpacing: "0.1em", marginBottom: 14 }}>SENSITIVITY TABLE — COST vs CoC</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,200,255,0.2)" }}>
                    {["CoC", "Make-up (m³/h)", "Blowdown (m³/h)", "Annual Make-up (m³)", "Annual Cost (₹)", "Status"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#5a9ab8", fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.08em", fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calc.curve.filter(r => [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 8, 10, 12, 15, 20].includes(r.coc)).map((row) => {
                    const annualMu  = row.makeup * operatingHours;
                    const annualBd  = row.blowdown * operatingHours;
                    const cost      = annualMu * (waterCostPerM3 + chemCostPerM3) + annualBd * sewageCostPerM3;
                    const isCurrent = Math.abs(row.coc - calc.coc) < 0.3;
                    const s = row.coc < 2 ? "⚠ Low" : row.coc <= 6 ? "✓ Optimal" : "⚡ High";
                    const sc = row.coc < 2 ? "#ffb300" : row.coc <= 6 ? "#00c8ff" : "#ff6b6b";
                    return (
                      <tr key={row.coc} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: isCurrent ? "rgba(0,200,255,0.07)" : "transparent" }}>
                        <td style={{ padding: "8px 12px", fontFamily: "'Courier Prime', monospace", color: isCurrent ? "#00c8ff" : "#e0f4ff", fontWeight: isCurrent ? 700 : 400 }}>
                          {row.coc}× {isCurrent ? "◄" : ""}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#b0d4e8" }}>{fmt(row.makeup, 2)}</td>
                        <td style={{ padding: "8px 12px", color: "#b0d4e8" }}>{fmt(row.blowdown, 3)}</td>
                        <td style={{ padding: "8px 12px", color: "#b0d4e8" }}>{fmt(annualMu, 0)}</td>
                        <td style={{ padding: "8px 12px", fontFamily: "'Courier Prime', monospace", color: "#ffb300", fontWeight: 600 }}>{fmtRs(cost)}</td>
                        <td style={{ padding: "8px 12px", color: sc, fontWeight: 600 }}>{s}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Formula footer */}
          <div style={{ marginTop: 20, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 20px", fontSize: 12, color: "#4a7090" }}>
            <span style={{ color: "#00c8ff", fontFamily: "'Courier Prime', monospace" }}>FORMULA: </span>
            CoC = C_blowdown / C_makeup &nbsp;|&nbsp; Blowdown = Evaporation / CoC − Drift &nbsp;|&nbsp;
            Make-up = Evaporation + Blowdown + Drift &nbsp;|&nbsp;
            Annual Cost = Make-up × (Water + Chemical) + Blowdown × Sewage
          </div>
        </div>
      </div>
    </div>
  );
}
