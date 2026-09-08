import { InterviewQuestion, InterviewState } from '../types/interview';

/**
 * Question Deduplication & Prioritization Service (Part 7 & 8)
 * Ensures no duplicate questions are asked and checks if information is already known.
 */
export const questionDeduplicationService = {
  isDuplicateOrKnown(
    candidateQuestion: string,
    state: InterviewState,
    candidateCategory?: string
  ): boolean {
    const candidateLower = candidateQuestion.toLowerCase().trim();

    // 1. Check if exact or semantically similar question was already asked
    for (const q of state.askedQuestions) {
      const qLower = q.question.toLowerCase().trim();
      if (qLower === candidateLower) return true;

      // Semantic onset check
      if (
        (candidateLower.includes('when did') || candidateLower.includes('कब') || candidateLower.includes('कितनी देर') || candidateLower.includes('how long')) &&
        (qLower.includes('when did') || qLower.includes('कब') || qLower.includes('कितनी देर') || qLower.includes('how long'))
      ) {
        return true;
      }

      // Semantic location check
      if (
        (candidateLower.includes('where') || candidateLower.includes('किस जगह') || candidateLower.includes('कहाँ') || candidateLower.includes('कहा')) &&
        (qLower.includes('where') || qLower.includes('किस जगह') || qLower.includes('कहाँ') || qLower.includes('कहा'))
      ) {
        return true;
      }

      // Semantic character/nature check
      if (
        (candidateLower.includes('feel like') || candidateLower.includes('nature') || candidateLower.includes('कैसा महसूस') || candidateLower.includes('दर्द कैसा') || candidateLower.includes('किस तरह')) &&
        (qLower.includes('feel like') || qLower.includes('nature') || qLower.includes('कैसा महसूस') || qLower.includes('दर्द कैसा') || qLower.includes('किस तरह'))
      ) {
        return true;
      }

      // Semantic severity check
      if (
        (candidateLower.includes('scale') || candidateLower.includes('0 से 10') || candidateLower.includes('1 से 10') || candidateLower.includes('पैमाने') || candidateLower.includes('how severe')) &&
        (qLower.includes('scale') || qLower.includes('0 से 10') || qLower.includes('1 से 10') || qLower.includes('पैमाने') || qLower.includes('how severe'))
      ) {
        return true;
      }
    }

    // 2. Check if information is already in knownInformation or socrates
    const known = state.knownInformation || {};
    const socrates = known.socrates || {};

    if (candidateCategory === 'SYMPTOM_DETAILS' || !candidateCategory) {
      if ((candidateLower.includes('how long') || candidateLower.includes('when did') || candidateLower.includes('कब')) && (known.duration || known.onset || socrates.onset)) {
        return true;
      }
      if ((candidateLower.includes('where') || candidateLower.includes('किस जगह') || candidateLower.includes('कहाँ')) && (known.location || socrates.site)) {
        return true;
      }
      if ((candidateLower.includes('scale') || candidateLower.includes('severe') || candidateLower.includes('पैमाने') || candidateLower.includes('कितना गंभीर')) && (known.severity !== undefined || socrates.severity !== undefined)) {
        return true;
      }
      if ((candidateLower.includes('feel like') || candidateLower.includes('nature') || candidateLower.includes('कैसा महसूस') || candidateLower.includes('दर्द कैसा') || candidateLower.includes('किस तरह')) && (known.character || socrates.character)) {
        return true;
      }
    }

    // 3. Check if chief complaint was already asked and established
    if (candidateCategory === 'CHIEF_COMPLAINT' && (state.chiefComplaint || known.chief_complaint)) {
      return true;
    }

    return false;
  },
};
