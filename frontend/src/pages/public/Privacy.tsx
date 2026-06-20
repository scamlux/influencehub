import { PublicLayout } from "@/components/layout/PublicLayout";
import { useLanguage } from "@/hooks/useLanguage";

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "1. Information We Collect",
    body: "We collect information you provide directly — such as your name, email, role, and profile details — as well as usage data and analytics generated when you interact with the Platform.",
  },
  {
    heading: "2. How We Use Information",
    body: "We use your information to operate and improve the Platform, match brands with creators, process payments, provide support, and send service-related communications.",
  },
  {
    heading: "3. Public Profiles",
    body: "If you are an influencer, certain profile data (display name, category, follower counts, engagement) may be shown publicly in the league. You can control visibility from your profile settings.",
  },
  {
    heading: "4. Sharing of Information",
    body: "We do not sell your personal data. We share information with service providers (e.g., payment processors) only as needed to operate the Platform, and when required by law.",
  },
  {
    heading: "5. Cookies",
    body: "We use cookies and local storage to keep you signed in, remember preferences such as language, and understand how the Platform is used.",
  },
  {
    heading: "6. Data Retention",
    body: "We retain your information for as long as your account is active or as needed to provide the service and comply with legal obligations.",
  },
  {
    heading: "7. Your Rights",
    body: "Depending on your location, you may have the right to access, correct, export, or delete your personal data. To exercise these rights, contact us at privacy@influencehub.uz.",
  },
  {
    heading: "8. Security",
    body: "We implement reasonable technical and organisational measures to protect your data, but no method of transmission or storage is completely secure.",
  },
  {
    heading: "9. Children's Privacy",
    body: "The Platform is not intended for individuals under 16. We do not knowingly collect data from children.",
  },
  {
    heading: "10. Changes & Contact",
    body: "We may update this Policy periodically. For any questions, contact privacy@influencehub.uz.",
  },
];

export default function Privacy() {
  const { t } = useLanguage();
  return (
    <PublicLayout>
      <div className="container max-w-3xl py-12">
        <h1 className="text-3xl font-bold tracking-tight">{t("legal.privacy.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("legal.lastUpdated")}: 19 June 2026</p>
        <div className="mt-8 space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="font-semibold">{s.heading}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
