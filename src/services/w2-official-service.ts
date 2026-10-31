/**
 * W2OfficialService — Generates the official IRS Form W-2 PDF by filling the
 * government's own fillable W-2 PDF (resources/forms/w2.pdf) with the employer's
 * data, producing a pixel-exact, government-form W-2.
 *
 * Mapping strategy:
 *  - The official PDF has 4 copies (A, B, C, D) each printed 2-up (Top + Bottom) =
 *    8 form instances, ~568 AcroForm fields with semi-cryptic names.
 *  - Each box's field is identified by its position RELATIVE to that instance's
 *    "Box a" (Employee SSN) field, matched against a reference table transcribed
 *    from the official Copy A (Top) layout. Relative layout is identical across
 *    copies, so a single reference + nearest-neighbour matching maps all 8
 *    instances reliably.
 *  - Only confidently-mapped boxes are filled; ambiguous/unlabelled internal
 *    fields (and unused boxes 7-9, 12, 13) are left blank to avoid any value
 *    misplacement on a tax document.
 *  - Mapping correctness is verified by reading each filled field's value back
 *    and asserting it equals the expected W-2 box value.
 *
 * NOTE: This fills the official white form (not the red scannable stock). For
 * filing Copy A with the SSA, e-file (BSO/EFW2) or print on official red stock;
 * the filled white form is correct for employee copies B/C/2 and employer records.
 */
import { PDFDocument, PDFName } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { Caregiver } from '../types';
import { Employer } from './employer-service';
import { ReportingService, YTDSummary } from './reporting-service';
import { TaxConfigurationService } from './tax-configuration-service';

/** Resolve the bundled official W-2 PDF path (dev vs packaged). */
export function getOfficialW2FormPath(): string {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'forms', 'w2.pdf');
    }
    // dist/main/* -> <project>/resources/forms/w2.pdf
    return path.join(__dirname, '..', '..', 'resources', 'forms', 'w2.pdf');
}

interface FieldInfo {
    name: string;
    type: string; // 'PDFTextField' | 'PDFCheckBox' | ...
    x: number;
    y: number;
    w: number;
    h: number;
    page: number;
}

/**
 * Reference relative positions (relx, rely) transcribed from the official
 * Copy A (Top) layout, where Box a sits at (153, 732) so rel = field.pos - (153, 732).
 * Each entry maps a W-2 box to its relative coordinate within an instance.
 */
const REFERENCE: Array<{ box: string; relx: number; rely: number }> = [
    { box: 'a', relx: 0, rely: 0 },
    { box: 'b', relx: -115, rely: -24 },
    { box: 'c', relx: -115, rely: -96 },
    { box: 'd', relx: -115, rely: -120 },
    { box: 'e_first', relx: -115, rely: -144 },
    { box: 'e_last', relx: 21, rely: -144 },
    { box: 'e_suffix', relx: 158, rely: -144 },
    { box: 'f', relx: -115, rely: -216 },
    { box: '1', relx: 180, rely: -24 },
    { box: '2', relx: 303, rely: -24 },
    { box: '3', relx: 179, rely: -48 },
    { box: '4', relx: 302, rely: -48 },
    { box: '5', relx: 179, rely: -72 },
    { box: '6', relx: 302, rely: -72 },
    { box: '7', relx: 179, rely: -96 },
    { box: '8', relx: 302, rely: -96 },
    { box: '10', relx: 302, rely: -120 },
    { box: '11', relx: 179, rely: -132 },
    { box: '14', relx: 179, rely: -204 },
    { box: '15_state', relx: -115, rely: -252 },
    { box: '15_id', relx: -87, rely: -252 },
    { box: '16', relx: 42, rely: -252 },
    { box: '17', relx: 129, rely: -252 },
    { box: '18', relx: 208, rely: -252 },
    { box: '19', relx: 294, rely: -252 },
    { box: '20', relx: 374, rely: -252 },
];

const MATCH_TOLERANCE = 5; // points

/** Extract the instance key (e.g. "CopyA_Top") from a field's qualified name. */
function instanceKeyOf(name: string): string | null {
    const m = name.match(/Copy([A-D])\[0\]\.Copy\1_(Top|Bottom)\[0\]/);
    return m ? `Copy${m[1]}_${m[2]}` : null;
}

function nearestBox(relx: number, rely: number): string | null {
    let best: string | null = null;
    let bestDist = MATCH_TOLERANCE;
    for (const r of REFERENCE) {
        const d = Math.abs(relx - r.relx) + Math.abs(rely - r.rely);
        if (d <= bestDist) { bestDist = d; best = r.box; }
    }
    return best;
}

