import { useState, useEffect } from 'react';
import { Shield, ShieldOff, RefreshCw, Server, Activity } from 'lucide-react';

interface Connection {
  ProcessName: string;
  PID: number;
  Protocol: string;
  RemoteAddress: string;
  RemotePort: string | number;
  Path: string;
}

interface NetworkControlProps {
  bridgeToken: string;
}

export function NetworkControl({ bridgeToken }: NetworkControlProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://127.0.0.1:5000/network/connections', {
        headers: {
          'Authorization': `Bearer ${bridgeToken}`
        }
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      if (data.status === 'success') {
         setConnections(data.connections);
      } else if (data.status === 'error' && data.msg.includes('Token')) {
         setError("🔒 Access Denied: Token Mismatch! Please open 'CONFIGURATION MATRIX' (Monitor icon in left sidebar) -> 'Local Bridge Token' and paste the Token shown in your launcher console.");
      } else {
         setError(data.msg);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch network data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    const interval = setInterval(fetchConnections, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (net_action: 'block' | 'unblock', processPath: string) => {
    if (!processPath) {
       alert("Cannot modify rule: Process path is unknown.");
       return;
    }
    
    try {
      const res = await fetch('http://127.0.0.1:5000/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bridgeToken}`
        },
        body: JSON.stringify({
           action: "network_filter",
           params: { net_action, process_info: processPath }
        })
      });
      const result = await res.json();
      if (result.status === 'success') {
         alert(`Success: ${result.msg}`);
      } else if (result.status === 'error' && result.msg.includes('Token')) {
         alert("Access Denied: Token Mismatch! Please update your Bridge Token in Settings matching the Launcher console.");
      } else {
         alert(`Error: ${result.msg}`);
      }
    } catch (e: any) {
      alert(`Network Error: ${e.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent">
      <div className="px-10 py-6 border-b border-hud-border flex justify-between items-center bg-black/40 backdrop-blur-md">
        <div>
          <h2 className="text-sm font-semibold text-hud-text uppercase tracking-widest flex items-center gap-2 text-shadow-cyan">
            <Activity className="text-hud-cyan w-4 h-4" />
            Firewall Telemetry
          </h2>
          <p className="text-[12px] text-hud-cyan/70 font-mono mt-1">Real-time Windows process network monitor</p>
        </div>
        <button 
          onClick={fetchConnections}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-hud-card border border-hud-border rounded-lg text-[11px] font-mono hover:border-hud-cyan hover:text-hud-cyan transition-all disabled:opacity-50 uppercase tracking-widest"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 p-10 overflow-hidden flex flex-col">
        {error && (
          <div className="mb-4 p-4 bg-hud-red/10 border border-hud-red/30 text-hud-red rounded-xl text-[11px] font-mono tracking-wide shadow-[0_0_15px_rgba(255,0,60,0.2)]">
            {error}
          </div>
        )}
        
        <div className="hud-panel flex-1 overflow-hidden flex flex-col shadow-xl m-4">
           <div className="grid grid-cols-12 gap-4 p-4 border-b border-hud-border bg-black/40 text-[10px] font-bold uppercase text-hud-dim tracking-widest font-mono">
              <div className="col-span-2">Process</div>
              <div className="col-span-2">Protocol</div>
              <div className="col-span-1">PID</div>
              <div className="col-span-2">Remote Address</div>
              <div className="col-span-3">Path</div>
              <div className="col-span-2 text-right">Actions</div>
           </div>

           <div className="flex-1 overflow-y-auto hud-scroll p-2">
             {connections.length === 0 && !loading && (
               <div className="flex flex-col items-center justify-center h-full text-hud-dim opacity-50 gap-4 font-mono">
                 <Server className="w-12 h-12 text-hud-cyan/30" />
                 <p>NO ACTIVE CONNECTIONS DETECTED</p>
               </div>
             )}
             
             {connections.map((conn, idx) => (
               <div key={`${conn.PID}-${conn.RemoteAddress}-${idx}`} className="grid grid-cols-12 gap-4 p-3 border-b border-hud-border/30 hover:bg-hud-cyan/5 items-center transition-colors group">
                 <div className="col-span-2 font-medium text-hud-text text-[11px] font-mono flex items-center gap-2 truncate pr-2">
                   <div className="w-2 h-2 rounded-full flex-shrink-0 bg-hud-cyan/50" />
                   <span className="truncate">{conn.ProcessName}</span>
                 </div>
                 <div className="col-span-2 flex items-center">
                   <span className="text-[9px] uppercase font-bold text-hud-cyan bg-hud-cyan/10 px-2 py-0.5 rounded truncate font-mono border border-hud-cyan/20">
                     {conn.Protocol}
                   </span>
                 </div>
                 <div className="col-span-1 text-[11px] font-mono text-hud-dim">
                   {conn.PID}
                 </div>
                 <div className="col-span-2 text-[11px] font-mono text-hud-text truncate pr-2">
                   {conn.RemoteAddress}:{conn.RemotePort}
                 </div>
                 <div className="col-span-3 text-[10px] font-mono text-hud-dim truncate" title={conn.Path}>
                   {conn.Path || 'System / Service'}
                 </div>
                 <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleAction('block', conn.Path)}
                      className="px-2 py-1 bg-hud-red/10 hover:bg-hud-red/20 text-hud-red hover:shadow-[0_0_10px_rgba(255,0,60,0.5)] rounded border border-hud-red/30 transition-all flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest"
                      title="Block internet access"
                    >
                      <ShieldOff className="w-3 h-3" /> Block
                    </button>
                    <button 
                      onClick={() => handleAction('unblock', conn.Path)}
                      className="px-2 py-1 bg-hud-green/10 hover:bg-hud-green/20 text-hud-green hover:shadow-[0_0_10px_rgba(57,255,20,0.5)] rounded border border-hud-green/30 transition-all flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest"
                      title="Remove block rule"
                    >
                      <Shield className="w-3 h-3" /> Allow
                    </button>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
