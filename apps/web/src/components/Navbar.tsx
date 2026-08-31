import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, User, LogOut, Building2, CalendarDays, Shield, Users } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useAdminRole } from "@/hooks/useAdminRole";
import logoAsset from "@/assets/futsal_logo_pazeis.jpg.asset.json";
import menuIconAsset from "@/assets/menu_play.png.asset.json";
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const {
    user,
    signOut
  } = useAuth();
  const { t } = useLanguage();
  const {
    isAdmin,
    isVenueManager,
    loading: roleLoading
  } = useAdminRole(user);

  // Debug logging (development only)
  if (import.meta.env.DEV) {
    console.log('Navbar - User:', user?.email || 'not logged in', 'isAdmin:', isAdmin, 'isVenueManager:', isVenueManager, 'roleLoading:', roleLoading);
  }
  const getNavLinks = () => {
    if (isAdmin) {
      // Super admin navigation
      return [{
        to: "/super-admin-dashboard",
        label: "Dashboard"
      }, {
        to: "/admin/venues",
        label: "Manage Venues"
      }, {
        to: "/venue-manager-assignment",
        label: "Managers"
      }];
    } else if (isVenueManager) {
      // Venue manager navigation
      return [{
        to: "/venue-admin",
        label: "My Venues"
      }, {
        to: "/venue-admin",
        label: "Bookings"
      }];
    } else if (user) {
      // Regular signed-in user navigation
      // NOTE: Tournaments, Stats, Rewards, Teams and Find Team are built but
      // hidden for now — they will be rolled out as monthly additions.
      return [{
        to: "/",
        label: t('nav.home')
      }, {
        to: "/venues",
        label: t('nav.venues')
      }, {
        to: "/teams",
        label: "My Team"
      }];
    } else {
      // Signed-out visitors only see the sign-in action
      return [];
    }
  };
  const navLinks = getNavLinks();
  const isActive = (path: string) => location.pathname === path;
  return <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="h-16 items-center justify-between flex flex-row shadow-none">
          <a href="https://www.paizeiscy.com" className="flex items-center">
            <img src={logoAsset.url} alt="Paizeis?" className="h-12 w-auto" />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center flex-1 pl-8">
            <div className="flex-1 flex justify-center items-center lg:gap-8 md:gap-6">
              {navLinks.map((link, index) => <Link key={`${link.to}-${index}`} to={link.to} className={`text-base font-medium font-mono transition-colors hover:text-primary ${isActive(link.to) ? "text-primary" : "text-white/80"}`}>
                  {link.label}
                </Link>)}
            </div>
            <div className="flex items-center gap-2">
              {user && <Link to="/profile">
                <Button variant="ghost" size="icon" className="text-primary hover:text-primary hover:bg-primary/10">
                  <User className="h-5 w-5" />
                </Button>
              </Link>}
              {user ? <Button variant="outline" size="sm" onClick={signOut} className="border-white/20 text-white hover:bg-white/10 hover:text-white">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('nav.signOut')}
                </Button> : <Link to="/auth">
                  <Button variant="default" size="sm">
                    {t('nav.signIn')}
                  </Button>
                </Link>}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden transition-transform active:scale-95" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
            <img src={menuIconAsset.url} alt="" className={`h-9 w-9 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && <div className="md:hidden py-4 border-t border-white/10 bg-black">
            <div className="flex flex-col gap-4">
              {navLinks.map((link, index) => <Link key={`${link.to}-${index}`} to={link.to} onClick={() => setIsOpen(false)} className={`text-sm font-medium font-mono transition-colors hover:text-primary ${isActive(link.to) ? "text-primary" : "text-white/70"}`}>
                  {link.label}
                </Link>)}
              {user && <Link to="/profile" onClick={() => setIsOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10">
                  <User className="h-4 w-4 mr-2" />
                  {t('nav.profile')}
                </Button>
              </Link>}
              {user ? <Button variant="outline" size="sm" className="w-full border-white/20 text-white hover:bg-white/10 hover:text-white" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('nav.signOut')}
                </Button> : <Link to="/auth" onClick={() => setIsOpen(false)}>
                  <Button variant="default" size="sm" className="w-full">
                    {t('nav.signIn')}
                  </Button>
                </Link>}
            </div>
          </div>}
      </div>
    </nav>;
};
export default Navbar;