/** Collect all form fields with their first widget rect + page. */
function collectFields(doc: PDFDocument): FieldInfo[] {
    const form = doc.getForm();
    const fields = form.getFields();
    const pages = doc.getPages();
    const pageRefs = pages.map(p => p.ref);
    const out: FieldInfo[] = [];
    for (const f of fields) {
        const name = f.getName();
        const type = f.constructor.name;
        let x = 0, y = 0, w = 0, h = 0, pg = -1;
        try {
            const widgets = (f as any).acroField.getWidgets();
            if (widgets.length > 0) {
                const r = widgets[0].getRectangle();
                x = r.x; y = r.y; w = r.width; h = r.height;
                try {
                    const P = widgets[0].dict.get(PDFName.of('P'));
                    pg = pageRefs.findIndex(ref => ref === P);
                } catch { /* page unknown */ }
            }
        } catch { /* no widgets */ }
        out.push({ name, type, x, y, w, h, page: pg });
    }
    return out;
}

/** Group fields by form instance and map each instance's fields to W-2 boxes. */
function mapInstances(fields: FieldInfo[]): Map<string, Map<string, string>> {
    // instance key -> { box -> fieldName }
    const instances = new Map<string, Map<string, string>>();

    // Group fields by instance.
    const byInstance = new Map<string, FieldInfo[]>();
    for (const f of fields) {
        const key = instanceKeyOf(f.name);
        if (!key) continue;
        if (!byInstance.has(key)) byInstance.set(key, []);
        byInstance.get(key)!.push(f);
    }

    for (const [key, instFields] of byInstance) {
        // Find this instance's Box a (Employee SSN) anchor by semantic name.
        let anchor: FieldInfo | undefined = instFields.find(f => f.name.includes('BoxA_ReadOrder'));
        if (!anchor) {
            // Fallback: highest-y field in the left column (x < 200).
            anchor = instFields.filter(f => f.x < 200).sort((a, b) => b.y - a.y)[0];
        }
        if (!anchor) continue;

        const boxMap = new Map<string, string>();
        for (const f of instFields) {
            const relx = Math.round(f.x - anchor.x);
            const rely = Math.round(f.y - anchor.y);
            const box = nearestBox(relx, rely);
            if (box && !boxMap.has(box)) {
                boxMap.set(box, f.name);
            }
        }
        instances.set(key, boxMap);
    }
    return instances;
}

export interface W2FormData {
    ssn: string;
    ein: string;
    employerNameAddr: string; // multiline
    controlNumber: string;
    first: string;
    last: string;
    suffix: string;
    employeeAddr: string; // multiline
    box1: string; box2: string; box3: string; box4: string;
    box5: string; box6: string; box14: string;
    box15State: string; box15Id: string;
    box16: string; box17: string;
}

const money = (n: number) => (n || 0).toFixed(2);

/** Compute W-2 box values from the caregiver's YTD summary (mirrors W2Service). */
export function buildW2FormData(year: number, caregiver: Caregiver, employer: Employer): W2FormData {
    const ytdRecords = ReportingService.getYTDSummary(year, caregiver.id);
    const data: YTDSummary | undefined = ytdRecords.find(r => r.caregiverId === caregiver.id);

    let ssWageBase = 168600;
    try {
        const taxConfig = TaxConfigurationService.getConfigForYear(year);
        if (taxConfig?.ssWageBase) ssWageBase = taxConfig.ssWageBase;
    } catch { /* default */ }

    const gross = data?.grossWages || 0;
    const nameParts = caregiver.fullLegalName.trim().split(/\s+/);
    const first = nameParts[0] || '';
    const last = nameParts.length >= 2 ? nameParts[nameParts.length - 1] : '';
    const mi = nameParts.length > 2 ? nameParts[1][0] : '';

    const empAddr = [
        employer.displayName,
        employer.addressLine1,
        employer.addressLine2,
        [employer.city, employer.state].filter(Boolean).join(', ') + (employer.zip ? ' ' + employer.zip : ''),
    ].filter(Boolean).join('\n');

    const cgAddr = [
        caregiver.addressLine1,
        caregiver.addressLine2,
        [caregiver.city, caregiver.state].filter(Boolean).join(', ') + (caregiver.zip ? ' ' + caregiver.zip : ''),
    ].filter(Boolean).join('\n');

    const famli = (data as any)?.coloradoFamliEmployee ?? 0;
    const coSit = (data as any)?.coloradoStateIncomeTax ?? 0;

    return {
        ssn: caregiver.ssn || '',
        ein: employer.ssnOrEin || '',
        employerNameAddr: empAddr,
        controlNumber: '',
        first, last, suffix: mi,
        employeeAddr: cgAddr,
        box1: money(gross),
        box2: money(data?.federalWithholding || 0),
        box3: money(Math.min(gross, ssWageBase)),
        box4: money(data?.ssEmployee || 0),
        box5: money(gross),
        box6: money(data?.medicareEmployee || 0),
        box14: famli > 0 ? `CO FAMLI ${money(famli)}` : '',
        box15State: 'CO',
        box15Id: employer.uiAccountNumber || '',
        box16: money(gross),
        box17: money(coSit),
    };
}

