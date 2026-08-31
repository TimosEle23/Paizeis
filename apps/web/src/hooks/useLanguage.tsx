import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'el' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Navbar
    'nav.home': 'Home',
    'nav.venues': 'Venues',
    'nav.tournaments': 'Tournaments',
    'nav.stats': 'Stats',
    'nav.rewards': 'Rewards',
    'nav.teams': 'My Teams',
    'nav.findTeam': 'No Team?',
    'nav.profile': 'Profile',
    'nav.signOut': 'Sign Out',
    'nav.signIn': 'Sign In',
    'nav.lightMode': 'Light Mode',
    'nav.darkMode': 'Dark Mode',
    
    // Home Page
    'home.hero.title': 'Where are we playing?',
    'home.hero.findPitch': 'Find Pitch',
    'home.hero.viewTournaments': 'View Tournaments',
    'home.sports.title': 'CY SPORTS - It\'s in the game!',
    'home.sports.5v5': '5v5',
    'home.sports.5v5.desc': 'Small-sided games',
    'home.sports.7v7': '7v7',
    'home.sports.7v7.desc': 'Medium pitch football',
    'home.sports.11v11': '11v11',
    'home.sports.11v11.desc': 'Full-size matches',
    'home.sports.paddle': 'Padel',
    'home.sports.paddle.desc': 'Padel tennis courts',
    'home.features.title': 'Stop calling your ex or your friend to ask, send him an invite instead!',
    'home.features.subtitle': 'From booking to tournaments, we\'ve got your futsal experience covered',
    'home.features.comingSoon': 'Coming soon...',
    'home.features.easyBooking': 'Easy Booking',
    'home.features.easyBooking.desc': 'Book your pitch in seconds with our intuitive calendar system',
    'home.features.findVenues': 'Find Venues',
    'home.features.findVenues.desc': 'Discover futsal venues near you',
    'home.features.teamManagement': 'Team Management',
    'home.features.teamManagement.desc': 'Invite friends and manage your squad effortlessly',
    'home.features.tournaments': 'Tournaments',
    'home.features.tournaments.desc': 'Compete in tournaments and climb the leaderboards',
    'home.features.trackStats': 'Track Stats',
    'home.features.trackStats.desc': 'Monitor your performance with detailed statistics',
    'home.features.earnRewards': 'Earn Rewards',
    'home.features.earnRewards.desc': 'Build streaks and unlock achievements',
    'home.cta.title': 'Ready to Play?',
    'home.cta.subtitle': 'Join thousands of players booking their matches every week',
    'home.cta.getStarted': 'Get Started',

    // Footer
    'footer.copyright': '© 2026 Pezeis. All rights reserved.',
    
    // Auth Page
    'auth.signIn': 'Sign In',
    'auth.createAccount': 'Create Account',
    'auth.signIn.desc': 'Enter your credentials to access your account',
    'auth.createAccount.desc': 'Fill in your details to create a new account',
    'auth.fullName': 'Full Name',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Forgot password?',
    'auth.signUp': 'Sign Up',
    'auth.adminCRM': 'Sign in as Admin (CRM)',
    'auth.orContinueWith': 'Or continue with',
    'auth.googleSignIn': 'Sign in with Google',
    'auth.noAccount': 'Don\'t have an account? Sign up',
    'auth.hasAccount': 'Already have an account? Sign in',
  },
  el: {
    // Navbar
    'nav.home': 'Home',
    'nav.venues': 'Fields',
    'nav.tournaments': 'Tournoua',
    'nav.stats': 'Statistika',
    'nav.rewards': 'Antamives',
    'nav.teams': 'My Teams',
    'nav.findTeam': 'Psaxneis Omada?',
    'nav.profile': 'Profile',
    'nav.signOut': 'Sign Out',
    'nav.signIn': 'Sign In',
    'nav.lightMode': 'Light Mode',
    'nav.darkMode': 'Dark Mode',
    
    // Home Page
    'home.hero.title': 'Paizeis futsal?',
    'home.hero.findPitch': 'Find Pitch',
    'home.hero.viewTournaments': 'View Tournaments',
    'home.sports.title': 'CY SPORTS - It\'s in the game!',
    'home.sports.5v5': '5v5',
    'home.sports.5v5.desc': 'Small-sided games',
    'home.sports.7v7': '7v7',
    'home.sports.7v7.desc': 'Medium pitch football',
    'home.sports.11v11': '11v11',
    'home.sports.11v11.desc': 'Full-size matches',
    'home.sports.paddle': 'Paddle',
    'home.sports.paddle.desc': 'Paddle tennis courts',
    'home.features.title': 'Stop calling your ex or your friend to ask, send him an invite instead!',
    'home.features.subtitle': 'From booking to tournaments, we\'ve got your futsal experience covered',
    'home.features.comingSoon': 'Coming soon...',
    'home.features.easyBooking': 'Easy Booking',
    'home.features.easyBooking.desc': 'Book your pitch in seconds with our intuitive calendar system',
    'home.features.findVenues': 'Find Venues',
    'home.features.findVenues.desc': 'Discover futsal venues near you',
    'home.features.teamManagement': 'Team Management',
    'home.features.teamManagement.desc': 'Invite friends and manage your squad effortlessly',
    'home.features.tournaments': 'Tournaments',
    'home.features.tournaments.desc': 'Compete in tournaments and climb the leaderboards',
    'home.features.trackStats': 'Track Stats',
    'home.features.trackStats.desc': 'Monitor your performance with detailed statistics',
    'home.features.earnRewards': 'Earn Rewards',
    'home.features.earnRewards.desc': 'Build streaks and unlock achievements',
    'home.cta.title': 'Ready to Play?',
    'home.cta.subtitle': 'Join thousands of players booking their matches every week',
    'home.cta.getStarted': 'Get Started',

    // Footer
    'footer.copyright': '© 2026 Pezeis. All rights reserved.',
    
    // Auth Page
    'auth.signIn': 'Sign In',
    'auth.createAccount': 'Create Account',
    'auth.signIn.desc': 'Enter your credentials to access your account',
    'auth.createAccount.desc': 'Fill in your details to create a new account',
    'auth.fullName': 'Full Name',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Forgot password?',
    'auth.signUp': 'Sign Up',
    'auth.adminCRM': 'Sign in as Admin (CRM)',
    'auth.orContinueWith': 'Or continue with',
    'auth.googleSignIn': 'Sign in with Google',
    'auth.noAccount': 'Don\'t have an account? Sign up',
    'auth.hasAccount': 'Already have an account? Sign in',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('el');

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
