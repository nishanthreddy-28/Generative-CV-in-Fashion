import type { RecommendationFeedback } from "../types/domain";

export type FeedbackSentiment = RecommendationFeedback["sentiment"];
export type FeedbackReason = RecommendationFeedback["reasonCode"];

const positive: FeedbackReason[] = ["matches_style", "color_pairing", "occasion_match", "already_owned", "other"];
const negative: FeedbackReason[] = ["not_my_style", "color_mismatch", "wrong_occasion", "not_relevant", "other"];

export function feedbackReasons(sentiment: FeedbackSentiment): FeedbackReason[] {
  return sentiment === "like" ? positive : negative;
}

export const feedbackLabels: Record<FeedbackReason, string> = {
  matches_style: "My style",
  color_pairing: "Colours",
  occasion_match: "Occasion",
  already_owned: "Pieces I own",
  not_my_style: "Not my style",
  color_mismatch: "Colours feel off",
  wrong_occasion: "Wrong occasion",
  not_relevant: "Not relevant",
  other: "Other",
};

export function validateFeedback(sentiment: FeedbackSentiment | "", reason: FeedbackReason | "", note: string): boolean {
  return (sentiment === "like" || sentiment === "dislike")
    && feedbackReasons(sentiment).includes(reason as FeedbackReason)
    && note.length <= 1000;
}

export function feedbackMap(items: RecommendationFeedback[]): Record<string, RecommendationFeedback> {
  return Object.fromEntries(items.map((item) => [item.recommendationId, item]));
}
