import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { cbmOf, chargeableKg, daysOverFreeTime, demurrageAed, importCosts, teuOf, lclTeu, totalCbm, ILLUSTRATIVE_DEMURRAGE, type PieceDims } from '@digitalburj/shared';
import { aed, num } from '../lib/format';
import { Banner, Card, PageHead } from '../ui/kit';

const Fld = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="field"><label>{label}</label>{children}</div>;
const NUM = (v: string) => (v === '' ? 0 : Number(v));
function In({ label, value, onChange, step = 'any', suffix }: { label: string; value: string; onChange: (v: string) => void; step?: string; suffix?: string }) {
  return <Fld label={label}><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input className="input" type="number" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} />{suffix && <span className="muted">{suffix}</span>}</span></Fld>;
}

function Cargo() {
  const [rows, setRows] = useState<{ l: string; w: string; h: string; n: string }[]>([{ l: '120', w: '80', h: '100', n: '4' }]);
  const [gross, setGross] = useState('350');
  const [basis, setBasis] = useState<'iata' | 'courier'>('iata');
  const dims: PieceDims[] = rows.map((r) => ({ lengthCm: NUM(r.l), widthCm: NUM(r.w), heightCm: NUM(r.h), pieces: NUM(r.n) }));
  const cbm = totalCbm(dims);
  const c = chargeableKg(NUM(gross), cbm, basis);
  return (
    <Card title="CBM, volumetric and chargeable weight" icon={<Calculator />}>
      {rows.map((r, i) => (
        <div className="row4" key={i} style={{ marginBottom: 6 }}>
          {(['l', 'w', 'h', 'n'] as const).map((k) => <In key={k} label={{ l: 'Length (cm)', w: 'Width (cm)', h: 'Height (cm)', n: 'Pieces' }[k]} value={r[k]} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)))} />)}
        </div>
      ))}
      <button className="btn sm outline" onClick={() => setRows([...rows, { l: '', w: '', h: '', n: '1' }])}>Add line</button>
      <div className="row3" style={{ marginTop: 12 }}>
        <In label="Gross weight" value={gross} onChange={setGross} suffix="kg" />
        <Fld label="Volumetric basis"><select className="select" value={basis} onChange={(e) => setBasis(e.target.value as 'iata' | 'courier')}><option value="iata">Air cargo (1:6000)</option><option value="courier">Courier (1:5000)</option></select></Fld>
      </div>
      <div className="grid g3" style={{ marginTop: 12 }}>
        <div><div className="muted">Volume</div><div className="calc-out">{num(cbm, 3)} CBM</div></div>
        <div><div className="muted">Volumetric</div><div className="calc-out">{num(c.volumetricKg, 1)} kg</div></div>
        <div><div className="muted">Chargeable ({c.basis})</div><div className="calc-out">{num(c.kg, 1)} kg</div></div>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>≈ {num(lclTeu(cbm), 2)} TEU if shipped as LCL (33 CBM per TEU). Single piece of the first line: {num(cbmOf(dims[0]), 3)} CBM.</p>
    </Card>
  );
}

function Demurrage() {
  const [kind, setKind] = useState<'20' | '40' | 'reefer'>('40');
  const [n, setN] = useState('1');
  const [freeEnd, setFreeEnd] = useState(new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10));
  const days = daysOverFreeTime(freeEnd + 'T23:59:59');
  return (
    <Card title="Demurrage exposure" icon={<Calculator />}>
      <Banner kind="warn">Uses an <b>illustrative</b> tariff ({Object.entries(ILLUSTRATIVE_DEMURRAGE.perDay).map(([k, v]) => `${k}: AED ${v}/day`).join(', ')}). Replace with your shipping line’s actual tariff before quoting a customer.</Banner>
      <div className="row3">
        <Fld label="Equipment"><select className="select" value={kind} onChange={(e) => setKind(e.target.value as any)}><option value="20">20′</option><option value="40">40′</option><option value="reefer">Reefer</option></select></Fld>
        <In label="Containers" value={n} onChange={setN} step="1" />
        <Fld label="Free time ends"><input className="input" type="date" value={freeEnd} onChange={(e) => setFreeEnd(e.target.value)} /></Fld>
      </div>
      <div className="grid g3" style={{ marginTop: 12 }}>
        <div><div className="muted">Days over free time</div><div className="calc-out">{days}</div></div>
        <div><div className="muted">Exposure</div><div className="calc-out">{aed(demurrageAed(kind, days, Math.max(1, NUM(n))))}</div></div>
        <div><div className="muted">TEU</div><div className="calc-out">{num(Math.max(1, NUM(n)) * teuOf(kind === 'reefer' ? '40RF' : `${kind}GP`), 0)}</div></div>
      </div>
    </Card>
  );
}

function Duty() {
  const [cif, setCif] = useState('100000');
  const [duty, setDuty] = useState('5');
  const r = importCosts(NUM(cif), NUM(duty) / 100);
  return (
    <Card title="UAE import duty and VAT" icon={<Calculator />}>
      <div className="row3">
        <In label="CIF value" value={cif} onChange={setCif} suffix="AED" />
        <In label="Duty rate" value={duty} onChange={setDuty} suffix="%" />
      </div>
      <div className="grid g3" style={{ marginTop: 12 }}>
        <div><div className="muted">Customs duty</div><div className="calc-out">{aed(r.duty)}</div></div>
        <div><div className="muted">VAT 5% on CIF + duty</div><div className="calc-out">{aed(r.vat)}</div></div>
        <div><div className="muted">Total payable at import</div><div className="calc-out">{aed(r.total)}</div></div>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Duty rates vary by HS code — confirm the rate on the customs declaration. The 5% figure is the common GCC rate, not a lookup.</p>
    </Card>
  );
}

export default function Tools() {
  return (
    <>
      <PageHead title="Calculators" sub="Quick, offline maths for quoting: chargeable weight, demurrage exposure, import duty and VAT." />
      <div className="grid g2"><Cargo /><Demurrage /><Duty /></div>
    </>
  );
}
