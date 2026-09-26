import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, QrCode, Wifi, Smartphone, Laptop, Tv, Info, ExternalLink } from 'lucide-react';

interface QrCodeModalProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ roomId, isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [customHost, setCustomHost] = useState<string>('');
  const [lanIp, setLanIp] = useState<string>('192.168.1.150');

  const origin = window.location.origin;
  // Construct direct join link for phones
  const defaultJoinUrl = `${origin}?room=${roomId}&role=viewer`;
  const lanJoinUrl = `http://${lanIp}:${window.location.port || '3000'}?room=${roomId}&role=viewer`;
  
  const activeUrl = customHost.trim() || defaultJoinUrl;

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(activeUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed generating QR code', err));
    }
  }, [isOpen, activeUrl]);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">Pair Viewer Devices</h3>
              <p className="text-xs text-slate-400">Zero-install • Any phone, laptop, or tablet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Presentation */}
        <div className="flex flex-col items-center my-6">
          <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-slate-800 relative group">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Room Join QR Code"
                className="w-56 h-56 rounded-lg transition-transform group-hover:scale-[1.02]"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-sm">
                Generating QR...
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-md">
              ROOM: {roomId.toUpperCase()}
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400 text-center max-w-xs">
            Open camera on iPhone or Android to join this movie session with zero installation.
          </p>
        </div>

        {/* Share Link box */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Direct Viewer URL
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={activeUrl}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
              />
              <button
                onClick={() => handleCopy(activeUrl)}
                className="flex items-center space-x-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Local Wi-Fi / LAN Guidance */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center space-x-1.5 text-indigo-400 font-medium">
              <Wifi className="w-3.5 h-3.5" />
              <span>For Offline Local Wi-Fi / Windows .NET Broadcast:</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              When running the .NET 8 host on your PC, phones on the same Wi-Fi connect via your machine's LAN IP:
            </p>
            <div className="flex items-center space-x-2 pt-1">
              <span className="text-slate-500 font-mono text-[11px]">LAN Host:</span>
              <input
                type="text"
                value={lanIp}
                onChange={(e) => setLanIp(e.target.value)}
                placeholder="192.168.1.150"
                className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[11px] font-mono text-slate-200 w-32 focus:border-red-500 focus:outline-none"
              />
              <button
                onClick={() => handleCopy(lanJoinUrl)}
                className="text-[11px] text-red-400 hover:text-red-300 underline"
              >
                Copy LAN Link
              </button>
            </div>
          </div>
        </div>

        {/* Supported Devices */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-around text-slate-400 text-[11px]">
          <div className="flex items-center space-x-1">
            <Smartphone className="w-3.5 h-3.5 text-slate-300" />
            <span>iOS / Android</span>
          </div>
          <div className="flex items-center space-x-1">
            <Laptop className="w-3.5 h-3.5 text-slate-300" />
            <span>Mac / Windows</span>
          </div>
          <div className="flex items-center space-x-1">
            <Tv className="w-3.5 h-3.5 text-slate-300" />
            <span>Smart TV Browser</span>
          </div>
        </div>
      </div>
    </div>
  );
};
