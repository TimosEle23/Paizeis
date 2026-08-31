import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, MapPin, Trophy, TrendingUp, Users, Award } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useLanguage } from "@/hooks/useLanguage";
import futsal5Background from "@/assets/futsal_5.mp4.asset.json";
import futsal11Background from "@/assets/futsal_11.mp4.asset.json";
import futsal12Background from "@/assets/futsal_12.mp4.asset.json";

const Dashboard = () => {
  const { t } = useLanguage();

  const activeFeatures = [{
    icon: Calendar,
    title: t('home.features.easyBooking'),
    description: t('home.features.easyBooking.desc'),
    to: '/venues'
  }, {
    icon: MapPin,
    title: t('home.features.findVenues'),
    description: t('home.features.findVenues.desc'),
    to: '/venues'
  }, {
    icon: Users,
    title: t('home.features.teamManagement'),
    description: t('home.features.teamManagement.desc'),
    to: '/teams'
  }];

  const comingSoonFeatures = [{
    icon: Trophy,
    title: t('home.features.tournaments'),
    description: t('home.features.tournaments.desc')
  }, {
    icon: TrendingUp,
    title: t('home.features.trackStats'),
    description: t('home.features.trackStats.desc')
  }, {
    icon: Award,
    title: t('home.features.earnRewards'),
    description: t('home.features.earnRewards.desc')
  }];

  const sports = [{
    name: t('home.sports.5v5'),
    description: t('home.sports.5v5.desc'),
    filter: '5v5'
  }, {
    name: t('home.sports.7v7'),
    description: t('home.sports.7v7.desc'),
    filter: '7v7'
  }, {
    name: t('home.sports.11v11'),
    description: t('home.sports.11v11.desc'),
    filter: '11v11'
  }];

  return <div className="min-h-screen bg-background">
      <Navbar />

      {/* Sports Types */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
          <video
            src={futsal11Background.url}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative container mx-auto px-4">
          <h2 className="text-center mb-12 font-mono text-lg font-extrabold text-primary">{t('home.sports.title')}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {sports.map(sport => (
              <Link key={sport.name} to={`/venues?filter=${sport.filter}`}>
                <Card className="bg-black/40 border-white/10 hover:shadow-glow transition-all cursor-pointer h-full w-40 sm:w-48">
                  <CardContent className="p-6 text-center">
                    <h3 className="text-2xl font-bold text-primary mb-2 font-mono uppercase">{sport.name}</h3>
                    <p className="text-sm text-white/80 font-mono">{sport.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
          <video
            src={futsal5Background.url}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        <div className="relative container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4 font-mono text-primary uppercase">{t('home.features.title')}</h2>
          <p className="text-center text-white/80 mb-12 max-w-2xl mx-auto font-mono">
            {t('home.features.subtitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {activeFeatures.map(feature => (
              <Link key={feature.title} to={feature.to}>
                <Card className="bg-black/40 border-white/10 hover:shadow-card transition-all cursor-pointer h-full">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 rounded-lg bg-gradient-pitch flex items-center justify-center mb-4 mx-auto">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 font-mono text-white uppercase">{feature.title}</h3>
                    <p className="text-white/70 font-mono">{feature.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="my-12 text-center">
            <span className="text-primary font-mono text-2xl font-bold tracking-wider uppercase">
              {t('home.features.comingSoon')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto opacity-70">
            {comingSoonFeatures.map(feature => (
              <Card key={feature.title} className="bg-black/40 border-white/10 transition-all h-full">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-lg bg-gradient-pitch flex items-center justify-center mb-4 mx-auto">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 font-mono text-white uppercase">{feature.title}</h3>
                  <p className="text-white/70 font-mono">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
          <video
            src={futsal12Background.url}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        <div className="relative container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4 font-mono uppercase">{t('home.cta.title')}</h2>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto font-mono text-lg">
            {t('home.cta.subtitle')}
          </p>
          <Button asChild size="lg">
            <Link to="/venues" className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-semibold">{t('home.cta.getStarted')}</Link>
          </Button>
        </div>
      </section>
    </div>;
};

export default Dashboard;
