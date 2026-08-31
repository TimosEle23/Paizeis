-- Add Google rating columns to venues table
ALTER TABLE public.venues 
ADD COLUMN google_rating NUMERIC(2,1),
ADD COLUMN google_reviews_count INTEGER;