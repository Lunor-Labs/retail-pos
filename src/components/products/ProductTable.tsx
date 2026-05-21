import { Edit, Eye, Printer, PackagePlus } from 'lucide-react';
import { ProductWithStock } from '../../types';
import { ProductImage } from '../ProductImage';

interface ProductTableProps {
  products: ProductWithStock[];
  onView: (product: ProductWithStock) => void;
  onEdit: (product: ProductWithStock) => void;
  onAddStock: (product: ProductWithStock) => void;
  onPrintBarcode: (product: ProductWithStock) => void;
  isAdmin: boolean;
}

export function ProductTable({
  products,
  onView,
  onEdit,
  onAddStock,
  onPrintBarcode,
  isAdmin,
}: ProductTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Barcode
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Unit
              </th>
              {isAdmin && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Markup
                  </th>
                </>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <ProductImage
                      imageUrl={product.image_url}
                      alt={product.name}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-slate-900">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-slate-500">{product.description}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{product.sku}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{(product as any).brand || '-'}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{product.category || '-'}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.total_stock <= 5
                      ? 'bg-red-100 text-red-800'
                      : product.total_stock <= 10
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                      }`}
                  >
                    {product.total_stock}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{product.unit}</td>
                {isAdmin && (
                  <>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {product.batches && product.batches.length > 0 ? (
                        `LKR ${[...product.batches].sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())[0].cost_price.toFixed(2)}`
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {product.batches && product.batches.length > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {[...product.batches].sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())[0].markup_percentage}%
                        </span>
                      ) : '-'}
                    </td>
                  </>
                )}
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView(product)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition"
                      title="View details"
                    >
                      <Eye className="w-4 h-4 text-slate-600" />
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => onAddStock(product)}
                          className="p-2 hover:bg-emerald-50 rounded-lg transition text-emerald-600"
                          title="Add Stock"
                        >
                          <PackagePlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEdit(product)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition"
                          title="Edit product"
                        >
                          <Edit className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => onPrintBarcode(product)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition"
                          title="Print barcode"
                        >
                          <Printer className="w-4 h-4 text-slate-600" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No products found</p>
          </div>
        )}
      </div>
    </div>
  );
}
