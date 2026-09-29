import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar, ViewType } from './components/Sidebar';
import {
  RoleType,
  Shipment,
  Quote,
  CompetitorProfile,
  Partner,
  Deal,
  AuditLogEntry,
  GeneratedDocument,
} from './types';
import {
  INITIAL_SHIPMENTS,
  INITIAL_QUOTES,
  INITIAL_APPROVALS,
  INITIAL_PARTNERS,
  INITIAL_DEALS,
  INITIAL_AUDIT_LOGS,
  BRANCHES,
  COMPETITORS_LIST,
} from './data/mockData';
import { generateStandardizedDocuments } from './utils/documentGenerator';

// Modals
import { ExplainNumberModal } from './components/modals/ExplainNumberModal';
import { NewShipmentModal } from './components/modals/NewShipmentModal';
import { NewQuoteModal } from './components/modals/NewQuoteModal';
import { NewPartnerModal } from './components/modals/NewPartnerModal';
import { NewLeadModal } from './components/modals/NewLeadModal';
import { AIDrawer } from './components/modals/AIDrawer';
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { CompetitorDetailModal } from './components/modals/CompetitorDetailModal';
import { ShipmentDetailModal } from './components/modals/ShipmentDetailModal';
import { ActivityAuditModal } from './components/modals/ActivityAuditModal';
import { AutomatedDocumentModal } from './components/modals/AutomatedDocumentModal';

