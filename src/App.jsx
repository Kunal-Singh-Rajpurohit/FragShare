import React, { useState, useEffect, useMemo } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

// Fix for Buffer in Vite
import { Buffer } from 'buffer';
window.Buffer = window.Buffer || Buffer;

// ── Constants & Theme ────────────────────────────────────────────────────────
const C = {
  bg: "#080D1C", s1: "#0D1626", s2: "#111C32", s3: "#162038", s4: "#1A2640",
  border: "#1C2D4A", b2: "#243556",
  purple: "#9945FF", green: "#14F195", amber: "#FFB930", red: "#FF4D4D",
  blue: "#4C9EEB", teal: "#00D4AA", pink: "#FF6B9D",
  text: "#E2E8F0", muted: "#64748B", dim: "#283A58",
};

// ── Mock Data ─────────────────────────────────────────────────────────────
const PROPS = [
  {id:1, name:"Bandra Commercial Hub", city:"Mumbai", type:"Commercial", fracs:100000, sold:74300, price:5000, yieldBps:840, epoch:142, fraudHrs:31.4, treeRoot:"3f8a2b9c...7e1f", validators:3, sigCount:2, ammFracs:25700, ammUsdc:128500000, ammVol:3200000, cdpPositions:12, tvlFRUP:6200000},
  {id:2, name:"Koramangala Heights", city:"Bengaluru", type:"Residential", fracs:160000, sold:102100, price:5000, yieldBps:680, epoch:141, fraudHrs:0, treeRoot:"9c4d1e3a...8f2c", validators:2, sigCount:2, ammFracs:41000, ammUsdc:195000000, ammVol:2100000, cdpPositions:8, tvlFRUP:3800000},
  {id:3, name:"Cyber City Tower A", city:"Gurugram", type:"Office", fracs:240000, sold:156000, price:5000, yieldBps:920, epoch:143, fraudHrs:48, treeRoot:"5e7f3b2c...1d9e", validators:3, sigCount:0, ammFracs:62000, ammUsdc:310000000, ammVol:5800000, cdpPositions:21, tvlFRUP:9100000},
];

const INDICES = [
  {id:"MUMB", name:"Mumbai RWA Index", emoji:"🏙️", components:[{pid:1,w:100}], nav:7200, supply:14800, tvl:106560000, ret7d:2.3, ret30d:8.1, color:C.purple},
  {id:"BLRTECH", name:"Bengaluru Tech", emoji:"💻", components:[{pid:2,w:100}], nav:5100, supply:22400, tvl:114240000, ret7d:1.4, ret30d:6.2, color:C.green},
  {id:"PANIN", name:"Pan-India", emoji:"🇮🇳", components:[{pid:1,w:40}, {pid:2,w:35}, {pid:3,w:25}], nav:8300, supply:31200, tvl:259000000, ret7d:3.1, ret30d:11.4, color:C.amber},
];

const ACTIVITY = [
  {type:"buy", user:"7xKA...nJ", prop:"Bandra", fracs:50, time:"2s ago"},
  {type:"claim", user:"9pNm...xP", prop:"Koramangala", amount:"0.068 SOL", time:"18s ago"},
  {type:"borrow", user:"3tMv...eL", prop:"Cyber City", frup:45000, time:"1m ago"},
  {type:"swap", user:"5aRt...mK", prop:"Bandra", dir:"sell", fracs:20, time:"2m ago"},
  {type:"lp", user:"2bPw...nL", prop:"Bengaluru", op:"add", time:"4m ago"},
];

const TOTAL_TVL = 247000000;
const TOTAL_VOL = 114000000;
const TOTAL_FRUP = 19100000;

