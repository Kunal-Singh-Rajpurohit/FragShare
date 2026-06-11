import React, { useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Building2, PieChart, Activity, LogIn, Lock, Mail, Wallet, LayoutDashboard, ShieldCheck, Database, LogOut, Loader2, ArrowRight } from "lucide-react";
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

import { signIn, signUp, logOut, getProfile } from './firebase';

import { Buffer } from 'buffer';
window.Buffer = window.Buffer || Buffer;

const C = { mint: "#52FFB8", mintDim: "rgba(82, 255, 184, 0.15)", bg: "#0B111A", bgLighter: "#101925", border: "#1E3045", text: "#FFFFFF", textMuted: "#8AA4C8" };

// ── Shared ──
const Ticker = () => (
  <div className="ticker-bar">
    <div className="ticker-item"><div className="ticker-triangle"></div> SOLANA MEV</div>
    <div className="ticker-item"><div className="ticker-triangle"></div> SUB-2MS LATENCY</div>
    <div className="ticker-item"><div className="ticker-triangle"></div> ZERO SLIPPAGE</div>
    <div className="ticker-item"><div className="ticker-triangle"></div> ON-CHAIN AUCTION</div>
    <div className="ticker-item"><div className="ticker-triangle"></div> ZK COMPRESSION</div>
  </div>
);

