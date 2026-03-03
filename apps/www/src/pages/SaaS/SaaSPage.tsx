import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import '../../index.css';

const Blueprints = [
  {
    id: 'researcher',
    name: 'Lead Researcher',
    icon: 'RESEARCH',
    description: 'Autonomous intelligence gathering and RAG synthesis.',
    price: '$19/mo'
  },
  {
    id: 'architect',
    name: 'Code Architect',
    icon: 'SYSTEM',
    description: 'DevOps automation, scripting, and system management.',
    price: '$49/mo'
  },
  {
    id: 'assistant',
    name: 'Executive Assistant',
    icon: 'OPERATIONS',
    description: 'Inbox mastery, scheduling, and personal briefings.',
    price: '$29/mo'
  }
];

const SaaSPage: React.FC = () => {
  const [selectedBlueprint, setSelectedBlueprint] = useState<string>('researcher');
  const [formData, setFormData] = useState({ name: '', token: '', userId: '' });
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error', msg: string, commands?: { windows: string, linux: string } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'windows' | 'linux'>('windows');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: 'info', msg: 'GENERATING LOCAL INSTALLATION SCRIPT...' });

    try {
      const apiHost = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
      const response = await fetch(`http://${apiHost}:3005/api/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, blueprint: selectedBlueprint }),
      });

      const data = await response.json();
      if (data.success) {
        setStatus({ 
          type: 'success', 
          msg: 'PROFILE GENERATED. COPY THE COMMAND BELOW TO START LOCALLY.',
          commands: data.commands
        });
      } else {
        throw new Error(data.error || 'GENERATION FAILED');
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: `CRITICAL ERROR: ${err.message.toUpperCase()}` });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Command copied to clipboard!');
  };

  const inputStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid #333',
    padding: '14px',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#666',
    letterSpacing: '0.15em',
    marginBottom: '8px',
    display: 'block'
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#000', 
      color: '#fff', 
      fontFamily: '"Inter", -apple-system, sans-serif',
      padding: '0 20px 60px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <style>{`
        input:focus { border-color: #fff !important; }
        .bp-card:hover { border-color: #666 !important; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .terminal { background: #0a0a0a; border: 1px solid #333; padding: 20px; font-family: monospace; font-size: 0.85rem; color: #00ff00; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
      `}</style>

      <Header scrolled={true} />

      <header style={{ width: '100%', maxWidth: '900px', marginTop: '140px', marginBottom: '80px', borderBottom: '1px solid #222', paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.2em', margin: 0, color: '#fff' }}>ORCBOT / INSTALLER</h1>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '8px' }}>One-Click Local Deployment Engine</p>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#444', textAlign: 'right', fontFamily: 'monospace' }}>
            ENGINE: V2.5_ACTIVE<br/>
            STATUS: READY
          </div>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '900px', display: 'grid', gridTemplateColumns: '1fr 400px', gap: '60px' }}>
        
        {/* ── Blueprints ── */}
        <section>
          <h2 style={labelStyle}>1. SELECT_BLUEPRINT</h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            {Blueprints.map((bp) => (
              <div 
                key={bp.id} 
                className="bp-card"
                onClick={() => setSelectedBlueprint(bp.id)}
                style={{ 
                  border: `1px solid ${selectedBlueprint === bp.id ? '#fff' : '#222'}`,
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  backgroundColor: selectedBlueprint === bp.id ? '#0a0a0a' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: selectedBlueprint === bp.id ? '#fff' : '#444' }}>[{bp.icon}]</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{bp.price}</div>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{bp.name}</h3>
                <p style={{ fontSize: '0.85rem', color: '#888', lineHeight: 1.5 }}>{bp.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Provisioning ── */}
        <section>
          <div style={{ border: '1px solid #222', padding: '32px', position: 'sticky', top: '40px' }}>
            <h2 style={{ ...labelStyle, marginBottom: '24px' }}>2. CONFIGURE_AGENT</h2>
            
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
              <div>
                <label style={labelStyle}>OWNER_NAME</label>
                <input 
                  type="text" 
                  required 
                  placeholder="ID_FREDERICK"
                  style={inputStyle}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              <div>
                <label style={labelStyle}>TELEGRAM_BOT_TOKEN</label>
                <input 
                  type="password" 
                  required 
                  placeholder="••••••••••••••••••••"
                  style={inputStyle}
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                />
              </div>

              <div>
                <label style={labelStyle}>ADMIN_TELEGRAM_ID</label>
                <input 
                  type="text" 
                  required 
                  placeholder="8077489121"
                  style={inputStyle}
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                style={{ 
                  background: loading ? '#111' : '#fff', 
                  color: loading ? '#444' : '#000', 
                  padding: '16px', 
                  border: 'none', 
                  fontSize: '0.8rem', 
                  fontWeight: 900,
                  letterSpacing: '0.2em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: '10px',
                  transition: 'all 0.2s'
                }}
              >
                {loading ? 'GENERATING...' : 'GENERATE_INSTALLER'}
              </button>
            </form>

            {status && status.commands && (
              <div style={{ marginTop: '40px', borderTop: '1px solid #222', paddingTop: '30px' }}>
                <h2 style={labelStyle}>3. EXECUTE_LOCALLY</h2>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <button onClick={() => setActiveTab('windows')} style={{ background: activeTab === 'windows' ? '#222' : 'transparent', border: '1px solid #333', color: '#fff', fontSize: '0.6rem', padding: '4px 10px', cursor: 'pointer' }}>WINDOWS (PS)</button>
                  <button onClick={() => setActiveTab('linux')} style={{ background: activeTab === 'linux' ? '#222' : 'transparent', border: '1px solid #333', color: '#fff', fontSize: '0.6rem', padding: '4px 10px', cursor: 'pointer' }}>LINUX / MACOS</button>
                </div>

                <div className="terminal" onClick={() => copyToClipboard(activeTab === 'windows' ? status.commands!.windows : status.commands!.linux)}>
                  {activeTab === 'windows' ? status.commands.windows : status.commands.linux}
                </div>
                <p style={{ fontSize: '0.65rem', color: '#444', marginTop: '10px', fontFamily: 'monospace' }}>TIP: CLICK THE BOX TO COPY COMMAND</p>
              </div>
            )}

            {status && !status.commands && (
              <div style={{ 
                marginTop: '24px', 
                padding: '12px', 
                backgroundColor: status.type === 'error' ? '#220000' : '#111', 
                color: status.type === 'error' ? '#ff0000' : '#888', 
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                border: `1px solid ${status.type === 'error' ? '#440000' : '#222'}`,
                animation: loading ? 'pulse 1s infinite' : 'none'
              }}>
                {status.msg}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer style={{ marginTop: 'auto', paddingTop: '100px', textAlign: 'center', width: '100%', maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#222', fontSize: '0.65rem', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
          <span>ENCRYPTED_SETUP</span>
          <span>ORCBOT_CORE_V2</span>
          <span>SYSTEM_IDLE</span>
        </div>
      </footer>
    </div>
  );
};

export default SaaSPage;
