/**
 * Search utility to handle synonym expansion and fuzzy search helpers
 */

// Dictionary of common automotive synonyms
// Each array represents a group of interchangeable terms
const SYNONYM_GROUPS = [
    ['light', 'lamp'],
    ['tail light', 'tail lamp', 'taillight', 'taillamp'],
    ['indicator', 'signal', 'blinker', 'winker'],
    ['brake', 'break'], // Common misspelling
    ['disk', 'disc'],
    ['shock', 'shocker', 'suspension', 'absorber', 'damper'],
    ['silencer', 'muffler', 'exhaust'],
    ['carburetor', 'carburettor', 'carb'],
    ['accelerator', 'throttle', 'gas'],
    ['clutch', 'cluch'], // Common misspelling
    ['bearing', 'wbearing', 'ball racer'],
    ['plug', 'spark plug'],
    ['filter', 'cleaner'], // Air filter/cleaner
    ['mudguard', 'fender'],
    ['visor', 'windshield', 'screen'],
    ['stand', 'kickstand'],
    ['mirror', 'side mirror', 'rear view'],
    ['pad', 'pads', 'shoe', 'shoes'], // Brake pads/shoes
    ['cable', 'wire', 'line'],
    ['chain', 'sprocket', 'kit'],
    ['oil', 'lubricant', 'lube'],
    ['bulb', 'lamp'], // Generic
    ['relay'],
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

/**
 * Expands a search term into a list of synonymous terms
 * @param term The original search term
 * @returns Array of terms including the original and its synonyms
 */
export function expandSearchTerm(term: string): string[] {
    if (!term) return [];

    const normalizedTerm = term.toLowerCase().trim();
    const searchTerms = new Set<string>();

    // Add original term
    searchTerms.add(normalizedTerm);

    // Split term into words to check for multi-word synonyms or partial matches if needed
    // For now, we'll keep it simple and match the full phrase or individual words

    // Check against synonym groups
    for (const group of SYNONYM_GROUPS) {
        // If the term exists in this group, add all other terms from the group
        if (group.includes(normalizedTerm)) {
            group.forEach(synonym => searchTerms.add(synonym));
        }

        // Also check if any word in the term matches a synonym
        // This helps with "head light relay" -> "head lamp relay"
        // But we need to be careful not to generate too many combinations
    }

    // Advanced word replacement for phrases
    const words = normalizedTerm.split(/\s+/);
    if (words.length > 1) {
        // Try to find synonyms for individual words and reconstruct phrases
        // Example: "head light relay"
        // "head light" match -> "head lamp"
        // Result: "head lamp relay"

        // We can try to replace known multi-word synonyms within the phrase
        for (const group of SYNONYM_GROUPS) {
            for (const synonym of group) {
                if (normalizedTerm.includes(synonym)) {
                    // If we found a match, try replacing it with other synonyms in the group
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

/**
 * Generates a Supabase OR query string for a specific field and list of terms
 * @param field The database field to search (e.g., 'name')
 * @param terms The list of search terms
 * @returns A string compatible with Supabase .or() method
 */
export function generateOrQuery(field: string, terms: string[]): string {
    if (terms.length === 0) return '';

    // Format: field.ilike.%term1%,field.ilike.%term2%
    return terms
        .map(term => `${field}.ilike.%${term}%`)
        .join(',');
}