// ── Formatters ─────────────────────────────────────────────────────────────
const fmtINR = (n) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`;
  return `₹${Math.floor(n).toLocaleString("en-IN")}`;
};

// ── UI Components ─────────────────────────────────────────────────────────
const Card = ({ children, style = {}, glow, onClick }) => (
  <div onClick={onClick} style={{ background: C.s1, borderRadius: 12, border: `1px solid ${glow ? glow + "33" : C.border}`, padding: 20, cursor: onClick ? 'pointer' : 'default', ...style, transition: 'all 0.3s' }}>
    {children}
  </div>
);

const Tag = ({ c = C.purple, children }) => (
  <span style={{ background: c + "18", color: c, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: `1px solid ${c}33`, whiteSpace: "nowrap" }}>
    {children}
  </span>
);

function Sparkline({ data, color = C.green, w = 100, h = 30 }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease-in-out' }} />
    </svg>
  );
}

function HealthGauge({ ltv }) {
  const R = 36, SW = 8, CX = 50, CY = 50;
  const pct = Math.min(ltv, 100) / 100;
  const circ = Math.PI * R;
  const dash = pct * circ;
  const c = ltv < 60 ? C.green : ltv < 80 ? C.amber : C.red;
  const label = ltv < 60 ? "Safe" : ltv < 80 ? "Warning" : "Danger";
  return (
    <svg viewBox="0 0 100 65" style={{ width: 120 }}>
      <path d={`M${CX - R},${CY} A${R},${R},0,0,1,${CX + R},${CY}`} fill="none" stroke={C.s3} strokeWidth={SW} strokeLinecap="round" />
      <path d={`M${CX - R},${CY} A${R},${R},0,0,1,${CX + R},${CY}`} fill="none" stroke={c} strokeWidth={SW} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.3s ease, stroke 0.3s ease" }} />
      <text x={CX} y={CY - 6} textAnchor="middle" fontSize={16} fontWeight={800} fill={c} style={{ transition: "fill 0.3s ease" }}>{ltv}%</text>
      <text x={CX} y={CY + 12} textAnchor="middle" fontSize={10} fill={C.muted}>LTV ({label})</text>
    </svg>
  );
}

function IndexDonut({ components, size = 120 }) {
  const R = size / 2 - 12, CX = size / 2, CY = size / 2, SW = 16;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  const colors = [C.purple, C.green, C.amber, C.blue];
  
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, transform: "rotate(-90deg)" }}>
      {components.map((c, i) => {
        const dash = (c.w / 100) * circ;
        const arc = <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={colors[i % colors.length]} strokeWidth={SW} strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-offset} />;
        offset += dash;
        return arc;
      })}
    </svg>
  );
}

// ── Views ─────────────────────────────────────────────────────────

function DashboardView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <Card glow={C.purple}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Total Value Locked</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: C.text }}>{fmtINR(TOTAL_TVL)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>24h Volume (AMM)</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: C.text }}>{fmtINR(TOTAL_VOL)}</div>
        </Card>
        <Card glow={C.amber}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Total FRUP Minted (CDP)</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: C.text }}>{fmtINR(TOTAL_FRUP)}</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <Card>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Live Market Activity</div>
          {ACTIVITY.map((act, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${C.s3}` }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Tag c={act.type === 'buy' ? C.green : act.type === 'claim' ? C.purple : act.type === 'borrow' ? C.amber : C.blue}>{act.type.toUpperCase()}</Tag>
                <span style={{ color: C.text, fontSize: 14 }}>{act.user}</span>
                <span style={{ color: C.muted, fontSize: 14 }}>on {act.prop}</span>
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>{act.time}</div>
            </div>
          ))}
        </Card>
        
        <Card>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Index Performance</div>
          {INDICES.map(idx => (
            <div key={idx.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: C.text, fontSize: 14 }}>{idx.emoji} {idx.name}</span>
                <span style={{ color: idx.color, fontWeight: 700, fontSize: 14 }}>+{idx.ret7d}%</span>
              </div>
              <Sparkline data={[0, 1.2, 0.8, 2.1, 1.5, 2.8, idx.ret7d]} color={idx.color} w={200} h={30} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function PropertiesView({ setBuyModal }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
      {PROPS.map(p => (
        <Card key={p.id} glow={C.blue}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <Tag c={C.blue}>{p.type}</Tag>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 12 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{p.city}</div>
            </div>
            <div style={{ fontSize: 40 }}>🏢</div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, background: C.s2, padding: 12, borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted }}>Fair Price</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{fmtINR(p.price)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted }}>Annual Yield</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>{(p.yieldBps / 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted }}>Fractions Sold</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{((p.sold / p.fracs) * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted }}>AMM Liquidity</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmtINR(p.ammUsdc)}</div>
            </div>
          </div>
          
          <button onClick={() => setBuyModal(p)} style={{ width: '100%', padding: '12px', background: C.purple, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
            Invest via Primary Market
          </button>
        </Card>
      ))}
    </div>
  );
}

