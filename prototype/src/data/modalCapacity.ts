/**
 * Capacity seed for the Modal Hub lanes.
 *
 * Sea slots, air uplift, container / ULD pools and the yard are illustrative telemetry: they mark the seam where a
 * terminal-operating-system, airline-allotment or GPS feed plugs in. The road lane uses the fleet register that the
 * Fleet view already owns (INITIAL_FLEET_VEHICLES / _EQUIPMENT / _ROAD_TRIPS), and every lane also folds in the live
 * job records passed to the hub.
 */

const H = 3_600_000;

export interface SeaSailing {
  id: string;
  vessel: string;
  voyage: string;
  carrier: string;
  route: string;
  cutoffAt: number;
  allocatedTeu: number;
  /** TEU already committed by bookings that are not part of the live job list. */
  otherBookedTeu: number;
}

export interface AirFlight {
  id: string;
  flight: string;
  aircraft: string;
  route: string;
  cutoffAt: number;
  allocatedKg: number;
  otherBookedKg: number;
}

export interface EquipmentPool {
  code: string;
  label: string;
  total: number;
  inUse: number;
  damaged: number;
}

export interface CapacitySeed {
  sailings: SeaSailing[];
  flights: AirFlight[];
  containerPools: EquipmentPool[];
  yard: { name: string; capacityTeu: number; occupiedTeu: number };
  uldPools: EquipmentPool[];
  coldChain: { label: string; total: number; used: number };
}

export function buildCapacitySeed(now: number = Date.now()): CapacitySeed {
  return {
    sailings: [
      { id: 'sl-1', vessel: 'MAERSK SEALAND', voyage: '419W', carrier: 'Maersk Line', route: 'Shenzhen → Jebel Ali', cutoffAt: now + 20 * H, allocatedTeu: 120, otherBookedTeu: 96 },
      { id: 'sl-2', vessel: 'CMA CGM LA TRAVIATA', voyage: '088W', carrier: 'CMA CGM', route: 'Jebel Ali → Mombasa', cutoffAt: now + 54 * H, allocatedTeu: 60, otherBookedTeu: 41 },
      { id: 'sl-3', vessel: 'ONE COMMITMENT', voyage: '054E', carrier: 'Ocean Network Express', route: 'Jebel Ali → Nhava Sheva', cutoffAt: now + 76 * H, allocatedTeu: 80, otherBookedTeu: 84 },
      { id: 'sl-4', vessel: 'HAPAG AL DHAIL', voyage: '210S', carrier: 'Hapag-Lloyd', route: 'Jebel Ali → Karachi', cutoffAt: now + 108 * H, allocatedTeu: 40, otherBookedTeu: 18 },
    ],
    flights: [
      { id: 'fl-1', flight: 'EK 047', aircraft: 'B777F', route: 'DXB → FRA', cutoffAt: now + 5.7 * H, allocatedKg: 18000, otherBookedKg: 12650 },
      { id: 'fl-2', flight: 'EK 073', aircraft: 'B777F', route: 'DXB → LHR', cutoffAt: now + 9 * H, allocatedKg: 15000, otherBookedKg: 14200 },
      { id: 'fl-3', flight: 'EY 0912', aircraft: 'A330-200F', route: 'AUH → CDG', cutoffAt: now + 27 * H, allocatedKg: 12000, otherBookedKg: 4300 },
      { id: 'fl-4', flight: 'EK 9821', aircraft: 'B777F', route: 'DXB → JFK', cutoffAt: now + 33 * H, allocatedKg: 20000, otherBookedKg: 8000 },
    ],
    containerPools: [
      { code: '20GP', label: "20' General Purpose", total: 120, inUse: 96, damaged: 4 },
      { code: '40GP', label: "40' General Purpose", total: 80, inUse: 61, damaged: 3 },
      { code: '40HC', label: "40' High Cube", total: 140, inUse: 129, damaged: 5 },
      { code: '40RF', label: "40' Reefer", total: 36, inUse: 33, damaged: 2 },
    ],
    yard: { name: 'JAFZA depot yard', capacityTeu: 900, occupiedTeu: 742 },
    uldPools: [
      { code: 'PMC', label: 'PMC pallets (96×125")', total: 40, inUse: 28, damaged: 1 },
      { code: 'AKE', label: 'AKE containers', total: 90, inUse: 71, damaged: 3 },
      { code: 'AAP', label: 'AAP / PLA pallets', total: 24, inUse: 9, damaged: 0 },
    ],
    coldChain: { label: '2–8 °C build-up positions', total: 24, used: 20 },
  };
}
