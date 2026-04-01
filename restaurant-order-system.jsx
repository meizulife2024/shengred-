import { useState, useEffect } from "react";

const mockProducts = [
  { id: 1, name: "豬五花肉", category: "肉類", unit: "kg", safetyStock: 5, currentStock: 3.5, avgDaily: 2.1, leadDays: 1 },
  { id: 2, name: "雞腿肉", category: "肉類", unit: "kg", safetyStock: 8, currentStock: 12, avgDaily: 3.2, leadDays: 1 },
  { id: 3, name: "高麗菜", category: "蔬菜", unit: "kg", safetyStock: 6, currentStock: 2, avgDaily: 4.5, leadDays: 1 },
  { id: 4, name: "青蔥", category: "蔬菜", unit: "把", safetyStock: 10, currentStock: 6, avgDaily: 3.8, leadDays: 1 },
  { id: 5, name: "豆腐", category: "豆製品", unit: "盒", safetyStock: 12, currentStock: 8, avgDaily: 5.0, leadDays: 1 },
  { id: 6, name: "白蘿蔔", category: "蔬菜", unit: "kg", safetyStock: 4, currentStock: 7, avgDaily: 1.8, leadDays: 1 },
  { id: 7, name: "雞蛋", category: "蛋品", unit: "顆", safetyStock: 60, currentStock: 25, avgDaily: 30, leadDays: 1 },
  { id: 8, name: "豬絞肉", category: "肉類", unit: "kg", safetyStock: 5, currentStock: 9, avgDaily: 2.5, leadDays: 1 },
];

const holidays = ["2025-01-01","2025-02-08","2025-02-09","2025-02-10","2025-04-04","2025-06-09","2025-09-08","2025-10-10"];

const HOLIDAY_MULTIPLIER = 1.45;
const WEEKDAY_MULTIPLIER = { 0: 1.3, 6: 1.25, 1: 0.9, 2: 0.9, 3: 0.95, 4: 1.0, 5: 1.15 };

function getStatus(item) {
  const daysLeft = item.currentStock / item.avgDaily;
  if (item.currentStock <= item.safetyStock * 0.5) return "缺貨危機";
  if (item.currentStock <= item.safetyStock) return "庫存不足";
  if (daysLeft > 4) return "庫存充足";
  return "即將不足";
}

function getStatusColor(status) {
  return {
    "缺貨危機": "#ff3b30",
    "庫存不足": "#ff9500",
    "即將不足": "#ffcc00",
    "庫存充足": "#30d158",
  }[status] || "#8e8e93";
}

function calcOrderQty(item, days, isHoliday, dayOfWeek) {
  const mult = isHoliday ? HOLIDAY_MULTIPLIER : (WEEKDAY_MULTIPLIER[dayOfWeek] ?? 1.0);
  const demand = item.avgDaily * mult * days;
  const restock = Math.max(0, item.safetyStock * 1.5 + demand - item.currentStock);
  return Math.ceil(restock * 10) / 10;
}

