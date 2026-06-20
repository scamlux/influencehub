import { useParams } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ProfileView } from "@/components/profile/ProfileView";
import { PageLoader, EmptyState } from "@/components/common";
import { useInfluencer } from "@/hooks/useInfluencers";
import { UserX } from "lucide-react";

export default function BloggerProfile() {
  const { id } = useParams();
  const { data, loading } = useInfluencer(id);

  return (
    <PublicLayout>
      <div className="container py-10">
        {loading ? (
          <PageLoader />
        ) : !data ? (
          <EmptyState icon={UserX} title="Blogger not found" />
        ) : (
          // Public visitors never have a Brand Pro subscription → sections locked
          <ProfileView influencer={data} locked backTo="/league" subscribeTo="/pricing" />
        )}
      </div>
    </PublicLayout>
  );
}
