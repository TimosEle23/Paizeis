import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import homepageDesktopBackground from "@/assets/homepage_paizeis.mp4.asset.json";
import futsalMobileBackground from "@/assets/futsal_mobile.mp4.asset.json";
import paizeisFutsalLogo from "@/assets/paizeis_futsal.jpg.asset.json";

const Index = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  return <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-16 overflow-hidden flex-1 min-h-[85vh] md:min-h-[80vh]">
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
          {/* Desktop/Tablet background video */}
          <video
            src={homepageDesktopBackground.url}
            autoPlay
            loop
            muted
            playsInline
            className="hidden md:block w-full h-full object-cover"
          />
          {/* Mobile background video */}
          <video
            src={futsalMobileBackground.url}
            autoPlay
            loop
            muted
            playsInline
            className="block md:hidden w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative container mx-auto min-h-[85vh] md:min-h-[80vh] flex items-end justify-center px-6 md:px-8 pb-16 md:pb-20 lg:pb-24">
          <div className="max-w-2xl text-center">
            <div className="flex justify-center">
              <Link
                to={user ? "/venues" : "/auth"}
                className="block rounded-full overflow-hidden shadow-[0_10px_30px_-6px_hsl(var(--primary)/0.7)] hover:shadow-[0_14px_36px_-6px_hsl(var(--primary)/0.9)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ring-2 ring-primary/40"
              >
                <img
                  src={paizeisFutsalLogo.url}
                  alt={user ? "Continue" : t('nav.signIn')}
                  className="w-28 sm:w-32 md:w-36 aspect-square object-cover bg-black text-center"
                />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-white/10 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <span className="text-white/80 font-mono text-sm">
            {t('footer.copyright')}
          </span>
        </div>
      </footer>
    </div>;
};

export default Index;