function TradeView({ portfolio, setPortfolio, marketPrices, setMarketPrices }) {
  const p = PROPS[0];
  const [amt, setAmt] = useState(10);
  
  const currentPrice = marketPrices[p.id];
  const [priceHistory, setPriceHistory] = useState([5020, 5045, 5060, 5040, 5085, 5110, currentPrice]);

  const handleSwap = () => {
    if (amt <= 0) return;
    const cost = amt * currentPrice;
    
    // Update portfolio
    setPortfolio(prev => ({
      ...prev,
      usdc: prev.usdc - cost,
      fractions: {
        ...prev.fractions,
        [p.id]: (prev.fractions[p.id] || 0) + amt
      }
    }));

    // Simulate price impact (buying increases price slightly)
    const newPrice = currentPrice + (amt * 2);
    setMarketPrices(prev => ({ ...prev, [p.id]: newPrice }));
    setPriceHistory(prev => [...prev.slice(1), newPrice]);
    setAmt(0);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
      <Card glow={C.teal}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{p.name} AMM Price</div>
        <div style={{ display: 'flex', alignItems: 'end', gap: 16, marginBottom: 40 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: C.teal, transition: 'all 0.3s' }}>{fmtINR(currentPrice)}</div>
          <div style={{ fontSize: 16, color: C.green, marginBottom: 8, fontWeight: 600 }}>+{( ((currentPrice - 5000)/5000)*100 ).toFixed(1)}% Premium</div>
        </div>
        <div style={{ height: 200, width: '100%', background: C.s2, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, padding: 20 }}>
             <Sparkline data={priceHistory} color={C.teal} w={400} h={160} />
          </div>
        </div>
      </Card>
      
      <Card>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Swap Fractions</div>
        
        <div style={{ background: C.s2, padding: 16, borderRadius: 8, marginBottom: 12, border: `1px solid ${C.s3}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Pay (USDC)</span>
            <span style={{ fontSize: 12, color: C.muted }}>Balance: {fmtINR(portfolio.usdc)}</span>
          </div>
          <input type="number" value={amt * currentPrice} readOnly style={{ width: '100%', background: 'transparent', border: 'none', color: C.text, fontSize: 24, fontWeight: 700, outline: 'none' }} />
        </div>
        
        <div style={{ textAlign: 'center', margin: '8px 0', color: C.muted }}>↓</div>
        
        <div style={{ background: C.s2, padding: 16, borderRadius: 8, marginBottom: 24, border: `1px solid ${C.s3}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Receive ({p.name} Fracs)</span>
            <span style={{ fontSize: 12, color: C.muted }}>Balance: {portfolio.fractions[p.id] || 0}</span>
          </div>
          <input type="number" value={amt} onChange={e=>setAmt(Number(e.target.value))} style={{ width: '100%', background: 'transparent', border: 'none', color: C.teal, fontSize: 24, fontWeight: 700, outline: 'none' }} />
        </div>

        <button onClick={handleSwap} disabled={portfolio.usdc < amt * currentPrice} style={{ width: '100%', padding: '14px', background: portfolio.usdc < amt * currentPrice ? C.s3 : C.teal, color: portfolio.usdc < amt * currentPrice ? C.muted : '#000', border: 'none', borderRadius: 8, cursor: portfolio.usdc < amt * currentPrice ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15, transition: 'all 0.2s' }}>
          {portfolio.usdc < amt * currentPrice ? 'Insufficient USDC' : 'Swap on AMM'}
        </button>
      </Card>
    </div>
  );
}

function BorrowView({ portfolio, setPortfolio }) {
  const p = PROPS[0];
  const maxAvailableFracs = portfolio.fractions[p.id] || 0;
  
  const [fracs, setFracs] = useState(Math.min(20, maxAvailableFracs));
  const collateralValue = fracs * 5000;
  const maxBorrow = collateralValue * 0.6;
  const [borrowAmt, setBorrowAmt] = useState(0);
  
  // Real-time calculation
  const ltv = collateralValue > 0 ? (borrowAmt / collateralValue) * 100 : 0;

  const handleMint = () => {
    if (borrowAmt <= 0) return;
    setPortfolio(prev => ({
      ...prev,
      usdc: prev.usdc + borrowAmt, // Assuming they receive USDC for the minted FRUP, or directly FRUP
      frup: prev.frup + borrowAmt
    }));
    setBorrowAmt(0);
    // Note: To keep the UI simple we aren't completely locking the fractions in this demo state, just adding to debt.
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <Card glow={C.amber}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Open CDP (Mint FRUP)</div>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Lock your real estate fractions as collateral to mint FragRupee (FRUP) stablecoins. 5% stability fee.</p>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Lock Fractions</span>
            <span style={{ fontSize: 12, color: C.muted }}>Available: {maxAvailableFracs}</span>
          </div>
          <input type="range" min="0" max={Math.max(1, maxAvailableFracs)} value={fracs} onChange={e=>{
            const newFracs = Number(e.target.value);
            setFracs(newFracs);
            const newColValue = newFracs * 5000;
            if (borrowAmt > newColValue * 0.6) setBorrowAmt(newColValue * 0.6);
          }} style={{ width: '100%', cursor: 'pointer' }} disabled={maxAvailableFracs === 0} />
          <div style={{ textAlign: 'right', fontSize: 14, color: C.text, marginTop: 8 }}>{fracs} Fractions = {fmtINR(collateralValue)}</div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Mint FRUP</div>
          <input type="range" min="0" max={maxBorrow} value={borrowAmt} onChange={e=>setBorrowAmt(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} disabled={collateralValue === 0} />
          <div style={{ textAlign: 'right', fontSize: 14, color: C.amber, marginTop: 8 }}>{fmtINR(borrowAmt)} FRUP</div>
        </div>

        <button onClick={handleMint} disabled={borrowAmt <= 0} style={{ width: '100%', padding: '14px', background: borrowAmt > 0 ? C.amber : C.s3, color: borrowAmt > 0 ? '#000' : C.muted, border: 'none', borderRadius: 8, cursor: borrowAmt > 0 ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 15, transition: 'all 0.2s' }}>
          Mint FRUP
        </button>
      </Card>

      <Card>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Position Health Simulator</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <HealthGauge ltv={ltv.toFixed(1)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: C.s2, padding: 16, borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted }}>Collateral Value</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, transition: 'all 0.3s' }}>{fmtINR(collateralValue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted }}>Debt</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.amber, transition: 'all 0.3s' }}>{fmtINR(borrowAmt)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted }}>Liquidation Price</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.red, transition: 'all 0.3s' }}>{fracs > 0 ? fmtINR(borrowAmt / fracs / 0.8) : '₹0'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.muted }}>Stability Fee</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>5.0% APR</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function IndexView({ portfolio }) {
  const [selectedIdx, setSelectedIdx] = useState(INDICES[0]);
  const [usdcAmt, setUsdcAmt] = useState(1000);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {INDICES.map(idx => (
            <Card key={idx.id} glow={idx.id === selectedIdx.id ? idx.color : null} style={{ opacity: idx.id === selectedIdx.id ? 1 : 0.6 }} onClick={() => setSelectedIdx(idx)}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{idx.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{idx.name}</div>
              <div style={{ fontSize: 12, color: C.muted }}>NAV: ₹{idx.nav}</div>
            </Card>
          ))}
        </div>
        
        <Card>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{selectedIdx.name} Composition</div>
          <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
            <IndexDonut components={selectedIdx.components} size={160} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedIdx.components.map((c, i) => {
                const prop = PROPS.find(p => p.id === c.pid);
                const colors = [C.purple, C.green, C.amber, C.blue];
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.s2, padding: '12px 16px', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: colors[i % colors.length] }} />
                      <span style={{ fontWeight: 600 }}>{prop ? prop.name : "Asset"}</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>{c.w}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <Card glow={selectedIdx.color}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Mint {selectedIdx.id}</div>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Deposit USDC to mint index tokens. The protocol automatically routes liquidity to underlying assets.</p>
        
        <div style={{ background: C.s2, padding: 16, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Deposit (USDC)</div>
          <input type="number" value={usdcAmt} onChange={e=>setUsdcAmt(Number(e.target.value))} style={{ width: '100%', background: 'transparent', border: 'none', color: C.text, fontSize: 24, fontWeight: 700, outline: 'none' }} />
        </div>
        
        <div style={{ textAlign: 'center', margin: '8px 0', color: C.muted }}>↓</div>
        
        <div style={{ background: C.s2, padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Receive ({selectedIdx.id})</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: selectedIdx.color }}>{((usdcAmt * 84) / selectedIdx.nav).toFixed(2)}</div>
        </div>

        <button style={{ width: '100%', padding: '14px', background: selectedIdx.color, color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
          Mint Index Tokens
        </button>
      </Card>
    </div>
  );
}

function PortfolioView({ portfolio }) {
  const fractionValue = Object.keys(portfolio.fractions).reduce((acc, propId) => {
    return acc + (portfolio.fractions[propId] * 5000); // Rough estimate
  }, 0);
  
  const indexValue = Object.keys(portfolio.indexTokens).reduce((acc, idxId) => {
    const idx = INDICES.find(i => i.id === idxId);
    return acc + (portfolio.indexTokens[idxId] * (idx ? idx.nav : 0));
  }, 0);

  const totalValue = portfolio.usdc + fractionValue + indexValue - portfolio.frup;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        <Card>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Net Portfolio Value</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.text, transition: 'all 0.3s' }}>{fmtINR(totalValue)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Liquid USDC</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.blue, transition: 'all 0.3s' }}>{fmtINR(portfolio.usdc)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Total Earned Yield</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.green, transition: 'all 0.3s' }}>{fmtINR(portfolio.yieldEarned)}</div>
        </Card>
        <Card glow={C.amber}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Active CDP Debt</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.amber, transition: 'all 0.3s' }}>{fmtINR(portfolio.frup)}</div>
        </Card>
      </div>

      <Card>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Your Holdings</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ color: C.muted, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
              <th style={{ padding: '12px 0' }}>ASSET</th>
              <th>BALANCE</th>
              <th>VALUE (INR)</th>
              <th>TYPE</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(portfolio.fractions).map(propId => {
              const p = PROPS.find(pr => pr.id === Number(propId));
              const qty = portfolio.fractions[propId];
              if (qty === 0) return null;
              return (
                <tr key={propId} style={{ borderBottom: `1px solid ${C.s3}` }}>
                  <td style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, background: C.blue+'22', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏢</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p ? p.name : "Property"} Fractions</div>
                      <div style={{ fontSize: 11, color: C.muted }}>SPL Token</div>
                    </div>
                  </td>
                  <td>{qty} FRC</td>
                  <td style={{ fontWeight: 600 }}>{fmtINR(qty * 5000)}</td>
                  <td><Tag c={C.blue}>RWA</Tag></td>
                </tr>
              )
            })}
            {Object.keys(portfolio.indexTokens).map(idxId => {
              const idx = INDICES.find(i => i.id === idxId);
              const qty = portfolio.indexTokens[idxId];
              if (qty === 0) return null;
              return (
                <tr key={idxId} style={{ borderBottom: `1px solid ${C.s3}` }}>
                  <td style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, background: C.purple+'22', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idx ? idx.emoji : '📈'}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{idx ? idx.name : "Index"}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>Index Token</div>
                    </div>
                  </td>
                  <td>{qty} {idxId}</td>
                  <td style={{ fontWeight: 600 }}>{fmtINR(qty * (idx ? idx.nav : 0))}</td>
                  <td><Tag c={C.purple}>INDEX</Tag></td>
                </tr>
              )
            })}
            {portfolio.frup > 0 && (
              <tr>
                <td style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, background: C.amber+'22', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🪙</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>FragRupee Stablecoin</div>
                    <div style={{ fontSize: 11, color: C.muted }}>CDP Debt</div>
                  </div>
                </td>
                <td style={{ color: C.amber }}>- {portfolio.frup} FRUP</td>
                <td style={{ fontWeight: 600, color: C.amber }}>- {fmtINR(portfolio.frup)}</td>
                <td><Tag c={C.amber}>DEBT</Tag></td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CompressionView() {
  return (
    <Card glow={C.teal}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>State Compression (ZK Merkle Trees)</div>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        Storing 100,000 property fraction ownership records on Solana natively would cost ~120 SOL in rent. 
        Instead, FragShare hashes all ownership states into a single 32-byte Merkle root on-chain (Cost: 0.00001 SOL).
      </p>
      
      <div style={{ background: C.s2, padding: 32, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ padding: '12px 24px', background: C.teal+'22', border: `1px solid ${C.teal}`, borderRadius: 8, color: C.teal, fontWeight: 700 }}>
          Root Hash: 3f8a2b9c5d...7e1f
        </div>
        <div style={{ width: 2, height: 20, background: C.border }}></div>
        <div style={{ display: 'flex', gap: 40, borderTop: `2px solid ${C.border}`, paddingTop: 20 }}>
          <div style={{ padding: '8px 16px', background: C.s3, borderRadius: 6, color: C.muted, border: `1px solid ${C.border}` }}>Branch A (Hash)</div>
          <div style={{ padding: '8px 16px', background: C.s3, borderRadius: 6, color: C.muted, border: `1px solid ${C.border}` }}>Branch B (Hash)</div>
        </div>
        <div style={{ display: 'flex', gap: 60 }}>
          <div style={{ width: 2, height: 20, background: C.border }}></div>
          <div style={{ width: 2, height: 20, background: C.border }}></div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {["Leaf 1", "Leaf 2", "...", "Leaf N"].map((l, i) => (
            <div key={i} style={{ padding: '12px 16px', background: l==="Leaf 2" ? C.purple+'44' : C.s4, borderRadius: 6, color: l==="Leaf 2" ? '#fff' : C.muted, border: `1px solid ${l==="Leaf 2" ? C.purple : C.border}` }}>
              <div style={{ fontSize: 11, marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{l==="Leaf 2" ? "Your FRC" : "Owner"}</div>
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ marginTop: 24, fontSize: 13, color: C.muted, textAlign: 'center' }}>
        To claim yield or trade, the client submits a ZK proof linking "Leaf 2" to the "Root Hash" using the RPC indexing layer.
      </div>
    </Card>
  );
}

function ValidatorsView() {
  return (
    <Card>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Oracle & Validator Network</div>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Switchboard Oracles feed real-world property metrics (NAV, yield generation, RERA status) into the AMM and CDP programs.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PROPS.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.s2, padding: '16px 20px', borderRadius: 8, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{p.name} Oracle Feed</div>
              <div style={{ fontSize: 12, color: C.muted }}>Last updated: 12 mins ago</div>
            </div>
            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted }}>Verified Price</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>{fmtINR(p.price)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted }}>Signatures</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{p.sigCount} / {p.validators} Nodes</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted }}>Status</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: p.sigCount >= 2 ? C.green : C.amber, background: (p.sigCount >= 2 ? C.green : C.amber) + '22', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
                  {p.sigCount >= 2 ? "SECURE" : "AWAITING"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function YieldView({ portfolio, setPortfolio }) {
  const hasYield = portfolio.unclaimedYield > 0;
  
  const claimAll = () => {
    if (!hasYield) return;
    setPortfolio(prev => ({
      ...prev,
      usdc: prev.usdc + prev.unclaimedYield,
      yieldEarned: prev.yieldEarned + prev.unclaimedYield,
      unclaimedYield: 0
    }));
  };

  return (
    <Card glow={hasYield ? C.green : undefined}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Epoch Yield Claims</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, padding: 20, background: C.s2, borderRadius: 12, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 8 }}>Total Unclaimed Rental Yield</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: hasYield ? C.green : C.muted, transition: 'all 0.3s' }}>
            {fmtINR(portfolio.unclaimedYield)}
            {hasYield && <span style={{ fontSize: 16, color: C.muted, fontWeight: 500, marginLeft: 8 }}>≈ {(portfolio.unclaimedYield / 12000).toFixed(2)} SOL</span>}
          </div>
        </div>
        <button onClick={claimAll} disabled={!hasYield} style={{ padding: '16px 32px', background: hasYield ? C.green : C.s3, color: hasYield ? '#000' : C.muted, border: 'none', borderRadius: 8, cursor: hasYield ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 16, transition: 'all 0.2s' }}>
          {hasYield ? 'Claim All to Wallet' : 'No Yield to Claim'}
        </button>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: C.muted, marginBottom: 12 }}>History</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
        <thead>
          <tr style={{ color: C.muted, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
            <th style={{ padding: '12px 0' }}>EPOCH</th>
            <th>PROPERTY</th>
            <th>YIELD AMOUNT</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {hasYield && (
            <>
              <tr style={{ borderBottom: `1px solid ${C.s3}` }}>
                <td style={{ padding: '16px 0' }}>#141</td>
                <td>Bandra Commercial Hub</td>
                <td style={{ fontWeight: 600 }}>₹840</td>
                <td><Tag c={C.green}>Claimable</Tag></td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${C.s3}` }}>
                <td style={{ padding: '16px 0' }}>#140</td>
                <td>Koramangala Heights</td>
                <td style={{ fontWeight: 600 }}>₹580</td>
                <td><Tag c={C.green}>Claimable</Tag></td>
              </tr>
            </>
          )}
          <tr>
            <td style={{ padding: '16px 0' }}>#139</td>
            <td>Bandra Commercial Hub</td>
            <td style={{ fontWeight: 600 }}>₹825</td>
            <td style={{ color: C.muted }}>Claimed (Tx: 4a2B...8x)</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

function DeveloperView() {
  return (
    <Card>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Developer API & SDK</div>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Integrate FragShare RWA primitives directly into your DeFi protocol using our TypeScript SDK.</p>
      
      <div style={{ background: '#000', padding: 20, borderRadius: 8, fontFamily: 'monospace', color: C.green, fontSize: 13, marginBottom: 24, overflowX: 'auto' }}>
        <div style={{ color: C.muted, marginBottom: 8 }}>// 1. Install SDK</div>
        <div style={{ marginBottom: 16 }}>npm install @fragshare/sdk @solana/web3.js</div>
        
        <div style={{ color: C.muted, marginBottom: 8 }}>// 2. Fetch Yield-Adjusted AMM Price</div>
        <div>import {'{'} FragShareClient {'}'} from '@fragshare/sdk';</div>
        <div>const client = new FragShareClient(connection);</div>
        <div>const price = await client.amm.getFairValue(propertyId);</div>
        <div>console.log(`Fair Value: ₹${'{'}price{'}'}`);</div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <button style={{ padding: '12px 24px', background: C.s2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Read Documentation ↗
        </button>
        <button style={{ padding: '12px 24px', background: C.s2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          GitHub Repository ↗
        </button>
      </div>
    </Card>
  );
}

// ── Main App ──────────────────────────────────────────────────
function FragShareV3() {
  const [view, setView] = useState("Trade");
  const [buyModal, setBuyModal] = useState(null);
  const { connected } = useWallet();

  // Dynamic Portfolio State
  const [portfolio, setPortfolio] = useState({
    usdc: 250000,
    frup: 45000,
    fractions: {
      1: 20, // 20 fractions of Bandra
      2: 0,
      3: 0
    },
    indexTokens: {
      "MUMB": 15
    },
    yieldEarned: 18450,
    unclaimedYield: 1420
  });

  const [marketPrices, setMarketPrices] = useState({
    1: 5155, // Bandra initial price
    2: 5000,
    3: 5000
  });

  const VIEWS = {
    Dashboard: <DashboardView />,
    Properties: <PropertiesView setBuyModal={setBuyModal} />,
    Trade: <TradeView portfolio={portfolio} setPortfolio={setPortfolio} marketPrices={marketPrices} setMarketPrices={setMarketPrices} />,
    Borrow: <BorrowView portfolio={portfolio} setPortfolio={setPortfolio} />,
    Index: <IndexView portfolio={portfolio} />,
    Portfolio: <PortfolioView portfolio={portfolio} />,
    Compression: <CompressionView />,
    Validators: <ValidatorsView />,
    Yield: <YieldView portfolio={portfolio} setPortfolio={setPortfolio} />,
    Developer: <DeveloperView />
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, color: C.text }}>
      {/* Sidebar */}
      <div style={{ width: 240, background: C.s1, borderRight: `1px solid ${C.border}`, padding: '24px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 24px', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: C.purple, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff' }}>F</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>FragShare <span style={{ color: C.purple }}>V3</span></div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.keys(VIEWS).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '12px 24px', background: view === v ? C.s2 : 'transparent', border: 'none', borderLeft: `3px solid ${view === v ? C.purple : 'transparent'}`, color: view === v ? '#fff' : C.muted, textAlign: 'left', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ height: 72, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{view}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Tag c={C.green}>DEVNET</Tag>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: C.s2, padding: '4px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14 }}>
              <div><span style={{color: C.muted}}>USDC:</span> <span style={{fontWeight: 700}}>{fmtINR(portfolio.usdc).replace('₹', '')}</span></div>
              <div style={{width: 1, height: 16, background: C.border}}></div>
              <div><span style={{color: C.muted}}>FRUP Debt:</span> <span style={{fontWeight: 700, color: C.amber}}>{portfolio.frup}</span></div>
            </div>
            <WalletMultiButton style={{ height: 36, background: C.s3, borderRadius: 8, fontSize: 13, fontWeight: 600 }} />
          </div>
        </header>
        
        {/* View Content */}
        <main style={{ padding: 32, flex: 1, overflowY: 'auto' }}>
          {VIEWS[view]}
        </main>
      </div>

      {/* Simple Buy Modal for Primary Market */}
      {buyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setBuyModal(null)}>
          <Card style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Invest in {buyModal.name}</div>
            <p style={{ color: C.muted, marginBottom: 24 }}>Buy fractions directly from the property issuer at Fair Value (₹5,000).</p>
            <div style={{ background: C.s2, padding: 16, borderRadius: 8, marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
              <span>Price per fraction</span>
              <span style={{ fontWeight: 700 }}>₹5,000</span>
            </div>
            <button onClick={() => { alert(connected ? "Transaction sent to wallet!" : "Connect wallet first!"); setBuyModal(null); }} style={{ width: '100%', padding: '14px', background: C.purple, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
              Confirm Purchase
            </button>
          </Card>
        </div>
      )}
    </div>
  );
}

// Wrap with Wallet Adapters
export default function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <FragShareV3 />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