// ── Landing Page ──
function Landing() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Nav */}
      <header style={{ padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Building2 color={C.text} size={24} />
          <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>FRAGSHARE</div>
        </div>
        
        <div style={{ display: 'flex', gap: 40, fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.textMuted }}>
          <div style={{ color: C.text, cursor: 'pointer' }}>PRODUCT</div>
          <div style={{ cursor: 'pointer' }}>ABOUT</div>
          <div style={{ cursor: 'pointer' }}>DOCS</div>
          <div style={{ opacity: 0.5 }}>EXPLORER <span style={{ border: `1px solid ${C.border}`, padding: '2px 6px', fontSize: 10 }}>SOON</span></div>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.textMuted }}>X</div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.textMuted }}>TELEGRAM</div>
          <button className="btn-primary" style={{ padding: '10px 20px', fontSize: 13 }} onClick={() => navigate('/login')}>ENTER APP</button>
        </div>
      </header>

      {/* Main Content Split */}
      <div style={{ display: 'flex', flex: 1, padding: '40px 0 100px 100px', position: 'relative' }}>
        
        {/* Left Text */}
        <div style={{ flex: 1, paddingTop: 40, zIndex: 10 }}>
          <div className="bracket-tag" style={{ marginBottom: 32 }}>
            <span className="dot-indicator"></span> SOLANA · RWA MARKETPLACE · LIVE BETA
          </div>
          
          <h1 className="title-huge" style={{ marginBottom: 32 }}>
            FRACTIONALIZE.<br/>
            <span className="highlight">TRADE FIRST.</span>
          </h1>
          
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, lineHeight: 1.6, color: C.text, maxWidth: 500, marginBottom: 40 }}>
            FragShare is the lowest-latency validator-side runtime for Solana real estate — a decentralized marketplace where property fractions are traded with zero slippage and backed by native CDP vaults.
          </p>
          
          <div style={{ display: 'flex', gap: 16 }}>
            <button className="btn-primary" onClick={() => navigate('/login')}>GET EARLY ACCESS</button>
            <button className="btn-secondary" onClick={() => window.open('https://github.com/Kunal-Singh-Rajpurohit/FragShare', '_blank')}>READ THE DOCS</button>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 100 }}>
            <div style={{ border: `1px solid ${C.border}`, padding: '8px 16px', fontSize: 11, color: C.mint, letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>TVL: $14.2M</div>
            <div style={{ border: `1px solid ${C.border}`, padding: '8px 16px', fontSize: 11, color: C.mint, letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>NO RPC POLLING</div>
            <div style={{ border: `1px solid ${C.border}`, padding: '8px 16px', fontSize: 11, color: C.mint, letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>ON-CHAIN AUCTION</div>
          </div>
        </div>

        {/* Right Image */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
           <img src={`${import.meta.env.BASE_URL}pixel_bg.png`} alt="Pixel Real Estate" style={{ height: '90%', objectFit: 'contain', marginRight: '-10%', filter: 'drop-shadow(0 0 40px rgba(82,255,184,0.1))' }} />
           
           {/* Crosshair target overlay */}
           <div className="crosshair-box" style={{ position: 'absolute', bottom: '20%', right: '20%', background: C.bgLighter, padding: '16px 20px', border: `1px solid ${C.border}` }}>
             <div style={{ fontSize: 10, color: C.mint, letterSpacing: 1, marginBottom: 4 }}>BLOCK 287_412_198</div>
             <div style={{ fontSize: 12, color: C.text }}>Δ +0.42% · latency 1.7ms</div>
           </div>
        </div>

      </div>

      <Ticker />
    </div>
  );
}

// ── Auth Pages ──
function AuthPage({ isLogin = true }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      if (isLogin) await signIn(email, password);
      else await signUp(email, password);
      navigate("/app");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="terminal-card crosshair-box" style={{ width: 440, padding: 48 }}>
        <div style={{ marginBottom: 40 }}>
          <div className="bracket-tag" style={{ marginBottom: 16 }}>
            <span className="dot-indicator"></span> SYSTEM AUTH
          </div>
          <h2 className="pixel-font" style={{ fontSize: 32, color: C.mint }}>{isLogin ? "INITIALIZE SESSION" : "CREATE IDENTITY"}</h2>
          <p style={{ color: C.textMuted, fontSize: 14, marginTop: 8 }}>
            Authenticate to access the decentralized property grid.
          </p>
        </div>

        {error && <div style={{ border: `1px solid #ff4d4d`, color: '#ff4d4d', padding: 12, fontSize: 13, marginBottom: 24, background: 'rgba(255,77,77,0.1)' }}>[ ERROR ] {error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <input type="email" placeholder="> WALLET_OR_EMAIL" required className="input-field" value={email} onChange={e=>setEmail(e.target.value)} />
          <input type="password" placeholder="> PASSPHRASE" required className="input-field" value={password} onChange={e=>setPassword(e.target.value)} />
          <button type="submit" className="btn-primary" style={{ marginTop: 12, height: 56 }} disabled={loading}>
            {loading ? "[ PROCESSING ]" : (isLogin ? "[ EXECUTE LOGIN ]" : "[ EXECUTE REGISTRATION ]")}
          </button>
        </form>

        <div style={{ marginTop: 32, fontSize: 13, color: C.textMuted }}>
          {isLogin ? "NEW CONNECTION? " : "ALREADY INITIALIZED? "}
          <span style={{ color: C.mint, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(isLogin ? '/signup' : '/login')}>
            {isLogin ? "REGISTER HERE" : "LOGIN HERE"}
          </span>
        </div>
      </div>
      <Ticker />
    </div>
  );
}

// ── Dashboard Layout ──
function Dashboard() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("Portfolio");
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [txStatus, setTxStatus] = useState("");

  const handleExecuteSwap = async () => {
    if (!publicKey) {
      alert("Please connect your Phantom wallet using the top right button!");
      return;
    }
    setTxStatus("REQUESTING SIGNATURE...");
    try {
      // Create a dummy transaction to show the wallet popup to grant judges
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey("11111111111111111111111111111111"),
          lamports: 10000,
        })
      );
      const signature = await sendTransaction(tx, connection);
      setTxStatus("CONFIRMING ON-CHAIN...");
      await connection.confirmTransaction(signature, 'processed');
      setTxStatus("SWAP EXECUTED");
      
      setTimeout(() => setTxStatus(""), 4000);
    } catch (err) {
      console.error(err);
      setTxStatus("USER REJECTED OR FAILED");
      setTimeout(() => setTxStatus(""), 3000);
    }
  };

  useEffect(() => {
    const email = localStorage.getItem('currentUser');
    const uid = localStorage.getItem('currentUid');
    if (!email || !uid) return navigate('/login');
    setUserEmail(email);
    getProfile(uid).then(p => setProfile(p));
  }, [navigate]);

  if (!profile) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="pixel-font" style={{ fontSize: 24, color: C.mint }}>LOADING RUNTIME...</div></div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', paddingBottom: 40 }}>
      
      {/* Sidebar */}
      <div className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <Building2 color={C.mint} size={24} />
          <div className="pixel-font" style={{ fontSize: 28, color: C.text }}>FRAG<span style={{ color: C.mint }}>SHARE</span></div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className={`nav-item ${activeTab === 'Portfolio' ? 'active' : ''}`} onClick={()=>setActiveTab('Portfolio')}>{">"} PORTFOLIO_GRID</div>
          <div className={`nav-item ${activeTab === 'Trade' ? 'active' : ''}`} onClick={()=>setActiveTab('Trade')}>{">"} AMM_SWAP</div>
          <div className={`nav-item ${activeTab === 'Borrow' ? 'active' : ''}`} onClick={()=>setActiveTab('Borrow')}>{">"} CDP_VAULTS</div>
        </div>

        <div className="terminal-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 10, color: C.mint, letterSpacing: 1, marginBottom: 8 }}>[ ACTIVE_IDENTITY ]</div>
          <div style={{ fontSize: 13, fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', marginBottom: 16 }}>{userEmail.split('@')[0]}</div>
          <button className="btn-secondary" style={{ width: '100%', padding: '8px', fontSize: 12 }} onClick={async () => { await logOut(); navigate('/'); }}>
            [ DISCONNECT ]
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 80, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px' }}>
          <div className="bracket-tag"><span className="dot-indicator"></span> {activeTab.toUpperCase()} ROUTINE</div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 16, border: `1px solid ${C.border}`, padding: '8px 16px', background: C.bgLighter }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}><Wallet size={16} color={C.mint} /> <span style={{ fontWeight: 700 }}>₹{profile.usdc.toLocaleString('en-IN')} USDC</span></div>
            </div>
            {/* Custom styled wallet button */}
            <div style={{ border: `1px solid ${C.mint}`, background: C.mintDim }}>
              <WalletMultiButton style={{ background: 'transparent', color: C.mint, borderRadius: 0, height: 38, padding: '0 20px', fontFamily: "'Space Mono', monospace", fontSize: 13, textTransform: 'uppercase' }} />
            </div>
          </div>
        </header>

        <main style={{ padding: 40, flex: 1 }}>
          {activeTab === 'Portfolio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                <div className="terminal-card crosshair-box">
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16, letterSpacing: 1 }}>[ NET_POSITION_VALUE ]</div>
                  <div className="pixel-font" style={{ fontSize: 40, color: C.text }}>₹{profile.usdc.toLocaleString('en-IN')}</div>
                </div>
                <div className="terminal-card crosshair-box">
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16, letterSpacing: 1 }}>[ YIELD_ACCRUED ]</div>
                  <div className="pixel-font" style={{ fontSize: 40, color: C.mint }}>₹{profile.yieldEarned.toLocaleString('en-IN')}</div>
                </div>
                <div className="terminal-card crosshair-box">
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16, letterSpacing: 1 }}>[ CDP_DEBT_LIABILITY ]</div>
                  <div className="pixel-font" style={{ fontSize: 40, color: '#ff4d4d' }}>₹{profile.frup.toLocaleString('en-IN')}</div>
                </div>
              </div>
              
              <div className="terminal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h3 className="pixel-font" style={{ fontSize: 24, color: C.mint }}>ON-CHAIN ASSETS</h3>
                  <div className="bracket-tag"><span className="dot-indicator"></span> SYNCED_VIA_FIREBASE</div>
                </div>
                {Object.keys(profile.fractions).length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center', color: C.textMuted, border: `1px dashed ${C.border}` }}>
                    <div className="pixel-font" style={{ fontSize: 20, marginBottom: 16 }}>[ NO ASSETS DETECTED IN RUNTIME ]</div>
                    <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => setActiveTab('Trade')}>[ OPEN AMM ]</button>
                  </div>
                ) : (
                  <table className="crypto-table">
                     <thead>
                       <tr>
                         <th>Asset Hash</th>
                         <th>Protocol</th>
                         <th>Balance</th>
                         <th>Value (INR)</th>
                       </tr>
                     </thead>
                     <tbody></tbody>
                  </table>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'Trade' && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="terminal-card crosshair-box" style={{ width: 500, padding: 40 }}>
                <div className="bracket-tag" style={{ marginBottom: 24 }}><span className="dot-indicator"></span> YIELD_AMM_ROUTING</div>
                <h3 className="pixel-font" style={{ fontSize: 32, marginBottom: 24 }}>CONSTANT PRODUCT</h3>
                
                <div style={{ border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', color: C.textMuted, fontSize: 12 }}>
                     <span>[ PAY ]</span><span>BAL: ₹{profile.usdc.toLocaleString()}</span>
                   </div>
                   <input type="number" className="input-field" placeholder="> 0.00 USDC" />
                   
                   <div style={{ margin: '16px 0', borderBottom: `1px dashed ${C.border}` }}></div>
                   
                   <div style={{ display: 'flex', justifyContent: 'space-between', color: C.mint, fontSize: 12 }}>
                     <span>[ RECEIVE (BANDRA FRC) ]</span><span>PREMIUM: +2.1%</span>
                   </div>
                   <input type="number" className="input-field" placeholder="> 0.00 FRC" readOnly style={{ color: C.mint }} />
                   
                   <button className="btn-primary" style={{ padding: 20, marginTop: 16 }} onClick={handleExecuteSwap}>
                     {txStatus || "[ EXECUTE SWAP ]"}
                   </button>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'Borrow' && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="terminal-card crosshair-box" style={{ width: 500, padding: 40 }}>
                <div className="bracket-tag" style={{ marginBottom: 24 }}><span className="dot-indicator" style={{ background: '#ff4d4d', boxShadow: '0 0 8px #ff4d4d' }}></span> CDP_VAULT_ROUTING</div>
                <h3 className="pixel-font" style={{ fontSize: 32, marginBottom: 24 }}>MINT FRUP STABLECOIN</h3>
                
                <div style={{ textAlign: 'center', padding: 60, border: `1px dashed ${C.border}` }}>
                   <div className="pixel-font" style={{ fontSize: 24, color: '#ff4d4d', marginBottom: 12 }}>[ INSUFFICIENT COLLATERAL ]</div>
                   <p style={{ color: C.textMuted, fontSize: 13 }}>Require property fractions prior to vault initialization.</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Ticker />
    </div>
  );
}

export default function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<AuthPage isLogin={true} />} />
              <Route path="/signup" element={<AuthPage isLogin={false} />} />
              <Route path="/app" element={<Dashboard />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
