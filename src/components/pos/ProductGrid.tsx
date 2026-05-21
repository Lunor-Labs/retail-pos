import { useState } from 'react';
import { Plus, Maximize2, X } from 'lucide-react';
import { ProductWithBatches } from '../../types';
import { ProductImage } from '../ProductImage';

interface ProductGridProps {
  products: ProductWithBatches[];
  onAddToCart: (product: ProductWithBatches) => void;
  viewMode: 'grid' | 'list';
  isAdmin: boolean;
}

export function ProductGrid({ products, onAddToCart, viewMode, isAdmin }: ProductGridProps) {
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null);

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No products available</p>
      </div>
    );
  }

  return (
    <>
      <div className={viewMode === 'grid'
        ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        : "flex flex-col gap-3 md:gap-2"
      }>
        {products.map((product) => {
          const totalStock = product.batches.reduce((sum, b) => sum + b.current_quantity, 0);
          const lowestPrice = product.batches.length > 0
            ? Math.min(...product.batches.map(b => b.selling_price))
            : 0;

          if (viewMode === 'list') {
            return (
              <div
                key={product.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md transition group relative"
              >
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 relative cursor-zoom-in rounded-md group/image"
                  onClick={() => product.image_url && setPreviewImage({ url: product.image_url, alt: product.name })}
                >
                  <div className="w-full h-full overflow-hidden rounded-md">
                    <ProductImage
                      imageUrl={product.image_url}
                      alt={product.name}
                      size="sm"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover/image:scale-110"
                    />
                  </div>

                  {/* Hover Preview Popover */}
                  {product.image_url && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 w-64 h-64 bg-white p-2 rounded-xl shadow-2xl border border-slate-200 z-50 opacity-0 group-hover/image:opacity-100 pointer-events-none transition-all duration-200 scale-95 group-hover/image:scale-100 origin-left">
                      <div className="w-full h-full relative bg-slate-50 rounded-lg overflow-hidden">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm sm:text-base text-slate-900 truncate" title={product.name}>
                    {product.name}
                  </h4>
                  <div className="flex flex-col gap-1 text-xs sm:text-sm text-slate-500 mt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">
                        {product.sku}
                      </span>
                      {product.sku && (
                        <span className="text-xs text-slate-600">
                          {product.category}
                        </span>
                      )}
                    </div>
                    {isAdmin && product.batches.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400">Cost:</span>
                        <span className="text-xs font-semibold text-slate-700">LKR {[...product.batches].sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())[0].cost_price.toFixed(2)}</span>
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                          {[...product.batches].sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())[0].markup_percentage}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-1 sm:min-w-fit">
                  <div className="text-right">
                    <p className="font-bold text-base sm:text-lg text-slate-900">
                      LKR {lowestPrice.toFixed(2)}
                    </p>
                    <p className={`text-xs ${totalStock === 0 ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                      {totalStock === 0 ? 'Out of Stock' : `${totalStock} in stock`}
                    </p>
                  </div>

                  <button
                    onClick={() => onAddToCart(product)}
                    disabled={totalStock === 0}
                    className={`p-2 sm:p-2.5 rounded-lg transition flex-shrink-0 ${totalStock === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    title={totalStock === 0 ? 'Out of stock' : 'Add to cart'}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          }

          // Grid View
          return (
            <div
              key={product.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition group"
            >
              <div
                className="aspect-square relative overflow-hidden cursor-zoom-in"
                onClick={() => product.image_url && setPreviewImage({ url: product.image_url, alt: product.name })}
              >
                <ProductImage
                  imageUrl={product.image_url}
                  alt={product.name}
                  size="lg"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />

                {/* Floating Add Button for Grid */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(product);
                  }}
                  disabled={totalStock === 0}
                  className={`absolute bottom-2 right-2 p-2 rounded-full shadow-lg transition z-10 ${totalStock === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                    } opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0`}
                  title={totalStock === 0 ? 'Out of stock' : 'Add to cart'}
                >
                  <Plus className="w-5 h-5" />
                </button>

                {totalStock === 0 && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-0">
                    <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Out of Stock
                    </span>
                  </div>
                )}

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition duration-300">
                  <div className="bg-black/50 p-1.5 rounded-full text-white backdrop-blur-sm">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 space-y-2">
                <h4 className="font-medium text-slate-900 text-sm sm:text-base line-clamp-2" title={product.name}>
                  {product.name}
                </h4>
                <p className="text-xs text-slate-500 font-mono">
                  SKU: {product.sku}
                </p>
                {isAdmin && product.batches.length > 0 && (
                  <div className="bg-slate-50 p-2 rounded space-y-1">
                    <div className="flex justify-between items-baseline gap-1 text-xs">
                      <span className="text-slate-600">Cost:</span>
                      <span className="font-semibold text-slate-800">LKR {[...product.batches].sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())[0].cost_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-end">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                        {[...product.batches].sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())[0].markup_percentage}%
                      </span>
                    </div>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-2">
                  <p className="text-lg font-bold text-slate-900">
                    LKR {lowestPrice.toFixed(2)}
                  </p>
                  <p className={`text-xs sm:text-sm font-medium ${totalStock === 0 ? 'text-red-600' : 'text-slate-600'}`}>
                    {totalStock === 0 ? 'Out of Stock' : `Stock: ${totalStock}`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl w-full h-full max-h-[90vh] flex items-center justify-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
              title="Close preview"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.alt}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
