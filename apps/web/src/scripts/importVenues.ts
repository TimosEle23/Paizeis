// Script to import Cyprus venues from CSV into Supabase
import { supabase } from "@/integrations/supabase/client";

interface VenueRow {
  City: string;
  Venue: string;
  "Address/Area": string;
  "Pitch Types": string;
  "Booking Method": string;
  "Phone/Link": string;
}

const parsePitchTypes = (pitchTypesStr: string): { type: string; count: number }[] => {
  const types: { type: string; count: number }[] = [];
  
  // Handle different formats like "4×Futsal", "2×9×9 & 5×5", "1×9×9 + 3×5×5 + padel"
  const segments = pitchTypesStr.split(/[&+,]/).map(s => s.trim());
  
  segments.forEach(segment => {
    // Match patterns like "4×Futsal", "2×5×5", "Multiple 5×5"
    const match = segment.match(/(\d+)?×?(5×5|7×7|9×9|11×11|Futsal|mini-football|padel)/i);
    
    if (match) {
      const count = match[1] ? parseInt(match[1]) : 1;
      let type = match[2].toLowerCase();
      
      // Normalize types
      if (type.includes('5×5') || type.includes('5x5')) type = '5v5';
      else if (type.includes('7×7') || type.includes('7x7')) type = '7v7';
      else if (type.includes('9×9') || type.includes('9x9')) type = '9v9';
      else if (type.includes('11×11') || type.includes('11x11')) type = '11v11';
      else if (type === 'futsal' || type === 'mini-football') type = '5v5'; // Default futsal to 5v5
      else if (type === 'padel') type = 'paddle';
      
      types.push({ type, count });
    }
  });
  
  return types.length > 0 ? types : [{ type: '5v5', count: 1 }]; // Default
};

export const importCyprusVenues = async () => {
  try {
    const csvData = await fetch('/src/data/cyprus_venues.csv').then(r => r.text());
    const lines = csvData.split('\n').slice(1); // Skip header
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split(',');
      if (parts.length < 6) continue;
      
      const city = parts[0].trim();
      const venueName = parts[1].trim();
      const address = parts[2].trim();
      const pitchTypes = parts[3].trim();
      const bookingMethod = parts[4].trim();
      const phoneLink = parts[5].trim();
      
      // Insert venue
      const { data: venue, error: venueError } = await supabase
        .from('venues')
        .insert({
          name: venueName,
          location: address,
          city: city,
          phone: phoneLink.includes('+357') ? phoneLink : null,
          website: phoneLink.includes('http') || phoneLink.includes('.com') ? phoneLink : null,
          booking_method: bookingMethod,
        })
        .select()
        .single();
      
      if (venueError) {
        console.error('Error inserting venue:', venueName, venueError);
        continue;
      }
      
      // Parse and insert pitches
      const pitches = parsePitchTypes(pitchTypes);
      for (const pitch of pitches) {
        for (let i = 0; i < pitch.count; i++) {
          await supabase.from('pitches').insert({
            venue_id: venue.id,
            name: `${pitch.type.toUpperCase()} Pitch ${i + 1}`,
            pitch_type: pitch.type,
            price_per_hour: pitch.type === 'paddle' ? 15 : 45, // Default pricing
            is_available: true,
          });
        }
      }
    }
    
    console.log('Import completed successfully!');
  } catch (error) {
    console.error('Import failed:', error);
  }
};
