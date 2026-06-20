import { useParams } from "react-router-dom";
import { UserX } from "lucide-react";
import { ProfileView } from "@/components/profile/ProfileView";
import { PageLoader, EmptyState } from "@/components/common";
import { useInfluencer } from "@/hooks/useInfluencers";
import { useSubscription } from "@/hooks/useSubscription";

export default function BrandBloggerProfile() {
  const { id } = useParams();
  const { data, loading } = useInfluencer(id);
  const { isBrandPro } = useSubscription();

  if (loading) return <PageLoader />;
  if (!data) return <EmptyState icon={UserX} title="Blogger not found" />;

  return (
    <ProfileView
      influencer={data}
      locked={!isBrandPro}
      backTo="/brand/league"
      subscribeTo="/brand/subscription"
      showVerified={isBrandPro}
      enableFavorite
    />
  );
}