const categories = ["全部", "肉類", "蔬菜", "豆製品", "蛋品"];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [selectedCat, setSelectedCat] = useState("全部");
  const [products, setProducts] = useState(mockProducts);
  const [orderDays, setOrderDays] = useState(2);
  const [csvData, setCsvData] = useState("");
  const [importedData, setImportedData] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const isHolidayToday = holidays.includes(todayStr);
  const dow = today.getDay();

  const filtered = selectedCat === "全部" ? products : products.filter(p => p.category === selectedCat);

  const alerts = products.filter(p => {
    const s = getStatus(p);
    return s === "缺貨危機" || s === "庫存不足";
  });

  function startEdit(item) {
    setEditingId(item.id);
    setEditValues({ currentStock: item.currentStock, safetyStock: item.safetyStock, avgDaily: item.avgDaily });
  }
  function saveEdit(id) {
    setProducts(ps => ps.map(p => p.id === id ? { ...p, ...editValues } : p));
    setEditingId(null);
  }

  async function handleAiAnalysis() {
    setAiLoading(true);
    setAiAnalysis("");
    const summary = products.map(p => ({
      name: p.name, category: p.category, currentStock: p.currentStock,
      safetyStock: p.safetyStock, avgDaily: p.avgDaily, status: getStatus(p),
      orderQty: calcOrderQty(p, orderDays, isHolidayToday, dow)
    }));
    const prompt = `你是一位餐飲業採購顧問，請根據以下庫存與銷售數據，提供專業的叫貨建議與毛利提升策略。請用繁體中文回答，結構清晰，分點說明：\n\n${JSON.stringify(summary, null, 2)}\n\n今天是否為假日：${isHolidayToday ? "是" : "否"}，預計叫貨天數：${orderDays}天\n\n請針對：1.即將缺貨品項的緊急建議 2.假日叫貨量調整策略 3.降低缺貨率的建議 4.毛利提升機會`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      setAiAnalysis(data.content?.map(c => c.text).join("\n") || "無法取得分析結果");
    } catch {
      setAiAnalysis("AI 分析失敗，請稍後再試。");
    }
    setAiLoading(false);
  }

  function handleCsvImport() {
    const lines = csvData.trim().split("\n");
    const parsed = lines.slice(1).map(l => {
      const [name, category, unit, currentStock, safetyStock, avgDaily] = l.split(",");
      return { id: Date.now() + Math.random(), name: name?.trim(), category: category?.trim(), unit: unit?.trim(), currentStock: parseFloat(currentStock) || 0, safetyStock: parseFloat(safetyStock) || 0, avgDaily: parseFloat(avgDaily) || 0, leadDays: 1 };
    }).filter(p => p.name);
    setImportedData(parsed);
    if (parsed.length > 0) setProducts(prev => [...prev.filter(p => !parsed.find(np => np.name === p.name)), ...parsed]);
  }

  const totalAlerts = alerts.length;
  const outOfStock = products.filter(p => getStatus(p) === "缺貨危機").length;
  const avgStockRate = Math.round(products.reduce((s, p) => s + (p.currentStock / (p.safetyStock * 1.5)), 0) / products.length * 100);

  return (
    <div style={{ fontFamily: "'Noto Sans TC', sans-serif", background: "#0f0f14", minHeight: "100vh", color: "#e8e8f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1a1a24; }
        ::-webkit-scrollbar-thumb { background: #3a3a50; border-radius: 3px; }
        .tab-btn { background: none; border: none; color: #888; cursor: pointer; padding: 10px 18px; font-size: 14px; font-family: inherit; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .tab-btn.active { color: #f5c518; border-bottom: 2px solid #f5c518; }
        .tab-btn:hover { color: #f5c518; }
        .card { background: #1a1a24; border-radius: 12px; border: 1px solid #2a2a38; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
        .btn { border: none; cursor: pointer; font-family: inherit; border-radius: 8px; font-weight: 600; transition: all 0.2s; }
        .btn-primary { background: #f5c518; color: #0f0f14; padding: 10px 20px; font-size: 14px; }
        .btn-primary:hover { background: #ffd740; }
        .btn-sm { background: #2a2a38; color: #aaa; padding: 5px 12px; font-size: 12px; border-radius: 6px; }
        .btn-sm:hover { background: #3a3a50; color: #e8e8f0; }
        .btn-save { background: #30d158; color: #fff; padding: 5px 12px; font-size: 12px; border-radius: 6px; }
        input[type=number], input[type=text], textarea { background: #12121a; border: 1px solid #2a2a38; color: #e8e8f0; border-radius: 6px; font-family: inherit; padding: 6px 10px; }
        input[type=number]:focus, textarea:focus { outline: 1px solid #f5c518; }
        .progress-bar { height: 6px; border-radius: 3px; background: #2a2a38; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .pulse { animation: pulse 1.5s infinite; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#15151e", borderBottom: "1px solid #2a2a38", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🍽️</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: "#f5c518" }}>智慧叫貨系統</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isHolidayToday && <span className="badge" style={{ background: "#ff375f22", color: "#ff375f" }}>📅 今日假日 +45%</span>}
            <span style={{ fontSize: 13, color: "#666" }}>{today.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</span>
            {totalAlerts > 0 && <span className="badge pulse" style={{ background: "#ff3b3022", color: "#ff3b30" }}>⚠️ {totalAlerts} 項警示</span>}
          </div>
        </div>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 0 }}>
          {[["dashboard","📊 儀表板"],["order","🛒 叫貨計算"],["ai","🤖 AI分析"],["import","📥 匯入數據"]].map(([key, label]) => (
            <button key={key} className={`tab-btn${tab===key?" active":""}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>

        {/* DASHBOARD TAB */}
        {tab === "dashboard" && (
          <div>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "缺貨危機", value: outOfStock, unit: "項", color: "#ff3b30", icon: "🔴" },
                { label: "庫存警示", value: totalAlerts, unit: "項", color: "#ff9500", icon: "⚠️" },
                { label: "平均庫存率", value: avgStockRate + "%", unit: "", color: "#30d158", icon: "📦" },
                { label: "監控品項", value: products.length, unit: "項", color: "#0a84ff", icon: "📋" },
              ].map(k => (
                <div key={k.label} className="card" style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{k.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {categories.map(c => (
                <button key={c} className="btn btn-sm" onClick={() => setSelectedCat(c)}
                  style={{ background: selectedCat===c ? "#f5c518" : "#2a2a38", color: selectedCat===c ? "#0f0f14" : "#aaa" }}>
                  {c}
                </button>
              ))}
            </div>

            {/* Product Table */}
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a2a38", fontWeight: 700, fontSize: 15 }}>庫存總覽</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#12121a" }}>
                      {["品名","分類","現有庫存","安全庫存","日均消耗","可用天數","庫存狀態","操作"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#666", fontWeight: 600, fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(item => {
                      const status = getStatus(item);
                      const daysLeft = (item.currentStock / item.avgDaily).toFixed(1);
                      const isEditing = editingId === item.id;
                      const stockPct = Math.min(100, Math.round(item.currentStock / (item.safetyStock * 1.5) * 100));
                      return (
                        <tr key={item.id} style={{ borderTop: "1px solid #1e1e2a" }}>
                          <td style={{ padding: "12px 14px", fontWeight: 600 }}>{item.name}</td>
                          <td style={{ padding: "12px 14px", color: "#888" }}>{item.category}</td>
                          <td style={{ padding: "12px 14px" }}>
                            {isEditing ? (
                              <input type="number" value={editValues.currentStock} onChange={e => setEditValues(v => ({...v, currentStock: parseFloat(e.target.value)}))} style={{ width: 70 }} />
                            ) : (
                              <div>
                                <span style={{ fontWeight: 700 }}>{item.currentStock}</span> <span style={{ color: "#666", fontSize: 12 }}>{item.unit}</span>
                                <div className="progress-bar" style={{ marginTop: 4, width: 80 }}>
                                  <div className="progress-fill" style={{ width: stockPct+"%", background: stockPct < 50 ? "#ff3b30" : stockPct < 75 ? "#ff9500" : "#30d158" }} />
                                </div>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            {isEditing ? (
                              <input type="number" value={editValues.safetyStock} onChange={e => setEditValues(v => ({...v, safetyStock: parseFloat(e.target.value)}))} style={{ width: 70 }} />
                            ) : <span>{item.safetyStock} {item.unit}</span>}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            {isEditing ? (
                              <input type="number" value={editValues.avgDaily} onChange={e => setEditValues(v => ({...v, avgDaily: parseFloat(e.target.value)}))} style={{ width: 70 }} />
                            ) : <span>{item.avgDaily} {item.unit}/日</span>}
                          </td>
                          <td style={{ padding: "12px 14px", color: parseFloat(daysLeft) < 2 ? "#ff3b30" : "#e8e8f0", fontWeight: 700 }}>{daysLeft} 天</td>
                          <td style={{ padding: "12px 14px" }}>
                            <span className="badge" style={{ background: getStatusColor(status)+"22", color: getStatusColor(status) }}>{status}</span>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            {isEditing ? (
                              <button className="btn btn-save" onClick={() => saveEdit(item.id)}>儲存</button>
                            ) : (
                              <button className="btn btn-sm" onClick={() => startEdit(item)}>編輯</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ORDER TAB */}
        {tab === "order" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
              <div className="card" style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "#888", fontSize: 14 }}>叫貨天數</span>
                <input type="number" min={1} max={7} value={orderDays} onChange={e => setOrderDays(parseInt(e.target.value)||1)}
                  style={{ width: 60, textAlign: "center", fontSize: 16, fontWeight: 700 }} />
                <span style={{ color: "#666", fontSize: 13 }}>天</span>
              </div>
              {isHolidayToday && (
                <div className="card" style={{ padding: "14px 20px", background: "#ff375f11", borderColor: "#ff375f33" }}>
                  <span style={{ color: "#ff375f", fontWeight: 700, fontSize: 14 }}>📅 今日為假日，已自動調高叫貨量 +45%</span>
                </div>
              )}
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a2a38", fontWeight: 700 }}>叫貨清單（建議量）</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#12121a" }}>
                    {["品名","現有庫存","安全庫存","日均消耗","建議叫貨量","狀態"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#666", fontWeight: 600, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map(item => {
                    const qty = calcOrderQty(item, orderDays, isHolidayToday, dow);
                    const status = getStatus(item);
                    const urgent = status === "缺貨危機" || status === "庫存不足";
                    return (
                      <tr key={item.id} style={{ borderTop: "1px solid #1e1e2a", background: urgent ? "#ff3b3008" : "transparent" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 600 }}>{item.name} {urgent && <span style={{ color: "#ff3b30", fontSize: 11 }}>●</span>}</td>
                        <td style={{ padding: "12px 14px" }}>{item.currentStock} {item.unit}</td>
                        <td style={{ padding: "12px 14px" }}>{item.safetyStock} {item.unit}</td>
                        <td style={{ padding: "12px 14px" }}>{item.avgDaily} {item.unit}/日</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 18, fontWeight: 900, color: qty > 0 ? "#f5c518" : "#30d158" }}>{qty > 0 ? qty : "—"}</span>
                          {qty > 0 && <span style={{ color: "#666", fontSize: 12, marginLeft: 4 }}>{item.unit}</span>}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span className="badge" style={{ background: getStatusColor(status)+"22", color: getStatusColor(status) }}>{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, color: "#555", fontSize: 13 }}>
              ※ 叫貨量 = 安全庫存 × 1.5 + 預計需求 − 現有庫存，假日天自動乘以 1.45，週末乘以 1.25
            </div>
          </div>
        )}

        {/* AI ANALYSIS TAB */}
        {tab === "ai" && (
          <div>
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>🤖 AI 採購顧問分析</div>
              <div style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>根據你的庫存、銷售數據與假日資訊，AI 將提供叫貨策略、缺貨預防與毛利提升建議。</div>
              <button className="btn btn-primary" onClick={handleAiAnalysis} disabled={aiLoading}>
                {aiLoading ? "⏳ 分析中..." : "▶ 開始 AI 分析"}
              </button>
            </div>

            {aiAnalysis && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontWeight: 700, marginBottom: 16, color: "#f5c518" }}>📋 分析結果</div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 14, color: "#ccc" }}>{aiAnalysis}</div>
              </div>
            )}

            {!aiAnalysis && !aiLoading && (
              <div style={{ textAlign: "center", color: "#444", padding: "60px 0", fontSize: 14 }}>
                點擊上方按鈕開始分析
              </div>
            )}
          </div>
        )}

        {/* IMPORT TAB */}
        {tab === "import" && (
          <div>
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📥 匯入 POS 數據（CSV 格式）</div>
              <div style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
                請貼上 CSV 內容，欄位順序：<br />
                <code style={{ background: "#12121a", padding: "4px 8px", borderRadius: 4, color: "#f5c518", fontSize: 12 }}>品名,分類,單位,現有庫存,安全庫存,日均消耗</code>
              </div>
              <div style={{ background: "#12121a", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12, color: "#666" }}>
                範例：<br />
                豬五花肉,肉類,kg,5.5,5,2.1<br />
                高麗菜,蔬菜,kg,3,6,4.5
              </div>
              <textarea
                rows={8}
                placeholder="品名,分類,單位,現有庫存,安全庫存,日均消耗&#10;豬五花肉,肉類,kg,5.5,5,2.1"
                value={csvData}
                onChange={e => setCsvData(e.target.value)}
                style={{ width: "100%", fontSize: 13, resize: "vertical", marginBottom: 14 }}
              />
              <button className="btn btn-primary" onClick={handleCsvImport}>匯入數據</button>
              {importedData.length > 0 && (
                <div style={{ marginTop: 12, color: "#30d158", fontSize: 13 }}>✅ 已匯入 {importedData.length} 筆品項</div>
              )}
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>📅 假日設定</div>
              <div style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>目前已設定假日（叫貨量自動 +45%）：</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {holidays.map(d => (
                  <span key={d} className="badge" style={{ background: "#f5c51822", color: "#f5c518" }}>{d}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
