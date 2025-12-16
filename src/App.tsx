import { Toaster } from "@/components/ui/toaster";
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
import CompanyHierarchy from "./pages/CompanyHierarchy";
import TransactionStatistics from "./pages/TransactionStatistics";
import Index from "./pages/Index";
import UserLogins from "./pages/UserLogins";
import SupplierSetup from "./pages/SupplierSetup";

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
              <Route path="/tawasoul" element={<Tawasoul />} />
              <Route path="/closing-training" element={<ClosingTraining />} />
              <Route path="/currency-setup" element={<CurrencySetup />} />
              <Route path="/user-group-setup" element={<UserGroupSetup />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/projects-tasks" element={<ProjectsTasks />} />
              <Route path="/task-dashboard" element={<TaskDashboard />} />
              <Route path="/company-hierarchy" element={<CompanyHierarchy />} />
              <Route path="/user-logins" element={<UserLogins />} />
              <Route path="/supplier-setup" element={<SupplierSetup />} />
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
