import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
  Fuel,
  CreditCard,
  Calendar,
  FileText,
  User,
  Phone,
  Layers,
  Ship,
  Plane,
  Printer,
  Check,
  X,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { FleetVehicle, FleetEquipment, RoadTripDispatch } from '../../types';
import {
  INITIAL_FLEET_VEHICLES,
  INITIAL_FLEET_EQUIPMENT,
  INITIAL_ROAD_TRIPS,
} from '../../data/mockData';

export const FleetView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'trucks' | 'equipment' | 'trips' | 'forms'>('trucks');
  const [vehicles, setVehicles] = useState<FleetVehicle[]>(INITIAL_FLEET_VEHICLES);
  const [equipments, setEquipments] = useState<FleetEquipment[]>(INITIAL_FLEET_EQUIPMENT);
  const [trips, setTrips] = useState<RoadTripDispatch[]>(INITIAL_ROAD_TRIPS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals & New Vehicle Form State
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedTripForWaybill, setSelectedTripForWaybill] = useState<RoadTripDispatch | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // New Vehicle State
  const [plateNo, setPlateNo] = useState('DXB 99120 C-3');
  const [emirate, setEmirate] = useState<'Dubai' | 'Abu Dhabi' | 'Sharjah' | 'Ras Al Khaimah'>('Dubai');
  const [vehicleType, setVehicleType] = useState<FleetVehicle['vehicleType']>('40ft Heavy Tractor Head');
  const [makeModel, setMakeModel] = useState('Mercedes-Benz Actros 3340');
  const [year, setYear] = useState(2024);
  const [assignedDriver, setAssignedDriver] = useState('Sardar Patel');
  const [driverPhone, setDriverPhone] = useState('+971 50 771 9920');
  const [driverLicenseNo, setDriverLicenseNo] = useState('DXB-HVY-884102');

  // New Trip Dispatch State
  const [dispatchJobNo, setDispatchJobNo] = useState('DB-1048');
  const [dispatchVehicle, setDispatchVehicle] = useState('DXB 84219 C-3');
  const [dispatchDriver, setDispatchDriver] = useState('Ali Hassan');
  const [dispatchOrigin, setDispatchOrigin] = useState('DP World Jebel Ali Terminal 2');
  const [dispatchDestination, setDispatchDestination] = useState('Dubai South Logistics Park');
  const [dispatchContainer, setDispatchContainer] = useState('MSKU-8842190');
  const [cargoWeightKg, setCargoWeightKg] = useState(24500);

  // Multimodal Forms State
  const [formMode, setFormMode] = useState<'road' | 'sea' | 'air'>('road');
  const [formShipper, setFormShipper] = useState('Al Faris Trading LLC');
  const [formConsignee, setFormConsignee] = useState('Apex Industrial Hub');
  const [formRoute, setFormRoute] = useState('Jebel Ali Port → Sohar Oman');
  const [formGoods, setFormGoods] = useState('Containerized Electronics & Auto Spare Parts');

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.plateNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.makeModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.assignedDriver.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.currentLocation.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return v.status === statusFilter;
  });

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const newVehicle: FleetVehicle = {
      id: `veh-${Date.now()}`,
      plateNo,
      emirate,
      vehicleType,
      makeModel,
      year: Number(year),
      assignedDriver,
      driverPhone,
      driverLicenseNo,
      odometerKm: 12000,
      fuelLevelPercent: 95,
      salikBalanceAed: 500,
      status: 'available',
      currentLocation: 'JAFZA South Fleet Depot',
      mulkiyaExpiry: '12 Dec 2026',
      insuranceExpiry: '12 Dec 2026',
      civilDefensePermit: true,
      nextServiceKm: 25000,
    };

    setVehicles([newVehicle, ...vehicles]);
    setShowAddVehicleModal(false);
    setSuccessToast(`Fleet Heavy Vehicle ${newVehicle.plateNo} registered with active RTA Mulkiya!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleDispatchTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const newTrip: RoadTripDispatch = {
      id: `trip-${Date.now()}`,
      tripNo: `TRP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      jobNo: dispatchJobNo,
      vehiclePlate: dispatchVehicle,
      driverName: dispatchDriver,
      chassisCode: 'CHS-40-01',
      containerNo: dispatchContainer,
      origin: dispatchOrigin,
      destination: dispatchDestination,
      cargoWeightKg: Number(cargoWeightKg),
      estimatedDieselAed: 350,
      salikBudgetAed: 40,
      tripStatus: 'dispatched',
      departureTime: 'Just now',
      eta: 'In 3 hours',
    };

    setTrips([newTrip, ...trips]);
    setShowDispatchModal(false);
    setSuccessToast(`Road Trip ${newTrip.tripNo} dispatched! Digital Gate Pass & GPS tracking activated.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">
              Road Transport · UAE Fleet & Multimodal Equipment
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
              UAE National Fleet Standard
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
            UAE Fleet & Multimodal Equipment Operations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal heavy vehicle fleet, RTA Mulkiya permits, GPS telematics, Salik tags, chassis assets, sea containers, and universal multimodal dispatch forms.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDispatchModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Compass className="h-4 w-4 text-blue-600" />
            <span>Dispatch Road Trip</span>
          </button>
          <button
            onClick={() => setShowAddVehicleModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#D13B20] transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Heavy Vehicle</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">Fleet Heavy Trucks</span>
            <Truck className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {vehicles.length} Trucks
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {vehicles.filter((v) => v.status === 'in_transit').length} In Transit · {vehicles.filter((v) => v.status === 'available').length} Standby
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">Chassis & Gensets</span>
            <Layers className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {equipments.length} Assets
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Skeletal Lowbeds & Thermo King gensets
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">Salik & Toll Float</span>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-900 font-mono">
            AED {vehicles.reduce((sum, v) => sum + v.salikBalanceAed, 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Automated RTA toll balance auto-topup
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[10px]">Statutory Compliance</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">
            100% Mulkiya
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Zero expired passing or Civil Defense permits
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
        {[
          { id: 'trucks', label: `Heavy Vehicles & Trucks (${vehicles.length})`, icon: <Truck className="h-4 w-4" /> },
          { id: 'equipment', label: `Chassis, Gensets & Containers (${equipments.length})`, icon: <Layers className="h-4 w-4" /> },
          { id: 'trips', label: `Trip Dispatch & Manifests (${trips.length})`, icon: <Compass className="h-4 w-4" /> },
          { id: 'forms', label: 'Universal Multimodal Booking Forms', icon: <FileText className="h-4 w-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold transition ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: Trucks & Heavy Vehicles */}
      {activeTab === 'trucks' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search plate #, driver, model, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: 'All Fleet' },
                { id: 'in_transit', label: 'In Transit' },
                { id: 'available', label: 'Available' },
                { id: 'at_port_gate', label: 'At Port Gate' },
                { id: 'maintenance', label: 'In Workshop' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 font-bold transition ${
                    statusFilter === tab.id
                      ? 'bg-[#E8472B] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVehicles.map((v) => (
              <div
                key={v.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 hover:border-slate-300 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {v.plateNo}
                      </span>
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                        {v.emirate}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-slate-800 mt-1">{v.makeModel}</div>
                    <div className="text-[10.5px] text-slate-500">{v.vehicleType} ({v.year})</div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      v.status === 'in_transit'
                        ? 'bg-blue-100 text-blue-800'
                        : v.status === 'available'
                        ? 'bg-emerald-100 text-emerald-800'
                        : v.status === 'at_port_gate'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {v.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Live GPS & Location */}
                <div className="rounded-2xl bg-slate-50 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1 font-semibold">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                      <span>Location:</span>
                    </span>
                    <span className="font-bold text-slate-900 truncate max-w-[170px]">
                      {v.currentLocation}
                    </span>
                  </div>
                  {v.destination && (
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Destination:</span>
                      <span className="font-medium text-slate-700">{v.destination}</span>
                    </div>
                  )}
                </div>

                {/* Telematics: Odometer, Fuel & Salik */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-slate-100 bg-white p-2">
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Odometer</span>
                    <strong className="font-mono text-slate-800">{v.odometerKm.toLocaleString()} km</strong>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-2">
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Fuel Tank</span>
                    <strong className="font-mono text-emerald-700">{v.fuelLevelPercent}%</strong>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-2">
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Salik Tag</span>
                    <strong className="font-mono text-purple-700">AED {v.salikBalanceAed}</strong>
                  </div>
                </div>

                {/* Driver & Statutory License Details */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 font-bold text-slate-800">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{v.assignedDriver}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{v.driverPhone}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-500">
                      Mulkiya: {v.mulkiyaExpiry}
                    </div>
                    <div className="text-[9.5px] text-emerald-700 font-bold">
                      ✓ Civil Defense Certified
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Equipment & Assets */}
      {activeTab === 'equipment' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Multimodal Equipment Asset Master (Chassis, Gensets & Containers)
                </h3>
                <p className="text-xs text-slate-500">
                  Track 40ft skeletal lowbeds, Thermo King diesel gensets, SOC ocean containers, and airline ULD aircraft pallets.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                  <tr>
                    <th className="p-3.5">Asset Code</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Type & Specification</th>
                    <th className="p-3.5">Tare Weight</th>
                    <th className="p-3.5">Max Payload</th>
                    <th className="p-3.5">Depot Location</th>
                    <th className="p-3.5">Assigned Vehicle / Job</th>
                    <th className="p-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {equipments.map((eq) => (
                    <tr key={eq.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono font-bold text-slate-900">{eq.equipmentCode}</td>
                      <td className="p-3.5">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                          {eq.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">{eq.type}</div>
                        <div className="text-[10px] text-slate-500">{eq.specifications}</div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">{eq.tareWeightKg.toLocaleString()} kg</td>
                      <td className="p-3.5 font-mono font-bold text-slate-900">{eq.maxPayloadKg.toLocaleString()} kg</td>
                      <td className="p-3.5 text-slate-700 font-medium">{eq.location}</td>
                      <td className="p-3.5 font-mono font-bold text-blue-700">
                        {eq.assignedVehicleOrJob || 'Unassigned Float'}
                      </td>
                      <td className="p-3.5 text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            eq.status === 'attached_to_truck'
                              ? 'bg-blue-100 text-blue-800'
                              : eq.status === 'operational'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {eq.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Trip Manifests & Dispatch Runs */}
      {activeTab === 'trips' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Active Fleet Road Trips & Port Cartage Manifests
                </h3>
                <p className="text-xs text-slate-500">
                  Track container hauls between DP World Jebel Ali, Abu Dhabi Khalifa Port, and GCC cross-border borders.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {trips.map((trip) => (
                <div
                  key={trip.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 hover:border-slate-300 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {trip.tripNo}
                      </span>
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        Job {trip.jobNo}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {trip.vehiclePlate} ({trip.driverName})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          trip.tripStatus === 'dispatched'
                            ? 'bg-blue-100 text-blue-800'
                            : trip.tripStatus === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {trip.tripStatus.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => setSelectedTripForWaybill(trip)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <Printer className="h-3 w-3" />
                        <span>Waybill Slip</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Route</span>
                      <strong className="text-slate-800">{trip.origin} → {trip.destination}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Container & Chassis</span>
                      <span className="font-mono text-slate-800">{trip.containerNo || 'Flatbed Cargo'} ({trip.chassisCode})</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Cargo Payload</span>
                      <span className="font-mono font-bold text-slate-900">{trip.cargoWeightKg.toLocaleString()} kg</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Diesel & Salik Budget</span>
                      <span className="font-mono text-emerald-700">AED {trip.estimatedDieselAed + trip.salikBudgetAed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Universal Multimodal Booking Forms */}
      {activeTab === 'forms' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-extrabold text-sm text-slate-900">
              Universal Multimodal Booking & Dispatch Forms
            </h3>
            <p className="text-xs text-slate-500">
              Create standardized transport orders for UAE road cartage, ocean container bookings, or airfreight express dispatches.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex gap-2 text-xs">
            {[
              { id: 'road', label: 'UAE Road Freight Manifest', icon: <Truck className="h-4 w-4" /> },
              { id: 'sea', label: 'Ocean Container Booking Form', icon: <Ship className="h-4 w-4" /> },
              { id: 'air', label: 'Airfreight Cargo Dispatch', icon: <Plane className="h-4 w-4" /> },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setFormMode(m.id as any)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition ${
                  formMode === m.id
                    ? 'bg-[#E8472B] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert(`Universal ${formMode.toUpperCase()} transport booking generated and dispatched to operations desk.`);
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Shipper / Exporter</label>
                <input
                  type="text"
                  value={formShipper}
                  onChange={(e) => setFormShipper(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Consignee / Importer</label>
                <input
                  type="text"
                  value={formConsignee}
                  onChange={(e) => setFormConsignee(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Origin Port / Loading Hub → Destination Port</label>
                <input
                  type="text"
                  value={formRoute}
                  onChange={(e) => setFormRoute(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Cargo Description & Commodity</label>
                <input
                  type="text"
                  value={formGoods}
                  onChange={(e) => setFormGoods(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-[#E8472B] transition"
              >
                <Check className="h-4 w-4" />
                <span>Submit & Dispatch {formMode.toUpperCase()} Order</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Heavy Vehicle Modal */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#E8472B]" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Register New Fleet Heavy Vehicle (UAE Mulkiya)
                </h3>
              </div>
              <button onClick={() => setShowAddVehicleModal(false)} className="text-xs font-bold text-slate-400">✕</button>
            </div>

            <form onSubmit={handleAddVehicle} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plate Number</label>
                  <input
                    type="text"
                    required
                    value={plateNo}
                    onChange={(e) => setPlateNo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Traffic Authority (Emirate)</label>
                  <select
                    value={emirate}
                    onChange={(e) => setEmirate(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 font-bold focus:outline-hidden"
                  >
                    <option value="Dubai">Dubai (RTA)</option>
                    <option value="Abu Dhabi">Abu Dhabi (ITC)</option>
                    <option value="Sharjah">Sharjah (SRTA)</option>
                    <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vehicle Classification</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 focus:outline-hidden"
                  >
                    <option value="40ft Heavy Tractor Head">40ft Heavy Tractor Head</option>
                    <option value="Flatbed 50T Trailer">Flatbed 50T Trailer</option>
                    <option value="Reefer Chiller Truck">Reefer Chiller Truck</option>
                    <option value="7-Ton Box Truck">7-Ton Box Truck</option>
                    <option value="3-Ton Pickup">3-Ton Pickup</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Make & Model</label>
                  <input
                    type="text"
                    required
                    value={makeModel}
                    onChange={(e) => setMakeModel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    required
                    value={assignedDriver}
                    onChange={(e) => setAssignedDriver(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 text-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    required
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono text-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Heavy License #</label>
                  <input
                    type="text"
                    required
                    value={driverLicenseNo}
                    onChange={(e) => setDriverLicenseNo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-[#E8472B] px-5 py-2 text-xs font-bold text-white hover:bg-[#D13B20] transition"
                >
                  <Check className="h-4 w-4" />
                  <span>Register Vehicle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Trip Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Dispatch Road Cartage Trip & Gate Pass
                </h3>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="text-xs font-bold text-slate-400">✕</button>
            </div>

            <form onSubmit={handleDispatchTrip} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Truck</label>
                  <select
                    value={dispatchVehicle}
                    onChange={(e) => setDispatchVehicle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono font-bold focus:outline-hidden"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.plateNo}>
                        {v.plateNo} — {v.makeModel}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Link to Shipment Job</label>
                  <input
                    type="text"
                    required
                    value={dispatchJobNo}
                    onChange={(e) => setDispatchJobNo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono font-bold focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pickup / Port Gate</label>
                  <input
                    type="text"
                    required
                    value={dispatchOrigin}
                    onChange={(e) => setDispatchOrigin(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delivery Destination</label>
                  <input
                    type="text"
                    required
                    value={dispatchDestination}
                    onChange={(e) => setDispatchDestination(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Container Number</label>
                  <input
                    type="text"
                    value={dispatchContainer}
                    onChange={(e) => setDispatchContainer(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono font-bold focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cargo Weight (kg)</label>
                  <input
                    type="number"
                    value={cargoWeightKg}
                    onChange={(e) => setCargoWeightKg(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono font-bold focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  <Compass className="h-4 w-4" />
                  <span>Dispatch Trip Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Road Waybill Print Modal */}
      {selectedTripForWaybill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase text-slate-400">Official Road Waybill</span>
              <button onClick={() => setSelectedTripForWaybill(null)} className="text-xs font-bold text-slate-400">✕</button>
            </div>

            <div className="rounded-2xl border-2 border-slate-900 bg-slate-50/50 p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="font-black text-slate-950">DigitalBurj Fleet Haulage</div>
                  <div className="text-[10px] text-slate-500">Dubai RTA Heavy Fleet Operator</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-black text-blue-700">{selectedTripForWaybill.tripNo}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Job {selectedTripForWaybill.jobNo}</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Truck Plate:</span>
                  <strong className="font-mono">{selectedTripForWaybill.vehiclePlate}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Assigned Driver:</span>
                  <strong>{selectedTripForWaybill.driverName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Container:</span>
                  <strong className="font-mono">{selectedTripForWaybill.containerNo}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Route:</span>
                  <span>{selectedTripForWaybill.origin} → {selectedTripForWaybill.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payload Weight:</span>
                  <strong className="font-mono">{selectedTripForWaybill.cargoWeightKg.toLocaleString()} kg</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span>Status: {selectedTripForWaybill.tripStatus.toUpperCase()}</span>
                <span className="font-bold text-emerald-700">✓ AUTHORIZED GATE PASS</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedTripForWaybill(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert('Road Waybill sent to printer & driver mobile.');
                  setSelectedTripForWaybill(null);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Print Waybill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
