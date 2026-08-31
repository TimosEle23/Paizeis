-- Add futsal and paddle image columns to venues table
ALTER TABLE public.venues 
ADD COLUMN futsal_image_url text,
ADD COLUMN paddle_image_url text;

-- Update Fair Game Sport Center with both image URLs
UPDATE public.venues 
SET 
  futsal_image_url = '/images/venues/fair-game-sports.jpg',
  paddle_image_url = '/images/venues/fair-game-paddle.jpg'
WHERE name = 'Fair Game Sport Center';