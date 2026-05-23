
// Mock implementation for testing logic
const SYNONYM_GROUPS = [
    ['light', 'lamp', 'headlight', 'headlamp'],
    ['tail light', 'tail lamp', 'taillight', 'taillamp'],
    ['indicator', 'signal', 'blinker', 'winker'],
    ['brake', 'break'],
    ['disk', 'disc'],
    ['shock', 'shocker', 'suspension', 'absorber', 'damper'],
    ['silencer', 'muffler', 'exhaust'],
    ['carburetor', 'carburettor', 'carb'],
    ['accelerator', 'throttle', 'gas'],
    ['clutch', 'cluch'],
    ['bearing', 'wbearing', 'ball racer'],
    ['plug', 'spark plug'],
    ['filter', 'cleaner'],
    ['mudguard', 'fender'],
    ['visor', 'windshield', 'screen'],
    ['stand', 'kickstand'],
    ['mirror', 'side mirror', 'rear view'],
    ['pad', 'pads', 'shoe', 'shoes'],
    ['cable', 'wire', 'line'],
    ['chain', 'sprocket', 'kit'],
    ['oil', 'lubricant', 'lube'],
    ['bulb', 'lamp'],
    ['relay', 'switch', 'unit'],
    ['rectifier', 'regulator', 'charger'],
    ['cdi', 'unit', 'brain'],
    ['coil', 'magneto', 'stator'],
    ['block', 'cylinder', 'piston'],
    ['rim', 'wheel', 'alloy'],
    ['tyre', 'tire'],
    ['tube', 'innertube'],
    ['vis', 'visor'],
    ['horn', 'hooter'],
    ['gasket', 'packing', 'seal'],
    ['bush', 'bushing'],
    ['nut', 'bolt', 'fastener'],
];

function expandSearchTerm(term) {
    if (!term) return [];
    const normalizedTerm = term.toLowerCase().trim();
    const searchTerms = new Set();
    searchTerms.add(normalizedTerm);

    for (const group of SYNONYM_GROUPS) {
        if (group.includes(normalizedTerm)) {
            group.forEach(synonym => searchTerms.add(synonym));
        }
    }

    const words = normalizedTerm.split(/\s+/);
    if (words.length > 1) {
        for (const group of SYNONYM_GROUPS) {
            for (const synonym of group) {
                if (normalizedTerm.includes(synonym)) {
                    for (const replacement of group) {
                        if (replacement !== synonym) {
                            searchTerms.add(normalizedTerm.replace(synonym, replacement));
                        }
                    }
                }
            }
        }
    }
    return Array.from(searchTerms);
}

function generateOrQuery(field, terms) {
    if (terms.length === 0) return '';
    return terms
        .map(term => `${field}.ilike.%${term}%`)
        .join(',');
}

// Tests
console.log('--- TEST 1: head light relay ---');
const t1 = "head light relay";
const e1 = expandSearchTerm(t1);
console.log('Expanded:', e1);
console.log('Query:', generateOrQuery('name', e1));

console.log('\n--- TEST 2: head light ---');
const t2 = "head light";
const e2 = expandSearchTerm(t2);
console.log('Expanded:', e2);

console.log('\n--- TEST 3: head lamp relay ---');
const t3 = "head lamp relay";
const e3 = expandSearchTerm(t3);
console.log('Expanded:', e3);
