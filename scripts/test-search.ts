
import { expandSearchTerm, generateOrQuery } from '../src/utils/searchUtils';

console.log('Testing Expand Search Term:');
const term = "head light relay";
const expanded = expandSearchTerm(term);
console.log(`Original: "${term}"`);
console.log(`Expanded:`, expanded);

console.log('\nTesting Query Generation:');
const query = generateOrQuery('name', expanded);
console.log(`Query: ${query}`);

// Test case from user: "head light" vs "head lamp"
const term2 = "head light";
console.log(`\nOriginal: "${term2}"`);
console.log(`Expanded:`, expandSearchTerm(term2));
