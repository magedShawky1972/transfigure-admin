UPDATE public.upload_logs 
SET status = 'completed',
    records_processed = 1000,
    total_value = 387730.83
WHERE id = '041ae37e-a2dd-499f-a9ba-e2337e005589' AND status = 'processing';