import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Star, Phone, Navigation } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import venuesBackground from "@/assets/futsal_18.mp4.asset.json";
import VenuesMap from "@/components/VenuesMap";

const Venues = () => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedSportCategory, setSelectedSportCategory] = useState<string | null>(null);
  const [selectedFutsalType, setSelectedFutsalType] = useState<string | null>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location not supported on this device");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortByDistance(true);
        setLocating(false);
      },
      () => {
        setLocationError("Could not get your location");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const distanceKm = (venue: any) => {
    if (!userPos || venue.latitude == null || venue.longitude == null) return null;
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(venue.latitude - userPos.lat);
    const dLng = toRad(venue.longitude - userPos.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(userPos.lat)) * Math.cos(toRad(venue.latitude)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Handle filter from URL query parameter
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      if (['5v5', '7v7', '9v9', '11v11'].includes(lowerFilter)) {
        setSelectedSportCategory('Futsal');
        setSelectedFutsalType(filter.toUpperCase() === '5V5' ? '5v5' : filter.toUpperCase() === '7V7' ? '7v7' : filter.toUpperCase() === '9V9' ? '9v9' : '11v11');
      }
    }
  }, [searchParams]);

  useEffect(() => {
    fetchVenues();
  }, []);
  const fetchVenues = async () => {
    setLoading(true);
    const {
      data,
      error
    } = await supabase.from('venues').select(`
        *,
        pitches(pitch_type, price_per_hour, is_available)
      `);
    if (data) {
      setVenues(data);
    }
    setLoading(false);
  };
  const cities = ["Nicosia", "Limassol", "Larnaca", "Paphos"];
  const sportCategories = ["Futsal"];
  const futsalTypes = ["5v5", "7v7", "9v9", "11v11"];
  const getAvailableSports = (pitches: any[]) => {
    if (!pitches || pitches.length === 0) return ["5v5"];
    const availablePitches = pitches.filter(p => p.is_available && futsalTypes.includes(p.pitch_type));
    return [...new Set(availablePitches.map(p => p.pitch_type))];
  };
  const getMinPrice = (pitches: any[]) => {
    if (!pitches || pitches.length === 0) return 45;
    const availablePitches = pitches.filter(p => p.is_available);
    if (availablePitches.length === 0) return 45;
    return Math.min(...availablePitches.map(p => p.price_per_hour));
  };
  const lowerFutsalTypes = futsalTypes.map(t => t.toLowerCase());
  const hasFutsalPitch = (venue: any) => Array.isArray(venue.pitches) && venue.pitches.some((p: any) => lowerFutsalTypes.includes((p.pitch_type || "").toLowerCase()));
  const filteredVenues = venues.filter(venue => {
    const matchesSearch = venue.name.toLowerCase().includes(searchQuery.toLowerCase()) || venue.location.toLowerCase().includes(searchQuery.toLowerCase()) || venue.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = !selectedCity || venue.city === selectedCity;

    // Padel is hidden for now: only venues offering futsal pitches are listed
    if (!hasFutsalPitch(venue)) return false;

    let matchesSport = true;
    if (selectedFutsalType) {
      matchesSport = venue.pitches.some((p: any) => (p.pitch_type || "").toLowerCase() === selectedFutsalType.toLowerCase() && p.is_available);
    }

    return matchesSearch && matchesCity && matchesSport;
  });
  const sortedVenues = sortByDistance && userPos ? [...filteredVenues].sort((a, b) => {
    const da = distanceKm(a);
    const db = distanceKm(b);
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db;
  }) : filteredVenues;
  return <div className="min-h-screen bg-background relative">
      <Navbar />

      <div className="relative pt-24 pb-16 min-h-screen overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <video
            src={venuesBackground.url}
            autoPlay
            loop
            muted
            playsInline
            className="absolute top-1/2 left-1/2 min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        <div className="relative container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-bold mb-4 text-2xl font-mono text-center text-white drop-shadow-lg">​All fields in the city!      </h1>
            <p className="text-white/80 font-mono">
              Browse {venues.length} available pitches and courts across Cyprus
            </p>
          </div>


          {/* Search and Filters */}
          <div className="mb-8 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/60" />
              <Input placeholder="Search by venue name, location, or city..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-black/40 border-white/20 text-white placeholder:text-white/50" />
            </div>

            {/* Distance / Nearest Filter */}
            <div>
              <h3 className="text-sm font-semibold mb-2 font-mono text-white">Sort</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={!sortByDistance ? "default" : "outline"} size="sm" onClick={() => setSortByDistance(false)} className="font-mono">
                  All Fields
                </Button>
                <Button
                  variant={sortByDistance ? "default" : "outline"}
                  size="sm"
                  className="font-mono gap-1"
                  disabled={locating}
                  onClick={() => (userPos ? setSortByDistance(true) : requestLocation())}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  {locating ? "Locating..." : "Closest to me"}
                </Button>
                {locationError && <span className="text-xs font-mono text-destructive">{locationError}</span>}
              </div>
            </div>

            {/* City Filter */}
            <div>
              <h3 className="text-sm font-semibold mb-2 font-mono text-white">Filter by City</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant={selectedCity === null ? "default" : "outline"} size="sm" onClick={() => setSelectedCity(null)} className="font-mono">
                  All Cities
                </Button>
                {cities.map(city => <Button key={city} variant={selectedCity === city ? "default" : "outline"} size="sm" onClick={() => setSelectedCity(city)}>
                    {city}
                  </Button>)}
              </div>
            </div>

            {/* Sport Filter */}
            <div>
              <h3 className="text-sm font-semibold mb-2 font-mono text-white">Filter by Pitch Type</h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={selectedSportCategory === null ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => {
                    setSelectedSportCategory(null);
                    setSelectedFutsalType(null);
                  }}
                  className="font-mono"
                >
                  All Sports
                </Button>
                {sportCategories.map(category => (
                  <Button 
                    key={category} 
                    variant={selectedSportCategory === category ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => {
                      setSelectedSportCategory(category);
                      if (category !== "Futsal") {
                        setSelectedFutsalType(null);
                      }
                    }}
                    className="font-mono"
                  >
                    {category}
                  </Button>
                ))}
              </div>
              
              {/* Futsal Sub-types */}
              {selectedSportCategory === "Futsal" && (
                <div className="mt-3 pl-4 border-l-2 border-primary">
                  <div className="flex flex-wrap gap-2">
                    {futsalTypes.map(type => (
                      <Button 
                        key={type} 
                        variant={selectedFutsalType === type ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setSelectedFutsalType(selectedFutsalType === type ? null : type)}
                        className="font-mono"
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Venues Grid */}
          {loading ? <div className="text-center py-12">
              <p className="text-white/80">Loading venues...</p>
            </div> : filteredVenues.length === 0 ? <div className="text-center py-12">
              <p className="text-white/80">
                No venues found matching your criteria.
              </p>
            </div> : <>
              <p className="text-white/80 mb-6 font-mono">
                Showing {filteredVenues.length} venue{filteredVenues.length !== 1 ? 's' : ''}
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVenues.map(venue => <Card key={venue.id} className="overflow-hidden hover:shadow-card transition-all bg-black border-white/10">
                    <div className="h-48 overflow-hidden bg-gradient-pitch">
                      <img 
                        src={
                          selectedSportCategory === "Futsal" && venue.futsal_image_url 
                            ? venue.futsal_image_url 
                            : venue.image_url || "/placeholder.svg"
                        } 
                        alt={venue.name} 
                        className="w-full h-full object-cover hover:scale-105 transition-transform" 
                      />
                    </div>
                    <CardHeader className="bg-black">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-xl font-mono text-white">{venue.name}</CardTitle>
                        {venue.google_rating && (
                          <div className="flex items-center gap-1 text-accent">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="text-sm font-semibold">{venue.google_rating}</span>
                            {venue.google_reviews_count && (
                              <span className="text-xs text-white/60">({venue.google_reviews_count})</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-white/70">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">
                          {venue.location}, {venue.city}
                        </span>
                      </div>
                      {venue.phone && <div className="flex items-center gap-1 text-white/70">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm">{venue.phone}</span>
                        </div>}
                    </CardHeader>
                    <CardContent className="bg-black">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {getAvailableSports(venue.pitches).map((sport: string) => <Badge key={sport} variant="secondary" className="bg-white/10 text-white border-white/10">
                            {sport.toUpperCase()}
                          </Badge>)}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white/70">From</p>
                          <p className="text-xl font-bold text-primary">
                            €{getMinPrice(venue.pitches)}/hr
                          </p>
                        </div>
                        <Button asChild>
                          <Link to={`/booking/${venue.id}`}>Book Now</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>)}
              </div>
            </>}
        </div>
      </div>
    </div>;
};
export default Venues;