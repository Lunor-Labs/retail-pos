import { ProductWithBatches } from '../../types';
import { ProductImage } from '../ProductImage';

interface ProductSearchListProps {
  products: ProductWithBatches[];
  onSelectProduct: (product: ProductWithBatches) => void;
}

export function ProductSearchList({ products, onSelectProduct }: ProductSearchListProps) {
  if (products.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500 border border-slate-200 rounded-lg">
        No products found
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => onSelectProduct(product)}
          className="w-full p-3 hover:bg-slate-50 transition text-left border-b border-slate-100 last:border-b-0"
        >
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-start gap-3 flex-1">
              <ProductImage
                imageUrl={product.image_url}
                alt={product.name}
                size="sm"
              />
              <div>
                <p className="font-medium text-slate-900">{product.name}</p>
                <p className="text-sm text-slate-500">
                  {product.sku} {product.category && `• ${product.category}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">
                {product.batches.length} batch{product.batches.length !== 1 ? 'es' : ''}
              </p>
              <p className="text-xs text-slate-500">
                Stock: {product.batches.reduce((sum, b) => sum + b.current_quantity, 0)}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
