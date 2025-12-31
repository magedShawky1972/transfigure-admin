-- Create document_types table
CREATE TABLE public.document_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_name VARCHAR(100) NOT NULL,
  type_name_ar VARCHAR(100),
  is_mandatory BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employee_documents table
CREATE TABLE public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES public.document_types(id),
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  expiry_date DATE,
  notes TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_types
CREATE POLICY "Allow authenticated users to read document_types"
ON public.document_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert document_types"
ON public.document_types FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update document_types"
ON public.document_types FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete document_types"
ON public.document_types FOR DELETE TO authenticated USING (true);

-- RLS policies for employee_documents
CREATE POLICY "Allow authenticated users to read employee_documents"
ON public.employee_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert employee_documents"
ON public.employee_documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update employee_documents"
ON public.employee_documents FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete employee_documents"
ON public.employee_documents FOR DELETE TO authenticated USING (true);

-- Create storage buckets for employee files
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-photos', 'employee-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', false);

-- Storage policies for employee-photos (public read, authenticated write)
CREATE POLICY "Public can view employee photos"
ON storage.objects FOR SELECT USING (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can upload employee photos"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can update employee photos"
ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can delete employee photos"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'employee-photos');

-- Storage policies for employee-documents (authenticated only)
CREATE POLICY "Authenticated users can view employee documents"
ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'employee-documents');

CREATE POLICY "Authenticated users can upload employee documents"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'employee-documents');

CREATE POLICY "Authenticated users can update employee documents"
ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'employee-documents');

CREATE POLICY "Authenticated users can delete employee documents"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'employee-documents');

-- Create triggers for updated_at
CREATE TRIGGER update_document_types_updated_at
BEFORE UPDATE ON public.document_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_documents_updated_at
BEFORE UPDATE ON public.employee_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default document types
INSERT INTO public.document_types (type_name, type_name_ar, is_mandatory) VALUES
('National ID', 'الهوية الوطنية', true),
('Passport', 'جواز السفر', false),
('Work Contract', 'عقد العمل', true),
('Educational Certificate', 'الشهادة التعليمية', false),
('Medical Certificate', 'الشهادة الطبية', false),
('Bank Account Details', 'تفاصيل الحساب البنكي', true);