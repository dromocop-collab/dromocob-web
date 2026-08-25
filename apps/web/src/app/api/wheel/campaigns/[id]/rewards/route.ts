import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase.admin";

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCampaignAvailable(data: any) {
  if (
    data?.published !== true ||
    data?.isActive !== true ||
    data?.popupEnabled === false ||
    String(data?.status || "") !== "active"
  ) {
    return false;
  }

  const now = Date.now();
  const startsAt = toMillis(data?.startsAt);
  let endsAt = toMillis(data?.endsAt);
  if (startsAt && now < startsAt) return false;
  if (startsAt && startsAt === endsAt) endsAt = 0;
  if (endsAt && now > endsAt) return false;
  return true;
}

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const campaignId = String(context.params?.id || "").trim();
    if (!campaignId || campaignId.length > 128) {
      return NextResponse.json({ rewards: [] }, { status: 400 });
    }

    const db = adminDb();
    const campaignSnap = await db.collection("wheel_campaigns").doc(campaignId).get();
    if (!campaignSnap.exists || !isCampaignAvailable(campaignSnap.data())) {
      return NextResponse.json({ rewards: [] }, { status: 404 });
    }

    const rewardsSnap = await db
      .collection("wheel_rewards")
      .where("campaignId", "==", campaignId)
      .limit(400)
      .get();

    const rewards = rewardsSnap.docs
      .map((item) => {
        const data = item.data() || {};
        return {
          id: item.id,
          campaignId,
          label: String(data.label || "").trim(),
          rewardType: String(data.rewardType || "fixed"),
          value: Number(data.value || 0),
          probabilityWeight: Number(data.probabilityWeight || 0),
          isActive: data.isActive !== false,
          isVisibleOnWheel: data.isVisibleOnWheel !== false,
          isWinnable: data.isWinnable !== false,
          color: String(data.color || ""),
          sortOrder: Number(data.sortOrder || 0),
        };
      })
      .filter((item) => item.isActive && item.isVisibleOnWheel && item.label)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "tr"));

    return NextResponse.json(
      { rewards },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("[wheel rewards public api] error:", error);
    return NextResponse.json({ rewards: [] }, { status: 500 });
  }
}
