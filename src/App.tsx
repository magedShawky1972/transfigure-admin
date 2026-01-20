import { Toaster } from "@/components/ui/toaster";
import DocumentTypeSetup from "./pages/DocumentTypeSetup";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import { LanguageProvider } from "./contexts/LanguageContext";
import Dashboard from "./pages/Dashboard";
import ExcelSheets from "./pages/ExcelSheets";
import ApiDocumentation from "./pages/ApiDocumentation";
import TableGenerator from "./pages/TableGenerator";
import Reports from "./pages/Reports";
import ReportsSetup from "./pages/ReportsSetup";
import RevenueByBrandType from "./pages/RevenueByBrandType";
import CostByBrandType from "./pages/CostByBrandType";
import TicketsReport from "./pages/TicketsReport";
import SoftwareLicensesReport from "./pages/SoftwareLicensesReport";
import LoadData from "./pages/LoadData";
import UploadLog from "./pages/UploadLog";
import ClearData from "./pages/ClearData";
import Transactions from "./pages/Transactions";
import UserSetup from "./pages/UserSetup";
import CustomerSetup from "./pages/CustomerSetup";
import CustomerProfile from "./pages/CustomerProfile";
import CustomerTotals from "./pages/CustomerTotals";
import BrandSetup from "./pages/BrandSetup";
import BrandEdit from "./pages/BrandEdit";
import BrandType from "./pages/BrandType";
import ProductSetup from "./pages/ProductSetup";
import ProductDetails from "./pages/ProductDetails";
import PaymentMethodSetup from "./pages/PaymentMethodSetup";
import PivotTable from "./pages/PivotTable";
import OdooSetup from "./pages/OdooSetup";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Tickets from "./pages/Tickets";
import TicketDetails from "./pages/TicketDetails";
import AdminTickets from "./pages/AdminTickets";
import DepartmentManagement from "./pages/DepartmentManagement";
import TicketDashboard from "./pages/TicketDashboard";
import SoftwareLicenses from "./pages/SoftwareLicenses";
import SoftwareLicenseSetup from "./pages/SoftwareLicenseSetup";
import SystemConfig from "./pages/SystemConfig";
import ShiftSetup from "./pages/ShiftSetup";
import ShiftCalendar from "./pages/ShiftCalendar";
import ShiftReport from "./pages/ShiftReport";
import ShiftPlanReport from "./pages/ShiftPlanReport";
import BrandBalanceReport from "./pages/BrandBalanceReport";
import ShiftSession from "./pages/ShiftSession";
import ShiftFollowUp from "./pages/ShiftFollowUp";
import ShiftDashboard from "./pages/ShiftDashboard";
import MyShiftsCalendar from "./pages/MyShiftsCalendar";
import Tawasoul from "./pages/Tawasoul";
import ClosingTraining from "./pages/ClosingTraining";
import CurrencySetup from "./pages/CurrencySetup";
import UserGroupSetup from "./pages/UserGroupSetup";
import Notifications from "./pages/Notifications";
import ProjectsTasks from "./pages/ProjectsTasks";
import TaskDashboard from "./pages/TaskDashboard";
import UserDashboard from "./pages/UserDashboard";
import CompanyHierarchy from "./pages/CompanyHierarchy";
import TransactionStatistics from "./pages/TransactionStatistics";
import Index from "./pages/Index";
import UserLogins from "./pages/UserLogins";
import SupplierSetup from "./pages/SupplierSetup";
import UserEmails from "./pages/UserEmails";
import AsusTawasoul from "./pages/AsusTawasoul";
import EmailManager from "./pages/EmailManager";
import MailSetup from "./pages/MailSetup";
import CompanyNews from "./pages/CompanyNews";
import PdfToExcel from "./pages/PdfToExcel";
import OrderPaymentReport from "./pages/OrderPaymentReport";
import DataLoadingStatus from "./pages/DataLoadingStatus";
import CoinsLedgerReport from "./pages/CoinsLedgerReport";
import ProjectGantt from "./pages/ProjectGantt";
import BankStatementReport from "./pages/BankStatementReport";
import BankStatementAsOf from "./pages/BankStatementAsOf";
import SystemBackup from "./pages/SystemBackup";
import SystemRestore from "./pages/SystemRestore";
import OdooSyncBatch from "./pages/OdooSyncBatch";
import OdooSyncAll from "./pages/OdooSyncAll";
import EmployeeSetup from "./pages/EmployeeSetup";
import EmployeeProfile from "./pages/EmployeeProfile";
import VacationSetup from "./pages/VacationSetup";
import TimesheetManagement from "./pages/TimesheetManagement";
import DeductionRulesSetup from "./pages/DeductionRulesSetup";
import MedicalInsuranceSetup from "./pages/MedicalInsuranceSetup";
import ShiftPlansSetup from "./pages/ShiftPlansSetup";
import AttendanceTypeSetup from "./pages/AttendanceTypeSetup";
import AuditLogs from "./pages/AuditLogs";
import JobSetup from "./pages/JobSetup";
import SecurityDashboard from "./pages/SecurityDashboard";
import CertificateManagement from "./pages/CertificateManagement";
import ZKAttendanceLogs from "./pages/ZKAttendanceLogs";
import SavedAttendance from "./pages/SavedAttendance";
import SoldProductReport from "./pages/SoldProductReport";
import OdooSyncStatusReport from "./pages/OdooSyncStatusReport";
import AggregatedOrderReport from "./pages/AggregatedOrderReport";
import HRVacationCalendar from "./pages/HRVacationCalendar";
import BankSetupPage from "./pages/BankSetup";
import TreasurySetup from "./pages/TreasurySetup";
import ExpenseCategorySetup from "./pages/ExpenseCategorySetup";
import ExpenseTypeSetup from "./pages/ExpenseTypeSetup";
import TreasuryOpeningBalance from "./pages/TreasuryOpeningBalance";
import TreasuryEntry from "./pages/TreasuryEntry";
import BankEntry from "./pages/BankEntry";
import ExpenseRequests from "./pages/ExpenseRequests";
import ExpenseReports from "./pages/ExpenseReports";
import ExpenseEntry from "./pages/ExpenseEntry";
import ExpenseEntryForm from "./pages/ExpenseEntryForm";
import PaymentBankLink from "./pages/PaymentBankLink";
import BankBalanceByDateReport from "./pages/BankBalanceByDateReport";
import BankStatementByBankReport from "./pages/BankStatementByBankReport";
import ApiIntegrationStatus from "./pages/ApiIntegrationStatus";
import ApiConsumptionLogs from "./pages/ApiConsumptionLogs";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/revenue-by-brand-type" element={<RevenueByBrandType />} />
              <Route path="/reports/cost-by-brand-type" element={<CostByBrandType />} />
              <Route path="/reports/tickets" element={<TicketsReport />} />
              <Route path="/reports/software-licenses-report" element={<SoftwareLicensesReport />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/load-data" element={<LoadData />} />
              <Route path="/upload-log" element={<UploadLog />} />
              <Route path="/clear-data" element={<ClearData />} />
              <Route path="/reports-setup" element={<ReportsSetup />} />
              <Route path="/api-documentation" element={<ApiDocumentation />} />
              <Route path="/api-integration-status" element={<ApiIntegrationStatus />} />
              <Route path="/excel-sheets" element={<ExcelSheets />} />
              <Route path="/table-generator" element={<TableGenerator />} />
              <Route path="/user-setup" element={<UserSetup />} />
              <Route path="/customer-setup" element={<CustomerSetup />} />
              <Route path="/customer-profile" element={<CustomerProfile />} />
              <Route path="/customer-totals" element={<CustomerTotals />} />
              <Route path="/brand-setup" element={<BrandSetup />} />
              <Route path="/brand-setup/edit" element={<BrandEdit />} />
              <Route path="/brand-type" element={<BrandType />} />
              <Route path="/product-setup" element={<ProductSetup />} />
              <Route path="/product-details/:id" element={<ProductDetails />} />
              <Route path="/payment-method-setup" element={<PaymentMethodSetup />} />
              <Route path="/pivot-table" element={<PivotTable />} />
              <Route path="/odoo-setup" element={<OdooSetup />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/tickets/:id" element={<TicketDetails />} />
              <Route path="/admin-tickets" element={<AdminTickets />} />
              <Route path="/ticket-dashboard" element={<TicketDashboard />} />
              <Route path="/department-management" element={<DepartmentManagement />} />
              <Route path="/software-licenses" element={<SoftwareLicenses />} />
              <Route path="/software-license-setup" element={<SoftwareLicenseSetup />} />
              <Route path="/system-config" element={<SystemConfig />} />
              <Route path="/shift-setup" element={<ShiftSetup />} />
              <Route path="/shift-calendar" element={<ShiftCalendar />} />
              <Route path="/shift-session" element={<ShiftSession />} />
              <Route path="/shift-follow-up" element={<ShiftFollowUp />} />
              <Route path="/shift-dashboard" element={<ShiftDashboard />} />
              <Route path="/my-shifts" element={<MyShiftsCalendar />} />
              <Route path="/reports/shift-report" element={<ShiftReport />} />
              <Route path="/reports/shift-plan" element={<ShiftPlanReport />} />
              <Route path="/reports/brand-balance" element={<BrandBalanceReport />} />
              <Route path="/reports/transaction-statistics" element={<TransactionStatistics />} />
              <Route path="/reports/order-payment" element={<OrderPaymentReport />} />
              <Route path="/reports/data-loading-status" element={<DataLoadingStatus />} />
              <Route path="/reports/coins-ledger" element={<CoinsLedgerReport />} />
              <Route path="/reports/bank-statement" element={<BankStatementReport />} />
              <Route path="/reports/bank-statement-as-of" element={<BankStatementAsOf />} />
              <Route path="/reports/security-dashboard" element={<SecurityDashboard />} />
              <Route path="/security-dashboard" element={<SecurityDashboard />} />
              <Route path="/tawasoul" element={<Tawasoul />} />
              <Route path="/closing-training" element={<ClosingTraining />} />
              <Route path="/currency-setup" element={<CurrencySetup />} />
              <Route path="/user-group-setup" element={<UserGroupSetup />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/projects-tasks" element={<ProjectsTasks />} />
              <Route path="/project-gantt" element={<ProjectGantt />} />
              <Route path="/task-dashboard" element={<TaskDashboard />} />
              <Route path="/user-dashboard" element={<UserDashboard />} />
              <Route path="/company-hierarchy" element={<CompanyHierarchy />} />
              <Route path="/user-logins" element={<UserLogins />} />
              <Route path="/supplier-setup" element={<SupplierSetup />} />
              <Route path="/user-emails" element={<UserEmails />} />
              <Route path="/asus-tawasoul" element={<AsusTawasoul />} />
              <Route path="/email-manager" element={<EmailManager />} />
              <Route path="/mail-setup" element={<MailSetup />} />
              <Route path="/company-news" element={<CompanyNews />} />
              <Route path="/pdf-to-excel" element={<PdfToExcel />} />
              <Route path="/system-backup" element={<SystemBackup />} />
              <Route path="/system-restore" element={<SystemRestore />} />
              <Route path="/odoo-sync-batch" element={<OdooSyncBatch />} />
              <Route path="/odoo-sync-all" element={<OdooSyncAll />} />
              <Route path="/employee-setup" element={<EmployeeSetup />} />
              <Route path="/employee-profile/:id" element={<EmployeeProfile />} />
              <Route path="/vacation-setup" element={<VacationSetup />} />
              <Route path="/timesheet-management" element={<TimesheetManagement />} />
              <Route path="/deduction-rules-setup" element={<DeductionRulesSetup />} />
              <Route path="/medical-insurance-setup" element={<MedicalInsuranceSetup />} />
              <Route path="/shift-plans-setup" element={<ShiftPlansSetup />} />
              <Route path="/document-type-setup" element={<DocumentTypeSetup />} />
              <Route path="/attendance-type-setup" element={<AttendanceTypeSetup />} />
              <Route path="/job-setup" element={<JobSetup />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/certificate-management" element={<CertificateManagement />} />
              <Route path="/zk-attendance-logs" element={<ZKAttendanceLogs />} />
              <Route path="/saved-attendance" element={<SavedAttendance />} />
              <Route path="/reports/sold-product" element={<SoldProductReport />} />
              <Route path="/reports/odoo-sync-status" element={<OdooSyncStatusReport />} />
              <Route path="/reports/aggregated-orders" element={<AggregatedOrderReport />} />
              <Route path="/hr-vacation-calendar" element={<HRVacationCalendar />} />
              <Route path="/bank-setup" element={<BankSetupPage />} />
              <Route path="/treasury-setup" element={<TreasurySetup />} />
              <Route path="/expense-category-setup" element={<ExpenseCategorySetup />} />
              <Route path="/expense-type-setup" element={<ExpenseTypeSetup />} />
              <Route path="/treasury-opening-balance" element={<TreasuryOpeningBalance />} />
              <Route path="/treasury-entry" element={<TreasuryEntry />} />
              <Route path="/bank-entry" element={<BankEntry />} />
              <Route path="/expense-requests" element={<ExpenseRequests />} />
              <Route path="/expense-reports" element={<ExpenseReports />} />
              <Route path="/expense-entry" element={<ExpenseEntry />} />
              <Route path="/expense-entry/new" element={<ExpenseEntryForm />} />
              <Route path="/expense-entry/:id" element={<ExpenseEntryForm />} />
              <Route path="/payment-bank-link" element={<PaymentBankLink />} />
              <Route path="/reports/bank-balance-by-date" element={<BankBalanceByDateReport />} />
              <Route path="/reports/bank-statement-by-bank" element={<BankStatementByBankReport />} />
              <Route path="/api-consumption-logs" element={<ApiConsumptionLogs />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
