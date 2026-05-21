import { useState, useEffect } from 'react';
import { Database } from '../lib/database.types';
import { Plus, UserCheck, DollarSign, Edit, CheckCircle, PackageOpen, Eye } from 'lucide-react';
import { customerService, salesService } from '../services';
import { useToast } from '../contexts/ToastContext';
import { Modal, SearchBar, LoadingSpinner, EmptyState } from './ui';
import { Invoice, InvoiceData } from './Invoice';

type ReferralAgent = Database['public']['Tables']['referral_agents']['Row'];

interface Commission {
  id: string;
  sale_id: string;
  sale_amount: number;
  commission_amount: number;
  status: 'pending' | 'paid';
  created_at: string;
  payment_date: string | null;
  sale?: {
    sale_number: string;
  };
}

export function ReferralAgents() {
  const { showToast } = useToast();
  const [agents, setAgents] = useState<ReferralAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Agent Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedAgent, setSelectedAgent] = useState<ReferralAgent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'individual' as 'garage' | 'individual',
    phone: '',
    email: '',
    address: '',
    commission_rate: 5,
  });

  // Commission Modal State
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [_dateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const [showConfirmPayoutModal, setShowConfirmPayoutModal] = useState(false);
  const [commissionsToPayout, setCommissionsToPayout] = useState<Commission[]>([]);

  // Custom Commission State
  const [showCustomCommissionModal, setShowCustomCommissionModal] = useState(false);
  const [saleSearchQuery, setSaleSearchQuery] = useState('');
  const [foundSale, setFoundSale] = useState<any>(null);
  const [customCommissionAmount, setCustomCommissionAmount] = useState<number>(0);
  const [searchingSale, setSearchingSale] = useState(false);

  // Invoice State
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (showCommissionModal && selectedAgent) {
      loadCommissions(selectedAgent.id);
    }
  }, [showCommissionModal, selectedAgent]);

  async function loadAgents() {
    try {
      const data = await customerService.getAllReferralAgents();
      setAgents((data as any) || []);
    } catch (error) {
      console.error('Error loading referral agents:', error);
      showToast('Failed to load referral agents', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadCommissions(agentId: string) {
    setLoadingCommissions(true);
    try {
      const data = await salesService.getCommissionsByAgent(agentId);

      // Transform and set data
      const formattedData = ((data as any) || []).map((item: any) => ({
        ...item,
        sale: item.sale ? (Array.isArray(item.sale) ? item.sale[0] : item.sale) : null
      })) as Commission[];

      setCommissions(formattedData);
    } catch (error) {
      console.error('Error loading commissions:', error);
      showToast('Failed to load commissions', 'error');
    } finally {
      setLoadingCommissions(false);
    }
  }

  async function handlePayout(filteredCommissions: Commission[]) {
    if (!filteredCommissions.length) {
      showToast('No commissions selected for payout', 'warning');
      return;
    }
    setCommissionsToPayout(filteredCommissions);
    setShowConfirmPayoutModal(true);
  }

  async function handlePayoutConfirmed() {
    if (commissionsToPayout.length === 0) return;

    try {
      const commissionIds = commissionsToPayout.map((c: Commission) => c.id);
      await salesService.payoutCommissions(commissionIds);

      showToast('Commissions paid out successfully!', 'success');
      if (selectedAgent) {
        loadCommissions(selectedAgent.id);
      }
    } catch (error: any) {
      showToast('Error processing payout: ' + error.message, 'error');
    } finally {
      setShowConfirmPayoutModal(false);
      setCommissionsToPayout([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (modalMode === 'add') {
        await customerService.createReferralAgent({
          ...formData
        });
        showToast('Referral agent added successfully!', 'success');
      } else if (selectedAgent) {
        await customerService.updateReferralAgent(selectedAgent.id, formData);
        showToast('Referral agent updated successfully!', 'success');
      }

      setShowModal(false);
      resetForm();
      loadAgents();
    } catch (error: any) {
      showToast(error.message || 'Failed to save agent', 'error');
    }
  }

  async function handleSearchSale() {
    if (!saleSearchQuery.trim()) return;
    setSearchingSale(true);
    try {
      const sale = await salesService.findSaleByNumber(saleSearchQuery.trim());
      if (sale) {
        setFoundSale(sale);
        // Default commission hint (e.g., 5% of sale)
        if (selectedAgent) {
          const hint = (sale.total_amount - (sale.service_charge || 0)) * (selectedAgent.commission_rate / 100);
          setCustomCommissionAmount(Math.round(hint));
        }
      } else {
        showToast('Sale not found', 'error');
        setFoundSale(null);
      }
    } catch (error) {
      showToast('Error searching sale', 'error');
    } finally {
      setSearchingSale(false);
    }
  }

  async function handleAddCustomCommission() {
    if (!selectedAgent || !foundSale || customCommissionAmount <= 0) return;

    try {
      await salesService.addCustomCommission({
        referral_agent_id: selectedAgent.id,
        sale_id: foundSale.id,
        commission_amount: customCommissionAmount,
        sale_amount: foundSale.total_amount - (foundSale.service_charge || 0),
      });

      showToast('Custom commission added!', 'success');
      setShowCustomCommissionModal(false);
      setFoundSale(null);
      setSaleSearchQuery('');
      loadCommissions(selectedAgent.id);
    } catch (error: any) {
      showToast(error.message || 'Failed to add commission', 'error');
    }
  }

  async function handleViewInvoice(saleId: string) {
    setLoadingInvoice(true);
    try {
      const sale = await salesService.getSaleById(saleId);
      const items = await salesService.getSaleItems(saleId);

      if (!sale) {
        showToast('Sale not found', 'error');
        return;
      }

      const data: InvoiceData = {
        saleNumber: sale.sale_number,
        date: new Date(sale.sale_date).toLocaleString(),
        customerName: sale.customer?.name || 'Walk-in Customer',
        customerPhone: sale.customer?.phone || undefined,
        items: items.map((item: any) => ({
          name: item.product?.name || 'Unknown Item',
          quantity: item.quantity,
          unitPrice: item.selling_price || item.unit_price,
          discountedUnitPrice: item.unit_price,
          subtotal: (item.selling_price || item.unit_price) * item.quantity,
          discountedSubtotal: item.unit_price * item.quantity,
          batchNumber: item.batch?.batch_number || '',
          warranty: item.warranty_duration && item.warranty_duration > 0 ? {
            duration: item.warranty_duration,
            unit: (item.warranty_unit as any) || 'months',
            type: item.warranty_type || undefined
          } : undefined,
        })),
        subtotal: sale.subtotal + (sale.discount_amount || 0),
        discount: sale.discount_amount,
        tax: sale.tax_amount,
        total: sale.total_amount,
        paidAmount: sale.paid_amount,
        changeAmount: Math.max(0, sale.paid_amount - sale.total_amount),
        paymentMethod: sale.payment_method || 'cash',
        cashierName: sale.cashier?.full_name || 'System',
        serviceCharge: sale.service_charge || 0,
      };

      setInvoiceData(data);
      setShowInvoice(true);
    } catch (error) {
      console.error('Error loading invoice:', error);
      showToast('Failed to load invoice', 'error');
    } finally {
      setLoadingInvoice(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      type: 'individual',
      phone: '',
      email: '',
      address: '',
      commission_rate: 5,
    });
    setSelectedAgent(null);
  }

  function openAddModal() {
    resetForm();
    setModalMode('add');
    setShowModal(true);
  }

  function openEditModal(agent: ReferralAgent) {
    setSelectedAgent(agent);
    setFormData({
      name: agent.name,
      type: agent.type as any,
      phone: agent.phone || '',
      email: agent.email || '',
      address: agent.address || '',
      commission_rate: agent.commission_rate,
    });
    setModalMode('edit');
    setShowModal(true);
  }

  function openCommissionModal(agent: ReferralAgent) {
    setSelectedAgent(agent);
    setShowCommissionModal(true);
    setActiveTab('pending');
  }

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (agent.phone && agent.phone.includes(searchTerm))
  );

  if (loading) {
    return <LoadingSpinner message="Loading referral agents..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Referral Agents</h2>
          <p className="text-slate-600 mt-1">Manage garages and individual referral partners</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Add Agent
        </button>
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search agents by name or phone..."
      />

      {filteredAgents.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No agents found"
          description={searchTerm ? `No agents match "${searchTerm}"` : "You haven't added any referral agents yet."}
          action={!searchTerm ? { label: 'Add Your First Agent', onClick: openAddModal } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="bg-slate-100 p-2 rounded-lg">
                    <UserCheck className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{agent.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-tight">
                      {agent.type}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openEditModal(agent)}
                  className="p-1 hover:bg-slate-100 rounded transition"
                >
                  <Edit className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <div className="space-y-2 text-sm text-left">
                {agent.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-medium">Phone:</span>
                    <span>{agent.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-600 text-left">
                  <span className="font-medium">Commission Rate:</span>
                  <span>{agent.commission_rate}%</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => openCommissionModal(agent)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition border border-slate-200"
                >
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Manage Commissions
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agent Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === 'add' ? 'Add Referral Agent' : 'Edit Referral Agent'}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="p-6 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Agent Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter garage or name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              >
                <option value="individual">Individual</option>
                <option value="garage">Garage</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Commission Rate (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.commission_rate}
                onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                required
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter email address"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter address"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 text-left">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              {modalMode === 'add' ? 'Add Agent' : 'Update Agent'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Commissions Modal */}
      <Modal
        isOpen={showCommissionModal}
        onClose={() => setShowCommissionModal(false)}
        title={selectedAgent ? `Commissions: ${selectedAgent.name}` : 'Commissions'}
        size="4xl"
      >
        <div className="flex flex-col h-full text-left">
          <div className="p-4 border-b border-slate-200">
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Pending
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Payment History
              </button>
            </div>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {loadingCommissions ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
              </div>
            ) : (
              <div>
                {activeTab === 'pending' ? (
                  <div>
                    {commissions.filter(c => c.status === 'pending').length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <p className="text-slate-900 font-medium">No pending commissions</p>
                        <p className="text-slate-500 text-sm">All commissions for this agent have been paid.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-semibold text-slate-900">Total Pending: LKR {commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commission_amount, 0).toFixed(2)}</h4>
                          <div className="flex flex-wrap gap-2 mb-4">
                            <button
                              onClick={() => handlePayout(commissions.filter(c => c.status === 'pending'))}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-sm"
                            >
                              <DollarSign className="w-4 h-4" />
                              Payout All Pending
                            </button>
                            <button
                              onClick={() => setShowCustomCommissionModal(true)}
                              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium border border-slate-200"
                            >
                              <Plus className="w-4 h-4" />
                              Add Custom Commission
                            </button>
                          </div>
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Sale #</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Sale Amount</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Commission</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-left">
                              {commissions.filter(c => c.status === 'pending').map((c) => (
                                <tr key={c.id}>
                                  <td className="px-4 py-3 text-sm text-slate-600 text-left">{new Date(c.created_at).toLocaleDateString()}</td>
                                  <td className="px-4 py-3 text-sm font-medium text-slate-900 text-left">{c.sale?.sale_number}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600 text-right">LKR {c.sale_amount.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">LKR {c.commission_amount.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-sm text-right">
                                    <button
                                      onClick={() => handleViewInvoice(c.sale_id)}
                                      disabled={loadingInvoice}
                                      className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-600 hover:text-slate-900"
                                      title="View Invoice"
                                    >
                                      {loadingInvoice ? (
                                        <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                                      ) : (
                                        <Eye className="w-4 h-4" />
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {commissions.filter(c => c.status === 'paid').length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <PackageOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-900 font-medium">No payment history</p>
                        <p className="text-slate-500 text-sm">No commissions have been paid out yet.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Payment Date</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Sale #</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Amount Paid</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-left">
                            {commissions.filter(c => c.status === 'paid').map((c) => (
                              <tr key={c.id}>
                                <td className="px-4 py-3 text-sm text-slate-600 text-left">{c.payment_date ? new Date(c.payment_date).toLocaleDateString() : 'N/A'}</td>
                                <td className="px-4 py-3 text-sm text-slate-900 text-left">{c.sale?.sale_number}</td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">LKR {c.commission_amount.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-right">
                                  <button
                                    onClick={() => handleViewInvoice(c.sale_id)}
                                    disabled={loadingInvoice}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-600 hover:text-slate-900"
                                    title="View Invoice"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-200 flex justify-end text-left">
            <button
              onClick={() => setShowCommissionModal(false)}
              className="px-4 py-2 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Payout Confirmation Modal */}
      <Modal
        isOpen={showConfirmPayoutModal}
        onClose={() => setShowConfirmPayoutModal(false)}
        title="Confirm Payout"
        size="md"
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Commission Payout</h3>
          <p className="text-slate-600 mb-6 font-normal">
            Are you sure you want to payout{' '}
            <span className="font-bold text-slate-900">
              LKR {commissionsToPayout.reduce((sum: number, c: Commission) => sum + c.commission_amount, 0).toFixed(2)}
            </span>{' '}
            for <span className="font-bold text-slate-900">{commissionsToPayout.length}</span> transactions?
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmPayoutModal(false)}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handlePayoutConfirmed}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-sm"
            >
              Confirm Payout
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Custom Commission Modal */}
      <Modal
        isOpen={showCustomCommissionModal}
        onClose={() => {
          setShowCustomCommissionModal(false);
          setFoundSale(null);
          setSaleSearchQuery('');
        }}
        title="Add Custom Commission"
        size="lg"
      >
        <div className="p-6 text-left">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Find Sale by Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={saleSearchQuery}
                onChange={(e) => setSaleSearchQuery(e.target.value.toUpperCase())}
                placeholder="e.g. SALE-2026..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
              />
              <button
                onClick={handleSearchSale}
                disabled={searchingSale}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {searchingSale ? 'Searching...' : 'Find'}
              </button>
            </div>
          </div>

          {foundSale && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 block">Sale Total</span>
                    <span className="font-bold text-slate-900">LKR {foundSale.total_amount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Date</span>
                    <span className="font-bold text-slate-900">{new Date(foundSale.sale_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Commission Amount (LKR)
                </label>
                <input
                  type="number"
                  value={customCommissionAmount}
                  onChange={(e) => setCustomCommissionAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none font-bold text-lg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowCustomCommissionModal(false);
                    setFoundSale(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustomCommission}
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-medium"
                >
                  Add Commission
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Invoice Component */}
      {showInvoice && invoiceData && (
        <div className="z-[70] relative text-left">
          <Invoice
            invoiceData={invoiceData}
            onClose={() => setShowInvoice(false)}
          />
        </div>
      )}
    </div>
  );
}
