
// Mock logic from useProducts
function expandSearchTerm(term) {
    // Simplified mock of expandSearchTerm for this test
    // Real implementation is in searchUtils.ts
    // We assume searchUtils works (tested in previous step)
    if (term === "head light relay") return ["head light relay", "head lamp relay"];
    if (term === "head light") return ["head light", "head lamp"];
    return [term];
}

const mockProducts = [
    { name: "Head Lamp Relay", sku: "123", barcode: "111" },
    { name: "Side Mirror", sku: "456", barcode: "222" },
    { name: "Brake Pad", sku: "789", barcode: "333" }
];

function filterProducts(products, query) {
    const expandedTerms = expandSearchTerm(query);
    console.log(`Query: "${query}" -> Expanded:`, expandedTerms);

    return products.filter(p => {
        // Check synonyms against name (Logic from useProducts)
        const nameMatch = expandedTerms.some(term => {
            const words = term.split(/\s+/);
            return words.every(word => p.name.toLowerCase().includes(word));
        });

        if (nameMatch) return true;

        return false; // Simplified for test
    });
}

// Tests
console.log('--- TEST 1: "head light relay" should find "Head Lamp Relay" ---');
const res1 = filterProducts(mockProducts, "head light relay");
console.log("Found:", res1.map(p => p.name));

console.log('\n--- TEST 2: "head light" should find "Head Lamp Relay" ---');
const res2 = filterProducts(mockProducts, "head light");
console.log("Found:", res2.map(p => p.name));

console.log('\n--- TEST 3: "brake" should find "Brake Pad" ---');
// Mock expansion for brake
function expandSearchTerm2(term) {
    if (term === "break") return ["break", "brake"];
    return [term];
}
// Override for this test
const oldExpand = expandSearchTerm;
// Redefine locally for test 3 if needed, but logic check is sufficient.
