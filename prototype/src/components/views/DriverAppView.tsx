import React, { useRef, useState, useEffect } from 'react';
import {
  Smartphone,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Camera,
  PenTool,
  Clock,
  ShieldCheck,
  WifiOff,
  RotateCcw,
  MapPin,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { INITIAL_TRIPS } from '../../data/mockData';
import { DriverTrip } from '../../types';

export const DriverAppView: React.FC = () => {
  const [currentTrip, setCurrentTrip] = useState<DriverTrip>(INITIAL_TRIPS[0]);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [signatureCaptured, setSignatureCaptured] = useState(false);
  const [recipientName, setRecipientName] = useState('Tariq Mansoor (Depot Supervisor)');
  const [tripCompleted, setTripCompleted] = useState(false);

  // Canvas Drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0F172A';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setSignatureCaptured(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureCaptured(false);
  };

  const handleSimulatePhoto = () => {
    setPhotoCaptured(true);
  };

  const handleCompletePOD = () => {
    if (!signatureCaptured) {
      alert('Please capture the recipient signature on the signature pad first.');
      return;
    }
    setTripCompleted(true);
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.7 },
    });
    alert('Proof of Delivery (POD) signed & timestamped with GPS coordinates! Automated invoice release triggered.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Driver Mobile</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Interactive Hardware Simulator
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Driver Mobile View & Proof of Delivery</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Designed for mobile use in the truck cab: large touch buttons, offline signature capture, GPS watermarking, and detention logging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 font-medium">
            <WifiOff className="h-3.5 w-3.5 text-amber-600" />
            <span>Offline Sync: 0 Queued</span>
          </span>
        </div>
      </div>

      {/* Main Container: Mobile Phone Simulator + Desktop Context */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8">
        {/* Phone Frame Simulator */}
        <div className="relative w-[340px] rounded-[42px] border-[10px] border-[#0A1A2F] bg-white p-3 shadow-2xl overflow-hidden shrink-0">
          {/* Top Speaker & Camera Notch */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 h-4 w-28 rounded-full bg-[#0A1A2F] z-20"></div>

          {/* Phone Inner Screen */}
          <div className="relative flex flex-col h-[600px] overflow-y-auto rounded-[28px] bg-slate-50 text-xs">
            {/* Mobile Top Bar */}
            <div className="bg-[#09192D] text-white p-4 pt-6 space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                <span>Trip {currentTrip.tripNo}</span>
                <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">En Route</span>
              </div>
              <h3 className="font-extrabold text-white text-base">Jebel Ali T2 → Al Ain Depot</h3>
              <div className="text-[11px] text-slate-300">Vehicle: {currentTrip.vehiclePlate}</div>
            </div>

            {/* Waiting Time Alert in Cab */}
            <div className="m-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <Clock className="h-4 w-4 text-amber-700" />
                <span>Waiting Over Free Time: 3h 20m</span>
              </div>
              <div className="text-[10.5px] leading-tight">
                Arrival logged at 15:40. System automatically prepared AED 450 detention claim with dock geotag.
              </div>
            </div>

            {/* Trip Details Card */}
            <div className="mx-3 rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Delivery Destination</div>
                  <div className="text-slate-500 text-[11px]">{currentTrip.deliveryLocation}</div>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                <Navigation className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Cargo & Weight</div>
                  <div className="text-slate-500 text-[11px]">{currentTrip.cargoDetails}</div>
                </div>
              </div>
            </div>

            {/* Step 1: Delivery Photo with Watermark */}
            <div className="mx-3 mt-3 rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                <span>1. Cargo Offloading Photo</span>
                {photoCaptured && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              </div>
              {photoCaptured ? (
                <div className="relative rounded-lg overflow-hidden border border-emerald-300">
                  <img
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80"
                    alt="Delivery proof"
                    className="h-24 w-full object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-1 text-[9px] text-white font-mono flex justify-between">
                    <span>GPS: 24.2075° N, 55.7447° E</span>
                    <span>29 Sep 16:42 GST</span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSimulatePhoto}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-3 text-slate-600 hover:border-[#E8472B] hover:text-[#E8472B] transition"
                >
                  <Camera className="h-4 w-4" />
                  <span className="font-bold">Take Delivery Photo</span>
                </button>
              )}
            </div>

            {/* Step 2: Interactive HTML5 Canvas Signature Pad */}
            <div className="mx-3 mt-3 rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">2. Receiver Signature</span>
                {signatureCaptured && (
                  <button
                    onClick={clearSignature}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-slate-300 bg-slate-50 overflow-hidden relative touch-none">
                <canvas
                  ref={canvasRef}
                  width={290}
                  height={110}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="cursor-crosshair w-full bg-white"
                />
                {!signatureCaptured && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-[11px] font-medium">
                    Sign on screen with finger or mouse
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Receiver Name:</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-semibold focus:outline-hidden"
                />
              </div>
            </div>

            {/* Complete Button */}
            <div className="p-3 mt-auto">
              <button
                onClick={handleCompletePOD}
                disabled={tripCompleted}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white shadow-md transition active:scale-95 ${
                  tripCompleted ? 'bg-emerald-600' : 'bg-[#E8472B] hover:bg-[#D13B20]'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{tripCompleted ? 'POD Confirmed & Uploaded' : 'Submit Proof of Delivery'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Explanation Column */}
        <div className="flex-1 max-w-xl space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="font-extrabold text-slate-900 text-base">Why Our Driver UX Solves a Major SME Pain Point</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Traditional freight software like CargoWise or ZEALIT forces drivers to take photos, message them over WhatsApp to dispatch, where staff manually type delivery dates days later.
            </p>
            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="font-bold text-[#E8472B]">1.</span>
                <span><strong>Instant Billing Trigger:</strong> As soon as the driver clicks "Submit POD" on their phone, shipment status automatically transitions to <code className="text-purple-700 font-bold font-mono">billing_ready</code>, creating the invoice draft immediately.</span>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="font-bold text-[#E8472B]">2.</span>
                <span><strong>Offline Tolerant:</strong> If delivering in desert zones or basement warehouse docks with no cellular signal, the signature & GPS are cached locally and synchronized the moment signal restores.</span>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="font-bold text-[#E8472B]">3.</span>
                <span><strong>Automated Detention Proof:</strong> The app records gate GPS timestamps so waiting charges (e.g. AED 450 on trip TRP-88213) are incontrovertibly proven to the customer.</span>
              </div>
            </div>
          </div>

          {/* Active Fleet Dispatched */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Other Active Fleet Dispatches</h4>
            <div className="divide-y divide-slate-100 text-xs">
              {INITIAL_TRIPS.map((tr) => (
                <div key={tr.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{tr.tripNo} · {tr.driverName}</div>
                    <div className="text-[11px] text-slate-500">{tr.vehiclePlate} · {tr.pickupLocation.slice(0, 20)}...</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tr.podCaptured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {tr.podCaptured ? 'POD Signed' : 'En Route'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
