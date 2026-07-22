/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ExamSpecification, 
  QuestionSpecification, 
  BloomLevel, 
  DifficultyLevel, 
  BlueprintType,
  Statistics 
} from "../types";
import { kbService, KnowledgeNode } from "./kbService";
import { dbService, chapters, questions } from "./db";

export interface ExamDesignOptions {
  examType: "adaptive" | "mock" | "revision" | "chapter" | "topic" | "custom" | "ai-smart" | "random";
  questionCount?: number;
  chapterId?: number;
  topicId?: string;
  difficulty?: DifficultyLevel;
  subjectId?: string;
}

export const assessmentDesignEngine = {
  /**
   * Generates a 100% deterministic, curriculum-aware ExamSpecification
   * before any questions are generated or retrieved.
   */
  designExam(options: ExamDesignOptions): ExamSpecification {
    const subjectId = options.subjectId || dbService.getActiveSubjectId();
    const count = options.questionCount || (options.examType === "mock" ? 25 : options.examType === "adaptive" ? 15 : 10);
    const nodes = kbService.getKnowledgeGraph(subjectId);
    const stats = dbService.getStatistics();

    // 1. Coverage Planning: Select concepts based on examType
    const selectedConcepts = this.planCoverage(options, count, nodes, stats);

    // 2. Assign Bloom, Difficulty, and Blueprint for each question
    const rawSpecs: QuestionSpecification[] = selectedConcepts.map((node, idx) => {
      const bloom = this.planBloomLevel(options.examType, idx, count, stats, node);
      const difficulty = this.planDifficulty(options.examType, idx, count, options.difficulty, stats, node);
      const blueprint = this.planBlueprint(idx, bloom, node);

      return {
        questionIndex: idx + 1,
        concept: node.concept,
        chapterId: node.chapter,
        topicId: node.topic,
        bloom,
        difficulty,
        blueprint,
        evidenceIds: [node.id],
        reason: `Designed for ${options.examType} exam targeting Chapter ${node.chapter} concept '${node.concept}' with ${bloom} Bloom level and ${blueprint} blueprint.`,
        targetMisconception: node.commonMistakes || node.teaching?.misconception
      };
    });

    // 3. Dependency Awareness: Sort by prerequisite order
    const dependencyOrdered = this.applyDependencyOrdering(rawSpecs, nodes);

    // 4. Rhythm & Diversity Balancing (Avoid 5 consecutive same Bloom/Difficulty/Blueprint)
    const rhythmOrdered = this.applyRhythmAndDiversity(dependencyOrdered);

    // Re-index after reordering
    const finalQuestionSpecs = rhythmOrdered.map((spec, idx) => ({
      ...spec,
      questionIndex: idx + 1
    }));

    // 5. Calculate Exam-level Distributions & Metadata
    const coverage: Record<number, number> = {};
    const bloomDist: Record<string, { count: number; percentage: number }> = {};
    const diffDist: Record<string, { count: number; percentage: number }> = {};
    const blueprintDist: Record<string, { count: number; percentage: number }> = {};
    const rhythmSequence: string[] = [];

    finalQuestionSpecs.forEach(q => {
      coverage[q.chapterId] = (coverage[q.chapterId] || 0) + 1;

      if (!bloomDist[q.bloom]) bloomDist[q.bloom] = { count: 0, percentage: 0 };
      bloomDist[q.bloom].count += 1;

      if (!diffDist[q.difficulty]) diffDist[q.difficulty] = { count: 0, percentage: 0 };
      diffDist[q.difficulty].count += 1;

      if (!blueprintDist[q.blueprint]) blueprintDist[q.blueprint] = { count: 0, percentage: 0 };
      blueprintDist[q.blueprint].count += 1;

      rhythmSequence.push(`${q.difficulty}-${q.bloom}-${q.blueprint}`);
    });

    const total = finalQuestionSpecs.length || 1;
    Object.keys(bloomDist).forEach(k => {
      bloomDist[k].percentage = Math.round((bloomDist[k].count / total) * 100);
    });
    Object.keys(diffDist).forEach(k => {
      diffDist[k].percentage = Math.round((diffDist[k].count / total) * 100);
    });
    Object.keys(blueprintDist).forEach(k => {
      blueprintDist[k].percentage = Math.round((blueprintDist[k].count / total) * 100);
    });

    // Calculate planned time (avg 1.5 mins per question)
    const plannedTimeMinutes = Math.ceil(total * 1.5);

    return {
      id: `spec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      examType: options.examType,
      subjectId,
      questionCount: total,
      questionSpecs: finalQuestionSpecs,
      coverage,
      bloomDistribution: bloomDist,
      difficultyDistribution: diffDist,
      blueprintDistribution: blueprintDist,
      rhythmSequence,
      plannedTimeMinutes,
      generatorVersion: "v3.0-assessment-design-engine",
      createdAt: new Date().toISOString()
    };
  },

  /**
   * Coverage Planner: Decides how many questions each chapter gets
   */
  planCoverage(
    options: ExamDesignOptions, 
    count: number, 
    nodes: KnowledgeNode[], 
    stats: Statistics
  ): KnowledgeNode[] {
    if (nodes.length === 0) return [];

    let filteredNodes = [...nodes];

    if (options.chapterId) {
      filteredNodes = nodes.filter(n => n.chapter === options.chapterId);
      if (filteredNodes.length === 0) filteredNodes = [...nodes];
    } else if (options.topicId) {
      filteredNodes = nodes.filter(n => n.topic === options.topicId);
      if (filteredNodes.length === 0) filteredNodes = [...nodes];
    }

    const mastery = stats.conceptMastery || {};

    if (options.examType === "revision") {
      // Prioritize unmastered concepts -> previously incorrect concepts -> lower mastery
      filteredNodes.sort((a, b) => {
        const scoreA = mastery[a.concept] ?? 50;
        const scoreB = mastery[b.concept] ?? 50;
        return scoreA - scoreB;
      });
    } else if (options.examType === "adaptive") {
      // Sort by mastery gap & importance
      filteredNodes.sort((a, b) => {
        const scoreA = mastery[a.concept] ?? 50;
        const scoreB = mastery[b.concept] ?? 50;
        const importanceWeightA = (a.importance || 3) * (100 - scoreA);
        const importanceWeightB = (b.importance || 3) * (100 - scoreB);
        return importanceWeightB - importanceWeightA;
      });
    } else if (options.examType === "mock") {
      // Proportional distribution across all chapters
      const chapterList = chapters.map(c => c.id);
      const nodesByChapter = new Map<number, KnowledgeNode[]>();
      chapterList.forEach(cId => {
        nodesByChapter.set(cId, filteredNodes.filter(n => n.chapter === cId));
      });

      const selected: KnowledgeNode[] = [];
      let round = 0;
      while (selected.length < count && selected.length < filteredNodes.length) {
        for (const cId of chapterList) {
          const chNodes = nodesByChapter.get(cId) || [];
          if (chNodes[round] && !selected.some(s => s.id === chNodes[round].id)) {
            selected.push(chNodes[round]);
            if (selected.length >= count) break;
          }
        }
        round++;
        if (round > 20) break;
      }
      if (selected.length > 0) return selected;
    } else if (options.examType === "random") {
      // Đề ngẫu nhiên tổng hợp: xáo trộn thứ tự chương và node trong từng chương,
      // rồi round-robin qua các chương để chắc chắn TRẢI RỘNG mọi chương có câu hỏi.
      const shuffle = <T,>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };
      const chapterList = shuffle(chapters.map(c => c.id));
      const nodesByChapter = new Map<number, KnowledgeNode[]>();
      chapterList.forEach(cId => {
        nodesByChapter.set(cId, shuffle(filteredNodes.filter(n => n.chapter === cId)));
      });

      const selected: KnowledgeNode[] = [];
      let round = 0;
      while (selected.length < count && selected.length < filteredNodes.length) {
        for (const cId of chapterList) {
          const chNodes = nodesByChapter.get(cId) || [];
          if (chNodes[round] && !selected.some(s => s.id === chNodes[round].id)) {
            selected.push(chNodes[round]);
            if (selected.length >= count) break;
          }
        }
        round++;
        if (round > 50) break;
      }
      if (selected.length > 0) return selected;
    }

    // Default: Pick balanced set up to `count`
    const pool = [...filteredNodes];
    const selected: KnowledgeNode[] = [];
    for (let i = 0; i < count; i++) {
      const node = pool[i % pool.length];
      selected.push(node);
    }
    return selected;
  },

  /**
   * Bloom Distribution Planner
   */
  planBloomLevel(
    examType: string, 
    index: number, 
    total: number, 
    stats: Statistics, 
    node: KnowledgeNode
  ): BloomLevel {
    const ratio = index / total;

    if (examType === "adaptive") {
      const conceptScore = (stats.conceptMastery || {})[node.concept] ?? 50;
      if (conceptScore < 40) return "Remember";
      if (conceptScore < 70) return "Understand";
      if (conceptScore < 85) return "Apply";
      return "Analyze";
    }

    // Standard Mock Bloom Distribution: Remember 30%, Understand 30%, Apply 20%, Analyze 15%, Evaluate 5%
    if (ratio < 0.30) return "Remember";
    if (ratio < 0.60) return "Understand";
    if (ratio < 0.80) return "Apply";
    if (ratio < 0.95) return "Analyze";
    return "Evaluate";
  },

  /**
   * Difficulty Planner
   */
  planDifficulty(
    examType: string, 
    index: number, 
    total: number, 
    overrideDifficulty?: DifficultyLevel, 
    stats?: Statistics, 
    node?: KnowledgeNode
  ): DifficultyLevel {
    if (overrideDifficulty) return overrideDifficulty;

    const ratio = index / total;

    if (examType === "adaptive" && node && stats) {
      const score = (stats.conceptMastery || {})[node.concept] ?? 50;
      if (score < 40) return "Dễ";
      if (score < 75) return "Trung bình";
      return "Khó";
    }

    // Standard distribution: Easy 25%, Medium 50%, Hard 25%
    if (ratio < 0.25) return "Dễ";
    if (ratio < 0.75) return "Trung bình";
    return "Khó";
  },

  /**
   * Blueprint Planner with Misconception Persistence Integration
   */
  planBlueprint(index: number, bloom: BloomLevel, node: KnowledgeNode, stats?: Statistics): BlueprintType {
    const wrongHist = stats?.incorrectQuestionHistory || {};
    const conceptQs = questions.filter(q => q.concept === node.concept);
    const hasPersistentMisconception = conceptQs.some(q => (wrongHist[q.id] || 0) >= 2);

    if (hasPersistentMisconception) {
      return "misconception-analysis";
    }

    if (node.type === "Definition") {
      return bloom === "Remember" ? "definition-recall" : "comparative-analysis";
    }
    if (node.type === "Process" || node.type === "Model") {
      return bloom === "Analyze" ? "scenario-based" : "step-by-step-problem-solving";
    }
    if (node.commonMistakes || node.teaching?.misconception) {
      if (index % 3 === 0) return "misconception-analysis";
    }

    const blueprints: BlueprintType[] = [
      "scenario-based",
      "misconception-analysis",
      "definition-recall",
      "comparative-analysis",
      "step-by-step-problem-solving",
      "cause-effect-reasoning"
    ];

    return blueprints[index % blueprints.length];
  },

  /**
   * Dependency Awareness Ordering
   * Ensures prerequisite concepts appear before dependent concepts
   */
  applyDependencyOrdering(specs: QuestionSpecification[], nodes: KnowledgeNode[]): QuestionSpecification[] {
    const nodeMap = new Map<string, KnowledgeNode>();
    nodes.forEach(n => nodeMap.set(n.concept, n));

    const sorted = [...specs];

    sorted.sort((a, b) => {
      const nodeA = nodeMap.get(a.concept);
      const nodeB = nodeMap.get(b.concept);

      if (!nodeA || !nodeB) return 0;

      // If B requires A, A must come before B
      if (nodeB.dependencies?.requires?.includes(a.concept)) {
        return -1;
      }
      // If A requires B, B must come before A
      if (nodeA.dependencies?.requires?.includes(b.concept)) {
        return 1;
      }

      return 0;
    });

    return sorted;
  },

  /**
   * Shannon Cognitive Entropy Rhythm & Diversity Balancing v3.0
   * Calculates entropy H = - sum(p_i * log2(p_i)) over 3-item sliding window
   * to maximize cognitive rhythm diversity and eliminate monotonous patterns.
   */
  applyRhythmAndDiversity(specs: QuestionSpecification[]): QuestionSpecification[] {
    if (specs.length <= 3) return specs;

    const result: QuestionSpecification[] = [];
    const pool = [...specs];

    const calculateWindowEntropy = (window: QuestionSpecification[]): number => {
      const counts: Record<string, number> = {};
      window.forEach(item => {
        const key = `${item.difficulty}-${item.bloom}-${item.blueprint}`;
        counts[key] = (counts[key] || 0) + 1;
      });
      let entropy = 0;
      const total = window.length;
      Object.values(counts).forEach(c => {
        const p = c / total;
        if (p > 0) entropy -= p * Math.log2(p);
      });
      return entropy;
    };

    while (pool.length > 0) {
      let bestCandidateIdx = 0;
      let maxEntropy = -1;

      if (result.length >= 2) {
        const last2 = result.slice(-2);
        for (let i = 0; i < pool.length; i++) {
          const testWindow = [...last2, pool[i]];
          const entropy = calculateWindowEntropy(testWindow);
          if (entropy > maxEntropy) {
            maxEntropy = entropy;
            bestCandidateIdx = i;
          }
        }
      }

      result.push(pool[bestCandidateIdx]);
      pool.splice(bestCandidateIdx, 1);
    }

    return result;
  }
};