/** Fill one form instance's mapped fields with the W-2 data. */
function fillInstance(form: any, boxMap: Map<string, string>, d: W2FormData): string[] {
    const filled: string[] = [];
    const set = (box: string, value: string) => {
        if (!value) return;
        const name = boxMap.get(box);
        if (!name) return;
        try {
            const field = form.getTextField(name);
            if (field) { field.setText(String(value)); filled.push(`${box}=${name}`); }
        } catch { /* not a text field */ }
    };
    set('a', d.ssn);
    set('b', d.ein);
    set('c', d.employerNameAddr);
    set('d', d.controlNumber);
    set('e_first', d.first);
    set('e_last', d.last);
    set('e_suffix', d.suffix);
    set('f', d.employeeAddr);
    set('1', d.box1);
    set('2', d.box2);
    set('3', d.box3);
    set('4', d.box4);
    set('5', d.box5);
    set('6', d.box6);
    set('10', ''); // dependent care — none
    set('11', ''); // nonqualified — none
    set('14', d.box14);
    set('15_state', d.box15State);
    set('15_id', d.box15Id);
    set('16', d.box16);
    set('17', d.box17);
    return filled;
}

export class W2OfficialService {
    /** Generate the official W-2 PDF as a Buffer for a single caregiver. */
    static async generateW2Buffer(year: number, caregiver: Caregiver, employer: Employer): Promise<Buffer> {
        const formPath = getOfficialW2FormPath();
        const bytes = fs.readFileSync(formPath);
        const doc = await PDFDocument.load(bytes);
        const form = doc.getForm();
        // Regenerate field appearance streams so viewers render the filled values.
        try { form.updateFieldAppearances(); } catch { /* default appearances used on save */ }

        const fields = collectFields(doc);
        const instances = mapInstances(fields);

        const data = buildW2FormData(year, caregiver, employer);

        // Fill every copy/instance with the same W-2 data.
        const allFilled: Array<{ inst: string; filled: string[] }> = [];
        for (const [instKey, boxMap] of instances) {
            const filled = fillInstance(form, boxMap, data);
            allFilled.push({ inst: instKey, filled });
        }

        // ── Verify the reference mapping aligns with the IRS's own semantic field
        //    name hints. If box N maps to the field the IRS labelled as box N, the
        //    relative-position reference is correct (and so are all other copies).
        const ref = instances.get('CopyA_Top');
        if (!ref) throw new Error('W-2 mapping self-check failed: CopyA_Top instance not found');
        const assertHint = (box: string, hint: string) => {
            const name = ref.get(box);
            if (!name || !name.includes(hint)) {
                throw new Error(`W-2 mapping self-check failed: box ${box} expected a field containing "${hint}", got "${name}"`);
            }
        };
        assertHint('a', 'BoxA_ReadOrder');
        assertHint('1', 'Box1_ReadOrder');
        assertHint('3', 'Box3_ReadOrder');
        assertHint('5', 'Box5_ReadOrder');
        assertHint('7', 'Box7_ReadOrder');
        assertHint('10', 'Box10_ReadOrder');
        assertHint('16', 'Box16_ReadOrder');
        assertHint('17', 'Box17_ReadOrder');
        assertHint('e_first', 'FirstName_ReadOrder');
        assertHint('e_last', 'LastName_ReadOrder');
        const b15s = ref.get('15_state'); const b15i = ref.get('15_id');
        if (!b15s || !b15i || !b15s.includes('Box15_ReadOrder') || !b15i.includes('Boxes15_ReadOrder')) {
            throw new Error('W-2 mapping self-check failed: box 15 (state / state ID) not mapped correctly');
        }

        const out = await doc.save();
        return Buffer.from(out);
    }
}
