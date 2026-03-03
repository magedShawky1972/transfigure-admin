
-- Fix vacation_requests.created_by to reference profiles instead of auth.users
ALTER TABLE public.vacation_requests DROP CONSTRAINT vacation_requests_created_by_fkey;
ALTER TABLE public.vacation_requests ADD CONSTRAINT vacation_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(user_id);
