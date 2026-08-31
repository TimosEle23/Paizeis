import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export const useAdminRole = (user: User | null) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVenueManager, setIsVenueManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRoles = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsVenueManager(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      
      try {
        if (import.meta.env.DEV) {
          console.log('Checking admin role for user:', user.id, user.email);
        }
        
        // Check admin role via the user_roles table (RLS restricts to own rows)
        const { data: adminRoleRows, error: adminError } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .limit(1);
        const hasAdminRole = !!adminRoleRows && adminRoleRows.length > 0;

        if (import.meta.env.DEV) {
          console.log('Admin role check result:', hasAdminRole, 'Error:', adminError);
        }

        if (adminError) {
          console.error('Error checking admin role:', adminError);
        }

        // Check if user is a venue manager
        const { data: venueManagerData, error: vmError } = await supabase
          .from('venue_managers')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (vmError) {
          console.error('Error checking venue manager:', vmError);
        }

        // Update all states together before setting loading to false
        const adminStatus = !!hasAdminRole;
        const vmStatus = venueManagerData && venueManagerData.length > 0;
        
        setIsAdmin(adminStatus);
        setIsVenueManager(vmStatus);
        setLoading(false);
      } catch (error) {
        console.error('Error checking roles:', error);
        setIsAdmin(false);
        setIsVenueManager(false);
        setLoading(false);
      }
    };

    checkRoles();
  }, [user]);

  return { isAdmin, isVenueManager, loading };
};
