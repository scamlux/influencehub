import { useParams } from "react-router-dom";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default function InfluencerChat() {
  const { dealId } = useParams();
  if (!dealId) return null;
  return <ChatWindow dealId={dealId} backTo="/influencer/deals" />;
}
