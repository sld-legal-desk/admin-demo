const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FP技能検定 学習アプリ
// ビルド不要 / React(CDN) + Babel standalone
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CATS = window.FP_CATEGORIES;
const QS = window.FP_QUESTIONS;
const CAT_MAP = Object.fromEntries(CATS.map(c => [c.id, c]));

// ── カラートークン（金融テーマ：グリーン×ゴールド）──────────
const T = {
  g1:"#0f3320", g2:"#1a5c38", g3:"#1a8f5e", g4:"#22b87a",
  gold:"#c8a84b", goldPale:"#fdf8e6",
  bg:"#f4f3ef", surface:"#fafaf8", white:"#ffffff",
  ink:"#1a1a14", ink2:"#2e2e24", ink3:"#5a5a4c", ink4:"#8a8a78",
  rule:"#e2ded2", rule2:"#cfc9ba",
  red:"#b71c1c", redPale:"#fef2f2",
  amber:"#e65100", amberPale:"#fff3e0",
  ok:"#1a7a4a", okPale:"#e8f5e9",
  sS:"0 1px 4px rgba(15,51,32,.08)", sM:"0 6px 24px rgba(15,51,32,.12)",
};

// ── localStorage 永続化 ──────────────────────
const LS_KEY = "fp_study_v1";
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { stats: {}, log: [], days: [], srs: {} };
  // stats[qid] = {seen, correct, wrong}
  // log = [{date, total, correct, mode}]
  // days = ["2026-06-27", ...] 学習した日
}
function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
}

// ── 日付ユーティリティ ──────────────────────
function todayStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function streakOf(days) {
  if (!days || !days.length) return 0;
  const set = new Set(days);
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 3650; i++) {
    const p = n => String(n).padStart(2, "0");
    const key = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    if (set.has(key)) { streak++; d.setDate(d.getDate() - 1); }
    else if (i === 0) { d.setDate(d.getDate() - 1); } // 今日まだなら昨日から数える
    else break;
  }
  return streak;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ━━━━━━━━━━ 共通UIコンポーネント ━━━━━━━━━━
