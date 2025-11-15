import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import { LanguageProvider } from "./contexts/LanguageContext";
import Dashboard from "./pages/Dashboard";
import ExcelSheets from "./pages/ExcelSheets";
import ApiConfig from "./pages/ApiConfig";
import TableGenerator from "./pages/TableGenerator";
import Reports from "./pages/Reports";
import ReportsSetup from "./pages/ReportsSetup";
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
              <Route path="/" element={<Dashboard />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/load-data" element={<LoadData />} />
              <Route path="/upload-log" element={<UploadLog />} />
              <Route path="/clear-data" element={<ClearData />} />
              <Route path="/reports-setup" element={<ReportsSetup />} />
              <Route path="/api-config" element={<ApiConfig />} />
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
