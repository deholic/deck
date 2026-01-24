import type { Reaction, ReactionInput, Status } from "../../domain/types";

export const sortReactions = (reactions: Reaction[]) =>
  [...reactions].sort((a, b) => {
    if (a.count === b.count) {
      return a.name.localeCompare(b.name);
    }
    return b.count - a.count;
  });

export const buildReactionSignature = (reactions: Reaction[]) =>
  sortReactions(reactions).map((reaction) =>
    [reaction.name, reaction.count, reaction.url ?? "", reaction.isCustom ? "1" : "0", reaction.host ?? ""].join("|")
  );

export const hasSameReactions = (left: Status, right: Status) => {
  if (left.myReaction !== right.myReaction) {
    return false;
  }
  const leftSig = buildReactionSignature(left.reactions);
  const rightSig = buildReactionSignature(right.reactions);
  if (leftSig.length !== rightSig.length) {
    return false;
  }
  return leftSig.every((value, index) => value === rightSig[index]);
};

export const adjustReactionCount = (
  reactions: Reaction[],
  name: string,
  delta: number,
  fallback?: ReactionInput
) => {
  let updated = false;
  const next = reactions
    .map((reaction) => {
      if (reaction.name !== name) {
        return reaction;
      }
      updated = true;
      const count = reaction.count + delta;
      if (count <= 0) {
        return null;
      }
      return { ...reaction, count };
    })
    .filter((reaction): reaction is Reaction => reaction !== null);

  if (!updated && delta > 0 && fallback) {
    next.push({ ...fallback, count: delta });
  }

  return next;
};

export const buildOptimisticReactionStatus = (
  status: Status,
  reaction: ReactionInput,
  remove: boolean
): Status => {
  let nextReactions = status.reactions;
  if (remove) {
    nextReactions = adjustReactionCount(nextReactions, reaction.name, -1);
  } else {
    if (status.myReaction && status.myReaction !== reaction.name) {
      nextReactions = adjustReactionCount(nextReactions, status.myReaction, -1);
    }
    nextReactions = adjustReactionCount(nextReactions, reaction.name, 1, reaction);
  }
  const sorted = sortReactions(nextReactions);
  const favouritesCount = sorted.reduce((sum, item) => sum + item.count, 0);
  const myReaction = remove ? null : reaction.name;
  return {
    ...status,
    reactions: sorted,
    myReaction,
    favouritesCount,
    favourited: Boolean(myReaction)
  };
};
