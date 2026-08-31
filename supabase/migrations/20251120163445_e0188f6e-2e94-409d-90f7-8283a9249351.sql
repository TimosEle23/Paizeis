-- Update pitch_type constraint to allow all types
ALTER TABLE public.pitches DROP CONSTRAINT IF EXISTS pitches_pitch_type_check;

ALTER TABLE public.pitches
ADD CONSTRAINT pitches_pitch_type_check 
CHECK (pitch_type IN ('5v5', '7v7', '9v9', '11v11', 'paddle'));