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
         setError("🔒 Access Denied: Token Mismatch! Please open 'Settings & API Key' (Monitor icon in left sidebar) -> 'Local PC Bridge Token' and paste the Agent Token shown in your launcher console.");
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
    <div className="flex-1 flex flex-col h-full bg-[#121215]">
      <div className="px-10 py-6 border-b border-sleek-border flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-sleek-text flex items-center gap-2">
            <Activity className="text-win-blue" />
            Network Control
          </h2>
          <p className="text-[12px] text-sleek-dim mt-1">Real-time Windows process network monitor & firewall</p>
        </div>
        <button 
          onClick={fetchConnections}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-sleek-card border border-sleek-border rounded-lg text-sm hover:border-win-blue transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 p-10 overflow-hidden flex flex-col">
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}
        
        <div className="bg-sleek-surface border border-sleek-border rounded-2xl flex-1 overflow-hidden flex flex-col shadow-xl">
           <div className="grid grid-cols-12 gap-4 p-4 border-b border-sleek-border bg-black/20 text-[11px] font-bold uppercase text-sleek-dim tracking-wider">
              <div className="col-span-2">Process</div>
              <div className="col-span-2">Protocol</div>
              <div className="col-span-1">PID</div>
              <div className="col-span-2">Remote Address</div>
              <div className="col-span-3">Path</div>
              <div className="col-span-2 text-right">Actions</div>
           </div>

           <div className="flex-1 overflow-y-auto sleek-scroll p-2">
             {connections.length === 0 && !loading && (
               <div className="flex flex-col items-center justify-center h-full text-sleek-dim opacity-50 gap-4">
                 <Server className="w-12 h-12" />
                 <p>No active connections found</p>
               </div>
             )}
             
             {connections.map((conn, idx) => (
               <div key={`${conn.PID}-${conn.RemoteAddress}-${idx}`} className="grid grid-cols-12 gap-4 p-3 border-b border-sleek-border/30 hover:bg-white/5 items-center transition-colors group">
                 <div className="col-span-2 font-medium text-sleek-text text-sm flex items-center gap-2 truncate pr-2">
                   <div className="w-2 h-2 rounded-full flex-shrink-0 bg-win-blue/50" />
                   <span className="truncate">{conn.ProcessName}</span>
                 </div>
                 <div className="col-span-2 flex items-center">
                   <span className="text-[9px] uppercase font-bold text-win-blue/80 bg-win-blue/10 px-2 py-0.5 rounded truncate">
                     {conn.Protocol}
                   </span>
                 </div>
                 <div className="col-span-1 text-xs font-mono text-sleek-dim">
                   {conn.PID}
                 </div>
                 <div className="col-span-2 text-xs font-mono text-sleek-text truncate pr-2">
                   {conn.RemoteAddress}:{conn.RemotePort}
                 </div>
                 <div className="col-span-3 text-[11px] text-sleek-dim truncate" title={conn.Path}>
                   {conn.Path || 'System / Service'}
                 </div>
                 <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleAction('block', conn.Path)}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md border border-red-500/20 transition-all flex items-center gap-1 text-[11px]"
                      title="Block internet access"
                    >
                      <ShieldOff className="w-3 h-3" /> Block
                    </button>
                    <button 
                      onClick={() => handleAction('unblock', conn.Path)}
                      className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/20 transition-all flex items-center gap-1 text-[11px]"
                      title="Remove block rule"
                    >
                      <Shield className="w-3 h-3" /> Unblock
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