// Views
import { DashboardView } from './components/views/DashboardView';
import { ShipmentsView } from './components/views/ShipmentsView';
import { PipelineView } from './components/views/PipelineView';
import { QuotesView } from './components/views/QuotesView';
import { CustomsView } from './components/views/CustomsView';
import { DocIntelView } from './components/views/DocIntelView';
import { DriverAppView } from './components/views/DriverAppView';
import { FinanceView } from './components/views/FinanceView';
import { HRMSView } from './components/views/HRMSView';
import { UnifiedInboxView } from './components/views/UnifiedInboxView';
import { CompetitorAtlasView } from './components/views/CompetitorAtlasView';
import { FeatureMatrixView } from './components/views/FeatureMatrixView';
import { NineGapsView } from './components/views/NineGapsView';
import { PricingCalculatorView } from './components/views/PricingCalculatorView';
import { RoadmapView } from './components/views/RoadmapView';
import { ApprovalsView } from './components/views/ApprovalsView';
import { CustomerPortalView } from './components/views/CustomerPortalView';
import { ComplianceAuditView } from './components/views/ComplianceAuditView';
import { PartnersView } from './components/views/PartnersView';
import { VendorBillsView } from './components/views/VendorBillsView';
import { WarehouseView } from './components/views/WarehouseView';
import { DocumentStatusView } from './components/views/DocumentStatusView';
import { LifecycleView } from './components/views/LifecycleView';
import { SettingsView } from './components/views/SettingsView';
import { InternalQuoteView } from './components/views/InternalQuoteView';
import { ReceiptsView } from './components/views/ReceiptsView';
import { UtilitiesView } from './components/views/UtilitiesView';
import { FleetView } from './components/views/FleetView';
import { FileText, CheckCircle2, ArrowRight } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [currentRole, setCurrentRole] = useState<RoleType>('owner');
  const [currentBranch, setCurrentBranch] = useState<string>('DXB');
  const [isSimpleMode, setIsSimpleMode] = useState<boolean>(false);

  // Global Night-Shift Operations Theme (Dark Mode using CSS variables)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('db_theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('db_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('db_theme', 'light');
      }
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Core Data State
  const [shipments, setShipments] = useState<Shipment[]>(INITIAL_SHIPMENTS);
  const [quotes, setQuotes] = useState<Quote[]>(INITIAL_QUOTES);
  const [partners, setPartners] = useState<Partner[]>(INITIAL_PARTNERS);
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(INITIAL_APPROVALS.length);

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isNewShipmentOpen, setIsNewShipmentOpen] = useState(false);
  const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);
  const [isNewPartnerOpen, setIsNewPartnerOpen] = useState(false);
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isAutomatedDocOpen, setIsAutomatedDocOpen] = useState(false);
  const [activeAutomatedDocs, setActiveAutomatedDocs] = useState<GeneratedDocument[]>([]);
  const [activeAutomatedJobNo, setActiveAutomatedJobNo] = useState<string>('DB-1048');

  // Automated Document Generation Toast
  const [autoDocToast, setAutoDocToast] = useState<{
    message: string;
    jobNo: string;
    docs: GeneratedDocument[];
  } | null>(null);

  const [selectedShipmentDetail, setSelectedShipmentDetail] = useState<Shipment | null>(null);
  const [selectedCompetitorDetail, setSelectedCompetitorDetail] = useState<CompetitorProfile | null>(null);

  // Explain Number Audit Modal
  const [explainModalData, setExplainModalData] = useState<{
    isOpen: boolean;
    label: string;
    value: string;
    formula: string;
    records: any[];
  }>({
    isOpen: false,
    label: '',
    value: '',
    formula: '',
    records: [],
  });

  // Global Activity Audit Logger
  const logAuditEvent = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today';
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp,
      branch: entry.branch || currentBranch,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  // Global Keyboard Shortcuts (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsAiDrawerOpen(false);
        setIsNewShipmentOpen(false);
        setIsNewQuoteOpen(false);
        setIsNewPartnerOpen(false);
        setIsNewLeadOpen(false);
        setIsAuditModalOpen(false);
        setIsAutomatedDocOpen(false);
        setSelectedShipmentDetail(null);
        setSelectedCompetitorDetail(null);
        setExplainModalData((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Automated Document Generation Triggered on Shipment Creation
  const handleAddShipment = (newShipment: Shipment) => {
    setShipments((prev) => [newShipment, ...prev]);

    // Automated Document Generator Engine
    const generatedDocs = generateStandardizedDocuments(newShipment, 'Initial Booking Lifecycle Trigger');

    // Global Activity Audit Log
    logAuditEvent({
      module: 'Shipments',
      action: `Shipment ${newShipment.jobNo} created; 3 compliance documents generated`,
      actionType: 'CREATE',
      user: `Logged in as ${currentRole.toUpperCase()}`,
      recordRef: newShipment.jobNo,
      details: `Automated generator issued House Bill of Lading (HBL), Packing List, and Tax Commercial Invoice.`,
      severity: 'info',
      branch: currentBranch,
      complianceReason: 'UAE Port & Customs mandatory documentation mandate',
      diffs: [{ field: 'status', oldValue: 'null', newValue: newShipment.status }],
    });

    // User Notification
    setAutoDocToast({
      message: `Automated Document Generator: Standardized HBL, Packing List & Commercial Invoice generated for ${newShipment.jobNo}`,
      jobNo: newShipment.jobNo,
      docs: generatedDocs,
    });
    setTimeout(() => {
      setAutoDocToast((curr) => (curr?.jobNo === newShipment.jobNo ? null : curr));
    }, 7000);
  };

  const handleAddQuote = (newQuote: Quote) => {
    setQuotes((prev) => [newQuote, ...prev]);
    logAuditEvent({
      module: 'Sales RFQ',
      action: `Commercial Quote ${newQuote.quoteNo} drafted for ${newQuote.customer}`,
      actionType: 'CREATE',
      user: `Logged in as ${currentRole.toUpperCase()}`,
      recordRef: newQuote.quoteNo,
      details: `Sell price: AED ${newQuote.sellPrice.toLocaleString()} with ${newQuote.marginPercent}% gross margin.`,
      severity: newQuote.marginPercent < 18 ? 'warning' : 'info',
      branch: currentBranch,
      complianceReason: 'Company commercial pricing policy',
      diffs: [{ field: 'sellPrice', oldValue: 0, newValue: newQuote.sellPrice }],
    });
  };

  const handleAddPartner = (newPartner: Partner) => {
    setPartners((prev) => [newPartner, ...prev]);
    logAuditEvent({
      module: 'Partners',
      action: `New Partner ${newPartner.name} registered (${newPartner.category})`,
      actionType: 'CREATE',
      user: `Logged in as ${currentRole.toUpperCase()}`,
      recordRef: newPartner.trn,
      details: `Credit limit: AED ${newPartner.creditLimit.toLocaleString()}, terms: ${newPartner.paymentTerms}.`,
      severity: 'info',
      branch: currentBranch,
      complianceReason: 'KYC & Trade License verification protocol',
    });
  };

  const handleAddDeal = (newDeal: Deal) => {
    setDeals((prev) => [newDeal, ...prev]);
    logAuditEvent({
      module: 'Sales RFQ',
      action: `Sales Lead ${newDeal.title} logged for ${newDeal.customer}`,
      actionType: 'CREATE',
      user: `Logged in as ${currentRole.toUpperCase()}`,
      recordRef: newDeal.id,
      details: `Estimated Value: AED ${newDeal.value.toLocaleString()} (${newDeal.priority.toUpperCase()} priority).`,
      severity: 'info',
      branch: currentBranch,
    });
  };

  // Automated Document Generation Triggered on Quote Acceptance Conversion
  const handleConvertQuoteToShipment = (quote: Quote) => {
    const convertedShipment: Shipment = {
      id: `job-${Date.now()}`,
      jobNo: `DB-${Math.floor(1055 + Math.random() * 50)}`,
      customer: quote.customer,
      shipper: quote.customer,
      consignee: 'Designated Consignee LLC',
      service: `${quote.mode} Executed Booking`,
      mode: quote.mode,
      direction: 'Export',
      origin: quote.lane.split('→')[0].trim(),
      originPortCode: 'AEJEA',
      destination: quote.lane.split('→')[1]?.trim() || 'Destination Port',
      destPortCode: 'INTL',
      status: 'booked',
      health: 'ok',
      eta: 'In 14 days',
      etd: 'Today',
      freeTimeEnds: '5 days from discharge',
      carrier: 'Carrier Allocated',
      containerOrAwb: 'Allocated upon Gate-in',
      piecesWeight: quote.equipment,
      revenue: quote.sellPrice,
      cost: quote.buyCost,
      margin: quote.marginPercent,
      owner: quote.owner,
      progressPercent: 10,
      branch: currentBranch,
      milestones: [
        {
          id: `m-${Date.now()}`,
          title: `Converted from Accepted Quote ${quote.quoteNo}`,
          location: 'Dubai HQ',
          timestamp: 'Just now',
          status: 'completed',
          verifiedBy: 'Sales Conversion',
        },
        {
          id: `m-${Date.now() + 1}`,
          title: 'Carrier Booking Dispatch',
          location: 'Dubai HQ',
          timestamp: 'Scheduled Today',
          status: 'in_progress',
        },
      ],
      documents: [
        {
          id: `d-${Date.now()}`,
          name: `Accepted Quote (${quote.quoteNo}.pdf)`,
          type: 'Commercial Invoice',
          status: 'verified',
          version: 'v1.0',
          uploadedAt: 'Today',
          confidenceScore: 1.0,
          source: 'customer',
        },
      ],
    };

    setShipments((prev) => [convertedShipment, ...prev]);
    setQuotes((prev) =>
      prev.map((q) => (q.id === quote.id ? { ...q, status: 'won' } : q))
    );

    // Automated Document Generation on Conversion
    const generatedDocs = generateStandardizedDocuments(
      convertedShipment,
      `Quote Acceptance Conversion (${quote.quoteNo})`
    );

    // Activity Audit Log
    logAuditEvent({
      module: 'Booking',
      action: `Quote ${quote.quoteNo} converted to Live Job ${convertedShipment.jobNo}; 3 compliance docs auto-generated`,
      actionType: 'AUTO_GENERATE',
      user: `Logged in as ${currentRole.toUpperCase()}`,
      recordRef: convertedShipment.jobNo,
      details: `Client accepted commercial offer. Automated generator created House Bill of Lading, Certified Packing List, and Tax Commercial Invoice.`,
      severity: 'info',
      branch: currentBranch,
      complianceReason: 'Sales-to-Operations Contractual handoff protocol',
      diffs: [{ field: 'lifecycleStage', oldValue: 'quote_proposal', newValue: 'job_booked' }],
    });

    setAutoDocToast({
      message: `Automated Document Generator: Standardized HBL, Packing List & Commercial Invoice generated for ${convertedShipment.jobNo}`,
      jobNo: convertedShipment.jobNo,
      docs: generatedDocs,
    });
    setTimeout(() => {
      setAutoDocToast((curr) => (curr?.jobNo === convertedShipment.jobNo ? null : curr));
    }, 7000);
  };

  const handleOpenExplainModal = (
    label: string,
    value: string,
    formula: string,
    records: any[]
  ) => {
    setExplainModalData({
      isOpen: true,
      label,
      value,
      formula,
      records,
    });
  };

  const handleSelectShipmentByJobNo = (jobNo: string) => {
    const found = shipments.find((s) => s.jobNo === jobNo);
    if (found) {
      setSelectedShipmentDetail(found);
    }
  };

  const handleOpenAutomatedDocsForShipment = (s: Shipment) => {
    const docs = generateStandardizedDocuments(s, `Lifecycle Status: ${s.status.toUpperCase()}`);
    setActiveAutomatedDocs(docs);
    setActiveAutomatedJobNo(s.jobNo);
    setIsAutomatedDocOpen(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        currentRole={currentRole}
        pendingApprovals={pendingApprovalsCount}
      />

      {/* Main Content Pane */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 relative">
        {/* Top Navbar */}
        <Header
          currentRole={currentRole}
          onRoleChange={(r) => {
            setCurrentRole(r);
            if (r === 'driver') setCurrentView('driverapp');
            if (r === 'customs') setCurrentView('customs');
            if (r === 'finance') setCurrentView('invoices');
            if (r === 'sales') setCurrentView('pipeline');
            if (r === 'ops') setCurrentView('shipments');
            if (r === 'hr') setCurrentView('payroll');
            if (r === 'customer') setCurrentView('customerportal');
            if (r === 'warehouse') setCurrentView('warehouse');
            if (r === 'owner') setCurrentView('dashboard');
            if (r === 'admin') setCurrentView('settings');
          }}
          currentBranch={currentBranch}
          onBranchChange={setCurrentBranch}
          isSimpleMode={isSimpleMode}
          onToggleMode={() => setIsSimpleMode(!isSimpleMode)}
          onOpenNewModal={() => setIsNewShipmentOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenAiDrawer={() => setIsAiDrawerOpen(true)}
          onOpenApprovals={() => setCurrentView('approvals')}
          pendingApprovalsCount={pendingApprovalsCount}
          onOpenActivityAudit={() => setIsAuditModalOpen(true)}
          auditEventsCount={auditLogs.length}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
        />

        {/* Real-time Automated Document Generation Toast */}
        {autoDocToast && (
          <div className="absolute top-16 right-6 z-40 max-w-md rounded-2xl border border-orange-200 bg-white p-3.5 shadow-xl animate-in slide-in-from-top-3 duration-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-[#E8472B]">
                <FileText className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <span className="font-extrabold text-slate-900 block">
                  Automated Document Generator
                </span>
                <span className="text-[11px] text-slate-600 line-clamp-1">
                  HBL, Packing List & Commercial Invoice generated for {autoDocToast.jobNo}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setActiveAutomatedDocs(autoDocToast.docs);
                  setActiveAutomatedJobNo(autoDocToast.jobNo);
                  setIsAutomatedDocOpen(true);
                  setAutoDocToast(null);
                }}
                className="flex items-center gap-1 rounded-xl bg-[#E8472B] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#D13B20] transition shadow-xs"
              >
                <span>View</span>
                <ArrowRight className="h-3 w-3" />
              </button>
              <button
                onClick={() => setAutoDocToast(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* View Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 max-w-[1700px] w-full mx-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              currentRole={currentRole}
              currentBranch={currentBranch}
              shipments={shipments}
              quotes={quotes}
              pendingApprovalsCount={pendingApprovalsCount}
              onSelectShipment={setSelectedShipmentDetail}
              onOpenExplainModal={handleOpenExplainModal}
              onNavigateView={setCurrentView}
            />
          )}

          {currentView === 'shipments' && (
            <ShipmentsView
              shipments={shipments}
              onSelectShipment={setSelectedShipmentDetail}
              onOpenNewModal={() => setIsNewShipmentOpen(true)}
              currentRole={currentRole}
              onOpenAutomatedDocs={handleOpenAutomatedDocsForShipment}
            />
          )}

          {currentView === 'fleet' && <FleetView />}

          {currentView === 'pipeline' && (
            <PipelineView
              onOpenNewQuote={() => setIsNewQuoteOpen(true)}
              onOpenNewLead={() => setIsNewLeadOpen(true)}
            />
          )}

          {currentView === 'quotes' && (
            <QuotesView
              quotes={quotes}
              onOpenNewQuote={() => setIsNewQuoteOpen(true)}
              onConvertQuoteToShipment={handleConvertQuoteToShipment}
            />
          )}

          {currentView === 'internalquote' && <InternalQuoteView />}

          {currentView === 'partners' && (
            <PartnersView
              onOpenNewPartnerModal={() => setIsNewPartnerOpen(true)}
              onOpenNewQuoteForCustomer={(cust) => setIsNewQuoteOpen(true)}
            />
          )}

          {currentView === 'customs' && (
            <CustomsView
              onNavigateToCompliance={() => setCurrentView('complianceaudit')}
            />
          )}

          {currentView === 'complianceaudit' && <ComplianceAuditView />}

          {currentView === 'warehouse' && <WarehouseView />}

          {currentView === 'docstatus' && <DocumentStatusView />}

          {currentView === 'utilities' && <UtilitiesView />}

          {currentView === 'invoices' && <FinanceView defaultTab="invoices" />}
          {currentView === 'receipts' && <ReceiptsView />}
          {currentView === 'bills' && <VendorBillsView />}
          {currentView === 'jobcosting' && <FinanceView defaultTab="costing" />}
          {currentView === 'finance' && <FinanceView defaultTab="cashflow" />}
          {currentView === 'vat' && <FinanceView defaultTab="vat" />}
          {currentView === 'einvoice' && <FinanceView defaultTab="einvoice" />}
          {currentView === 'velocity' && <FinanceView defaultTab="velocity" />}

          {currentView === 'payroll' && <HRMSView mode="payroll" />}
          {currentView === 'hrms' && <HRMSView mode="staff" />}

          {currentView === 'driverapp' && <DriverAppView />}
          {currentView === 'docintel' && <DocIntelView />}
          {currentView === 'lifecycle' && <LifecycleView />}
          {currentView === 'settings' && (
            <SettingsView
              isDarkMode={isDarkMode}
              onToggleDarkMode={handleToggleDarkMode}
            />
          )}
          {currentView === 'inbox' && <UnifiedInboxView />}
          {currentView === 'approvals' && <ApprovalsView />}
          {currentView === 'customerportal' && <CustomerPortalView />}
        </main>
      </div>

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectShipment={handleSelectShipmentByJobNo}
      />

      <AIDrawer isOpen={isAiDrawerOpen} onClose={() => setIsAiDrawerOpen(false)} />

      <NewShipmentModal
        isOpen={isNewShipmentOpen}
        onClose={() => setIsNewShipmentOpen(false)}
        onAddShipment={handleAddShipment}
        isSimpleMode={isSimpleMode}
        onToggleMode={() => setIsSimpleMode(!isSimpleMode)}
      />

      <NewQuoteModal
        isOpen={isNewQuoteOpen}
        onClose={() => setIsNewQuoteOpen(false)}
        onAddQuote={handleAddQuote}
      />

      <NewPartnerModal
        isOpen={isNewPartnerOpen}
        onClose={() => setIsNewPartnerOpen(false)}
        onAddPartner={handleAddPartner}
      />

      <NewLeadModal
        isOpen={isNewLeadOpen}
        onClose={() => setIsNewLeadOpen(false)}
        onAddDeal={handleAddDeal}
      />

      <ShipmentDetailModal
        shipment={selectedShipmentDetail}
        onClose={() => setSelectedShipmentDetail(null)}
        currentRole={currentRole}
        onApproveAction={(action) => {
          setPendingApprovalsCount((c) => Math.max(0, c - 1));
          if (selectedShipmentDetail) {
            logAuditEvent({
              module: 'Shipments',
              action: `Action approved for ${selectedShipmentDetail.jobNo}: ${action}`,
              actionType: 'APPROVE',
              user: `Logged in as ${currentRole.toUpperCase()}`,
              recordRef: selectedShipmentDetail.jobNo,
              details: `Supervisor approved action "${action}". Operational progression unblocked.`,
              severity: 'info',
              branch: currentBranch,
              complianceReason: 'Standard Operational Approval Protocol',
            });
          }
        }}
      />

      <CompetitorDetailModal
        competitor={selectedCompetitorDetail}
        onClose={() => setSelectedCompetitorDetail(null)}
      />

      <ExplainNumberModal
        isOpen={explainModalData.isOpen}
        onClose={() => setExplainModalData((prev) => ({ ...prev, isOpen: false }))}
        metricLabel={explainModalData.label}
        metricValue={explainModalData.value}
        explanationFormula={explainModalData.formula}
        contributingRecords={explainModalData.records}
      />

      {/* Global Activity Audit History Modal */}
      <ActivityAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        auditLogs={auditLogs}
      />

      {/* Automated Generated Documents Viewer Modal */}
      <AutomatedDocumentModal
        isOpen={isAutomatedDocOpen}
        onClose={() => setIsAutomatedDocOpen(false)}
        documents={activeAutomatedDocs}
        currentJobNo={activeAutomatedJobNo}
      />
    </div>
  );
}
