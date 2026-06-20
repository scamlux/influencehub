import { PublicLayout } from "@/components/layout/PublicLayout";
import { useLanguage } from "@/hooks/useLanguage";

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "1. Acceptance of Terms",
    body: "By accessing or using InfluenceHub (the “Platform”), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.",
  },
  {
    heading: "2. Accounts",
    body: "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate information and keep it up to date.",
  },
  {
    heading: "3. Marketplace Role",
    body: "InfluenceHub connects brands with influencers. We are not a party to any agreement, deal, or transaction entered into between brands and creators, and we do not guarantee the performance, quality, or legality of any collaboration.",
  },
  {
    heading: "4. Subscriptions & Payments",
    body: "Certain features require a paid subscription. Fees are billed in advance and are non-refundable except where required by law. You may cancel at any time; access continues until the end of the current billing period.",
  },
  {
    heading: "5. Acceptable Use",
    body: "You agree not to misuse the Platform, including by scraping data without permission, impersonating others, posting unlawful content, or interfering with the Platform's operation or security.",
  },
  {
    heading: "6. Intellectual Property",
    body: "All Platform content, trademarks, and software are owned by InfluenceHub or its licensors. You retain ownership of content you submit but grant us a license to display it as needed to operate the service.",
  },
  {
    heading: "7. Termination",
    body: "We may suspend or terminate your access if you violate these Terms or engage in conduct that harms the Platform or other users.",
  },
  {
    heading: "8. Disclaimers & Liability",
    body: "The Platform is provided “as is” without warranties of any kind. To the maximum extent permitted by law, InfluenceHub is not liable for indirect or consequential damages arising from your use of the Platform.",
  },
  {
    heading: "9. Changes",
    body: "We may update these Terms from time to time. Continued use after changes take effect constitutes acceptance of the revised Terms.",
  },
  {
    heading: "10. Contact",
    body: "Questions about these Terms can be sent to legal@influencehub.uz.",
  },
];

export default function Terms() {
  const { t } = useLanguage();
  return (
    <PublicLayout>
      <div className="container max-w-3xl py-12">
        <h1 className="text-3xl font-bold tracking-tight">{t("legal.terms.title")}</h1>
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