function Card({ children, style, ...rest }) {
  return (
    <div style={{ background:T.white, borderRadius:14, boxShadow:T.sS, border:`1px solid ${T.rule}`, padding:"20px 22px", ...style }} {...rest}>
      {children}
    </div>
  );
}
function Btn({ children, onClick, kind="primary", disabled, style }) {
  const base = {
    border:"none", borderRadius:10, cursor: disabled ? "not-allowed" : "pointer",
    fontWeight:800, fontSize:14, padding:"12px 20px", fontFamily:"inherit",
    transition:"transform .08s, box-shadow .15s, opacity .15s", opacity: disabled?0.5:1,
  };
  const kinds = {
    primary: { background:`linear-gradient(135deg,${T.g2},${T.g3})`, color:"#fff", boxShadow:T.sS },
    gold:    { background:`linear-gradient(135deg,${T.gold},#b8973f)`, color:"#3a2e00", boxShadow:T.sS },
    ghost:   { background:T.white, color:T.ink2, border:`1.5px solid ${T.rule2}` },
    danger:  { background:T.redPale, color:T.red, border:`1.5px solid ${T.red}` },
  };
  return (
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      style={{ ...base, ...kinds[kind], ...style }}
      onMouseDown={e=>{ if(!disabled) e.currentTarget.style.transform="scale(0.97)"; }}
      onMouseUp={e=>{ e.currentTarget.style.transform="scale(1)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform="scale(1)"; }}>
      {children}
    </button>
  );
}
function Bar({ pct, color, height=10, bg=T.rule }) {
  return (
    <div style={{ background:bg, borderRadius:99, height, overflow:"hidden", width:"100%" }}>
      <div style={{ width:`${Math.max(0,Math.min(100,pct))}%`, height:"100%",
        background:color||T.g3, borderRadius:99, transition:"width .5s ease" }} />
    </div>
  );
}
function Ring({ pct, size=120, stroke=12, color=T.g3, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0,Math.min(100,pct)) / 100);
  return (
    <div style={{ position:"relative", width:size, height:size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.rule} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition:"stroke-dashoffset .8s ease" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize:size*0.26, fontWeight:900, color:T.ink, lineHeight:1 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:T.ink4, marginTop:4 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ━━━━━━━━━━ ホーム / ダッシュボード ━━━━━━━━━━
function HomeView({ state, go }) {
  const totals = useMemo(() => {
    let seen=0, correct=0, wrong=0;
    Object.values(state.stats).forEach(s => { seen+=s.seen; correct+=s.correct; wrong+=s.wrong; });
    const answered = correct + wrong;
    return { seen, correct, wrong, answered, rate: answered ? Math.round(correct/answered*100) : 0 };
  }, [state]);

  const byCat = useMemo(() => CATS.map(c => {
    const qs = QS.filter(q => q.cat === c.id);
    let correct=0, wrong=0, studiedIds=new Set();
    qs.forEach(q => { const s=state.stats[q.id]; if(s){ correct+=s.correct; wrong+=s.wrong; if(s.seen>0) studiedIds.add(q.id);} });
    const answered = correct + wrong;
    return { ...c, total: qs.length, studied: studiedIds.size,
      rate: answered ? Math.round(correct/answered*100) : 0,
      coverage: Math.round(studiedIds.size / qs.length * 100) };
  }), [state]);

  const streak = streakOf(state.days);
  const wrongCount = useMemo(() =>
    QS.filter(q => { const s=state.stats[q.id]; return s && s.wrong > s.correct; }).length, [state]);
  const studiedToday = (state.days||[]).includes(todayStr());

  return (
    <div>
      <Hero streak={streak} studiedToday={studiedToday} />

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginTop:18 }} className="fp-stat-grid">
        <Card style={{ textAlign:"center" }}>
          <div style={{ fontSize:11, fontWeight:800, color:T.ink4, letterSpacing:1 }}>総合正答率</div>
          <div style={{ fontSize:38, fontWeight:900, color: totals.rate>=60?T.ok:T.amber, lineHeight:1.2 }}>{totals.rate}<span style={{fontSize:18}}>%</span></div>
          <div style={{ fontSize:11, color:T.ink4 }}>{totals.correct} / {totals.answered} 問正解</div>
        </Card>
        <Card style={{ textAlign:"center" }}>
          <div style={{ fontSize:11, fontWeight:800, color:T.ink4, letterSpacing:1 }}>学習した問題</div>
          <div style={{ fontSize:38, fontWeight:900, color:T.g2, lineHeight:1.2 }}>{Object.values(state.stats).filter(s=>s.seen>0).length}<span style={{fontSize:18, color:T.ink4}}> / {QS.length}</span></div>
          <div style={{ fontSize:11, color:T.ink4 }}>収録問題数</div>
        </Card>
        <Card style={{ textAlign:"center" }}>
          <div style={{ fontSize:11, fontWeight:800, color:T.ink4, letterSpacing:1 }}>連続学習日数</div>
          <div style={{ fontSize:38, fontWeight:900, color:T.gold, lineHeight:1.2 }}>{streak}<span style={{fontSize:18, color:T.ink4}}> 日</span></div>
          <div style={{ fontSize:11, color:T.ink4 }}>{studiedToday ? "今日も学習済み 🎉" : "今日はまだ未学習"}</div>
        </Card>
      </div>

      {/* クイックアクション */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:14 }} className="fp-stat-grid">
        <Card style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:`linear-gradient(135deg,${T.g1},${T.g2})`, border:"none" }}>
          <div>
            <div style={{ fontSize:16, fontWeight:900, color:"#fff" }}>模試にチャレンジ</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.8)", marginTop:4 }}>全分野からランダム10問・時間計測</div>
          </div>
          <Btn kind="gold" onClick={()=>go("exam")}>開始 →</Btn>
        </Card>
        <Card style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:16, fontWeight:900, color:T.ink }}>苦手を復習</div>
            <div style={{ fontSize:12, color:T.ink3, marginTop:4 }}>{wrongCount} 問が要復習</div>
          </div>
          <Btn kind={wrongCount?"primary":"ghost"} disabled={!wrongCount} onClick={()=>go("review")}>復習する</Btn>
        </Card>
      </div>

      {/* 分野別 */}
      <div style={{ marginTop:22, marginBottom:10, fontSize:14, fontWeight:900, color:T.ink2 }}>分野別の習熟度</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }} className="fp-stat-grid">
        {byCat.map(c => (
          <Card key={c.id} style={{ cursor:"pointer", padding:"16px 18px" }} onClick={()=>go("practice", { cat:c.id })}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <span style={{ fontSize:22 }}>{c.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:900, color:T.ink }}>{c.name}</div>
                <div style={{ fontSize:11, color:T.ink4 }}>{c.studied}/{c.total}問 学習 ・ 正答率 {c.rate}%</div>
              </div>
              <div style={{ fontSize:18, fontWeight:900, color: c.coverage>=100?T.ok:c.color }}>{c.coverage}%</div>
            </div>
            <Bar pct={c.coverage} color={c.color} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function Hero({ streak, studiedToday }) {
  const days = 31; // 試験までのカウントダウンはデモ。実日付は固定しない
  return (
    <div style={{ background:`linear-gradient(120deg,${T.g1} 0%,${T.g2} 55%,${T.g3} 100%)`,
      borderRadius:16, padding:"26px 28px", color:"#fff", position:"relative", overflow:"hidden",
      boxShadow:T.sM }}>
      <div style={{ position:"absolute", right:-30, top:-30, fontSize:160, opacity:0.08 }}>🎓</div>
      <div style={{ fontFamily:"Cinzel, serif", fontSize:12, letterSpacing:3, color:T.gold, fontWeight:700 }}>FINANCIAL PLANNING</div>
      <div style={{ fontSize:26, fontWeight:900, marginTop:6 }}>FP技能検定 合格ナビ</div>
      <div style={{ fontSize:13, color:"rgba(255,255,255,.82)", marginTop:8, maxWidth:520, lineHeight:1.6 }}>
        6分野・{QS.length}問を収録。問題演習・模試・苦手復習で、合格ラインの正答率6割超えを目指しましょう。
      </div>
    </div>
  );
}

// ━━━━━━━━━━ 出題エンジン（演習 / 模試 / 復習 共通）━━━━━━━━━━
function Quiz({ questions, mode, title, timed, onFinish, onExit, recordAnswer }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null); // ox: true/false, mc: index
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]); // {qid, correct}
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current)/1000)), 1000);
    return () => clearInterval(t);
  }, [timed]);

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  function choose(val) {
    if (revealed) return;
    setSelected(val);
  }
  function check() {
    if (selected === null || selected === undefined) return;
    const correct = q.type === "ox" ? (selected === q.answer) : (selected === q.answer);
    setRevealed(true);
    const r = { qid: q.id, correct };
    setResults(prev => [...prev, r]);
    recordAnswer(q.id, correct);
  }
  function next() {
    if (isLast) {
      onFinish({ results: results, seconds: Math.floor((Date.now()-startRef.current)/1000), mode });
      return;
    }
    setIdx(idx + 1); setSelected(null); setRevealed(false);
  }

  const cat = CAT_MAP[q.cat];
  const correctNow = revealed && results.length && results[results.length-1].correct;

  return (
    <div style={{ maxWidth:720, margin:"0 auto" }}>
      {/* ヘッダー */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <button onClick={onExit} style={{ background:"none", border:"none", color:T.ink3, cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit" }}>← 中断する</button>
        <div style={{ fontSize:13, fontWeight:800, color:T.ink2 }}>{title}</div>
        <div style={{ fontSize:13, fontWeight:800, color:T.ink3, minWidth:64, textAlign:"right" }}>
          {timed ? `⏱ ${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,"0")}` : `${idx+1}/${questions.length}`}
        </div>
      </div>
      <Bar pct={(idx + (revealed?1:0)) / questions.length * 100} color={T.g3} height={6} />

      {/* 問題カード */}
      <Card style={{ marginTop:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <span style={{ fontSize:11, fontWeight:800, color:"#fff", background:cat.color, padding:"3px 10px", borderRadius:20 }}>{cat.icon} {cat.short}</span>
          <span style={{ fontSize:11, fontWeight:800, color:T.ink4, background:T.bg, padding:"3px 10px", borderRadius:20 }}>{q.level}級レベル</span>
          <span style={{ fontSize:11, fontWeight:800, color:T.ink4, background:T.bg, padding:"3px 10px", borderRadius:20 }}>{q.type==="ox"?"○×問題":"三択問題"}</span>
          <span style={{ marginLeft:"auto", fontSize:11, color:T.ink4 }}>第{idx+1}問</span>
        </div>
        <div style={{ fontSize:17, fontWeight:700, color:T.ink, lineHeight:1.7, marginBottom:20 }}>{q.q}</div>

        {/* 選択肢 */}
        {q.type === "ox" ? (
          <div style={{ display:"flex", gap:12 }}>
            {[{v:true,l:"○ 正しい"},{v:false,l:"× 誤り"}].map(opt => (
              <OptBtn key={String(opt.v)} label={opt.l}
                state={optState(revealed, selected===opt.v, opt.v===q.answer)}
                onClick={()=>choose(opt.v)} flex />
            ))}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {q.choices.map((ch, i) => (
              <OptBtn key={i} label={`${String.fromCharCode(65+i)}. ${ch}`}
                state={optState(revealed, selected===i, i===q.answer)}
                onClick={()=>choose(i)} />
            ))}
          </div>
        )}

        {/* 解説 */}
        {revealed && (
          <div style={{ marginTop:18, padding:"16px 18px", borderRadius:12,
            background: correctNow ? T.okPale : T.redPale,
            border:`1.5px solid ${correctNow ? T.ok : T.red}` }}>
            <div style={{ fontSize:14, fontWeight:900, color: correctNow ? T.ok : T.red, marginBottom:6 }}>
              {correctNow ? "正解！ 🎉" : "不正解…"}
              {q.type==="ox" && <span style={{ color:T.ink3, fontWeight:700, marginLeft:8 }}>正解は「{q.answer?"○ 正しい":"× 誤り"}」</span>}
              {q.type==="mc" && <span style={{ color:T.ink3, fontWeight:700, marginLeft:8 }}>正解は {String.fromCharCode(65+q.answer)}</span>}
            </div>
            <div style={{ fontSize:13.5, color:T.ink2, lineHeight:1.7 }}>{q.explain}</div>
          </div>
        )}

        {/* アクション */}
        <div style={{ marginTop:18, display:"flex", justifyContent:"flex-end" }}>
          {!revealed
            ? <Btn onClick={check} disabled={selected===null||selected===undefined}>解答する</Btn>
            : <Btn kind="gold" onClick={next}>{isLast ? "結果を見る →" : "次の問題 →"}</Btn>}
        </div>
      </Card>
    </div>
  );
}
function optState(revealed, isSelected, isCorrect) {
  if (!revealed) return isSelected ? "selected" : "idle";
  if (isCorrect) return "correct";
  if (isSelected && !isCorrect) return "wrong";
  return "dim";
}
function OptBtn({ label, state, onClick, flex }) {
  const styles = {
    idle:     { border:`1.5px solid ${T.rule2}`, background:T.white, color:T.ink2 },
    selected: { border:`2px solid ${T.g3}`, background:T.okPale, color:T.g1 },
    correct:  { border:`2px solid ${T.ok}`, background:T.okPale, color:T.ok },
    wrong:    { border:`2px solid ${T.red}`, background:T.redPale, color:T.red },
    dim:      { border:`1.5px solid ${T.rule}`, background:T.white, color:T.ink4, opacity:0.6 },
  };
  return (
    <button onClick={onClick} style={{ ...styles[state], borderRadius:12, padding:"15px 18px",
      fontSize:15, fontWeight:700, cursor:"pointer", textAlign:"left", fontFamily:"inherit",
      flex: flex?1:"none", transition:"all .12s" }}>
      {label}
    </button>
  );
}

// ━━━━━━━━━━ 結果画面 ━━━━━━━━━━
function ResultView({ result, questions, onRetry, onHome, label }) {
  const correct = result.results.filter(r => r.correct).length;
  const total = result.results.length;
  const rate = total ? Math.round(correct/total*100) : 0;
  const pass = rate >= 60;
  const m = Math.floor(result.seconds/60), s = result.seconds%60;
  const wrongQs = result.results.filter(r=>!r.correct).map(r => questions.find(q=>q.id===r.qid)).filter(Boolean);
  return (
    <div style={{ maxWidth:680, margin:"0 auto", textAlign:"center" }}>
      <div style={{ fontSize:13, fontWeight:800, color:T.ink4, letterSpacing:2, marginBottom:6 }}>{label} 結果</div>
      <Card style={{ paddingTop:30, paddingBottom:30 }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
          <Ring pct={rate} label={`${rate}%`} sub={`${correct}/${total}問`} color={pass?T.ok:T.amber} size={150} stroke={14} />
        </div>
        <div style={{ fontSize:22, fontWeight:900, color: pass?T.ok:T.amber }}>
          {pass ? "合格ライン突破！ 🎉" : "あと一歩…合格は6割から"}
        </div>
        {result.seconds>0 && <div style={{ fontSize:13, color:T.ink4, marginTop:6 }}>所要時間 {m}分{String(s).padStart(2,"0")}秒</div>}
        <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:24 }}>
          <Btn kind="ghost" onClick={onHome}>ホームへ</Btn>
          <Btn onClick={onRetry}>もう一度</Btn>
        </div>
      </Card>

      {wrongQs.length>0 && (
        <div style={{ marginTop:20, textAlign:"left" }}>
          <div style={{ fontSize:13, fontWeight:900, color:T.red, marginBottom:10 }}>間違えた問題（{wrongQs.length}）</div>
          {wrongQs.map(q => (
            <Card key={q.id} style={{ marginBottom:10, padding:"14px 16px" }}>
              <div style={{ fontSize:11, fontWeight:800, color:CAT_MAP[q.cat].color, marginBottom:4 }}>{CAT_MAP[q.cat].icon} {CAT_MAP[q.cat].name}</div>
              <div style={{ fontSize:14, fontWeight:700, color:T.ink, lineHeight:1.6 }}>{q.q}</div>
              <div style={{ fontSize:12.5, color:T.ink3, marginTop:8, lineHeight:1.6 }}>
                <b style={{color:T.ok}}>正解: </b>{q.type==="ox"?(q.answer?"○ 正しい":"× 誤り"):`${String.fromCharCode(65+q.answer)}. ${q.choices[q.answer]}`}<br/>{q.explain}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━ 分野選択（演習）━━━━━━━━━━
function PracticeSelect({ state, onStart }) {
  const [cat, setCat] = useState("all");
  const [type, setType] = useState("all");
  const [count, setCount] = useState(10);

  const pool = useMemo(() => QS.filter(q =>
    (cat==="all" || q.cat===cat) && (type==="all" || q.type===type)), [cat, type]);

  return (
    <div style={{ maxWidth:680, margin:"0 auto" }}>
      <div style={{ fontSize:20, fontWeight:900, color:T.ink, marginBottom:4 }}>問題演習</div>
      <div style={{ fontSize:13, color:T.ink3, marginBottom:18 }}>分野・形式・問題数を選んで演習を始めましょう。</div>

      <Card>
        <FieldLabel>出題分野</FieldLabel>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:18 }}>
          <Chip active={cat==="all"} onClick={()=>setCat("all")}>すべて</Chip>
          {CATS.map(c => <Chip key={c.id} active={cat===c.id} onClick={()=>setCat(c.id)} color={c.color}>{c.icon} {c.short}</Chip>)}
        </div>

        <FieldLabel>出題形式</FieldLabel>
        <div style={{ display:"flex", gap:8, marginBottom:18 }}>
          <Chip active={type==="all"} onClick={()=>setType("all")}>すべて</Chip>
          <Chip active={type==="ox"} onClick={()=>setType("ox")}>○×問題</Chip>
          <Chip active={type==="mc"} onClick={()=>setType("mc")}>三択問題</Chip>
        </div>

        <FieldLabel>問題数（最大 {pool.length} 問）</FieldLabel>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          {[5,10,20].map(n => <Chip key={n} active={count===n} onClick={()=>setCount(n)} disabled={n>pool.length && pool.length>0}>{n}問</Chip>)}
          <Chip active={count==="all"} onClick={()=>setCount("all")}>全部</Chip>
        </div>
      </Card>

      <div style={{ marginTop:18, display:"flex", justifyContent:"center" }}>
        <Btn onClick={()=>onStart(pool, count==="all"?pool.length:Math.min(count,pool.length))}
          disabled={pool.length===0} style={{ padding:"14px 40px", fontSize:16 }}>
          演習を始める（{pool.length===0?0:(count==="all"?pool.length:Math.min(count,pool.length))}問）
        </Btn>
      </div>
    </div>
  );
}
function FieldLabel({ children }) {
  return <div style={{ fontSize:12, fontWeight:800, color:T.ink3, marginBottom:8, letterSpacing:.5 }}>{children}</div>;
}
function Chip({ children, active, onClick, color, disabled }) {
  return (
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      style={{ border:`1.5px solid ${active?(color||T.g3):T.rule2}`, background: active?(color||T.g3):T.white,
        color: active?"#fff":(disabled?T.ink4:T.ink2), borderRadius:20, padding:"8px 16px", fontSize:13,
        fontWeight:800, cursor: disabled?"not-allowed":"pointer", fontFamily:"inherit", opacity:disabled?0.4:1, transition:"all .12s" }}>
      {children}
    </button>
  );
}

// ━━━━━━━━━━ 統計ビュー ━━━━━━━━━━
function StatsView({ state, resetAll }) {
  const byCat = CATS.map(c => {
    const qs = QS.filter(q => q.cat === c.id);
    let correct=0, wrong=0, seen=0;
    qs.forEach(q => { const s=state.stats[q.id]; if(s){ correct+=s.correct; wrong+=s.wrong; if(s.seen>0) seen++; } });
    const ans = correct+wrong;
    return { ...c, ans, correct, rate: ans?Math.round(correct/ans*100):0, seen, total:qs.length };
  });
  const totalAns = byCat.reduce((a,c)=>a+c.ans,0);
  const totalCorrect = byCat.reduce((a,c)=>a+c.correct,0);

  return (
    <div style={{ maxWidth:720, margin:"0 auto" }}>
      <div style={{ fontSize:20, fontWeight:900, color:T.ink, marginBottom:18 }}>学習統計</div>

      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
          <Ring pct={totalAns?Math.round(totalCorrect/totalAns*100):0}
            label={`${totalAns?Math.round(totalCorrect/totalAns*100):0}%`} sub="総合正答率" size={130} stroke={13}
            color={totalAns&&totalCorrect/totalAns>=0.6?T.ok:T.amber} />
          <div style={{ flex:1, minWidth:200 }}>
            <StatLine label="のべ解答数" value={`${totalAns} 問`} />
            <StatLine label="正解数" value={`${totalCorrect} 問`} />
            <StatLine label="連続学習日数" value={`${streakOf(state.days)} 日`} />
            <StatLine label="学習した日数" value={`${(state.days||[]).length} 日`} />
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize:13, fontWeight:900, color:T.ink2, marginBottom:14 }}>分野別 正答率</div>
        {byCat.map(c => (
          <div key={c.id} style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontSize:12.5, fontWeight:700, color:T.ink2 }}>{c.icon} {c.name}</span>
              <span style={{ fontSize:12.5, fontWeight:800, color: c.ans?(c.rate>=60?T.ok:T.amber):T.ink4 }}>
                {c.ans ? `${c.rate}%` : "未学習"} <span style={{color:T.ink4, fontWeight:600}}>({c.correct}/{c.ans})</span>
              </span>
            </div>
            <Bar pct={c.rate} color={c.color} />
          </div>
        ))}
      </Card>

      <div style={{ marginTop:24, textAlign:"center" }}>
        <Btn kind="danger" onClick={()=>{ if(confirm("学習記録をすべて消去します。よろしいですか？")) resetAll(); }}>学習記録をリセット</Btn>
      </div>
    </div>
  );
}
function StatLine({ label, value }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${T.rule}` }}>
      <span style={{ fontSize:13, color:T.ink3 }}>{label}</span>
      <span style={{ fontSize:14, fontWeight:800, color:T.ink }}>{value}</span>
    </div>
  );
}

// ━━━━━━━━━━ ルートアプリ ━━━━━━━━━━
function App() {
  const [state, setState] = useState(loadState);
  const [view, setView] = useState("home");         // home/practice/exam/review/stats
  const [session, setSession] = useState(null);     // {questions, mode, title, timed}
  const [result, setResult] = useState(null);

  useEffect(() => saveState(state), [state]);

  const recordAnswer = useCallback((qid, correct) => {
    setState(prev => {
      const stats = { ...prev.stats };
      const s = stats[qid] ? { ...stats[qid] } : { seen:0, correct:0, wrong:0 };
      s.seen += 1;
      if (correct) s.correct += 1; else s.wrong += 1;
      stats[qid] = s;
      const td = todayStr();
      const days = prev.days.includes(td) ? prev.days : [...prev.days, td];
      return { ...prev, stats, days };
    });
  }, []);

  function startSession(questions, mode, title, timed) {
    setResult(null);
    setSession({ questions, mode, title, timed });
  }
  function go(v, opts) {
    setResult(null); setSession(null);
    if (v === "practice" && opts && opts.cat) {
      const pool = QS.filter(q => q.cat === opts.cat);
      startSession(shuffle(pool).slice(0, Math.min(10, pool.length)),
        "practice", `演習 — ${CAT_MAP[opts.cat].short}`, false);
      setView("playing"); return;
    }
    setView(v);
  }

  function onFinish(res) {
    setResult({ ...res, questions: session.questions, title: session.title, mode: session.mode });
    setState(prev => ({ ...prev, log:[...prev.log, { date:todayStr(),
      total:res.results.length, correct:res.results.filter(r=>r.correct).length, mode:res.mode }] }));
    setSession(null); setView("result");
  }

  // 画面分岐
  let body;
  if (view === "playing" && session) {
    body = <Quiz {...session} onFinish={onFinish} recordAnswer={recordAnswer}
      onExit={()=>{ setSession(null); setView("home"); }} />;
  } else if (view === "result" && result) {
    body = <ResultView result={result} questions={result.questions} label={result.title}
      onRetry={()=>{ startSession(shuffle(result.questions), result.mode, result.title, result.mode==="exam"); setView("playing"); }}
      onHome={()=>{ setResult(null); setView("home"); }} />;
  } else if (view === "home") {
    body = <HomeView state={state} go={(v,o)=>go(v,o)} />;
  } else if (view === "practice") {
    body = <PracticeSelect state={state} onStart={(pool,n)=>{
      startSession(shuffle(pool).slice(0,n), "practice", "問題演習", false); setView("playing"); }} />;
  } else if (view === "exam") {
    const pool = shuffle(QS).slice(0, Math.min(10, QS.length));
    body = <ExamIntro onStart={()=>{ startSession(pool, "exam", "模擬試験", true); setView("playing"); }} count={pool.length} />;
  } else if (view === "review") {
    const wrongQs = QS.filter(q => { const s=state.stats[q.id]; return s && s.wrong > s.correct; });
    body = wrongQs.length
      ? <ReviewIntro count={wrongQs.length} onStart={()=>{ startSession(shuffle(wrongQs), "review", "苦手復習", false); setView("playing"); }} />
      : <EmptyReview go={setView} />;
  } else if (view === "stats") {
    body = <StatsView state={state} resetAll={()=>setState({ stats:{}, log:[], days:[], srs:{} })} />;
  }

  const NAV = [
    { id:"home", icon:"🏠", label:"ホーム" },
    { id:"practice", icon:"✏️", label:"演習" },
    { id:"exam", icon:"📝", label:"模試" },
    { id:"review", icon:"🔁", label:"復習" },
    { id:"stats", icon:"📊", label:"統計" },
  ];
  const activeNav = (view==="playing"||view==="result") ? (session?.mode||result?.mode||"home")
    : view;
  const navKey = {practice:"practice", exam:"exam", review:"review"}[activeNav] || (view==="playing"||view==="result" ? "home" : view);

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"'Noto Sans JP', system-ui, sans-serif", color:T.ink, paddingBottom:80 }}>
      {/* トップバー */}
      <div style={{ background:T.white, borderBottom:`1px solid ${T.rule}`, position:"sticky", top:0, zIndex:20 }}>
        <div style={{ maxWidth:920, margin:"0 auto", padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${T.g2},${T.g4})`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🎓</div>
          <div>
            <div style={{ fontSize:16, fontWeight:900, color:T.ink, lineHeight:1.1 }}>FP合格ナビ</div>
            <div style={{ fontSize:10, color:T.ink4, fontFamily:"Cinzel,serif", letterSpacing:2 }}>STUDY APP</div>
          </div>
          {/* デスクトップナビ */}
          <div style={{ marginLeft:"auto", display:"flex", gap:4 }} className="fp-desk-nav">
            {NAV.map(n => (
              <button key={n.id} onClick={()=>go(n.id)}
                style={{ border:"none", background: navKey===n.id?T.okPale:"transparent",
                  color: navKey===n.id?T.g1:T.ink3, fontWeight:800, fontSize:13, padding:"8px 14px",
                  borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>
                {n.icon} {n.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:920, margin:"0 auto", padding:"22px 20px" }}>
        {body}
      </div>

      {/* モバイル下部ナビ */}
      <div className="fp-mobile-nav" style={{ position:"fixed", bottom:0, left:0, right:0, background:T.white,
        borderTop:`1px solid ${T.rule}`, display:"none", zIndex:20, boxShadow:"0 -2px 12px rgba(0,0,0,.06)" }}>
        {NAV.map(n => (
          <button key={n.id} onClick={()=>go(n.id)} style={{ flex:1, border:"none", background:"none",
            padding:"10px 0", cursor:"pointer", fontFamily:"inherit",
            color: navKey===n.id?T.g2:T.ink4, fontWeight:800, fontSize:10 }}>
            <div style={{ fontSize:20 }}>{n.icon}</div>{n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExamIntro({ onStart, count }) {
  return (
    <div style={{ maxWidth:560, margin:"0 auto", textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:8 }}>📝</div>
      <div style={{ fontSize:22, fontWeight:900, color:T.ink }}>模擬試験</div>
      <Card style={{ marginTop:18, textAlign:"left" }}>
        <ul style={{ margin:0, paddingLeft:20, color:T.ink2, fontSize:14, lineHeight:2 }}>
          <li>全分野からランダムに <b>{count}問</b> 出題</li>
          <li>所要時間を計測します（時間制限はなし）</li>
          <li>正答率 <b>60%以上</b> で合格ライン突破</li>
          <li>終了後に間違えた問題と解説を一覧表示</li>
        </ul>
      </Card>
      <div style={{ marginTop:20 }}><Btn kind="gold" onClick={onStart} style={{ padding:"14px 44px", fontSize:16 }}>試験開始</Btn></div>
    </div>
  );
}
function ReviewIntro({ onStart, count }) {
  return (
    <div style={{ maxWidth:560, margin:"0 auto", textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:8 }}>🔁</div>
      <div style={{ fontSize:22, fontWeight:900, color:T.ink }}>苦手復習</div>
      <div style={{ fontSize:14, color:T.ink3, marginTop:8 }}>正解より間違いが多い <b style={{color:T.red}}>{count}問</b> を集中的に復習します。</div>
      <div style={{ marginTop:20 }}><Btn onClick={onStart} style={{ padding:"14px 44px", fontSize:16 }}>復習を始める</Btn></div>
    </div>
  );
}
function EmptyReview({ go }) {
  return (
    <div style={{ maxWidth:520, margin:"0 auto", textAlign:"center", paddingTop:40 }}>
      <div style={{ fontSize:48 }}>🎉</div>
      <div style={{ fontSize:18, fontWeight:900, color:T.ink, marginTop:10 }}>苦手な問題はありません</div>
      <div style={{ fontSize:14, color:T.ink3, marginTop:8, lineHeight:1.7 }}>間違えた問題がここに集まります。<br/>まずは演習や模試に挑戦しましょう。</div>
      <div style={{ marginTop:22, display:"flex", gap:12, justifyContent:"center" }}>
        <Btn kind="ghost" onClick={()=>go("practice")}>演習へ</Btn>
        <Btn onClick={()=>go("exam")}>模試へ</Btn>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
